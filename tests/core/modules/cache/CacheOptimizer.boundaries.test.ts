import {rejects} from 'node:assert/strict';
import {expect} from 'chai';
import sinon from 'sinon';
import {CacheOptimizer} from '../../../../src/core/modules/cache/CacheOptimizer.js';

const silent=()=>({debug:sinon.spy(),info:sinon.spy(),warn:sinon.spy(),error:sinon.spy()});
async function optimizer() {
    const c:any=new CacheOptimizer(); c.logger=silent();
    await c.initialize({getConfiguration:()=>({})} as any);
    return c;
}
const pattern=(key:string,confidence=.9)=>({key,frequency:5,averageInterval:1000,predictionConfidence:confidence,predictedNextAccess:new Date(Date.now()+60000)});
const stats=(ratio=.5,bytes=90)=>({hitRatio:ratio,totalEntries:10,totalSizeBytes:bytes,evictionCount:3,expirationCount:1});
const recommendation=(type:string,parameters={})=>({type,parameters,title:'test',confidence:.9,expectedImprovement:15,autoApplicable:true});

describe('Cache optimizer decision boundaries',()=>{
    afterEach(()=>sinon.restore());
    it('selects strategies according to reuse and generates ranked recommendations',async()=>{
        const c=await optimizer();
        expect(c.findBestEvictionStrategy().type).to.equal('adaptive');
        for(const [keys,strategy] of [[['a','a','b','b','a'],'arc'],[Array(10).fill('a'),'lru']] as const){
            c.accessHistory=keys.map(key=>({key})); expect(c.findBestEvictionStrategy().type).to.equal(strategy);
        }
        c.cacheManager={getStats:()=>stats(),getConfiguration:()=>({maxSizeBytes:100})};
        c.accessPatterns.set('a',pattern('a')); c.accessPatterns.set('b',pattern('b',.7));
        const recommendations=await c.analyzeAndOptimize();
        expect(recommendations.map((r:any)=>r.type)).to.include.members(['ttl-adjustment','eviction-tuning','prefetch-suggestion','size-optimization']);
        expect(recommendations.filter((r:any)=>r.type==='ttl-adjustment').map((r:any)=>r.priority)).to.deep.equal(['high','medium']);
        expect((await c.generateEvictionOptimizations({hitRatioEfficiency:20}))[0].priority).to.equal('high');
        expect((await c.generateMemoryOptimizations(stats(.5,99)))[0].priority).to.equal('critical');
        expect((await c.generateMemoryOptimizations(stats(.5,10)))).to.deep.equal([]);
        c.cacheManager.getConfiguration=()=>undefined; expect(await c.generateMemoryOptimizations(stats())).to.deep.equal([]);
        c.accessPatterns.set('old',{...pattern('old'),predictedNextAccess:new Date(0)});
        c.accessPatterns.set('unknown',{...pattern('unknown'),predictedNextAccess:undefined});
        expect(c.identifyPrefetchCandidates().map((p:any)=>p.key)).to.deep.equal(['a','b']);
        c.config.enableDynamicTtl=false; c.config.enableIntelligentEviction=false; c.config.enablePredictivePrefetching=false;
        expect(await c.generateTtlOptimizations()).to.deep.equal([]);
        expect(await c.generateEvictionOptimizations({hitRatioEfficiency:0})).to.deep.equal([]);
        expect(await c.generatePrefetchingRecommendations()).to.deep.equal([]);
        expect(c.eventNames()).to.deep.equal([]); await c.destroy();
    });
    it('keeps recommendations advisory without claiming or recording an application',async()=>{
        const c=await optimizer(); c.cacheManager={getStats:()=>stats(),getConfiguration:()=>({maxSizeBytes:100})};
        for(const type of ['eviction-tuning','size-optimization','ttl-adjustment','unknown']) {
            expect(await c.applyRecommendation(recommendation(type,{recommendedStrategy:'arc'}))).to.equal(false);
        }
        expect([...c.evictionStrategies.values()].filter((strategy:any)=>strategy.enabled).map((strategy:any)=>strategy.type)).to.deep.equal(['lru']);
        expect((await c.getOptimizationInsights()).recentOptimizations).to.deep.equal([]);
        expect(c.logger.warn.callCount).to.equal(4); await c.destroy();
    });
    it('periodically analyzes recommendations without claiming automatic application and tolerates failures',async()=>{
        const c=await optimizer();
        const candidates=[recommendation('ttl-adjustment'),{...recommendation('ttl-adjustment'),confidence:.1},{...recommendation('ttl-adjustment'),autoApplicable:false}];
        const analysis=sinon.stub(c,'analyzeAndOptimize').resolves(candidates);
        const apply=sinon.stub(c,'applyRecommendation').resolves(true);
        await c.performAutomaticOptimization(); expect(apply.callCount).to.equal(0);
        analysis.resolves([]); await c.performAutomaticOptimization(); expect(apply.callCount).to.equal(0);
        for(const failure of [new Error('failed'),'failed']){analysis.callsFake(async()=>{throw failure;}); await c.performAutomaticOptimization();}
        expect(c.logger.warn.callCount).to.equal(2); await c.destroy();
    });
    it('handles lifecycle guards and unavailable cache statistics',async()=>{
        const c:any=new CacheOptimizer(); c.logger=silent();
        expect(()=>c.buildConfiguration()).to.throw('Manager not set');
        expect(c.getConfiguration()).to.equal(undefined); c.recordAccess('ignored',true); expect(c.accessHistory).to.deep.equal([]);
        await rejects(c.analyzeAndOptimize()); await rejects(c.applyRecommendation(recommendation('ttl-adjustment'))); await rejects(c.getOptimizationInsights());
        expect(()=>c.setCacheManager(null)).to.throw();
        await rejects(c.initialize(null));
        await c.initialize({getConfiguration:()=>({})});
        await rejects(c.initialize({}));
        expect(()=>c.setCacheManager(null)).to.throw(); expect(()=>c.setCacheManager({isInitialized:false})).to.throw();
        await rejects(c.analyzeAndOptimize()); await rejects(c.getOptimizationInsights());
        await c.establishPerformanceBaselines();
        c.cacheManager={getStats:()=>stats(.8,100)}; await c.establishPerformanceBaselines(); expect(c.performanceBaselines.memoryEfficiency).to.equal(100);
        c.cacheManager={getStats:()=>stats(.8,0)}; await c.establishPerformanceBaselines(); expect(c.performanceBaselines.memoryEfficiency).to.equal(0);
        expect(c.calculatePatternAlignment()).to.equal(50);
        for(const failure of [new Error('stats'),'stats']){
            c.cacheManager={getStats:()=>{throw failure;}};
            await c.establishPerformanceBaselines(); await rejects(c.analyzeAndOptimize());
        }
        c.performanceBaselines.hitRatio=.5;
        expect(c.calculateTrend('hitRatio',.6)).to.equal('improving'); expect(c.calculateTrend('hitRatio',.4)).to.equal('degrading');
        c.performanceBaselines.memoryUsage=10; expect(c.calculateTrend('memoryUsage',20)).to.equal('stable');
        await c.destroy(); await c.destroy();
    });
});


