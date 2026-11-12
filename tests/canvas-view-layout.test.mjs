import vm from 'node:vm';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { sourceOf } from './source.mjs';

const TOKENS = { text: 'text', muted: 'muted', border: 'border', cardFill: 'card', controlFill: 'control', primaryFill: 'primary', error: 'error', success: 'success' };

/** 极简 React 桩：保留 hook 槽位、第一轮渲染后跑一次 effect，够画布组件渲染出静态结构。 */
function makeReact() {
  const store = [];
  const ran = new Set();
  const pending = [];
  let index = 0;
  return {
    React: {
      useState(init) { const i = index++; if (!(i in store)) store[i] = typeof init === 'function' ? init() : init; return [store[i], (v) => { store[i] = typeof v === 'function' ? v(store[i]) : v; }]; },
      useRef(init) { const i = index++; if (!(i in store)) store[i] = { current: init }; return store[i]; },
      useCallback(fn) { return fn; },
      useEffect(fn) { const i = index++; if (!ran.has(i)) { ran.add(i); pending.push(fn); } },
      createElement: () => ({}),
    },
    begin() { index = 0; },
    async flush() {
      while (pending.length) {
        const run = pending.shift();
        const returned = run();
        await new Promise((resolve) => setImmediate(resolve));
        if (returned && typeof returned.then === 'function') await returned;
      }
    },
  };
}

function harness(documents, native = {}) {
  const context = vm.createContext({
    // canvasNativeRpc 用 AbortSignal.timeout 兜底；VM 上下文里要显式给。
    AbortSignal,
    setInterval,
    clearInterval,
    fetch: async (url, options = {}) => {
      const body = JSON.parse(options.body || '{}');
      if (String(url).includes('canvas-native')) {
        const served = native[body.action];
        if (!served) return { ok: false, json: async () => ({ error: `未支持的画布制作操作：${body.action}` }) };
        try { return { ok: true, json: async () => (typeof served === 'function' ? served(body) : served) }; }
        catch (e) { return { ok: false, json: async () => ({ error: e?.message || '制作请求未完成' }) }; }
      }
      const { method, args } = body;
      const served = documents[method];
      if (!served) return { ok: false, json: async () => ({ error: `未支持的画布方法：${method}` }) };
      return { ok: true, json: async () => (typeof served === 'function' ? served(args) : served) };
    },
  });
  vm.runInContext(sourceOf('businesses/video/client/canvas-view'), context);
  const h = (type, elementProps, children) => ({ type, props: elementProps || {}, children: Array.isArray(children) ? children : children === undefined ? [] : [children] });
  const mini = makeReact();
  const { FlowCanvas } = context.createCanvasView({ React: mini.React, h, TOKENS });
  return { FlowCanvas, mini };
}

const documents = {
  list: { canvases: [{ projectId: 'proj_1', name: '第一张画布', nodeCount: 2 }, { projectId: 'proj_2', name: '第二张画布', nodeCount: 0 }] },
  get: { canvas: { projectId: 'proj_1', name: '第一张画布', dataRoot: '/tmp/canvas', nodes: {}, edges: [] } },
};

function walk(node, visit) {
  if (!node || typeof node !== 'object') return;
  visit(node);
  for (const child of node.children || []) walk(child, visit);
}
const find = (tree, match) => { let hit = null; walk(tree, (node) => { if (!hit && match(node)) hit = node; }); return hit; };
const texts = (tree) => { const out = []; walk(tree, (node) => { for (const child of node.children || []) if (typeof child === 'string') out.push(child); }); return out; };

