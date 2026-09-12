import {expect} from 'chai';
import {describe,it} from 'mocha';
import {TransactionManager} from '../../../../src/core/modules/transactions/TransactionManager.js';

async function setup(failAt:'rollback'|'restore'){
    const calls:string[]=[];
    let ended=false;
    const connection:any={id:'tx-session',
        getSessionState:async()=>({autoCommit:true,readOnly:false,isolationLevel:2}),
        setAutoCommit:async()=>{},setReadOnly:async()=>{},
        setTransactionIsolation:async()=>{if(ended&&failAt==='restore')throw Error('restore failed');},
        commit:async()=>{ended=true;},
        rollback:async()=>{ended=true;calls.push('rollback');if(failAt==='rollback')throw Error('rollback failed');},
        discard:async()=>{calls.push('discard');},close:async()=>{calls.push('close');}};
    const manager=new TransactionManager();
    await manager.initialize({getModule:(name:string)=>name==='connection-manager'?{
        getConnection:async()=>connection,releaseConnection:async()=>{calls.push('release');}
    }:undefined} as any);
    return {manager,calls};
}
describe('Transaction failure cleanup',()=>{
    it('reports rollback failures and discards the session before release',async()=>{
        const {manager,calls}=await setup('rollback');
        try{
            const tx=await manager.beginTransaction();let failure:unknown;
            try{await tx.rollback();}catch(e){failure=e;}
            expect(failure).to.be.instanceOf(Error);
            expect(calls.slice(-2)).to.deep.equal(['discard','release']);
            expect(manager.getActiveTransactionCount()).to.equal(0);
            expect(manager.getStatistics().activeTransactions).to.equal(0);
            expect(tx.isHealthy()).to.equal(false);
        }finally{await manager.destroy();}
    });
    it('discards a session when restoring settings fails after commit',async()=>{
        const {manager,calls}=await setup('restore');
        try{const tx=await manager.beginTransaction();await tx.commit();expect(calls).to.deep.equal(['discard','release']);}
        finally{await manager.destroy();}
    });
});
