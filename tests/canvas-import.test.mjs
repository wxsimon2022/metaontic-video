import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readdir, rm, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { api } from './module-test-api.mjs';

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==', 'base64');
const config = { connectionMode: 'metaontic', metaonticApiKey: 'secret-never-persist', baseUrl: 'https://example.invalid', model: 'doubao-seedance-2-0', imageUseVideoKey: true };

/** 导入自己的图片素材：写进内置画布数据根，登记成资产，画布端就能当首帧/参考图用。 */
async function withHome(body) {
  const root = await mkdtemp(path.join(os.tmpdir(), '画布 导入 ')), old = process.env.DSH_HOME;
  process.env.DSH_HOME = root;
  try { return await body(root); } finally { if (old === undefined) delete process.env.DSH_HOME; else process.env.DSH_HOME = old; await rm(root, { recursive: true, force: true }); }
}

test('导入图片：写进画布数据根、登记资产，重复导入复用同一份', async () => {
  await withHome(async () => {
    const { canvas } = await api.builtinCanvasHandle({ method: 'create', args: { name: '导入测试画布' } });
    const first = await api.builtinCanvasImport({ projectId: canvas.projectId, name: '参考图.png', mime: 'image/png', bytes: png });
    assert.equal(first.ok, true);
    assert.match(first.assetId, /^mov_img_[a-f0-9]{24}$/);
    assert.equal(first.mime, 'image/png');
    assert.equal(first.name, '参考图.png');
    // 文件真的落在画布数据根里（不是外部图床，也不只是记了个 id）。
    const root = (await api.builtinCanvasHandle({ method: 'get', args: { projectId: canvas.projectId } })).canvas.dataRoot;
    const file = path.join(root, first.rel);
    assert.equal((await stat(file)).isFile(), true);
    assert.equal((await stat(file)).size, png.length);
    // 同一张图再导入一次：id 与文件都不重复。
    const again = await api.builtinCanvasImport({ projectId: canvas.projectId, name: '换个名字.png', mime: 'image/png', bytes: png });
    assert.equal(again.assetId, first.assetId);
    assert.equal((await readdir(path.join(root, 'projects', canvas.projectId, 'image'))).length, 1, '不重复落盘');
    const assets = await api.resolveCanvasAdapter(canvas.projectId).then(adapter => adapter.rpc.assetsGet({ ids: [first.assetId] }));
    assert.equal(assets.items[0].kind, 'image');
    assert.equal(assets.items[0].stored, 'disk');
  });
});

test('导入只收 PNG/JPEG/WebP，识别不出来就拒绝，不写成打不开的假素材', async () => {
  await withHome(async () => {
    const { canvas } = await api.builtinCanvasHandle({ method: 'create', args: { name: '导入校验' } });
    await assert.rejects(api.builtinCanvasImport({ projectId: canvas.projectId, mime: 'text/plain', bytes: Buffer.from('not an image') }), /只支持 PNG、JPEG、WebP/);
    await assert.rejects(api.builtinCanvasImport({ projectId: canvas.projectId, mime: 'image/png', bytes: Buffer.alloc(0) }), /空文件/);
    await assert.rejects(api.builtinCanvasImport({ projectId: 'no-such-canvas', mime: 'image/png', bytes: png }), /画布不存在或已删除/);
    // 文件头识别兜底：浏览器报错类型时按内容判定。
    const sniffed = await api.builtinCanvasImport({ projectId: canvas.projectId, mime: 'application/octet-stream', bytes: png });
    assert.equal(sniffed.mime, 'image/png');
  });
});

test('导入的图片能直接当首帧连给视频节点，制作方案里以首帧生效', async () => {
  await withHome(async () => {
    const { canvas } = await api.builtinCanvasHandle({ method: 'create', args: { name: '首帧测试' } });
    const imported = await api.builtinCanvasImport({ projectId: canvas.projectId, name: '开头画面.png', mime: 'image/png', bytes: png });
    const save = (node) => api.builtinCanvasHandle({ method: 'nodeSave', args: { projectId: canvas.projectId, node } });
    await save({ id: 'img', type: 'image', x: 0, y: 0, w: 360, h: 300, data: { label: '开头画面', assetId: imported.assetId, ratio: '1:1', resolution: '720p' } });
    await save({ id: 'v', type: 'video', x: 400, y: 0, w: 360, h: 300, data: { label: '第1段', prompt: '镜头从窗外推近，人物抬头', ratio: '16:9', resolution: '720p', duration: 5 } });
    await api.builtinCanvasHandle({ method: 'edgeAdd', args: { projectId: canvas.projectId, fromNode: 'img', toNode: 'v', fromPort: 'out', toPort: 'frame' } });
    const doc = (await api.builtinCanvasHandle({ method: 'get', args: { projectId: canvas.projectId } })).canvas;
    const input = await api.readCanvasInput(api.builtinCanvasAdapter(), { projectId: canvas.projectId, nodeId: 'v' });
    assert.equal(input.references.length, 1);
    assert.equal(input.references[0].kind, 'image');
    const plan = api.planCanvasNative(input, config);
    assert.equal(plan.args.firstFrameUrl, input.references[0].path, '首帧用导入的文件路径，不下载也不重传');
    assert.deepEqual(plan.args.referenceImages, []);
    // 素材节点不参与制作流程：流程里只有那个视频节点。
    assert.deepEqual(api.flowSteps(doc).map(step => step.id), ['v']);
    assert.equal(api.filmStatus(doc).total, 1);
    assert.deepEqual(api.filmStatus(doc).missing, ['第1段']);
  });
});
