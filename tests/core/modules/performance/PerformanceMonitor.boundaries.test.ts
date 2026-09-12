import {expect} from 'chai';
import sinon from 'sinon';
import {PerformanceMonitor,MetricType} from '../../../../src/core/modules/performance/PerformanceMonitor.js';
import {PerformanceEvent} from '../../../../src/core/events.js';
async function monitor(){
    const m:any=new PerformanceMonitor(); m.logger={debug:sinon.spy(),info:sinon.spy(),warn:sinon.spy(),error:sinon.spy()};
    await m.initialize({getConfiguration:()=>({}),getModule:()=>undefined} as any); m.config.enabled=true; return m;
}
const metric=(type=MetricType.QUERY_TIME,value=10)=>({type,value,unit:'ms',source:'query',timestamp:new Date()});
const threshold=(type=MetricType.QUERY_TIME)=>({type,enabled:true,warningThreshold:50,criticalThreshold:100,checkIntervalMs:10});

describe('Performance monitoring decision boundaries',()=>{
    afterEach(()=>sinon.restore());
    it('checks a supplied metric only against thresholds for the same metric type',async()=>{
        const m=await monitor(); m.config.thresholds=[threshold(MetricType.MEMORY_USAGE),threshold(MetricType.QUERY_TIME)];
        const emitted=sinon.spy(m,'emit'); m.recordMetric(metric(MetricType.QUERY_TIME,200));
        const alerts=emitted.getCalls().filter(c=>c.args[0]===PerformanceEvent.THRESHOLD_EXCEEDED);
        expect(alerts).to.have.length(1); expect(alerts[0].args[1].threshold.type).to.equal(MetricType.QUERY_TIME);
        await m.destroy();
    });
    it('computes health under connection stress and tolerates unavailable drivers',async()=>{
        const m=await monitor(); expect(m.calculateAverageQueryTime()).to.equal(0); expect(m.getDatabaseMetrics().activeConnections).to.equal(0);
        m.config.maxMetricsHistory=undefined; m.recordMetric(metric()); expect(m.recentMetrics).to.have.length(1);
        m.config.enableSystemMetrics=false; m.collectSystemMetrics(); expect(m.recentMetrics).to.have.length(1);
        for(const [stats,expected] of [[{totalConnections:0},100],[{totalConnections:2},100],[{totalConnections:2,poolUtilization:85},90],[{totalConnections:2,poolUtilization:95},80],[{totalConnections:2,failureRate:20},0]] as const) expect(m.calculateConnectionHealth(stats)).to.equal(expected);
        for(const failure of [new Error('offline'),'offline']){
            m.connectionManager={isInitialized:true,getStats:()=>{throw failure;}};
            expect(m.getDatabaseMetrics().activeConnections).to.equal(0); m.collectDatabaseMetrics();
        }
        expect(m.logger.warn.callCount).to.equal(5);
        await m.destroy(); m.collectDatabaseMetrics();
    });
    it('reports critical and warning violations with actionable pool, memory and query insights',async()=>{
        const m=await monitor();
        m.config.thresholds=[threshold(),threshold(MetricType.MEMORY_USAGE),threshold(MetricType.CPU_USAGE),{...threshold(MetricType.ERROR_RATE),enabled:false}];
        m.recordMetric(metric(MetricType.ERROR_RATE,200)); m.recordMetric(metric(MetricType.QUERY_TIME,1500)); m.recordMetric(metric(MetricType.MEMORY_USAGE,85));
        m.connectionManager={isInitialized:true,getStats:()=>({activeConnections:9,poolUtilization:95,totalConnections:10,failureRate:6})};
        sinon.stub(process,'memoryUsage').returns({heapUsed:90,heapTotal:100,rss:100,external:0,arrayBuffers:0});
        const report=await m.generateReport(new Date(0),new Date());
        expect(report.summary.performanceScore).to.equal(80); expect(report.thresholdViolations.map((v:any)=>v.violationType)).to.deep.equal(['critical','warning']);
        expect(report.summary.insights).to.have.length(5);
        m.config.thresholds=[]; m.startThresholdMonitoring(); expect(m.thresholdTimer).to.equal(undefined);
        await m.destroy();
    });
    it('runs export and threshold timers, handles collection failures and cancels timers at destruction',async()=>{
        const clock=sinon.useFakeTimers(); const m=await monitor(); m.config.exportIntervalMs=10;
        m.startMetricsExport(); await clock.tickAsync(10);
        expect(m.logger.info.getCalls().some((c:any)=>c.args[0]==='Exporting performance metrics')).to.equal(true);
        m.config.thresholds=[threshold()]; m.recordMetric(metric(MetricType.QUERY_TIME,60));
        m.startThresholdMonitoring(); await clock.tickAsync(10);
        expect(m.logger.warn.getCalls().some((c:any)=>c.args[0]==='Warning performance threshold exceeded')).to.equal(true);
        for(const failure of [new Error('memory'),'memory']){
            const stub=sinon.stub(process,'memoryUsage').callsFake(()=>{throw failure;}); m.collectSystemMetrics(); stub.restore();
        }
        expect(m.logger.warn.getCalls().filter((c:any)=>String(c.args[0]).includes('Failed to collect system metrics'))).to.have.length(2);
        await m.destroy(); m.exportMetrics(); expect(m.exportTimer).to.equal(undefined);
        m.config=undefined; m.startMetricsExport(); m.startMetricsCollection(); m.startThresholdMonitoring(); m.checkThresholds(); m.startDatabaseMetricsCollection();
        expect(m.eventNames()).to.deep.equal([]);
    });
});

describe('Performance initialization configuration branches',()=>{
    afterEach(()=>sinon.restore());
    it('initializes with export enabled and an unavailable connection module',async()=>{
        const clock=sinon.useFakeTimers(); const m:any=new PerformanceMonitor(); m.logger={debug:sinon.spy(),info:sinon.spy(),warn:sinon.spy(),error:sinon.spy()};
        expect(m.getConfiguration()).to.equal(undefined); m.updateConfiguration({maxMetricsHistory:2}); expect(m.getConfiguration()).to.equal(undefined);
        expect(()=>m.buildConfiguration()).to.throw('Manager not set');
        const build=m.buildConfiguration.bind(m);
        sinon.stub(m,'buildConfiguration').callsFake(()=>{build();m.config.exportMetrics=true;m.config.exportIntervalMs=10;m.config.collectionIntervalMs=10;});
        const initializing=m.initialize({getConfiguration:()=>({modules:{enableMetricsCollection:true}}),getModule:()=>({isInitialized:false})});
        await clock.tickAsync(10); await initializing;
        expect(m.isInitialized).to.equal(true); expect(m.baseline.size).to.equal(0);
        m.recordMetric(metric()); m.recentMetrics.push(metric()); m.updateConfiguration({maxMetricsHistory:1}); expect(m.recentMetrics).to.have.length(1);
        m.updateConfiguration({enabled:false}); expect(m.getConfiguration().enabled).to.equal(false);
        await m.destroy();
    });
    it('uses the baseline fallback interval and includes available statistics',async()=>{
        const clock=sinon.useFakeTimers(); const m=await monitor(); m.recordMetric(metric());
        m.config=undefined; const baseline=m.establishBaseline(); await clock.tickAsync(2000); await baseline;
        expect(m.baseline.get(MetricType.QUERY_TIME).average).to.equal(10); await m.destroy();
    });
});
