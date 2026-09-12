import {expect} from 'chai';
import {stub} from 'sinon';
import {BaseController} from '../../src/tables/BaseController.js';
import {BaseModel,column,DataType,foreignKey} from '../../src/tables/BaseModel.js';

class BoundaryModel extends BaseModel {
 static tableName='BOUNDARY';
 static schema={tableName:'BOUNDARY',columns:[column('ID',DataType.BIGINT,{primaryKey:true,autoIncrement:true}),column('A',DataType.INTEGER),column('B',DataType.INTEGER)],primaryKey:['ID'],foreignKeys:[],indexes:[],validationRules:[]};
}
class BoundaryController extends BaseController<BoundaryModel> {
 protected ModelClass=BoundaryModel;
 protected controllerName='boundary';
}
function isolated():any {
 const c:any=new BoundaryController({enableCaching:false,enableForeignKeyValidation:false});c.initialized=true;c.logger={debug:stub(),info:stub(),warn:stub(),error:stub()};return c;
}
async function failure(action:()=>Promise<unknown>):Promise<unknown>{try{await action();}catch(error){return error;}throw new Error('Expected operation to reject');}

describe('Base controller failure and composite reference semantics',()=>{
 for(const missing of [null,undefined]) for(const values of [[1,missing],[missing,1]]) it('permits MATCH SIMPLE composite foreign keys '+JSON.stringify(values),async()=>{
  const c=isolated(),query=stub(c,'executeQuery').resolves([]),model=new BoundaryModel({A:values[0],B:values[1]});
  await c.validateSingleForeignKey(model,foreignKey('FK_COMPOSITE',['A','B'],'PARENT',['A','B']));expect(query.called).to.equal(false);
 });
 it('rejects unsuccessful query results rather than reporting an empty table',async()=>{
  const c=isolated();c.parameterizedQuery={execute:async()=>({success:false,error:new Error('database unavailable')})};expect(await failure(()=>c.executeQuery('SELECT * FROM BOUNDARY',[]))).to.be.instanceOf(Error);
 });
});

describe('Generated identities stay attached to their INSERT',()=>{
 for(const generatedIdentity of [0,'9007199254740993']) it('returns the exact generated identity '+generatedIdentity,async()=>{
  const c=isolated(),execute=stub().resolves({success:true,generatedIdentity,rows:[],affectedRows:1});c.parameterizedQuery={execute};
  const model=await c.create({A:2});expect(String(model.get('ID'))).to.equal(String(generatedIdentity));expect(execute.calledOnce).to.equal(true);expect(execute.firstCall.args[2]).to.deep.equal({returnGeneratedIdentity:true});
 });
 for(const generatedIdentity of [undefined,null,'','not-an-id',1.5,Number.MAX_SAFE_INTEGER+1]) it('rejects an unusable generated identity '+String(generatedIdentity),async()=>{
  const c=isolated();c.parameterizedQuery={execute:async()=>({success:true,generatedIdentity})};expect(String(await failure(()=>c.create({A:2})))).to.include('valid generated identity');
 });
 it('preserves a supplied zero identity and reloads it by primary key',async()=>{
  const c=isolated(),execute=stub().resolves({success:true,rows:[]}),model=BoundaryModel.fromRow({ID:0,A:2}),find=stub(c,'findById').resolves(model);c.parameterizedQuery={execute};expect(await c.create({ID:0,A:2})).to.equal(model);expect(String(find.firstCall.args[0])).to.equal('0');expect(execute.firstCall.args).to.have.length(2);
 });
});

