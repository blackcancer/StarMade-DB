import { resolve } from 'node:path';
import { HSQLManager } from '../../../../src/core/HSQLManager.js';
import { expect } from 'chai';
import { describe, it } from 'mocha';
import { JDBCConnectionFactory } from '../../../../src/core/modules/connection/JDBCConnectionFactory.js';

describe('JDBC database isolation regressions', () => {
    it('destroying a manager does not shut down another manager sharing the database', async () => {
        const config = {starmadeDir: resolve('tests/sandbox'), worldName: 'test_world',
            logging: {level: 'error' as const, enableConsole: false}};
        const a = new HSQLManager(config);
        const b = new HSQLManager(config);
        try {
            await a.initialize();
            await b.initialize();
            const pool = b.getModule<any>('connection-manager')!;
            const connection = await pool.getConnection();
            await a.destroy();
            const result = await connection.execute('SELECT COUNT(*) FROM PLAYERS');
            await pool.releaseConnection(connection);
            expect(Number(result.rows[0][0])).to.be.at.least(0);
        } finally { await a.destroy(); await b.destroy(); }
    });

    it('actually rolls back database changes rather than masking an overload error', async () => {
        const factory = new JDBCConnectionFactory();
        await factory.initialize({} as any);
        try {
            const connection = await factory.createConnection({url: 'jdbc:hsqldb:mem:rollback_regression',
                autoCommit: true, readOnly: false, timeoutMs: 1000, poolConfig: {minpoolsize: 1}});
            await connection.execute('CREATE MEMORY TABLE ROLLBACK_MARKER (ID INTEGER)');
            await connection.setAutoCommit(false);
            await connection.execute('INSERT INTO ROLLBACK_MARKER VALUES (1)');
            await connection.rollback();
            await connection.setAutoCommit(true);
            expect(Number((await connection.execute('SELECT COUNT(*) FROM ROLLBACK_MARKER')).rows[0][0])).to.equal(0);
        } finally { await factory.destroy(); }
    });

    it('round-trips millisecond timestamps and BIGINT boundaries', async () => {
        const factory = new JDBCConnectionFactory();
        await factory.initialize({} as any);
        try {
            const connection = await factory.createConnection({url: 'jdbc:hsqldb:mem:bigint_regression',
                autoCommit: true, readOnly: false, timeoutMs: 1000});
            for (const value of [0, 2147483648, -2147483649, 1789200000000, Number.MAX_SAFE_INTEGER]) {
                const result = await connection.execute('VALUES (CAST(? AS BIGINT))', [value]);
                expect(String(result.rows[0][0])).to.equal(String(value));
            }
        } finally { await factory.destroy(); }
    });

    it('discards a dirty session instead of returning it to the native pool', async () => {
        const factory = new JDBCConnectionFactory();
        await factory.initialize({} as any);
        const config = {url:'jdbc:hsqldb:mem:discard_regression',autoCommit:true,readOnly:false,timeoutMs:1000,
            poolConfig:{minpoolsize:1,maxpoolsize:1}};
        try {
            const connection:any=await factory.createConnection(config);
            await connection.execute('CREATE MEMORY TABLE DISCARD_MARKER (ID INTEGER)');
            await connection.setAutoCommit(false);
            await connection.execute('INSERT INTO DISCARD_MARKER VALUES (1)');
            await connection.discard();
            expect(connection.isActive).to.equal(false);
            await connection.discard();
            const next=await factory.createConnection(config);
            expect((await next.getSessionState!()).autoCommit).to.equal(true);
            expect(Number((await next.execute('SELECT COUNT(*) FROM DISCARD_MARKER')).rows[0][0])).to.equal(0);
        } finally {await factory.destroy();}
    });

    it('keeps different database URLs isolated within one factory', async () => {
        const factory = new JDBCConnectionFactory();
        await factory.initialize({} as any);
        const config = {autoCommit: true, readOnly: false, timeoutMs: 1000,
            poolConfig: {minpoolsize: 1, maxpoolsize: 2}};
        try {
            const a = await factory.createConnection({...config, url: 'jdbc:hsqldb:mem:regression_A'});
            const b = await factory.createConnection({...config, url: 'jdbc:hsqldb:mem:regression_B'});
            await a.execute('CREATE MEMORY TABLE MARKER (NAME VARCHAR(20))');
            await a.execute("INSERT INTO MARKER VALUES ('A')");
            let missing = false;
            try { await b.execute('SELECT * FROM MARKER'); } catch { missing = true; }
            expect(missing, 'B must not see tables from A').to.equal(true);
            await b.execute('CREATE MEMORY TABLE MARKER (NAME VARCHAR(20))');
            await b.execute("INSERT INTO MARKER VALUES ('B')");
            expect((await a.execute('SELECT * FROM MARKER')).rows).to.deep.equal([['A']]);
            expect((await b.execute('SELECT * FROM MARKER')).rows).to.deep.equal([['B']]);
        } finally { await factory.destroy(); }
    });

    it('destroying one factory leaves another factory usable', async () => {
        const a = new JDBCConnectionFactory();
        const b = new JDBCConnectionFactory();
        await a.initialize({} as any);
        await b.initialize({} as any);
        const config = {autoCommit: true, readOnly: false, timeoutMs: 1000,
            url: 'jdbc:hsqldb:mem:regression_shared', poolConfig: {minpoolsize: 1, maxpoolsize: 2}};
        try {
            await a.createConnection(config);
            const survivor = await b.createConnection(config);
            await a.destroy();
            expect(await survivor.ping()).to.equal(true);
        } finally { await a.destroy(); await b.destroy(); }
    });
});
