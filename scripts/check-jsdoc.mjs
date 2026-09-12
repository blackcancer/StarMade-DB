/** Fail when any module declaration or class member lacks a JSDoc description. */
import { publicAPI } from './api-surface.mjs';
const entries = publicAPI({includeInternal: true});
const missing = entries.filter(entry => !entry.description.trim());
for (const entry of missing) console.error(`${entry.file}:${entry.line} ${entry.name}: missing JSDoc description`);
console.log(`JSDoc: ${entries.length - missing.length}/${entries.length} declarations documented (public, protected and private) (${((entries.length - missing.length) / entries.length * 100).toFixed(2)}%).`);
process.exitCode = missing.length ? 1 : 0;
