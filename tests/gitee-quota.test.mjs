import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { isGiteeQuotaError, recoverGiteeQuota } from '../scripts/gitee-quota.mjs';
import { publishGitee } from '../scripts/publish-gitee.mjs';
import { publishGiteeStableAlias } from '../scripts/publish-gitee-stable-alias.mjs';

const release = tag => ({ id: Number(tag.slice(1).replaceAll('.', '')), tag, prerelease: false, createdAt: '2026-01-01T00:00:00Z', assets: [] });

test('只把 Gitee 附件配额错误识别为可自动清理的情形', () => {
  assert.equal(isGiteeQuotaError(new Error('Gitee POST /releases/1/attach_files: HTTP 400 {"message":"验证失败：文件大小已超出企业附件配额：3 GB, 请升级或续费套餐！"}')), true);
  assert.equal(isGiteeQuotaError(new Error('attachment quota exceeded')), true);
  assert.equal(isGiteeQuotaError(new Error('Gitee POST /releases/1/attach_files: HTTP 400 请求超时')), false);
  assert.equal(isGiteeQuotaError(new Error('Gitee POST /releases/1/attach_files: HTTP 500')), false);
});

test('配额清理按仓库保留最近 8 个正式版，只清理更旧的发行版', async () => {
  const versions = Array.from({ length: 10 }, (_, index) => `v4.0.${index + 1}`);
  const client = {
    slug: 'hackloop/metaontic-video',
    listReleases: async () => versions.map(release),
    listTags: async () => versions,
  };
  let applied;
  const plan = await recoverGiteeQuota({ client, token: 'test', protectedTags: ['v4.0.10'], apply: async args => { applied = args; }, log() {} });
  assert.deepEqual(plan.keep.map(item => item.tag).sort(), versions.slice(2).sort());
  assert.deepEqual(plan.remove.map(item => item.tag).sort(), ['v4.0.1', 'v4.0.2']);
  assert.equal(applied.gitee, client);
  assert.equal(applied.local, null, '自动清理不删除本地标签');
});

test('发行版不超过保留数量时不执行删除', async () => {
  const versions = Array.from({ length: 8 }, (_, index) => `v4.0.${index + 1}`);
  let applied = false;
  const plan = await recoverGiteeQuota({
    client: { listReleases: async () => versions.map(release), listTags: async () => versions },
    apply: async () => { applied = true; },
    log() {},
  });
  assert.equal(plan.remove.length, 0);
  assert.equal(applied, false);
});

test('Gitee 版本包上传遇到配额错误时先清理再重试同一成品', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'gitee-quota-upload-'));
  try {
    const tag = 'v4.2.2', filename = 'metaontic-video-4.2.2.tgz';
    const archive = join(dir, filename);
    await writeFile(archive, 'archive-bytes');
    let releaseData = { id: 1, body: 'release notes', prerelease: false };
    let attachments = [], uploads = 0, cleanups = 0;
    const request = async (url, options = {}) => {
      const path = url.pathname;
      if (options.method === 'POST' && path.endsWith('/releases')) {
        releaseData = { id: 1, body: 'release notes', prerelease: false };
        return Response.json(releaseData);
      }
      if (options.method === 'POST' && path.endsWith('/attach_files')) {
        uploads += 1;
        if (uploads === 1) return new Response('验证失败：文件大小已超出企业附件配额：3 GB', { status: 400 });
        attachments = [{ name: filename, size: 13 }];
        return Response.json(attachments[0]);
      }
      if (path.endsWith('/attach_files')) return Response.json(attachments);
      if (options.method === 'PATCH') {
        releaseData = { ...releaseData, body: options.body.get('body'), prerelease: options.body.get('prerelease') === 'true' };
        return Response.json(releaseData);
      }
      return Response.json(releaseData);
    };
    const result = await publishGitee({
      token: 'test', tag, archive, notes: 'release notes', request,
      retry: { attempts: 2, delayMs: 0 },
      quotaCleanup: async options => { cleanups += 1; assert.equal(options.keep, 8); assert.deepEqual(options.protectedTags, [tag]); },
      log() {},
    });
    assert.match(result, new RegExp(`${tag}$`));
    assert.equal(cleanups, 1);
    assert.equal(uploads, 2, '清理后使用同一份成品重试，不重新打包');
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('固定最新包上传遇到配额错误时同样自动清理后重试', async () => {
  const source = Buffer.from([31, 139, 8, 1, 2]);
  let uploads = 0, cleanups = 0;
  const request = async (url, options = {}) => {
    const path = new URL(url).pathname;
    if (path.includes('/api/v5/')) {
      if (options.method === 'POST') {
        uploads += 1;
        if (uploads === 1) return new Response('验证失败：文件大小已超出企业附件配额：3 GB', { status: 400 });
        return Response.json({ id: 2 });
      }
      return Response.json(path.endsWith('v4.2.2') ? { id: 1, prerelease: false } : [
        { name: 'metaontic-video-4.2.2.tgz' }, ...(uploads > 1 ? [{ name: 'metaontic-video.tgz' }] : []),
      ]);
    }
    return new Response(source);
  };
  const result = await publishGiteeStableAlias({
    token: 'test', tag: 'v4.2.2', request,
    quotaCleanup: async options => { cleanups += 1; assert.equal(options.keep, 8); },
    log() {},
  });
  assert.match(result.url, /download\/latest\/metaontic-video.tgz$/);
  assert.equal(cleanups, 1);
  assert.equal(uploads, 2);
});
