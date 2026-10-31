import { readFileSync } from 'node:fs';
import ts from 'typescript';

/** Compile modules for isolated dependency mocks without relying on bundle order or renamed imports. */
export function sourceOf(...modules) {
  return modules.map(name => ts.transpileModule(
    readFileSync(new URL(`../src/${name}.ts`, import.meta.url), 'utf8'),
    {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
      transformers: { before: [context => file => ts.visitEachChild(file, function visit(node) {
        if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) return undefined;
        if (node.kind === ts.SyntaxKind.ExportKeyword) return undefined;
        return ts.visitEachChild(node, visit, context);
      }, context)] },
    },
  ).outputText.replace(/export\s*\{\s*\};?/g, '')).join('\n');
}
