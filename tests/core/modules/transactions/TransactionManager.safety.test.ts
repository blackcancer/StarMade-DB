import {expect} from 'chai';
import {rejects} from 'node:assert/strict';
import sinon from 'sinon';
import {TransactionManager,IsolationLevel} from '../../../../src/core/modules/transactions/TransactionManager.js';

function session(){const calls:string[]=[];const connection:any={id:'session',getSessionState:async()=>({autoCommit:true,readOnly:false,isolationLevel:2}),setTransactionIsolation:async()=>{calls.push('isolation');},setReadOnly:async()=>{calls.push('readOnly');},setAutoCommit:async()=>{calls.push('autoCommit');},commit:async()=>{calls.push('commit');},rollback:async()=>{calls.push('rollback');},discard:async()=>{calls.push('discard');},close:async()=>{calls.push('close');},execute:async()=>({rows:[],columns:[]})};return {connection,calls};}
async function setup(config:any={}){const {connection,calls}=session();const pool:any={getConnection:async()=>connection,releaseConnection:async()=>{calls.push('release');}};const m:any=new TransactionManager(config);await m.initialize({getModule:(name:string)=>name==='connection-manager'?pool:undefined});m.logger={info:sinon.spy(),debug:sinon.spy(),warn:sinon.spy(),error:sinon.spy()};return {m,pool,connection,calls};}
function deferred(){let resolve!:(value?:any)=>void;const promise=new Promise<any>(done=>{resolve=done;});return {promise,resolve};}

describe('Transaction reservation and rollback safety',()=>{
    afterEach(()=>sinon.restore());
    it('rejects duplicate active transaction identifiers without replacing their connection',async()=>{
        const {m}=await setup();const original=await m.beginTransaction('same');
        try{await rejects(m.beginTransaction('same'),/already exists|already active/);expect(m.getTransactionInfo('same').id).to.equal('same');}
        finally{await original.rollback();await m.destroy();}
    });
    it('reserves transaction capacity before asynchronously borrowing a session',async()=>{
        const {m,pool,connection}=await setup({maxConcurrentTransactions:1});const waiting=deferred();let borrows=0;pool.getConnection=async()=>++borrows===1?waiting.promise:session().connection;
        const first=m.beginTransaction('first');
        try{await rejects(m.beginTransaction('second'),/Maximum concurrent/);expect(borrows).to.equal(1);}
        finally{waiting.resolve(connection);await first;await m.rollbackAllTransactions();await m.destroy();}
    });
    it('rejects a duplicate identifier while the first acquisition is pending',async()=>{
        const {m,pool,connection}=await setup();const waiting=deferred();let borrows=0;pool.getConnection=async()=>++borrows===1?waiting.promise:session().connection;
        const first=m.beginTransaction('same');
        try{await rejects(m.beginTransaction('same'),/already exists|already active/);expect(borrows).to.equal(1);}
        finally{waiting.resolve(connection);await first;await m.rollbackAllTransactions();await m.destroy();}
    });
    it('does not release or reset a session before a slow mass rollback finishes',async()=>{
        const clock=sinon.useFakeTimers();const {m,connection,calls}=await setup();const pending=deferred();await m.beginTransaction('slow');calls.length=0;connection.rollback=()=>pending.promise;
        const rollback=m.rollbackAllTransactions();
        try{await clock.tickAsync(3500);expect(calls).to.deep.equal([]);expect(m.getActiveTransactionCount()).to.equal(1);}
        finally{pending.resolve();await rollback;await m.destroy();}
        expect(calls).to.deep.equal(['isolation','readOnly','autoCommit','release']);
    });
    it('reports mass rollback failures after all transactions have been attempted',async()=>{
        const {m,pool}=await setup();const attempted:string[]=[];
        let next=0;pool.getConnection=async()=>{const {connection}=session();const id=String(++next);connection.rollback=async()=>{attempted.push(id);if(id==='1')throw Error('rollback failed');};return connection;};
        await m.beginTransaction('a');await m.beginTransaction('b');
        await rejects(m.rollbackAllTransactions(),AggregateError);expect(attempted).to.include.members(['1','2']);expect(m.getActiveTransactionCount()).to.equal(0);await m.destroy();
    });
    it('aborts acquisition if destruction finishes before the session arrives',async()=>{
        const {m,pool,connection,calls}=await setup();const waiting=deferred();pool.getConnection=()=>waiting.promise;
        const pending=m.beginTransaction('late');const failure=rejects(pending,/not initialized|shutting down/);await m.destroy();waiting.resolve(connection);await failure;
        expect(m.getActiveTransactionCount()).to.equal(0);expect(calls).to.deep.equal(['discard','release']);
    });
});

