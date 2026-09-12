import {expect} from 'chai';
import {describe,it,afterEach} from 'mocha';
import sinon from 'sinon';
import {QueryExecutor} from '../../../../src/core/modules/query/QueryExecutor.js';
import {ModuleNotInitializedError,ConfigurationError} from '../../../../src/core/errors.js';

const result=(rows:any[][]=[])=>({columns:[],rows,executionTime:1});
async function rejected(fn:()=>Promise<any>, type:any=Error){let error:unknown;try{await fn();}catch(e){error=e;}expect(error).to.be.instanceOf(type);return error;}
function executor(){
    const q:any=new QueryExecutor(); q._initialized=true;
    q.logger=new Proxy({}, {get:()=>()=>{}});
    q.connectionManager={getConnection:async()=>({execute:async()=>result([[1],[2]])}),releaseConnection:async()=>{}};
    return q;
}

describe('Query executor boundaries',()=>{
    afterEach(()=>sinon.restore());
    it('requires initialized dependencies and exposes registered optional modules',async()=>{
        for(const dependency of [undefined,{isInitialized:false}]){
            const q=new QueryExecutor(); await rejected(()=>q.initialize({getModule:()=>dependency} as any)); await q.destroy();
        }
        const q=new QueryExecutor();
        await q.initialize({getModule:(name:string)=>name==='connection-manager'?{isInitialized:true}:undefined} as any);
        expect(q.getQueryValidator()).to.equal(null); expect(q.getParameterizedQuery()).to.equal(null);
        expect(q.eventNames()).to.deep.equal([]); await q.destroy();
    });
    it('rejects uninitialized batch, stream, positional and named queries',async()=>{
        const q=new QueryExecutor();
        await rejected(()=>q.executeQueries(['SELECT 1']),ModuleNotInitializedError);
        await rejected(()=>q.executeStreamingQuery('SELECT 1').next(),ModuleNotInitializedError);
        await rejected(()=>q.executeParameterizedQuery('SELECT ?',[]),ModuleNotInitializedError);
        await rejected(()=>q.executeNamedQuery('SELECT :x',{}),ModuleNotInitializedError);
    });
    it('rejects missing parameter modules and invalid streaming batch sizes',async()=>{
        const q=executor();
        await rejected(()=>q.executeParameterizedQuery('SELECT ?',[]),ConfigurationError);
        await rejected(()=>q.executeNamedQuery('SELECT :x',{}),ConfigurationError);
        for(const size of [0,-1,1.5,Infinity])await rejected(()=>q.executeStreamingQuery('SELECT 1',size).next(),ConfigurationError);
        q.connectionManager=null;
        await rejected(()=>q.getConnection()); await rejected(()=>q.releaseConnection({}));
        await q.destroy();
    });
    it('forwards positional and named parameters, deadlines, results and failures',async()=>{
        const q=executor();const calls:any[]=[];
        const execute=async(...args:any[])=>{calls.push(args);return result(args[0].startsWith('SELECT')?[[42]]:[]);};
        q.parameterizedQuery={execute,executeNamed:execute};
        for(const method of ['executeParameterizedQuery','executeNamedQuery']){
            const params=method==='executeNamedQuery'?{value:42}:[42];
            for(const sql of ['SELECT 42','UPDATE T SET X=42','SELECT '+ 'x'.repeat(120)]){
                const response=await q[method](sql,params,{timeoutMs:10});
                expect(response.rows).to.deep.equal(sql.startsWith('SELECT')?[[42]]:[]);
                expect(calls.at(-1)).to.deep.equal([sql,params,{timeoutMs:10}]);
            }
            const failure=new Error('database unavailable');
            q.parameterizedQuery[method==='executeNamedQuery'?'executeNamed':'execute']=async()=>{throw failure;};
            expect(await rejected(()=>q[method]('SELECT 42',params))).to.equal(failure);
        }
        await q.destroy();
    });
    it('invalidates cached reads around positional and named mutations',async()=>{
        const q=executor(); let value=1;
        q.connectionManager.getConnection=async()=>({execute:async()=>result([[value]])});
        q.parameterizedQuery={execute:async()=>{value++;return result();},executeNamed:async()=>{value++;return result();}};
        try{
            await q.executeQuery('SELECT X FROM T');
            await q.executeParameterizedQuery('UPDATE T SET X=?',[2]);
            expect((await q.executeQuery('SELECT X FROM T')).rows).to.deep.equal([[2]]);
            await q.executeNamedQuery('UPDATE T SET X=:x',{x:3});
            expect((await q.executeQuery('SELECT X FROM T')).rows).to.deep.equal([[3]]);
        }finally{await q.destroy();}
    });
    it('truncates oversized results and accepts empty results without caching',async()=>{
        const q=executor();
        expect((await q.executeQuery('SELECT X FROM T',{maxResultSize:1})).rows).to.deep.equal([[1]]);
        q.connectionManager.getConnection=async()=>({execute:async()=>result()});
        expect((await q.executeQuery('SELECT Y FROM T')).rows).to.deep.equal([]);
        expect(q.shouldCacheResult({})).to.equal(false); expect(q.estimateResultSize({})).to.equal(100);
        expect(q.estimateResultSize({rows:[{}]})).to.equal(1100);
        await q.destroy();
    });
    it('expires cache entries and evicts oldest entries down to the size target',async()=>{
        const q=executor();const clock=sinon.useFakeTimers();
        q.cacheResult('SELECT 1','expired',result([[1]]),10);
        await clock.tickAsync(11);expect(q.getCachedResult('SELECT 1','expired')).to.equal(null);
        q.config.maxCacheSize=2500;
        for(let i=0;i<3;i++){q.cacheResult('SELECT 1',String(i),result([[1]]),1000);await clock.tickAsync(1);}
        expect([...q.queryCache.keys()]).to.deep.equal(['2']);
        q.queryCache.set('stale',{timestamp:new Date(-10000),ttl:1});
        for(let i=0;i<1002;i++)q.queryTracking.set(String(i),{lastSeen:new Date(i)});
        q.performCleanup();expect(q.queryCache.has('stale')).to.equal(false);
        expect(q.queryTracking.size).to.equal(1000);expect(q.queryTracking.has('0')).to.equal(false);
        q.performCleanup();await q.destroy();
    });
    it('records security warnings and performance hints without skipping valid SQL',async()=>{
        const q=executor();
        q.queryValidator={validateQuery:async()=>({isValid:true,errors:[],securityIssues:['warning'],performanceHints:['index']})};
        expect((await q.executeQuery('SELECT 1')).rows).to.deep.equal([[1],[2]]);
        q.queryValidator={validateQuery:async()=>{throw 'validator offline';}};
        await rejected(()=>q.executeQuery('SELECT 1'));
        await q.destroy();
    });
    it('normalizes initialization failures and propagates destruction failures',async()=>{
        const q:any=new QueryExecutor();
        await rejected(()=>q.initialize({getModule:()=>{throw 'offline';}}));
        await q.destroy();
        const ready=executor();const failure=new Error('cache unavailable');
        const clear=sinon.stub(ready.queryCache,'clear').throws(failure);
        expect(await rejected(()=>ready.destroy())).to.equal(failure);
        clear.restore();await ready.destroy();
    });
    it('classifies read, mutation, DDL and unknown statements for statistics',()=>{
        const q=executor();
        for(const kind of ['SELECT','INSERT','UPDATE','DELETE','CREATE','DROP','ALTER'])expect(q.detectQueryType(' '+kind.toLowerCase()+' T')).to.equal(kind);
        expect(q.detectQueryType('CALL routine()')).to.equal('OTHER');
    });

    it('expires cached entries from the scheduled cleanup callback',async()=>{
        const clock=sinon.useFakeTimers();const q=executor();q.startCleanupInterval();q.cacheResult('SELECT 1','expired',result([[1]]),1);
        await clock.tickAsync(60000);expect(q.queryCache.size).to.equal(0);await q.destroy();
    });

});
