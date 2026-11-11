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

function harness(documents) {
  const context = vm.createContext({
    fetch: async (url, options = {}) => {
      const { method, args } = JSON.parse(options.body || '{}');
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