describe('Base controller branch contracts',()=>{
 for(const operation of ['findById','findMany','create','update','delete']) for(const thrown of [new Error('boundary failed'),'boundary failed']) it('propagates '+operation+' failure '+typeof thrown,async()=>{
  const c=isolated();stub(c,'executeQuery').callsFake(async()=>{throw thrown});if(operation==='update'||operation==='delete')stub(c,'findById').resolves(new BoundaryModel({ID:1,A:2}));
  const args:any={findById:[1],findMany:[],create:[{ID:1,A:2}],update:[1,{A:3}],delete:[1]};expect(String(await failure(()=>c[operation](...args[operation])))).to.include('boundary failed');
 });
 it('serves cached lists without querying',async()=>{const c=isolated();c.config.enableCaching=true;c.cacheManager={get:stub().resolves([{ID:1}])};const query=stub(c,'executeQuery');expect((await c.findMany())[0].get('ID')).to.equal(1);expect(query.called).to.equal(false);});
 it('applies a subclass active condition and bound values',async()=>{const c=isolated(),query=stub(c,'executeQuery').resolves([]);stub(c,'buildActiveCondition').returns({clause:'A = ?',params:[7]});await c.findMany({limit:0});expect(query.firstCall.args).to.deep.equal(['SELECT * FROM BOUNDARY WHERE A = ?',[7]]);});
 for(const softSupported of [true,false]) it('selects soft deletion only when supported '+softSupported,async()=>{const c=isolated(),query=stub(c,'executeQuery').resolves([]);stub(c,'findById').resolves(new BoundaryModel({ID:1}));stub(c,'supportsSoftDelete').returns(softSupported);await c.delete({ID:1},{softDelete:true});expect(query.firstCall.args[0]).to.equal(softSupported?'UPDATE BOUNDARY SET deleted_at = CURRENT_TIMESTAMP WHERE ID = ?':'DELETE FROM BOUNDARY WHERE ID = ?');expect(query.firstCall.args[1]).to.deep.equal([1]);});
 it('returns the updated in-memory model when the refreshed record disappeared',async()=>{const c=isolated();stub(c,'findById').onFirstCall().resolves(new BoundaryModel({ID:1,A:2})).onSecondCall().resolves(null);stub(c,'executeQuery').resolves([]);expect((await c.update({ID:1},{A:3})).get('A')).to.equal(3);});
 for(const thrown of [new Error('table PARENT not found'),'table PARENT not found',new Error('connection failed'),'connection failed']) it('handles reference query failure '+String(thrown),async()=>{const c=isolated();stub(c,'executeQuery').callsFake(async()=>{throw thrown});const action=()=>c.validateSingleForeignKey(new BoundaryModel({A:1}),foreignKey('FK',['A'],'PARENT',['ID']));if(String(thrown).includes('not found')){await action();expect(c.logger.warn.calledOnce).to.equal(true);}else expect(await failure(action)).to.equal(thrown);});
 for(const value of [-1,'-1']) it('accepts StarMade sentinel references '+typeof value,async()=>{const c=isolated(),query=stub(c,'executeQuery');await c.validateSingleForeignKey(new BoundaryModel({A:value}),foreignKey('FK',['A'],'ENTITIES',['ID']));expect(query.called).to.equal(false);});
 for(const result of [undefined,[],{success:true},{success:true,rows:[[1]]}]) it('handles optional query result shape '+JSON.stringify(result),async()=>{const c=isolated();c.parameterizedQuery={execute:async()=>result};if(result===undefined)expect(await failure(()=>c.executeQuery('SELECT 1',[]))).to.be.instanceOf(Error);else expect(await c.executeQuery('SELECT 1',[])).to.deep.equal(result.rows?.length?[{}]:[]);});
 it('rejects unavailable generated-identity query modules',async()=>{const c=isolated();expect(String(await failure(()=>c.create({A:1})))).to.include('module not available');});
 it('rejects an unsuccessful INSERT even when an identity is present',async()=>{const c=isolated();c.parameterizedQuery={execute:async()=>({success:false,generatedIdentity:7})};expect(String(await failure(()=>c.create({A:1})))).to.include('valid generated identity');});
});

describe('Base controller schema boundaries',()=>{
 for(const options of [{orderBy:'ID; DROP TABLE BOUNDARY'},{orderDirection:'SIDEWAYS'},{limit:-1},{offset:1.5}]) it('rejects invalid query options before database access '+JSON.stringify(options),async()=>{const c=isolated(),query=stub(c,'executeQuery');expect(await failure(()=>c.findMany(options))).to.be.instanceOf(Error);expect(query.called).to.equal(false);});
 it('rejects unknown update columns before record lookup',async()=>{const c=isolated(),find=stub(c,'findById');expect(String(await failure(()=>c.update(1,{'A = 0 WHERE 1=1 --':2})))).to.include('Update column must belong');expect(find.called).to.equal(false);});
});
