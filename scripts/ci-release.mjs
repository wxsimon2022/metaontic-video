/** 流水线发版：在 Gitee Go 构建机上把本次标签对应的成品发布成 Gitee Release。
 *  与本地发版共用 scripts/publish-gitee.mjs，靠「同版本已有的同大小附件只核对、不重建、不覆盖」保证幂等，
 *  所以先由本地脚本发布还是先由流水线发布都不会出现两份成品。
 *  只处理 vX.Y.Z 正式标签：ci- 演练标签、分支运行、PR 运行一律跳过，跳过不算失败。
 *  发版令牌只从流水线变量/环境读（GITEE_TOKEN 或别名），不写进仓库与流水线 YAML。 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { publishGitee } from './publish-gitee.mjs';
import { publicReleaseNotes } from './release.mjs';

/** 令牌的候选环境变量名：流水线里叫哪个都能用，未配置时按第一个名字提示。 */
export const TOKEN_NAMES = ['GITEE_TOKEN', 'GITEE_ACCESS_TOKEN', 'TOKEN_GITEE', 'GITEE_API_TOKEN'];

export function resolveToken(env = process.env) {
  for (const name of TOKEN_NAMES) {
    const token = String(env?.[name] ?? '').trim();
    if (token) return { name, token };
  }
  return { name: '', token: '' };
}

/** 标签 → 版本：只有 vX.Y.Z 正式标签才发布；其它（ci- 演练、预发布、分支）返回空。 */
export function versionOfTag(tag) {
  const text = String(tag || '').trim();
  return /^v\d+\.\d+\.\d+$/.test(text) ? text.slice(1) : '';
}

/** 发行说明只从结构化 releaseNotes 生成，不读旧标签里的验证信息；正式版必须 prerelease:false。 */
export function releaseNotesOf(pkg, version) {
  const notes = pkg?.releaseNotes;
  if (!notes || String(notes.version) !== version) throw new Error(`package.json 的 releaseNotes 不是 v${version} 这一版：先同步版本号与更新内容，再重新打标签。`);
  if (notes.prerelease === true) throw new Error('只发布正式版：releaseNotes.prerelease 必须为 false。');
  return { notes: publicReleaseNotes(version, notes.items), items: notes.items };
}

/** 流水线发版主流程：标签与包版本一致 → 找到成品 → 核对更新内容 → 校验令牌 → 发布并核对附件。 */
export async function runCiRelease({ cwd = process.cwd(), dist = 'dist', tag = '', env = process.env, publish = publishGitee, log = console.log } = {}) {
  const name = String(tag || env?.GITEE_TAG || env?.GITEE_REF_NAME || env?.CI_COMMIT_TAG || '').trim();
  const version = versionOfTag(name);
  if (!version) {
    log(`流水线发版：本次不是正式版标签（${name || '无标签'}），只留制品、不发布 Release。`);
    return { status: 'skipped', reason: 'not-a-version-tag', tag: name };
  }
  const pkgPath = path.join(cwd, 'package.json');
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
  if (String(pkg.version) !== version) throw new Error(`标签 ${name} 与包内版本 v${pkg.version} 不一致：先按标签更新版本号与 releaseNotes，再重新打标签。`);
  const { notes } = releaseNotesOf(pkg, version);
  const archive = path.join(cwd, dist, `metaontic-video-${version}.tgz`);
  if (!existsSync(archive)) throw new Error(`没有找到本次成品 ${path.relative(cwd, archive)}：请确认打包步骤已经跑过，且流水线制品目录与 --dist 一致。`);
  const { name: tokenName, token } = resolveToken(env);
  if (!token) throw new Error(`流水线里没有配置发版令牌：请在 Gitee 流水线变量里添加 ${TOKEN_NAMES[0]}（勾选私密），或改用别名 ${TOKEN_NAMES.slice(1).join(' / ')}。`);
  const bytes = readFileSync(archive);
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  const notesFile = path.join(cwd, dist, 'release-notes.txt');
  writeFileSync(notesFile, notes);
  log(`流水线发版：${name} · ${path.basename(archive)} · ${bytes.length} 字节 · sha256 ${sha256} · 令牌来自 ${tokenName}`);
  const url = await publish({ token, tag: name, archive, notes, prerelease: false });
  log(`流水线发版完成并核对通过：${url}`);
  return { status: 'published', tag: name, version, archive, bytes: bytes.length, sha256, notes: notesFile, url };
}

const usage = `流水线发版：把 dist 里本次标签的成品发布成 Gitee Release（幂等，可重复运行）。
  node scripts/ci-release.mjs --dist dist --tag v3.24.2
只处理 vX.Y.Z 正式标签；ci- 演练标签与分支运行会跳过并返回 0。
令牌从环境变量读取，优先 GITEE_TOKEN，其次 GITEE_ACCESS_TOKEN / TOKEN_GITEE / GITEE_API_TOKEN。
--dist <目录> 成品目录（默认 dist）；--tag <标签> 本次标签（默认读 GITEE_TAG / GITEE_REF_NAME / CI_COMMIT_TAG）。
--help 显示本说明。`;

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const argv = process.argv.slice(2);
  const value = flag => { const at = argv.indexOf(flag); return at >= 0 ? argv[at + 1] : undefined; };
  if (argv.includes('--help') || argv.includes('-h')) console.log(usage);
  else runCiRelease({ dist: value('--dist') || 'dist', tag: value('--tag') || '' })
    .catch(error => { console.error(`流水线发版停止：${error.message}`); process.exitCode = 1; });
}
