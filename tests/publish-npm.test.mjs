import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { credentialFrom, credentialLabel, parseArgs, tokenPath } from '../scripts/publish-npm.mjs';

test('publish credentials prefer the env var, then the local token file, then the npm login', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'meta-npm-credential-'));
  const file = path.join(dir, 'npm-token');
  try {
    // 没有环境变量、没有本地文件时交给 npm 自己的登录态，不报错。
    assert.deepEqual(credentialFrom({}, file), { source: 'npmrc', file });
    // 本地文件存在就用它，并去掉换行与首尾空格。
    await writeFile(file, '\n npm_token_from_file \n');
    assert.deepEqual(credentialFrom({}, file), { source: 'file', token: 'npm_token_from_file', file });
    // CI 会传 NPM_TOKEN，它优先于本地文件。
    assert.equal(credentialFrom({ NPM_TOKEN: ' npm_token_from_env ' }, file).source, 'env');
    assert.equal(credentialFrom({ NPM_TOKEN: 'npm_token_from_env' }, file).token, 'npm_token_from_env');
    // 来源说明只讲来源，不回显令牌。
    assert.ok(credentialLabel({ source: 'file', file }).includes(file));
    assert.match(credentialLabel({ source: 'npmrc' }), /npm 登录态/);
    assert.ok(!credentialLabel({ source: 'env' }).includes('npm_token_from_env'));
    // 空文件要直接报错，不能悄悄退回登录态去发另一个账号的包。
    await writeFile(file, '\n  \n');
    assert.throws(() => credentialFrom({}, file), /空文件/);
    // 令牌文件固定落在 .local/ 下，才会随仓库一起被忽略、不进发布包。
    assert.match(tokenPath('/repo'), /\.local[\\/]npm-token$/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('publish arguments reject unknown flags instead of treating them as a version', () => {
  assert.deepEqual(parseArgs(['3.29.2']), { version: '3.29.2', otp: undefined, dryRun: false });
  assert.deepEqual(parseArgs(['--dry-run']), { version: undefined, otp: undefined, dryRun: true });
  assert.deepEqual(parseArgs(['--otp', '123456']), { version: undefined, otp: '123456', dryRun: false });
  assert.deepEqual(parseArgs(['--otp=123456', '3.29.2']), { version: '3.29.2', otp: '123456', dryRun: false });
  assert.deepEqual(parseArgs([]), { version: undefined, otp: undefined, dryRun: false });
  assert.throws(() => parseArgs(['--bogus']), /未知参数/);
  assert.throws(() => parseArgs(['./some/path']), /未知参数/);
  assert.throws(() => parseArgs(['--dry-run', '--otp', '123456']), /不需要验证码/);
});
