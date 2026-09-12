import {expect} from 'chai';
import {rejects} from 'node:assert/strict';
import sinon from 'sinon';
import fs from 'node:fs';
import {syncBuiltinESMExports} from 'node:module';
import {resolve} from 'node:path';
import {HSQLManager,DEFAULT_CONFIG,ManagerState} from '../../src/core/HSQLManager.js';
import {ConfigurationError} from '../../src/core/errors.js';

const configuration=()=>({starmadeDir:resolve('tests/sandbox'),worldName:'test_world',modules:Object.fromEntries(Object.keys(DEFAULT_CONFIG.modules).map(key=>[key,false])),logging:{enableConsole:false,enableFile:false,level:'error' as const}});
const silent=()=>({info:sinon.spy(),debug:sinon.spy(),warn:sinon.spy(),error:sinon.spy()});
function manager(){const m:any=new HSQLManager(configuration());m.logger=silent();return m;}
const specifications=[['connection/ConnectionManager','ConnectionManager'],['connection/ReconnectionManager','ReconnectionManager'],['cache/CacheManager','CacheManager'],['cache/CacheOptimizer','CacheOptimizer'],['performance/MetricsCollector','MetricsCollector'],['performance/PerformanceMonitor','PerformanceMonitor'],['cache/CacheStatsCollector','CacheStatsCollector'],['transactions/TransactionManager','TransactionManager'],['query/QueryValidator','QueryValidator'],['query/ParameterizedQuery','ParameterizedQuery'],['schema/SchemaAnalyzer','SchemaAnalyzer'],['schema/RelationshipAnalyzer','RelationshipAnalyzer'],['schema/DatabaseReporter','DatabaseReporter']];
const constructors:any[]=[];
before(async()=>{for(const [path,name] of specifications){const module=await import(`../../src/core/modules/${path}.js`);constructors.push(module[name]);}});
function stubModules(failure?:unknown){
    for(const Constructor of constructors){
        sinon.stub(Constructor.prototype,'initialize').callsFake(async function(this:any,m:any){if(failure!==undefined)throw failure;this._initialized=true;this.initialized=true;if(this.name==='cache-stats-collector')m.registerModule(this);});
        sinon.stub(Constructor.prototype,'destroy').resolves();
    }
    sinon.stub(constructors[3].prototype,'setCacheManager').callsFake(function(this:any,cache:any){this.cacheManager=cache;});
}

describe('Manager configuration isolation',()=>{
    afterEach(()=>{sinon.restore();syncBuiltinESMExports();});
    it('isolates constructor inputs and configuration snapshots from internal security policy',async()=>{
        const supplied:any={...configuration(),security:{allowedOperations:['SELECT']}};const m:any=new HSQLManager(supplied);
        supplied.security.allowedOperations.push('DROP');expect(m.getConfiguration().security.allowedOperations).to.deep.equal(['SELECT']);
        const snapshot=m.getConfiguration();snapshot.connection.readOnly=false;snapshot.security.allowedOperations.push('DELETE');
        expect(m.getConfiguration().connection.readOnly).to.equal(true);expect(m.getConfiguration().security.allowedOperations).to.deep.equal(['SELECT']);
        await m.destroy();
    });
    it('handles missing fields, invalid filesystem paths and thrown validation errors',()=>{
        expect(()=>new HSQLManager({...configuration(),starmadeDir:''})).to.throw('directory is required');
        expect(()=>new HSQLManager({...configuration(),worldName:''})).to.throw('World name is required');
        expect(()=>new HSQLManager({...configuration(),starmadeDir:'/missing-starmade-test'})).to.throw('Invalid StarMade directory');
        const exists=sinon.stub(fs,'existsSync').callsFake(()=>{throw 'filesystem';});syncBuiltinESMExports();
        expect(()=>new HSQLManager(configuration())).to.throw('filesystem');exists.restore();syncBuiltinESMExports();
    });
});

describe('Manager module loading boundaries',()=>{
    afterEach(()=>sinon.restore());
    it('registers each initialized module once and wires cache dependencies',async()=>{
        stubModules();const m=manager();Object.keys(m.config.modules).forEach(key=>m.config.modules[key]=true);
        await m.initialize();expect(m.getStatus().state).to.equal(ManagerState.READY);expect(m.modules.size).to.equal(13);
        expect(m.getModule('cache-optimizer').cacheManager).to.equal(m.getModule('cache-manager'));
        expect(m.getModule('cache-stats-collector').cacheManager).to.equal(m.getModule('cache-manager'));
        expect(m.logger.error.callCount).to.equal(0);await m.destroy();expect(m.modules.size).to.equal(0);
    });
    it('propagates critical initialization failures and logs optional module failures',async()=>{
        for(const failure of [new Error('module failure'),'module failure']){
            stubModules(failure);const m=manager();Object.keys(m.config.modules).forEach(key=>m.config.modules[key]=true);
            await rejects(m.initialize(),/module failure/);expect(m.getStatus().state).to.equal(ManagerState.ERROR);expect(m.logger.error.callCount).to.equal(2);
            await m.destroy();sinon.restore();
            stubModules(failure);const optional=manager();Object.keys(optional.config.modules).forEach(key=>optional.config.modules[key]=true);optional.config.modules.enableConnectionFactory=false;
            await optional.initialize();expect(optional.modules.size).to.equal(0);expect(optional.logger.error.callCount).to.equal(12);await optional.destroy();sinon.restore();
        }
    });
    it('allows initialized consumers to remain without missing optional cache dependencies',async()=>{
        stubModules();constructors[2].prototype.initialize.callsFake(async()=>{throw new Error('cache');});constructors[4].prototype.initialize.callsFake(async()=>{throw new Error('metrics');});
        const m=manager();m.config.modules.enableAdvancedCaching=true;m.config.modules.enableMetricsCollection=true;
        await m.initialize();expect(m.getModule('cache-manager')).to.equal(undefined);expect(m.getModule('metrics-collector')).to.equal(undefined);
        expect(m.getModule('cache-optimizer')).not.to.equal(undefined);expect(m.getModule('cache-stats-collector')).not.to.equal(undefined);await m.destroy();
    });
});

