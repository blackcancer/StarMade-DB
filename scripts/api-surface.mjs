/** Discover documented declarations using the TypeScript syntax tree. */
import ts from 'typescript';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = fileURLToPath(new URL('..', import.meta.url));

/** Enumerate source TypeScript files, including files not imported by tests. */
export function sourceFiles(directory = join(root, 'src')) {
    return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
        const path = join(directory, entry.name);
        return entry.isDirectory() ? sourceFiles(path) : path.endsWith('.ts') && !path.endsWith('.d.ts') ? [path] : [];
    }).sort();
}

/** Collect module declarations and class members; optionally restrict to the public API. */
export function publicAPI({includeInternal = false} = {}) {
    const entries = [];
    for (const file of sourceFiles()) {
        const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
        const add = (node, name, fallback) => {
            const docs = node.jsDoc?.length ? node.jsDoc : fallback?.jsDoc ?? [];
            const description = docs.map(doc => typeof doc.comment === 'string' ? doc.comment : doc.comment?.map(part => part.text).join('') ?? '').filter(Boolean).join('\n');
            const tags = docs.flatMap(doc => (doc.tags ?? []).map(tag => ({
                name: tag.tagName.text,
                parameter: tag.name?.getText(source),
                text: typeof tag.comment === 'string' ? tag.comment : tag.comment?.map(part => part.text).join('') ?? ''
            })));
            const text = node.getText(source);
            const bodyStart = node.body?.getStart(source);
            const signature = bodyStart === undefined ? text.split('\n')[0] : source.text.slice(node.getStart(source), bodyStart).trim();
            entries.push({file: relative(root, file), line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1,
                name, description: description || tags.find(tag => tag.name === 'description')?.text || '', tags, signature});
        };
        for (const node of source.statements) {
            if (!includeInternal && !node.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword)) continue;
            if (ts.isExportDeclaration(node)) continue;
            const name = node.name?.getText(source);
            if (ts.isVariableStatement(node)) {
                for (const declaration of node.declarationList.declarations) add(node, declaration.name.getText(source));
                continue;
            }
            if (!name) continue;
            add(node, name);
            if (ts.isClassDeclaration(node) || ts.isInterfaceDeclaration(node) || ts.isEnumDeclaration(node)) {
                for (const member of node.members) {
                    if (!includeInternal && member.modifiers?.some(modifier => [ts.SyntaxKind.PrivateKeyword, ts.SyntaxKind.ProtectedKeyword].includes(modifier.kind))) continue;
                    const memberName = ts.isConstructorDeclaration(member) ? 'constructor' : member.name?.getText(source);
                    if (!memberName || (!includeInternal && memberName.startsWith('#'))) continue;
                    add(member, `${name}.${memberName}`);
                }
            }
        }
    }
    return entries;
}
