import {expect} from 'chai';
import {rejects} from 'node:assert/strict';
import sinon from 'sinon';
import {TransactionManager,IsolationLevel} from '../../../../src/core/modules/transactions/TransactionManager.js';
import {TransactionContext} from '../../../../src/core/modules/transactions/TransactionContext.js';
import {TransactionError,TransactionDeadlockError} from '../../../../src/core/errors.js';
async function manager(){const calls:string[]=[];const connection:any={getSessionState:async()=>({autoCommit:true,readOnly:false,isolationLevel:2}),setAutoCommit:async()=>{},setTransactionIsolation:async()=>{},setReadOnly:async()=>{},commit:async()=>{},rollback:async()=>{},close:async()=>{calls.push('close');},discard:async()=>{calls.push('discard');},execute:async()=>({rows:[],columns:[]})};const pool:any={getConnection:async()=>connection,releaseConnection:async()=>{calls.push('release');}};const m:any=new TransactionManager();await m.initialize({getModule:(name:string)=>name==='connection-manager'?pool:undefined});m.logger={info:sinon.spy(),debug:sinon.spy(),warn:sinon.spy(),error:sinon.spy()};return {m,connection,pool,calls};}

describe('Transaction manager error boundaries',()=>{
    afterEach(()=>sinon.restore());
    it('uses compatibility session defaults and exposes active debugging data',async()=>{
        const {m,connection}=await manager();delete connection.getSessionState;
        const tx=await m.beginTransaction('fallback',{isolationLevel:undefined,readOnly:undefined,timeout:0});
        expect(m.getTransactionInfo('fallback')).to.include({connectionId:'unknown',isolationLevel:IsolationLevel.READ_COMMITTED,timeout:30000});
        expect(m.getActiveTransactionsDebugInfo()[0]).to.include({transactionId:'fallback',queryCount:0,connectionId:'unknown'});await tx.execute('VALUES 1');expect(m.getActiveTransactionsDebugInfo()[0].queryCount).to.equal(1);
        m.forceCleanupAllTransactions();expect(m.getActiveTransactionCount()).to.equal(0);expect(m.getStatistics().activeTransactions).to.equal(0);expect(tx.isHealthy()).to.equal(false);
        m.forceCleanupAllTransactions('empty cleanup');await m.cleanupTransaction('missing');await m.destroy();
    });
    it('cleans acquisition failures using close for legacy sessions and logs cleanup failures',async()=>{
        for(const failure of [new Error('session'),'session']){
            const {m,connection,calls}=await manager();delete connection.discard;connection.getSessionState=async()=>{throw failure;};
            await rejects(m.beginTransaction('failure'),/session/);expect(calls).to.deep.equal(['close','release']);
            connection.close=async()=>{throw failure;};await rejects(m.beginTransaction('failure'),/session/);expect(m.logger.warn.callCount).to.equal(1);
            await m.destroy();
        }
    });
    it('rejects policy setup failures expressed as non-Error values',async()=>{
        for(const method of ['setReadOnly','setTransactionIsolation']){
            const {m,connection}=await manager();connection[method]=async()=>{throw 'policy';};await rejects(m.beginTransaction(),/policy/);expect(m.getActiveTransactionCount()).to.equal(0);await m.destroy();
        }
    });
    it('preserves JDBC transaction errors and supports legacy session discard fallback',async()=>{
        for(const operation of ['commit','rollback'])for(const failure of [new TransactionError('test',operation,'driver'), 'driver']){
            const {m,connection,calls}=await manager();delete connection.discard;connection[operation]=async()=>{throw failure;};const tx=await m.beginTransaction('test');
            let rejected:any;try{await tx[operation]();}catch(error){rejected=error;}
            expect(rejected).to.be.instanceOf(Error);if(failure instanceof TransactionError)expect(rejected).to.equal(failure);
            if(operation==='rollback')expect(calls.slice(-2)).to.deep.equal(['close','release']);await m.destroy();
        }
        const {m,connection,calls}=await manager();delete connection.discard;await m.beginTransaction('restore');connection.setReadOnly=async()=>{throw 'restore';};
        await m.commitTransaction('restore');expect(calls).to.deep.equal(['close','release']);await m.destroy();
    });
    it('rolls back a context if publication of the new transaction fails',async()=>{
        const {m}=await manager();const emitted=m.eventEmitter.emit.bind(m.eventEmitter);m.eventEmitter.emit=(event:string,data:any)=>{if(event==='transaction:started')throw Error('publication');emitted(event,data);};
        await rejects(m.beginTransaction('publication'),/publication/);expect(m.getActiveTransactionCount()).to.equal(0);await m.destroy();
    });
    it('retains error context when cleanup handlers fail',async()=>{
        const {m}=await manager();await m.beginTransaction('handlers');const info=m.activeTransactions.get('handlers');
        info.cleanupHandlers.push(async()=>{throw Error('handler');},async()=>{throw 'handler';});await m.rollbackTransaction('handlers');
        expect(m.logger.warn.callCount).to.equal(2);expect(m.getActiveTransactionCount()).to.equal(0);await m.destroy();
    });
    it('recognizes supported deadlock forms and retries raw errors',async()=>{
        const clock=sinon.useFakeTimers();const {m}=await manager();
        expect(m.isDeadlockError(null)).to.equal(false);expect(m.isDeadlockError('40001 serialization')).to.equal(true);expect(m.isDeadlockError(new Error('timeout'))).to.equal(true);expect(m.isDeadlockError(new Error('ordinary'))).to.equal(false);expect(m.isDeadlockError(new TransactionDeadlockError('x',[]))).to.equal(true);
        let attempts=0;const execution=m.executeTransaction(async()=>{if(++attempts===1)throw 'deadlock';return 'done';},{maxRetries:2,retryDelay:1});await clock.tickAsync(1);expect(await execution).to.equal('done');await m.destroy();
    });
    it('reports raw mass-rollback failures and clears the deadlock timer at destruction',async()=>{
        const clock=sinon.useFakeTimers();const {m}=await manager();await m.beginTransaction('all');
        const rollback=sinon.stub(m,'rollbackTransaction').callsFake(async()=>{throw 'raw rollback';});await rejects(m.rollbackAllTransactions('test'),AggregateError);rollback.restore();
        const tick=sinon.spy();m.deadlockDetectionTimer=setInterval(tick,10);await m.destroy();await clock.tickAsync(20);expect(tick.called).to.equal(false);
    });
    it('surfaces destruction failures so callers can retry cleanup',async()=>{
        for(const failure of [new Error('destroy'),'destroy']){
            const {m}=await manager();const rollback=sinon.stub(m,'rollbackAllTransactions').callsFake(async()=>{throw failure;});await rejects(m.destroy());expect(m.isInitialized).to.equal(true);
            await rejects(m.beginTransaction(),/shutting down/);rollback.restore();await m.destroy();expect(m.isInitialized).to.equal(false);
        }
    });
});

