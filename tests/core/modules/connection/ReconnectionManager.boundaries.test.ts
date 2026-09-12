import { expect } from 'chai';
import sinon from 'sinon';
import { ReconnectionManager, ReconnectionStrategy, CircuitBreakerState, ModuleEventEmitterImpl, ConnectionEvent } from '../../../../src/core/modules/connection/ReconnectionManager.js';
import { ConnectionError } from '../../../../src/core/errors.js';
const logger=new Proxy({}, {get:()=>()=>{}});
const managers:any[]=[];
function manager():any {const value:any=new ReconnectionManager();value.logger=logger;value._initialized=true;value.config={enabled:true,strategy:ReconnectionStrategy.IMMEDIATE,maxRetries:2,baseDelayMs:1,maxDelayMs:10,jitterFactor:0,circuitBreakerThreshold:2,circuitBreakerCooldownMs:0,resetOnSuccess:true};value.connectionManager={getConnection:async()=>({execute:async()=>{}}),releaseConnection:async()=>{},testAllConnections:async()=>({totalTested:1,healthyConnections:1})};value.initializeEventListeners();managers.push(value);return value;}
async function rejected(promise:Promise<any>):Promise<any>{let error;try{await promise;}catch(e){error=e;}expect(error).to.be.instanceOf(Error);return error;}