test('画布操作在画布上方：先操作行、再选择画布、最后才是画布区', async () => {
  const { FlowCanvas, mini } = harness(documents);
  mini.begin(); let tree = FlowCanvas();
  await mini.flush();
  mini.begin(); tree = FlowCanvas();

  const slot = (key) => find(tree, (node) => node.props.key === key);
  const top = slot('top'), stage = slot('stage'), picker = slot('picker'), ops = slot('ops');
  assert.ok(top, '最上方应有画布操作区');
  assert.ok(stage, '应渲染画布区');
  assert.equal(slot('meta'), null, '旧的底部工具条已移走');

  const order = tree.children.filter((child) => child && child.props?.key).map((child) => child.props.key);
  assert.ok(order.indexOf('top') > -1 && order.indexOf('top') < order.indexOf('stage'), `操作区要在画布区之前：${order.join(' → ')}`);
  assert.ok(order.indexOf('picker') < order.indexOf('stage'), '选择画布行同样在画布区之前');
  assert.ok(find(picker, (node) => node.props.key === 'list'), '画布芯片放在选择画布行里');

  const opsLabels = texts(ops);
  for (const label of ['新建画布…', '+ 文本', '+ 图片', '+ 视频', '刷新', '美化布局', '重置视图', '导出 JSON', '删除画布']) {
    assert.ok(opsLabels.includes(label), `操作行应有「${label}」：${opsLabels.join('、')}`);
  }
  const pickerLabels = texts(picker);
  assert.ok(pickerLabels.includes('选择画布'), '选择画布行要有说明文字');
  assert.ok(pickerLabels.includes('第一张画布 · 2 节点'), '画布芯片列出已有画布与节点数');
  assert.ok(pickerLabels.includes('第二张画布 · 0 节点'));
});

test('没有任何画布时也能新建：操作行仍给出「新建画布…」并提示选择画布', async () => {
  const { FlowCanvas, mini } = harness({ list: { canvases: [] } });
  mini.begin(); FlowCanvas({});
  await mini.flush();
  mini.begin();
  const tree = FlowCanvas({});
  const ops = find(tree, (node) => node.props.key === 'ops');
  assert.ok(texts(ops).includes('新建画布…'), '没有画布时仍能新建');
  assert.ok(texts(tree).includes('暂无画布，点「新建画布…」创建一份空白文档。'), '空列表在选择画布行给出指引');
  assert.equal(find(tree, (node) => node.props.key === 'stage'), null, '没有画布时不渲染画布区');
});

test('独立页面样式：工具条两行（操作 + 选择画布），画布区按视口高度撑开，按钮不再用 120px 方块', async () => {
  const { FlowCanvas, mini } = harness(documents);
  mini.begin(); FlowCanvas();
  await mini.flush();
  mini.begin();
  const tree = FlowCanvas();
  const css = find(tree, (node) => node.type === 'style').children.join('');
  assert.match(css, /\.movc-ops \.mov-btn \{[^}]*height: 32px/, '工具条按钮按内容排布');
  assert.match(css, /\.movc-ops \.mov-btn \{[^}]*border-radius: 8px/, '按钮沿用宿主 8px 圆角，不用胶囊');
  assert.doesNotMatch(css, /border-radius: 999px/, '画布内的控件不用胶囊圆角');
  assert.match(css, /\.movc-stage \{[^}]*height: clamp\(520px, calc\(100vh - 320px\), 1400px\)/, '画布区按视口高度撑开');
  assert.match(css, /\.movc-top \{[^}]*flex-direction: column/, '操作行与选择画布行上下排布');
  assert.ok(!/打开独立页面/.test(texts(tree).join('')), '独立页面里不再有「打开独立页面」按钮');
});

test('流程顺序：按连线从上游排队，成果节点不参与，已产出节点标为完成', () => {
  const context = vm.createContext({});
  vm.runInContext(sourceOf('businesses/video/client/canvas-view'), context);
  const canvas = {
    nodes: {
      script: { id: 'script', type: 'script', data: { text: '剧本' } },
      v2: { id: 'v2', type: 'video', data: { label: '第二段', prompt: 'B' } },
      v1: { id: 'v1', type: 'video', data: { label: '第一段', prompt: 'A' } },
      pic: { id: 'pic', type: 'image', data: { label: '封面', prompt: 'C' } },
      out: { id: 'out', type: 'video', metaonticSourceNode: 'v1', data: { assetId: 'a1', status: 'done' } },
    },
    edges: [
      { id: 'e1', fromNode: 'script', toNode: 'v1', fromPort: 'out', toPort: 'prompt' },
      { id: 'e2', fromNode: 'v1', toNode: 'v2', fromPort: 'out', toPort: 'prompt' },
      { id: 'e3', fromNode: 'script', toNode: 'out', fromPort: 'out', toPort: 'prompt', metaonticResult: true },
    ],
  };
  const steps = context.flowSteps(canvas);
  assert.deepEqual([...steps.map(s => s.id)], ['v1', 'v2', 'pic'], '按上游顺序排队，成果节点被排除');
  assert.equal(steps[0].done, true, '有成果节点指回 v1');
  assert.equal(steps[1].done, false);
  assert.equal(context.flowSteps(null).length, 0);
});