describe('Transaction policy failure handling',()=>{
    afterEach(()=>sinon.restore());
    it('aborts when the requested read-only or isolation policy cannot be established',async()=>{
        for(const method of ['setReadOnly','setTransactionIsolation']){
            const {m,connection,calls}=await setup();connection[method]=async()=>{throw Error('policy denied');};
            await rejects(m.beginTransaction('policy',{readOnly:true,isolationLevel:IsolationLevel.SERIALIZABLE}),/policy denied/);
            expect(calls.slice(-2)).to.deep.equal(['discard','release']);expect(m.getActiveTransactionCount()).to.equal(0);await m.destroy();
        }
    });
    it('honors zero retries and zero retry delay',async()=>{
        const clock=sinon.useFakeTimers();const {m}=await setup();let attempts=0;
        const fail=rejects(m.executeTransaction(async()=>{attempts++;throw Error('deadlock');},{maxRetries:0,retryDelay:0}),/deadlock/);
        await clock.runAllAsync();await fail;expect(attempts).to.equal(1);
        attempts=0;const retried=m.executeTransaction(async()=>{attempts++;if(attempts===1)throw Error('deadlock');return 42;},{maxRetries:2,retryDelay:0});
        await clock.tickAsync(0);expect(await retried).to.equal(42);expect(attempts).to.equal(2);await m.destroy();
    });
});

describe('Transaction executor failure preservation',()=>{
    afterEach(()=>sinon.restore());
    it('preserves the commit error after the context has already been invalidated',async()=>{
        const {m,connection}=await setup();connection.commit=async()=>{throw Error('commit rejected');};
        await rejects(m.executeTransaction(async()=>42,{maxRetries:0}),/commit rejected/);await m.destroy();
    });
    it('rejects invalid retry options before beginning work',async()=>{
        const {m,pool}=await setup();const borrow=sinon.spy(pool,'getConnection');
        for(const maxRetries of [-1,1.5,Infinity,NaN])await rejects(m.executeTransaction(async()=>42,{maxRetries}),/retry|Retry/);
        for(const retryDelay of [-1,Infinity,NaN])await rejects(m.executeTransaction(async()=>42,{retryDelay}),/retry|Retry/);
        expect(borrow.callCount).to.equal(0);await m.destroy();
    });
});

describe('Transaction completion context ownership',()=>{
    afterEach(()=>sinon.restore());
    it('invalidates retained contexts before manager-driven completion releases their sessions',async()=>{
        for(const method of ['commitTransaction','rollbackTransaction','rollbackAllTransactions']){
            const {m,pool,connection}=await setup();const tx=await m.beginTransaction('owned');await tx.createSavepoint('safe');
            let healthyAtRelease=true;pool.releaseConnection=async()=>{healthyAtRelease=tx.isHealthy();};
            await m[method]('owned');expect(healthyAtRelease).to.equal(false);expect(tx.isHealthy()).to.equal(false);await rejects(tx.execute('VALUES 1'),/destroyed/);await m.destroy();
        }
    });
    it('computes duration averages and minima from completed commits only',async()=>{
        const clock=sinon.useFakeTimers();const {m}=await setup();let tx=await m.beginTransaction();clock.tick(10);await tx.commit();
        tx=await m.beginTransaction();clock.tick(5);await tx.rollback();tx=await m.beginTransaction();clock.tick(30);await tx.commit();
        expect(m.getStatistics()).to.include({averageDuration:20,minDuration:10,maxDuration:30});await m.destroy();
    });
});

describe('Transaction cleanup completion',()=>{
    afterEach(()=>sinon.restore());
    it('awaits asynchronous cleanup and continues after a synchronous handler failure',async()=>{
        const {m}=await setup();await m.beginTransaction('cleanup');const pending=deferred();const completed:string[]=[];
        m.activeTransactions.get('cleanup').cleanupHandlers=[async()=>{await pending.promise;completed.push('slow');},()=>{throw Error('sync cleanup');},async()=>{completed.push('later');}];
        let finished=false;const cleanup=m.cleanupTransaction('cleanup').then(()=>{finished=true;});
        await Promise.resolve();await Promise.resolve();expect(finished).to.equal(false);
        pending.resolve();await cleanup;expect(completed).to.include.members(['slow','later']);expect(m.getActiveTransactionCount()).to.equal(0);await m.destroy();
    });
});
