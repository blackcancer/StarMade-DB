import {expect} from 'chai';
import {rejects} from 'node:assert/strict';
import sinon from 'sinon';
import {TransactionContext} from '../../../../src/core/modules/transactions/TransactionContext.js';
import {ModuleEventEmitterImpl} from '../../../../src/core/events.js';
function context(){const manager:any=new ModuleEventEmitterImpl<string>();manager.commitTransaction=async()=>{};manager.rollbackTransaction=async()=>{};const connection:any={execute:async()=>({rows:[],columns:[]})};const tx:any=new TransactionContext('edge',connection,manager,{readOnly:true});tx.logger={debug:sinon.spy(),info:sinon.spy(),warn:sinon.spy(),error:sinon.spy()};return {tx,connection,manager};}

describe('Transaction context error boundaries',()=>{
    afterEach(()=>sinon.restore());
    it('keeps read-only state and accepts a query result without rows',async()=>{
        const {tx,manager}=context();expect(tx.getState().readOnly).to.equal(true);
        sinon.stub(tx,'execute').resolves({success:true});expect(await tx.query('VALUES 1')).to.deep.equal([]);manager.destroy();
    });
    it('normalizes raw batch item errors and propagates batch infrastructure failures',async()=>{
        const {tx,manager,connection}=context();connection.execute=async()=>{throw Error('hidden');};await rejects(tx.execute('secret'),/hidden/);
        expect(tx.logger.error.lastCall.args[1].sql).to.equal('[SQL HIDDEN]');
        const execution=sinon.stub(tx,'execute').callsFake(async()=>{throw 'raw item';});
        const batch=await tx.executeBatch({sql:'INSERT',parameterSets:[[1]]});expect(batch.failureCount).to.equal(1);expect(batch.errors[0].message).to.include('raw item');execution.restore();
        for(const failure of [new Error('logging'),'logging']){
            tx.logger.debug=(_message:any,context:any)=>{if(context.operation==='execute-batch-chunk')throw failure;};
            await rejects(tx.executeBatch({sql:'INSERT',parameterSets:[[1]]}));
        }
        manager.destroy();
    });
    it('preserves savepoint state after non-Error JDBC failures',async()=>{
        const {tx,connection,manager}=context();connection.execute=async()=>{throw 'create';};await rejects(tx.createSavepoint('safe'),/create/);expect(tx.getActiveSavepoints()).to.deep.equal([]);
        connection.execute=async()=>({});await tx.createSavepoint('safe');connection.execute=async()=>{throw 'savepoint';};
        await rejects(tx.rollbackToSavepoint('safe'),/savepoint/);await rejects(tx.releaseSavepoint('safe'),/savepoint/);
        expect(tx.getActiveSavepoints().map((s:any)=>s.name)).to.deep.equal(['safe']);manager.destroy();
    });
});
