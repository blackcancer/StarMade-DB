import { expect } from 'chai';
import sinon from 'sinon';
import { ReconnectionManager, ReconnectionStrategy, ModuleEventEmitterImpl } from '../../../../src/core/modules/connection/ReconnectionManager.js';

const logger=new Proxy({}, {get:()=>()=>{}});
function manager():any {const value:any=new ReconnectionManager();value.logger=logger;value._initialized=true;value.config={enabled:true,strategy:ReconnectionStrategy.CIRCUIT_BREAKER,maxRetries:1,baseDelayMs:1,maxDelayMs:10,circuitBreakerThreshold:1,circuitBreakerCooldownMs:100,resetOnSuccess:true};value.initializeEventListeners();return value;}

describe('Reconnection lifecycle regressions',()=> {
    afterEach(()=>sinon.restore());
    it('releases an acquired lease even when the validation query fails',async()=> {
        const value=manager();let releases=0;value.connectionManager={getConnection:async()=>({execute:async()=>{throw Error('bad query');}}),releaseConnection:async()=>{releases++;}};
        expect(await value.performSingleReconnectionAttempt(1,0)).to.equal(false);expect(releases).to.equal(1);await value.destroy();
    });
    it('counts a failed circuit-breaker attempt exactly once',async()=> {
        const value=manager();value.connectionManager={getConnection:async()=>{throw Error('offline');}};
        expect(await value.triggerReconnection()).to.equal(false);
        expect(value.getStats().failedReconnections).to.equal(1);expect(value.getStats().failureRate).to.equal(100);await value.destroy();
    });
    it('clears the circuit-breaker cooldown timer on destroy',async()=> {
        const clock=sinon.useFakeTimers({toFake:['Date','setTimeout','clearTimeout','setInterval','clearInterval']});const value=manager();
        value.openCircuitBreaker();await value.destroy();expect(clock.countTimers()).to.equal(0);
    });
    it('removes only event zero rather than all events',()=> {
        const emitter=new ModuleEventEmitterImpl<number>();let calls=0;emitter.on(0,()=>calls++);emitter.on(1,()=>calls++);
        emitter.removeAllListeners(0);emitter.emit(1);expect(calls).to.equal(1);emitter.destroy();
    });
});

describe('Reconnection retry ownership',()=> {
    afterEach(()=>sinon.restore());
    it('cancels retry sleep on destroy without starting another JDBC attempt',async()=> {
        const clock=sinon.useFakeTimers({toFake:['Date','setTimeout','clearTimeout','setInterval','clearInterval']});
        const value=manager();value.config.strategy=ReconnectionStrategy.FIXED_INTERVAL;value.config.maxRetries=2;value.config.baseDelayMs=1000;let attempts=0;
        value.connectionManager={getConnection:async()=>{attempts++;throw Error('offline');}};
        const result=value.triggerReconnection();await clock.tickAsync(0);await value.destroy();
        expect(clock.countTimers()).to.equal(0);expect(await result).to.equal(false);expect(attempts).to.equal(1);
    });
    it('shares one reconnection attempt between simultaneous triggers',async()=> {
        const value=manager();let calls=0;let resolve!:(value:any)=>void;const pending=new Promise(r=>resolve=r);
        value.connectionManager={getConnection:()=>{calls++;return pending;},releaseConnection:async()=>{}};
        const first=value.triggerReconnection();const second=value.triggerReconnection();
        resolve({execute:async()=>{}});expect(await first).to.equal(true);expect(await second).to.equal(true);expect(calls).to.equal(1);await value.destroy();
    });
});