describe('Manager logging and cleanup failure boundaries',()=>{
    afterEach(()=>{sinon.restore();syncBuiltinESMExports();});
    it('supplies default logging fields and exposes functional fallback logger methods',async()=>{
        const m=manager();const logs=Object.fromEntries(['log','error','warn','info','debug'].map(level=>[level,sinon.stub(console,level as any)]));
        m.config.logging={};m.initializeLogging();expect(m.loggerInitialized).to.equal(true);
        m.config.logging=null;m.initializeLogging();expect(m.loggerInitialized).to.equal(false);expect(logs.warn.called).to.equal(true);
        for(const level of ['error','warn','info','debug']){m.logger[level]('message',{id:1});expect(logs[level].lastCall.args[0]).to.include(level.toUpperCase());}
        m.logger.query('VALUES 1',5,{id:1});m.logger.connection('acquired','id',{id:1});m.logger.performance('latency',5,{id:1});
        expect(logs.log.getCalls().map((call:any)=>call.args[0])).to.deep.equal(['[HSQLManager] QUERY: VALUES 1 (5ms)','[HSQLManager] CONNECTION: acquired id','[HSQLManager] PERFORMANCE: latency=5']);
        m.config.logging={};await m.destroy();
    });
    it('wraps initialization and world-validation errors while preserving domain errors',async()=>{
        for(const failure of [new Error('world'),'world',new ConfigurationError('world')]){
            const m=manager();sinon.stub(m,'validateWorld').callsFake(async()=>{throw failure;});
            await rejects(m.initialize(),/world/);expect(m.getStatus().state).to.equal(ManagerState.ERROR);expect((await m.healthCheck()).healthy).to.equal(false);await m.destroy();
        }
        const missing=manager();missing.config.worldName='nonexistent-world';await rejects(missing.initialize(),/not found/);await missing.destroy();
        for(const failure of [new Error('discovery'),'discovery']){
            const m=manager();m.logger.debug=(_message:any,context:any)=>{if(context.operation==='detect-worlds')throw failure;};
            await rejects(m.validateWorld(),/Failed to validate world/);await m.destroy();
        }
    });
    it('reports module cleanup failures and keeps other modules reachable for cleanup',async()=>{
        for(const failure of [new Error('destroy'),'destroy']){
            const m=manager();const completed=sinon.spy();
            m.registerModule({name:'query-validator',version:'1',destroy:async()=>{throw failure;}});
            m.registerModule({name:'custom-failure',version:'1',destroy:async()=>{throw failure;}});
            m.registerModule({name:'custom-success',version:'1',destroy:async()=>{completed();}});
            await rejects(m.unregisterModule('custom-failure'));
            await m.destroy();expect(completed.callCount).to.equal(1);expect(m.logger.error.callCount).to.equal(2);
            expect(m.logger.warn.getCalls().filter((call:any)=>call.args[1].operation==='destroy-remaining-module-error')).to.have.length(2);
        }
    });
    it('wraps synchronous extension cleanup failures and supports a later cleanup retry',async()=>{
        for(const failure of [new Error('plugin'),'plugin']){
            const m=manager();const plugin={name:'extension',version:'1',destroy:()=>{throw failure;}};
            m.registerModule(plugin);await rejects(m.destroy(),/Failed to destroy manager/);expect(m.getStatus().state).to.equal(ManagerState.ERROR);
            plugin.destroy=async()=>{};await m.destroy();expect(m.getStatus().state).to.equal(ManagerState.DESTROYED);
        }
    });
});

describe('Manager public lifecycle contracts',()=>{
    afterEach(()=>sinon.restore());
    it('exposes a locked file database URL, rejects duplicate registration and permits repeated destruction',async()=>{
        const m=manager();expect(m.getDatabaseUrl()).to.include('jdbc:hsqldb:file:');expect(m.getDatabaseUrl()).to.include('readonly=true');
        const plugin={name:'unique',version:'1',destroy:async()=>{}};m.registerModule(plugin);expect(()=>m.registerModule(plugin)).to.throw('already registered');
        await m.destroy();await m.destroy();expect(m.getStatus().state).to.equal(ManagerState.DESTROYED);
    });
    it('registers a statistics collector that delegates registration to its manager',async()=>{
        stubModules();constructors[6].prototype.initialize.callsFake(async function(this:any){this._initialized=true;});
        const m=manager();m.config.modules.enableAdvancedCaching=true;m.config.modules.enableMetricsCollection=true;
        await m.initialize();expect(m.getModule('cache-stats-collector')).to.be.instanceOf(constructors[6]);expect(m.logger.error.callCount).to.equal(0);await m.destroy();
    });
});