describe('Reconnection manager boundaries',()=> {
    afterEach(async()=>{for(const value of managers.splice(0))await value.destroy();sinon.restore();});
    for(const withLogger of [true,false]) {
        it(`supports regular and one-shot event listeners (${withLogger?'logged':'unlogged'})`,()=> {
            const emitter=new ModuleEventEmitterImpl<any>(withLogger?logger as any:undefined);let calls=0;const listener=()=>calls++;
            emitter.initializeEvents(['ready']);emitter.on('ready',listener);emitter.on('new',listener);emitter.once('once',listener);emitter.once('ready',listener);
            expect(emitter.listenerCount('ready')).to.equal(2);expect(emitter.listenerCount('missing')).to.equal(0);
            expect(emitter.eventNames()).to.have.members(['ready','new','once']);
            emitter.emit('ready');emitter.emit('ready');emitter.emit('once');expect(calls).to.equal(4);
            for(const failure of [Error('listener'),'listener']){emitter.on('error',()=>{throw failure;});emitter.once('error',()=>{throw failure;});emitter.emit('error');}
            emitter.off('ready',listener);emitter.off('missing',listener);emitter.emit('missing');emitter.removeAllListeners('new');emitter.removeAllListeners('missing');emitter.removeAllListeners();expect(emitter.listenerCount('error')).to.equal(0);emitter.destroy();
        });
    }
    it('uses delay and configuration fallbacks',()=> {
        const value=manager();value.config=undefined;expect(value.calculateDelay(1)).to.equal(0);value.recordFailure();
        value.config={strategy:'custom',baseDelayMs:7};expect(value.calculateDelay(1)).to.equal(7);
        value.config.strategy=ReconnectionStrategy.EXPONENTIAL_BACKOFF;value.config.maxDelayMs=10;value.config.jitterFactor=1;sinon.stub(Math,'random').returns(1);expect(value.calculateDelay(4)).to.equal(10);
        value.manager={getConfiguration:()=>({modules:{},connection:{}})};value.buildConfiguration();expect(value.getConfig().maxRetries).to.equal(3);expect(value.getConfig().attemptTimeoutMs).to.equal(10000);
        value.manager=undefined;expect(()=>value.buildConfiguration()).to.throw();
    });
    it('requires both explicit manager arguments',async()=> {
        const value=manager();value._initialized=false;await rejected(value.initializeWithConnectionManager({},undefined));await rejected(value.initializeWithConnectionManager(undefined,{}));
    });
    it('skips disabled, missing, destroyed and unconfigured health monitoring',async()=> {
        const value=manager();value.config=undefined;value.startHealthMonitoring();await value.performHealthCheck();value.config={enabled:true};value.connectionManager=undefined;await value.performHealthCheck();await value.destroy();await value.performHealthCheck();
    });
    it('triggers reconnection on total health failure but avoids duplicate active sessions',async()=> {
        const value=manager();const trigger=sinon.stub(value,'triggerReconnection').resolves(true);
        value.connectionManager.testAllConnections=async()=>({totalTested:2,healthyConnections:0});await value.performHealthCheck();expect(trigger.calledOnce).to.equal(true);
        value.currentSessionId='active';await value.performHealthCheck();expect(trigger.calledOnce).to.equal(true);
        value.connectionManager.testAllConnections=async()=>({totalTested:1,healthyConnections:1});await value.performHealthCheck();expect(value.lastSuccessfulConnectionTime).to.be.greaterThan(0);
    });
    for(const failure of [Error('health'),'health']) {
        it(`handles health-check and session exceptions (${typeof failure})`,async()=> {
            const value=manager();value.connectionManager.testAllConnections=async()=>{throw failure;};await value.performHealthCheck();
            sinon.stub(value,'executeReconnectionStrategy').rejects(failure as any);expect(await value.startReconnectionSession()).to.equal(false);
        });
    }
    it('runs health monitoring on its configured schedule',async()=> {
        const clock=sinon.useFakeTimers();const value=manager();value.config.healthCheckIntervalMs=10;const health=sinon.stub(value,'performHealthCheck').resolves();value.startHealthMonitoring();await clock.tickAsync(10);expect(health.calledOnce).to.equal(true);
    });
    it('tolerates stats reset during an active reconnection session',async()=> {
        const value=manager();sinon.stub(value,'executeReconnectionStrategy').callsFake(async()=>{value.resetStats();return true;});expect(await value.startReconnectionSession()).to.equal(true);expect(value.currentSessionId).to.equal(undefined);
    });
    it('returns false from strategies without required configuration',async()=> {
        const value=manager();value.config=undefined;expect(await value.executeReconnectionStrategy()).to.equal(false);expect(await value.attemptExponentialBackoffReconnection()).to.equal(false);expect(await value.attemptFixedIntervalReconnection()).to.equal(false);expect(await value.attemptCircuitBreakerReconnection()).to.equal(false);
        value.config={strategy:ReconnectionStrategy.IMMEDIATE};value.connectionManager=undefined;expect(await value.executeReconnectionStrategy()).to.equal(false);
    });
    it('falls back to exponential backoff for a custom strategy',async()=> {
        const value=manager();value.config.strategy='custom';expect(await value.executeReconnectionStrategy()).to.equal(true);
    });
    for(const method of ['attemptExponentialBackoffReconnection','attemptFixedIntervalReconnection']) {
        for(const stop of ['destroyed','circuit']) {
            it(`stops ${method} after ${stop}`,async()=> {
                const value=manager();sinon.stub(value,'performSingleReconnectionAttempt').callsFake(async()=>{if(stop==='destroyed')value.destroyed=true;else value.stats.circuitBreakerState=CircuitBreakerState.OPEN;return false;});expect(await value[method]()).to.equal(false);
            });
        }
    }
    it('does not probe an open circuit and records a failed half-open probe',async()=> {
        const value=manager();value.stats.circuitBreakerState=CircuitBreakerState.OPEN;expect(await value.attemptCircuitBreakerReconnection()).to.equal(false);
        value.stats.circuitBreakerState=CircuitBreakerState.HALF_OPEN;value.connectionManager.getConnection=async()=>{throw Error('offline');};expect(await value.attemptCircuitBreakerReconnection()).to.equal(false);expect(value.circuitBreakerFailureCount).to.equal(1);
    });
    for(const failure of [new ConnectionError('typed'),'raw']) {
        it(`preserves failed attempt details for ${typeof failure}`,async()=> {
            const value=manager();value.config=undefined;value.connectionManager.getConnection=async()=>{throw failure;};expect(await value.performSingleReconnectionAttempt(1,0)).to.equal(false);expect(value.stats.lastAttempt.error.message).to.include(failure instanceof Error?'typed':'raw');
        });
    }
    it('computes reconnection duration from successful attempts',async()=> {
        const clock=sinon.useFakeTimers();const value=manager();value.connectionManager.getConnection=async()=>({execute:async()=>{await clock.tickAsync(5);}});
        expect(await value.performSingleReconnectionAttempt(1,0)).to.equal(true);expect(value.getStats().averageReconnectionTimeMs).to.equal(5);
    });
    it('continues delivery after event listener exceptions',()=> {
        const value=manager();for(const failure of [Error('listener'),'listener']){value.on(ConnectionEvent.CONNECTED,()=>{throw failure;});value.once(ConnectionEvent.CONNECTED,()=>{throw failure;});}value.emit(ConnectionEvent.CONNECTED);expect(value.onceListeners.get(ConnectionEvent.CONNECTED).size).to.equal(0);
        value.emit('unknown');value.off('unknown',()=>{});
    });
    it('ignores configuration updates if initialized state has no configuration',()=> {
        const value=manager();value.config=undefined;value.updateConfig({maxRetries:1});expect(value.getConfig()).to.equal(undefined);
    });
    it('does not reopen a manually reset circuit after cooldown',async()=> {
        const clock=sinon.useFakeTimers();const value=manager();value.config.circuitBreakerCooldownMs=10;value.openCircuitBreaker();value.resetCircuitBreaker();await clock.tickAsync(10);expect(value.stats.circuitBreakerState).to.equal(CircuitBreakerState.CLOSED);
    });
});

