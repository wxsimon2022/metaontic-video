import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { sourceOf } from './source.mjs';

const CACHE = 'test.update-check-v3';
/** 左侧栏提示与设置页共用一份缓存，这里照 optional-update 的做法跑真实模块，只桩掉网络与宿主 React。 */
const SOURCE = sourceOf('ui/updates/update.service', 'ui/updates/update-notice');

/** 极简 React 桩：hook 槽位按调用顺序保留，够验证「第一下确认、第二下更新」的两步状态。 */
function makeReact() {
  const store = [];
  const ran = new Set();
  const pending = [];
  let index = 0;
  return {
    React: {
      useState(init) { const i = index++; if (!(i in store)) store[i] = typeof init === 'function' ? init() : init; return [store[i], (v) => { store[i] = typeof v === 'function' ? v(store[i]) : v; }]; },
      useRef(init) { const i = index++; if (!(i in store)) store[i] = { current: init }; return store[i]; },
      useEffect(fn) { const i = index++; if (!ran.has(i)) { ran.add(i); pending.push(fn); } },
      createElement: () => ({}),
    },
    begin() { index = 0; },
    async flush() { while (pending.length) { const run = pending.shift(); run(); await new Promise((resolve) => setImmediate(resolve)); } },
  };
}

const h = (type, elementProps, children) => ({ type, props: elementProps || {}, children: Array.isArray(children) ? children : children === undefined ? [] : [children] });
const texts = (tree, out = []) => { for (const child of tree?.children || []) { if (typeof child === 'string') out.push(child); else texts(child, out); } return out; };
const find = (tree, match) => (tree && typeof tree === 'object'
  ? (match(tree) ? tree : (tree.children || []).map((child) => find(child, match)).find(Boolean))
  : undefined);

function setup({ local = '3.26.0', list = ['3.26.1', '3.26.0'] } = {}) {
  const saved = new Map();
  const state = { reads: 0, installs: 0, version: list[0] };
  const context = vm.createContext({
    window: { localStorage: {
      getItem: (key) => saved.get(key) ?? null, setItem: (key, value) => saved.set(key, value), removeItem: (key) => saved.delete(key),
    } },
    setImmediate, setTimeout, clearTimeout, Promise,
  });
  vm.runInContext(SOURCE, context);
  const { isNewerVersion } = context.createUpdates({ h: () => null });
  const network = async () => { state.reads += 1; return list; };
  const hint = context.createUpdateHint({ version: local, isNewerVersion, fetchRecentVersions: network, cacheKey: CACHE, maxAge: 60 * 60 * 1000 });
  const manager = () => ({ manager: {
    listBundles: async () => ({ ok: true, value: [{ name: 'metaontic-video', installed: true, source: 'https://example.invalid/metaontic-video-9.9.9.tgz' }] }),
    installBundle: async () => { state.installs += 1; return { ok: true, value: { application: 'applied', version: state.version } }; },
  } });
  const react = makeReact();
  const view = context.createUpdateHintView({
    React: react.React, h, t: (key) => key, hint, version: local, isNewerVersion, manager,
    pluginPackage: 'metaontic-video', updateSpec: 'git+https://example.invalid/plugin.git', updateAttempts: 1,
    cacheKey: CACHE, maxAge: 60 * 60 * 1000,
  });
  return { hint, view, react, saved, state, network, context, setList: (next) => { list = next; state.version = next[0]; } };
}

test('左侧栏提示只看真实检查结果：没缓存先查一次，缓存新鲜就不再联网', async () => {
  const { hint, state } = setup();
  assert.equal(hint.snapshot().pending, false, '还没查过什么都不能显示');
  await hint.refresh(false);
  assert.equal(state.reads, 1);
  assert.equal(hint.snapshot().latest, '3.26.1');
  assert.equal(hint.snapshot().pending, true, '远端确实更新才提示');
  await hint.refresh(false);
  assert.equal(state.reads, 1, '缓存没过期就不重复联网');
});

test('「稍后再说」只压住当前这一版，下个版本照旧提示', async () => {
  const { hint, saved, setList } = setup();
  await hint.refresh(false);
  hint.defer();
  assert.equal(hint.snapshot().pending, false);
  assert.equal(saved.get(`${CACHE}.deferred`), '3.26.1', '稍后要落盘，重启后不重复提示同一版');
  setList(['3.26.2', '3.26.1']);
  await hint.refresh(true);
  assert.equal(hint.snapshot().pending, true, '出了下一版仍然提示');
});

test('设置页检查过、或更新成功后，左侧栏读到同一份结果', async () => {
  const { hint, saved } = setup();
  saved.set(CACHE, JSON.stringify({ at: Date.now(), latest: '3.27.0', versions: ['3.27.0'] }));
  hint.sync();
  assert.equal(hint.snapshot().pending, true, '设置页刚查到的版本这里立刻可见');
  saved.set(`${CACHE}.deferred`, '3.27.0');
  hint.sync();
  assert.equal(hint.snapshot().pending, false, '「稍后」在两边是同一个状态');
  hint.forget();
  assert.equal(hint.snapshot().latest, '', '更新成功后清掉结果');
  assert.equal(saved.has(CACHE), false);
});

test('本机已经是最新、或版本号认不出来时不提示', async () => {
  const same = setup({ local: '3.26.1' });
  await same.hint.refresh(false);
  assert.equal(same.hint.snapshot().pending, false, '同版本不提示');
  const broken = setup({ local: '3.26.0', list: ['beta'] });
  await broken.hint.refresh(false);
  assert.equal(broken.hint.snapshot().latest, '', '认不出的版本不当成新版本');
  assert.equal(broken.hint.snapshot().pending, false);
});

