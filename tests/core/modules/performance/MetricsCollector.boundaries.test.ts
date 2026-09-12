import {expect} from 'chai';
import {rejects} from 'node:assert/strict';
import sinon from 'sinon';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {MetricsCollector} from '../../../../src/core/modules/performance/MetricsCollector.js';
import {MetricType} from '../../../../src/core/modules/performance/PerformanceMonitor.js';

async function collector(){
    const c:any=new MetricsCollector(); c.logger={debug:sinon.spy(),info:sinon.spy(),warn:sinon.spy(),error:sinon.spy()};
    await c.initialize({getConfiguration:()=>({}),getModule:()=>undefined} as any); c.config.enabled=true;
    return c;
}
const metric=(value=10)=>({type:MetricType.QUERY_TIME,value,source:'query',unit:'ms',timestamp:new Date(),tags:['table:players']});
const series=()=>[{type:MetricType.QUERY_TIME,metadata:{source:'query',unit:'ms'},points:[{timestamp:new Date(0),value:10,tags:{table:'players'}},{timestamp:new Date(1),value:20}]}];

describe('Metrics collector aggregation and export boundaries',()=>{
    afterEach(()=>sinon.restore());
    it('writes real JSON, CSV and Prometheus files and supports console output',async()=>{
        const c=await collector(); const directory=await mkdtemp(join(tmpdir(),'starmade-metrics-'));
        try {
            const logged=sinon.stub(console,'log');
            for(const [format,method] of [['json','exportAsJson'],['csv','exportAsCsv'],['prometheus','exportAsPrometheus']] as const){
                c.config.export.destination={type:'file',path:join(directory,format)};
                await c[method](series()); const output=await readFile(join(directory,format),'utf8');
                expect(output).to.include(format==='json'?'"metrics"':format==='csv'?'timestamp,metric_type':'# TYPE');
                c.config.export.destination={type:'console'}; await c[method](series()); if(format==='json') expect(JSON.parse(logged.lastCall.args[0]).metrics).to.deep.equal(JSON.parse(output).metrics); else expect(logged.lastCall.args[0]).to.equal(output);
            }
            c.config.export.destination={type:'http',url:'https://example.invalid/metrics'}; await rejects(c.writeExport('data'),/HTTP metrics export is not supported/);
            c.config.export.destination={type:'file'}; await rejects(c.writeExport('data'),/path is required/);
            c.config=undefined; await rejects(c.writeExport('data'),/path is required/);
        } finally {await c.destroy(); await rm(directory,{recursive:true,force:true});}
    });
    it('dispatches export formats, records export failures and stops scheduled work on destruction',async()=>{
        const clock=sinon.useFakeTimers(); const c=await collector();
        const get=sinon.stub(c,'getTimeSeries').resolves(series());
        const json=sinon.stub(c,'exportAsJson').resolves(); const csv=sinon.stub(c,'exportAsCsv').resolves(); const prom=sinon.stub(c,'exportAsPrometheus').resolves();
        for(const format of ['json','csv','prometheus','unknown']){c.config.export.format=format; await c.exportData();}
        expect([json.callCount,csv.callCount,prom.callCount]).to.deep.equal([1,1,1]);
        for(const failure of [new Error('failed'),'failed']){get.callsFake(async()=>{throw failure;}); await c.exportData();}
        expect(c.logger.error.callCount).to.equal(2); get.resolves([]);
        c.startDataExport(); expect(c.exportTimer).to.equal(undefined);
        c.config.export.enabled=true; c.config.export.intervalMs=10; c.startDataExport(); await clock.tickAsync(10); expect(get.callCount).to.equal(7);
        await c.destroy(); await clock.tickAsync(100); expect(get.callCount).to.equal(7);
        await c.exportData(); expect(get.callCount).to.equal(7);
        c.destroyed=false; c.config=undefined; await c.exportData(); c.startDataExport(); expect(get.callCount).to.equal(7);
    });
    it('filters source and tags, evicts expired buckets, and preserves recent aggregates',async()=>{
        const c=await collector(); const now=new Date();
        c.collectMetrics([metric(10),metric(30),{...metric(99),source:'other'},{...metric(77),tags:undefined},{...metric(88),tags:['table:fleets']}]); c.flushBuffer();
        const selected=await c.getTimeSeries({types:[MetricType.QUERY_TIME],sources:['query'],tags:{table:'players'}});
        expect(selected[0].points[0].value).to.equal(20);
        expect(await c.getTimeSeries({aggregationInterval:'unknown'})).to.deep.equal([]);
        expect(c.matchesTags(metric(),{table:'players'})).to.equal(true);
        expect(c.getBucketKey('unknown',now)).to.equal(now.toISOString());
        expect(c.getBucketTimeRange('unknown',now)).to.deep.equal({start:now,end:now,intervalMs:0});
        expect(c.calculateBucketStatistics([],MetricType.QUERY_TIME)).to.include({count:0,average:0});
        for(const buckets of c.buckets.values()) buckets.set('expired',{endTime:new Date(0)});
        c.cleanupOldData(); for(const buckets of c.buckets.values()) expect(buckets.has('expired')).to.equal(false);
        c.cleanupOldData(); expect(c.getMemoryUsage().totalBuckets).to.equal(3);
        c.addToBucket('unknown',metric(),'anything'); expect(c.getMemoryUsage().totalBuckets).to.equal(3);
        c.config.aggregation.intervals={minute:false,hour:false,day:false}; c.addMetricToBuckets(metric()); expect(c.getMemoryUsage().totalBuckets).to.equal(3);
        c.startCleanupProcess(); await c.destroy(); c.cleanupOldData();
    });
    it('handles missing configuration and integration events without a metric',async()=>{
        const c:any=new MetricsCollector(); c.logger={debug:sinon.spy(),info:sinon.spy(),warn:sinon.spy(),error:sinon.spy()};
        c.setupPerformanceMonitorIntegration(); expect(c.hasPerformanceMonitorIntegration()).to.equal(false);
        expect(()=>c.buildConfiguration()).to.throw('Manager not set'); c.startBufferFlushing(); c.cleanupOldData();
        expect(c.getMemoryUsage()).to.include({maxUsageMB:0,utilizationPercentage:0});
        await rejects(c.initialize(null));
        let listener:any; const monitor={isInitialized:true,on:(_event:any,fn:any)=>{listener=fn;}};
        await c.initialize({getConfiguration:()=>({modules:{enableMetricsCollection:true}}),getModule:()=>monitor});
        listener('event',{}); listener('event',{metric:metric()}); expect(c.metricsBuffer).to.have.length(1);
        expect(c.eventNames()).to.deep.equal([]); await c.destroy(); await c.destroy();
    });
});


