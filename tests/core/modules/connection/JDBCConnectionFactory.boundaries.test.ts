import { expect } from 'chai';
import sinon from 'sinon';
import { JDBCConnectionFactory } from '../../../../src/core/modules/connection/JDBCConnectionFactory.js';
import { QueryTimeoutError } from '../../../../src/core/errors.js';

// Fork isolated JVM bootstrap fixtures during module loading, before native test hooks start Java.
const bootstrapResults=new Map<string,unknown>();
for(const mode of ['missing','raw','fallback']) {
    try {
            const {spawn}=await import('node:child_process');const {createRequire}=await import('node:module');const require=createRequire(import.meta.url);
            const source=new URL('../../../../src/core/modules/connection/JDBCConnectionFactory.ts',import.meta.url).href;
            const code=`import fs from 'node:fs';import {syncBuiltinESMExports} from 'node:module';import assert from 'node:assert/strict';
                import {JDBCConnectionFactory} from ${JSON.stringify(source)};
                const mode=${JSON.stringify(mode)};delete process.env.HSQLDB_JAR;
                fs.existsSync=path=>{if(mode==='raw')throw 'raw fs';return mode==='fallback'&&String(path).endsWith('/src/lib/hsqldb.jar');};syncBuiltinESMExports();
                const f=new JDBCConnectionFactory();f.logger=new Proxy({},{get:()=>()=>{}});
                if(mode==='fallback'){await f.initialize({});assert.equal(f.isInitialized,true);}
                else {await assert.rejects(f.initialize({}),/Failed to configure JVM/);assert.equal(f.isInitialized,false);}await f.diagnoseConnectionReadiness();await f.destroy();process.exit(0);`;
            await new Promise<void>((resolve,reject)=>{const child=spawn(process.execPath,['--import',require.resolve('tsx/esm'),'--input-type=module','-e',code],{env:{...process.env},timeout:10000,killSignal:'SIGKILL',stdio:['ignore','pipe','pipe']});let output='';child.stderr.on('data',chunk=>output+=chunk);child.on('error',reject);child.on('close',status=>status===0?resolve():reject(Error(output||'Bootstrap process failed: '+status)));});
        bootstrapResults.set(mode,null);
    } catch(error) {bootstrapResults.set(mode,error);}
}

const logger=new Proxy({}, {get:()=>()=>{}});
async function rejected(promise:Promise<any>):Promise<any> {let error;try{await promise;}catch(e){error=e;}expect(error).to.be.instanceOf(Error);return error;}
async function fixture(config:any={}):Promise<any> {
    const raw:any={setAutoCommitPromise:async()=>{},setReadOnlyPromise:async()=>{},getAutoCommitPromise:async()=>false,isReadOnlyPromise:async()=>false,getTransactionIsolationPromise:async()=>2,rollbackPromise:async()=>{},setTransactionIsolationPromise:async()=>{}};
    const wrapped:any={conn:raw,commit:async()=>{},close:async()=>{}};
    const reservation={conn:wrapped};const pool:any={pool:[],reserved:[reservation],reserve:async()=>reservation,release:async()=>{}};
    const factory:any=new JDBCConnectionFactory();factory._initialized=true;factory.logger=logger;factory.getPool=async()=>pool;
    const connection:any=await factory.createConnection({url:'jdbc:hsqldb:mem:boundaries',autoCommit:true,timeoutMs:1000,...config});
    return {raw,wrapped,reservation,pool,factory,connection};
}

