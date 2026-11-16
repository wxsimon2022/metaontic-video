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
 *
 * 凭据按顺序取：环境变量 NPM_TOKEN → 本地令牌文件 .local/npm-token → npm 登录态（~/.npmrc）。
 * 本地令牌用 npm run npm:token 保存，文件在 .local/ 下、已被 .gitignore 忽略，不会进仓库或发布包。
 * 账号开启 2FA 后，令牌必须是带 bypass 2FA 的 granular access token，否则 npmjs 返回 E403。
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REGISTRY = 'https://registry.npmjs.org/';
const TOKEN_FILE = join(ROOT, '.local', 'npm-token');

/** 本地令牌文件位置：放在 .local/ 下，随仓库一起被忽略，不进发布包。 */
export function tokenPath(root = ROOT) {
  return join(root, '.local', 'npm-token');
}

/** 解析要用哪份凭据，不联网、不打印令牌。env 优先于本地文件，都没有就交给 npm 自己的登录态。 */
export function credentialFrom(env = process.env, file = tokenPath()) {
  const fromEnv = typeof env.NPM_TOKEN === 'string' ? env.NPM_TOKEN.trim() : '';
  if (fromEnv !== '') return { source: 'env', token: fromEnv, file };
  if (existsSync(file)) {
    const token = readFileSync(file, 'utf8').trim();
    if (token === '') throw new Error(`${file} 是空文件；用 npm run npm:token 写入令牌，或删掉它`);
    return { source: 'file', token, file };
  }
  return { source: 'npmrc', file };
}

/** 凭据来源说明；只描述来源，不暴露令牌内容。 */
export function credentialLabel(credential) {
  if (credential.source === 'env') return '环境变量 NPM_TOKEN';
  if (credential.source === 'file') return `本地令牌文件 ${credential.file}`;
  return 'npm 登录态（~/.npmrc）';
}

/** 列出 tar 条目名，用来确认成品包已按约定裁掉包内 README。 */
export function tarEntries(buffer) {
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

/** 解析命令行；未知参数直接拒绝，避免把路径之类的东西当版本号。 */
export function parseArgs(argv) {
  const consumed = new Set();
  const dryRun = argv.includes('--dry-run');
  if (dryRun) consumed.add('--dry-run');
  const otpAt = argv.findIndex((arg) => arg === '--otp' || arg.startsWith('--otp='));
  let otp;
  if (otpAt >= 0) {
    const inline = argv[otpAt].includes('=');
    otp = inline ? argv[otpAt].split('=')[1] : argv[otpAt + 1];
    consumed.add(argv[otpAt]);
    if (!inline) consumed.add(argv[otpAt + 1]);
  }
  const positional = argv.filter((arg) => !consumed.has(arg));
  const version = positional.find((arg) => /^\d+\.\d+\.\d+$/.test(arg));
  const extra = positional.filter((arg) => arg !== version);
  if (extra.length > 0) throw new Error(`未知参数：${extra.join(' ')}（可用：<版本>、--otp <验证码>、--dry-run）`);
  if (dryRun && otp) throw new Error('--dry-run 不需要验证码');
  return { version, otp, dryRun };
}

export function main(argv = process.argv.slice(2), env = process.env) {
  const { version: requested, otp, dryRun } = parseArgs(argv);
  const version = requested ?? JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).version;

  const archive = join(ROOT, '.local', 'releases', version, `metaontic-video-${version}.tgz`);
  if (!existsSync(archive)) throw new Error(`缺少成品包 ${archive}；先按 README 的发布规范产出该版本`);
  const entries = tarEntries(gunzipSync(readFileSync(archive)));
  if (!entries.includes('package/package.json')) throw new Error(`${archive} 里没有 package/package.json，不是可发布的成品包`);
  if (entries.includes('package/README.md')) throw new Error(`${archive} 仍带 package/README.md，宿主插件页会把它当详细介绍渲染；先跑 scripts/strip-package-readme.py`);
  console.log(`成品包：${archive}`);
  console.log(`条目：${entries.length} 个，包内无 README（符合发布约定）`);

  const credential = credentialFrom(env);
  console.log(`凭据：${credentialLabel(credential)}`);
  if (credential.source === 'file' && (statSync(credential.file).mode & 0o077) !== 0) {
    console.warn(`提示：${credential.file} 对同机其他用户可读，建议 chmod 600 后重试（不影响本次发布）。`);
  }

  // 令牌走临时 userconfig，不改动用户自己的 ~/.npmrc；只在子进程可见，且不打印内容。
  let tokenConfig;
  const cleanup = () => { if (tokenConfig) { rmSync(dirname(tokenConfig), { recursive: true, force: true }); tokenConfig = undefined; } };
  if (credential.token) {
    tokenConfig = join(mkdtempSync(join(tmpdir(), 'metaontic-npm-')), '.npmrc');
    writeFileSync(tokenConfig, `//registry.npmjs.org/:_authToken=${credential.token}\n`, { mode: 0o600 });
  }
  const base = ['--registry', REGISTRY, ...(tokenConfig ? ['--userconfig', tokenConfig] : [])];

  try {
    const whoami = spawnSync('npm', ['whoami', ...base], { cwd: ROOT, encoding: 'utf8' });
    if (whoami.status !== 0) {
      throw new Error(
        'npm 未登录或凭据无效。用 npm run npm:token 保存带 bypass 2FA 的令牌，'
        + `或在环境里设置 NPM_TOKEN；也可以先本机执行 npm login --registry ${REGISTRY}`,
      );
    }
    console.log(`已登录 npm：${whoami.stdout.trim()}`);

    const args = ['publish', archive, ...base, '--access', 'public', '--tag', 'latest'];
    if (dryRun) args.push('--dry-run');
    if (otp) args.push('--otp', otp);
    console.log(`执行：npm ${args.map((arg) => (arg === otp ? '<验证码>' : arg === tokenConfig ? '<临时凭据文件>' : arg)).join(' ')}`);
    execFileSync('npm', args, { cwd: ROOT, stdio: 'inherit' });
  } catch (error) {
    // 账号开了 2FA 时 npmjs 返回 403，这里换成可照做的说明，而不是把原始堆栈甩给用户。
    if (/E403|bypass 2fa|two-factor/i.test(String(error?.message))) {
      throw new Error(
        'npmjs 拒绝发布（E403）。两种做法二选一——\n'
        + '  1) 账号开了 2FA、凭据不能绕过时，带一次性验证码：npm run npm:publish -- --otp 123456（验证码 30 秒有效）\n'
        + '  2) 到 npmjs 生成带 Bypass 2FA 的 granular access token，用 npm run npm:token 保存后重跑\n'
        + '若在受限网络或代理下运行，E403 也可能来自网络被拦截；先确认能直连 https://registry.npmjs.org/',
      );
    }
    throw error;
  } finally {
    cleanup();
  }

  if (dryRun) {
    console.log('DRY RUN 结束，未上传。');
    return;
  }
  console.log(`\n已发布 metaontic-video@${version} 到 npmjs。`);
  console.log('国内镜像同步状态：https://npmmirror.com/package/metaontic-video');
  console.log('同步完成后，DSH 里 npm 来源的市场条目在大陆会经 registry.npmmirror.com 安装。');
  console.log('记得重跑 npm run market:index，把该版本切换为 npm 来源。');
}

if (process.argv[1] && import.meta.url === new URL(`file://${resolve(process.argv[1])}`).href) main();