test('左侧栏圆点只在新版本存在时出现', async () => {
  const { view, react, hint } = setup();
  // 先挂上订阅再出检查结果：真实宿主里也是先渲染那一行、后拿到检查结果。
  react.begin();
  assert.equal(view.UpdateHintDot(), null, '没有更新不画圆点');
  await react.flush();
  await hint.refresh(false);
  react.begin();
  const dot = view.UpdateHintDot();
  assert.equal(dot.props.className, 'mov-rail-dot');
  assert.equal(dot.props['aria-hidden'], true, '圆点是纯装饰，读屏靠入口文案');
  assert.equal(dot.props.title, 'sidebarUpdateBadge', '鼠标停在红点上仍能看出这是更新提示');
});

test('面板顶部的更新入口两步确认：第一下转确认，第二下才装', async () => {
  const { view, react, hint, saved, state } = setup();
  react.begin();
  assert.equal(view.UpdateHintBanner(), null, '没有更新时面板顶部不出提示');
  await react.flush();
  await hint.refresh(false);
  react.begin();
  const first = view.UpdateHintBanner();
  const notice = find(first, (node) => node.props?.['data-field'] === 'update-notice');
  assert.ok(notice, '有更新时面板顶部出现提示');
  const open = find(first, (node) => node.props?.['data-action'] === 'update-notice-open');
  assert.ok(open, '第一步是「立即更新」');
  open.props.onClick();
  assert.equal(state.installs, 0, '第一下不安装');
  react.begin();
  const second = view.UpdateHintBanner();
  const confirm = find(second, (node) => node.props?.['data-action'] === 'update-notice-confirm');
  assert.ok(confirm, '第二下才是「确认更新到 v3.26.1」');
  confirm.props.onClick();
  await react.flush();
  for (let i = 0; i < 5; i += 1) await new Promise((resolve) => setImmediate(resolve));
  assert.equal(state.installs, 1, '确认后才真的更新');
  assert.equal(saved.has(CACHE), false, '装好后清掉检查缓存，提示随之消失');
  assert.equal(hint.snapshot().pending, false);
});

test('面板顶部的「稍后再说」不再提示这一版，也不会触发安装', async () => {
  const { view, react, hint, state } = setup();
  react.begin();
  view.UpdateHintBanner();
  await react.flush();
  await hint.refresh(false);
  react.begin();
  const first = view.UpdateHintBanner();
  find(first, (node) => node.props?.['data-action'] === 'update-later').props.onClick();
  assert.equal(hint.snapshot().pending, false, '稍后立即隐藏提示');
  assert.equal(state.installs, 0);
  react.begin();
  assert.equal(view.UpdateHintBanner(), null, '没有更新也不显示空面板');
});

test('左侧栏入口只画红点：名字不带「有更新」，也不再为重读文字重注册', () => {
  const source = readFileSync(new URL('../src/businesses/video-generation/client.ts', import.meta.url), 'utf8');
  assert.match(source, /updateBanner: \(\) => h\(UpdateHintBanner/, '点入口进来就有更新入口');
  assert.match(source, /const railIcon = \(props: any\)/);
  assert.match(source, /className: 'mov-rail-hint'/, '圆点挂在入口图标外面那层壳上');
  assert.match(source, /label: \(\) => t\('panelSidebarLabel'\)/, '入口名字就是插件名');
  assert.doesNotMatch(source, /panelSidebarLabel'\) \+/, '不再把「有更新」拼进入口名字');
  assert.doesNotMatch(source, /updateHint\.subscribe\(/, '红点自己随状态重渲染，不用重注册入口');
  assert.match(source, /ensureUpdateHintStyles\(\)/, '圆点样式只注入一次');
  assert.equal(source.match(/\}, railIcon\)\)/g)?.length, 1, '只有带更新入口的那一行才画圆点，画布入口不带');
});

test('红点样式只注入一次，并在展开的左侧栏里贴到入口那一行的右端', () => {
  const { context } = setup();
  let injected = null;
  const doc = {
    head: { querySelector: (selector) => (injected && selector === 'style[data-mov-update-hint]' ? injected : null), append: (element) => { injected = element; } },
    createElement: () => ({ setAttribute(name) { this.attr = name; }, set textContent(value) { this.css = value; } }),
  };
  assert.equal(context.ensureUpdateHintStyles(doc), true);
  assert.match(injected.css, /\.mov-rail-dot \{/, '红点样式走注入的样式表，组件里不再写内联样式');
  assert.match(injected.css, /--dsw-alias-state-error-primary/, '红点跟着宿主的报错色，深浅色主题都不刺眼');
  assert.match(injected.css, /:has\(> span:nth-child\(2\)\)/, '按有没有名字区分展开与收起');
  assert.match(injected.css, /:has\(> span:nth-child\(2\)\) \.mov-rail-dot \{ display: none; \}/, '展开时组件里的圆点收起，只留名字后面那一个');
  assert.match(injected.css, /> span:nth-child\(2\)::after/, '展开时红点画在入口名字那个 span 上');
  assert.match(injected.css, /vertical-align: super/, '红点做成上标，落在最后一个字的右上角');
  assert.match(injected.css, /margin-left: -1px/, '红点贴住字的右上角，不往外飘');
  assert.equal(context.ensureUpdateHintStyles(doc), true, '已经有样式就不重复注入');
  assert.equal(context.ensureUpdateHintStyles(null), false, '没有 DOM 时直接跳过');
});