describe('JDBC native session boundaries',()=> {
    afterEach(()=>sinon.restore());
    for(const failure of [Error('native failure'),'native failure']) {
        for(const [method,native,args] of [
            ['setAutoCommit','setAutoCommitPromise',[false]],['setReadOnly','setReadOnlyPromise',[true]],
            ['setTransactionIsolation','setTransactionIsolationPromise',[8]],['rollback','rollbackPromise',[]]
        ] as const) {
            it(`wraps ${method} native failures (${typeof failure})`,async()=> {
                const {connection,raw}=await fixture();raw[native]=async()=>{throw failure;};
                expect((await rejected(connection[method](...args))).message).to.include('native failure');
            });
        }
        it(`wraps commit errors and reports ping errors (${typeof failure})`,async()=> {
            const {connection,wrapped}=await fixture();wrapped.commit=async()=>{throw failure;};
            await rejected(connection.commit());connection.execute=async()=>{throw failure;};expect(await connection.ping()).to.equal(false);
        });
        it(`handles reservation and release failures (${typeof failure})`,async()=> {
            const {connection,pool}=await fixture();pool.release=async()=>{throw failure;};await connection.close();expect(connection.isActive).to.equal(false);
            pool.reserve=async()=>{throw failure;};await rejected(connection.connect());
        });
    }
    for(const absent of [false,true]) {
        it(`rejects operations on unavailable native sessions (missing handle ${absent})`,async()=> {
            const {connection}=await fixture();if(absent)connection.conn=null;else connection.isActive=false;
            for(const [method,args] of [['execute',['SELECT 1']],['getSessionState',[]],['setAutoCommit',[true]],['commit',[]],['rollback',[]],['setTransactionIsolation',[2]],['setReadOnly',[true]],['createStatement',[]]] as const)
                await rejected(connection[method](...args));
        });
    }
    it('skips rollback when auto-commit is already enabled',async()=> {
        const {connection,raw}=await fixture();raw.getAutoCommitPromise=async()=>true;const rollback=sinon.spy(raw,'rollbackPromise');await connection.rollback();expect(rollback.called).to.equal(false);
    });
    it('discards a detached reservation and makes repeated disposal harmless',async()=> {
        const {connection,wrapped}=await fixture();const close=sinon.spy(wrapped,'close');connection.sharedPool=undefined;await connection.discard();await connection.discard();expect(close.calledOnce).to.equal(true);
    });
    it('releases a detached wrapper without a pool',async()=> {
        const {connection}=await fixture();connection.sharedPool=undefined;await connection.close();expect(connection.conn).to.equal(null);await connection.close();
    });
    it('catches connection errors from an overridden connect implementation',async()=> {
        const {connection,factory}=await fixture();sinon.stub(Object.getPrototypeOf(connection),'connect').callsFake(async()=>{throw 'raw connect';});
        expect((await rejected(factory.createConnection({url:'jdbc:hsqldb:mem:raw'}))).message).to.include('raw connect');
    });
});

describe('JDBC statement and deadline boundaries',()=> {
    afterEach(()=>sinon.restore());
    for(const options of [{timeoutMs:-1},{timeoutMs:NaN},{maxRows:-1},{maxRows:1.5}]) {
        it(`rejects invalid execution options ${JSON.stringify(options)}`,async()=> {const {connection}=await fixture();await rejected(connection.execute('SELECT 1',[],options));});
    }
    it('binds dates, bigint, null, booleans, buffers and numbers and drains a result with fallback metadata',async()=> {
        const {connection,wrapped}=await fixture({timeoutMs:0});const bindings:any[]=[];const closed=sinon.spy();
        const statement:any={setString:async(...a:any[])=>bindings.push(a),setBoolean:async(...a:any[])=>bindings.push(a),setLong:async(...a:any[])=>bindings.push(a),setDouble:async(...a:any[])=>bindings.push(a),close:async()=>closed()};
        let i=0;statement.executeQuery=async()=>({getMetaData:()=>({getAllColumnMeta:()=>[{name:'ID'},{label:'NAME',type:{name:'VARCHAR'}}]}),next:()=>i++===0,fetchResult:()=>({ID:1,NAME:'a'})});wrapped.prepareStatement=async()=>statement;
        const result=await connection.execute('VALUES (?)',[new Date('2026-01-01T00:00:00Z'),4n,null,true,Buffer.from([255]),2,2.5]);
        expect(result.rows).to.deep.equal([[1,'a']]);expect(result.columns[0].type).to.equal('VARCHAR');expect(bindings.map(v=>v[1])).to.deep.equal(['2026-01-01 00:00:00.000','4',null,true,'FF','2',2.5]);expect(closed.calledOnce).to.equal(true);
        await rejected(connection.execute('VALUES (?)',[Infinity]));
    });
    for(const handle of ['ps','s']) {
        it(`cancels the native ${handle} handle and drains failure before reporting timeout`,async()=> {
            const clock=sinon.useFakeTimers();const {connection}=await fixture();let reject!:(error:Error)=>void;const running=new Promise((_,r)=>reject=r);let cancelled=false;
            const statement:any={[handle]:{cancelPromise:async()=>{cancelled=true;reject(Error('cancelled'));}}};
            const result=rejected(connection.executeWithDeadline(statement,()=>running,'SELECT 1',[],10));await clock.tickAsync(10);expect(await result).to.be.instanceOf(QueryTimeoutError);expect(cancelled).to.equal(true);
        });
    }
    it('lets immediate driver failure through a deadline and does not leave timers behind',async()=> {
        const clock=sinon.useFakeTimers({toFake:['setTimeout','clearTimeout']});const {connection}=await fixture();await rejected(connection.executeWithDeadline({},async()=>{throw Error('driver');},'SELECT 1',[],10));expect(clock.countTimers()).to.equal(0);
    });
    it('sets wrapper timeout controls when native statement is unavailable',async()=> {
        const {connection,wrapped}=await fixture();const timeout=sinon.spy(),max=sinon.spy();wrapped.createStatement=async()=>({setQueryTimeout:timeout,setMaxRows:max,executeUpdate:async()=>2});
        expect((await connection.execute('UPDATE T SET A=1',[],{maxRows:5})).rowsAffected).to.equal(2);expect(timeout.calledWith(1)).to.equal(true);expect(max.calledWith(5)).to.equal(true);
    });
});