describe('Failed transaction publication recovery',()=>{
    afterEach(()=>sinon.restore());
    it('cleans tracked sessions even if context rollback itself fails before reaching the manager',async()=>{
        for(const failure of [new Error('rollback context'),'rollback context']){
            const {m,calls}=await manager();const emit=m.eventEmitter.emit.bind(m.eventEmitter);
            m.eventEmitter.emit=(event:string,data:any)=>{if(event==='transaction:started')throw Error('publish');emit(event,data);};
            const rollback=sinon.stub(TransactionContext.prototype,'rollback').callsFake(async()=>{throw failure;});
            await rejects(m.beginTransaction('unpublished'),/publish/);rollback.restore();
            expect(m.getActiveTransactionCount()).to.equal(0);expect(m.getStatistics().activeTransactions).to.equal(0);expect(calls).to.include('release');await m.destroy();
        }
    });
});

describe('Partially completed initialization rollback',()=>{
    afterEach(()=>sinon.restore());
    it('does not decrement active statistics twice when retrying failed rollback cleanup',async()=>{
        const {m,connection,calls}=await manager();const emit=m.eventEmitter.emit.bind(m.eventEmitter);
        m.eventEmitter.emit=(event:string,data:any)=>{if(event==='transaction:started')throw Error('publication');emit(event,data);};
        connection.rollback=async()=>{throw Error('driver rollback');};let cleanupLogs=0;
        m.logger.debug=(_message:any,context:any)=>{if(context.operation==='cleanup-transaction'&&++cleanupLogs===1)throw Error('cleanup logger');};
        await rejects(m.beginTransaction('partial'),/publication/);expect(m.getStatistics().activeTransactions).to.equal(0);expect(m.getActiveTransactionCount()).to.equal(0);expect(calls).to.deep.equal(['discard','release']);await m.destroy();
    });
});
