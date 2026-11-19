import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { publishStableAlias, STABLE_ASSET } from '../scripts/publish-stable-alias.mjs';

function fixture(t, { existing = false, corrupt = false, newer = false } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'stable-alias-test-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const archive = join(dir, 'original.tgz');
  writeFileSync(archive, 'verified cross-platform package');
  const calls = [];
  const assets = new Map([['metaontic-video-4.0.6.tgz', readFileSync(archive)]]);
  if (existing) assets.set(STABLE_ASSET, Buffer.from(corrupt ? 'wrong bytes' : readFileSync(archive)));
  const run = args => {
    calls.push(args);
    if (args[0] === 'api') return JSON.stringify([[{ tag_name: newer ? 'v4.0.7' : 'v4.0.5', draft: false, prerelease: false }]]);
    if (args[1] === 'view') return JSON.stringify({ isPrerelease: false, assets: [...assets.keys()].map(name => ({ name })) });
    if (args[1] === 'download') {
      const name = args[args.indexOf('--pattern') + 1];
      writeFileSync(join(args[args.indexOf('--dir') + 1], name), assets.get(name));
    }
    if (args[1] === 'upload') assets.set(STABLE_ASSET, readFileSync(args[3]));
    return '';
  };
  return { calls, assets, invoke: () => publishStableAlias({ tag: 'v4.0.6', archive, repo: 'owner/repo', run }) };
}
test('stable alias copies verified bytes and publishes only after remote checksum checks', t => {
  const h = fixture(t); const result = h.invoke();
  assert.equal(result.latest, true);
  assert.deepEqual(h.assets.get(STABLE_ASSET), h.assets.get('metaontic-video-4.0.6.tgz'));
  assert.equal(h.calls.at(-1)[1], 'edit');
  assert.ok(h.calls.at(-1).includes('--latest=true'));
});
test('resuming verifies existing alias without overwriting it', t => {
  const h = fixture(t, { existing: true }); h.invoke();
  assert.ok(!h.calls.some(args => args[1] === 'upload'));
});
test('corrupt existing alias blocks publication and is never overwritten', t => {
  const h = fixture(t, { existing: true, corrupt: true });
  assert.throws(h.invoke, /checksum mismatch/);
  assert.ok(!h.calls.some(args => ['upload', 'edit'].includes(args[1])));
});
test('backfilling an old release cannot move latest backwards', t => {
  const h = fixture(t, { newer: true }); assert.equal(h.invoke().latest, false);
  assert.ok(h.calls.at(-1).includes('--latest=false'));
});
test('prerelease tag fails before invoking GitHub', () => {
  assert.throws(() => publishStableAlias({ tag: 'v4.0.6-beta.1', run: () => assert.fail('must not run') }), /Only stable/);
});
