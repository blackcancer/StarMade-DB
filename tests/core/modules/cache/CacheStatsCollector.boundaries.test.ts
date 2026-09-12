import {rejects} from 'node:assert/strict';
import {expect} from 'chai';
import {describe,it,afterEach} from 'mocha';
import sinon from 'sinon';
import {CacheStatsCollector} from '../../../../src/core/modules/cache/CacheStatsCollector.js';

function collector() {
    const c: any=new CacheStatsCollector();
    c._initialized=true;
    c.logger=new Proxy({}, {get:()=>()=>{}});
    c.config={enableKeyTracking:true,maxTrackedKeys:2,efficiencyThreshold:.7,memoryThreshold:.8,dataRetentionMs:10000,collectionInterval:100};
    return c;
}
const metric=(ratio:number, memory:number, throughput:number)=>({timestamp:new Date(),hitRatio:ratio,entryCount:10,memoryUsageBytes:memory,
    memoryUtilization:memory/1000,evictionRate:2,expirationRate:3,averageResponseTime:4,throughput,errorRate:0});

describe('Cache statistics boundaries',()=>{
    afterEach(()=>sinon.restore());
    it('reports exact averages, extrema, top keys and time trends',async()=>{
        const c=collector();
        c.metricsHistory=[metric(.5,100,10),metric(.9,300,30),metric(.7,200,20)];
        c.recordAccess('small',true,10,1); c.recordAccess('large',false,100,2); c.recordAccess('large',true,100,2);
        c.keyStats.get('small').accessFrequency=100; c.keyStats.get('large').accessFrequency=300;
        const report=await c.generateReport();
        expect(report.summary).to.include({totalOperations:60,peakMemoryUsage:300});
        expect(report.summary.averageHitRatio).to.be.closeTo(.7,1e-12);
        expect(report.peakMetrics.throughput).to.equal(30); expect(report.minMetrics.hitRatio).to.equal(.5);
        expect(report.avgMetrics.memoryUsageBytes).to.equal(200);
        expect(report.mostAccessedKeys[0].key).to.equal('large'); expect(report.largestKeys[0].key).to.equal('large');
        expect(report.trends.map((t:any)=>t.trend)).to.deep.equal(['improving','degrading','improving']);
        expect(report.insights.join(' ')).to.include('improving');
        expect(c.eventNames()).to.deep.equal([]);
        await c.destroy();
    });
    it('handles one sample, worsening, stable and reversed trends',async()=>{
        const c=collector();
        for(const [a,b,expected] of [[10,10,'stable'],[10,11,'improving'],[10,9,'degrading']] as const){
            expect(c.getTrend(a,b)).to.equal(expected);
            expect(c.getTrend(a,b,true)).to.equal(expected==='stable'?'stable':expected==='improving'?'degrading':'improving');
        }
        c.metricsHistory=[metric(.9,100,10)];
        let report=await c.generateReport('last_hour'); expect(report.trends).to.deep.equal([]); expect(report.insights[0]).to.include('performing well');
        c.metricsHistory=[metric(.4,100,10),metric(.2,50,5)];
        report=await c.generateReport('last_7d'); expect(report.insights.join(' ')).to.include('declining');
        expect(report.trends.map((t:any)=>t.trend)).to.deep.equal(['degrading','improving','degrading']);
        expect(c.generateInsights({averageHitRatio:.7},[{metric:'Hit Ratio',trend:'stable'}],[])).to.deep.equal([]);
        expect(c.getPeriodMs('unknown')).to.equal(86400000);
        await c.destroy();
    });
    it('creates, deduplicates and clears warning and critical alerts',async()=>{
        const c=collector();
        for(const [ratio,memory,severity] of [[.6,.9,'warning'],[.2,.99,'critical']] as const){
            c.checkAlerts({...metric(ratio,0,0),memoryUtilization:memory},{});
            expect([...c.activeAlerts.values()].map((a:any)=>a.severity)).to.deep.equal([severity,severity]);
            const original=[...c.activeAlerts.values()]; c.checkAlerts({...metric(ratio,0,0),memoryUtilization:memory},{});
            expect([...c.activeAlerts.values()]).to.deep.equal(original);
            c.checkAlerts({...metric(.9,0,0),memoryUtilization:.2},{}); expect(c.activeAlerts.size).to.equal(0);
        }
        await c.destroy();
    });
    it('evicts least accessed statistics and escapes literal glob characters',async()=>{
        const c=collector();
        c.evictLeastAccessedKey();
        c.recordAccess('hot.[x]',true,5); c.recordAccess('hot.[x]',true,5);
        c.recordAccess('cold',false,10); c.recordAccess('new',true,15);
        expect(c.getKeyStatistics().map((k:any)=>k.key)).to.deep.equal(['hot.[x]','new']);
        expect(c.getKeyStatistics('hot.[*').map((k:any)=>k.key)).to.deep.equal(['hot.[x]']);
        c.metricsHistory=[{...metric(.5,1,1),timestamp:new Date(Date.now()-20000)},metric(.9,2,2)];
        c.cleanupOldMetrics(); expect(c.metricsHistory).to.have.length(1);
        await c.destroy();
    });
    it('collects measurements and tolerates an unavailable metrics exporter',async()=>{
        const c=collector();
        await c.performCollection(); expect(c.metricsHistory).to.deep.equal([]);
        c.lastCollection=Date.now()-1000;
        c.cacheManager={getStats:()=>({hitRatio:.8,totalEntries:2,totalSizeBytes:100,evictionCount:1,expirationCount:2,hitCount:8,missCount:2})};
        const exported:any[]=[]; c.metricsCollector={collectMetric:(m:any)=>exported.push(m)};
        await c.performCollection(); expect(exported.map(m=>m.value)).to.deep.equal([.8,100]);
        expect(c.metricsHistory[0]).to.include({entryCount:2,memoryUsageBytes:100});
        c.metricsCollector={collectMetric:()=>{throw new Error('unavailable');}};
        await c.performCollection(); expect(c.metricsHistory).to.have.length(2);
        c.metricsCollector={collectMetric:()=>{throw 'unavailable';}}; await c.performCollection(); expect(c.metricsHistory).to.have.length(3);
        c.metricsCollector=undefined; await c.performCollection(); expect(c.metricsHistory).to.have.length(4);
        await c.destroy();
    });
});

