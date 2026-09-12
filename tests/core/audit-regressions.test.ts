import { expect } from 'chai';
import { describe, it } from 'mocha';
import { QueryExecutor } from '../../src/core/modules/query/QueryExecutor.js';
import { ConnectionManager } from '../../src/core/modules/connection/ConnectionManager.js';
import { TransactionManager } from '../../src/core/modules/transactions/TransactionManager.js';
import { QueryTimeoutError } from '../../src/core/errors.js';
import { FleetsModel } from '../../src/tables/fleets/FleetsModel.js';

const logger = new Proxy({}, { get: () => () => {} });
const result = (value: unknown) => ({ rows: [[value]], columns: [], executionTime: 0 });

function executor(execute: (...args: any[]) => Promise<any>) {
    const query: any = new QueryExecutor();
    query._initialized = true;
    query.logger = logger;
    query.connectionManager = {
        getConnection: async () => ({ execute }),
        releaseConnection: async () => {}
    };
    return query as QueryExecutor;
}

describe('Audit regressions', () => {
    it('keeps literal case and whitespace distinct in the query cache', async () => {
        let calls = 0;
        const q = executor(async sql => { calls++; return result(sql); });
        try {
            for (const literal of ['Alice', 'alice', 'a b', 'a  b']) {
                const sql = `SELECT '${literal}' FROM T`;
                expect((await q.executeQuery(sql)).rows).to.deep.equal([[sql]]);
            }
            expect(calls).to.equal(4);
        } finally { await q.destroy(); }
    });

    it('invalidates cached reads after a write', async () => {
        let value = 1;
        const q = executor(async sql => {
            if (sql.startsWith('UPDATE')) value = 2;
            return result(value);
        });
        try {
            await q.executeQuery('SELECT value FROM T');
            await q.executeQuery('UPDATE T SET value = 2');
            expect((await q.executeQuery('SELECT value FROM T')).rows).to.deep.equal([[2]]);
        } finally { await q.destroy(); }
    });

    it('validates queries even when metrics are disabled', async () => {
        let executed = false;
        const q: any = executor(async () => { executed = true; return result(1); });
        q.queryValidator = { validateQuery: async () => ({isValid: false, errors: [{message: 'forbidden'}]}) };
        try {
            let error: unknown;
            try { await q.executeQuery('DELETE FROM T', {enableMetrics: false}); }
            catch (caught) { error = caught; }
            expect(error).to.be.instanceOf(Error);
            expect(executed).to.equal(false);
        } finally { await q.destroy(); }
    });

    it('fails closed when the SQL validator itself fails', async () => {
        let executed = false;
        const q: any = executor(async () => { executed = true; return result(1); });
        q.queryValidator = {validateQuery: async () => { throw new Error('validator unavailable'); }};
        try {
            let error: unknown;
            try { await q.executeQuery('SELECT 1'); } catch (caught) { error = caught; }
            expect(error).to.be.instanceOf(Error);
            expect(executed).to.equal(false);
        } finally { await q.destroy(); }
    });

    it('preserves the configured timeout error and its original duration', async () => {
        const timeout = new QueryTimeoutError('SELECT 1', 5);
        const q = executor(async () => {throw timeout;});
        try {
            let error: unknown;
            try { await q.executeQuery('SELECT 1', {timeoutMs: 5}); } catch (caught) { error = caught; }
            expect(error).to.equal(timeout);
        } finally { await q.destroy(); }
    });

    it('streams batches using only the execution lease', async () => {
        const q: any = executor(async () => ({rows: [[1], [2], [3]], columns: [], executionTime: 0}));
        let leased = 0;
        const acquire = q.connectionManager.getConnection;
        q.connectionManager.getConnection = async () => {
            expect(++leased).to.equal(1);
            return acquire();
        };
        q.connectionManager.releaseConnection = async () => {leased--;};
        try {
            const batches = [];
            for await (const batch of q.executeStreamingQuery('SELECT 1', 2)) batches.push(batch.rows);
            expect(batches).to.deep.equal([[[1], [2]], [[3]]]);
            expect(leased).to.equal(0);
        } finally {await q.destroy();}
    });

    it('reserves a pooled connection before asynchronous health checks', async () => {
        const pool: any = new ConnectionManager();
        pool._initialized = true;
        pool.config = {enablePooling: true, maxPoolSize: 1};
        pool.logger = logger;
        const connection = {id: 'one', isActive: true, ping: async () => true};
        pool.connectionPool.set('one', {id: 'one', jdbcConnection: connection,
            state: 'connected', isReserved: false, useCount: 0, health: {isHealthy: true}});
        let waited = false;
        pool.waitForAvailableJDBCConnection = async () => { waited = true; return 'waiting'; };
        const results = await Promise.all([pool.getConnection(), pool.getConnection()]);
        expect(waited).to.equal(true);
        expect(results).to.deep.equal([connection, 'waiting']);
    });

    it('counts in-flight creations against pool capacity', async () => {
        const pool: any = new ConnectionManager();
        pool._initialized = true;
        pool.config = {enablePooling: true, maxPoolSize: 1};
        pool.logger = logger;
        let creations = 0;
        pool.createRealPoolConnection = async () => {
            creations++;
            await Promise.resolve();
            pool.connectionPool.set('one', {jdbcConnection: {id: 'one'}, health: {isHealthy: true}});
            return 'one';
        };
        pool.waitForAvailableJDBCConnection = async () => 'waiting';
        await Promise.all([pool.getConnection(), pool.getConnection()]);
        expect(creations).to.equal(1);
    });

    it('restores session settings before releasing a committed transaction', async () => {
        let state = {autoCommit: true, readOnly: false, isolationLevel: 2};
        const original = {...state};
        let released: unknown;
        const connection = {
            id: 'tx', getSessionState: async () => ({...state}),
            setAutoCommit: async (v: boolean) => {state.autoCommit = v;},
            setReadOnly: async (v: boolean) => {state.readOnly = v;},
            setTransactionIsolation: async (v: number) => {state.isolationLevel = v;},
            commit: async () => {}, rollback: async () => {}, close: async () => {}
        };
        const manager = new TransactionManager();
        await manager.initialize({getModule: name => name === 'connection-manager' ? {
            getConnection: async () => connection,
            releaseConnection: async () => {released = {...state};}
        } : undefined} as any);
        try {
            const tx = await manager.beginTransaction('audit', {readOnly: true});
            await tx.commit();
            expect(released).to.deep.equal(original);
        } finally { await manager.destroy(); }
    });

    it('can decode empty fleet remotes in native ESM', () => {
        expect(() => new FleetsModel().decodeRemotes()).not.to.throw();
    });
});
