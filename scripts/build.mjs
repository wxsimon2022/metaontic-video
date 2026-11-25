/** Portable build entry: no POSIX command substitution or shell quoting. */
import { build } from 'esbuild';
import { packageDescription } from './package-description.mjs';
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
const version = JSON.parse(await readFile('package.json', 'utf8')).version;
const target = process.argv[2] || 'all';
const defines = { __PLUGIN_VERSION__: JSON.stringify(version) };

if (!['all','locale','host','client'].includes(target)) throw Error('Unknown build target');
for (const file of ['index.js','client.js','presets/video-director.js']) {
  await rm(file, { force: true });
}
// 成品裁掉README.md后，npm不得回退读取英文README；介绍写入标准元数据。
const packageFile = JSON.parse(await readFile('package.json','utf8'));
const readme = packageDescription(await readFile('README.md','utf8'));
if(packageFile.readme !== readme) {
  packageFile.readme = readme;
  await writeFile('package.json', JSON.stringify(packageFile,null,2)+'\n');
}

if (target === 'all' || target === 'locale') {
  await rm('dist/locale', { recursive: true, force: true });
  await mkdir('dist/locale', { recursive: true });
  await mkdir('locale', { recursive: true });
  for (const lang of ['zh','en']) {
    const result = await build({entryPoints:[`src/locale/${lang}.ts`],bundle:true,charset:'utf8',format:'esm',platform:'node',write:false});
    const module = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
    const value = module.default ?? module.locale;
    if (!value) throw Error(`Missing ${lang} locale`);
    const metadata = JSON.stringify(value,null,2)+'\n';
    await writeFile(`dist/locale/${lang}.json`, metadata);
    // 详情服务直接读物理locale路径；模块导出映射仅用于组件元信息。
    await writeFile(`locale/${lang}.json`, metadata);
  }
}
if (target === 'all' || target === 'host') {
  await rm('dist/index.js', { force: true });
  await rm('dist/presets', { recursive: true, force: true });
  await mkdir('dist', { recursive: true });
  await build({entryPoints:['src/index.ts'],bundle:true,charset:'utf8',format:'esm',platform:'node',target:'node20',minifySyntax:true,define:defines,outfile:'dist/index.js'});
}
if (target === 'all' || target === 'client') {
  await rm('dist/client.js', { force: true });
  await mkdir('dist', { recursive: true });
  await build({entryPoints:['src/client.ts'],bundle:true,charset:'utf8',format:'iife',platform:'browser',target:'es2022',loader:{'.svg':'text','.png':'dataurl'},minifySyntax:true,define:defines,outfile:'dist/client.js'});
}

// 预设入口源码统一放 src；发布目录仅保留构建产物与静态资源。
if (target === 'all' || target === 'host') {
  await mkdir('dist/presets', { recursive: true });
  for (const preset of ['video-director']) {
    await build({entryPoints:[`src/agents/presets/${preset}.ts`],bundle:true,charset:'utf8',format:'esm',platform:'node',target:'node20',external:['@deepseek-ai/dsh-agent-preset'],outfile:`dist/presets/${preset}.js`});
  }
}
