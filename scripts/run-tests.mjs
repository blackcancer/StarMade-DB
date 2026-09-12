/** Run Mocha against a disposable copy of the checked-in HSQLDB fixture. */
import { cpSync, existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const scratch = mkdtempSync(join(tmpdir(), 'starmade-db-tests-'));
const fixture = join(scratch, 'tests', 'sandbox');
mkdirSync(dirname(fixture), { recursive: true });
cpSync(join(root, 'tests', 'sandbox'), fixture, { recursive: true });
const jar = process.env.HSQLDB_JAR || [join(root, 'lib', 'hsqldb.jar'), join(root, 'src', 'lib', 'hsqldb.jar')].find(existsSync);
const requested = process.argv.slice(2);
const patterns = requested.filter(arg => !arg.startsWith('--'));
const args = [
    '--import', require.resolve('tsx/esm'), require.resolve('mocha/bin/mocha.js'),
    '--no-config', '--no-package', '--timeout', '30000', '--exit',
    ...(patterns.length ? patterns.map(pattern => resolve(root, pattern)) : [join(root, 'tests', '**', '*.test.ts')]),
    ...requested.filter(arg => arg.startsWith('--'))
];
const child = spawn(process.execPath, args, {
    cwd: scratch,
    env: { ...process.env, ...(jar ? { HSQLDB_JAR: jar } : {}) },
    stdio: 'inherit'
});
child.on('error', error => { console.error(error); process.exitCode = 1; });
child.on('close', (code, signal) => {
    rmSync(scratch, { recursive: true, force: true });
    process.exitCode = code ?? (signal ? 1 : 0);
});
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
