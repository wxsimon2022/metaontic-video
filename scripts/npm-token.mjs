/**
 * 本地保存 npm 发布令牌，供 scripts/publish-npm.mjs 直接读取，不用每次把令牌贴到命令行。
 *
 * 令牌写在 .local/npm-token（权限 0600）。.local/ 已被 .gitignore 忽略，
 * 既不进源码仓库，也不进插件发布包；脚本还会额外确认该文件没有被 git 跟踪。
 *
 * 用法：
 *   npm run npm:token -- <令牌>    保存并联网校验身份
 *   npm run npm:token -- --check   校验已保存的令牌
 *   npm run npm:token -- --clear   删除本地令牌
 *   npm run npm:token              只看当前凭据来源
 */
import { chmodSync, existsSync, mkdtempSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { credentialFrom, credentialLabel, tokenPath } from './publish-npm.mjs';

const REGISTRY = 'https://registry.npmjs.org/';
const file = tokenPath();

/** 令牌文件不能是仓库跟踪的文件，否则会连令牌一起提交。 */
function assertUntracked() {
  const tracked = spawnSync('git', ['ls-files', '--error-unmatch', '.local/npm-token'], { encoding: 'utf8' });
  if (tracked.status === 0) throw new Error('.local/npm-token 已被 git 跟踪，请先 git rm --cached 并确认忽略规则');
  const ignored = spawnSync('git', ['check-ignore', '-q', '.local/npm-token'], { encoding: 'utf8' });
  if (ignored.status !== 0) throw new Error('.local/npm-token 不在 .gitignore 忽略范围内，拒绝写入');
}

/** 只显示头尾，便于确认写的是哪个令牌，又不把整串令牌留到终端里。 */
function mask(token) {
  return token.length <= 12 ? `${token.slice(0, 4)}…` : `${token.slice(0, 8)}…${token.slice(-4)}`;
}

/** 用临时 userconfig 验证令牌有效；不打印令牌内容。 */
function verify(token) {
  const dir = mkdtempSync(join(tmpdir(), 'metaontic-npm-'));
  const config = join(dir, '.npmrc');
  writeFileSync(config, `//registry.npmjs.org/:_authToken=${token}\n`, { mode: 0o600 });
  try {
    const result = spawnSync('npm', ['whoami', '--registry', REGISTRY, '--userconfig', config], { encoding: 'utf8' });
    if (result.status !== 0) throw new Error('npm 不认这份令牌：检查是否已撤销、是否过期，或网络不可用');
    return result.stdout.trim();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const argv = process.argv.slice(2);
const flags = argv.filter((arg) => arg.startsWith('--'));
const values = argv.filter((arg) => !arg.startsWith('--'));
const unknown = flags.filter((flag) => !['--check', '--clear'].includes(flag));
if (unknown.length > 0) throw new Error(`未知参数：${unknown.join(' ')}（可用：<令牌>、--check、--clear）`);
if (flags.includes('--clear') && (values.length > 0 || flags.includes('--check'))) throw new Error('--clear 不能和令牌或 --check 同时用');
if (values.length > 1) throw new Error('一次只能保存一个令牌');

if (flags.includes('--clear')) {
  if (existsSync(file)) { rmSync(file, { force: true }); console.log(`已删除 ${file}`); } else console.log(`${file} 本来就不存在`);
} else if (values.length === 1) {
  const token = values[0].trim();
  if (token === '') throw new Error('令牌为空');
  assertUntracked();
  writeFileSync(file, `${token}\n`, { mode: 0o600 });
  chmodSync(file, 0o600);
  console.log(`已保存 ${file}（${mask(token)}，权限 ${(statSync(file).mode & 0o777).toString(8)}）`);
  console.log(`身份校验：${verify(token)}`);
  console.log('scripts/publish-npm.mjs 会自动读取它，next: npm run npm:publish');
} else {
  const credential = credentialFrom(process.env, file);
  console.log(`当前凭据来源：${credentialLabel(credential)}`);
  if (credential.source === 'file') {
    console.log(`令牌：${mask(credential.token)}（${file}）`);
    if (flags.includes('--check')) console.log(`身份校验：${verify(credential.token)}`);
  } else if (flags.includes('--check')) {
    throw new Error('没有本地令牌可校验；先用 npm run npm:token -- <令牌> 保存');
  } else if (credential.source === 'npmrc') {
    console.log(`提示：还没有本地令牌。执行 npm run npm:token -- <令牌> 保存后，发布时会优先使用它。`);
  }
}