describe('Cache optimization scheduling',()=>{
    afterEach(()=>sinon.restore());
    it('replaces timers and logs rejected scheduled optimizations',async()=>{
        const clock=sinon.useFakeTimers(); const c=await optimizer(); c.config.optimizationInterval=10;
        const optimize=sinon.stub(c,'performAutomaticOptimization').rejects(new Error('cycle'));
        c.startOptimizationTimer(); c.startOptimizationTimer(); await clock.tickAsync(10);
        optimize.callsFake(async()=>{throw 'cycle';}); await clock.tickAsync(10);
        expect(optimize.callCount).to.equal(2); expect(c.logger.warn.callCount).to.equal(2);
        await c.destroy(); await clock.tickAsync(10); expect(optimize.callCount).to.equal(2);
    });
});

describe('Cache optimizer dependency attachment errors',()=>{
    afterEach(()=>sinon.restore());
    it('keeps cache attachment usable if baseline establishment rejects unexpectedly',async()=>{
        const c=await optimizer();const baseline=sinon.stub(c,'establishPerformanceBaselines');
        for(const failure of [new Error('baseline'),'baseline']){
            baseline.callsFake(async()=>{throw failure;});c.setCacheManager({isInitialized:true});await Promise.resolve();
        }
        expect(c.logger.warn.callCount).to.equal(2);expect(c.cacheManager.isInitialized).to.equal(true);await c.destroy();
    });
});
