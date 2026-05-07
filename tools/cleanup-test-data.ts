/**
 * Direct HSQLDB cleanup for test data via raw JDBCConnection.
 */
import { HSQLManager } from '../src/core/index.js';

const m = new HSQLManager({
    starmadeDir: './tests/sandbox',
    worldName: 'test_world',
    connection: { readOnly: false, autoCommit: true },
    modules: {
        enableParameterizedQueries: true,
        enableQueryValidation: false,
        enableAdvancedCaching: false,
        enableRelationshipAnalysis: false,
        enableMetricsCollection: false,
        enableAutoReconnection: false,
        enableConnectionFactory: true
    },
    logging: { level: 'error', enableConsole: false, enableFile: false }
});

await m.initialize();

const cm = m.getModule<any>('connection-manager');
if (!cm) { console.error('No connection-manager'); process.exit(1); }

// Get a raw JDBC connection
const conn = await cm.getConnection();

const exec = async (sql: string) => {
    try {
        await conn.execute(sql, []);
        console.log('OK:', sql);
    } catch (e) {
        console.warn('SKIP:', sql.slice(0, 80), '->', (e as Error).message?.slice(0, 60));
    }
};

// Clean in FK order
await exec("DELETE FROM FLEET_MEMBERS WHERE FLEET_ID > 9000");
await exec("DELETE FROM FLEETS WHERE ID > 9000");
await exec("DELETE FROM VISIBILITY WHERE X > 1000 OR Y > 1000");
await exec("DELETE FROM FTL WHERE ID > 1000");
await exec("DELETE FROM NPC_STATS WHERE SYS_X > 500");
await exec("DELETE FROM PLAYER_MESSAGES WHERE ID > 100000");
await exec("DELETE FROM TRADE_NODES WHERE ID > 90000");

// Count check
for (const t of ['FLEETS', 'VISIBILITY', 'FTL', 'NPC_STATS', 'PLAYER_MESSAGES']) {
    try {
        const r = await conn.execute(`SELECT COUNT(*) FROM ${t}`, []);
        console.log(`${t}: ${r?.rows?.[0]?.[0] ?? '?'}`);
    } catch { /**/ }
}

await m.destroy();
console.log('Cleanup done.');
