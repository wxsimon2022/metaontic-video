/**
 * 把 `src/locale/<lang>.ts` 生成 `locale/<lang>.json`。
 *
 * 插件元信息（插件页显示的标题 / 描述）源码写成 TS，但 DSH 是按 `./locale/*.json`
 * 这个导出路径读的，运行时只认 JSON——所以跟 index.js / client.js 一个路子：
 * 源码全是 TS，运行时用构建产物。
 */
import { build } from 'esbuild';
import { writeFile } from 'node:fs/promises';

const LANGS = ['zh', 'en'];

for (const lang of LANGS) {
  const entry = `src/locale/${lang}.ts`;
  const outfile = `locale/${lang}.json`;
  const result = await build({
    entryPoints: [entry],
    bundle: true,
    format: 'esm',
    platform: 'node',
    write: false,
    logLevel: 'error',
  });
  const code = result.outputFiles[0].text;
  const dataUrl = `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`;
  const module = await import(dataUrl);
  const payload = module.default ?? module.locale;
  if (!payload) throw new Error(`${entry} 没有导出 locale / default`);
  // 末尾补一个换行：跟手写的 JSON 保持一致，免得每次构建都弄脏 git
  await writeFile(outfile, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  console.log(`${outfile} ← ${entry}`);
}
