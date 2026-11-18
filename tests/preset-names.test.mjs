import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
for(const [id,title] of [['video-director','视频创作助手'],['promo-video','宣传视频助手']]){
 test(`${id}: component metadata resolves through the full preset module name`,async()=>{
  const spec=`dsh-metaontic-video/presets/${id}`;
  const english=JSON.parse(await readFile(fileURLToPath(import.meta.resolve(`${spec}/locale/en.json`)),'utf8'));
  const chinese=JSON.parse(await readFile(fileURLToPath(import.meta.resolve(`${spec}/locale/zh.json`)),'utf8'));
  assert.equal(chinese.meta.title,title);assert.ok(english.meta.title);
  const entry=await readFile(fileURLToPath(import.meta.resolve(spec)),'utf8');
  const stub='data:text/javascript,'+encodeURIComponent('export default {hostPreset:true}');
  const executable=entry.replace(/(['\"])@deepseek-ai\/dsh-agent-preset\1/g,JSON.stringify(stub));
  assert.notEqual(executable,entry);
  const loaded=await import('data:text/javascript;base64,'+Buffer.from(executable).toString('base64'));
  assert.equal(loaded.default.hostPreset,true);
 });
}

test('skill filesystem resolves the installed package name rather than the removed legacy name',async()=>{
 const patch=await readFile(new URL('../cordis.patch.yml',import.meta.url),'utf8');
 const pkg=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8'));
 const refs=[...patch.matchAll(/resolve\('([^']+\/package\.json)'\)/g)].map(m=>m[1]);
 assert.deepEqual(refs,[`${pkg.name}/package.json`]);
 const resolved=import.meta.resolve(refs[0]);
 assert.equal(JSON.parse(await readFile(fileURLToPath(resolved),'utf8')).name,pkg.name);
});
