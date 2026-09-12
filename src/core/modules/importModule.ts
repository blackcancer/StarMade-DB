/**
 * Loads a module namespace relative to the core modules directory.
 * Keeps optional feature loading lazy and supports ESM and CommonJS dependencies.
 * @template T - Expected shape of the loaded module's exports.
 * @param specifier - Relative module path, package name or Node built-in specifier.
 * @returns The module exports after the runtime's module interoperability handling.
 */
export async function importModule<T>(specifier: string): Promise<T> {
    return import(specifier);
}
