import fsPromises from 'node:fs/promises';
import {syncBuiltinESMExports} from 'node:module';
import {expect} from 'chai';
import {rejects} from 'node:assert/strict';
import sinon from 'sinon';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DatabaseReporter,ReportFormat} from '../../../../src/core/modules/schema/DatabaseReporter.js';

function report(){return {metadata:{id:'sample',generatedAt:new Date(0),database:{name:'world',version:'1',connectionUrl:'jdbc:hsqldb:mem:world',size:0},version:'1',generationDuration:1,format:'html',type:'schema'},schema:{tables:[]}} as any;}
function reporter(){const r:any=new DatabaseReporter();r.logger={debug:sinon.spy(),info:sinon.spy(),warn:sinon.spy(),error:sinon.spy()};return r;}
const health=(score:number)=>({overallScore:score,performanceScore:score,dataQualityScore:score,designScore:score,securityScore:score});

describe('Database report rendering and failure boundaries',()=>{
    afterEach(()=>sinon.restore());
    it('renders empty, incomplete and populated schemas with all health levels',()=>{
        const r=reporter();
        for(const tables of [undefined,[]]){
            const data=report();data.schema.tables=tables;
            expect(r.generateHtmlReport(data)).to.include('No tables found');expect(r.generateMarkdownReport(data)).to.include('No tables found');
        }
        for(const score of [0,65,95]){
            const data=report(); data.schema.health=health(score);
            const columns=Array.from({length:11},(_,i)=>({name:`COLUMN${i}`,dataType:'VARCHAR',maxLength:i?undefined:10,nullable:i%2===0,isPrimaryKey:i===0,isForeignKey:i===1,isUnique:i===2}));
            data.schema.tables=[{name:'COMPLETE',schema:'PUBLIC',type:'TABLE',columns,indexes:[{}],constraints:[{}],statistics:{rowCount:5,sizeBytes:1024,healthScore:score}},{name:'INCOMPLETE'}, {name:'EMPTY',columns:[],statistics:{}}];
            data.relationships={relationships:Array.from({length:21},(_,i)=>({sourceTable:'A',targetTable:'B',type:i?'many-to-one':undefined,discoveryMethod:i?'foreign-key':undefined,confidence:i?1:0})),metrics:{isolatedTables:['ISOLATED']}};
            const html=r.generateHtmlReport(data);const markdown=r.generateMarkdownReport(data);
            expect(html).to.include(score>=80?'health-excellent':score>=60?'health-good':'health-poor');expect(html).to.include('11 more relationships');
            expect(markdown).to.include('1 more columns'); expect(markdown).to.include('1 more relationships');expect(markdown).to.include('ISOLATED');
        }
        const data=report(); data.relationships={relationships:[{sourceTable:'A',targetTable:'B'}]};
        expect(r.generateMarkdownReport(data)).to.include('Unknown');
        data.relationships={};expect(r.generateHtmlReport(data)).to.not.include('<h2>?? Relationships</h2>');
    });
    it('escapes database names and recommendations in standalone HTML reports',()=>{
        const r=reporter();const data=report();data.metadata.database.name='<script>alert("db")</script>';
        data.performance={summary:{recommendations:['<img src=x onerror=alert(1)>']}};
        const html=r.generateHtmlReport(data);expect(html).to.not.include('<script>');expect(html).to.not.include('<img');expect(html).to.include('&lt;script&gt;');
    });
    it('computes actual response averages and connectivity recommendations including failures',async()=>{
        const r=reporter();expect(r.calculateAverageResponseTime(undefined)).to.equal(0);expect(r.calculateAverageResponseTime([])).to.equal(0);expect(r.calculateAverageResponseTime([{}])).to.equal(0);
        expect(r.calculateAverageResponseTime([{responseTime:10},{responseTime:20},{}])).to.equal(15);
        expect(r.generatePerformanceRecommendations({healthyConnections:0,failedConnections:2,totalTested:11},2000)).to.have.length(4);
        expect(r.getMetricUnit('query-time')).to.equal('ms');expect(r.getMetricUnit('throughput')).to.equal('ops/sec');expect(r.getMetricUnit('operations-per-second')).to.equal('ops/sec');expect(r.getMetricUnit('unknown')).to.equal('units');
        expect(r.getStatValue(new Map([[{toString:()=> 'query-time'},{}]]),'query-time')).to.equal(0);
        for(const count of [0,1]){
            r.connectionManager={testAllConnections:async()=>({healthyConnections:0,failedConnections:count,totalTested:count,details:count?[{responseTime:2000},{}]:[]})};
            const perf=await r.createDefaultPerformanceReport();expect(perf.summary.criticalIssues).to.equal(1);expect(perf.alerts[0].severity).to.equal('critical');expect(perf.summary.errorRate).to.equal(count?100:0);
        }
        for(const failure of [new Error('connection'),'connection']){r.connectionManager={testAllConnections:async()=>{throw failure;}};expect((await r.createDefaultPerformanceReport()).metadata.reportType).to.equal('fallback');}
    });
    it('assigns migration complexity and risk from breaking changes',()=>{
        const r=reporter();
        for(const [count,complexity,risk] of [[0,'simple','low'],[1,'moderate','medium'],[5,'complex','medium'],[7,'complex','high'],[11,'critical','high']] as const){
            const diff=Array.from({length:count},()=>({backwardCompatible:false}));const impact=r.analyzeSchemaImpact(diff);
            expect(impact).to.include({migrationComplexity:complexity,riskLevel:risk});expect(r.generateMigrationRecommendations(diff,impact)[0].type).to.equal(count?'phased':'immediate');
        }
    });
    it('saves to fallback output paths and propagates filesystem errors',async()=>{
        const r=reporter();const directory=await mkdtemp(join(tmpdir(),'starmade-reporter-'));
        try{
            r.config.outputDir=directory;const output=await r.formatAndSaveReport(report(),{format:ReportFormat.JSON});expect(JSON.parse(await readFile(output,'utf8')).metadata.id).to.equal('sample');
            const regularFile=join(directory,'file');await writeFile(regularFile,'data');r.config.outputDir=regularFile;
            await rejects(r.ensureOutputDirectory());await rejects(r.loadSchemaSnapshot(regularFile));
        }finally{await rm(directory,{recursive:true,force:true});}
    });
    it('propagates non-Error dependency failures and event notifications',async()=>{
        const r=reporter();const directory=await mkdtemp(join(tmpdir(),'starmade-reporter-'));
        try{
            r.config.outputDir=directory;await r.initialize({getModule:(name:string)=>name==='connection-manager'?{}:name==='schema-analyzer'?{analyzeSchema:async()=>{throw 'schema';}}:undefined});
            const event=sinon.spy();r.on('report:failed',event);r.emit('report:failed',{reason:'manual'});expect(r.eventNames()).to.include('report:failed');
            await rejects(r.generateSchemaReport());await rejects(r.generateExecutiveSummary());
            const load=sinon.stub(r,'loadSchemaSnapshot').callsFake(async()=>{throw 'snapshot';});await rejects(r.compareSchemas('source','target'));load.restore();
            expect(event.callCount).to.equal(4);await r.destroy();
            const missing=reporter();missing.config.outputDir=directory;await rejects(missing.initialize({getModule:(name:string)=>name==='connection-manager'?{}:undefined}));
            const broken=reporter();await rejects(broken.initialize({getModule:()=>{throw 'module';}}));
        }finally{await rm(directory,{recursive:true,force:true});}
    });
});

