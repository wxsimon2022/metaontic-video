import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { sourceOf } from './source.mjs';
const c = vm.createContext({ URL });
vm.runInContext(sourceOf('businesses/video-generation/client/media-preview', 'businesses/video-generation/assets/catalog', 'businesses/video-generation/client/asset-actions', 'businesses/video-generation/client/composer-media'), c);

test('draft previews parse explicit mentions, quoted Chinese paths and Windows JSON escaping', () => {
  const draft = '产品 ' + '@' + JSON.stringify('C:\\素材\\产品 1.png') + ' @"./镜头 2.mp4" @https://cdn.example/a.webp?token=a @https://cdn.example/a.webp?token=a mail@x.png';
  const items = c.draftMediaReferences(draft, '/work');
  assert.equal(items.length, 3);
  assert.equal(items[0].localPath, 'C:/素材/产品 1.png');
  assert.equal(items[1].localPath, '/work/镜头 2.mp4');
  assert.equal(items[1].kind, 'video');
  assert.equal(items[2].name, 'a.webp');
  for (const item of items) assert.equal(draft.slice(item.start, item.end).startsWith('@'), true);
  assert.equal(c.draftMediaReferences('@javascript:x.png @data:image/png,a @//server/a.png @readme.md').length, 0);
  assert.equal(c.draftMediaReferences('@a.png').length, 0);
  assert.equal(c.draftMediaReferences('@./a.png', 'D:\\项目')[0].localPath, 'D:/项目/a.png');
});

test('role and remake requests keep references explicit and require existing approval flow', () => {
  const item = { kind: 'video', category: 'segment', localPath: '/work/镜头 1.mp4', creation: { toolName: 'video_generate', round: 1 } };
  assert.match(c.assetRemakeRequest(item), /沿用原参数/);
  assert.match(c.assetRemakeRequest(item, '拉近镜头'), /修改需求：拉近镜头/);
  assert.match(c.assetRemakeRequest(item), /保留其他已完成结果/);
  assert.match(c.assetRemakeRequest(item), /费用确认/);
  assert.equal(c.assetRemakeRequest({ ...item, creation: { toolName: 'video_status' } }), '');
  assert.equal(c.assetRemakeRequest({ ...item, category: 'film' }), '');
  assert.equal(c.assetRemakeRequest({ ...item, kind: 'image' }), '');
  assert.equal(c.assetReferenceRequest(item, 'first'), '');
  assert.match(c.assetReferenceRequest({ kind: 'image', localPath: 'C:\\图片\\首帧.png' }, 'first'), /作为首帧/);
  assert.equal(c.assetReferenceRequest({ kind: 'image', url: 'javascript:x' }), '');
  assert.equal(c.appendAssetDraft('原草稿', '新需求'), '原草稿\n\n新需求');
  assert.equal(c.appendAssetDraft('原草稿', ''), '原草稿');
});

test('latest round uses real creation, ignores later status checks, and bridges duplicate aliases', () => {
  const media = (localPath, url) => ({ kind: 'video', localPath, url, label: '第1段' });
  const node = (name, entries) => ({ kind: 'tool-call', data: { root: { kind: 'result', call: { name }, meta: { metaonticMedia: { version: 1, media: entries } } } } });
  const user = { kind: 'user', data: { content: [] } };
  const nodes = [user, node('video_generate', [media('/work/one.mp4', '')]), user,
    node('video_status', [media('', 'https://cdn/one.mp4')]), node('video_status', [media('/work/one.mp4', 'https://cdn/one.mp4')]),
    node('video_extend', [media('/work/two.mp4', '')])];
  const items = c.collectLibraryAssets({ nodes: new Map(nodes.map((n, i) => [i, n])) }, '/work');
  assert.equal(items.length, 2);
  assert.equal(items.find(x => x.localPath === '/work/one.mp4').creation.round, 1);
  assert.equal(items.find(x => x.localPath === '/work/two.mp4').creation.round, 2);
  assert.equal(items.find(x => x.localPath === '/work/one.mp4').url, 'https://cdn/one.mp4');
});

test('empty draft contributes no composer row and no asset-library launcher', () => {
  const h = (type, props, ...children) => ({ type, props, children });
  const React = { useMemo: fn => fn() };
  const Component = c.createComposerMedia({ React, h, t: key => key });
  assert.equal(Component({}), null);
  const outer = Component({ sessionId: 'one', useInput: fn => fn({ draft: '' }) });
  assert.equal(outer.type(outer.props), null);
  const withMedia = Component({ sessionId: 'one', useInput: fn => fn({ draft: '@"/work/ref.png"' }) });
  c.document = { baseURI: 'https://host/' };
  const row = withMedia.type(withMedia.props);
  assert.equal(row.props['data-field'], 'draft-media-preview');
  assert.equal(row.children.some(child => child?.type === 'button'), false);
});
