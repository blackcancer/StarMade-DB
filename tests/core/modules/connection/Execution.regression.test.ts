import { expect } from 'chai';
import { after, before, describe, it } from 'mocha';
import { JDBCConnectionFactory } from '../../../../src/core/modules/connection/JDBCConnectionFactory.js';

describe('JDBC execution lifecycle regressions', () => {
    const factory = new JDBCConnectionFactory();
    let connection: any;
    let original: any;
    before(async function () {
        this.timeout(5000);
        await factory.initialize({} as any);
        connection = await factory.createConnection({url: 'jdbc:hsqldb:mem:execution_regression',
            autoCommit: true, readOnly: false, timeoutMs: 1000, poolConfig: {minpoolsize: 1}});
        original = connection.conn;
    });
    after(async () => { connection.conn = original; await factory.destroy(); });

    it('cancels a timed-out statement and closes it before returning the connection', async function () {
        this.timeout(200);
        let cancelled = false;
        let closed = false;
        let seconds: number | undefined;
        let finish: (value: any) => void = () => {};
        const statement = {
            setQueryTimeout: (value: number) => {seconds = value;},
            executeQuery: () => new Promise(resolve => {finish = resolve;}),
            cancel: async () => {cancelled = true; finish({getMetaData: () => ({getAllColumnMeta: () => []}), next: () => false});},
            close: async () => {closed = true;}
        };
        connection.conn = {createStatement: async () => statement};
        let error: any;
        try { await connection.execute('SELECT 1', [], {timeoutMs: 5}); }
        catch (caught) { error = caught; }
        expect(error?.timeoutMs).to.equal(5);
        expect(seconds).to.equal(1);
        expect(cancelled).to.equal(true);
        expect(closed).to.equal(true);
        connection.conn = original;
    });

    it('closes a prepared statement when parameter binding fails', async () => {
        let closed = false;
        connection.conn = {prepareStatement: async () => ({
            setString: () => {throw new Error('binding failed');},
            close: async () => {closed = true;}
        })};
        try { await connection.execute('SELECT ?', ['value']); } catch {}
        expect(closed).to.equal(true);
        connection.conn = original;
    });
});