describe('Metrics export text encoding',()=>{
    afterEach(()=>sinon.restore());
    it('escapes delimiter characters in CSV fields and quoted Prometheus labels',async()=>{
        const c=await collector(); c.config.export.destination={type:'console'}; const logged=sinon.stub(console,'log');
        const data=series(); data[0].metadata.source='query,"name"';
        await c.exportAsCsv(data); expect(logged.lastCall.args[0]).to.include('"query,""name"""');
        data[0].points[0].tags={table:'a"b\\c\nd'};
        await c.exportAsPrometheus(data); expect(logged.lastCall.args[0]).to.include('table="a\\"b\\\\c\\nd"');
        await c.destroy();
    });
});

describe('Metrics initialization configuration branches',()=>{
    afterEach(()=>sinon.restore());
    it('starts exports for an enabled export configuration and reports throughput units',async()=>{
        const clock=sinon.useFakeTimers(); const c:any=new MetricsCollector(); c.logger={debug:sinon.spy(),info:sinon.spy(),warn:sinon.spy(),error:sinon.spy()};
        expect(c.getConfiguration()).to.equal(undefined);
        const build=c.buildConfiguration.bind(c);
        sinon.stub(c,'buildConfiguration').callsFake(()=>{build();c.config.export.enabled=true;c.config.export.intervalMs=10;c.config.export.destination={type:'console'};});
        const logged=sinon.stub(console,'log');
        await c.initialize({getConfiguration:()=>({modules:{enableMetricsCollection:true}}),getModule:()=>({isInitialized:false})});
        await clock.tickAsync(10); expect(JSON.parse(logged.lastCall.args[0]).metrics).to.deep.equal([]);
        expect(c.getMetricUnit(MetricType.THROUGHPUT)).to.equal('ops/sec'); expect(c.getMetricUnit('unknown')).to.equal('unit');
        expect(c.getMetricUnit(MetricType.OPERATIONS_PER_SECOND)).to.equal('ops/sec');
        await c.destroy();
    });
});

describe('Metrics retention schedule',()=>{
    afterEach(()=>sinon.restore());
    it('removes expired buckets at the hourly cleanup tick',async()=>{
        const clock=sinon.useFakeTimers();const c=await collector();
        c.buckets.get('minute').set('old',{endTime:new Date(-172800000)});c.startCleanupProcess();await clock.tickAsync(3600000);
        expect(c.buckets.get('minute').has('old')).to.equal(false);await c.destroy();
    });
});
