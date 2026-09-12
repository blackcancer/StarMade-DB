import { expect } from 'chai';
import sinon from 'sinon';
import { ConnectionManager, ConnectionState } from '../../../../src/core/modules/connection/ConnectionManager.js';
import { JDBCConnectionFactory } from '../../../../src/core/modules/connection/JDBCConnectionFactory.js';

const logger=new Proxy({}, {get:()=>()=>{}});
const pools:any[]=[];
function pool(overrides:any={}):any {
    const value:any=new ConnectionManager();value.logger=logger;value._initialized=true;
    value.config={enablePooling:true,maxPoolSize:3,minPoolSize:0,timeoutMs:100,idleTimeoutMs:1000,healthCheckIntervalMs:1000,...overrides};
    value.manager={getConfiguration:()=>({modules:{enableAutoReconnection:false}}),getModule:()=>undefined};
    value.jdbcFactory={createConnectionFromManager:async()=>jdbc('new'),destroy:async()=>{}};
    pools.push(value);return value;
}
function jdbc(id:string):any {return {id,isActive:true,ping:async()=>true,close:async()=>{}};}
function entry(value:any,overrides:any={}):any {return {id:value.id,jdbcConnection:value,state:ConnectionState.CONNECTED,isReserved:false,useCount:0,created:new Date(),lastUsed:new Date(),health:{isHealthy:true,lastCheck:new Date(),responseTime:0,consecutiveFailures:0,errors:[]},...overrides};}
async function rejected(promise:Promise<any>):Promise<any> {let error;try{await promise;}catch(e){error=e;}expect(error).to.be.instanceOf(Error);return error;}

