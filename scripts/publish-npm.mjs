/**
 * 把已经发布到 Gitee 的成品包发布到 npm（npmjs.com）。
 *
 * 国内镜像源 registry.npmmirror.com 是只读同步镜像，不提供发布服务，登录它也不能发布：
 * 包必须先发到 npmjs，npmmirror 才会同步过去。DSH 的插件管理页会在
 * registry.npmjs.org 与 registry.npmmirror.com 之间竞速探测，大陆网络会选中 npmmirror，
 * 所以市场索引里 npm 来源的版本在大陆是走镜像安装的，详细介绍也会优先从 npmmirror 的 CDN 读取。
 *
 * 用法：
 *   npm run npm:publish                    # 发布 package.json 的当前版本
 *   npm run npm:publish -- 3.29.2          # 发布指定版本
 *   npm run npm:publish -- --otp 123456    # 账号开了 2FA 时用一次性验证码
 *   npm run npm:publish -- --dry-run       # 只做检查，不真正上传
 * 凭据：npm 登录态，或环境变量 NPM_TOKEN（CI 用；需为带 bypass 2FA 的 automation/granular token）。
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REGISTRY = 'https://registry.npmjs.org/';
const argv = process.argv.slice(2);
const dryRun = argv.includes('--dry-run');
const otpAt = argv.findIndex((arg) => arg === '--otp' || arg.startsWith('--otp='));
const otp = otpAt < 0 ? undefined : argv[otpAt].includes('=') ? argv[otpAt].split('=')[1] : argv[otpAt + 1];
const consumed = new Set(['--dry-run', ...(otpAt < 0 ? [] : (argv[otpAt].includes('=') ? [argv[otpAt]] : [argv[otpAt], argv[otpAt + 1]]))]);
const positional = argv.filter((arg) => !consumed.has(arg));
const version = positional.find((arg) => /^\d+\.\d+\.\d+$/.test(arg)) ?? JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version;
const extra = positional.filter((arg) => arg !== version);
if (extra.length > 0) throw new Error(`未知参数：${extra.join(' ')}（可用：<版本>、--otp <验证码>、--dry-run）`);
if (dryRun && otp) throw new Error('--dry-run 不需要验证码');

/** 列出 tar 条目名，用来确认成品包已按约定裁掉包内 README。 */
function tarEntries(buffer) {
  const names = [];
  let offset = 0;
  while (offset + 512 <= buffer.length) {
    const header = buffer.subarray(offset, offset + 512);
    if (header.every((byte) => byte === 0)) break;
    const sizeField = header.subarray(124, 136).toString('utf8').replace(/\0.*$/, '').trim();
    const size = sizeField === '' ? 0 : Number.parseInt(sizeField, 8);
    names.push(header.subarray(0, 100).toString('utf8').replace(/\0.*$/, ''));
    offset += 512 + Math.ceil(size / 512) * 512;
  }
  return names;
}

const archive = join(root, '.local', 'releases', version, `metaontic-video-${version}.tgz`);
if (!existsSync(archive)) throw new Error(`缺少成品包 ${archive}；先按 README 的发布规范产出该版本`);

const entries = tarEntries(gunzipSync(readFileSync(archive)));
if (!entries.includes('package/package.json')) throw new Error(`${archive} 里没有 package/package.json，不是可发布的成品包`);
if (entries.includes('package/README.md')) throw new Error(`${archive} 仍带 package/README.md，宿主插件页会把它当详细介绍渲染；先跑 scripts/strip-package-readme.py`);
console.log(`成品包：${archive}`);
console.log(`条目：${entries.length} 个，包内无 README（符合发布约定）`);

// NPM_TOKEN 走临时 userconfig，不改动用户自己的 ~/.npmrc；只在子进程可见，且不打印内容。
let tokenConfig;
const cleanupTokenConfig = () => { if (tokenConfig) { rmSync(dirname(tokenConfig), { recursive: true, force: true }); tokenConfig = undefined; } };
if (process.env.NPM_TOKEN) {
  tokenConfig = join(mkdtempSync(join(tmpdir(), 'metaontic-npm-')), '.npmrc');
  writeFileSync(tokenConfig, `//registry.npmjs.org/:_authToken=${process.env.NPM_TOKEN}\n`, { mode: 0o600 });
  console.log('凭据：环境变量 NPM_TOKEN（临时 userconfig，用完删除）');
} else {
  console.log('凭据：npm 登录态（~/.npmrc）');
}
const base = ['--registry', REGISTRY, ...(tokenConfig ? ['--userconfig', tokenConfig] : [])];

try {
  const whoami = spawnSync('npm', ['whoami', ...base], { cwd: root, encoding: 'utf8' });
  if (whoami.status !== 0) {
    throw new Error(
      'npm 未登录或凭据无效。本机执行 npm login --registry ' + REGISTRY +
      '，或在环境里设置带 bypass 2FA 的 NPM_TOKEN 后重试',
    );
  }
  console.log(`已登录 npm：${whoami.stdout.trim()}`);

  const args = ['publish', archive, ...base, '--access', 'public', '--tag', 'latest'];
  if (dryRun) args.push('--dry-run');
  if (otp) args.push('--otp', otp);
  console.log(`执行：npm ${args.map((arg) => (arg === otp ? '<验证码>' : arg.includes('_authToken') ? '<凭据>' : arg)).join(' ')}`);
  execFileSync('npm', args, { cwd: root, stdio: 'inherit' });
} catch (error) {
  // 账号开了 2FA 时 npmjs 返回 403，这里换成可照做的说明，而不是把原始堆栈甩给用户。
  if (/E403|bypass 2fa|two-factor/i.test(String(error?.message))) {
    throw new Error(
      'npmjs 拒绝发布：账号开启了 2FA。两种做法二选一——\n' +
      '  1) 带一次性验证码发布：npm run npm:publish -- --otp 123456（验证码 30 秒有效，等 npmjs 提示再输入）\n' +
      '  2) 在 npmjs 生成带 bypass 2FA 的 automation/granular token，导出 NPM_TOKEN 后重跑本命令（CI 用这个）',
    );
  }
  throw error;
} finally {
  cleanupTokenConfig();
}

if (dryRun) {
  console.log('DRY RUN 结束，未上传。');
} else {
  console.log(`\n已发布 metaontic-video@${version} 到 npmjs。`);
  console.log('国内镜像同步状态：https://npmmirror.com/package/metaontic-video');
  console.log('同步完成后，DSH 里 npm 来源的市场条目在大陆会经 registry.npmmirror.com 安装。');
  console.log('记得重跑 npm run market:index，把该版本切换为 npm 来源。');
}
