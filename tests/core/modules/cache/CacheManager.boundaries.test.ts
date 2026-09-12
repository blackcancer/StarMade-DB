import {expect} from 'chai';
import {rejects} from 'node:assert/strict';
import sinon from 'sinon';
import {CacheManager} from '../../../../src/core/modules/cache/CacheManager.js';

describe('Cache capacity and lifecycle boundaries',()=>{
    afterEach(()=>sinon.restore());
    it('evicts the least recently accessed entry at count capacity and accounts for expired values',async()=>{
        const c:any=new CacheManager(); c.logger={debug:sinon.spy(),info:sinon.spy(),warn:sinon.spy(),error:sinon.spy()};
        expect(()=>c.buildConfiguration()).to.throw('Manager not set');
        expect(c.getConfiguration()).to.equal(undefined);
        for(const method of ['delete','has','keys','cleanup']) await rejects(c[method]('missing'));
        await c.initialize({getConfiguration:()=>({})}); c.config.maxEntries=2;
        await c.set('first',1); await c.set('second',2); await c.get('first'); await c.set('third',3);
        expect(await c.keys()).to.deep.equal(['first','third']); expect(c.getStats().evictionCount).to.equal(1);
        c.cache.get('first').expiresAt=new Date(0); expect(await c.has('first')).to.equal(false);
        c.cache.get('third').expiresAt=new Date(0); expect(await c.cleanup()).to.deep.equal({expired:1,evicted:0});
        expect(c.getStats().totalSizeBytes).to.equal(0); expect(c.eventNames()).to.deep.equal([]);
        const fail=sinon.stub(c,'ensureCapacity').callsFake(async()=>{throw 'invalid size';}); await rejects(c.set('bad','value'),/Failed to cache/); fail.rejects(new Error('invalid size')); await rejects(c.set('bad','value'),/Failed to cache/); fail.restore();
        await c.set('pressure','some bytes'); c.config.maxSizeBytes=c.currentSizeBytes; const cleaned=await c.cleanup(); expect(cleaned.evicted).to.equal(1); expect(c.getStats().totalEntries).to.equal(0);
        await c.destroy(); await c.destroy();
    });
    it('replaces cleanup timers and reports both Error and non-Error callback failures',async()=>{
        const clock=sinon.useFakeTimers(); const c:any=new CacheManager(); c.logger={debug:sinon.spy(),info:sinon.spy(),warn:sinon.spy(),error:sinon.spy()};
        await c.initialize({getConfiguration:()=>({})}); c.config.cleanupInterval=10;
        const cleanup=sinon.stub(c,'performCleanup').rejects(new Error('cleanup')); c.startCleanupTimer(); await clock.tickAsync(10);
        cleanup.callsFake(async()=>{throw 'cleanup';}); await clock.tickAsync(10); expect(cleanup.callCount).to.equal(2); expect(c.logger.warn.callCount).to.equal(2);
        await c.destroy(); await clock.tickAsync(20); expect(cleanup.callCount).to.equal(2);
    });
});