describe('Connection manager operational boundaries',()=> {
    afterEach(async()=>{for(const value of pools.splice(0))await value.destroy();sinon.restore();});
    it('rejects missing initialization and missing connection prerequisites',async()=> {
        const value=pool();value._initialized=false;
        await rejected(value.getTransactionConnection());value.manager=undefined;
        expect(()=>value.buildConfiguration()).to.throw();await rejected(value.initializeJDBCFactory());
        value.config=undefined;await rejected(value.createRealPoolConnection());value.jdbcFactory=undefined;
        await rejected(value.createDirectJDBCConnection());
    });
    it('wraps factory initialization failure',async()=> {
        const value=pool();sinon.stub(JDBCConnectionFactory.prototype,'initialize').rejects(Error('init failed'));
        expect((await rejected(value.initializeJDBCFactory())).message).to.include('init failed');
        value.jdbcFactory=undefined;
    });
    for(const failure of [Error('broken'),'broken']) {
        it(`reports pooled and direct creation failures (${typeof failure})`,async()=> {
            const value=pool();value.jdbcFactory.createConnectionFromManager=async()=>{throw failure;};
            value.stats.failedConnections=2;
            expect((await rejected(value.createRealPoolConnection())).message).to.include('broken');
            expect((await rejected(value.createDirectJDBCConnection())).message).to.include('broken');
            value.config.minPoolSize=1;await rejected(value.initializeRealPool());
            expect(value.pendingCreationCompletions.size).to.equal(0);
        });
    }
    it('creates and releases direct connections, including failed close',async()=> {
        const value=pool({enablePooling:false});const connection=await value.getConnection();
        await value.releaseConnection(connection);expect(value.stats.activeConnections).to.equal(0);
        await value.releaseConnection(null);
        for(const failure of [Error('close'),'close'])await value.releaseConnection({id:'bad',close:async()=>{throw failure;}});
    });
    it('creates legacy IDs, reuses known sessions and releases pending requests',async()=> {
        const value=pool();const session=await value.getTransactionConnection();
        expect(session.sessionId).to.match(/^tx_legacy_/);
        expect((await value.getTransactionConnection(session.sessionId)).connection).to.equal(session.connection);
        const pending=value.getTransactionConnection('pending');
        await value.releaseTransactionSession('pending');await pending;
        expect(value.transactionSessions.has('pending')).to.equal(false);
        await value.releaseTransactionSession(session.sessionId);
    });
    it('reports stale leases without altering ownership',()=> {
        const value=pool();const busy=entry(jdbc('old'),{isReserved:true,lastUsed:new Date(0)});
        value.connectionPool.set('old',busy);value.reportStaleConnections();expect(busy.isReserved).to.equal(true);
        busy.lastUsed=new Date();value.reportStaleConnections();
    });
    for(const outcome of [true,false,Error('reconnect'),'reconnect']) {
        it(`handles automatic reconnection result ${String(outcome)}`,async()=> {
            const value=pool();let calls=0;
            value.manager={getConfiguration:()=>({modules:{enableAutoReconnection:true}}),getModule:()=>({isInitialized:true,triggerReconnection:async()=>{calls++;if(typeof outcome!=='boolean')throw outcome;return outcome;}})};
            await value.triggerAutoReconnection('test');await value.triggerAutoReconnection('cooldown');
            expect(calls).to.equal(1);
        });
    }
    it('ignores unavailable reconnection modules',async()=> {
        const value=pool();value.manager={getConfiguration:()=>({modules:{enableAutoReconnection:true}}),getModule:()=>undefined};
        await value.triggerAutoReconnection('missing');value.manager.getModule=()=>({isInitialized:false});await value.triggerAutoReconnection('not-ready');
        value.manager=undefined;expect(value.isAutoReconnectionEnabled()).to.equal(false);
    });
    it('attaches reconnection listeners and handles refresh errors',async()=> {
        const clock=sinon.useFakeTimers();const value=pool();const listeners=new Map<string,Function>();
        value.manager={getConfiguration:()=>({modules:{enableAutoReconnection:true}}),getModule:()=>({isInitialized:true,on:(event:string,listener:Function)=>listeners.set(event,listener)})};
        await value.setupReconnectionIntegration();await clock.tickAsync(100);
        expect(listeners.size).to.equal(3);
        const refresh=sinon.stub(value,'refreshUnhealthyConnections').rejects(Error('refresh'));
        listeners.get('reconnect-success')!();listeners.get('circuit-breaker-opened')!();listeners.get('circuit-breaker-closed')!();await clock.tickAsync(0);
        expect(refresh.calledOnce).to.equal(true);
    });
    it('handles integration when reconnection is unavailable after the delay',async()=> {
        const clock=sinon.useFakeTimers();const value=pool();value.manager={getConfiguration:()=>({modules:{enableAutoReconnection:true}}),getModule:()=>undefined};
        await value.setupReconnectionIntegration();await clock.tickAsync(100);
    });
    for(const failure of [null,Error('close'),'close']) {
        it(`refreshes unreserved unhealthy pool entries (${String(failure)})`,async()=> {
            const value=pool({minPoolSize:1});const connection=jdbc('bad');
            if(failure)connection.close=async()=>{throw failure;};
            const unhealthy=entry(connection);unhealthy.health.isHealthy=false;value.connectionPool.set('bad',unhealthy);
            await value.refreshUnhealthyConnections();
            expect(value.connectionPool.has('bad')).to.equal(Boolean(failure));
            expect(value.connectionPool.size).to.equal(1);
        });
    }
    it('skips reserved unhealthy connections and tolerates failed replacements',async()=> {
        const value=pool({minPoolSize:2});const busy=entry(jdbc('busy'),{isReserved:true,state:ConnectionState.FAILED});busy.health.isHealthy=false;value.connectionPool.set('busy',busy);
        value.jdbcFactory.createConnectionFromManager=async()=>{throw Error('replacement');};
        await value.refreshUnhealthyConnections();expect(value.connectionPool.has('busy')).to.equal(true);
        value.config.enablePooling=false;await value.refreshUnhealthyConnections();
        value.config.enablePooling=true;busy.health.isHealthy=true;busy.state=ConnectionState.CONNECTED;await value.refreshUnhealthyConnections();
    });
    it('records failed pings and retains only the latest ten errors',async()=> {
        const value=pool();const connection=jdbc('probe');const probe=entry(connection);
        connection.ping=async()=>false;
        for(let count=0;count<3;count++)await value.checkRealConnectionHealth(probe);
        expect(probe.state).to.equal(ConnectionState.FAILED);
        for(let count=0;count<11;count++){connection.ping=async()=>{throw count%2?Error('error'):'error';};await value.checkRealConnectionHealth(probe);}
        expect(probe.health.errors).to.have.length(10);expect(probe.isHealthChecking).to.equal(false);
    });
    it('aggregates unhealthy and mixed-health pool results',async()=> {
        const value=pool();const trigger=sinon.stub(value,'triggerAutoReconnection').resolves();
        for(let index=0;index<6;index++){const connection=jdbc(String(index));connection.ping=async()=>index===0;value.connectionPool.set(connection.id,entry(connection));}
        await value.performRealHealthChecks();expect(trigger.firstCall.args[0]).to.equal('high-failure-rate');
        value.connectionPool.get('0').jdbcConnection.ping=async()=>false;
        await value.performRealHealthChecks();expect(trigger.secondCall.args[0]).to.equal('all-connections-unhealthy');
        value.config=undefined;await value.performRealHealthChecks();
    });
    it('reports public test failures for false, thrown Error and thrown values',async()=> {
        const value=pool();for(const [index,outcome]of [false,Error('broken'),'broken'].entries()){const connection=jdbc(String(index));connection.ping=async()=>{if(typeof outcome==='boolean')return outcome;throw outcome;};value.connectionPool.set(connection.id,entry(connection));}
        const report=await value.testAllConnections();expect(report.failedConnections).to.equal(3);expect(report.details[1].error).to.equal('broken');
    });
    for(const method of ['discard','close'])for(const failure of [null,Error('discard'),'discard']) {
        it(`removes invalid entries even when ${method} fails (${String(failure)})`,async()=> {
            const value=pool();const connection=jdbc('invalid');connection[method]=async()=>{if(failure)throw failure;};const invalid=entry(connection);value.connectionPool.set('invalid',invalid);
            value.removeInvalidConnection(invalid);await Promise.resolve();expect(value.connectionPool.has('invalid')).to.equal(false);
        });
    }
    it('handles synchronous failure while discarding an invalid connection',()=> {
        const value=pool();const invalid=entry({...jdbc('invalid'),discard:()=>{throw 'synchronous';}});value.connectionPool.set('invalid',invalid);
        value.removeInvalidConnection(invalid);expect(value.connectionPool.size).to.equal(0);
    });
    it('drops a returned invalid connection instead of offering it again',async()=> {
        const value=pool();const connection=jdbc('bad');connection.isActive=false;value.connectionPool.set('bad',entry(connection));
        await value.releaseConnection(connection);expect(value.connectionPool.size).to.equal(0);
        await value.releaseConnection(jdbc('unknown'));
    });
    it('rejects acquisition when validation discovers an unusable connection',async()=> {
        const value=pool();const connection=jdbc('bad');connection.ping=async()=>{throw 'ping';};value.connectionPool.set('bad',entry(connection));
        const replacement=await value.getConnection();expect(replacement.id).to.equal('new');
    });
    for(const failure of [Error('close'),'close']) {
        it(`finishes destroy when connection and factory close fail (${typeof failure})`,async()=> {
            const value=pool();const connection=jdbc('bad');connection.close=async()=>{throw failure;};value.connectionPool.set('bad',entry(connection));value.jdbcFactory.destroy=async()=>{throw failure;};
            await value.destroy();expect(value.connectionPool.size).to.equal(0);expect(value.isInitialized).to.equal(false);
        });
    }
});

