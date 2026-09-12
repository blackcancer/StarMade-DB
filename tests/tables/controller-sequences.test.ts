import { expect } from 'chai';
import { stub } from 'sinon';
import { IdGenTableController } from '../../src/tables/id-gen-table/IdGenTableController.js';
import { ValidationError } from '../../src/core/errors.js';

/** A sequence store implementing the database's conditional update boundary. */
function sequenceStore() {
 const c:any=new IdGenTableController({enableCaching:false});c.initialized=true;c.logger={info:stub(),warn:stub(),debug:stub(),error:stub()};
 let value=0;
 c.findById=async()=>{const snapshot=value;return {getIdGen:()=>snapshot};};
 c.executeUpdate=async(_sql:string,params:any[])=>{if(value!==params[2])return 0;value=params[0];return 1;};
 c.executeQuery=async(sql:string,params:any[])=>{
  if(sql.includes('RETURNING'))throw new Error('RETURNING is unsupported');
  if(sql.startsWith('UPDATE')){if(params.length===3){if(value===params[2])value=params[0];}else value++;return [];}
  return [{ID_GEN:value}];
 };
 return c;
}

describe('Sequence allocation concurrency',()=>{
 it('allocates distinct identifiers when two callers read the same starting value',async()=>{
  const c=sequenceStore(),results=await Promise.all([c.generateId('MINES'),c.generateId('MINES')]);expect(results.map(r=>r.id).sort()).to.deep.equal([0,1]);
 });
 it('allocates disjoint ranges when batch callers initially observe the same value',async()=>{
  const c=sequenceStore(),results=await Promise.all([c.generateBatchIds('MINES',{count:2,returnIds:true}),c.generateBatchIds('MINES',{count:2,returnIds:true})]);expect(results.flatMap(r=>r.ids).sort()).to.deep.equal([0,1,2,3]);
 });
 for(const count of [NaN,1.5]) it('rejects an invalid batch count '+count,async()=>{
  const c=sequenceStore();let error:any;try{await c.generateBatchIds('MINES',{count});}catch(e){error=e;}expect(error).to.be.instanceOf(ValidationError);
 });
});

import { useFakeTimers } from 'sinon';
describe('Sequence result and retry boundaries',()=>{
 for(const [value,number] of [[null,0],[{},0],['invalid',0],['7',7],[7,7]] as Array<[any,number]>) it('normalizes stored value '+JSON.stringify(value),()=>{expect(sequenceStore().parseNumber(value)).to.equal(number);});
 for(const uppercase of [true,false]) {
  it('reads the '+(uppercase?'upper':'lower')+'case atomic returning result including zero',async()=>{
   const c=sequenceStore();c.executeQuery=async()=>[uppercase?{GENERATED_ID:0,NEW_VALUE:1}:{generated_id:0,new_value:1}];expect(await c.generateId('MINES')).to.deep.equal({id:0,newSequenceValue:1,sequenceId:'MINES'});
  });
  for(const returnIds of [true,false]) it('reads batch RETURNING data, uppercase='+uppercase+', ids='+returnIds,async()=>{
   const c=sequenceStore();c.executeQuery=async()=>[uppercase?{START_ID:0,NEW_VALUE:2}:{start_id:0,new_value:2}];const result=await c.generateBatchIds('MINES',{count:2,returnIds});expect(result).to.include({startId:0,endId:1,newSequenceValue:2,count:2});expect(result.ids).to.deep.equal(returnIds?[0,1]:undefined);
  });
 }
 for(const method of ['generateId','generateBatchIds']) it(method+' falls back when UPDATE RETURNING produces no rows',async()=>{
  const c=sequenceStore();c.executeQuery=async()=>[];const fallback=stub(c,method==='generateId'?'generateIdFallbackAtomic':'generateBatchIdsFallbackAtomic').resolves({sentinel:true});expect(await c[method]('MINES',{count:1})).to.deep.equal({sentinel:true});expect(fallback.calledOnce).to.equal(true);
 });
 for(const kind of ['missing','error','string','contention']) for(const batch of [false,true]) it('honors retry limits for '+kind+', batch='+batch,async()=>{
  const c=sequenceStore(),clock=useFakeTimers({toFake:['setTimeout']});let calls=0;
  c.findById=async()=>{calls++;if(kind==='missing')return null;if(kind==='error')throw new Error('unavailable');if(kind==='string')throw 'unavailable';return {getIdGen:()=>0};};c.executeUpdate=async()=>0;
  try{
   const pending=(batch?c.generateBatchIdsFallbackAtomic('MINES',{count:2}):c.generateIdWithRetry('MINES',2)).then((result:any)=>({result}), (error:any)=>({error}));
   await clock.runAllAsync();const {error}=await pending;expect(error).to.be.instanceOf(Error);expect(calls).to.equal(batch?100:2);expect(error.message).to.include(kind==='missing'?'not found':kind==='contention'?'attempts':'unavailable');
  }finally{clock.restore();}
 });
 it('does not access the database when no retry attempts are permitted',async()=>{const c=sequenceStore(),read=stub(c,'findById');let error:any;try{await c.generateIdWithRetry('MINES',0);}catch(e){error=e;}expect(String(error)).to.include('0 attempts');expect(read.called).to.equal(false);});
 it('creates a missing sequence exactly once',async()=>{const c=sequenceStore(),exists=stub(c,'sequenceExists');exists.onCall(0).resolves(false);exists.onCall(1).resolves(true);const init=stub(c,'initializeSequence').resolves({});await c.ensureSequenceExists('MINES',7);await c.ensureSequenceExists('MINES',7);expect(init.callCount).to.equal(1);expect(init.firstCall.args).to.deep.equal(['MINES',{startValue:7}]);});
});

describe('Missing sequence utility operations',()=>{
 for(const method of ['incrementSequence','peekNextId']) it(method+' rejects a missing sequence',async()=>{const c=sequenceStore();c.findById=async()=>null;let error:any;try{await c[method]('MINES');}catch(e){error=e;}expect(error).to.be.instanceOf(ValidationError);});
});
