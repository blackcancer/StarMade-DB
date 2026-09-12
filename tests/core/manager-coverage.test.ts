import {expect} from 'chai';
import {describe,it,afterEach} from 'mocha';
import sinon from 'sinon';
import {resolve} from 'node:path';
import {HSQLManager,DEFAULT_CONFIG,ManagerState} from '../../src/core/HSQLManager.js';
import {ConfigurationError} from '../../src/core/errors.js';

const config=()=>({starmadeDir:resolve('tests/sandbox'),worldName:'test_world',
    modules:Object.fromEntries(Object.keys(DEFAULT_CONFIG.modules).map(key=>[key,false])),
    logging:{enableConsole:false,enableFile:false,level:'error' as const}});
async function rejected(fn:()=>Promise<any>){let error:unknown;try{await fn();}catch(e){error=e;}expect(error).to.be.instanceOf(Error);return error;}

describe('Manager lifecycle boundaries',()=>{
    afterEach(()=>sinon.restore());
    it('creates a ready manager, checks health and unregisters owned modules',async()=>{
        const manager=await HSQLManager.create(config());
        try{
            expect((await manager.healthCheck()).healthy).to.equal(true);
            let closed=0;
            manager.registerModule({name:'unit-module',version:'1',isInitialized:true,initialize:async()=>{},destroy:async()=>{closed++;}});
            await manager.unregisterModule('unit-module');expect(closed).to.equal(1);expect(manager.getModule('unit-module')).to.equal(undefined);
            await manager.unregisterModule('missing');
            manager.registerModule({name:'broken',version:'1',isInitialized:true,initialize:async()=>{},destroy:async()=>{throw new Error('failed');}});
            expect((await rejected(()=>manager.unregisterModule('broken')) as Error).message).to.equal('failed');
            expect(manager.getModule('broken')).not.to.equal(undefined);
            (manager as any).modules.delete('broken');
        }finally{await manager.destroy();}
        const health=await manager.healthCheck();expect(health.healthy).to.equal(false);expect(health.issues[0]).to.include('not ready');
        await rejected(()=>manager.initialize());
    });
    it('includes initialization errors in health diagnostics',async()=>{
        const manager:any=new HSQLManager(config());
        manager.lastError=new ConfigurationError('invalid options');
        const health=await manager.healthCheck();expect(health.issues).to.have.length(2);expect(health.issues[1]).to.include('invalid options');
        manager.state=ManagerState.INITIALIZING;await rejected(()=>manager.initialize());
        await manager.destroy();
    });
    it('falls back to console logging with level filtering and optional context',async()=>{
        const manager:any=new HSQLManager(config());
        const info=sinon.stub(console,'info'); const debug=sinon.stub(console,'debug');
        manager.loggerInitialized=false;manager.config.logging.logLevel='info';
        manager.log('debug','hidden');expect(debug.called).to.equal(false);
        manager.log('info','visible');expect(info.firstCall.args[0]).to.include('visible');
        manager.config.logging.logLevel=undefined;manager.log('info','context',{id:1});expect(info.secondCall.args[1]).to.deep.equal({id:1});
        const logged:any[]=[];manager.logger={info:(...args:any[])=>logged.push(args),debug:()=>{},warn:()=>{},error:()=>{}};
        manager.loggerInitialized=true;manager.log('info','direct',{id:2});expect(logged[0]).to.deep.equal(['direct',{id:2}]);
        await manager.destroy();
    });
});