describe('Database performance report conversion',()=>{
    it('preserves critical and warning thresholds when converting monitoring reports',()=>{
        const r=reporter(); const violations=['critical','warning'].map(violationType=>({violationType,value:200,timestamp:new Date(0),threshold:{type:'memory-usage',warningThreshold:50,criticalThreshold:100}}));
        const perf={timestamp:new Date(0),systemMetrics:{cpu:{percentage:10},memory:{used:10,total:100,percentage:10}},databaseMetrics:{activeConnections:1,errorRate:0},statistics:new Map([['memory-usage',{average:10}]]),thresholdViolations:violations,summary:{performanceScore:50,totalMetrics:2,insights:['Review memory']}};
        const converted=r.convertPerformanceReport(perf);expect(converted.performanceMetrics[0]).to.include({value:10,unit:'%'});
        expect(converted.thresholds.map((t:any)=>[t.type,t.value])).to.deep.equal([['critical',100],['warning',50]]);
        expect(converted.alerts.map((a:any)=>a.severity)).to.deep.equal(['critical','warning']);
        const data=report();data.performance=converted;expect(r.generateMarkdownReport(data)).to.include('1. Review memory');
    });
});


describe('Database reporter external service errors',()=>{
    afterEach(()=>{sinon.restore();syncBuiltinESMExports();});
    it('retains Error and non-Error filesystem failure context',async()=>{
        const r=reporter();
        const read=sinon.stub(fsPromises,'readFile');const mkdir=sinon.stub(fsPromises,'mkdir');syncBuiltinESMExports();
        for(const failure of [new Error('disk'),'disk']){
            read.callsFake(async()=>{throw failure;});mkdir.callsFake(async()=>{throw failure;});
            await rejects(r.loadSchemaSnapshot('sample'),/disk/);await rejects(r.ensureOutputDirectory());
        }
        expect(r.logger.error.callCount).to.equal(2);
    });
    it('permits retrying destruction after listener cleanup fails',async()=>{
        for(const failure of [new Error('listeners'),'listeners']){
            const r=reporter();r.initialized=true;r.eventEmitter={removeAllListeners:()=>{throw failure;}};
            await rejects(r.destroy());expect(r.isInitialized).to.equal(true);
            r.eventEmitter.removeAllListeners=()=>{};await r.destroy();expect(r.isInitialized).to.equal(false);
        }
    });
    it('summarizes tables without indexes and propagates Error-shaped summary failures',async()=>{
        const r=reporter();r.initialized=true;r.eventEmitter={emit:()=>{},removeAllListeners:()=>{}};
        r.manager={getConfiguration:()=>({worldName:'test'}),getDatabaseUrl:()=> 'jdbc:hsqldb:mem:test'};
        r.schemaAnalyzer={analyzeSchema:async()=>({tables:[{columns:[],indexes:undefined}]})};
        expect((await r.generateExecutiveSummary()).overview.indexCount).to.equal(0);
        r.schemaAnalyzer.analyzeSchema=async()=>{throw new Error('schema');};await rejects(r.generateExecutiveSummary(),/schema/);await r.destroy();
    });
});