describe('JDBC factory lifecycle and diagnostics boundaries',()=> {
    afterEach(()=>sinon.restore());
    it('schedules process cleanup with explicit and default delays',async()=> {
        const clock=sinon.useFakeTimers();const exit=sinon.stub(process,'exit');await JDBCConnectionFactory.forceProcessCleanup(7,20);await clock.tickAsync(10);expect(exit.calledWith(7)).to.equal(true);
        await JDBCConnectionFactory.forceProcessCleanup();await clock.tickAsync(500);expect(exit.calledWith(0)).to.equal(true);
    });
    for(const failure of [Error('close'),'close']) {
        it(`destroys the factory despite individual wrapper close failure (${typeof failure})`,async()=> {
            const {factory,connection}=await fixture();connection.close=async()=>{throw failure;};await factory.destroy();expect(factory.getActiveConnectionCount()).to.equal(0);
        });
        it(`reports diagnostic manager failures (${typeof failure})`,async()=> {
            const factory:any=new JDBCConnectionFactory();factory.logger=logger;factory.manager={getDatabaseUrl:()=>{throw failure;}};
            const result=await factory.diagnoseConnectionReadiness();expect(result.databaseAccessible).to.equal(false);expect(result.details.join(' ')).to.include('test failed');
        });
    }
    it('reports missing manager, unsupported URL and absent directory',async()=> {
        const factory:any=new JDBCConnectionFactory();factory.logger=logger;
        expect((await factory.diagnoseConnectionReadiness()).details.join(' ')).to.include('Manager not set');
        for(const url of ['jdbc:hsqldb:mem:diagnostic','jdbc:hsqldb:file:/tmp/starmade-nonexistent-diagnostic/absent']) {factory.manager={getDatabaseUrl:()=>url};expect((await factory.diagnoseConnectionReadiness()).databaseAccessible).to.equal(false);}
    });
});

describe('JDBC filesystem and bootstrap boundaries',()=> {
    let fs:any;let sync:()=>void;
    before(async()=> {fs=(await import('node:fs')).default;sync=(await import('node:module')).syncBuiltinESMExports;});
    afterEach(()=>{sinon.restore();sync();});
    for(const failure of [Error('filesystem'),'filesystem']) {
        it(`reports unavailable JARs and failed directory statistics (${typeof failure})`,async()=> {
            const factory:any=new JDBCConnectionFactory();factory.logger=logger;factory.manager={getDatabaseUrl:()=> 'jdbc:hsqldb:file:/tmp/database/'};
            sinon.stub(fs,'existsSync').callsFake((path:any)=>String(path).endsWith('.jar')?false:true);
            sinon.stub(fs,'accessSync').throws(Error('unreadable'));
            sinon.stub(fs,'statSync').callsFake(()=>{throw failure;});sync();
            const result=await factory.diagnoseConnectionReadiness();expect(result.jarAvailable).to.equal(false);expect(result.databaseAccessible).to.equal(false);expect(result.details.join(' ')).to.include('not readable').and.include('directory stats');
        });
    }
    it('reports a parent path that is not a directory',async()=> {
        const factory:any=new JDBCConnectionFactory();factory.manager={getDatabaseUrl:()=> 'jdbc:hsqldb:file:/tmp/database'};
        sinon.stub(fs,'existsSync').returns(true);sinon.stub(fs,'accessSync').returns(undefined);sinon.stub(fs,'statSync').returns({isDirectory:()=>false});sync();
        expect((await factory.diagnoseConnectionReadiness()).databaseAccessible).to.equal(true);
    });
    it('reports a raw JAR discovery failure',async()=> {
        const factory:any=new JDBCConnectionFactory();sinon.stub(fs,'existsSync').callsFake(()=>{throw 'raw fs';});sync();
        expect((await factory.diagnoseConnectionReadiness()).details.join(' ')).to.include('raw fs');
    });
    it('propagates a non-Error initialization failure from the configuration logger',async()=> {
        const factory:any=new JDBCConnectionFactory();factory.logger={info:()=>{},debug:()=>{throw 'raw bootstrap';},error:()=>{}};
        let result;try{await factory.initialize({});}catch(error){result=error;}expect(result).to.equal('raw bootstrap');
    });
    for(const mode of ['missing','raw','fallback']) {
        it(`checks JVM bootstrap in an isolated process (${mode})`,()=> {
            expect(bootstrapResults.get(mode),String(bootstrapResults.get(mode))).to.equal(null);
        });
    }

});

