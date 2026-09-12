import {expect} from 'chai';
import {describe,it,afterEach} from 'mocha';
import sinon from 'sinon';
import {QueryValidator,QueryOperation} from '../../../../src/core/modules/query/QueryValidator.js';

function validator(){const v:any=new QueryValidator();v._initialized=true;v.logger=new Proxy({}, {get:()=>()=>{}});return v;}
const rule=(id:string,severity='error',extra:any={})=>({id,name:id,description:id,enabled:true,severity,...extra});
describe('SQL validation policy boundaries',()=>{
    afterEach(()=>sinon.restore());
    it('does not reuse permission decisions across different allowed operations',async()=>{
        const v=validator();
        try{
            expect((await v.validateQuery('SELECT * FROM PLAYERS',{options:{allowedOperations:[QueryOperation.SELECT]}})).isValid).to.equal(true);
            expect((await v.validateQuery('SELECT * FROM PLAYERS',{options:{allowedOperations:[QueryOperation.DELETE]}})).isValid).to.equal(false);
        }finally{await v.destroy();}
    });
    it('honors invocation-specific rules and fails closed when rule execution throws',async()=>{
        const v=validator();
        try{
            expect((await v.validateQuery('SELECT 1',{options:{customRules:[rule('deny','error',{pattern:'SELECT'})]}})).isValid).to.equal(false);
            for(const failure of [Error('offline'),'offline']){
                v.updateConfiguration({customRules:[rule('dynamic','error',{validator:async()=>{throw failure;}})]});
                const result=await v.validateQuery('SELECT 1');expect(result.isValid).to.equal(false);
                expect(result.errors.some((e:any)=>e.code==='CUSTOM_RULE_FAILURE')).to.equal(true);
            }
        }finally{await v.destroy();}
    });
    it('reevaluates stateful validator callbacks instead of caching their previous decision',async()=>{
        const v=validator();let deny=false;
        v.updateConfiguration({customRules:[rule('stateful','error',{validator:async()=>({isValid:!deny,errors:deny?[{code:'DENIED',message:'denied',severity:'error'}]:[],warnings:[],securityIssues:[],performanceHints:[]})})]});
        try{expect((await v.validateQuery('SELECT 1')).isValid).to.equal(true);deny=true;expect((await v.validateQuery('SELECT 1')).isValid).to.equal(false);}
        finally{await v.destroy();}
    });
    it('handles warning, critical, disabled and unmatched rules',async()=>{
        const v=validator();v.config.enableValidationCache=false;
        try{
            v.config.customRules=[rule('disabled','error',{enabled:false,pattern:'SELECT'}),rule('warning','warning',{pattern:'SELECT'}),rule('miss','error',{pattern:'XYZ'})];
            let result=await v.validateQuery('SELECT 1');expect(result.isValid).to.equal(true);expect(result.warnings.map((w:any)=>w.code)).to.include('warning');
            v.config.customRules=[rule('critical','critical',{pattern:'SELECT'})];result=await v.validateQuery('SELECT 1');expect(result.isValid).to.equal(false);
            v.config.customRules=[rule('noop','info',{validator:async()=>null})];expect((await v.validateQuery('SELECT 1')).isValid).to.equal(true);
            expect(v.detectQueryOperation('GRANT SELECT')).to.equal(QueryOperation.GRANT);expect(v.detectQueryOperation('REVOKE SELECT')).to.equal(QueryOperation.REVOKE);
            expect((await v.validateQuery('SELECT )')).isValid).to.equal(false);expect((await v.validateQuery('   ')).isValid).to.equal(false);
            v.validationCache.set('expired',{timestamp:new Date(0),result:{}});v.validationCache.set('fresh',{timestamp:new Date(),result:{}});
            v.performCleanup();expect(v.validationCache.has('expired')).to.equal(false);expect(v.validationCache.has('fresh')).to.equal(true);v.performCleanup();
            expect(v.eventNames()).to.be.an('array');
        }finally{await v.destroy();}
    });
    it('ignores parentheses inside quoted values, identifiers and comments',async()=>{
        const v=validator();
        for(const sql of ["SELECT ')'", 'SELECT "(" FROM T', 'SELECT 1 /* ( */', "SELECT 'it''s ('", 'SELECT 1 -- (']){
            const result=await v.validateQuery(sql);expect(result.errors,sql).to.deep.equal([]);
        }
        await v.destroy();
    });
    it('reports initialization, destruction and validation dependency failures',async()=>{
        for(const failure of [Error('offline'),'offline']){
            const v:any=new QueryValidator();
            let error;try{await v.initialize({getModule:()=>{throw failure;}});}catch(e){error=e;}expect(error).to.be.instanceOf(Error);await v.destroy();
            const ready=validator();sinon.stub(ready,'performValidation').rejects(failure instanceof Error?failure:Error(failure));
            expect((await ready.validateQuery('SELECT 1')).errors[0].code).to.equal('VALIDATION_ERROR');
            sinon.restore();sinon.stub(ready,'analyzeQueryStructure').callsFake(()=>{throw failure;});
            expect((await ready.validateQuery('SELECT 2')).errors[0].code).to.equal('VALIDATION_INTERNAL_ERROR');
            sinon.restore();const clear=sinon.stub(ready.validationCache,'clear').throws(Error('cache failure'));
            let destroyError;try{await ready.destroy();}catch(e){destroyError=e;}expect(destroyError).to.be.instanceOf(Error);clear.restore();await ready.destroy();
        }
        for(const dependency of [undefined,{isInitialized:false}]){const v=new QueryValidator();await v.initialize({getModule:()=>dependency} as any);await v.destroy();}
    });
    it('checks batch guards, cache expiry/capacity and expensive validation policy',async()=>{
        const v=validator();
        for(const input of [null,[]]){let error;try{await v.validateQueries(input);}catch(e){error=e;}expect(error).to.be.instanceOf(Error);}
        const valid=await v.validateQuery('SELECT 1');
        expect(v.shouldCacheValidation({...valid,validationTime:5001})).to.equal(false);
        v.validationCache.clear();for(let i=0;i<1002;i++)v.cacheValidation(String(i),valid);
        expect(v.validationCache.size).to.equal(1000);expect(v.validationCache.has('0')).to.equal(false);
        v.validationCache.set('old',{timestamp:new Date(0),result:valid});expect(v.getCachedValidation('old')).to.equal(null);
        expect(v.generateCacheKey({sql:'SELECT ?',parameters:[1n],options:{forbiddenPatterns:[/test/]}})).to.be.a('string');
        const result=await v.validateQuery('SELECT * FROM A JOIN B ON 1=1 JOIN C ON 1=1 JOIN D ON 1=1 JOIN E ON 1=1 JOIN F ON 1=1 JOIN G ON 1=1',{options:{maxComplexityScore:0,enablePerformanceAnalysis:true}});
        expect(result.performanceHints.map((h:any)=>h.type)).to.include('join_optimization');
        await v.destroy();
    });

    it('caches static policies, expires them and excludes critical results',async()=>{
        const v=validator();v.config.builtInRules=[];
        const first=await v.validateQuery('SELECT 123');const second=await v.validateQuery('SELECT 123');expect(second.isValid).to.equal(true);expect(v.validationStats.cacheHitRate).to.equal(0.5);
        expect(v.shouldCacheValidation({...first,threatLevel:'critical'})).to.equal(false);
        const critical=await v.validateQuery('SELECT * FROM T UNION SELECT * FROM T');expect(critical.threatLevel).to.equal('critical');
        expect(v.shouldCacheValidation(first)).to.equal(true);expect(v.getCachedValidation('missing')).to.equal(null);
        await v.destroy();
        let error;try{await v.validateQueries([{sql:'SELECT 1'}]);}catch(e){error=e;}expect(error).to.be.instanceOf(Error);
    });
    it('handles direct policy phases with optional configuration and absent schema support',async()=>{
        const v=validator();const result=await v.validateQuery('SELECT 1');
        await v.validateSchema({sql:'SELECT 1'},result);expect(result.warnings.some((w:any)=>w.code==='SCHEMA_VALIDATION_UNAVAILABLE')).to.equal(true);
        await v.validateSecurity({sql:'SELECT 1'},result);
        result.queryMetadata.complexity.score=100;await v.analyzePerformance({sql:'SELECT 1'},result);expect(result.performanceHints.some((h:any)=>h.type==='complexity_warning')).to.equal(true);
        await v.applyCustomRules({sql:'SELECT 1'},result);
        expect(v.calculateThreatLevel({errors:[],warnings:[],securityIssues:[{severity:'low'}]})).to.equal('low');
        sinon.stub(v,'performValidation').callsFake(()=>{throw 'offline';});expect((await v.validateQuery('SELECT 2')).errors[0].message).to.equal('offline');
        sinon.restore();await v.destroy();
    });

    it('reports cache entry metadata and expires entries on the scheduled interval',async()=>{
        const clock=sinon.useFakeTimers();const v=validator();v.config.builtInRules=[];v.config.validationCacheTtl=1;
        await v.validateQuery('SELECT 1');expect(v.getCacheStats().entries[0]).to.include({age:0,isValid:true,threatLevel:'none'});
        v.startCleanupInterval();await clock.tickAsync(300000);expect(v.getCacheStats().size).to.equal(0);await v.destroy();
    });

});