test('一键美化布局：按连线分层、上下游不重叠、成果节点排在源节点右侧', () => {
  const context = vm.createContext({});
  vm.runInContext(sourceOf('businesses/video/client/canvas-view'), context);
  const boxes = (positions, nodes) => Object.entries(positions).map(([id, spot]) => {
    const node = nodes[id];
    const w = Number(node.w) || 360, h = Number(node.h) || 300;
    return { id, x: spot.x, y: spot.y, w, h };
  });
  const canvas = {
    nodes: {
      script: { id: 'script', type: 'script', x: 900, y: 0, w: 420, h: 320, data: { text: '剧本' } },
      v1: { id: 'v1', type: 'video', x: 40, y: 700, w: 360, h: 300, data: { label: '第一段' } },
      v2: { id: 'v2', type: 'video', x: 0, y: 0, w: 360, h: 300, data: { label: '第二段' } },
      out: { id: 'out', type: 'video', x: 5, y: 5, w: 360, h: 280, metaonticSourceNode: 'v1', data: { assetId: 'a1' } },
    },
    edges: [
      { id: 'e1', fromNode: 'script', toNode: 'v1', fromPort: 'out', toPort: 'prompt' },
      { id: 'e2', fromNode: 'v1', toNode: 'v2', fromPort: 'out', toPort: 'prompt' },
      { id: 'e3', fromNode: 'v1', toNode: 'out', fromPort: 'out', toPort: 'prompt', metaonticResult: true },
    ],
  };
  const { positions, moved } = context.tidyLayout(canvas);
  assert.equal(moved, 4, '四个节点原本都摆乱了，应该都被重排');
  assert.ok(positions.script.x < positions.v1.x, '剧本排在制作节点左侧');
  assert.ok(positions.v1.x < positions.v2.x, '按连线从左到右分层');
  assert.ok(positions.v1.x < positions.out.x, '成果节点排在源节点右侧');
  const spots = boxes(positions, canvas.nodes);
  for (const a of spots) for (const b of spots) {
    if (a.id === b.id) continue;
    const overlap = a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
    assert.ok(!overlap, `${a.id} 与 ${b.id} 不该重叠`);
  }
  for (const spot of spots) assert.equal(spot.x % 10, 0, '坐标对齐到 10px 网格');
  // 再排一次应当认为已经整齐，且结果稳定。
  const again = context.tidyLayout({ ...canvas, nodes: Object.fromEntries(Object.entries(canvas.nodes).map(([id, node]) => [id, { ...node, ...positions[id] }])) });
  assert.equal(again.moved, 0, '已经整齐时不再挪动');
  assert.deepEqual(JSON.parse(JSON.stringify(again.positions)), JSON.parse(JSON.stringify(positions)), '重复排版结果一致');
  assert.deepEqual(JSON.parse(JSON.stringify(context.tidyLayout({ nodes: {}, edges: [] }))), { positions: {}, moved: 0, width: 0, height: 0 }, '空画布不产生坐标');
  // 环上也要能收口：两个节点互连时不会卡死，仍然分配坐标。
  const loop = context.tidyLayout({ nodes: { a: { id: 'a', type: 'video', w: 360, h: 300 }, b: { id: 'b', type: 'video', w: 360, h: 300 } }, edges: [{ id: 'e', fromNode: 'a', toNode: 'b' }, { id: 'f', fromNode: 'b', toNode: 'a' }] });
  assert.equal(Object.keys(loop.positions).length, 2, '互相连线也能排出版式');
});