describe('JDBC remaining successful session paths',()=> {
    afterEach(()=>sinon.restore());
    it('commits and configures native session modes',async()=> {
        const {connection,raw,wrapped}=await fixture();const commit=sinon.spy(wrapped,'commit'),isolation=sinon.spy(raw,'setTransactionIsolationPromise'),readOnly=sinon.spy(raw,'setReadOnlyPromise');
        await connection.commit();await connection.setTransactionIsolation(8);await connection.setReadOnly(true);
        expect(commit.calledOnce).to.equal(true);expect(isolation.calledWith(8)).to.equal(true);expect(readOnly.calledWith(true)).to.equal(true);
        wrapped.createStatement=async()=>({id:'statement'});expect(await connection.createStatement()).to.deep.equal({id:'statement'});
        for(const error of [Error('create statement'),'create statement']) {wrapped.createStatement=async()=>{throw error;};await rejected(connection.createStatement());}
    });
    it('stops reading result rows at the caller limit',async()=> {
        const {connection,wrapped}=await fixture();let fetched=0;wrapped.createStatement=async()=>({executeQuery:async()=>({getMetaData:()=>({getAllColumnMeta:()=>[{name:'ID'}]}),next:()=>true,fetchResult:()=>({ID:++fetched})})});
        expect((await connection.execute('SELECT ID FROM T',[],{maxRows:1})).rows).to.deep.equal([[1]]);expect(fetched).to.equal(1);
    });
    it('purges a pool whose native initialization fails and permits retry',async()=> {
        const {JDBC}=await import('nodejs-jdbc');const initialize=sinon.stub(JDBC.prototype,'initialize').rejects(Error('pool initialization'));const purge=sinon.stub(JDBC.prototype,'purge').resolves();
        const factory:any=new JDBCConnectionFactory();factory.logger=logger;await factory.initialize({});
        await rejected(factory.getPool('jdbc:hsqldb:mem:failed_pool'));expect(purge.calledOnce).to.equal(true);expect(factory.pools.size).to.equal(0);
        await rejected(factory.getPool('jdbc:hsqldb:mem:failed_pool'));expect(initialize.calledTwice).to.equal(true);
    });
});

describe('JDBC physical pool cleanup regressions',()=> {
    it('drains every physical pool and resets initialization before reporting cleanup errors',async()=> {
        const factory:any=new JDBCConnectionFactory();factory._initialized=true;factory.logger=logger;const closed:string[]=[];
        const bad={pool:[{conn:{close:async()=>{closed.push('bad');throw Error('close');}}}],reserved:[{conn:{close:async()=>{closed.push('reserved');}}}]};
        const good={pool:[{conn:{close:async()=>{closed.push('good');}}}],reserved:[]};
        factory.pools.set('bad',Promise.resolve(bad));factory.pools.set('failed-open',Promise.reject(Error('open')));factory.pools.get('failed-open').catch(()=>{});factory.pools.set('good',Promise.resolve(good));
        const error=await rejected(factory.destroy());expect(error).to.be.instanceOf(AggregateError);
        expect(closed).to.deep.equal(['bad','reserved','good']);expect(factory.isInitialized).to.equal(false);expect(factory.pools.size).to.equal(0);expect(bad.pool).to.deep.equal([]);expect(good.pool).to.deep.equal([]);
    });
});
