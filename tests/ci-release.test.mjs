import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { TOKEN_NAMES, resolveToken, versionOfTag, releaseNotesOf, parseReleaseNotes, notesFromInput, runCiRelease } from '../scripts/ci-release.mjs';
import { releaseVerification } from '../scripts/release.mjs';

/** 拼一个最小仓库：package.json 与 dist 里的成品。 */
async function fixture({ version = '1.0.0', prerelease = false, items = ['新增：流程画布可视化创作。', '优化：写脚本更快。'], archive = true, bytes = 'tgz-bytes' } = {}) {
  const dir = await mkdtemp(path.join(tmpdir(), 'ci-release-'));
  await mkdir(path.join(dir, 'dist'), { recursive: true });
  await writeFile(path.join(dir, 'package.json'), JSON.stringify({ version, releaseNotes: { version, prerelease, items } }));
  if (archive) await writeFile(path.join(dir, 'dist', `metaontic-video-${version}.tgz`), bytes);
  return dir;
}

test('流水线发版只在正式版标签上跑：ci- 演练标签、预发布标签、分支运行都跳过', () => {
  assert.equal(versionOfTag('v3.24.2'), '3.24.2');
  for (const tag of ['ci-test', 'v3.24.2-beta.1', '3.24.2', 'v3.24', 'master', '', undefined]) assert.equal(versionOfTag(tag), '', `不该发布：${tag}`);
});

test('发版令牌从流水线变量读：优先 GITEE_TOKEN，其余别名也能用，都没有才算缺令牌', () => {
  assert.deepEqual(TOKEN_NAMES[0], 'GITEE_TOKEN');
  assert.deepEqual(resolveToken({ TOKEN_GITEE: '  abc ' }), { name: 'TOKEN_GITEE', token: 'abc' });
  assert.deepEqual(resolveToken({ GITEE_ACCESS_TOKEN: 'x', TOKEN_GITEE: 'y' }), { name: 'GITEE_ACCESS_TOKEN', token: 'x' });
  assert.deepEqual(resolveToken({ GITEE_TOKEN: 'main', TOKEN_GITEE: 'other' }), { name: 'GITEE_TOKEN', token: 'main' });
  assert.deepEqual(resolveToken({ GITEE_TOKEN: '   ' }), { name: '', token: '' });
  assert.deepEqual(resolveToken({}), { name: '', token: '' });
});

test('发行说明只认本版 releaseNotes，且只发正式版', () => {
  const pkg = version => ({ version, releaseNotes: { version, prerelease: false, items: ['优化：写脚本更快。'] } });
  assert.match(releaseNotesOf(pkg('3.24.2'), '3.24.2').notes, /^MetaOnticVideo v3\.24\.2\n\n优化\n- 写脚本更快。\n$/);
  assert.throws(() => releaseNotesOf(pkg('3.24.1'), '3.24.2'), /releaseNotes 不是 v3\.24\.2/);
  assert.throws(() => releaseNotesOf({ version: '3.24.2' }, '3.24.2'), /releaseNotes 不是/);
  assert.throws(() => releaseNotesOf({ version: '3.24.2', releaseNotes: { version: '3.24.2', prerelease: true, items: ['优化：x。'] } }, '3.24.2'), /只发布正式版/);
  // 更新内容仍走本地发版同一套校验：超 100 字或自定义分类直接停。
  assert.throws(() => releaseNotesOf({ version: '3.24.2', releaseNotes: { version: '3.24.2', prerelease: false, items: ['优化：' + '字'.repeat(101)] } }, '3.24.2'), /100 字上限/);
  assert.throws(() => releaseNotesOf({ version: '3.24.2', releaseNotes: { version: '3.24.2', prerelease: false, items: ['修复：悄悄修好了。'] } }, '3.24.2'), /只展示「新增」与「优化」/);
});

