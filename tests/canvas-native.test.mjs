import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile, readdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { api } from './module-test-api.mjs';
const temp = await mkdtemp(path.join(os.tmpdir(), '画布 直接制作 '));
after(() => rm(temp, { recursive: true, force: true }));
const config = { connectionMode: 'metaontic', metaonticApiKey: 'secret-never-persist', baseUrl: 'https://example.invalid', model: 'doubao-seedance-2-0', imageUseVideoKey: true };
const input = () => ({ canvas: { projectId: 'p', nodeId: 'v', fingerprint: 'f' }, nodes: [{ id: 'v', type: 'video', prompt: '海面日出', ratio: '9:16', duration: 5, resolution: '720P', refOrder: [] }], edges: [], references: [] });
function fixture() {
  let doc = { name: 'test', nodes: { v: { id: 'v', type: 'video', data: { prompt: '海面日出', ratio: '9:16', duration: 5, resolution: '720P' } } }, edges: [] };
  return { doc, adapter: { rpc: { projectsGet: async () => structuredClone(doc), dataRootGet: async () => ({ dataRoot: temp }) } } };
}
async function service(overrides = {}) {
  const f = fixture(), directory = await mkdtemp(path.join(temp, 'job-'));
  let calls = 0, publications = 0;
  const options = { directory, load: async () => f.adapter,
    video: async (_cfg, _body, _signal, progress) => { calls++; await progress.onCreated('task-1'); return { status: 'succeeded', taskId: 'task-1', videoUrl: 'https://example.invalid/result.mp4' }; },
    publish: async () => { publications++; return { status: 'synced' }; }, ...overrides };
  const s = api.createCanvasNativeService(config, options);
  return { ...s, options, f, directory, calls: () => calls, publications: () => publications };
}
const prepare = s => s.handle({ action: 'prepare', projectId: 'p', nodeId: 'v' });
test('canvas connection indicator exposes the active models and readiness without credentials or paid calls', async () => {
  const s = await service(); const info = await s.handle({ action: 'info' });
  assert.equal(info.videoModel, config.model); assert.equal(info.videoReady, true); assert.equal(info.singleMax, 15);
  assert.ok(!JSON.stringify(info).includes('secret-never-persist')); assert.equal(s.calls(), 0); s.dispose();
});
const start = (s, id, extra = {}) => s.handle({ action: 'start', id, confirmPlan: true, confirmCost: true, textOnly: true, ...extra });
async function settled(s, id) {
  for (let n = 0; n < 100; n++) { const { job } = await s.handle({ action: 'status', id }); if (job.state !== 'running') return job; await new Promise(r => setTimeout(r, 10)); }
  throw Error('job did not settle');
}
test('native plan preserves duration/audio; rejects missing specs, unsupported ports and overlong nodes', () => {
  const i = input(); assert.equal(api.planCanvasNative(i, config).args.generateAudio, false);
  assert.equal(api.planCanvasNative(i, config, 'generate', { generateAudio: true }).args.generateAudio, true);
  i.nodes[0].duration = 30; assert.throws(() => api.planCanvasNative(i, config), /4–15/);
  i.nodes[0].duration = 5; i.nodes[0].resolution = ''; assert.throws(() => api.planCanvasNative(i, config), /480P/);
  i.nodes[0].resolution = '720P'; i.edges.push({ id: 'r', fromNode: 'i', toNode: 'v', fromPort: 'last', toPort: 'frame' });
  assert.throws(() => api.planCanvasNative(i, config), /尾帧选取/);
});
test('native plans retain ordered references and reject mixed first-frame/reference modes', () => {
  const i = input(); i.nodes[0].refOrder = ['r2', 'r1'];
  i.edges = ['1', '2'].map(x => ({ id: 'r' + x, fromNode: 'i' + x, toNode: 'v', fromPort: 'out', toPort: 'ref' }));
  i.references = ['1', '2'].map(x => ({ nodeId: 'i' + x, kind: 'image', path: '/image' + x }));
  assert.deepEqual(api.planCanvasNative(i, config).args.referenceImages, ['/image2', '/image1']);
  i.edges[0].toPort = 'frame'; assert.throws(() => api.planCanvasNative(i, config), /不能同时/);
});
test('proposal is free, requires independent plan/cost/text consent, changed node fails closed', async () => {
  const s = await service(); const { proposal } = await prepare(s); assert.equal(s.calls(), 0);
  await assert.rejects(start(s, proposal.id, { confirmCost: false }), /分别确认/);
  await assert.rejects(start(s, proposal.id, { textOnly: false }), /分别确认/);
  s.f.doc.nodes.v.data.prompt = '新稿';
  await assert.rejects(start(s, proposal.id), /节点或上游素材已变化/); assert.equal(s.calls(), 0); s.dispose();
});
test('one paid submission, duplicate start is idempotent, result blocks next generation until review', async () => {
  const s = await service(); const { proposal } = await prepare(s);
  await start(s, proposal.id); await start(s, proposal.id);
  const job = await settled(s, proposal.id); assert.equal(job.state, 'succeeded'); assert.equal(s.calls(), 1); assert.equal(s.publications(), 1);
  assert.equal((await prepare(s)).job.id, job.id);
  await assert.rejects(s.handle({ action: 'review', id: job.id, accept: false }), /未通过/);
  await s.handle({ action: 'review', id: job.id, accept: true }); assert.ok((await prepare(s)).proposal);
  const record = await readFile(path.join(s.directory, `${job.id}.json`), 'utf8'); assert.ok(!record.includes('secret-never-persist'));
  s.dispose();
});
test('failed publication can only republish existing media; never calls generation again', async () => {
  let count = 0; const s = await service({ publish: async () => { if (!count++) throw Error('offline'); return { status: 'synced' }; } });
  const { proposal } = await prepare(s); await start(s, proposal.id); const job = await settled(s, proposal.id);
  assert.equal(job.sync.status, 'pending');
  await s.handle({ action: 'sync', id: job.id }); assert.equal(s.calls(), 1);
  assert.equal((await s.handle({ action: 'status', id: job.id })).job.sync.status, 'synced'); s.dispose();
});
test('unknown submission is durable and blocks resubmission after service reload', async () => {
  const s = await service({ video: async () => { throw Error('network, no task id'); } });
  const { proposal } = await prepare(s); await start(s, proposal.id); const job = await settled(s, proposal.id);
  assert.equal(job.state, 'submission_unknown'); s.dispose();
  const reloaded = api.createCanvasNativeService(config, s.options);
  assert.equal((await prepare(reloaded)).job.id, job.id);
  await assert.rejects(reloaded.handle({ action: 'query', id: job.id }), /没有需要补查/); reloaded.dispose();
});
test('unknown task query uses original task only and survives reload without saved credentials', async () => {
  let submissions = 0, queries = 0;
  const s = await service({ video: async (_c, _b, _s, p) => { submissions++; await p.onCreated('existing-1'); return { status: 'unknown' }; }, query: async (_c, id) => { queries++; assert.equal(id, 'existing-1'); return { status: 'unknown' }; } });
  const { proposal } = await prepare(s); await start(s, proposal.id); await settled(s, proposal.id); s.dispose();
  const reloaded = api.createCanvasNativeService(config, s.options);
  await reloaded.handle({ action: 'query', id: proposal.id }); await settled(reloaded, proposal.id);
  assert.equal(submissions, 1); assert.equal(queries, 1); reloaded.dispose();
});
test('extension cannot trust result node metadata as a substitute for real review', async () => {
  const s = await service(); Object.assign(s.f.doc.nodes.v.data, { metaonticTaskId: 'x', metaonticVideoUrl: 'https://example.invalid/a.mp4', metaonticSeconds: 5, approved: true });
  await assert.rejects(s.handle({ action: 'prepare', projectId: 'p', nodeId: 'v', operation: 'extend' }), /审核上一段/); s.dispose();
});
test('native RPC uses same-origin POST and fails closed on non-json service response', async () => {
  await assert.rejects(api.canvasNativeRpc({ action: 'prepare' }, async (url, options) => { assert.equal(url, '/metaontic-video/canvas-native'); assert.equal(options.method, 'POST'); return { json: async () => { throw Error(); } }; }), /尚未就绪/);
});
