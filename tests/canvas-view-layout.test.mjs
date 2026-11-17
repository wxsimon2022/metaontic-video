import vm from 'node:vm';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { sourceOf } from './source.mjs';
import { api } from './module-test-api.mjs';

/** 画布组件要用 canvas-stages 的阶段常量与投影函数：测试里一起编译，保持与真实打包一致的同一作用域。 */
const VIEW_SOURCE = sourceOf('businesses/video/integrations/canvas-stages', 'businesses/video/client/canvas-view');

const TOKENS = { text: 'text', muted: 'muted', border: 'border', cardFill: 'card', controlFill: 'control', primaryFill: 'primary', error: 'error', success: 'success' };
const PAGE_CSS_STUB = '/* PAGE_CSS 控件样式 */';

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
    availableProfiles: api.availableProfiles,
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
  vm.runInContext(VIEW_SOURCE, context);
  const h = (type, elementProps, children) => ({ type, props: elementProps || {}, children: Array.isArray(children) ? children : children === undefined ? [] : [children] });
  const mini = makeReact();
  // 画布页自己带上 PAGE_CSS（按钮/输入框那套控件外观），这里用一小段占位文本验证它确实被注入。
  const { FlowCanvas } = context.createCanvasView({ React: mini.React, h, TOKENS, PAGE_CSS: PAGE_CSS_STUB });
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
/** 点画布上的创作流程入口：空画布是中央引导块，有节点时是角落的「＋ 创作流程」。 */
const clickFlowEntry = (tree) => {
  const stage = find(tree, (node) => node.props.key === 'stage');
  const entry = find(stage, (node) => node.props.key === 'flow-entry') || find(stage, (node) => node.props.key === 'invite');
  assert.ok(entry, '画布上应有创作流程入口');
  entry.props.onClick({ stopPropagation() {} });
};
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
  // 工具条只留流程操作：不再有 + 文本／+ 图片／+ 视频／写脚本这类建节点按钮。
  for (const label of ['新建画布…', '连拍', '合成成片', '刷新', '美化布局', '重置视图', '导出 JSON', '删除画布']) {
    assert.ok(opsLabels.includes(label), `操作行应有「${label}」：${opsLabels.join('、')}`);
  }
  for (const label of ['+ 文本', '+ 图片', '+ 视频', '+ 剧本', '写脚本…', '导入图片']) {
    assert.ok(!opsLabels.includes(label), `操作行不再有建节点按钮「${label}」：${opsLabels.join('、')}`);
  }
  // 画布本身就是流程入口：空画布中央给「点击画布开始创作」，有节点时角落给「＋ 创作流程」。
  const stageBox = find(tree, (node) => node.props.key === 'stage');
  assert.ok(find(stageBox, (node) => node.props.key === 'invite'), '空画布上要有「点击画布开始创作」入口');
  assert.ok(!find(stageBox, (node) => node.props.key === 'flow-entry'), '空画布不显示「＋ 创作流程」角落入口');
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
  assert.ok(texts(tree).some((text) => text.includes('还没有流程画布') && text.includes('自动创建流程画布') && text.includes('默认关闭')), '空状态要说清默认关闭、需要到设置页打开');
  assert.equal(find(tree, (node) => node.props.key === 'stage'), null, '没有画布时不渲染画布区');
});

test('独立页面样式：工具条两行（操作 + 选择画布），画布区按视口高度撑开，按钮不再用 120px 方块', async () => {
  const { FlowCanvas, mini } = harness(documents);
  mini.begin(); FlowCanvas();
  await mini.flush();
  mini.begin();
  const tree = FlowCanvas();
  const css = find(tree, (node) => node.type === 'style').children.join('');
  assert.ok(css.startsWith(PAGE_CSS_STUB), '画布页自己注入控件样式，不依赖设置页/面板先挂上');
  assert.match(css, /\.movc-ops \.mov-btn \{[^}]*height: 32px/, '工具条按钮按内容排布');
  // 按钮统一一套：8px 圆角 + 1px 描边 + 透明底（不吃宿主默认的灰底），主按钮才实心。
  const buttons = css.match(/\.movc \.mov-btn, \.movc-modal \.mov-btn \{[^}]*\}/)[0];
  assert.match(buttons, /border: 1px solid border/, '统一描边');
  assert.match(buttons, /border-radius: 8px/, '统一 8px 圆角，不用胶囊');
  assert.match(buttons, /background: transparent/, '普通按钮不带底色');
  assert.doesNotMatch(buttons, /background: (?!transparent)/, '默认态不能是灰底');
  assert.match(css, /\.movc \.mov-btn-primary[^{]*\{[^}]*background: primary/, '主按钮仍是实心主色');
  assert.match(css, /\.movc-chip \{[^}]*background: transparent/, '选择画布胶囊与按钮同一套，不带底色');
  assert.match(css, /\.movc-chip \{[^}]*height: 32px/, '胶囊与按钮同高');
  assert.match(css, /\.movc-top \{[^}]*background: card/, '顶部工具条是白卡片，不是灰底');
  assert.match(css, /\.movc-mini \{[^}]*background: transparent/, '节点小按钮同样不带底色');
  assert.doesNotMatch(css, /border-radius: 999px/, '画布内的控件不用胶囊圆角');
  assert.match(css, /\.movc-stage \{[^}]*height: clamp\(520px, calc\(100vh - 320px\), 1400px\)/, '画布区按视口高度撑开');
  assert.match(css, /\.movc-top \{[^}]*flex-direction: column/, '操作行与选择画布行上下排布');
  assert.ok(!/打开独立页面/.test(texts(tree).join('')), '独立页面里不再有「打开独立页面」按钮');
});

