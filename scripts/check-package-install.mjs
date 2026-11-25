/** Cross-platform release smoke test. No paid API calls or real Harness profile writes. */
import assert from 'node:assert/strict';
import { BUILD_OUTPUTS, digest } from './build-identity.mjs';
import { checkClientMigration } from './check-client-migration.mjs';
import { gunzipSync, gzipSync } from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, readFile, readdir, realpath, copyFile, rename, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const archive = path.resolve(process.argv[2] || '');
assert.ok(archive.endsWith('.tgz'), 'Pass the built .tgz package');
const cli = process.env.PNPM_CLI || path.join(execFileSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['root', '-g'], { encoding: 'utf8', shell: process.platform === 'win32' }).trim(), 'pnpm/bin/pnpm.cjs');
const temp = await mkdtemp(path.join(tmpdir(), 'MetaOntic 安装 测试 '));
try {
  const profile = path.join(temp, '插件 profile');
  const downloaded = path.join(temp, '安装文件 package.tgz');
  await mkdir(profile);
  await copyFile(archive, downloaded);
  await writeFile(path.join(profile, 'package.json'), '{"private":true}');
  await writeFile(path.join(profile, 'pnpm-workspace.yaml'), 'nodeLinker: hoisted\nstrictDepBuilds: true\n');
  // Build an older package fixture from the same archive, changing only manifest
  // version. Exercise an actual managed-package upgrade, not just a fresh add.
  const raw = gunzipSync(await readFile(downloaded));
  const chunks = []; let changed = false; let packageName;
  for (let offset = 0; offset + 512 <= raw.length;) {
    const header = Buffer.from(raw.subarray(offset, offset + 512));
    if (header.every(byte => byte === 0)) break;
    const name = header.subarray(0, 100).toString().replace(/\0.*$/, '');
    const size = parseInt(header.subarray(124, 136).toString().replace(/\0.*$/, '').trim() || '0', 8);
    let body = Buffer.from(raw.subarray(offset + 512, offset + 512 + size));
    offset += 512 + Math.ceil(size / 512) * 512;
    if (name === 'package/package.json') {
      const previous = JSON.parse(body.toString()); packageName = previous.name; assert.match(packageName, /^(?:@[a-z0-9-]+\/)?[a-z0-9-]+$/); previous.version = '0.0.0';
      body = Buffer.from(JSON.stringify(previous)); changed = true;
      header.write(body.length.toString(8).padStart(11, '0') + '\0', 124, 12, 'ascii');
      header.fill(32, 148, 156);
      const checksum = header.reduce((sum, byte) => sum + byte, 0);
      header.write(checksum.toString(8).padStart(6, '0') + '\0 ', 148, 8, 'ascii');
    }
    chunks.push(header, body, Buffer.alloc((512 - body.length % 512) % 512));
  }
  assert.ok(changed, 'Fixture manifest was found');
  chunks.push(Buffer.alloc(1024));
  const previousArchive = path.join(temp, 'previous package.tgz');
  const previousBytes = process.argv[3] ? await readFile(path.resolve(process.argv[3])) : gzipSync(Buffer.concat(chunks));
  let previousName = packageName, previousVersion = '0.0.0';
  if (process.argv[3]) {
    const prior = gunzipSync(previousBytes);
    for (let offset = 0; offset + 512 <= prior.length;) {
      const header = prior.subarray(offset, offset + 512);
      const size = parseInt(header.subarray(124, 136).toString().replace(/\0.*$/, '').trim() || '0', 8);
      if (header.subarray(0, 100).toString().replace(/\0.*$/, '') === 'package/package.json') {
        const manifest = JSON.parse(prior.subarray(offset + 512, offset + 512 + size));
        previousName = manifest.name; previousVersion = manifest.version; break;
      }
      offset += 512 + Math.ceil(size / 512) * 512;
    }
  }
  await writeFile(previousArchive, previousBytes);
  const runInstall = file => execFileSync(process.execPath, [cli, '--dir', profile, 'add', file,
    `--config.store-dir=${path.join(temp, 'store')}`, `--config.cache-dir=${path.join(temp, 'cache')}`], { encoding: 'utf8', timeout: 120000 });
  console.log(runInstall(previousArchive));
  const settingsFile = path.join(profile, 'cordis.patch.yml');
  const taskFile = path.join(profile, 'saved-task.json');
  await writeFile(settingsFile, '# preserve existing settings sentinel\n');
  await writeFile(taskFile, '{"task_id":"existing-task-do-not-resubmit"}');
  assert.equal(JSON.parse(await readFile(path.join(profile, 'node_modules', previousName, 'package.json'), 'utf8')).version, previousVersion);
  const profileFile = path.join(profile, 'package.json');
  // Seed the observed broken starting state, not the expected result. Only the
  // actual bundled client's buttons may drive changes after this point.
  const manifestBefore = JSON.parse(await readFile(profileFile, 'utf8'));
  manifestBefore.dsh = { profile: { bundles: [previousName] } };
  await writeFile(profileFile, JSON.stringify(manifestBefore));
  console.log(runInstall(downloaded));
  const initial = JSON.parse(await readFile(profileFile, 'utf8'));
  initial.dsh.profile.bundles = [...new Set([previousName, packageName])];
  await writeFile(profileFile, JSON.stringify(initial));
  if (previousName !== packageName) {
    assert.equal(previousName, 'metaontic-video');
    assert.equal(packageName, 'dsh-metaontic-video');
    const operations = [];
    const manager = {
      async listBundles() {
        const manifest = JSON.parse(await readFile(profileFile, 'utf8'));
        return Object.keys(manifest.dependencies || {}).map(name => ({
          name, installed: true, enabled: manifest.dsh.profile.bundles.includes(name), removable: true,
        }));
      },
      async setBundleEnabled(name, enabled) {
        assert.equal(name, previousName); assert.equal(enabled, false);
        const manifest = JSON.parse(await readFile(profileFile, 'utf8'));
        manifest.dsh.profile.bundles = manifest.dsh.profile.bundles.filter(bundle => bundle !== name);
        await writeFile(profileFile, JSON.stringify(manifest));
        operations.push('disable');
        return { ok: true, value: { application: 'applied' } };
      },
      async removeBundle(name) {
        assert.equal(name, previousName);
        assert.ok(!(await manager.listBundles()).find(row => row.name === name).enabled);
        execFileSync(process.execPath, [cli, '--dir', profile, 'remove', name,
          '--config.ignore-scripts=true', '--config.offline=true',
          `--config.store-dir=${path.join(temp, 'store')}`, `--config.cache-dir=${path.join(temp, 'cache')}`],
          { encoding: 'utf8', timeout: 120000 });
        operations.push('remove');
        return { ok: true, value: { application: 'applied' } };
      },
    };
    await checkClientMigration(path.join(profile, 'node_modules', packageName), manager);
    assert.deepEqual(operations, ['disable', 'remove']);
    const migrated = JSON.parse(await readFile(profileFile, 'utf8'));
    assert.deepEqual(migrated.dsh.profile.bundles, [packageName]);
    assert.ok(!migrated.dependencies[previousName], 'Old dependency removed through the client migration action');
    assert.ok(migrated.dependencies[packageName]);
  }
  assert.deepEqual(await readFile(previousArchive), previousBytes, 'Update must preserve the original installation file');
  assert.equal(await readFile(settingsFile, 'utf8'), '# preserve existing settings sentinel\n');
  assert.equal(await readFile(taskFile, 'utf8'), '{"task_id":"existing-task-do-not-resubmit"}');
  const installed = path.join(profile, 'node_modules', packageName);
  const relative = path.relative(await realpath(profile), await realpath(installed));
  assert.ok(relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative), 'Installed files must be managed inside the profile');
  // Once installed, moving the source must not break metadata or loading.
  await rename(downloaded, `${downloaded}.saved`);
  const pkg = JSON.parse(await readFile(path.join(installed, 'package.json'), 'utf8'));
  assert.deepEqual(pkg.dependencies || {}, {}, 'No extra runtime npm dependencies');
  const locales = await readdir(path.join(installed, 'dist', 'locale'));
  for (const locale of ['en.json', 'zh.json']) {
    assert.ok(locales.includes(locale), `Missing locale/${locale}`);
    const parsed = JSON.parse(await readFile(path.join(installed, 'dist', 'locale', locale), 'utf8'));
    assert.ok(parsed.meta?.title, `Missing ${locale} metadata title`);
    const physical = JSON.parse(await readFile(path.join(installed, 'locale', locale), 'utf8'));
    assert.deepEqual(physical, parsed, `Physical locale/${locale} must match exported metadata`);
    assert.equal(physical.meta.detail, 'plugin-detail.md');
    assert.equal((await readFile(path.join(installed, physical.meta.detail), 'utf8')).trim(), '', 'Installed detail must remain empty without README fallback');
  }
  for (const file of ['dist/index.js', 'dist/client.js', 'cordis.patch.yml', 'MetaOnticVideo使用说明书.md', 'MetaOnticVideo使用说明书.pdf']) {
    assert.ok((await readFile(path.join(installed, file))).length, `Missing ${file}`);
  }
  assert.ok((await readdir(path.join(installed, 'skills'))).length);
  const plugin = await import(pathToFileURL(path.join(installed, 'dist', 'index.js')).href);
  const buildInfo=JSON.parse(await readFile(path.join(installed,'dist/build-info.json'),'utf8'));
  assert.equal(buildInfo.version,pkg.version,'Build manifest version must match installed package');
  assert.match(buildInfo.buildId,/^[a-f0-9]{64}$/);
  for(const file of ['dist/index.js','dist/client.js'])assert.ok((await readFile(path.join(installed,file),'utf8')).includes(JSON.stringify(buildInfo.buildId)),`Compiled identity missing in ${file}`);
  for(const file of BUILD_OUTPUTS)assert.equal(digest(await readFile(path.join(installed,file))),buildInfo.files[file],`Installed artifact identity: ${file}`);
  assert.equal(typeof plugin.apply, 'function');
  assert.ok(plugin.Config);
  console.log(`PASS ${process.platform}: managed package installation and bundled-client migration contract (not desktop UI), settings/tasks preserved, Unicode/spaces, locale metadata, resources, source relocation and entry import (${pkg.version})`);
} finally {
  await rm(temp, { recursive: true, force: true });
}