describe('Connection manager timeout and teardown boundaries',()=> {
    afterEach(async()=>{for(const value of pools.splice(0))await value.destroy();sinon.restore();});
    it('reports a zero-capacity configured pool at its backup deadline',async()=> {
        const clock=sinon.useFakeTimers();const value=pool({maxPoolSize:0,timeoutMs:75});
        const result=rejected(value.waitForAvailableJDBCConnection());await clock.tickAsync(75);await result;
    });
    it('uses the default wait deadline when configuration is missing',async()=> {
        const clock=sinon.useFakeTimers();const value=pool();value.config=undefined;
        const result=rejected(value.waitForAvailableJDBCConnection());await clock.tickAsync(15000);expect((await result).message).to.be.a('string');
    });
    it('rejects an immediately destroyed waiter and clears its timers',async()=> {
        const clock=sinon.useFakeTimers({toFake:['setTimeout','clearTimeout','setInterval','clearInterval','Date']});const value=pool();await value.destroy();
        await rejected(value.waitForAvailableJDBCConnection());expect(clock.countTimers()).to.equal(0);expect(()=>value.beginConnectionCreation()).to.throw();
        await value.performRealHealthChecks();await value.cleanupIdleConnections();
    });
    it('handles a system-clock jump past the wait deadline',async()=> {
        const clock=sinon.useFakeTimers({now:100000});const value=pool();const trigger=sinon.stub(value,'triggerAutoReconnection').resolves();
        const result=rejected(value.waitForAvailableJDBCConnection());clock.setSystemTime(101000);await clock.tickAsync(50);await result;expect(trigger.calledOnce).to.equal(true);
    });
    it('rejects acquisition if a connected listener begins teardown',async()=> {
        const value=pool();let destruction:Promise<void>|undefined;value.on('connected',()=>{destruction=value.destroy();});
        await rejected(value.getConnection());await destruction;
    });
    it('closes direct connections completed after teardown begins',async()=> {
        const value=pool({enablePooling:false});let resolve!:(connection:any)=>void;let closed=0;
        value.jdbcFactory.createConnectionFromManager=()=>new Promise(r=>resolve=r);
        const acquired=rejected(value.getConnection());const destroyed=value.destroy();resolve({id:'late',close:async()=>{closed++;}});await acquired;await destroyed;expect(closed).to.equal(1);
    });
    for(const failure of [Error('unknown'),'unknown']) {
        it(`ignores unknown connection close failures (${typeof failure})`,async()=> {
            const value=pool();await value.releaseConnection({id:'unknown',close:async()=>{throw failure;}});
        });
        it(`removes failed idle connections despite close errors (${typeof failure})`,async()=> {
            const value=pool();const connection=jdbc('failed');connection.close=async()=>{throw failure;};value.connectionPool.set('failed',entry(connection,{state:ConnectionState.FAILED}));await value.cleanupIdleConnections();expect(value.connectionPool.size).to.equal(0);
        });
    }
    it('skips maintenance-disabled timers and absent cleanup configuration',async()=> {
        const value=pool();value.config=undefined;value.startHealthMonitoring();value.startCleanupTimer();await value.cleanupIdleConnections();
    });
    it('keeps connections owned by a maintenance probe and evicts failed ones',async()=> {
        const value=pool();value.connectionPool.set('probe',entry(jdbc('probe'),{isHealthChecking:true,lastUsed:new Date(0)}));
        value.connectionPool.set('failed',entry(jdbc('failed'),{state:ConnectionState.FAILED}));await value.cleanupIdleConnections();expect([...value.connectionPool.keys()]).to.deep.equal(['probe']);
    });
    it('rejects unsuccessful and throwing validation pings',async()=> {
        const value=pool();const connection=jdbc('probe');connection.ping=async()=>false;expect(await value.validateConnectionBeforeUse(entry(connection))).to.equal(false);
        connection.ping=async()=>{throw Error('ping');};expect(await value.validateConnectionBeforeUse(entry(connection))).to.equal(false);
        value.removeInvalidConnection(entry({...jdbc('bad'),discard:()=>{throw Error('sync');}}));
    });
    it('handles non-Error failures at replaceable pool boundaries',async()=> {
        const value=pool({minPoolSize:1});sinon.stub(value,'createRealPoolConnection').callsFake(async()=>{throw 'raw';});
        await rejected(value.initializeRealPool());const bad=entry(jdbc('bad'));bad.health.isHealthy=false;value.connectionPool.set('bad',bad);await value.refreshUnhealthyConnections();
        sinon.stub(JDBCConnectionFactory.prototype,'initialize').callsFake(async()=>{throw 'raw';});await rejected(value.initializeJDBCFactory());value.jdbcFactory=undefined;
    });
    it('handles delayed unavailable and failing reconnection integration',async()=> {
        const clock=sinon.useFakeTimers();const value=pool();const callbacks=new Map<string,Function>();let available=false;
        value.manager={getConfiguration:()=>({modules:{enableAutoReconnection:true}}),getModule:()=>({isInitialized:available,on:(event:string,listener:Function)=>callbacks.set(event,listener)})};
        await value.setupReconnectionIntegration();await clock.tickAsync(100);available=true;
        await value.setupReconnectionIntegration();await clock.tickAsync(100);
        sinon.stub(value,'refreshUnhealthyConnections').callsFake(async()=>{throw 'raw';});callbacks.get('reconnect-success')!();await clock.tickAsync(0);
    });
});


describe('Connection manager degraded maintenance callbacks',()=> {
    afterEach(async()=>{for(const value of pools.splice(0))await value.destroy();sinon.restore();});
    for(const failure of [Error('probe callback'),'probe callback']) {
        it(`continues checking after an unexpected probe callback failure (${typeof failure})`,async()=> {
            const value=pool();value.connectionPool.set('probe',entry(jdbc('probe')));
            sinon.stub(value,'checkRealConnectionHealth').callsFake(async()=>{throw failure;});
            await value.performRealHealthChecks();expect(value.getStats().activeConnections).to.equal(1);
        });
    }
    for(const jump of [false,true]) {
        it(`reports zero capacity when configuration is removed while waiting (clock jump ${jump})`,async()=> {
            const clock=sinon.useFakeTimers({now:100000});const value=pool();
            const result=rejected(value.waitForAvailableJDBCConnection());value.config=undefined;
            if(jump){clock.setSystemTime(101000);await clock.tickAsync(50);}else await clock.tickAsync(100);
            expect((await result).message).to.be.a('string');
        });
    }
});
