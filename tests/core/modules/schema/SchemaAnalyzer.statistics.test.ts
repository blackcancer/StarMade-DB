import {expect} from 'chai';
import {describe,it} from 'mocha';
import {SchemaAnalyzer} from '../../../../src/core/modules/schema/SchemaAnalyzer.js';
function analyzer(){const a:any=new SchemaAnalyzer();a.logger=new Proxy({}, {get:()=>()=>{}});return a;}
describe('Schema statistics edge cases',()=>{
    it('keeps zero numeric averages and gives all-null columns a finite quality score',async()=>{
        const a=analyzer();let i=0;
        const stats=await a.getColumnStatistics({execute:async()=>({rows:[[[2,2,2]],[[-1,1,0]],[[0,1]],[[0]]][i++]})},'T','X','INTEGER',{maxSampleSize:10});
        expect(stats.averageValue).to.equal(0);
        expect(a.calculateDataQualityScore(2,0,0,'INTEGER')).to.equal(30);
    });
    it('retains counts when optional numeric, frequency or sample queries fail',async()=>{
        const a=analyzer();
        for(const failure of [Error('unsupported'),'unsupported']){
            let i=0;const stats=await a.getColumnStatistics({execute:async()=>{if(i++===0)return {rows:[[3,2,1]]};throw failure;}},'T','X','INTEGER',{maxSampleSize:10});
            expect(stats).to.include({totalRows:3,nonNullCount:2,uniqueCount:1});expect(stats.sampleValues).to.deep.equal([]);
            const fallback=await a.getColumnStatistics({execute:async()=>{throw failure;}},'T','X','INTEGER',{});expect(fallback).to.include({totalRows:0,qualityScore:50});
        }
    });
    it('estimates storage for all scalar types and scores incomplete schemas',()=>{
        const a=analyzer();
        for(const [type,size] of [['INTEGER',4],['BIGINT',8],['DECIMAL',8],['DOUBLE',8],['FLOAT',4],['REAL',4],['VARCHAR',50],['CHAR',1],['DATE',4],['TIME',4],['TIMESTAMP',8],['BOOLEAN',1],['OTHER',20]])expect(a.estimateRowSize(Array.from({length:10},()=>({dataType:type})))).to.equal(Number(size)*10);
        expect(a.estimateRowSize([{dataType:'VARCHAR',maxLength:500},{dataType:'CHAR',maxLength:20}])).to.equal(275);
        expect(a.calculateTableDataQuality([])).to.equal(0);expect(a.calculateTableDataQuality([{}])).to.equal(75);
        expect(a.calculateDataQualityScore(2,2,1,'BINARY')).to.equal(75);
        expect(a.calculateTableHealth(0,[],0)).to.equal(0);expect(a.calculateTableHealth(0,[{isPrimaryKey:true}],0)).to.equal(12);expect(a.calculateDataQualityScore(2,2,1,'VARCHAR')).to.equal(80);expect(a.extractPrimaryKey([])).to.equal(undefined);
        expect(a.calculateComplexityScore(0,0,0)).to.equal(90);
        expect(a.calculateComplexityScore(30,450,90)).to.equal(80);
        expect(a.calculateComplexityScore(60,1800,1800)).to.equal(45);
        const table={name:'T',columns:Array.from({length:51},()=>({name:'X',dataType:'VARCHAR',isNullable:true})),indexes:[],constraints:[],foreignKeys:[{columns:['X']}],referencingKeys:[],statistics:{rowCount:100001,averageRowSize:6000,dataQualityScore:20}};
        expect(a.assessTableDesign(table)).to.equal(15);expect(a.assessTablePerformance(table)).to.equal(5);
        const issues:any[]=[];a.checkTableIssues(table,issues);expect(issues.map((x:any)=>x.type)).to.include('PERFORMANCE');
        const recommendations=a.generateTableRecommendations(table);expect(recommendations.map((x:any)=>x.type)).to.include('INDEX').and.include('CONSTRAINT');
        expect(a.assessSchemaHealth([],{}).overallScore).to.be.a('number');
    });
    it('sanitizes large, circular and missing report values',()=>{
        const a=analyzer();const circular:any={};circular.self=circular;
        expect(a.sanitizeValueForReport(null)).to.equal(null);expect(a.sanitizeValueForReport(undefined)).to.equal(undefined);
        expect(a.sanitizeValueForReport('x'.repeat(500))).to.equal('x'.repeat(200)+'...');
        expect(a.sanitizeValueForReport({value:'x'.repeat(250)})).to.match(/^\[OBJECT:/);
        expect(a.sanitizeValueForReport(circular)).to.equal('[UNPARSEABLE_OBJECT]');
        const array:any[]=[];array.push(array);expect(a.estimateObjectSize(array)).to.equal(100);expect(a.estimateObjectSize(1n)).to.equal(100);expect(a.estimateObjectSize(circular)).to.be.greaterThan(0);expect(a.estimateObjectSize(null)).to.equal(0);
    });
    it('tolerates missing numeric aggregate values',async()=>{
        const a=analyzer();
        for(const average of [null,undefined]){let i=0;const stats=await a.getColumnStatistics({execute:async()=>({rows:[[[2,2,1]],[[1,1,average]],[],[]][i++]})},'T','X','INTEGER',{maxSampleSize:10});expect(stats.averageValue).to.equal(undefined);}
    });

});