test('点「美化布局」把新坐标写回画布，不改内容与连线', async () => {
  const saved = [];
  const doc = () => ({ canvas: { projectId: 'p1', name: '青旅宣传片', dataRoot: '/tmp/canvas',
    nodes: {
      a: { id: 'a', type: 'video', x: 800, y: 640, w: 360, h: 300, data: { label: '第一段', prompt: 'A' } },
      b: { id: 'b', type: 'video', x: 0, y: 0, w: 360, h: 300, data: { label: '第二段', prompt: 'B' } },
    },
    edges: [{ id: 'e1', fromNode: 'a', toNode: 'b', fromPort: 'out', toPort: 'prompt' }] } });
  const { FlowCanvas, mini } = harness({
    list: { canvases: [{ projectId: 'p1', name: '青旅宣传片', nodeCount: 2 }] },
    get: doc,
    nodeSave: (args) => { saved.push(args.node); return { canvas: { projectId: 'p1', node: { ...args.node, type: (doc().canvas.nodes)[args.node.id].type, data: {} } } }; },
  });
  mini.begin(); FlowCanvas();
  await mini.flush();
  mini.begin();
  const tree = FlowCanvas();
  const button = find(tree, (node) => node.props.key === 'tidy');
  assert.ok(button, '操作行应有「美化布局」按钮');
  assert.ok(texts(button).includes('美化布局'), '按钮文案是「美化布局」');
  button.props.onClick();
  for (let i = 0; i < 40 && saved.length < 2; i += 1) await new Promise((resolve) => setImmediate(resolve));
  assert.equal(saved.length, 2, '两个节点都写回了新坐标');
  assert.deepEqual(saved.map((node) => node.id).sort(), ['a', 'b']);
  for (const node of saved) {
    assert.equal(node.data, undefined, '只写坐标，不动节点内容');
    assert.equal(node.type, undefined, '不重写节点类型');
    assert.equal(node.x % 10, 0, '坐标对齐 10px 网格');
  }
  assert.ok(saved.find((node) => node.id === 'a').x < saved.find((node) => node.id === 'b').x, '上游节点排在前面');
});