test('流程顺序：按连线从上游排队，成果节点不参与，已产出节点标为完成', () => {
  const context = vm.createContext({});
  vm.runInContext(VIEW_SOURCE, context);
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
  vm.runInContext(VIEW_SOURCE, context);
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
  const calls = { nodes: [], edges: [], plans: [], writes: [] };
  const doc = { projectId: 'p1', name: '青旅宣传片', dataRoot: '/tmp/canvas', nodes: {}, edges: [] };
  const { FlowCanvas, mini } = harness({
    list: { canvases: [{ projectId: 'p1', name: '青旅宣传片', nodeCount: 0 }] },
    get: () => ({ canvas: { ...doc, nodes: { ...doc.nodes }, edges: [...doc.edges] } }),
    nodeSave: (args) => { const node = { ...(doc.nodes[args.node.id] || {}), ...args.node }; doc.nodes[args.node.id] = node; calls.nodes.push(args.node); return { canvas: { projectId: 'p1', node } }; },
    edgeAdd: (args) => { const edge = { id: `e${calls.edges.length + 1}`, ...args }; doc.edges.push(edge); calls.edges.push(edge); return { canvas: { projectId: 'p1', edge } }; },
  }, {
    info: { singleMax: 15, videoReady: true, textModel: 'deepseek v4.1 flash', textReady: true },
    write: (body) => { calls.writes.push(body); return { script: `# 青旅的清晨\n\n${body.idea}`, model: 'deepseek v4.1 flash', usage: { promptTokens: 1, completionTokens: 2 } }; },
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
  // 入口在画布上：点画布上的创作流程入口打开面板。
  clickFlowEntry(tree);
  await flush();
  mini.begin(); tree = FlowCanvas();
  let modal = find(tree, (node) => node.props.key === 'script-modal');
  assert.ok(modal, '点画布上的「＋ 创作流程」应先打开第一步');
  assert.ok(texts(modal).includes('创建需求'), '跟对话一样第一步是创建需求');
  // 第一步：写下想拍什么与规格，创建需求只建需求节点与五张阶段卡，不写脚本、不建制作节点。
  find(modal, (node) => node.type === 'input').props.onChange({ target: { value: '青旅天台的清晨' } });
  const typeSelect = find(find(modal, node=>node.props.key==='work-type'),node=>node.type==='select');
  assert.equal(typeSelect.children.length,7, '作品类型为未指定及六类实际配置');
  typeSelect.props.onChange({target:{value:'LIFESTYLE'}});
  mini.begin(); tree = FlowCanvas();
  const createButton = find(find(tree, (node) => node.props.key === 'script-modal'), (node) => node.props.key === 'ok');
  assert.equal(texts(createButton).join(''), '创建需求', '第一步的按钮是「创建需求」');
  createButton.props.onClick();
  await flush();
  const requirement = calls.nodes.find((node) => node.data?.metaonticRequirement);
  assert.ok(requirement, '第一步建一个需求节点');
  assert.match(requirement.data.text, /想拍什么：青旅天台的清晨/);
  assert.equal(requirement.data.metaonticRequirementSpec.work_type,'LIFESTYLE');
  assert.equal(calls.nodes.filter((node) => node.type === 'script').length, 0, '创建需求不写脚本、不建制作节点');
  const firstStages = calls.nodes.filter((node) => node.data?.metaonticStage);
  assert.equal(firstStages.length, 7, '需求确认就铺出整条阶段卡（需求→脚本→分镜→素材→费用→逐段制作→合成）');
  const firstFacts = Object.fromEntries(firstStages.map((node) => [node.data.metaonticStage, node.data.metaonticStageFacts]));
  assert.equal(firstFacts.requirement.requirementSettled, true, '需求卡记上已确认');
  assert.equal(firstFacts.script.scriptDrafted, false, '这时脚本还没写');
  const afterRequirement = calls.nodes.length; // 第一步已经写过需求节点与阶段卡，后面只比较新增量
  mini.begin(); tree = FlowCanvas();
  assert.ok(texts(tree).some((line) => line.includes('需求已创建')), '给出下一步提示');
  const scriptCard = (from) => find(from, (node) => node.props?.['data-stage-action'] === 'script');
  assert.equal(texts(scriptCard(tree)).join(''), '写脚本', '需求建好后②卡指向写脚本');

  // 第二步：再点一次入口，面板带出第一步的需求，写脚本交给文本模型或自己写。
  clickFlowEntry(tree);
  await flush();
  mini.begin(); tree = FlowCanvas();
  modal = find(tree, (node) => node.props.key === 'script-modal');
  assert.ok(texts(modal).includes('写脚本'), '需求确认后再点入口进第二步写脚本');
  assert.ok(texts(modal).some((line) => line.includes('青旅天台的清晨')), '第二步带出第一步创建的需求');
  let withIdea = tree;
  find(find(withIdea, (node) => node.props.key === 'script-modal'), (node) => node.props.key === 'write').props.onClick();
  await flush();
  mini.begin(); withIdea = FlowCanvas();
  assert.equal(calls.writes[0].workType,'LIFESTYLE', '写脚本沿用需求保存的类型');
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
  assert.equal(calls.nodes.length, afterRequirement, '只预览时不写画布');
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
  // 每段先铺一个「画面」节点：对齐 剧本 → 分镜 → 画面 → 视频合成，画面出图后当这一段的首帧。
  const frames = calls.nodes.filter((node) => node.type === 'image');
  assert.deepEqual(frames.map((node) => node.data.label), ['第1段 · 画面', '第2段 · 画面']);
  assert.deepEqual(frames.map((node) => node.data.prompt), ['第一句。', '第二句。'], '画面节点带本段提示词');
  assert.deepEqual(frames.map((node) => node.data.imageCount), [1, 1], '画面节点默认出一张图');
  assert.deepEqual(frames.map((node) => node.data[api.FRAME_MARK]), segments.map((node) => node.id), '画面节点标记它服务的那一段');
  for (const node of frames) assert.equal(node.data.ratio, '16:9', '画幅也写进画面节点');
  assert.deepEqual(calls.edges.map((edge) => [edge.fromNode, edge.toNode, edge.toPort]),
    [[scriptId, boardId, 'script'],
      [boardId, frames[0].id, 'prompt'], [frames[0].id, segments[0].id, 'frame'],
      [boardId, frames[1].id, 'prompt'], [frames[1].id, segments[1].id, 'frame']],
    '剧本 → 分镜 → 每段画面 → 每段视频节点');
  // 画面节点走流程（跟着镜头排队），但不当作一个制作段：逐段进度只数要交付的段。
  assert.deepEqual(api.flowSteps(doc).map((step) => step.id), [frames[0].id, segments[0].id, frames[1].id, segments[1].id], '画面跟着流程排队，每段是自己的画面在前、视频在后');
  assert.deepEqual(api.canvasSegments(doc).map((node) => node.id), segments.map((node) => node.id), '画面节点不算制作段');
  // 建完节点后自动排版：所有节点坐标都对齐 10px 网格。
  for (const node of Object.values(doc.nodes)) assert.equal(node.x % 10, 0, `${node.id} 的 x 对齐网格`);
  mini.begin(); tree = FlowCanvas();
  assert.ok(texts(tree).some((line) => line.includes('已按脚本铺开 2 段')), '建好后给出下一步提示');
  // 同一套流程阶段卡：铺开时就把需求→脚本→费用→逐段制作→成片画在主链路上方，之后由插件同步状态。
  const stages = Object.values(doc.nodes).filter((node) => node.data?.metaonticStage).sort((left, right) => left.x - right.x);
  assert.deepEqual(stages.map((node) => node.data.metaonticStage), ['requirement', 'script', 'storyboard', 'assets', 'cost', 'segments', 'film'], '阶段卡齐全');
  assert.ok(stages.every((node) => node.y < 0), '阶段卡排在主链路上方，不挤占制作流程');
  assert.deepEqual(stages.map((node) => node.data.label), ['① 需求确认', '② 脚本审核', '③ 分镜确认', '④ 素材准备', '⑤ 费用确认', '⑥ 逐段制作', '⑦ 合成成片']);
  const stageNode = find(tree, (node) => node.props['data-stage-state'] !== undefined);
  assert.ok(stageNode, '画布上把阶段卡渲染成带状态标记的节点');
  assert.ok(['done', 'active', 'review', 'ready', 'pending'].includes(stageNode.props['data-stage-state']), '阶段卡带状态标记');
  assert.ok(texts(tree).some((line) => line.includes('流程阶段')), '画布上说明阶段卡的来路与用途');
  // 没有分镜表的脚本：不建分镜节点，剧本直接连到各段视频节点。
  const before = { nodes: calls.nodes.length, edges: calls.edges.length };
  clickFlowEntry(tree);
  await flush();
  mini.begin(); tree = FlowCanvas();
  assert.ok(find(tree, (node) => node.props.key === 'script-modal'), '脚本还没审核时入口仍回到第二步');
  find(find(tree, (node) => node.props.key === 'script-modal'), (node) => node.type === 'textarea').props.onChange({ target: { value: '第一句。第二句。' } });
  mini.begin(); tree = FlowCanvas();
  find(find(tree, (node) => node.props.key === 'script-modal'), (node) => node.props.key === 'ok').props.onClick();
  await flush();
  const created = calls.nodes.slice(before.nodes).filter((node) => node.type && node.type !== 'text'); // 排版只写坐标、阶段卡是文本节点，这里只看建节点的调用
  assert.deepEqual(created.map((node) => node.type), ['script', 'image', 'video', 'image', 'video'], '没有分镜表时不建分镜节点，剧本后每段仍是画面 + 视频');
  assert.equal(calls.nodes.filter((node) => node.data?.metaonticRequirement).length, 1, '第二次铺开不重复建需求节点');
  assert.equal(Object.keys(doc.nodes).filter((id) => /_stage_requirement$/.test(id)).length, 1, '复用同一批阶段卡，不另铺一套');
  assert.deepEqual(calls.edges.slice(before.edges).map((edge) => [edge.fromNode, edge.toNode]),
    [[created[0].id, created[1].id], [created[1].id, created[2].id], [created[0].id, created[3].id], [created[3].id, created[4].id]],
    '没有分镜表时剧本直接连到每段画面，画面再接视频节点');
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
  // 批量生成前的准备清单：参考 LibTV 画布的「开始批量生成前，请先完成」。
  const checks2 = {};
  walk(modal, (node) => { const key = node.props?.['data-batch-check']; if (key) checks2[key] = node; });
  assert.deepEqual(Object.keys(checks2).sort(), ['assets', 'cost', 'shots'], '连拍前列出确认镜头/准备素材/确认费用三项');
  assert.equal(checks2.cost.props['data-ok'], 'true', '费用口径每段单独确认，清单里只作说明');
  assert.ok(texts(checks2.shots).join('').includes('确认镜头'), '清单项要写清楚要确认什么');

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
test('连拍方案标出已有成果的段：只对要生成的段确认，全都有成果时说清不再启动', async () => {
  const seg = (index, label, skip, operation) => ({ index, label, nodeId: `v${index + 1}`, skip, operation, seconds: 15, ratio: '16:9', resolution: '720p', prompt: `${label}的提示词`, cny: skip ? null : 0.6 });
  const openChain = async plan => {
    const { FlowCanvas, mini } = harness({
      list: { canvases: [{ projectId: 'p1', name: '青旅宣传片', nodeCount: 2 }] },
      get: { canvas: { projectId: 'p1', name: '青旅宣传片', dataRoot: '/tmp/canvas', nodes: {}, edges: [] } },
    }, { info: { singleMax: 15, videoReady: true, textModel: 'x', textReady: true }, chainPlan: plan, chainStatus: { chain: null } });
    mini.begin(); FlowCanvas();
    await mini.flush();
    mini.begin();
    const ops = find(FlowCanvas(), (node) => node.props && node.props.key === 'ops');
    find(ops, (node) => node.props && node.props.key === 'chain').props.onClick();
    for (let i = 0; i < 40; i += 1) await new Promise((resolve) => setImmediate(resolve));
    mini.begin();
    return find(FlowCanvas(), (node) => node.props && node.props.key === 'chain-modal');
  };
  // 第 1 段已有成果：方案只对剩下的段确认，并在标题与那一行里写清跳过。
  const modal = await openChain({ segments: [seg(0, '第1段', true, 'generate'), seg(1, '第2段', false, 'extend')], pending: 1, cny: 0.6, priceDate: '2026-01-01', identity: 'id-1', active: null });
  const planText = texts(find(modal, (node) => node.props && node.props.key === 'plan')).join(' ');
  assert.ok(planText.includes('本次生成 1 段'), `标题要写清本次只生成几段：${planText}`);
  assert.ok(planText.includes('另有 1 段已有成果，跳过不重复生成'), `标题要点明跳过的段：${planText}`);
  assert.ok(planText.includes('已有成果，本次跳过'), `跳过的段要单独标出来：${planText}`);
  assert.ok(planText.includes('不重复生成、不重复计费') && planText.includes('已有成果的段不重复生成，也不重复计费'), '方案里要说明不重复计费');
  const skipped = find(modal, (node) => node.props?.['data-skip']);
  assert.ok(skipped, '跳过的段带上 data-skip，界面端可核对');
  assert.ok(find(modal, (node) => node.props && node.props.key === 'start'), '还有要生成的段时仍给「确认并开始连拍」');
  // 整条链路都已有成果：不给确认框与开跑按钮，改成一句说明。
  const all = await openChain({ segments: [seg(0, '第1段', true, 'generate'), seg(1, '第2段', true, 'extend')], pending: 0, cny: 0, priceDate: null, identity: 'id-1', active: null });
  const allText = texts(find(all, (node) => node.props && node.props.key === 'plan')).join(' ');
  assert.ok(allText.includes('都已有成果，没有要生成的了'), `都要写清没有要生成的段：${allText}`);
  assert.equal(find(all, (node) => node.props && node.props.key === 'start'), null, '没有要生成的段就不给开跑按钮');
  assert.equal(find(all, (node) => node.props && node.props.key === 'confirms'), null, '没有要生成的段就不给费用确认框');
  assert.ok(texts(all).some((line) => line.includes('不需要再连拍')), '要说明去哪重做单段');
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

test('节点状态胶囊与流程进度一致：已有成果的节点不能还显示待制作', async () => {
  const { FlowCanvas, mini } = harness({
    list: { canvases: [{ projectId: 'p1', name: '青旅宣传片', nodeCount: 3 }] },
    get: { canvas: { projectId: 'p1', name: '青旅宣传片', dataRoot: '/tmp/canvas', edges: [], nodes: {
      v1: { id: 'v1', type: 'video', x: 0, y: 0, w: 360, h: 300, data: { label: '第一段', prompt: 'A', ratio: '16:9', duration: 5, resolution: '480p' } },
      r1: { id: 'r1', type: 'video', x: 520, y: 0, w: 360, h: 280, metaonticSourceNode: 'v1', data: { label: 'MetaOntic · 视频', status: 'done', assetId: 'r1' } },
      v2: { id: 'v2', type: 'video', x: 0, y: 400, w: 360, h: 300, data: { label: '第二段', prompt: 'B' } },
    } } },
  });
  mini.begin(); FlowCanvas();
  await mini.flush();
  mini.begin();
  const tree = FlowCanvas();
  const badgeOf = (id) => {
    const node = find(tree, (n) => n.props?.className === 'movc-node' && n.props?.key === id);
    assert.ok(node, `画布上应有节点 ${id}`);
    const head = find(node, (n) => n.props?.key === 'head');
    return texts(find(head, (n) => n.props?.key === 'status')).join('');
  };
  assert.equal(badgeOf('v1'), '已完成', '有成果节点的源节点要标已完成');
  assert.equal(badgeOf('r1'), '已完成', '成果节点本身也是已完成');
  assert.equal(badgeOf('v2'), '待制作', '还没成果的节点仍是待制作');
  const labels = texts(find(tree, (node) => node.props.key === 'ops'));
  assert.ok(labels.includes('流程进度 1/2'), `流程进度应把有成果的算进去：${labels.join('、')}`);
});

test('点画布空白处就打开创作流程第一步「创建需求」：有选中的节点时先只取消选择', async () => {
  const { FlowCanvas, mini } = harness({
    list: { canvases: [{ projectId: 'p1', name: '青旅宣传片', nodeCount: 1 }] },
    get: { canvas: { projectId: 'p1', name: '青旅宣传片', dataRoot: '/tmp/canvas', edges: [],
      nodes: { v1: { id: 'v1', type: 'video', x: 0, y: 0, w: 360, h: 300, data: { label: '第一段', prompt: 'A' } } } } },
  }, { info: { singleMax: 15, videoReady: true, textModel: 'deepseek v4.1 flash', textReady: true } });
  const flush = async (rounds = 20) => { for (let i = 0; i < rounds; i += 1) await new Promise((resolve) => setImmediate(resolve)); };
  mini.begin(); FlowCanvas();
  await mini.flush();
  const render = () => { mini.begin(); return FlowCanvas(); };
  const stageOf = (tree) => find(tree, (node) => node.props.key === 'stage');
  const blankClick = (tree) => {
    const stage = stageOf(tree);
    const event = { button: 0, clientX: 12, clientY: 12, pointerId: 1, shiftKey: false,
      currentTarget: { setPointerCapture() {}, getBoundingClientRect: () => ({ left: 0, top: 0 }) } };
    stage.props.onPointerDown(event);
    stage.props.onPointerUp();
  };
  const nodeOf = (tree) => find(tree, (node) => node.props?.className === 'movc-node' && node.props?.key === 'v1');
  let tree = render();
  assert.ok(find(stageOf(tree), (node) => node.props.key === 'flow-entry'), '画布上有节点时角落给「＋ 创作流程」');
  assert.equal(find(stageOf(tree), (node) => node.props.key === 'invite'), null, '有节点时不再显示中央引导块');
  assert.equal(find(tree, (node) => node.props.key === 'script-modal'), null, '没点之前不弹面板');

  // 选中节点后点空白：只取消选择，不弹面板（避免想取消选择却被打断）。
  nodeOf(tree).props.onClick({ stopPropagation() {} });
  tree = render();
  assert.equal(nodeOf(tree).props['data-selected'], 'true', '点节点即选中');
  blankClick(tree);
  tree = render();
  assert.equal(nodeOf(tree).props['data-selected'], 'false', '点空白先取消选择');
  assert.equal(find(tree, (node) => node.props.key === 'script-modal'), null, '取消选择这一下不弹面板');

  // 没有选中的节点时点空白：打开「创作流程」面板。
  blankClick(tree);
  await flush();
  tree = render();
  const modal = find(tree, (node) => node.props.key === 'script-modal');
  assert.ok(modal, '点画布空白处应打开创作流程面板');
  assert.ok(texts(modal).includes('创建需求'), '跟对话一样先创建需求');
  assert.ok(texts(modal).some((line) => line.includes('阶段卡①标为已完成')), '面板要说明这一步只确认需求、不生成');
});

test('阶段卡就是流程：七张卡带主行动按钮、卡间有箭头，点按钮进对应这一步', async () => {
  const calls = [];
  // 已审核过的流程：卡上带插件写的那份事实，脚本卡因此显示「看剧本」。
  const approvedFacts = { requirementSettled: true, duration: 30, ratio: '16:9', resolution: '720p', choice: '画布内创作',
    scriptDrafted: true, scriptApproved: true, specApproved: true, segmentTotal: 2 };
  const stageCard = (key, state, text, index) => ({ id: `st_${key}`, type: 'text', x: 40 + index * 400, y: -340, w: 340, h: 180,
    data: { label: `阶段-${key}`, text, metaonticStage: key, metaonticStageState: state, metaonticStageFacts: approvedFacts } });
  const { FlowCanvas, mini } = harness({
    list: { canvases: [{ projectId: 'p1', name: '青旅宣传片', nodeCount: 7 }] },
    get: { canvas: { projectId: 'p1', name: '青旅宣传片', dataRoot: '/tmp/canvas', edges: [], nodes: {
      st_requirement: stageCard('requirement', 'done', '目标时长：30 秒', 0),
      st_script: stageCard('script', 'done', '剧本：已同步', 1),
      st_storyboard: stageCard('storyboard', 'done', '分镜：2 个镜头', 2),
      st_assets: stageCard('assets', 'done', '素材图：1 张', 3),
      st_cost: stageCard('cost', 'active', '制作方案：已审核', 4),
      st_segments: stageCard('segments', 'active', '制作段：2 段', 5),
      st_film: stageCard('film', 'pending', '等待每段都产出成果', 6),
      script: { id: 'script', type: 'script', x: 60, y: 60, w: 420, h: 320, data: { label: '剧本', text: '# 剧本' } },
      board: { id: 'board', type: 'storyboard', x: 600, y: 60, w: 460, h: 320, data: { label: '分镜', shots: [{ index: 1, visual: '镜头 1' }, { index: 2, visual: '镜头 2' }] } },
      img1: { id: 'img1', type: 'image', x: 600, y: 460, w: 360, h: 260, data: { label: '参考图', assetId: 'a1', ratio: '1:1' } },
      v1: { id: 'v1', type: 'video', x: 1160, y: 60, w: 360, h: 300, data: { label: '第1段 · 15秒', prompt: '第一句。' } },
    } } },
  }, {
    info: { singleMax: 15, videoReady: true, textModel: 'deepseek v4.1 flash', textReady: true },
    latest: (body) => { calls.push(['latest', body]); return { job: null }; },
    chainPlan: (body) => { calls.push(['chainPlan', body]); return { total: 30, segmentSeconds: 15, segments: [{ seconds: 15 }], identity: 'id-1', active: null }; },
    mergeFilm: (body) => { calls.push(['mergeFilm', body]); return { film: { count: 2, seconds: 30, assetId: 'f1', updatedAt: 1763000000000 } }; },
  });
  const flush = async (rounds = 20) => { for (let i = 0; i < rounds; i += 1) await new Promise((resolve) => setImmediate(resolve)); };
  mini.begin(); FlowCanvas();
  await mini.flush();
  const render = () => { mini.begin(); return FlowCanvas(); };
  let tree = render();

  // 卡与卡之间画虚线箭头：五张卡连成一条流程，而不是各自独立的说明卡。
  const arrows = [];
  walk(tree, (node) => { if (node.props?.className === 'movc-stage-edge') arrows.push(node); });
  assert.equal(arrows.length, 6, `七张阶段卡之间应有 6 段箭头：${arrows.length}`);
  assert.equal(arrows[0].props.markerEnd, 'url(#movc-stage-arrow)', '箭头要带箭头标记');

  // 每张卡上都有这一步的主行动按钮。
  const buttons = {};
  walk(tree, (node) => { const key = node.props?.['data-stage-action']; if (key) buttons[key] = node; });
  assert.deepEqual(Object.keys(buttons).sort(), ['assets', 'cost', 'film', 'requirement', 'script', 'segments', 'storyboard'], '七张卡各有主行动');
  const labelOf = (node) => texts(node).join('');
  assert.deepEqual([labelOf(buttons.requirement), labelOf(buttons.script), labelOf(buttons.storyboard), labelOf(buttons.assets), labelOf(buttons.cost), labelOf(buttons.segments), labelOf(buttons.film)],
    ['改需求', '看剧本', '看分镜', '准备素材', '看估价', '做这一段', '合成成片'], '按钮文案就是这一步的动作（需求已建好时①是「改需求」）');
  // 阶段卡不再挂复制/连线/删除这类节点操作，只作流程一步。
  const card = find(tree, (node) => node.props?.key === 'st_cost');
  assert.ok(card, '画布上应有阶段卡');
  assert.ok(card, '画布上应有阶段卡');
  assert.equal(find(card, (node) => node.props?.key === 'actions'), null, '阶段卡不显示节点的复制/连线/删除');

  // ① 改需求：打开第一步「创建需求」，并带出已建好的需求。
  buttons.requirement.props.onClick({ stopPropagation() {} });
  await flush();
  tree = render();
  const requirementModal = find(tree, (node) => node.props.key === 'script-modal');
  assert.ok(requirementModal && texts(requirementModal).includes('创建需求'), '点①卡进第一步创建需求');
  assert.ok(texts(requirementModal).some((line) => line.includes('目标总时长：30 秒') === false && line.includes('创建需求')), '面板就是创建需求这一步');
  // 关掉面板，继续验后面的步骤。
  find(requirementModal, (node) => node.props.key === 'cancel').props.onClick();
  await flush();
  tree = render();
  // ② 看剧本：直接打开剧本节点。
  tree = render();
  const byKey = () => { const out = {}; walk(tree, (node) => { const key = node.props?.['data-stage-action']; if (key) out[key] = node; }); return out; };
  byKey().script.props.onClick({ stopPropagation() {} });
  await flush();
  tree = render();
  const opened = find(tree, (node) => node.props.key === 'modal');
  assert.ok(opened && texts(opened)[0].startsWith('剧本'), `点「看剧本」应打开剧本节点：${opened ? texts(opened).slice(0, 2).join(' | ') : '未打开'}`);
  // ③ 看分镜：打开分镜节点。
  byKey().storyboard.props.onClick({ stopPropagation() {} });
  await flush();
  tree = render();
  const board = find(tree, (node) => node.props.key === 'modal');
  assert.ok(board && texts(board)[0].startsWith('分镜'), `点「看分镜」应打开分镜节点：${board ? texts(board)[0] : '未打开'}`);
  // ④ 准备素材：打开当前这段的制作窗口（里面能导入图片素材或新建参考图节点）。
  byKey().assets.props.onClick({ stopPropagation() {} });
  await flush();
  tree = render();
  const prep = find(tree, (node) => node.props.key === 'modal');
  assert.ok(prep && texts(prep)[0].startsWith('第1段'), `点「准备素材」应打开当前这段的制作窗口：${prep ? texts(prep)[0] : '未打开'}`);
  // ⑤ 看估价：打开连拍方案。
  byKey().cost.props.onClick({ stopPropagation() {} });
  await flush();
  tree = render();
  assert.ok(find(tree, (node) => node.props.key === 'chain-modal'), '点「看估价」进连拍方案');
  assert.ok(calls.some(([name]) => name === 'chainPlan'), '看估价要真的算一次整条链路估价');
  // ⑥ 做这一段：打开当前待制作节点。
  byKey().segments.props.onClick({ stopPropagation() {} });
  await flush();
  tree = render();
  const next = find(tree, (node) => node.props.key === 'modal');
  assert.ok(next && texts(next)[0].startsWith('第1段'), `点「做这一段」应打开当前待制作节点：${next ? texts(next)[0] : '未打开'}`);
  // ⑦ 合成成片：直接走合成。
  byKey().film.props.onClick({ stopPropagation() {} });
  await flush();
  const merged = calls.find(([name]) => name === 'mergeFilm');
  assert.ok(merged, '点「合成成片」要调用一次合成');
  assert.equal(merged[1].projectId, 'p1', '合成带上当前画布');
  tree = render();
  assert.ok(find(tree, (node) => node.props.key === 'film-modal'), '合成后给出成片预览窗口');
});

test('脚本审核在画布上完成：点「确认脚本」写回阶段卡事实，② 变已完成且不再回退', async () => {
  const saved = [];
  const pendingFacts = { requirementSettled: true, duration: 30, ratio: '16:9', resolution: '720p', choice: '画布内创作',
    scriptDrafted: true, scriptApproved: false, specApproved: true, segmentTotal: 2 };
  const card = (key, state, text, index) => ({ id: `st_${key}`, type: 'text', x: 40 + index * 400, y: -340, w: 340, h: 180,
    data: { label: `阶段-${key}`, text, metaonticStage: key, metaonticStageState: state, metaonticStageFacts: pendingFacts } });
  const doc = { projectId: 'p1', name: '青旅宣传片', dataRoot: '/tmp/canvas', edges: [], nodes: {
    st_requirement: card('requirement', 'done', '目标时长：30 秒', 0),
    st_script: card('script', 'review', '剧本：已同步\n审核：等待用户审核', 1),
    st_cost: card('cost', 'pending', '制作方案：已审核', 2),
    st_segments: card('segments', 'active', '制作段：2 段\n已完成：0 段', 3),
    st_film: card('film', 'pending', '等待每段都产出成果', 4),
    script: { id: 'script', type: 'script', x: 60, y: 60, w: 420, h: 320, data: { label: '剧本', text: '# 剧本' } },
  } };
  const { FlowCanvas, mini } = harness({
    list: { canvases: [{ projectId: 'p1', name: '青旅宣传片', nodeCount: 6 }] },
    get: () => ({ canvas: { ...doc, nodes: { ...doc.nodes } } }),
    nodeSave: (args) => { const node = { ...(doc.nodes[args.node.id] || {}), ...args.node, data: { ...(doc.nodes[args.node.id]?.data || {}), ...(args.node.data || {}) } }; doc.nodes[args.node.id] = node; saved.push(args.node); return { canvas: { projectId: 'p1', node } }; },
  });
  const flush = async (rounds = 20) => { for (let i = 0; i < rounds; i += 1) await new Promise((resolve) => setImmediate(resolve)); };
  mini.begin(); FlowCanvas();
  await mini.flush();
  const render = () => { mini.begin(); return FlowCanvas(); };
  const byKey = (tree, key) => find(tree, (node) => node.props?.['data-stage-action'] === key);
  let tree = render();
  // 还没审核：卡上给「确认脚本」，剧本节点上也给同一个动作。
  assert.equal(texts(byKey(tree, 'script')).join(''), '确认脚本', '没审核时阶段卡②给「确认脚本」');
  const scriptNode = find(tree, (node) => node.props?.className === 'movc-node' && node.props?.key === 'script');
  const approveButton = find(scriptNode, (node) => node.props?.key === 'approve');
  assert.equal(texts(approveButton).join(''), '确认脚本', '剧本节点上也能就地确认脚本');

  approveButton.props.onClick({ stopPropagation() {} });
  await flush();
  tree = render();
  // 写回五张卡：事实里脚本审核变成已通过，文案与状态一起更新。
  const written = saved.filter((node) => node.data?.metaonticStage);
  assert.equal(written.length, 5, `确认一次要重写五张阶段卡：${written.length}`);
  assert.ok(written.every((node) => node.data.metaonticStageFacts.scriptApproved === true), '五张卡的事实都记上脚本已审核');
  assert.ok(written.every((node) => node.data.metaonticStageFacts.requirementSettled === true), '原有事实不丢');
  const scriptCard = written.find((node) => node.data.metaonticStage === 'script');
  assert.equal(scriptCard.data.metaonticStageState, 'done');
  assert.match(scriptCard.data.text, /审核：已通过/);
  assert.ok(Number.isInteger(scriptCard.data.metaonticStageRev), '仍按版本盖章，插件可以重写');
  const approvedButton = find(find(tree, (node) => node.props?.className === 'movc-node' && node.props?.key === 'script'), (node) => node.props?.key === 'approve');
  assert.equal(texts(approvedButton).join(''), '已审核', '审核后剧本节点上的按钮变成状态');
  assert.equal(texts(byKey(tree, 'script')).join(''), '看剧本', '审核后阶段卡②换成「看剧本」');
  assert.ok(texts(tree).some((line) => line.includes('脚本审核已通过')), '给出审核通过的提示');
});

test('画布体检：缺成果的段、没接上的素材与断链都报出来，连拍弹窗给完整清单', async () => {
  const { FlowCanvas, mini } = harness({
    list: { canvases: [{ projectId: 'p1', name: '青旅宣传片', nodeCount: 4 }] },
    get: { canvas: { projectId: 'p1', name: '青旅宣传片', dataRoot: '/tmp/canvas', nodes: {
      v1: { id: 'v1', type: 'video', x: 60, y: 60, data: { label: '第1段', prompt: '第一句。', duration: 15, ratio: '16:9', resolution: '720p' } },
      v2: { id: 'v2', type: 'video', x: 480, y: 60, data: { label: '第2段', prompt: '第二句。', duration: 15, ratio: '16:9', resolution: '720p' } },
      r1: { id: 'r1', type: 'video', metaonticSourceNode: 'v1', metaonticCreatedAt: 1, data: { assetId: 'a1', label: '第1段成果' } },
      mat: { id: 'mat', type: 'image', x: 60, y: 420, data: { label: '角色图', assetId: 'm1' } },
    }, edges: [{ id: 'e1', fromNode: 'v1', toNode: 'gone', fromPort: 'out', toPort: 'ref' }] } },
  }, {
    info: { singleMax: 15, videoReady: true, textModel: 'deepseek v4.1 flash', textReady: true },
    chainPlan: { segments: [{ index: 0, label: '第2段', nodeId: 'v2', operation: 'extend', seconds: 15, ratio: '16:9', resolution: '720p', prompt: '第二句。', cny: 0.6 }],
      cny: 0.6, priceDate: '2026-01-01', identity: 'id-1', active: null },
  });
  const flush = async (rounds = 40) => { for (let i = 0; i < rounds; i += 1) await new Promise((resolve) => setImmediate(resolve)); };
  mini.begin(); FlowCanvas();
  await mini.flush();
  mini.begin();
  const tree = FlowCanvas();
  const health = find(tree, (node) => node.props?.key === 'health');
  assert.ok(health, '画布上有问题时给一行体检摘要');
  const healthText = texts(health).join('');
  assert.ok(healthText.includes('1 处错误'), `断链按错误报出来：${healthText}`);
  assert.ok(healthText.includes('1 处提醒'), `缺成果的段按提醒报出来：${healthText}`);
  assert.ok(healthText.includes('1 处提示'), `没接上的素材按提示报出来：${healthText}`);
  assert.ok(healthText.includes('有一条连线指向已被删除的节点'), `摘要要说出第一条问题（按错误优先）：${healthText}`);
  assert.ok(healthText.includes('点「连拍」可以看到完整清单'), '摘要要指路到完整清单');
  assert.ok(healthText.includes('不涉及费用与审核'), '体检只讲画布内容，别让用户以为会跳过费用确认');

  // 连拍弹窗里给完整清单，每条带机器码与严重级，方便核对文案有没有漏项。
  const ops = find(tree, (node) => node.props.key === 'ops');
  find(ops, (node) => node.props.key === 'chain').props.onClick();
  await flush();
  mini.begin();
  const modal = find(FlowCanvas(), (node) => node.props.key === 'chain-modal');
  const items = {};
  walk(modal, (node) => { const code = node.props?.['data-readiness']; if (code) items[code] = node; });
  assert.deepEqual(Object.keys(items).sort(), ['DANGLING_EDGE', 'ORPHAN_ASSET', 'SEGMENT_MISSING_OUTPUT'], '体检项要覆盖断链、缺成果与孤立素材');
  assert.equal(items.DANGLING_EDGE.props['data-severity'], 'error');
  assert.ok(texts(items.ORPHAN_ASSET).join('').includes('角色图'), `点名是哪张素材：${texts(items.ORPHAN_ASSET).join('')}`);
  assert.ok(texts(items.SEGMENT_MISSING_OUTPUT).join('').includes('第2段'), `只报还没成果的那一段：${texts(items.SEGMENT_MISSING_OUTPUT).join('')}`);
  assert.ok(texts(modal).join('').includes('画布体检'), '弹窗里要有体检标题');
});

test('新建参考图节点：标成素材、反绑当前段，不占用「制作「…」」的推进顺序', async () => {
  const saved = [], links = [];
  const facts = { requirementSettled: true, duration: 15, choice: 'generate_first', scriptDrafted: true, scriptApproved: true, segmentTotal: 1 };
  const doc = { projectId: 'p1', name: '青旅宣传片', dataRoot: '/tmp/canvas', edges: [], nodes: {
    st_assets: { id: 'st_assets', type: 'text', x: 40, y: -340, w: 340, h: 180, data: { label: '阶段-assets', text: '素材图：0 张', metaonticStage: 'assets', metaonticStageState: 'active', metaonticStageFacts: facts } },
    v1: { id: 'v1', type: 'video', x: 60, y: 60, w: 360, h: 300, data: { label: '第1段', prompt: '第一句。', duration: 15, ratio: '16:9', resolution: '720p' } },
  } };
  const { FlowCanvas, mini } = harness({
    list: { canvases: [{ projectId: 'p1', name: '青旅宣传片', nodeCount: 2 }] },
    get: () => ({ canvas: { ...doc, nodes: { ...doc.nodes }, edges: [...doc.edges] } }),
    nodeSave: (args) => { saved.push(args.node); doc.nodes[args.node.id] = { id: args.node.id, ...args.node }; return { canvas: { projectId: 'p1', node: doc.nodes[args.node.id] } }; },
    edgeAdd: (args) => { links.push(args); doc.edges.push({ id: 'e-new', fromNode: args.fromNode, toNode: args.toNode, fromPort: args.fromPort, toPort: args.toPort }); return { ok: true }; },
  }, { info: { singleMax: 15, videoReady: true, textModel: 'deepseek v4.1 flash', textReady: true } });
  const flush = async (rounds = 40) => { for (let i = 0; i < rounds; i += 1) await new Promise((resolve) => setImmediate(resolve)); };
  mini.begin(); FlowCanvas();
  await mini.flush();
  const render = () => { mini.begin(); return FlowCanvas(); };
  let tree = render();

  // 这一段还没有素材：点 ④ 准备素材直接给这一段补一个参考图节点。
  find(tree, (node) => node.props?.['data-stage-action'] === 'assets').props.onClick({ stopPropagation() {} });
  await flush();
  const ref = saved.find((node) => node.data?.label === '参考图');
  assert.ok(ref, '点「准备素材」要建一个参考图节点');
  assert.equal(ref.data.metaonticMaterial, true, '参考图节点要标成素材，跟制作段区分开');
  assert.equal(ref.data.metaonticSegmentOf, 'v1', '素材要反绑到它服务的那一段');
  assert.deepEqual(links.map((link) => [link.fromNode, link.toNode, link.toPort]), [[ref.id, 'v1', 'ref']], '并按「参考图」端口接到这一段');

  // 素材节点不算制作段：推进顺序仍然是「1 个制作节点」，进度条不会被素材撑大。
  tree = render();
  const progress = find(tree, (node) => node.props?.key === 'flow-progress');
  assert.ok(progress, '工具条上要有流程进度');
  assert.ok(texts(progress).join('').includes('/1'), `素材不占用制作段：${texts(progress).join('')}`);
});

test('画布体检摘要不把用户指到打不开的地方：没有视频制作节点时不提「连拍」', async () => {
  const { FlowCanvas, mini } = harness({
    list: { canvases: [{ projectId: 'p1', name: '素材画布', nodeCount: 3 }] },
    get: { canvas: { projectId: 'p1', name: '素材画布', dataRoot: '/tmp/canvas', edges: [], nodes: {
      m1: { id: 'm1', type: 'image', x: 60, y: 60, data: { label: '角色图.png', assetId: 'a1' } },
      m2: { id: 'm2', type: 'image', x: 480, y: 60, data: { label: '场景图.png', assetId: 'a2' } },
    } } },
  });
  mini.begin(); FlowCanvas();
  await mini.flush();
  mini.begin();
  const health = find(FlowCanvas(), (node) => node.props?.key === 'health');
  assert.ok(health, '只有素材的画布同样要给体检摘要');
  const line = texts(health).join('');
  assert.ok(line.includes('画布体检：2 处提示'), `按非零档位报数：${line}`);
  assert.ok(line.includes('角色图.png'), `摘要要知道是哪张素材：${line}`);
  // 有素材没接上，但画布上一个视频制作节点都没有：连拍会直接报错，不能指过去。
  assert.ok(!line.includes('连拍'), `没有视频节点时不该提「连拍」：${line}`);
  assert.ok(line.includes('不涉及费用与审核'), '体检口径照旧要说清楚');
});

test('画布内写脚本：等文本模型不算 20 秒就掐掉，被输出上限截断时提醒用户', async () => {
  assert.ok(api.TEXT_WRITE_TIMEOUT_MS > 20000 && api.TEXT_WRITE_TIMEOUT_MS >= 120000,
    `写脚本要等几十秒，RPC 超时按分钟计：${api.TEXT_WRITE_TIMEOUT_MS}`);
  const doc = { projectId: 'p1', name: '青旅宣传片', dataRoot: '/tmp/canvas', edges: [], nodes: {
    req: { id: 'req', type: 'text', x: 60, y: 60, w: 320, h: 200, data: {
      ...api.requirementNodeData('青旅天台的清晨', 30, 15, '16:9', '720p'),
      metaonticStage: 'requirement', metaonticStageState: 'done', metaonticStageFacts: { requirementSettled: true, duration: 30 } } },
  } };
  const { FlowCanvas, mini } = harness({
    list: { canvases: [{ projectId: 'p1', name: '青旅宣传片', nodeCount: 1 }] },
    get: { canvas: { ...doc, nodes: { ...doc.nodes } } },
  }, { info: { singleMax: 15, videoReady: true, textModel: 'deepseek v4.1 flash', textReady: true },
    write: { script: '# 片名\n\n正文', model: 'deepseek v4.1 flash', usage: {}, truncated: true } });
  const flush = async (rounds = 40) => { for (let i = 0; i < rounds; i += 1) await new Promise((resolve) => setImmediate(resolve)); };
  mini.begin(); FlowCanvas();
  await mini.flush();
  mini.begin();
  clickFlowEntry(FlowCanvas());
  await mini.flush();
  mini.begin();
  const tree = FlowCanvas();
  const modal = find(tree, (node) => node.props.key === 'script-modal');
  assert.ok(texts(modal).includes('写脚本'), '需求已确认，入口直接进第二步');
  find(modal, (node) => node.props.key === 'write').props.onClick();
  await flush();
  mini.begin();
  const after = find(FlowCanvas(), (node) => node.props.key === 'script-modal');
  const line = texts(after).join('');
  assert.ok(line.includes('输出上限'), `截断要提醒用户，不能当成完整脚本：${line}`);
  assert.ok(find(after, (node) => node.type === 'textarea').props.value.includes('正文'), '正文照旧填回面板，用户自己决定要不要补');
});
