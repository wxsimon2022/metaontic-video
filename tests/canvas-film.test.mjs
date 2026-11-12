import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { api } from './module-test-api.mjs';

const temp = await mkdtemp(path.join(os.tmpdir(), '画布 成片 '));
after(() => rm(temp, { recursive: true, force: true }));
const config = { connectionMode: 'metaontic', metaonticApiKey: 'secret-never-persist', baseUrl: 'https://example.invalid', model: 'doubao-seedance-2-0', imageUseVideoKey: true };

/** 两个视频制作节点串成一条链；成果节点指回制作节点，素材落在画布数据根里。 */
function fixture({ second = true } = {}) {
  const doc = { id: 'p', name: '成片画布', nodes: {
    v1: { id: 'v1', type: 'video', x: 0, y: 0, data: { label: '第1段', prompt: '开场', ratio: '16:9', duration: 5, resolution: '720p' } },
    v2: { id: 'v2', type: 'video', x: 0, y: 400, data: { label: '第2段', prompt: '收尾', ratio: '16:9', duration: 5, resolution: '720p' } },
    r1: { id: 'r1', type: 'video', metaonticSourceNode: 'v1', data: { label: '第1段成果', assetId: 'a1', ratio: '16:9', metaonticVideoUrl: 'https://example.invalid/1.mp4', metaonticSeconds: 5, metaonticCreatedAt: 1 } },
    ...(second ? { r2: { id: 'r2', type: 'video', metaonticSourceNode: 'v2', data: { label: '第2段成果', assetId: 'a2', ratio: '16:9', metaonticVideoUrl: 'https://example.invalid/2.mp4', metaonticSeconds: 5, metaonticCreatedAt: 2 } } } : {}),
  }, edges: [{ id: 'e1', fromNode: 'v1', toNode: 'v2', fromPort: 'out', toPort: 'prompt' }] };
  const assets = {
    a1: { id: 'a1', projectId: 'p', kind: 'video', mime: 'video/mp4', name: '第1段成果', rel: 'projects/p/video/a1.mp4', size: 4 },
    a2: { id: 'a2', projectId: 'p', kind: 'video', mime: 'video/mp4', name: '第2段成果', rel: 'projects/p/video/a2.mp4', size: 4 },
  };
  const created = [];
  const rpc = {
    projectsGet: async () => structuredClone(doc),
    dataRootGet: async () => ({ dataRoot: temp }),
    projectDirGet: async () => ({ ok: true, dataRoot: temp, abs: path.join(temp, 'projects', 'p') }),
    assetsGet: async ({ ids }) => ({ items: (ids || []).map(id => assets[id]).filter(Boolean) }),
    assetCreate: async ({ asset }) => { created.push(asset); assets[asset.id] = asset; return { ok: true, id: asset.id }; },
    projectsPut: async ({ doc: next }) => { Object.assign(doc, structuredClone(next)); return { ok: true, id: doc.id }; },
  };
  return { doc, rpc, created, adapter: { rpc } };
}

async function service(f, overrides = {}) {
  const directory = await mkdtemp(path.join(temp, 'job-'));
  const merged = [];
  const options = {
    directory, load: async () => f.adapter,
    hasFfmpeg: async () => true,
    // 真 ffmpeg 只做一次拼接：这里按字节把分段接起来，验证的是调用与落盘位置。
    mergeClips: async (_config, files, outPath) => {
      await mkdir(path.dirname(outPath), { recursive: true });
      const parts = [];
      for (const file of files) parts.push(await readFile(file));
      await writeFile(outPath, Buffer.concat(parts));
      merged.push({ files, outPath });
    },
    ...overrides,
  };
  const s = api.createCanvasNativeService(config, options);
  return { ...s, merged, directory };
}

async function placeSegments() {
  await mkdir(path.join(temp, 'projects', 'p', 'video'), { recursive: true });
  await writeFile(path.join(temp, 'projects', 'p', 'video', 'a1.mp4'), Buffer.from('AAAA'));
  await writeFile(path.join(temp, 'projects', 'p', 'video', 'a2.mp4'), Buffer.from('BBBB'));
}

test('成片分段按连线顺序取每段最新成果，缺段单独列出', () => {
  const full = fixture();
  assert.deepEqual(api.filmSegments(full.doc).segments.map(s => s.label), ['第1段', '第2段']);
  const partial = fixture({ second: false });
  const { segments, missing } = api.filmSegments(partial.doc);
  assert.equal(segments.length, 1);
  assert.deepEqual(missing, ['第2段']);
});

test('合成成片：把每段成果拼成一条并落进画布数据目录，不重新生成', async () => {
  await placeSegments();
  const f = fixture();
  const s = await service(f);
  const { ok, film } = await s.handle({ action: 'mergeFilm', projectId: 'p' });
  assert.equal(ok, true);
  assert.match(film.assetId, /^mov_film_[a-f0-9]{24}$/);
  assert.equal(film.count, 2);
  assert.equal(film.seconds, 10);
  assert.equal(film.url, `/metaontic-video/canvas-media?assetId=${film.assetId}`);
  const dest = path.join(temp, 'projects', 'p', 'final', `${film.assetId}.mp4`);
  assert.equal((await readFile(dest)).toString(), 'AAAABBBB');
  const asset = f.created.find(a => a.id === film.assetId);
  assert.equal(asset.kind, 'video');
  assert.match(asset.rel, /^projects\/p\/final\/mov_film_/);
  assert.equal(f.doc.film.assetId, film.assetId, '成片记录写回画布，刷新后还能看到'); // 持久化给界面用
  // 记录在画布上，重新打开画布（或换窗口）也能直接回看。
  const again = await s.handle({ action: 'film', projectId: 'p' });
  assert.equal(again.film.url, film.url);
  assert.equal(s.merged.length, 1);
  s.dispose();
});

test('缺段或没有视频成果时明确停住，不合成一条缺段的成片', async () => {
  await placeSegments();
  const missing = await service(fixture({ second: false }));
  await assert.rejects(missing.handle({ action: 'mergeFilm', projectId: 'p' }), /第2段/);
  assert.equal(missing.merged.length, 0, '缺段不调用合并');
  missing.dispose();

  const empty = fixture();
  for (const key of ['v1', 'v2', 'r1', 'r2']) delete empty.doc.nodes[key];
  const none = await service(empty);
  await assert.rejects(none.handle({ action: 'mergeFilm', projectId: 'p' }), /还没有可合成的视频成果/);
  none.dispose();
});

test('本机没有 ffmpeg 时只说清楚怎么装，不合成也不重新生成', async () => {
  await placeSegments();
  const s = await service(fixture(), { hasFfmpeg: async () => false });
  await assert.rejects(s.handle({ action: 'mergeFilm', projectId: 'p' }), /ffmpeg/);
  assert.equal(s.merged.length, 0);
  s.dispose();
});

test('成片只读回看：没有成片记录时返回 null，不伪造成果', async () => {
  const s = await service(fixture());
  const { film } = await s.handle({ action: 'film', projectId: 'p' });
  assert.equal(film, null);
  s.dispose();
});
