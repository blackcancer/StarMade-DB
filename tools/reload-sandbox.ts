/**
 * Reload test data into HSQLDB sandbox.
 * Uses direct JDBC URL bypass with ifexists=false.
 */
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dir, '..');

// Bootstrap JDBC directly
const { addOption, setupClasspath, JDBC } = await import('nodejs-jdbc');
const jinst = await import('nodejs-jdbc/dist/jinst.js');

// JVM config
if (!jinst.isJvmCreated()) {
    addOption('-Xrs');
    addOption('-Xmx256m');
    const jarPath = join(ROOT, 'src/lib/hsqldb.jar');
    setupClasspath([jarPath]);
}

// URL with ifexists=false to allow creation
const dbPath = join(ROOT, 'tests/sandbox/server-database/test_world/index').replace(/\\/g, '/');
const url = `jdbc:hsqldb:file:${dbPath}/;shutdown=true;hsqldb.lock_file=false;hsqldb.nio_data_file=false;hsqldb.write_delay=false;hsqldb.log_data=false;hsqldb.applog=0;hsqldb.sqllog=0`;

console.log('URL:', url);

const jdbc = new JDBC({
    url,
    drivername: 'org.hsqldb.jdbc.JDBCDriver',
    minpoolsize: 1,
    maxpoolsize: 1,
    user: 'SA',
    password: ''
});

await new Promise<void>((res, rej) => jdbc.initialize((err: any) => err ? rej(err) : res()));

const conn = await new Promise<any>((res, rej) => {
    jdbc.open((err: any, conn: any) => err ? rej(err) : res(conn));
});

console.log('Connected to HSQLDB');

const execute = async (sql: string): Promise<void> => {
    return new Promise((res, rej) => {
        conn.createStatement((err: any, stmt: any) => {
            if (err) return rej(err);
            stmt.execute(sql, (err2: any) => err2 ? rej(err2) : res());
        });
    });
};

// Load SQL files
const files = [
    '00-cleanup.sql',
    '01-systems.sql',
    '02-players.sql',
    '03-sectors.sql',
    '04-entities.sql',
    '05-fleets.sql',
    '06-fleet-members.sql',
    '07-ftl.sql',
    '08-trade-nodes.sql',
    '09-effects.sql',
    '10-mines.sql',
    '11-player-messages.sql',
    '12-sectors-items.sql',
    '13-trade-history.sql',
    '14-visibility.sql',
    '15-npc-stats.sql',
    '16-id-gen-table.sql',
];

for (const file of files) {
    const path = join(ROOT, 'test-data', file);
    if (!existsSync(path)) { console.warn('MISSING:', file); continue; }
    
    const sql = readFileSync(path, 'utf8');
    const statements = sql.split(';')
        .map(s => s.replace(/--[^\n]*/g, '').trim())
        .filter(s => s.length > 0);

    let ok = 0; let skip = 0;
    for (const stmt of statements) {
        try {
            await execute(stmt);
            ok++;
        } catch (e) {
            const msg = (e as Error).message ?? '';
            if (!msg.includes('already exists') && !msg.includes('duplicate') && !msg.includes('integrity')) {
                if (skip < 3) console.warn(`  ERR in ${file}:`, msg.slice(0, 80));
            }
            skip++;
        }
    }
    console.log(`${file}: ${ok} OK, ${skip} skipped`);
}

// Close
await new Promise<void>((res) => {
    conn.close((err: any) => { if (err) console.warn('Close err:', err); res(); });
});

// Shutdown HSQLDB
try {
    const conn2 = await new Promise<any>((res, rej) => jdbc.open((e: any, c: any) => e ? rej(e) : res(c)));
    await new Promise<void>((res) => {
        conn2.createStatement((err: any, stmt: any) => {
            if (err) return res();
            stmt.execute('SHUTDOWN', () => res());
        });
    });
} catch { /**/ }

console.log('\nSandbox reload complete! Run npm test to verify.');
setTimeout(() => process.exit(0), 1000);
