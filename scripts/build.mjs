/** Portable build entry: no POSIX command substitution or shell quoting. */
import { build } from 'esbuild';
import { packageDescription } from './package-description.mjs';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
const version = JSON.parse(await readFile('package.json', 'utf8')).version;
const target = process.argv[2] || 'all';
const flags = await readFile('src/shared/constants/plugin.ts','utf8');
const canvas = /export const FLOW_CANVAS_AVAILABLE = (true|false);/.exec(flags);
if (!canvas) throw Error('Missing literal canvas feature flag');
const defines = { __PLUGIN_VERSION__: JSON.stringify(version), __FLOW_CANVAS_AVAILABLE__: canvas[1] };

if (!['all','locale','host','client'].includes(target)) throw Error('Unknown build target');
// 成品裁掉README.md后，npm不得回退读取英文README；介绍写入标准元数据。
const packageFile = JSON.parse(await readFile('package.json','utf8'));
const readme = packageDescription(await readFile('README.md','utf8'));
if(packageFile.readme !== readme) {
  packageFile.readme = readme;
  await writeFile('package.json', JSON.stringify(packageFile,null,2)+'\n');
}

if (target === 'all' || target === 'locale') {
  await mkdir('locale', { recursive: true });
  for (const lang of ['zh','en']) {
    const result = await build({entryPoints:[`src/locale/${lang}.ts`],bundle:true,charset:'utf8',format:'esm',platform:'node',write:false});
    const module = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
    const value = module.default ?? module.locale;
    if (!value) throw Error(`Missing ${lang} locale`);
    await writeFile(`locale/${lang}.json`, JSON.stringify(value,null,2)+'\n');
  }
}
if (target === 'all' || target === 'host') await build({entryPoints:['src/index.ts'],bundle:true,charset:'utf8',format:'esm',platform:'node',target:'node20',minifySyntax:true,define:defines,outfile:'index.js'});
if (target === 'all' || target === 'client') await build({entryPoints:['src/client.ts'],bundle:true,charset:'utf8',format:'iife',platform:'browser',target:'es2022',loader:{'.svg':'text','.png':'dataurl'},minifySyntax:true,define:defines,outfile:'client.js'});

// 预设入口源码统一放 src；发布目录仅保留构建产物与静态资源。
if (target === 'all' || target === 'host') {
  await mkdir('presets', { recursive: true });
  for (const preset of ['video-director']) {
    await build({entryPoints:[`src/agents/presets/${preset}.ts`],bundle:true,charset:'utf8',format:'esm',platform:'node',target:'node20',external:['@deepseek-ai/dsh-agent-preset'],outfile:`presets/${preset}.js`});
  }
}
