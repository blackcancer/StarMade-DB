import {expect} from 'chai';
import {describe,it} from 'mocha';
import {BaseModel,DataType,RelationType} from '../../src/tables/BaseModel.js';
class BoundaryModel extends BaseModel {
    static schema:any={tableName:'BOUNDARY',columns:[{name:'X',dataType:DataType.VARCHAR,nullable:false}],primaryKey:['X'],foreignKeys:[],indexes:[],validationRules:[]};
    static mappings:any={};
    static getRelationMappings(){return this.mappings;}
}
describe('Base model validation and serialization boundaries',()=>{
    it('reports required schema fields and both custom and default validation messages',()=>{
        const model:any=new BoundaryModel({});expect(model.validate().fieldErrors.X).to.have.length(1);
        for(const [type,value,input] of [['minLength',3,'x'],['maxLength',1,'xx'],['min',2,1],['max',1,2],['custom',0,1]]){
            const rule={field:'X',type,value,validator:()=>false};expect(model.validateField(rule,input,{})).to.be.a('string');
            expect(model.validateField({...rule,message:'specific'},input,{})).to.equal('specific');
        }
    });
    it('serializes loaded single and multiple relationships and omits hidden or empty ones',()=>{
        BoundaryModel.mappings={one:{},many:{},absent:{},hidden:{includeInJson:false},empty:{}};
        const parent:any=new BoundaryModel({X:'parent'});const child=new BoundaryModel({X:'child'});
        parent.setRelated('one',child);parent.setRelated('many',[child]);parent.setRelated('hidden',child);parent.setRelated('empty',null);
        expect(parent.toJSON()).to.deep.equal({X:'parent',one:{X:'child'},many:[{X:'child'}]});BoundaryModel.mappings={};
    });
    it('resolves real model classes and factories and rejects invalid relationship targets',()=>{
        expect(BaseModel.resolveModelClass(BaseModel)).to.equal(BaseModel);expect(BaseModel.resolveModelClass(()=>BaseModel)).to.equal(BaseModel);expect(BaseModel.resolveModelClass(BoundaryModel)).to.equal(BoundaryModel);
        expect(BaseModel.resolveModelClass(()=>BoundaryModel)).to.equal(BoundaryModel);
        expect(()=>BaseModel.resolveModelClass('unknown')).to.throw();
        for(const invalid of [null,{},()=>undefined,()=>({}),()=>function Invalid(){}])expect(()=>BaseModel.resolveModelClass(invalid as any)).to.throw();
        const failure=new Error('factory failed');expect(()=>BaseModel.resolveModelClass(()=>{throw failure;})).to.throw('factory failed');
    });

    it('does not treat inherited properties as loaded relationships',()=>{
        const model=new BoundaryModel({X:'x'});
        for(const name of ['constructor','toString','__proto__']){expect(model.hasRelated(name)).to.equal(false);expect(model.getRelated(name)).to.equal(undefined);expect(BoundaryModel.getRelation(name)).to.equal(undefined);}
        model.setRelated('__proto__',new BoundaryModel({X:'linked'}));expect(model.hasRelated('__proto__')).to.equal(true);model.clearAllRelated();expect(model.hasRelated('__proto__')).to.equal(false);
    });
    it('rejects incomplete join column references',()=>{
        BoundaryModel.mappings={parent:{relation:RelationType.BelongsToOneRelation,join:{from:'T.',to:'P.ID'}}};
        try{expect(()=>BoundaryModel.generateForeignKeysFromRelations()).to.throw('column');}finally{BoundaryModel.mappings={};}
    });
    it('reports foreign keys without matching relationships and default pattern errors',()=>{
        const original=BoundaryModel.schema.foreignKeys;BoundaryModel.schema.foreignKeys=[{name:'FK',columns:['X']}];
        BoundaryModel.mappings={other:{relation:RelationType.HasManyRelation,join:{from:'T.Y',to:'P.ID'}}};
        try{expect(BoundaryModel.validateSchemaConsistency().isConsistent).to.equal(false);expect(BoundaryModel.validateSchemaConsistency().issues[0]).to.include('no corresponding relation');BoundaryModel.mappings.other.join.from=['T.Y'];expect(BoundaryModel.validateSchemaConsistency().isConsistent).to.equal(false);}finally{BoundaryModel.schema.foreignKeys=original;BoundaryModel.mappings={};}
        const model:any=new BoundaryModel({X:'x'});expect(model.validateField({field:'X',type:'pattern',value:/^y$/},'x',{})).to.equal("Field 'X' has invalid format");
    });

});
