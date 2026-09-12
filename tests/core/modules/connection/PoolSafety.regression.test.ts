import {expect} from 'chai';
import {describe,it} from 'mocha';
import {ConnectionManager} from '../../../../src/core/modules/connection/ConnectionManager.js';
import {JDBCConnectionFactory} from '../../../../src/core/modules/connection/JDBCConnectionFactory.js';

const logger=new Proxy({}, {get:()=>()=>{}});
describe('Pool safety boundaries',()=>{
    it('never reassigns a long-running reserved connection during pool exhaustion',async()=>{
        const pool:any=new ConnectionManager();pool.logger=logger;
        let pings=0;
        const entry={id:'busy',isReserved:true,lastUsed:new Date(Date.now()-60000),health:{isHealthy:true},
            jdbcConnection:{id:'busy',ping:async()=>{pings++;return true;}}};
        pool.connectionPool.set('busy',entry);
        pool.reportStaleConnections();await Promise.resolve();
        expect(entry.isReserved).to.equal(true);expect(pings).to.equal(0);
    });
    it('rejects connections whose read-only session configuration failed',async()=>{
        const factory:any=new JDBCConnectionFactory();factory._initialized=true;factory.logger=logger;
        let closed=0;let released=0;
        const reservation={conn:{conn:{setAutoCommitPromise:async()=>{},setReadOnlyPromise:async()=>{throw Error('read-only rejected');}},close:async()=>{closed++;}}};
        const pool={pool:[],reserved:[reservation],reserve:async()=>reservation,release:async()=>{released++;}};
        factory.getPool=async()=>pool;
        let error:unknown;
        try{await factory.createConnection({url:'jdbc:hsqldb:mem:config_failure',autoCommit:true,readOnly:true,timeoutMs:1000});}catch(e){error=e;}
        expect(error).to.be.instanceOf(Error);expect(closed).to.equal(1);expect(released).to.equal(0);expect(pool.reserved).to.deep.equal([]);
    });
});
