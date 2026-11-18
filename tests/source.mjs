import { readFileSync } from 'node:fs';
import ts from 'typescript';

/** 写死的固定配置（src/shared/constants/plugin.ts）是所有模块的共享基础，sourceOf 默认带上它，
 *  这样测试只需要列自己要塞依赖的业务模块。 */
const SHARED = 'shared/constants/plugin';

/** Compile modules for isolated dependency mocks without relying on bundle order or renamed imports. */
export function sourceOf(...modules) {
  const list = modules.includes(SHARED) ? modules : [SHARED, ...modules];
  return list.map(name => ts.transpileModule(
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
