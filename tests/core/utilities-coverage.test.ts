import {expect} from 'chai';
import {describe, it, afterEach} from 'mocha';
import sinon from 'sinon';
import fs from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import * as utils from '../../src/core/utils.js';
import {ModuleEventEmitterImpl, isEventEmitter, forwardEvents, globalEventBus} from '../../src/core/events.js';

/** Boundary tests for filesystem discovery and asynchronous helpers. */
describe('Utility boundaries', () => {
    afterEach(() => sinon.restore());
    it('discovers worlds and ignores missing, empty, unreadable and non-directory paths', async () => {
        const root = fs.mkdtempSync(join(tmpdir(), 'starmade-discovery-'));
        try {
            expect(await utils.detectStarMadeInstallation([])).to.deep.equal({found: false, availableWorlds: []});
            expect(await utils.detectStarMadeInstallation([root, join(root, 'absent')])).to.deep.equal({found: false, availableWorlds: []});
            expect(() => utils.validateStarMadeDirectory(root)).to.throw('server-database');
            const index = join(root, 'server-database', 'world', 'index');
            fs.mkdirSync(index, {recursive: true});
            fs.writeFileSync(join(index, '.script'), '');
            fs.writeFileSync(join(root, 'server-database', 'file'), '');
            expect(await utils.detectStarMadeInstallation([root])).to.deep.equal({found: true, path: root, availableWorlds: ['world']});
            expect(utils.isValidWorldDirectory(join(root, 'server-database', 'file'))).to.equal(false);
            sinon.stub(fs, 'existsSync').throws(new Error('denied'));
            expect(await utils.detectStarMadeInstallation()).to.deep.equal({found: false, availableWorlds: []});
            expect(utils.isValidWorldDirectory(root)).to.equal(false);
        } finally {sinon.restore(); fs.rmSync(root, {recursive: true, force: true});}
    });
    it('recognizes each database sidecar and handles inaccessible directory listings', async () => {
        const root=fs.mkdtempSync(join(tmpdir(),'starmade-sidecars-'));
        try {
            expect(utils.isValidWorldDirectory(join(root,'missing'))).to.equal(false);
            expect(()=>utils.validateStarMadeDirectory(join(root,'missing'))).to.throw('does not exist');
            expect(utils.isValidWorldDirectory(root)).to.equal(false);
            fs.mkdirSync(join(root,'index'));
            expect(utils.isValidWorldDirectory(root)).to.equal(false);
            for(const extension of ['.properties','.data']) {
                fs.writeFileSync(join(root,'index',extension),'');
                expect(utils.isValidWorldDirectory(root)).to.equal(true);
                fs.unlinkSync(join(root,'index',extension));
            }
            sinon.stub(fs,'existsSync').throws(Error('denied'));
            expect(await utils.detectAvailableWorlds(root)).to.deep.equal([]);
        } finally {sinon.restore();fs.rmSync(root,{recursive:true,force:true});}
    });
    it('rejects invalid retry delays and preserves the last Error instance', async () => {
        for(const delay of [-1,Infinity]) {
            let error:unknown;try{await utils.retry(async()=>1,1,delay);}catch(e){error=e;}
            expect(error).to.be.instanceOf(RangeError);
        }
        const failure=new Error('last');let error:unknown;
        try{await utils.retry(async()=>{throw failure;},1);}catch(e){error=e;}
        expect(error).to.equal(failure);
    });

    it('formats every duration unit at its boundary', () => {
        for (const [ms, expected] of [[0,'0ms'],[999,'999ms'],[1000,'1.0s'],[60000,'1.0m'],[3600000,'1.0h']] as const)
            expect(utils.formatDuration(ms)).to.equal(expected);
    });
    it('retries with increasing delays, preserves errors and normalizes thrown values', async () => {
        const clock = sinon.useFakeTimers();
        let calls = 0;
        const pending = utils.retry(async () => {if (++calls < 3) throw new Error('again'); return 42;});
        await clock.tickAsync(999); expect(calls).to.equal(1);
        await clock.tickAsync(1); expect(calls).to.equal(2);
        await clock.tickAsync(2000); expect(await pending).to.equal(42);
        let error: unknown;
        try { await utils.retry(async () => {throw 'failed';}, 1, 0); } catch(e) {error=e;}
        expect(error).to.be.instanceOf(Error).with.property('message', 'failed');
    });
    it('rejects invalid retry counts before invoking work', async () => {
        for (const maxAttempts of [0,-1,NaN,1.5]) {
            let called = false; let error: unknown;
            try {await utils.retry(async () => {called=true;}, maxAttempts);} catch(e) {error=e;}
            expect(called).to.equal(false);
            expect(error).to.be.instanceOf(RangeError);
        }
    });
    it('debounces to the most recent arguments', async () => {
        const clock=sinon.useFakeTimers(); const calls: number[]=[];
        const fn=utils.debounce((v: number)=>calls.push(v), 20);
        fn(1); await clock.tickAsync(10); fn(2); await clock.tickAsync(19);
        expect(calls).to.deep.equal([]); await clock.tickAsync(1); expect(calls).to.deep.equal([2]);
    });
    it('cleans every registered resource even when one destroy fails', async () => {
        const cleaner={...utils.resourceCleaner, resources: new Set<any>()};
        const failure=sinon.stub(console,'error'); const destroyed: string[]=[];
        cleaner.register({destroy: async()=>{destroyed.push('a'); throw Error('failed');}});
        cleaner.register({destroy: async()=>{destroyed.push('b');}});
        await cleaner.cleanup(); expect(destroyed).to.deep.equal(['a','b']);
        expect(cleaner.resources.size).to.equal(0); expect(failure.calledOnce).to.equal(true);
    });
});