test('画布内写脚本：按脚本铺开剧本/分镜/分段视频节点并自动连线排版', async () => {
  const calls = { nodes: [], edges: [], plans: [] };
  const doc = { projectId: 'p1', name: '青旅宣传片', dataRoot: '/tmp/canvas', nodes: {}, edges: [] };
  const { FlowCanvas, mini } = harness({
    list: { canvases: [{ projectId: 'p1', name: '青旅宣传片', nodeCount: 0 }] },
    get: () => ({ canvas: { ...doc, nodes: { ...doc.nodes }, edges: [...doc.edges] } }),
    nodeSave: (args) => { const node = { ...(doc.nodes[args.node.id] || {}), ...args.node }; doc.nodes[args.node.id] = node; calls.nodes.push(args.node); return { canvas: { projectId: 'p1', node } }; },
    edgeAdd: (args) => { const edge = { id: `e${calls.edges.length + 1}`, ...args }; doc.edges.push(edge); calls.edges.push(edge); return { canvas: { projectId: 'p1', edge } }; },
  }, {
    info: { singleMax: 15, videoReady: true, textModel: 'deepseek v4.1 flash', textReady: true },
    write: (body) => ({ script: `# 青旅的清晨\n\n${body.idea}`, model: 'deepseek v4.1 flash', usage: { promptTokens: 1, completionTokens: 2 } }),
    plan: (body) => {
      calls.plans.push(body);
      const shots = body.script.includes('|') ? [{ index: 1, visual: '镜头：1\n画面：清晨天台' }, { index: 2, visual: '镜头：2\n画面：前台接待' }] : [];
      return { totalSeconds: 30, segmentSeconds: 15, singleMax: 15,
        segments: [{ kind: 'generate', seconds: 15, prompt: '第一句。' }, { kind: 'extend', seconds: 15, prompt: '第二句。' }], shots };
    },
  });
  const flush = async (rounds = 40) => { for (let i = 0; i < rounds; i += 1) await new Promise((resolve) => setImmediate(resolve)); };
  mini.begin(); FlowCanvas();
  await mini.flush();
  mini.begin();
  let tree = FlowCanvas();
  const opsLabels = texts(find(tree, (node) => node.props.key === 'ops'));
  assert.ok(opsLabels.includes('写脚本…') && opsLabels.includes('+ 剧本'), `操作行要有写脚本入口：${opsLabels.join('、')}`);
  find(tree, (node) => node.props.key === 'write-script').props.onClick();
  await flush();
  mini.begin(); tree = FlowCanvas();
  const modal = find(tree, (node) => node.props.key === 'script-modal');
  assert.ok(modal, '点「写脚本…」应打开弹窗');
  // 先说一句想法交给文本模型，再把返回的脚本写进正文。
  const idea = find(modal, (node) => node.type === 'input');
  const setIdea = (value) => { idea.props.onChange({ target: { value } }); mini.begin(); return FlowCanvas(); };
  let withIdea = setIdea('青旅天台的清晨');
  find(find(withIdea, (node) => node.props.key === 'script-modal'), (node) => node.props.key === 'write').props.onClick();
  await flush();
  mini.begin(); withIdea = FlowCanvas();
  const written = find(find(withIdea, (node) => node.props.key === 'script-modal'), (node) => node.type === 'textarea');
  assert.ok(written.props.value.includes('青旅天台的清晨'), `AI 写脚本应把正文填回来：${written.props.value}`);
  assert.ok(texts(withIdea).some((line) => line.includes('文本模型')), '给出文本模型提示');
  written.props.onChange({ target: { value: '# 剧本\n\n| 镜头 | 画面 |\n| --- | --- |\n| 1 | 清晨天台 |\n| 2 | 前台接待 |' } });
  mini.begin(); tree = FlowCanvas();
  const button = (key) => find(find(tree, (node) => node.props.key === 'script-modal'), (node) => node.props.key === key);
  button('preview').props.onClick();
  await flush();
  mini.begin(); tree = FlowCanvas();
  const preview = find(find(tree, (node) => node.props.key === 'script-modal'), (node) => node.props.key === 'plan');
  assert.ok(preview, '「预览分段」应显示分段计划');
  assert.ok(texts(preview).join(' ').includes('2 段'), texts(preview).join(' '));
  assert.equal(calls.nodes.length, 0, '只预览时不写画布');
  button('ok').props.onClick();
  await flush();
  const types = calls.nodes.map((node) => node.type);
  assert.deepEqual(types.filter((type) => type === 'script').length, 1, '建了一个剧本节点');
  assert.ok(types.includes('storyboard'), '识别到分镜表时同时建分镜节点');
  const segments = calls.nodes.filter((node) => node.type === 'video');
  assert.equal(segments.length, 2, '每段一个视频节点');
  assert.deepEqual(segments.map((node) => node.data.duration), [15, 15]);
  assert.deepEqual(segments.map((node) => node.data.prompt), ['第一句。', '第二句。']);
  assert.deepEqual(segments.map((node) => node.data.label), ['第1段 · 15秒', '第2段 · 15秒']);
  for (const node of segments) assert.equal(node.data.ratio, '16:9', '画幅写进节点');
  const scriptId = calls.nodes.find((node) => node.type === 'script').id;
  const boardId = calls.nodes.find((node) => node.type === 'storyboard').id;
  assert.deepEqual(calls.edges.map((edge) => [edge.fromNode, edge.toNode, edge.toPort]),
    [[scriptId, boardId, 'script'], [boardId, segments.map((node) => node.id)[0], 'prompt'], [boardId, segments.map((node) => node.id)[1], 'prompt']],
    '剧本 → 分镜 → 每段视频节点');
  // 建完节点后自动排版：所有节点坐标都对齐 10px 网格。
  for (const node of Object.values(doc.nodes)) assert.equal(node.x % 10, 0, `${node.id} 的 x 对齐网格`);
  mini.begin(); tree = FlowCanvas();
  assert.ok(texts(tree).some((line) => line.includes('已按脚本铺开 2 段')), '建好后给出下一步提示');
  // 没有分镜表的脚本：不建分镜节点，剧本直接连到各段视频节点。
  const before = { nodes: calls.nodes.length, edges: calls.edges.length };
  find(tree, (node) => node.props.key === 'write-script').props.onClick();
  await flush();
  mini.begin(); tree = FlowCanvas();
  find(find(tree, (node) => node.props.key === 'script-modal'), (node) => node.type === 'textarea').props.onChange({ target: { value: '第一句。第二句。' } });
  mini.begin(); tree = FlowCanvas();
  find(find(tree, (node) => node.props.key === 'script-modal'), (node) => node.props.key === 'ok').props.onClick();
  await flush();
  const created = calls.nodes.slice(before.nodes).filter((node) => node.type); // 排版只写坐标，这里只看建节点的调用
  assert.deepEqual(created.map((node) => node.type), ['script', 'video', 'video'], '没有分镜表时不建分镜节点');
  assert.deepEqual(calls.edges.slice(before.edges).map((edge) => [edge.fromNode, edge.toNode]), [[created[0].id, created[1].id], [created[0].id, created[2].id]], '剧本直接连到每段视频节点');
});

