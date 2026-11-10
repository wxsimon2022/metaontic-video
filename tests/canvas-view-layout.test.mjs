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

function harness(documents, viewOptions = {}) {
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
  const { FlowCanvas } = context.createCanvasView({ React: mini.React, h, TOKENS, stageHeight: 620, ...viewOptions });
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
  mini.begin(); let tree = FlowCanvas({ onOpenPage: () => {} });
  await mini.flush();
  mini.begin(); tree = FlowCanvas({ onOpenPage: () => {} });

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
  for (const label of ['新建画布…', '+ 文本', '+ 图片', '+ 视频', '刷新', '重置视图', '导出 JSON', '删除画布', '打开独立页面']) {
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

test('独立页面版：根节点带 movc-page，工具条一行排布、画布区按视口高度撑开', async () => {
  const { FlowCanvas, mini } = harness(documents, { variant: 'page' });
  mini.begin(); FlowCanvas({});
  await mini.flush();
  mini.begin();
  const tree = FlowCanvas({});
  assert.match(tree.props.className, /movc-page/, '独立页面要有 movc-page 类');
  const css = find(tree, (node) => node.type === 'style').children.join('');
  assert.match(css, /\.movc-page \.movc-top \{[^}]*flex-direction: row/, '页面版工具条一行排布');
  assert.match(css, /\.movc-page \.movc-stage \{[^}]*height: clamp\(520px, calc\(100vh - 320px\), 1400px\)/, '页面版画布区按视口撑开');
  assert.match(css, /\.movc-page \.movc-ops \.mov-btn \{[^}]*height: 34px/, '页面版按钮大一档');
});

test('面板版没有 movc-page 类，画布区仍是固定高度', async () => {
  const { FlowCanvas, mini } = harness(documents);
  mini.begin(); FlowCanvas({});
  await mini.flush();
  mini.begin();
  const tree = FlowCanvas({});
  assert.doesNotMatch(tree.props.className, /movc-page/);
  assert.match(find(tree, (node) => node.type === 'style').children.join(''), /\.movc-stage \{[^}]*height: 620px/);
});