describe('Event utility boundaries', () => {
    it('recognizes the complete emitter contract', () => {
        const methods=['on','once','off','emit','removeAllListeners','listenerCount','eventNames'];
        const object: any={};
        expect(isEventEmitter(null)).to.equal(false);
        for(const method of methods) {expect(isEventEmitter(object)).to.equal(false); object[method]=()=>{};}
        expect(isEventEmitter(object)).to.equal(true);
    });
    it('forwards original and prefixed events and detaches cleanly', () => {
        const source=new ModuleEventEmitterImpl<string>(); const target=new ModuleEventEmitterImpl<string>();
        const received: any[]=[];
        target.on('changed',(_,data)=>received.push(data)); target.on('db-changed',(_,data)=>received.push(data));
        const off=forwardEvents(source,target,['changed']); const offPrefix=forwardEvents(source,target,['changed'],'db');
        source.emit('changed',{id:1}); expect(received.map(e=>e.id)).to.deep.equal([1,1]);
        off(); offPrefix(); source.emit('changed',{id:2}); expect(received).to.have.length(2);
        source.destroy(); target.destroy();
    });
    it('isolates throwing listeners and removes a numeric event without clearing other events', () => {
        const logger=new Proxy({}, {get:()=>()=>{}});
        const emitter=new ModuleEventEmitterImpl<number>(logger as any);
        emitter.on(0,()=>{throw 'failure';});emitter.once(0,()=>{throw new Error('failure');});
        emitter.once(1,()=>{});expect(emitter.eventNames()).to.include(1);
        expect(()=>emitter.emit(0)).not.to.throw();
        emitter.removeAllListeners(0);expect(emitter.listenerCount(1)).to.equal(1);
        emitter.removeAllListeners(2);emitter.emit(1);expect(emitter.eventNames()).to.deep.equal([]);
        emitter.once(2,()=>{throw 'failure';});expect(()=>emitter.emit(2)).not.to.throw();
        emitter.destroy();
    });

    it('subscribes the global bus to a module and supplies global event metadata', () => {
        const source=new ModuleEventEmitterImpl<string>(); const noop=()=>{}; source.on('changed',noop);
        const received: any[]=[]; const listener=(_: any,data: any)=>received.push(data);
        globalEventBus.on('unit-changed',listener);
        const off=globalEventBus.subscribeToModule('unit',source);
        source.emit('changed',{id:3}); expect(received.map(e=>e.id)).to.deep.equal([3]);
        globalEventBus.on('unit-global',listener); globalEventBus.emitGlobal('unit-global',{id:4});
        expect(received[1]).to.include({id:4,source:'GlobalEventBus',type:'global-event'});
        expect(received[1].timestamp).to.be.instanceOf(Date);
        off(); source.destroy(); globalEventBus.off('unit-changed',listener); globalEventBus.off('unit-global',listener);
    });
});
