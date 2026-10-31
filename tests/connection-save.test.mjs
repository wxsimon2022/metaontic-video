import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { test } from 'node:test';
const source = readFileSync(new URL('../src/client.ts', import.meta.url), 'utf8');
const start = source.indexOf('    async function persistConnection(');
const context = vm.createContext({});
vm.runInContext(source.slice(start, source.indexOf('\n    function makePage(', start)), context);
const modes = ['service', 'metaontic', 'volcengine'];
const keyFor = { service: 'apiKey', metaontic: 'metaonticApiKey', volcengine: 'volcengineApiKey' };
for (const from of modes) for (const to of modes) test(`atomic save ${from} -> ${to} clears inherited credentials`, async () => {
  const inherited = { apiKey: 'old-service', metaonticApiKey: 'old-meta', volcengineApiKey: 'old-volcano', deviceSecret: 'old-device' };
  const disk = { connectionMode: from }; let calls = 0;
  await context.persistConnection({
    async mutate(ops) { calls++; const staged = { ...disk }; for (const op of ops) staged[op.path[0]] = op.value; Object.assign(disk, staged); return true; },
    getSnapshot() { throw new Error('disposed controller snapshot must not be used'); },
  }, [['connectionMode', to], [keyFor[to], 'new-key']], to);
  assert.equal(calls, 1); assert.equal(disk.connectionMode, to); assert.equal(disk[keyFor[to]], 'new-key');
  for (const mode of modes.filter(mode => mode !== to)) assert.equal(({ ...inherited, ...disk })[keyFor[mode]], '');
});
test('rejected atomic writes report failure without falling back to partial writes', async () => {
  let calls = 0;
  await assert.rejects(context.persistConnection({ async mutate() { calls++; return false; }, async set() { throw new Error('partial writes forbidden'); } }, [], 'metaontic'), /宿主未接受/);
  assert.equal(calls, 1);
  await assert.rejects(context.persistConnection({}, [], 'metaontic'), /不支持原子保存/);
});
