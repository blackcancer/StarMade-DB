import {expect} from 'chai';
import {describe,it,afterEach} from 'mocha';
import sinon from 'sinon';
import {TransactionContext} from '../../../../src/core/modules/transactions/TransactionContext.js';
import {ModuleEventEmitterImpl} from '../../../../src/core/events.js';

function context(execute: (...args:any[])=>Promise<any> = async()=>({rows:[],columns:[]})){
    const manager:any=new ModuleEventEmitterImpl<string>();
    manager.commitTransaction=async()=>{};manager.rollbackTransaction=async()=>{};
    const connection:any={id:'session',execute};
    const tx:any=new TransactionContext('unit-tx',connection,manager,{});
    tx.logger=new Proxy({}, {get:()=>()=>{}});
    return {tx,manager,connection};
}
async function rejected(fn:()=>Promise<any>){let error:unknown;try{await fn();}catch(e){error=e;}expect(error).to.be.instanceOf(Error);return error;}

describe('Transaction context boundaries',()=>{
    afterEach(()=>sinon.restore());
    it('returns metadata-free updates and tracks/reset timings',async()=>{
        const clock=sinon.useFakeTimers();
        const {tx,connection}=context(async()=>{clock.tick(10);return {rowsAffected:2};});
        const empty=tx.getDebugInfo();expect(empty).to.include({queryCount:0,averageQueryTime:0,connectionId:'session'});
        const response=await tx.execute('UPDATE T SET X=1');expect(response.rows).to.deep.equal([]);expect(response.metadata).to.equal(undefined);
        expect(tx.getDebugInfo()).to.include({queryCount:1,totalQueryTime:10,averageQueryTime:10});
        tx.resetStatistics();expect(tx.getDebugInfo().queryCount).to.equal(0);
        delete connection.id;expect(tx.getDebugInfo().connectionId).to.equal('unknown');
        tx.connection=null;expect(tx.isHealthy()).to.equal(false);
    });
    it('normalizes non-Error execution failures and logs SQL only when enabled',async()=>{
        const {tx}=context(async()=>{throw 'offline';});tx.options.enableLogging=true;
        expect((await rejected(()=>tx.execute('SELECT 1')) as Error).message).to.include('offline');
        const failure=await tx.executeBatch({sql:'INSERT',parameterSets:[[1],[2]]});
        expect(failure.failureCount).to.equal(2);expect(failure.errors).to.have.length(2);
    });
    it('does not accept injected savepoint identifiers',async()=>{
        const sql:string[]=[];const {tx}=context(async q=>{sql.push(q);return {};});
        for(const name of ['x; COMMIT','x --','x y','"quoted"'])await rejected(()=>tx.createSavepoint(name));
        expect(sql).to.deep.equal([]);expect(tx.getSavepointSummary().total).to.equal(0);
    });
    it('preserves savepoint state when JDBC create, rollback or release fails',async()=>{
        let fail=true;const {tx}=context(async()=>{if(fail)throw new Error('denied');return {};});
        await rejected(()=>tx.createSavepoint('safe'));expect(tx.getSavepointSummary().maxOrder).to.equal(0);
        fail=false;await tx.createSavepoint('safe');expect(tx.getSavepointSummary()).to.include({total:1,active:1});
        fail=true;await rejected(()=>tx.rollbackToSavepoint('safe'));await rejected(()=>tx.releaseSavepoint('safe'));
        expect(tx.getSavepointSummary()).to.include({total:1,active:1,released:0});
        fail=false;await tx.releaseSavepoint('safe');expect(tx.getSavepointSummary()).to.include({active:0,released:1});
    });
    it('invalidates contexts after commit and rollback failures',async()=>{
        for(const method of ['commit','rollback']){
            const {tx,manager}=context();const failure=new Error('failed');
            manager[method+'Transaction']=async()=>{throw failure;};
            expect(await rejected(()=>tx[method]())).to.equal(failure);expect(tx.isHealthy()).to.equal(false);
        }
    });
    it('delegates events and filters transaction-specific listeners',()=>{
        const {tx,manager}=context();const received:any[]=[];
        tx.onTransactionEvent('transaction:started',(_:any,data:any)=>received.push(data));
        tx.emit('transaction:started',{transactionId:'other'});tx.emit('transaction:started');
        tx.emit('transaction:started',{transactionId:'unit-tx'});expect(received).to.have.length(1);
        expect(tx.getTransactionListenerCount()).to.equal(1);
        tx.removeAllListeners('transaction:started');expect(tx.getTransactionListenerCount()).to.equal(0);
        tx.removeAllListeners();manager.destroy();
    });
});
