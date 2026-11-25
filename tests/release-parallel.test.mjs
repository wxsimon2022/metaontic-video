import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { platformCheckState, waitForPlatformChecks, runReleaseChannels, spawnReleaseChannel } from '../scripts/release-parallel.mjs';
import { publishNpmChannel } from '../scripts/release-channel.mjs';

const job = (name, status = 'completed', conclusion = 'success') => ({ name: `platform-install (${name}-latest)`, status, conclusion });
const checked = { headSha: 'tag-commit', status: 'in_progress', jobs: [job('windows'), job('macos')] };
function fixture() {
  const out = mkdtempSync(path.join(tmpdir(), '并行 release ')), archive = path.join(out, 'package.tgz');
  writeFileSync(archive, 'same immutable package');
  return { out, archive, version: '1.2.3', sha256: createHash('sha256').update(readFileSync(archive)).digest('hex') };
}

test('both platform checks must pass for this tag, even while GitHub publication is still running', async () => {
  assert.equal(platformCheckState(checked, 'tag-commit'), true);
  assert.equal(platformCheckState({ ...checked, jobs: [job('windows')] }, 'tag-commit'), false);
  assert.throws(() => platformCheckState(checked, 'another-tag'), /提交/);
  assert.throws(() => platformCheckState({ ...checked, jobs: [job('windows'), job('macos', 'completed', 'failure')] }, 'tag-commit'), /未通过/);
  assert.throws(() => platformCheckState({ ...checked, status: 'completed', jobs: [] }, 'tag-commit'), /未完成/);
  let inspections = 0, waits = 0;
  await waitForPlatformChecks({ expectedSha: 'tag-commit', inspect: async () => ++inspections === 1 ? { ...checked, jobs: [] } : checked, wait: async () => waits++, log() {} });
  assert.equal(inspections, 2); assert.equal(waits, 1);
});

test('three channels start before any is allowed to finish; one failure preserves the other results', { timeout: 5000 }, async () => {
  const common = fixture(), started = [], finished = [];
  let release;
  const barrier = new Promise(resolve => { release = resolve; });
  try {
    await assert.rejects(runReleaseChannels({ common, log() {}, run: async file => {
      const config = JSON.parse(readFileSync(file));
      started.push(config.channel);
      assert.equal(config.sha256, common.sha256);
      if (started.length === 3) release();
      await barrier;
      if (config.channel === 'gitee') throw Error('quota');
      finished.push(config.channel);
    } }), /gitee 未完成/);
    assert.deepEqual(started, ['github', 'gitee', 'npm']);
    assert.deepEqual(finished.sort(), ['github', 'npm']);
    const report = JSON.parse(readFileSync(path.join(common.out, 'channels.json')));
    assert.equal(report.channels.github.status, 'verified');
    assert.equal(report.channels.npm.status, 'verified');
    assert.equal(report.channels.gitee.status, 'failed');
  } finally { rmSync(common.out, { recursive: true, force: true }); }
});

test('changed shared artifact blocks all workers before publication', async () => {
  const common = fixture();
  try {
    writeFileSync(common.archive, 'different bytes');
    await assert.rejects(runReleaseChannels({ common, run: () => assert.fail('must not launch') }), /摘要不一致/);
  } finally { rmSync(common.out, { recursive: true, force: true }); }
});

test('worker launcher uses separate Node processes with argument arrays and handles spawn failure', async () => {
  let invocation;
  const spawnProcess = (...args) => {
    invocation = args;
    const child = new EventEmitter(); child.stdout = new PassThrough(); child.stderr = new PassThrough();
    queueMicrotask(() => child.emit('close', 0)); return child;
  };
  await spawnReleaseChannel('/tmp/配置 with spaces.json', { spawnProcess, log() {} });
  assert.equal(invocation[0], process.execPath);
  assert.equal(invocation[1][1], '/tmp/配置 with spaces.json');
  assert.equal(invocation[2].shell, false);
  await assert.rejects(spawnReleaseChannel('config', { log() {}, spawnProcess() {
    const child = new EventEmitter(); queueMicrotask(() => child.emit('error', Error('ENOENT'))); return child;
  } }), /无法启动/);
});

test('npm accepted or unknown submission is checked on resume without a second PUT', async () => {
  const common = fixture(); let publishes = 0, checks = 0;
  try {
    await assert.rejects(publishNpmChannel(common, { publish: async () => { publishes++; throw Error('response lost'); }, verify: async () => false, attempts: 1 }), /不重复上传/);
    assert.equal(publishes, 1);
    await publishNpmChannel(common, { publish: () => assert.fail('must not publish again'), verify: async () => ++checks > 1, wait: async () => {}, attempts: 2 });
    assert.equal(checks, 2); assert.equal(publishes, 1);
    assert.equal(JSON.parse(readFileSync(path.join(common.out, 'npm-submission.json'))).status, 'verified');
    assert.equal(existsSync(path.join(common.out, 'npm-publish.lock')), false);
    await assert.rejects(publishNpmChannel({ ...common, sha256: 'different' }, { publish() {}, verify() {} }), /记录与成品不一致/);
  } finally { rmSync(common.out, { recursive: true, force: true }); }
});

test('npm publisher lock prevents concurrent attempts for one version', async () => {
  const common = fixture(); let unblock, entered;
  const active = new Promise(resolve => { entered = resolve; });
  const done = new Promise(resolve => { unblock = resolve; });
  try {
    const first = publishNpmChannel(common, { publish: async () => { entered(); await done; }, verify: async () => true });
    await active;
    await assert.rejects(publishNpmChannel(common, { publish: () => assert.fail('duplicate publish'), verify: async () => true }), /EEXIST/);
    unblock(); await first;
  } finally { rmSync(common.out, { recursive: true, force: true }); }
});
