/**
 * 把已经发布到 Gitee 的成品包发布到 npm（npmjs.com）。
 *
 * 国内镜像源 registry.npmmirror.com 是只读同步镜像，不提供发布服务：
 * 包必须先发到 npmjs，npmmirror 才会同步过去。DSH 的插件管理页会在
 * registry.npmjs.org 与 registry.npmmirror.com 之间竞速探测，大陆网络会选中 npmmirror，
 * 所以市场索引里 npm 来源的版本在大陆是走镜像安装的，详细介绍也会优先从 npmmirror 的 CDN 读取。
 *
 * 用法：
 *   npm run npm:publish                 # 发布 package.json 的当前版本
 *   npm run npm:publish -- 3.29.2       # 发布指定版本
 *   npm run npm:publish -- --dry-run    # 只做检查，不真正上传
 * 凭据：npm 登录态，或环境变量 NPM_TOKEN（CI 用）。
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REGISTRY = 'https://registry.npmjs.org/';
const argv = process.argv.slice(2);
const dryRun = argv.includes('--dry-run');
const version = argv.find((arg) => /^\d+\.\d+\.\d+$/.test(arg)) ?? JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version;

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
const manifestName = 'package/package.json';
if (!entries.includes(manifestName)) throw new Error(`${archive} 里没有 ${manifestName}，不是可发布的成品包`);
if (entries.includes('package/README.md')) throw new Error(`${archive} 仍带 package/README.md，宿主插件页会把它当详细介绍渲染；先跑 scripts/strip-package-readme.py`);
console.log(`成品包：${archive}`);
console.log(`条目：${entries.length} 个，包内无 README（符合发布约定）`);

const whoami = spawnSync('npm', ['whoami', '--registry', REGISTRY], { cwd: root, encoding: 'utf8' });
if (whoami.status !== 0) {
  throw new Error(
    'npm 未登录或凭据无效。先执行 npm login --registry ' + REGISTRY +
    '，或在环境里设置 NPM_TOKEN（CI 用：npm config set //registry.npmjs.org/:_authToken "$NPM_TOKEN"）',
  );
}
console.log(`已登录 npm：${whoami.stdout.trim()}`);

const args = ['publish', archive, '--registry', REGISTRY, '--access', 'public', '--tag', 'latest'];
if (dryRun) args.push('--dry-run');
console.log(`执行：npm ${args.join(' ')}`);
execFileSync('npm', args, { cwd: root, stdio: 'inherit' });

if (dryRun) {
  console.log('DRY RUN 结束，未上传。');
} else {
  console.log(`\n已发布 metaontic-video@${version} 到 npmjs。`);
  console.log(`国内镜像同步状态：https://npmmirror.com/package/metaontic-video`);
  console.log('同步完成后，DSH 里 npm 来源的市场条目在大陆会经 registry.npmmirror.com 安装。');
  console.log('记得重跑 npm run market:index，把该版本切换为 npm 来源。');
}
