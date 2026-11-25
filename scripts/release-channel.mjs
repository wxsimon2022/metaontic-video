import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { validateNpmBundle } from './npm-bundle.mjs';
import { platformCheckState } from './release-parallel.mjs';

const digest = bytes => createHash('sha256').update(bytes).digest('hex');
function gh(args, optional = false) {
  const result = spawnSync('gh', args, { encoding: 'utf8', shell: false, timeout: args[0] === 'run' && args[1] === 'watch' ? 5400000 : 120000 });
  if (result.error || result.status !== 0) { if (optional) return null; throw Error(`GitHub ${args[0]} ${args[1]} 失败`); }
  return result.stdout.trim();
}
async function publishGithub(config) {
  const { tag, githubRepo: repo, workflowId, expectedSha, archive, out, notes, sha256 } = config;
  const checked = JSON.parse(gh(['run', 'view', String(workflowId), '--repo', repo, '--json', 'headSha,status,jobs']));
  if (!platformCheckState(checked, expectedSha)) throw Error('双平台检查未完成，不能公开 GitHub 正式版');
  const { publishStableAlias } = await import('./publish-stable-alias.mjs');
  // This worker publishes GitHub directly, rather than making the other channels
  // wait for the hosted publication job. Both paths verify and reuse the bytes.
  publishStableAlias({ tag, archive, repo });
  const release = JSON.parse(gh(['release', 'view', tag, '--repo', repo, '--json', 'isDraft,isPrerelease,assets,body']));
  if (release.isDraft || release.isPrerelease || release.body.trim() !== notes.trim()) throw Error('GitHub 正式版状态或说明不一致');
  const dir = path.join(out, 'verify-github-parallel'); mkdirSync(dir, { recursive: true });
  const versioned = path.basename(archive);
  for (const name of [versioned, 'metaontic-video.tgz']) {
    if (!release.assets.some(asset => asset.name === name)) throw Error(`GitHub 缺少 ${name}`);
    gh(['release', 'download', tag, '--repo', repo, '--pattern', name, '--dir', dir, '--clobber']);
    if (digest(readFileSync(path.join(dir, name))) !== sha256) throw Error('GitHub 成品摘要不一致');
  }
}

/** A pending submission is never replayed just because npm still returns 404. */
export async function publishNpmChannel(config, { publish, verify, wait = ms => new Promise(resolve => setTimeout(resolve, ms)), attempts = 24 } = {}) {
  const receipt = path.join(config.out, 'npm-submission.json');
  const lock = path.join(config.out, 'npm-publish.lock');
  // Fail closed for concurrent publishers; a crashed lock requires inspecting the receipt.
  mkdirSync(lock);
  try {
    writeFileSync(path.join(lock, 'owner.json'), JSON.stringify({ pid: process.pid, version: config.version, sha256: config.sha256 }) + '\n', { mode: 0o600 });
    if (existsSync(receipt)) {
      const prior = JSON.parse(readFileSync(receipt, 'utf8'));
      if (prior.version !== config.version || prior.sha256 !== config.sha256) throw Error('npm 提交记录与成品不一致');
    } else {
      // Written before the mutation: a lost response must not cause duplicate publishing.
      writeFileSync(receipt, JSON.stringify({ version: config.version, sha256: config.sha256, status: 'attempted' }) + '\n', { mode: 0o600, flag: 'wx' });
      try { await publish(); } catch { /* Verify public state below; never replay a possibly accepted PUT. */ }
    }
    for (let i = 0; i < attempts; i++) {
      if (await verify()) {
        writeFileSync(receipt, JSON.stringify({ version: config.version, sha256: config.sha256, status: 'verified' }) + '\n', { mode: 0o600 });
        return;
      }
      if (i + 1 < attempts) await wait(5000);
    }
    throw Error('npm／中国镜像尚未公开同一成品；保留提交记录，续跑仅核验，不重复上传');
  } finally { rmSync(lock, { recursive: true }); }
}

export async function publishChannel(config) {
  const { channel, version, archive, sha256, tag } = config;
  if (!['github', 'gitee', 'npm'].includes(channel) || tag !== `v${version}` || !/^\d+\.\d+\.\d+$/.test(version)) throw Error('发布任务参数无效');
  const bytes = readFileSync(archive);
  if (digest(bytes) !== sha256) throw Error('发布前成品摘要改变');
  const manifest = validateNpmBundle(bytes, { version });
  if (channel === 'github') return publishGithub(config);
  if (channel === 'gitee') {
    const { publishGiteeWithAlias } = await import('./publish-gitee.mjs');
    return publishGiteeWithAlias({ token: process.env.GITEE_TOKEN, tag, archive, notes: config.notes, prerelease: false });
  }
  const { publishNpmRelease } = await import('./publish-npm-release.mjs');
  const { syncNpmMirror } = await import('./sync-npm-mirror.mjs');
  return publishNpmChannel(config, {
    publish: () => publishNpmRelease({ name: manifest.name, version, archive }),
    verify: async () => {
      try {
        const response = await fetch(`https://registry.npmjs.org/${encodeURIComponent(manifest.name)}/${version}`, { signal: AbortSignal.timeout(15000) });
        if (!response.ok) return false;
        const published = await response.json(), url = new URL(published.dist?.tarball);
        if (url.protocol !== 'https:' || url.hostname !== 'registry.npmjs.org') throw Error('npm 成品地址不可信');
        const download = await fetch(url, { signal: AbortSignal.timeout(60000) });
        if (!download.ok || digest(Buffer.from(await download.arrayBuffer())) !== sha256) return false;
        await syncNpmMirror({ name: manifest.name, version, attempts: 1 });
        return true;
      } catch { return false; }
    },
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  publishChannel(JSON.parse(readFileSync(process.argv[2], 'utf8'))).catch(error => { console.error(error.message); process.exitCode = 1; });
}
