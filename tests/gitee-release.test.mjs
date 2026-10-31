import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { publishGitee } from '../scripts/publish-gitee.mjs';

test('Gitee creates a release, uploads its archive, verifies it and is safe to retry', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'gitee-release-'));
  try {
    const archive = join(dir, 'metaontic-video-3.3.0.tgz'); await writeFile(archive, 'archive');
    let release = null; const attachments = []; let creates = 0, uploads = 0;
    const request = async (url, options) => {
      const path = url.pathname;
      if (options.method === 'PATCH') {
        assert.equal(options.body.get('tag_name'), 'v3.3.0');
        release = { ...release, body: options.body.get('body') };
        return { ok: true, json: async () => release };
      }
      if (options.method === 'POST' && path.endsWith('/releases')) {
        creates++; assert.equal(options.body.get('tag_name'), 'v3.3.0'); assert.equal(options.body.get('body'), 'release notes'); release = { id: 1 };
        return { ok: true, json: async () => release };
      }
      if (options.method === 'POST') {
        uploads++; assert.equal(options.body.get('file').name, 'metaontic-video-3.3.0.tgz');
        attachments.push({ name: 'metaontic-video-3.3.0.tgz', size: 7 });
        return { ok: true, json: async () => attachments[0] };
      }
      if (path.endsWith('/attach_files')) return { ok: true, json: async () => attachments };
      return release ? { ok: true, json: async () => release } : { ok: false, status: 404 };
    };
    const args = { token: 'test-token', tag: 'v3.3.0', archive, notes: 'release notes', request };
    assert.match(await publishGitee(args), /v3.3.0$/);
    release.body = 'stale notes';
    await publishGitee(args); assert.equal(release.body, 'release notes'); assert.equal(creates, 1); assert.equal(uploads, 1);
    attachments[0].size = 9;
    await assert.rejects(publishGitee(args), /different size/);
    await assert.rejects(publishGitee({ ...args, token: '' }), /Missing GITEE_TOKEN/);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
