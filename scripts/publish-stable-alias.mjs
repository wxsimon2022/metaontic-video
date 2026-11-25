/** Publish a byte-identical stable alias only after platform installation checks. */
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

export const STABLE_ASSET = 'metaontic-video.tgz';
const digest = file => createHash('sha256').update(readFileSync(file)).digest('hex');
function command(args) {
  const result = spawnSync('gh', args, { encoding: 'utf8', shell: false });
  if (result.error || result.status !== 0) throw Error(result.error?.message || result.stderr || 'GitHub command failed');
  return result.stdout;
}
export function publishStableAlias({ tag, archive, repo, run = command }) {
  if (!/^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(tag)) throw Error('Only stable version tags are allowed');
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo || '')) throw Error('A GitHub repository is required');
  const remote = JSON.parse(run(['release', 'view', tag, '--repo', repo, '--json', 'isPrerelease,assets']));
  if (remote.isPrerelease) throw Error('Prereleases cannot publish the stable alias');
  const versioned = `metaontic-video-${tag.slice(1)}.tgz`;
  if (!remote.assets.some(asset => asset.name === versioned)) throw Error('Missing versioned release package');
  const dir = mkdtempSync(join(tmpdir(), 'metaontic-stable-'));
  try {
    // Check the actual remote versioned bytes before creating an alias; never repack.
    run(['release', 'download', tag, '--repo', repo, '--pattern', versioned, '--dir', dir]);
    const expected = digest(archive);
    if (digest(join(dir, versioned)) !== expected) throw Error('Versioned package checksum mismatch');
    const alias = join(dir, STABLE_ASSET);
    if (!remote.assets.some(asset => asset.name === STABLE_ASSET)) {
      copyFileSync(archive, alias);
      try { run(['release', 'upload', tag, alias, '--repo', repo]); }
      catch (error) {
        // The local parallel worker and hosted job can reach this together.
        // An already-created alias is accepted only after downloading its bytes below.
        const current = JSON.parse(run(['release', 'view', tag, '--repo', repo, '--json', 'assets']));
        if (!current.assets.some(asset => asset.name === STABLE_ASSET)) throw error;
      }
      rmSync(alias);
    }
    // Existing assets are verified, never overwritten, including on a resumed run.
    run(['release', 'download', tag, '--repo', repo, '--pattern', STABLE_ASSET, '--dir', dir]);
    if (digest(alias) !== expected) throw Error('Stable alias checksum mismatch');
    const releases = JSON.parse(run(['api', `repos/${repo}/releases`, '--paginate', '--slurp'])).flat();
    const current = tag.slice(1).split('.').map(Number);
    const newer = releases.some(release => {
      if (release.draft || release.prerelease || !/^v\d+\.\d+\.\d+$/.test(release.tag_name)) return false;
      const parts = release.tag_name.slice(1).split('.').map(Number);
      for (let i = 0; i < 3; i++) if (parts[i] !== current[i]) return parts[i] > current[i];
      return false;
    });
    run(['release', 'edit', tag, '--repo', repo, '--draft=false', '--prerelease=false', `--latest=${!newer}`]);
    return { asset: STABLE_ASSET, sha256: expected, latest: !newer };
  } finally { rmSync(dir, { recursive: true, force: true }); }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const [tag, archive, repo] = process.argv.slice(2);
    console.log(JSON.stringify(publishStableAlias({ tag, archive, repo })));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
