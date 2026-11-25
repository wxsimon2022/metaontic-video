import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { sourceOf } from './source.mjs';
const c = vm.createContext({ URL });
vm.runInContext(sourceOf('businesses/video-generation/client/media-preview', 'businesses/video-generation/assets/catalog', 'businesses/video-generation/client/asset-library'), c);
const chat = (...nodes) => ({ nodes: new Map(nodes.map((node, i) => [i, node])) });
const result = (media, args = {}, name = 'video_generate') => ({ kind: 'tool-call', data: { root: { kind: 'tool-result', call: { name, argsRaw: JSON.stringify(args) }, meta: { metaonticMedia: { version: 1, media } } } } });

test('library collects uploaded images, references and completed results without configuration leakage', () => {
 const snapshot = chat({ kind: 'user', data: { content: [{ type: 'image', attachment: { attachmentId: 'a1', name: '产品.png' } }] } },
  result([{ kind: 'video', localPath: '/work/01.mp4', url: 'https://cdn/a.mp4', label: '第1段' }, { kind: 'video', localPath: '/work/film.mp4', label: '完整视频' }], { firstFrameUrl: 'ref.png', metaonticApiKey: 'SECRET' }));
 const assets = c.collectLibraryAssets(snapshot, '/work');
 assert.equal(assets.length, 4);
 assert.equal(assets.find(a => a.localPath === '/work/ref.png').category, 'reference');
 assert.equal(assets.find(a => a.localPath === '/work/film.mp4').category, 'film');
 assert.equal(assets.find(a => a.attachment).name, '产品.png');
 assert.doesNotMatch(JSON.stringify(assets), /SECRET|metaonticApiKey/);
 assert.equal(c.collectLibraryAssets(chat(), '/other').length, 0);
});

test('nested results and repeated status queries are deduplicated by explicit file or URL', () => {
 const item = { kind: 'image', localPath: '/work/ref.png', url: 'https://cdn/ref.png', label: '角色参考图' };
 const nested = result([]); nested.data.root.subCalls = [result([item], {}, 'video_prepare_image').data.root];
 const assets = c.collectLibraryAssets(chat(result([], { referenceImages: ['/work/ref.png'] }), nested, result([item], {}, 'video_status')), '/work');
 assert.equal(assets.length, 1);
 assert.equal(assets[0].category, 'image');
 assert.equal(assets[0].url, item.url);
});

test('library handles Windows and macOS paths and excludes unsafe or non-plugin material', () => {
 assert.equal(c.assetPath('images\\产品.png', 'C:\\项目'), 'C:/项目/images/产品.png');
 assert.equal(c.assetPath('./images/../ref.png', '/项目'), '/项目/ref.png');
 for (const value of ['javascript:bad', 'data:image/png;base64,a', 'asset://id', '//server/a', '/x\n.png']) assert.equal(c.assetPath(value, '/work'), '');
 const bad = result([{ kind: 'image', url: 'javascript:bad', label: 'bad' }]);
 const foreign = result([{ kind: 'video', localPath: '/foreign.mp4' }], {}, 'other_tool');
 const failed = result([{ kind: 'video', localPath: '/failed.mp4' }]); failed.data.root.isError = true;
 assert.equal(c.collectLibraryAssets(chat(bad, foreign, failed)).length, 0);
 const assets = c.collectLibraryAssets(chat(result([{ kind: 'video', localPath: 'C:\\项目\\ONE.mp4' }, { kind: 'video', localPath: 'c:\\项目\\one.mp4' }])));
 assert.equal(assets.length, 1);
});

test('library filters use labels and filenames, including historical markdown results', () => {
 const node = { kind: 'tool-call', data: { root: { kind: 'tool-result', call: { name: 'video_status' }, content: [{ type: 'text', text: '[第1段](</work/coffee 1.mp4>)\n[参考图](https://cdn/ref.png)' }] } } };
 const assets = c.collectLibraryAssets(chat(node), '/work');
 assert.equal(assets.length, 2);
 assert.equal(c.filterLibraryAssets(assets, 'video', 'COFFEE').length, 1);
 assert.equal(c.filterLibraryAssets(assets, 'film', '').length, 0);
});

test('host slot uses session-scoped attachment cache and explicit older-history loading', async () => {
 let options, loads = 0, consumed = 0, imageSession;
 const ctx = { slots: { register(o) { options = o; return () => {}; } }, get(name) {
  if (name === 'sessions') return { binding(id) { assert.equal(id, 'session-a'); return { session: { async loadOlder(args) { assert.equal(args.deferConsumption, true); loads++; }, consumeOlder() { consumed++; } } }; } };
  if (name === 'uiConversation') return { imageUrl(id, attachment) { imageSession = id; return attachment.attachmentId; } };
 } };
 const dispose = c.registerAssetLibrary(ctx, () => {}, key => key);
 assert.equal(options.name, 'conversation.view');
 const props = options.inject('session-a');
 assert.equal(await props.loadImage({ attachmentId: 'a1' }), 'a1');
 assert.equal(imageSession, 'session-a');
 await props.loadEarlier(); assert.equal(loads, 1); assert.equal(consumed, 1);
 assert.equal(typeof dispose, 'function');
});
