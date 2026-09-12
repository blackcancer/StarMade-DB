import {expect} from 'chai';
import {rejects} from 'node:assert/strict';
import sinon from 'sinon';
import {RelationshipAnalyzer,DiscoveryMethod,RelationshipType} from '../../../../src/core/modules/schema/RelationshipAnalyzer.js';
const relationship=(source='A',target='B')=>({name:`${source}_${target}`,sourceTable:source,targetTable:target,sourceColumns:['ID'],targetColumns:['ID'],isEnforced:true,confidence:1,type:RelationshipType.MANY_TO_ONE,discoveryMethod:DiscoveryMethod.FOREIGN_KEY});
function analyzer(){
    const a:any=new RelationshipAnalyzer(); a.initialized=true; a.logger={debug:sinon.spy(),info:sinon.spy(),warn:sinon.spy(),error:sinon.spy()};
    a.connectionManager={getConnection:async()=>({execute:async()=>({rows:[[0]]})}),releaseConnection:sinon.spy()}; return a;
}
const table=(name:string)=>({name,columns:[{name:'ID',dataType:'INTEGER',isPrimaryKey:true},{name:'PARENT',dataType:'INTEGER'}],indexes:[],statistics:{rowCount:10}});

describe('Relationship analysis boundaries',()=>{
    afterEach(()=>sinon.restore());
    it('reports failed validation as invalid even when an unavailable driver yields no orphan details',async()=>{
        const a=analyzer(); sinon.stub(a,'discoverRelationships').resolves([relationship()]);
        a.connectionManager.getConnection=async()=>{throw new Error('unavailable');};
        const result=await a.validateRelationshipIntegrity(); expect(result.isValid).to.equal(false); expect(result.integrityIssues).to.deep.equal([]);
        await a.destroy();
    });
    it('normalizes closed cycles and deduplicates parallel dependency edges',async()=>{
        const a=analyzer();
        expect(a.normalizeCycle([])).to.deep.equal([]); expect(a.normalizeCycle(['A'])).to.deep.equal(['A']);
        expect(a.normalizeCycle(['C','A','B','C'])).to.deep.equal(['A','B','C','A']);
        const deps=[['C','A'],['A','B'],['B','C'],['B','C'],['A','D'],['E','D']].map(([sourceTable,targetTable])=>({sourceTable,targetTable}));
        expect(a.detectCircularDependencies(deps)).to.deep.equal([['A','B','C','A']]);
        await a.destroy();
    });
    it('counts orphaned records, groups duplicate relationships and checks index coverage',async()=>{
        const a=analyzer(); const r=relationship(); a.connectionManager.getConnection=async()=>({execute:async()=>({rows:[['3']]})});
        sinon.stub(a,'discoverRelationships').resolves([r,{...r}]);
        const validation=await a.validateRelationshipIntegrity(); expect(validation).to.include({isValid:false,orphanedRecords:6}); expect(validation.duplicateRelationships).to.have.length(1);
        let target=table('B'); target.indexes=[{columns:[{name:'ID'}]}] as any; a.schemaAnalyzer={analyzeTable:async(name:string)=>name==='B'?target:table('A')};
        await a.analyzeRelationshipPerformance([r]); expect(r.performance.optimizations).to.deep.equal(['Add index on A(ID)']);
        target=table('B'); target.statistics.rowCount=0; await a.analyzeRelationshipPerformance([r]); expect(r.performance).to.include({indexCoverage:false,selectivity:1});
        expect(r.performance.optimizations).to.have.length(2);
        await a.destroy();
    });
    it('samples compatible columns, skips primary and foreign keys, and tolerates failed comparisons',async()=>{
        const a=analyzer(); a.config.enableDataSampling=false; expect(await a.discoverDataPatternRelationships([])).to.deep.equal([]); a.config.enableDataSampling=true;
        const tables=[table('A'),table('B')]; tables[0].columns.push({name:'TEXT',dataType:'VARCHAR'} as any);
        const correlate=sinon.stub(a,'analyzeDataCorrelation').resolves(.9);
        const matches=await a.discoverDataPatternRelationships(tables); expect(matches).to.have.length(4);
        correlate.resolves(.1); expect(await a.discoverDataPatternRelationships(tables)).to.deep.equal([]);
        for(const failure of [new Error('sample'),'sample']){correlate.callsFake(async()=>{throw failure;});expect(await a.discoverDataPatternRelationships(tables)).to.deep.equal([]);}
        expect(a.connectionManager.releaseConnection.callCount).to.equal(4);
        await a.destroy();
    });
    it('handles raw driver failures in every metadata and validation stage',async()=>{
        const a=analyzer(); const r=relationship();
        for(const failure of [new Error('driver'),'driver']){
            const connection={execute:async()=>{throw failure;}};
            expect(await a.getForeignKeyMetadata(connection,'A')).to.deep.equal([]);
            expect(await a.analyzeDataCorrelation(connection,'A','ID','B','ID')).to.equal(0);
            a.connectionManager.getConnection=async()=>connection; expect((await a.validateSingleRelationship(r)).isValid).to.equal(false);
            a.schemaAnalyzer={analyzeTable:async()=>{throw failure;}}; await a.analyzeRelationshipPerformance([r]);
            expect(r.performance.optimizations).to.deep.equal(['Unable to analyze - add manual index review']);
            const validate=sinon.stub(a,'validateSingleRelationship').callsFake(async()=>{throw failure;});
            expect(await a.validateRelationships([r])).to.deep.equal([]); validate.restore();
        }
        await a.destroy();
    });
    it('propagates discovery and analysis failures and handles empty cross-table results',async()=>{
        const a=analyzer();
        const discover=sinon.stub(a,'discoverRelationships').resolves([]);
        const cross=await a.performCrossTableAnalysis(['A']); expect(cross.metrics).to.include({totalRelationships:0,averageConfidence:0}); expect(cross.metrics.isolatedTables).to.deep.equal(['A']);
        for(const failure of [new Error('schema'),'schema']){
            discover.callsFake(async()=>{throw failure;}); await rejects(a.performCrossTableAnalysis(['A'])); await rejects(a.validateRelationshipIntegrity()); await rejects(a.analyzeTableRelationships('A'));
        }
        discover.restore(); a.schemaAnalyzer={analyzeSchema:async()=>{throw 'schema';}}; await rejects(a.discoverRelationships());
        await a.destroy();
        const uninitialized:any=new RelationshipAnalyzer(); await rejects(uninitialized.initialize({getModule:()=>{throw 'module';}})); await rejects(uninitialized.destroy());
    });
});

