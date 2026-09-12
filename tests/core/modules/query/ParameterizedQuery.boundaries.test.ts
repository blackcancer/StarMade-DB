import {expect} from 'chai';
import {describe,it,afterEach} from 'mocha';
import sinon from 'sinon';
import {ParameterizedQuery,BindingStrategy,ParameterType} from '../../../../src/core/modules/query/ParameterizedQuery.js';

function query(){const q:any=new ParameterizedQuery();q._initialized=true;q.config={enableInjectionDetection:false,enableParameterValidation:true,maxParametersPerQuery:10,enableStatementCaching:true,maxCachedStatements:10,maxBatchSize:2,defaultTimeoutMs:1000};q.logger=new Proxy({}, {get:()=>()=>{}});q.connectionManager={getConnection:async()=>({execute:async()=>({rows:[],columns:[],rowsAffected:1})}),releaseConnection:async()=>{}};return q;}
async function rejected(fn:()=>Promise<any>){let error:unknown;try{await fn();}catch(e){error=e;}expect(error).to.be.instanceOf(Error);return error;}
describe('Parameterized query boundaries',()=>{
    afterEach(()=>sinon.restore());
    it('checks module lifecycle and integration defaults',async()=>{
        const q:any=new ParameterizedQuery();expect(()=>q.buildConfiguration()).to.throw();q.setupModuleIntegrations();
        expect(()=>q.updateConfiguration({})).to.throw();expect(q.getConfiguration()).to.equal(undefined);
        await rejected(()=>q.executeNamed('SELECT :x',{x:1}));await rejected(()=>q.executeBatch('SELECT ?',[[1]]));
        q.manager={getConfiguration:()=>({}),getModule:()=>undefined};q.buildConfiguration();expect(q.getConfiguration().defaultTimeoutMs).to.equal(30000);
        expect(q.getPerformanceMonitor()).to.equal(undefined);expect(q.getCacheManager()).to.equal(undefined);expect(q.eventNames()).to.be.an('array');
    });
    it('rejects empty/oversized batches and keeps individual errors visible',async()=>{
        const q=query();
        await rejected(()=>q.executeBatch('SELECT ?',[]));await rejected(()=>q.executeBatch('SELECT ?',[[1],[2],[3]]));
        const released:any[]=[];q.connectionManager={getConnection:async()=>({execute:async(_sql:string,p:any[])=>{if(p[0]===2)throw 'offline';return {rows:[],columns:[],rowsAffected:1};}}),releaseConnection:async()=>released.push(1)};
        const result=await q.executeBatch('SELECT ?',[[1],[2]]);expect(result).to.include({success:false,successCount:1,failureCount:1});expect(result.results[1].success).to.equal(false);expect(released).to.have.length(2);
        await q.destroy();
    });
    it('validates every batch value, including later rows',async()=>{
        const q=query();const result=await q.executeBatch('SELECT ?', [['valid'],['x'.repeat(10001)]]);
        expect(result).to.include({success:false,successCount:1,failureCount:1});await q.destroy();
    });
    it('enforces statement cache capacity even for entries created in the same millisecond',async()=>{
        sinon.useFakeTimers();const q=query();q.config.maxCachedStatements=1;
        await q.execute('SELECT 1');await q.execute('SELECT 2');
        expect(q.getCachedStatements()).to.have.length(1);expect(q.getCachedStatements()[0].sql).to.equal('SELECT 2');
        await q.destroy();
    });
    it('checks custom parameter validators and nullable statement constraints',()=>{
        const q=query();
        expect(()=>q.validateParameterValues(['x'.repeat(10001)],{})).to.throw('too long');
        expect(()=>q.validateParameterValues([Buffer.alloc(65537)],{})).to.throw('too large');
        expect(()=>q.validateParameterValues([1],{parameterValidation:{0:()=>false}})).to.throw('Custom validation');
        expect(()=>q.validateParameterValues([1],{parameterValidation:{1:()=>false}})).not.to.throw();
        expect(()=>q.validateParametersAgainstStatement({parameterCount:1,parameters:[{nullable:false,type:ParameterType.STRING}]},[null])).to.throw('cannot be null');
        expect(()=>q.validateParametersAgainstStatement({parameterCount:1,parameters:[{nullable:true,type:ParameterType.NULL}]},[1])).not.to.throw();
        expect(()=>q.validateParametersAgainstStatement({parameterCount:2,parameters:[]},[1])).to.throw('mismatch');
    });
    it('releases JDBC sessions on failure and reports missing dependencies',async()=>{
        const q=query();q.connectionManager=null;
        await rejected(()=>q.execute('SELECT 1'));
        q.prepareStatement=async()=>{throw 'offline';};await rejected(()=>q.execute('SELECT 1'));await rejected(()=>q.executeBatch('SELECT ?',[[1]]));
        await q.destroy();
    });
    it('rejects every negative validator decision, including critical and empty errors',async()=>{
        const q=query();
        for(const errors of [[],[{severity:'critical',message:'unsafe'}],[{severity:'error',message:'invalid'}]]){
            q.queryValidator={isInitialized:true,validateQuery:async()=>({isValid:false,errors})};
            await rejected(()=>q.execute('SELECT 1'));
        }
        q.queryValidator.validateQuery=async()=>{throw 'offline';};await rejected(()=>q.execute('SELECT 1'));await q.destroy();
    });
    it('integrates optional modules and classifies supported parameter types',async()=>{
        const q=query();
        for(const isInitialized of [false,true]){q.manager={getModule:()=>({isInitialized})};q.setupModuleIntegrations();expect(q.getPerformanceMonitor().isInitialized).to.equal(isInitialized);expect(q.getCacheManager().isInitialized).to.equal(isInitialized);}
        for(const [value,type] of [[null,ParameterType.NULL],[undefined,ParameterType.NULL],[1,ParameterType.INTEGER],[1.5,ParameterType.FLOAT],[true,ParameterType.BOOLEAN],[new Date(),ParameterType.DATETIME],[Buffer.from('x'),ParameterType.BINARY],[[],ParameterType.ARRAY],[{},ParameterType.JSON],[Symbol('x'),ParameterType.STRING]])expect(q.detectParameterType(value)).to.equal(type);
        expect(()=>q.validateParametersAgainstStatement({parameterCount:1,parameters:[{nullable:true,type:ParameterType.STRING}]},[1])).not.to.throw();
        await q.destroy();
    });
    it('bounds execution history and computes cache ratios and statement expiry',async()=>{
        const q=query();expect(q.getStatistics().avgExecutionTime).to.equal(0);
        for(let i=0;i<1002;i++)q.updateExecutionStatistics('SELECT 1',i);
        expect(q.statistics.queryExecutionTimes).to.have.length(1000);
        q.statistics.resultCacheHits=3;q.statistics.resultCacheMisses=1;q.statistics.statementCacheHits=1;q.statistics.statementCacheMisses=1;
        expect(q.getStatistics()).to.include({resultCacheHitRatio:0.75,statementCacheHitRatio:0.5});
        q.config.statementCacheTtl=0;expect(q.isStatementValid({lastUsed:new Date(0)})).to.equal(true);
        await q.destroy();
    });

    it('normalizes native errors and batch preparation errors',async()=>{
        const q=query();q.connectionManager.getConnection=async()=>({execute:async()=>{throw Error('JDBC failed');}});
        expect((await rejected(()=>q.execute('SELECT 1'))).message).to.include('JDBC failed');
        q.executeStatement=async()=>{throw 'statement failure';};expect((await q.executeBatch('SELECT ?',[[1]])).failureCount).to.equal(1);
        q.prepareStatement=async()=>{throw Error('prepare failure');};expect((await rejected(()=>q.executeBatch('SELECT ?',[[1]]))).message).to.equal('prepare failure');await q.destroy();
    });

    it('reads a generated identity on the insertion session before releasing it',async()=>{
        const q=query();const calls:string[]=[];let acquisitions=0;
        q.connectionManager={getConnection:async()=>{acquisitions++;return {execute:async(sql:string)=>{calls.push(sql);return sql.startsWith('INSERT')?{rows:[],columns:[],rowsAffected:1}:{rows:[[0]],columns:[]};}};},releaseConnection:async()=>calls.push('release')};
        const result=await q.execute('INSERT INTO T(X) VALUES(?)',[1],{returnGeneratedIdentity:true});
        expect(result.generatedIdentity).to.equal(0);expect(acquisitions).to.equal(1);expect(calls).to.have.length(3);expect(calls[1]).to.include('IDENTITY()');expect(calls[2]).to.equal('release');await q.destroy();
    });
    it('rejects missing generated identity and releases the insertion session',async()=>{
        for(const rows of [[],[[]],[[null]]]){
            const q=query();let released=false;q.connectionManager={getConnection:async()=>({execute:async()=>({rows,columns:[],rowsAffected:1})}),releaseConnection:async()=>{released=true;}};
            await rejected(()=>q.execute('INSERT INTO T DEFAULT VALUES',[],{returnGeneratedIdentity:true}));expect(released).to.equal(true);await q.destroy();
        }
    });

});
