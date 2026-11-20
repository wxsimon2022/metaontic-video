import { test } from 'node:test';
import assert from 'node:assert/strict';
import { publishGiteeStableAlias } from '../scripts/publish-gitee-stable-alias.mjs';

for (const existing of [false, true]) test(`Gitee fixed asset copies published bytes, existing=${existing}`, async () => {
  const source = Buffer.from([31, 139, 8, 1, 2]);
  let uploads = 0;
  const request = async (url, options = {}) => {
    const path = new URL(url).pathname;
    if (path.includes('/api/v5/')) {
      if (options.method === 'POST') {
        uploads++;
        assert.equal(options.body.get('file').name, 'metaontic-video.tgz');
        assert.deepEqual(Buffer.from(await options.body.get('file').arrayBuffer()), source);
        return Response.json({ id: 2 });
      }
      return Response.json(path.endsWith('v4.0.7') ? { id: 1, prerelease: false } : [
        { name: 'metaontic-video-4.0.7.tgz' }, ...(existing ? [{ name: 'metaontic-video.tgz' }] : []),
      ]);
    }
    return new Response(source);
  };
  const result = await publishGiteeStableAlias({ token: 'test', tag: 'v4.0.7', request, log() {} });
  assert.match(result.url, /download\/latest\/metaontic-video.tgz$/);
  assert.equal(uploads, existing ? 0 : 1);
});

test('Gitee rejects mismatching existing fixed asset without overwriting', async () => {
  const request = async (url, options = {}) => {
    assert.notEqual(options.method, 'POST');
    const path = new URL(url).pathname;
    if (path.includes('/api/v5/')) return Response.json(path.endsWith('v4.0.7') ? { id: 1 } : [{ name: 'metaontic-video-4.0.7.tgz' }, { name: 'metaontic-video.tgz' }]);
    return new Response(Buffer.from([31, 139, path.endsWith('4.0.7.tgz') ? 1 : 2]));
  };
  await assert.rejects(publishGiteeStableAlias({ token: 'test', tag: 'v4.0.7', request }), /checksum mismatch/);
});

test('Gitee fixed alias only accepts stable releases', async () => {
  await assert.rejects(publishGiteeStableAlias({ token: 'test', tag: 'v4.0.7-beta.1' }), /stable version/);
  await assert.rejects(publishGiteeStableAlias({ token: 'test', tag: 'v4.0.7', request: async () => Response.json({ id: 1, prerelease: true }) }), /published stable/);
});
