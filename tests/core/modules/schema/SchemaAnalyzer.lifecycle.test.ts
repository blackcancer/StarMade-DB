import {expect} from 'chai';
import {describe,it,afterEach} from 'mocha';
import sinon from 'sinon';
import {SchemaAnalyzer} from '../../../../src/core/modules/schema/SchemaAnalyzer.js';
const table=()=>({name:'T',columns:[],indexes:[],constraints:[],foreignKeys:[],referencingKeys:[],statistics:{rowCount:0,healthScore:0,dataQualityScore:0,averageRowSize:0}});
function analyzer(){const a:any=new SchemaAnalyzer();a._initialized=true;a.config={maxSampleSize:10};a.logger=new Proxy({}, {get:()=>()=>{}});a.connectionManager={getConnection:async()=>({}),releaseConnection:async()=>{}};a.getDatabaseInfo=async()=>({name:'test',version:'1'});a.getAllTables=async()=>['T'];a.analyzeTableInternal=async()=>table();return a;}
async function fails(fn:()=>Promise<any>,expected:unknown){let error;try{await fn();}catch(e){error=e;}expect(error).to.equal(expected);}
describe('Schema analysis lifecycle boundaries',()=>{
    afterEach(()=>sinon.restore());
    it('uses internal caches for repeated table and schema analysis and clears matching keys',async()=>{
        const a=analyzer();const t=await a.analyzeTable('T');expect(await a.analyzeTable('T')).to.equal(t);
        const s=await a.analyzeSchema();expect(await a.analyzeSchema()).to.equal(s);
        await a.clearCache('T');expect(a.tableCache.size).to.equal(0);expect(a.schemaCache.size).to.equal(1);
        await a.clearCache('schema');expect(a.schemaCache.size).to.equal(0);await a.destroy();
    });
    it('continues analysis when an external cache fails to read or store results',async()=>{
        for(const failure of [Error('cache unavailable'),'cache unavailable']){
            const a=analyzer();a.cacheManager={get:async()=>{throw failure;},set:async()=>{throw failure;},keys:async()=>{throw failure;},clear:async()=>{throw failure;}};
            expect((await a.analyzeTable('T')).name).to.equal('T');expect((await a.analyzeSchema()).tables).to.have.length(1);
            await a.clearCache();await a.destroy();
        }
    });
    it('records failed analysis and releases acquired sessions',async()=>{
        for(const failure of [Error('metadata unavailable'),'metadata unavailable']){
            const a=analyzer();const misses:any[]=[];let released=0;a.cacheStatsCollector={recordAccess:(...args:any[])=>misses.push(args)};
            a.connectionManager.releaseConnection=async()=>released++;
            a.analyzeTableInternal=async()=>{throw failure;};await fails(()=>a.analyzeTable('T'),failure);
            expect((await a.analyzeSchema()).tables).to.deep.equal([]);
            expect(await a.getOptimizationRecommendations(['T'])).to.deep.equal([]);
            await a.clearCache();a.getAllTables=async()=>{throw failure;};await fails(()=>a.analyzeSchema(),failure);await fails(()=>a.getOptimizationRecommendations(),failure);
            expect(released).to.equal(5);expect(misses).to.have.length(2);await a.destroy();
        }
    });
    it('sorts recommendations by priority then expected impact',async()=>{
        const a=analyzer();a.generateTableRecommendations=()=>[{priority:'LOW',performanceImpact:100},{priority:'HIGH',performanceImpact:1},{priority:'HIGH',performanceImpact:10},{priority:'CRITICAL',performanceImpact:0}];
        expect((await a.getOptimizationRecommendations()).map((r:any)=>r.performanceImpact)).to.deep.equal([0,10,1,100]);await a.destroy();
    });
    it('reports failures before acquiring a session and missing configuration',async()=>{
        const a:any=new SchemaAnalyzer();expect(a.getConfiguration()).to.equal(undefined);
        let error;try{await a.initialize({getConfiguration:()=>({}),getModule:()=>({isInitialized:false})});}catch(e){error=e;}expect(error).to.be.instanceOf(Error);
        for(const failure of [Error('offline'),'offline']){const ready=analyzer();ready.connectionManager.getConnection=async()=>{throw failure;};await fails(()=>ready.analyzeSchema(),failure);await ready.destroy();}
    });
    it('records advanced cache hits and misses for schema and table entries',async()=>{
        const a=analyzer();const cache=new Map();const accesses:any[]=[];
        a.cacheManager={get:async(key:string)=>cache.get(key),set:async(key:string,value:any)=>cache.set(key,value),clear:async()=>cache.clear()};
        a.cacheStatsCollector={recordAccess:(...args:any[])=>accesses.push(args)};
        await a.analyzeSchema();await a.analyzeSchema();await a.analyzeTable('T');await a.analyzeTable('T');
        expect(accesses.map(a=>a[1])).to.deep.equal([false,true,false,true]);
        a.cacheStatsCollector=undefined;expect((await a.analyzeTable('T')).name).to.equal('T');await a.destroy();
    });

    it('initializes optional cache analytics and rejects a missing pool',async()=>{
        const a:any=new SchemaAnalyzer();let error;
        try{await a.initialize({getConfiguration:()=>({}),getModule:()=>undefined});}catch(e){error=e;}expect(error).to.be.instanceOf(Error);
        const ready:any=new SchemaAnalyzer();await ready.initialize({getConfiguration:()=>({}),getModule:()=>({isInitialized:true,clear:async()=>{}})});
        expect(ready.isInitialized).to.equal(true);await ready.destroy();
    });

    it('limits external invalidation to matching schema entries',async()=>{
        const a=analyzer();const cache=new Map([['schema:table:T:1',1],['schema:table:U:1',2],['query:1',3]]);
        a.cacheManager={keys:async()=>[...cache.keys()].filter(key=>key.startsWith('schema:')),delete:async(key:string)=>cache.delete(key),clear:async()=>cache.clear()};
        await a.clearCache('T');expect([...cache.keys()]).to.deep.equal(['schema:table:U:1','query:1']);
        await a.clearCache();expect([...cache.keys()]).to.deep.equal(['query:1']);await a.destroy();
    });
    it('refreshes expired internal table and schema statistics',async()=>{
        const clock=sinon.useFakeTimers();const a=analyzer();a.config.enableStatistics=true;
        const table=await a.analyzeTable('T');const schema=await a.analyzeSchema();
        await clock.tickAsync(900001);
        expect(await a.analyzeTable('T')).not.to.equal(table);expect(await a.analyzeSchema()).not.to.equal(schema);await a.destroy();
    });

});