describe('Relationship metadata and cleanup edge cases',()=>{
    afterEach(()=>sinon.restore());
    it('skips declared foreign keys in naming discovery and validates composite joins',async()=>{
        const a=analyzer();const tables=[table('A'),table('B')];tables[0].columns.push({name:'B_ID',dataType:'INTEGER',isForeignKey:true} as any);
        expect(await a.discoverNamingPatternRelationships(tables)).to.deep.equal([]);
        let executed='';a.connectionManager.getConnection=async()=>({execute:async(sql:string)=>{executed=sql;return {rows:[[0]]};}});
        const result=await a.validateSingleRelationship({...relationship(),sourceColumns:['ID','SECOND']});expect(result.isValid).to.equal(false);expect(executed).to.equal('');
        expect((await a.validateSingleRelationship({...relationship(),sourceColumns:[],targetColumns:[]})).isValid).to.equal(false);
        const valid=await a.validateSingleRelationship({...relationship('WITH SPACE','A\"B'),sourceColumns:['ODD COLUMN'],targetColumns:['TARGET']});expect(valid.isValid).to.equal(true);expect(executed).to.include('FROM \"WITH SPACE\" s');expect(executed).to.include('JOIN \"A\"\"B\" t');
        await a.destroy();
    });
    it('preserves discovery error context and reports cleanup logger failures',async()=>{
        for(const failure of [new Error('schema'),'schema']){
            const a=analyzer();a.schemaAnalyzer={analyzeSchema:async()=>{throw failure;}};await rejects(a.discoverRelationships(),/schema/);
            a.logger.info=(_message:any,context:any)=>{if(context.operation==='destroy-complete')throw failure;};await rejects(a.destroy());expect(a.isInitialized).to.equal(false);
        }
    });
});


describe('Relationship analysis identifier quoting',()=>{
    it('quotes sampled table and column identifiers without changing their names',async()=>{
        const a=analyzer();const calls:string[]=[];
        const connection={execute:async(sql:string)=>{calls.push(sql);return {rows:[[1]]};}};
        expect(await a.analyzeDataCorrelation(connection,'A B','C"D','TARGET','ID')).to.equal(1);
        expect(calls[0]).to.include('SELECT DISTINCT "C""D"');expect(calls[0]).to.include('FROM "A B"');
        await a.destroy();
    });
});