describe('Cache statistics distributions and trends',()=>{
    it('classifies severe hotspots, cold values, outlier sizes and opposing trends',async()=>{
        const c=collector();
        for(let i=0;i<20;i++) c.keyStats.set(`key-${i}`,{key:`key-${i}`,accessFrequency:i<11?200:.5,totalAccesses:20,currentSizeBytes:i===0?10000:1});
        const patterns=c.detectUsagePatterns();
        expect(patterns.map((p:any)=>p.type)).to.include.members(['hotspot','cold_data','size_outlier']);
        expect(patterns.find((p:any)=>p.type==='hotspot').severity).to.equal('high');
        for(const [first,last,expected] of [[.2,.8,'improving'],[.8,.2,'degrading'],[.8,.8,'stable']] as const){
            c.metricsHistory=[...Array.from({length:5},()=>metric(first,first*100,first*100)),...Array.from({length:5},()=>metric(last,last*100,last*100))];
            const analysis=c.analyzeEfficiency({hitRatio:.2,totalSizeBytes:100*1024*1024,evictionCount:101},1000);
            expect(analysis.trend).to.equal(expected); expect(analysis.issues).to.have.length(3);
            const trends=c.analyzeTrends(1000); expect(trends.hitRatio).to.equal(expected); expect(trends.throughput).to.equal(expected);
            expect(trends.memoryUsage).to.equal(expected==='improving'?'increasing':expected==='degrading'?'decreasing':'stable');
        }
        await c.destroy();
    });
});


describe('Cache statistics lifecycle failure boundaries',()=>{
    afterEach(()=>sinon.restore());
    it('rejects use before initialization and missing cache dependencies',async()=>{
        const c:any=new CacheStatsCollector(); c.logger=new Proxy({}, {get:()=>()=>{}});
        expect(c.getConfiguration()).to.equal(undefined); c.discoverRelatedModules(); expect(()=>c.buildConfiguration()).to.throw('Manager not set');
        c.recordAccess('ignored',true); expect(c.getKeyStatistics()).to.deep.equal([]);
        await rejects(c.initialize(null));
        for(const method of ['startCollection','getCacheAnalytics','generateReport']) await rejects(c[method]());
        await c.initialize({getConfiguration:()=>({}),getModule:()=>undefined,registerModule:()=>{}});
        await rejects(c.initialize({})); await rejects(c.startCollection()); await rejects(c.getCacheAnalytics());
        await c.destroy(); await c.destroy();
        const broken:any=new CacheStatsCollector(); broken.logger=c.logger;
        await rejects(broken.initialize({getConfiguration:()=>({}),getModule:()=>undefined,registerModule:()=>{throw new Error('registration');}}),/registration/);
        await broken.destroy();
    });
    it('replaces collection timers and records rejected callbacks',async()=>{
        const clock=sinon.useFakeTimers(); const c=collector(); const failures:any[]=[];
        c.logger={debug:()=>{},info:()=>{},warn:()=>{},error:(...args:any[])=>failures.push(args)};
        c.cacheManager={getStats:()=>({})}; const collect=sinon.stub(c,'performCollection').rejects(new Error('collect'));
        await c.startCollection(); c.startCollectionTimer(); await clock.tickAsync(100);
        collect.callsFake(async()=>{throw 'collect';}); await clock.tickAsync(100); expect(failures).to.have.length(2);
        await c.stopCollection(); await clock.tickAsync(100); expect(collect.callCount).to.equal(2); await c.destroy();
    });
});
