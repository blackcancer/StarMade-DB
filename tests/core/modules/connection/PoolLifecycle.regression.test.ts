import { expect } from 'chai';
import sinon from 'sinon';
import { ConnectionManager, ConnectionState } from '../../../../src/core/modules/connection/ConnectionManager.js';

const logger=new Proxy({}, {get:()=>()=>{}});
function configuredPool(): any {
    const pool:any=new ConnectionManager();
    pool._initialized=true;pool.logger=logger;
    pool.config={enablePooling:true,maxPoolSize:1,minPoolSize:0,timeoutMs:100,healthCheckIntervalMs:1000};
    return pool;
}
function entry(connection:any):any {
    return {id:connection.id,jdbcConnection:connection,state:ConnectionState.CONNECTED,isReserved:false,created:new Date(),lastUsed:new Date(),useCount:0,health:{isHealthy:true,lastCheck:new Date(),responseTime:0,consecutiveFailures:0,errors:[]}};
}
function deferred<T>() {let resolve!:(value:T)=>void;const promise=new Promise<T>(r=>resolve=r);return {promise,resolve};}

describe('Pool lifecycle race regressions',()=> {
    afterEach(()=>sinon.restore());
    it('clears both timers when a waiter immediately finds a connection',async()=> {
        const clock=sinon.useFakeTimers({toFake:['Date','setTimeout','clearTimeout','setInterval','clearInterval']});
        const pool=configuredPool();const connection={id:'ready',close:async()=>{}};
        pool.connectionPool.set('ready',entry(connection));
        expect(await pool.waitForAvailableJDBCConnection()).to.equal(connection);
        expect(clock.countTimers()).to.equal(0);
        await pool.destroy();
    });
    it('waits for late creation and closes it instead of publishing after destroy',async()=> {
        const pool=configuredPool();const pending=deferred<any>();let closes=0;let factoryDestroyed=false;
        pool.jdbcFactory={createConnectionFromManager:()=>pending.promise,destroy:async()=>{factoryDestroyed=true;}};
        const acquired=pool.getConnection().then(()=>null,(error:any)=>error);
        let finished=false;const destruction=pool.destroy().then(()=>{finished=true;});
        await Promise.resolve();await Promise.resolve();
        expect(finished).to.equal(false);
        pending.resolve({id:'late',close:async()=>{closes++;}});
        expect(await acquired).to.be.instanceOf(Error);
        await destruction;
        expect(closes).to.equal(1);expect(pool.connectionPool.size).to.equal(0);expect(factoryDestroyed).to.equal(true);
    });
    it('does not hand a validated connection back after destruction began',async()=> {
        const pool=configuredPool();const pending=deferred<boolean>();
        const connection={id:'pinging',isActive:true,ping:()=>pending.promise,close:async()=>{}};
        pool.connectionPool.set('pinging',entry(connection));
        const acquired=pool.getConnection().then(()=>null,(error:any)=>error);
        await pool.destroy();pending.resolve(true);
        expect(await acquired).to.be.instanceOf(Error);
    });
});

describe('Pool maintenance exclusivity',()=> {
    it('never probes a borrowed connection regardless of lease age',async()=> {
        const pool=configuredPool();let probes=0;
        const busy=entry({id:'busy',ping:async()=>{probes++;return true;},close:async()=>{}});
        busy.isReserved=true;busy.lastUsed=new Date(0);pool.connectionPool.set('busy',busy);
        await pool.checkRealConnectionHealth(busy);
        expect(probes).to.equal(0);await pool.destroy();
    });
    it('does not offer a connection while its health probe is pending',async()=> {
        const pool=configuredPool();const pending=deferred<boolean>();
        const probing=entry({id:'probe',ping:()=>pending.promise,close:async()=>{}});
        pool.connectionPool.set('probe',probing);
        const check=pool.checkRealConnectionHealth(probing);
        expect(pool.findAvailablePooledConnection()).to.equal(undefined);
        pending.resolve(true);await check;
        expect(pool.findAvailablePooledConnection()).to.equal(probing);await pool.destroy();
    });
    it('retains the configured minimum when multiple idle connections expire together',async()=> {
        const pool=configuredPool();pool.config.minPoolSize=1;pool.config.idleTimeoutMs=1;
        for(const id of ['first','second','third']) {const idle=entry({id,close:async()=>{}});idle.lastUsed=new Date(0);pool.connectionPool.set(id,idle);}
        await pool.cleanupIdleConnections();expect(pool.connectionPool.size).to.equal(1);await pool.destroy();
    });
});

describe('Legacy transaction session ownership',()=> {
    it('reuses one connection for concurrent requests to the same session and releases it',async()=> {
        const pool=configuredPool();const pending=deferred<any>();let acquisitions=0,releases=0;
        pool.getConnection=()=>{acquisitions++;return pending.promise;};
        pool.releaseConnection=async()=>{releases++;};
        const first=pool.getTransactionConnection('session');const second=pool.getTransactionConnection('session');
        pending.resolve({id:'legacy',close:async()=>{}});
        const [a,b]=await Promise.all([first,second]);
        expect(a.connection).to.equal(b.connection);expect(acquisitions).to.equal(1);
        await pool.releaseTransactionSession('session');expect(releases).to.equal(1);
        await pool.releaseTransactionSession('session');expect(releases).to.equal(1);
        await pool.destroy();
    });
});

describe('Maintenance creation capacity',()=> {
    it('counts maintenance connection creation against borrower capacity',async()=> {
        const value=configuredPool();const pending=deferred<any>();let creations=0;
        value.jdbcFactory={createConnectionFromManager:()=>{creations++;return pending.promise;},destroy:async()=>{}};
        value.waitForAvailableJDBCConnection=async()=> 'waiting';
        const maintenance=value.createRealPoolConnection();const borrower=value.getConnection();
        pending.resolve({id:'created',close:async()=>{}});
        await maintenance;expect(await borrower).to.equal('waiting');expect(creations).to.equal(1);await value.destroy();
    });
});

describe('Delayed reconnection integration ownership',()=> {
    afterEach(()=>sinon.restore());
    it('cancels delayed listener attachment during teardown',async()=> {
        const clock=sinon.useFakeTimers({toFake:['setTimeout','clearTimeout']});const value=configuredPool();let listeners=0;
        value.manager={getConfiguration:()=>({modules:{enableAutoReconnection:true}}),getModule:()=>({isInitialized:true,on:()=>{listeners++;}})};
        await value.setupReconnectionIntegration();await value.setupReconnectionIntegration();
        expect(clock.countTimers()).to.equal(1);await value.destroy();await clock.tickAsync(100);
        expect(listeners).to.equal(0);expect(clock.countTimers()).to.equal(0);
        await value.setupReconnectionIntegration();expect(clock.countTimers()).to.equal(0);
    });
});
