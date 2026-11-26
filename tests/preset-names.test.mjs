import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

for (const [id,title] of [['video-director','视频创作助手'], ['creative-video-designer','创意视频设计师']]) {
test(`preset ${id} resolves through its package entry`, async () => {
  const spec = `dsh-metaontic-video/presets/${id}`;
  const english = JSON.parse(await readFile(fileURLToPath(import.meta.resolve(`${spec}/locale/en.json`)), 'utf8'));
  const chinese = JSON.parse(await readFile(fileURLToPath(import.meta.resolve(`${spec}/locale/zh.json`)), 'utf8'));
  assert.equal(chinese.meta.title, title);
  assert.ok(english.meta.title);

  const entry = await readFile(fileURLToPath(import.meta.resolve(spec)), 'utf8');
  const stub = 'data:text/javascript,' + encodeURIComponent('export default {hostPreset:true}');
  const executable = entry.replace(/(['"])@deepseek-ai\/dsh-agent-preset\1/g, JSON.stringify(stub));
  assert.notEqual(executable, entry);
  const loaded = await import('data:text/javascript;base64,' + Buffer.from(executable).toString('base64'));
  assert.equal(loaded.default.hostPreset, true);

  const manifest = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
  const patch = await readFile(new URL('../cordis.patch.yml', import.meta.url), 'utf8');
  assert.ok(manifest.exports[`./presets/${id}`]);
  assert.equal(manifest.exports['./presets/promo-video'], undefined);
  assert.doesNotMatch(patch, /preset-promo-video|id: promo-video/);
});
}