describe('Reconnection fallback boundaries',()=> {
    afterEach(async()=>{for(const value of managers.splice(0))await value.destroy();sinon.restore();});
    it('clears initialized one-shot listener collections',()=> {
        const emitter=new ModuleEventEmitterImpl<string>();emitter.once('only',()=>{});emitter.removeAllListeners('only');expect(emitter.listenerCount('only')).to.equal(0);
    });
    it('uses the default circuit-breaker failure threshold',()=> {
        const value=manager();value.config.strategy=ReconnectionStrategy.CIRCUIT_BREAKER;value.config.circuitBreakerThreshold=undefined;
        for(let count=0;count<5;count++)value.recordFailure();expect(value.stats.circuitBreakerState).to.equal(CircuitBreakerState.OPEN);
    });
    for(const strategy of [ReconnectionStrategy.IMMEDIATE,ReconnectionStrategy.CIRCUIT_BREAKER,ReconnectionStrategy.FIXED_INTERVAL]) {
        it(`calculates the delay for ${strategy}`,()=> {
            const value=manager();value.config.strategy=strategy;expect(value.calculateDelay(3)).to.equal(strategy===ReconnectionStrategy.FIXED_INTERVAL?1:0);
        });
    }
    it('rejects repeated explicit initialization',async()=> {
        const value=manager();await rejected(value.initializeWithConnectionManager({},{}));
    });
    it('handles a non-Error strategy exception',async()=> {
        const value=manager();sinon.stub(value,'executeReconnectionStrategy').callsFake(async()=>{throw 'raw';});expect(await value.startReconnectionSession()).to.equal(false);
    });
    it('accepts a successful half-open circuit probe',async()=> {
        const value=manager();value.stats.circuitBreakerState=CircuitBreakerState.HALF_OPEN;expect(await value.attemptCircuitBreakerReconnection()).to.equal(true);
    });
    it('replaces an existing circuit cooldown timer',async()=> {
        const clock=sinon.useFakeTimers();const value=manager();value.config.circuitBreakerCooldownMs=10;value.openCircuitBreaker();value.openCircuitBreaker();await clock.tickAsync(10);expect(value.stats.circuitBreakerState).to.equal(CircuitBreakerState.HALF_OPEN);
    });
    it('does not schedule retry delays after destruction',async()=> {
        const value=manager();await value.destroy();await value.wait(1000);expect(await value.performSingleReconnectionAttempt(1,0)).to.equal(false);
    });
});