test('连拍：一次确认整条链路，逐段停下等审核，确认后才继续下一段', async () => {
  const calls = [];
  const chain = (state, over = {}) => ({ id: 'c1', projectId: 'p1', state, index: 0, total: 2, done: 0, message: '',
    cny: 1.2, priceDate: '2026-01-01',
    segments: [
      { index: 0, label: '第1段', nodeId: 'v1', operation: 'generate', seconds: 15, ratio: '16:9', resolution: '720p', prompt: '第一句。', cny: 0.6 },
      { index: 1, label: '第2段', nodeId: 'v2', operation: 'extend', seconds: 15, ratio: '16:9', resolution: '720p', prompt: '第二句。', cny: 0.6 },
    ], job: null, ...over });
  const media = [{ kind: 'video', url: 'https://example.invalid/seg1.mp4' }];
  const { FlowCanvas, mini } = harness({
    list: { canvases: [{ projectId: 'p1', name: '青旅宣传片', nodeCount: 2 }] },
    get: { canvas: { projectId: 'p1', name: '青旅宣传片', dataRoot: '/tmp/canvas', nodes: {}, edges: [] } },
  }, {
    info: { singleMax: 15, videoReady: true, textModel: 'deepseek v4.1 flash', textReady: true },
    chainPlan: { segments: [{ index: 0, label: '第1段', operation: 'generate', seconds: 15, ratio: '16:9', resolution: '720p', prompt: '第一句。', cny: 0.6 },
      { index: 1, label: '第2段', operation: 'extend', seconds: 15, ratio: '16:9', resolution: '720p', prompt: '第二句。', cny: 0.6 }],
      cny: 1.2, priceDate: '2026-01-01', identity: 'id-1', active: null },
    chainStart: (body) => { calls.push(['start', body]); return { chain: chain('review', { job: { id: 'j1', state: 'succeeded', reviewed: false, sync: { status: 'synced' }, media } }) }; },
    chainNext: (body) => { calls.push(['next', body]); return { chain: chain('running', { index: 1, done: 1 }) }; },
    chainStop: () => { calls.push(['stop']); return { chain: chain('stopped', { done: 1 }) }; },
    chainStatus: { chain: null },
  });
  const flush = async (rounds = 40) => { for (let i = 0; i < rounds; i += 1) await new Promise((resolve) => setImmediate(resolve)); };
  const slot = (tree, key) => find(tree, (node) => node.props && node.props.key === key);
  mini.begin(); FlowCanvas();
  await mini.flush();
  mini.begin();
  let tree = FlowCanvas();
  const ops = slot(tree, 'ops');
  assert.ok(texts(ops).includes('连拍'), `操作行要有连拍入口：${texts(ops).join('、')}`);
  slot(ops, 'chain').props.onClick();
  await flush();
  mini.begin(); tree = FlowCanvas();
  const modal = slot(tree, 'chain-modal');
  assert.ok(modal, '点「连拍」应打开弹窗');
  const plan = slot(modal, 'plan');
  assert.ok(plan, '先给出整条链路的方案');
  const planText = texts(plan).join(' ');
  assert.ok(planText.includes('2 段'), `方案要写清段数：${planText}`);
  assert.ok(planText.includes('第一句。') && planText.includes('第二句。'), '每段提示词都要列出来');
  assert.ok(planText.includes('¥1.2') || planText.includes('1.2'), `给出整条链路的预估合计：${planText}`);
  assert.equal(calls.length, 0, '只看方案不提交任何生成');

  // 两项确认都勾上之前不能开跑。
  const render = () => { mini.begin(); return FlowCanvas(); };
  const checks = (tree) => { const out = []; walk(slot(tree, 'chain-modal'), (node) => { if (node.type === 'input' && node.props.type === 'checkbox') out.push(node); }); return out; };
  const startButton = () => slot(slot(render(), 'chain-modal'), 'start');
  assert.equal(startButton().props.disabled, true, '默认不能直接开跑');
  assert.equal(checks(render()).length, 2, '方案与费用要分别确认');
  checks(render())[0].props.onChange({ target: { checked: true } });
  assert.equal(startButton().props.disabled, true, '只确认方案不能开跑');
  checks(render())[1].props.onChange({ target: { checked: true } });
  startButton().props.onClick();
  await flush();
  assert.equal(calls.length, 1, '只有点开跑才提交一次');
  assert.deepEqual(calls[0], ['start', { action: 'chainStart', projectId: 'p1', confirmPlan: true, confirmCost: true, identity: 'id-1' }], '开跑带上两次确认与方案标识');

  // 第一段出成果后停下来等审核：能看到成果，也能继续或停止。
  mini.begin(); tree = FlowCanvas();
  const reviewModal = slot(tree, 'chain-modal');
  assert.ok(texts(slot(reviewModal, 'chain')).join(' ').includes('等你审核'), '第一段出成果后停下等审核');
  assert.ok(slot(reviewModal, 'media'), '审核时能看这一段成果');
  assert.ok(texts(tree).some((line) => line.includes('连拍已开始')), '给出连拍已开始的提示');
  const nextButton = slot(reviewModal, 'next');
  assert.ok(nextButton, '审核通过才能继续下一段');
  assert.ok(slot(reviewModal, 'stop2'), '审核时也能停止连拍');
  nextButton.props.onClick();
  await flush();
  assert.deepEqual(calls[1], ['next', { action: 'chainNext', id: 'c1', accept: true }], '第二段要显式确认才推进');
  // 收尾：停下连拍，避免留下轮询定时器。
  mini.begin(); tree = FlowCanvas();
  const runningModal = slot(tree, 'chain-modal');
  slot(runningModal, 'stop').props.onClick();
  await flush();
  assert.deepEqual(calls[2], ['stop'], '停下连拍');
  mini.begin(); tree = FlowCanvas();
  assert.equal(slot(slot(tree, 'chain-modal'), 'next'), null, '停下后不再给出继续下一段');
});
test('工具条给出流程主行动与进度，未完成节点标虚线框', async () => {
  const { FlowCanvas, mini } = harness({
    list: { canvases: [{ projectId: 'p1', name: '青旅宣传片', nodeCount: 2 }] },
    get: { canvas: { projectId: 'p1', name: '青旅宣传片', dataRoot: '/tmp/canvas',
      nodes: { v1: { id: 'v1', type: 'video', x: 0, y: 0, w: 360, h: 300, data: { label: '第一段', prompt: 'A' } } }, edges: [] } },
  });
  mini.begin(); FlowCanvas();
  await mini.flush();
  mini.begin();
  const tree = FlowCanvas();
  const ops = find(tree, (node) => node.props.key === 'ops');
  const labels = texts(ops);
  assert.ok(labels.includes('制作「第一段」'), `工具条要有流程主行动：${labels.join('、')}`);
  assert.ok(labels.includes('流程进度 0/1'), '工具条要显示流程进度');
  const node = find(tree, (n) => n.props['data-current'] === 'true');
  assert.ok(node, '当前待制作节点要有标记');
  assert.ok(texts(tree).some((text) => text.includes('当前轮到「第一段」')), '提示要说明当前轮到哪个节点');
});