test('流水线发版：缺成品、缺令牌、标签与包版本不一致都直接报错，不猜、不伪造发布', async () => {
  const dir = await fixture();
  try {
    await assert.rejects(runCiRelease({ cwd: dir, dist: 'dist', tag: 'v1.0.1', env: { GITEE_TOKEN: 't' }, log: () => {} }), /标签 v1\.0\.1 与包内版本 v1\.0\.0 不一致/);
    await assert.rejects(runCiRelease({ cwd: dir, dist: 'dist', tag: 'v1.0.0', env: {}, log: () => {} }), /没有配置发版令牌/);
    const empty = await fixture({ archive: false });
    try { await assert.rejects(runCiRelease({ cwd: empty, dist: 'dist', tag: 'v1.0.0', env: { GITEE_TOKEN: 't' }, log: () => {} }), /没有找到本次成品/); }
    finally { await rm(empty, { recursive: true, force: true }); }
    const beta = await fixture({ prerelease: true });
    try { await assert.rejects(runCiRelease({ cwd: beta, dist: 'dist', tag: 'v1.0.0', env: { GITEE_TOKEN: 't' }, log: () => {} }), /只发布正式版/); }
    finally { await rm(beta, { recursive: true, force: true }); }
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('流水线发版：正式版标签打包发布并核对附件，记录成品校验值', async () => {
  const dir = await fixture();
  const logs = [];
  try {
    const calls = [];
    const publish = async args => { calls.push(args); return 'https://gitee.com/hackloop/metaontic-video/releases/tag/v1.0.0'; };
    const result = await runCiRelease({ cwd: dir, dist: 'dist', tag: 'v1.0.0', env: { TOKEN_GITEE: 'pipeline-token' }, publish, log: line => logs.push(line) });
    assert.equal(result.status, 'published');
    assert.equal(result.version, '1.0.0');
    assert.equal(result.sha256, createHash('sha256').update('tgz-bytes').digest('hex'), '记录成品 sha256，便于与发布页附件比对');
    assert.equal(calls.length, 1);
    assert.deepEqual(Object.keys(calls[0]).sort(), ['archive', 'notes', 'prerelease', 'tag', 'token']);
    assert.equal(calls[0].token, 'pipeline-token');
    assert.equal(calls[0].tag, 'v1.0.0');
    assert.equal(calls[0].prerelease, false, '两仓都不标预发布');
    assert.equal(calls[0].archive, path.join(dir, 'dist', 'metaontic-video-1.0.0.tgz'));
    assert.equal(calls[0].notes, 'MetaOnticVideo v1.0.0\n\n新增\n- 流程画布可视化创作。\n\n优化\n- 写脚本更快。\n');
    assert.equal(await readFile(path.join(dir, 'dist', 'release-notes.txt'), 'utf8'), calls[0].notes, '说明落盘，随流水线制品留存');
    assert.ok(logs.join('\n').includes('sha256'), '日志里给出体积与校验值，便于事后核对');
    // 重复运行（例如重新触发流水线）不会重建发行版：幂等由 publishGitee 保证。
    await runCiRelease({ cwd: dir, dist: 'dist', tag: 'v1.0.0', env: { GITEE_TOKEN: 'pipeline-token' }, publish, log: line => logs.push(line) });
    assert.equal(calls.length, 2);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('流水线发版：没有标签信息时按跳过处理，返回 0', async () => {
  const dir = await fixture();
  try {
    let called = 0;
    const result = await runCiRelease({ cwd: dir, dist: 'dist', tag: '', env: { GITEE_REF_NAME: 'master', GITEE_TOKEN: 't' }, publish: async () => { called++; }, log: () => {} });
    assert.equal(result.status, 'skipped');
    assert.equal(result.reason, 'not-a-version-tag');
    assert.equal(called, 0, '跳过时不联网发布');
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('发版描述：逐行「新增／优化」或整段正文都能解析，条目照旧只收这两类', () => {
  assert.deepEqual(parseReleaseNotes('新增：流程画布可视化创作。\n优化：写脚本更快；连拍不重复计费。'),
    ['新增：流程画布可视化创作。', '优化：写脚本更快；连拍不重复计费。']);
  assert.deepEqual(parseReleaseNotes('MetaOnticVideo v1.0.0\n\n新增\n- 流程画布可视化创作。\n\n优化\n- 写脚本更快。'),
    ['新增：流程画布可视化创作。', '优化：写脚本更快。']);
  assert.deepEqual(parseReleaseNotes('随便写点什么'), [], '解析不出条目就交给调用方报错，不猜');
  assert.deepEqual(parseReleaseNotes('修复：悄悄修好了。'), []);
  const items = ['新增：流程画布可视化创作。', '优化：写脚本更快。'];
  assert.deepEqual(notesFromInput('新增：流程画布可视化创作。\n优化：写脚本更快。', '1.0.0', items), { notes: '', changed: false }, '与 package.json 一致时不重复生成');
  const changed = notesFromInput('优化：写脚本更快。', '1.0.0', items);
  assert.equal(changed.changed, true);
  assert.equal(changed.notes, 'MetaOnticVideo v1.0.0\n\n优化\n- 写脚本更快。\n');
  // 发版描述仍走同一套校验：超 100 字、或写了修复分类都会被拦下。
  assert.throws(() => notesFromInput('优化：' + '字'.repeat(101), '1.0.0', items), /100 字上限/);
  assert.deepEqual(notesFromInput('修复：悄悄修好了。', '1.0.0', []), { notes: '', changed: false }, '解析不出条目时不生成正文，交给 runCiRelease 明确报错');
});

test('手动运行流水线：RELEASE_TAG 指标签、RELEASE_NOTES 指发版描述，成品与包版本仍必须一致', async () => {
  const dir = await fixture();
  try {
    const calls = [];
    const publish = async args => { calls.push(args); return 'https://gitee.com/hackloop/metaontic-video/releases/tag/v1.0.0'; };
    await runCiRelease({ cwd: dir, dist: 'dist', tag: '', env: { RELEASE_TAG: 'v1.0.0', RELEASE_NOTES: '优化：连拍跳过已有成果的段。', GITEE_TOKEN: 't' }, publish, log: () => {} });
    assert.equal(calls[0].tag, 'v1.0.0');
    assert.equal(calls[0].notes, 'MetaOnticVideo v1.0.0\n\n优化\n- 连拍跳过已有成果的段。\n', '发行版正文用手动填写的描述');
    assert.equal(await readFile(path.join(dir, 'dist', 'release-notes.txt'), 'utf8'), calls[0].notes);
    // 描述写错格式要直接报错，不能悄悄退回 package.json 的说明。
    await assert.rejects(runCiRelease({ cwd: dir, dist: 'dist', tag: '', env: { RELEASE_TAG: 'v1.0.0', RELEASE_NOTES: '这次改了不少东西', GITEE_TOKEN: 't' }, publish, log: () => {} }), /没有可用的更新条目/);
    // 手动填的标签同样要跟包内版本对得上。
    await assert.rejects(runCiRelease({ cwd: dir, dist: 'dist', tag: '', env: { RELEASE_TAG: 'v9.9.9', GITEE_TOKEN: 't' }, publish, log: () => {} }), /与包内版本 v1\.0\.0 不一致/);
    assert.equal(calls.length, 1, '报错的两次都没有发布');
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('流水线发版接在 Gitee Go 流水线的打包步骤后面，只对 v 标签发布', async () => {
  const workflow = await readFile(new URL('../.workflow/MetaOnticVideo.yml', import.meta.url), 'utf8');
  assert.match(workflow, /node scripts\/ci-release\.mjs --dist dist --tag "\$TAG"/);
  assert.match(workflow, /if \[ -n "\$TAG" \] && \[ "\$\{TAG#v\}" != "\$TAG" \]/);
  assert.doesNotMatch(workflow, /GITEE_TOKEN:\s*\S+/, '令牌不写进流水线文件，只在流水线变量里配置');
  // 手动运行时可以填标签与发版描述：变量在流水线里可填，步骤里按填写的值发布。
  assert.match(workflow, /RELEASE_TAG:\n\s+type: TEXT/);
  assert.match(workflow, /RELEASE_NOTES:\n\s+type: TEXT/);
  assert.match(workflow, /if \[ -n "\$RELEASE_TAG" \]; then echo "手动填写的标签：\$RELEASE_TAG"; TAG="\$RELEASE_TAG"; fi/);
  // 成品要进制品库长期留档：只声明 artifacts 只是当次运行的暂存构建物，必须有「上传制品」步骤。
  assert.match(workflow, /- name: PLUGIN_PACKAGE\n\s+path:\n\s+- \.\/dist/);
  assert.match(workflow, /- step: publish@general_artifacts/);
  assert.match(workflow, /dependArtifact: PLUGIN_PACKAGE/);
  assert.match(workflow, /artifactName: metaontic-video/);
  assert.match(workflow, /dependsOn: build_test/);
  // 正式版发完 Gitee Release 后把标签推到 GitHub：令牌走 GIT_ASKPASS，不能出现在命令行与日志里。
  assert.match(workflow, /if \[ -z "\$TAG" \] \|\| \[ "\$\{TAG#v\}" = "\$TAG" \]; then echo "本次不是正式版标签，不同步 GitHub"/);
  assert.match(workflow, /elif \[ -z "\$GITHUB_TOKEN" \]; then echo "没有配置 GITHUB_TOKEN/);
  assert.match(workflow, /GIT_ASKPASS=\/tmp\/gh-askpass\.sh GIT_TERMINAL_PROMPT=0 git push "\$GHURL" "\$REF"/);
  assert.match(workflow, /github\.com\/wxsimon2022\/metaontic-video\.git/);
  assert.doesNotMatch(workflow, /github\.com[^"\n]*\$GITHUB_TOKEN/, '令牌不能直接拼进推送地址');
});

test('GitHub 侧按标签发布时复用 Gitee 或本机草稿中的同一份成品', async () => {
  const workflow = await readFile(new URL('../.github/workflows/publish.yml', import.meta.url), 'utf8');
  // 标签触发：先看 Gitee 有没有这一版，有就镜像同一个 tgz（不重打包），没有则等待本机上传草稿成品。
  assert.match(workflow, /releases\/tags\/v\$VERSION/);
  assert.match(workflow, /echo "mirror=1" >> "\$GITHUB_OUTPUT"; echo "version=\$VERSION" >> "\$GITHUB_OUTPUT"; echo "sha=-" >> "\$GITHUB_OUTPUT"/);
  assert.match(workflow, /if: \$\{\{ steps\.source\.outputs\.mirror == 'staged' \}\}/);
  assert.match(workflow, /if: \$\{\{ steps\.source\.outputs\.mirror == '1' \}\}/);
  assert.match(workflow, /python3 scripts\/download-published-release\.py "\$\{\{ steps\.source\.outputs\.version \}\}" dist "\$\{\{ steps\.source\.outputs\.sha \}\}"/);
  // 手动镜像（existing_version）仍必须带上原成品 sha256，不能退化成不校验。
  assert.match(workflow, /test "\$SYNC_VERSION" = "\$VERSION"/);
  assert.match(workflow, /echo "sha=\$SYNC_SHA256" >> "\$GITHUB_OUTPUT"/);
  // 双平台安装检查照跑在要发布的那份成品上。
  assert.match(workflow, /os: \[windows-latest, macos-latest\]/);
  assert.match(workflow, /node scripts\/check-package-install\.mjs dist\/\*\.tgz/);
});

test('流水线发版的发布核对写真话：成品来自流水线、本机未打包未上传', () => {
  const line = releaseVerification(false, '', true);
  assert.match(line, /成品打包与 Gitee Release 由 Gitee Go 流水线按标签完成/);
  assert.match(line, /本机未打包、未上传附件/);
  assert.match(line, /未运行 GitHub 双平台 CI/);
  assert.doesNotMatch(releaseVerification(false, '', false), /流水线/, '本地发版仍按原来的口径记录');
});
