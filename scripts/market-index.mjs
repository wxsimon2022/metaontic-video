/**
 * 生成 DSH 插件市场索引（格式 1）：market/index.json。
 *
 * 索引格式由宿主的 @deepseek-ai/dsh-plugin-market-index 定义，DSH 的「插件 → 发现」页
 * 只读取用户自己添加的索引源；官方目前不提供内置市场，收录即“把这份索引作为索引源交给用户添加”。
 * 索引随仓库发布：https://gitee.com/hackloop/metaontic-video/raw/master/market/index.json
 *
 * 已发布到 npm 的版本用 npm 来源（大陆会经 registry.npmmirror.com 安装，详细介绍走 CDN），
 * 其余版本退回 Git 来源固定到发布提交。加 --no-registry 可跳过 npm 查询，全部按 Git 来源生成。
 *
 * 用法：node scripts/market-index.mjs [输出路径] [--no-registry]
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// 索引里的安装来源：Git 来源固定到提交，所以直接指向 Gitee 主仓库。
// 本仓库的 GitHub 镜像已停在 v3.26.0，不能作为安装来源；`repository` 与 `homepage` 同样按此口径。
const REPOSITORY = 'https://gitee.com/hackloop/metaontic-video.git';
const HOMEPAGE = 'https://ai.mybfs.cn';
const MAX_VERSIONS = 5;
const NPM_REGISTRY = 'https://registry.npmjs.org/';

const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const git = (...args) => execFileSync('git', args, { cwd: root }).toString().trim();
const argv = process.argv.slice(2);
const skipRegistry = argv.includes('--no-registry');
const unknown = argv.filter((arg) => arg.startsWith('--') && arg !== '--no-registry');
if (unknown.length > 0) throw new Error(`未知参数：${unknown.join(' ')}（可用：--no-registry）`);
// 只把第一个非选项参数当输出路径，避免把 --no-registry 误当成文件名。
const positional = argv.filter((arg) => !arg.startsWith('--'));
if (positional.length > 1) throw new Error(`只接受一个输出路径，收到：${positional.join(' ')}`);

/** 该版本在 npm 官方 registry 的发布时间（秒）；查不到或查不动时返回 undefined，退回 Git 来源。 */
async function npmPublishTime(version) {
  if (skipRegistry) return undefined;
  try {
    const response = await fetch(`${NPM_REGISTRY}${pkg.name}`, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) return undefined;
    const published = (await response.json()).time?.[version];
    const seconds = published === undefined ? Number.NaN : Math.floor(Date.parse(published) / 1000);
    return Number.isFinite(seconds) ? seconds : undefined;
  } catch {
    return undefined;
  }
}

const tags = git('tag', '--sort=-v:refname', '--list', 'v[0-9]*.[0-9]*.[0-9]*')
  .split('\n')
  .filter(Boolean)
  .slice(0, MAX_VERSIONS);
if (tags.length === 0) throw new Error('仓库里没有 vX.Y.Z 标签，先发一版再生成索引');

const engines = { dsh: pkg.engines?.dsh ?? '*' };
const versions = [];
for (const tag of tags) {
  const version = tag.replace(/^v/, '');
  const [commit, timestamp] = git('log', '-1', '--format=%H %ct', tag).split(' ');
  const published = await npmPublishTime(version);
  versions.push({
    version,
    publishTimestamp: published ?? Number(timestamp),
    source: published === undefined ? { type: 'git', url: REPOSITORY, commit } : { type: 'npm' },
    engines,
  });
}

const index = {
  format: 1,
  title: { en: 'MetaOntic Video', zh: 'MetaOntic 视频' },
  description: { en: 'DSH video creation bundles published by MetaOntic.', zh: 'MetaOntic 发布的 DSH 视频创作组合包。' },
  metadata: {
    categories: { video: { title: { en: 'Video', zh: '视频创作' } } },
    labels: {
      'video-director': { title: { en: 'Video director', zh: '视频导演' } },
      'promo-video': { title: { en: 'Promo video', zh: '宣传短片' } },
    },
    sortKeys: {},
  },
  plugins: [
    {
      name: pkg.name,
      title: { en: 'MetaOnticVideo', zh: 'MetaOnticVideo' },
      description: {
        en: pkg.description,
        zh: '让新手快速上手视频创作：说出想法，助手带你完善创意、写脚本并确认制作；通过分段续拍与本机合并，提供低成本长视频生成方案。',
      },
      icon: `data:image/svg+xml;base64,${readFileSync(join(root, 'icon.svg')).toString('base64')}`,
      author: 'MetaOntic',
      homepage: HOMEPAGE,
      repository: { url: REPOSITORY.replace(/\.git$/, '') },
      metadata: { category: 'video', keywords: pkg.keywords ?? [], labels: ['video-director', 'promo-video'], sortKeys: {} },
      'dist-tags': { latest: versions[0].version },
      versions,
    },
  ],
};

const target = positional[0] ? resolve(positional[0]) : join(root, 'market', 'index.json');
writeFileSync(target, `${JSON.stringify(index, null, 2)}\n`);
console.log(`已写入 ${target}（${versions.length} 个版本，最新 ${versions[0].version}）`);
for (const item of versions) console.log(`  ${item.version} ${item.source.type === 'npm' ? 'npm 来源（大陆走 registry.npmmirror.com）' : 'Git 来源（Gitee 提交）'}`);
