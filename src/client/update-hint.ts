/** 浏览器端 update-hint：左侧栏入口与插件面板共用的一份「有没有新版本」状态。
 *  左侧栏那一行由宿主渲染，拿不到设置页的 React state，所以这里单独放一份轻量状态：
 *  读写的是设置页同一份本地缓存，只读检查结果；真正的安装动作仍走 client/updates 的同一套流程。 */
import { createUpdateActions, renderUpdateNotice } from './updates.js';

/** 左侧栏入口的更新提示样式：宿主那一行由宿主渲染，圆点只有一处，位置按行内有没有名字分两种。
 *  展开侧栏时名字就是第二个 span，红点由名字那个 span 的伪元素画成上标角标，落在最后一个字的右上角
 *  （原来写「有更新」的位置）；收起侧栏只剩图标，红点回到图标右上角。
 *  只看样式就够判断，不用在组件里猜宿主当前是展开还是收起。 */
export const UPDATE_HINT_CSS = `
  .mov-rail-hint { position: relative; display: inline-flex; align-items: center; }
  /* 收起侧栏：红点落在图标右上角 */
  .mov-rail-dot {
    position: absolute; top: -1px; right: -1px; width: 8px; height: 8px; border-radius: 50%;
    background: var(--dsw-alias-state-error-primary, #e5533d);
    box-shadow: 0 0 0 2px var(--dsw-specific-sidebar-fill, transparent);
  }
  /* 展开侧栏：这一行有名字，组件里的圆点收起，改在名字最后一个字的右上角点一个角标；贴着字不压字，所以不描边 */
  button:has(.mov-rail-dot):has(> span:nth-child(2)) .mov-rail-dot { display: none; }
  button:has(.mov-rail-dot):has(> span:nth-child(2)) > span:nth-child(2)::after {
    content: ""; display: inline-block; width: 8px; height: 8px; margin-left: -1px; border-radius: 50%;
    background: var(--dsw-alias-state-error-primary, #e5533d);
    vertical-align: super;
  }
`;

/** 样式只注入一次；测试与无 DOM 环境直接返回 false。 */
export function ensureUpdateHintStyles(doc = typeof document === 'undefined' ? null : document) {
  if (!doc || typeof doc.createElement !== 'function' || !doc.head) return false;
  if (doc.head.querySelector('style[data-mov-update-hint]')) return true;
  const style = doc.createElement('style');
  style.setAttribute('data-mov-update-hint', '');
  style.textContent = UPDATE_HINT_CSS;
  doc.head.append(style);
  return true;
}

/** 一份不持有 React 状态的小 store：订阅者（左侧栏的图标、面板顶部的提示）自己重渲染。 */
export function createUpdateHint({ version = '', isNewerVersion, fetchRecentVersions, cacheKey, maxAge, deferKey = `${cacheKey}.deferred` }: any) {
  const listeners = new Set();
  let latest = '', versions: string[] = [], at = 0, deferred = readDeferred(), checking: any = null;

  function storage() { try { return window.localStorage; } catch { return null; } }
  function readDeferred() { try { return String(storage()?.getItem(deferKey) || ''); } catch { return ''; } }
  /** 只读设置页写下的那份检查结果；读不出来就当没有结果，不编造版本号。 */
  function readCache() {
    try {
      const saved = JSON.parse(String(storage()?.getItem(cacheKey) || 'null'));
      if (!saved || typeof saved !== 'object') return { latest: '', versions: [], at: 0 };
      return {
        latest: String(saved.latest || ''),
        versions: Array.isArray(saved.versions) ? saved.versions.filter((item: any) => /^\d+\.\d+\.\d+$/.test(String(item))).slice(0, 3) : [],
        at: Number(saved.at) || 0,
      };
    } catch { return { latest: '', versions: [], at: 0 }; }
  }
  function writeCache() { try { storage()?.setItem(cacheKey, JSON.stringify({ at, latest, versions })); } catch { /* 存不住只是下次再查 */ } }
  /** 比较版本：任一边认不出来都当作没有更新，避免把提示挂在认不出的版本上。 */
  function newer(remote: any) { try { return isNewerVersion?.(remote, version) === true; } catch { return false; } }
  /** 有更新：远端确实比本机新，且用户没有对这一版点过「稍后再说」。 */
  const pending = () => Boolean(latest) && latest !== deferred && newer(latest);
  function snapshot() { return { latest, versions: [...versions], at, deferred, version, checking: Boolean(checking), pending: pending() }; }
  function emit() { for (const listener of [...listeners]) { try { (listener as any)(snapshot()); } catch { /* 单个订阅者出错不影响别人 */ } } }
  function subscribe(listener: any) { listeners.add(listener); return () => { listeners.delete(listener); }; }
  /** 重读缓存与「稍后」：设置页刚检查完、或更新成功后，这里立刻拿到同一份结果。 */
  function sync() {
    const cached = readCache(), nextDeferred = readDeferred();
    const changed = cached.latest !== latest || cached.at !== at || nextDeferred !== deferred;
    latest = cached.latest; versions = cached.versions; at = cached.at; deferred = nextDeferred;
    if (changed) emit();
    return snapshot();
  }
  /** 静默检查：缓存没过期就不联网，失败保留上一次结果；报错留在设置页，这里不打扰用户。 */
  function refresh(force = false) {
    sync();
    if (checking) return checking;
    if (!force && at && Date.now() - at < maxAge) return Promise.resolve(snapshot());
    checking = (async () => {
      try {
        const list = await fetchRecentVersions();
        const next = (Array.isArray(list) ? list : []).map(String).filter((item: string) => /^\d+\.\d+\.\d+$/.test(item)).slice(0, 3);
        if (next.length) { latest = next[0]; versions = next; at = Date.now(); writeCache(); }
      } catch { /* 检查失败保持原样：没提示不等于没更新，设置页可以手动查 */ }
      finally { checking = null; emit(); }
      return snapshot();
    })();
    emit();
    return checking;
  }
  /** 「稍后再说」：只压住当前这一版，出下一版还会提示。 */
  function defer() { deferred = latest; try { storage()?.setItem(deferKey, latest); } catch { /* 存不住这轮也会隐藏 */ } emit(); return snapshot(); }
  /** 更新成功后清掉结果，左侧栏的提示立即消失。 */
  function forget() {
    latest = ''; versions = []; at = 0; deferred = '';
    try { storage()?.removeItem(cacheKey); storage()?.removeItem(deferKey); } catch { /* 清不掉只是下次启动再比对 */ }
    emit();
    return snapshot();
  }
  // 设置页只读这份缓存做展示，这里跟着一起读一遍，打开面板时不会显示上一次的旧结果。
  return { snapshot, pending, subscribe, sync, refresh, defer, forget, readCache };
}

/** 与宿主 React 绑定的两块界面：左侧栏图标上的小圆点、面板顶部的更新入口（两步确认）。 */
export function createUpdateHintView({
  React, h, t, hint, version, isNewerVersion, manager,
  pluginPackage, updateSpec, updateAttempts, cacheKey, maxAge,
}: any) {
  /** 订阅 store：新版本出现或消失时，只有用到它的那一小块重渲染。 */
  function useUpdateHint() {
    const [value, setValue] = React.useState(() => hint.snapshot());
    React.useEffect(() => hint.subscribe(() => setValue(hint.snapshot())), []);
    return value;
  }

  /** 有更新时画一个小圆点：展开的左侧栏贴在这一行右端（原来写「有更新」的位置），收起时落在图标角上。 */
  function UpdateHintDot() {
    const state = useUpdateHint();
    if (!state.pending) return null;
    return h('span', { key: 'dot', className: 'mov-rail-dot', 'aria-hidden': true, title: t('sidebarUpdateBadge') });
  }

  /**
   * 面板顶部的更新入口。跟设置页同一条口径：只提供检查更新与二次确认更新到最新正式版，
   * 第一下把按钮转成「确认更新到 vX」，第二下才真的重装；不提供版本选择与降级。
   */
  function UpdateHintBanner() {
    const state = useUpdateHint();
    const [status, setStatus] = React.useState('idle');
    const [message, setMessage] = React.useState('');
    const [confirm, setConfirm] = React.useState(false);
    const { forgetUpdateCheck, runOnlineUpdate } = createUpdateActions({
      get UPDATE_CACHE_KEY() { return cacheKey; },
      get UPDATE_MAX_AGE_MS() { return maxAge; },
      get PLUGIN_VERSION() { return version; },
      get isNewerVersion() { return isNewerVersion; },
      get PLUGIN_PACKAGE() { return pluginPackage; },
      get UPDATE_SPEC() { return updateSpec; },
      get UPDATE_ATTEMPTS() { return updateAttempts; },
      get manager() { return manager; },
      get t() { return t; },
      get updateLatest() { return hint.snapshot().latest; },
      get updateConfirm() { return confirm === true; },
      get forgetUpdateCheck() { return forgetUpdateCheck; },
      setUpdateConfirm(value: any) { setConfirm(value === true); },
      setUpdateStatus(value: any) { setStatus(value); },
      setUpdateMessage(value: any) { setMessage(value); },
      setUpdateLatest() { /* 面板以 store 里的版本为准 */ },
      setUpdateAt() { /* 检查时间只在设置页展示 */ },
      setUpdateDeferred() { /* 「稍后」由 store 自己记 */ },
    });
    React.useEffect(() => { void hint.refresh(false); }, []);
    if (!state.pending && status === 'idle') return null;
    const line = status === 'installing' ? t('versionUpdating') : message;
    return h('div', { key: 'update-hint', className: 'mov-panel-update', 'data-field': 'panel-update' }, [
      renderUpdateNotice({
        h, t, available: state.pending, latest: state.latest, deferred: state.deferred,
        status, confirmed: confirm, onLater: () => { setConfirm(false); hint.defer(); },
        onUpdate: () => {
          if (!confirm) { setConfirm(true); return; }
          // 装完（或失败）后重读缓存：装成功时 update 流程已清掉缓存，提示随之消失。
          void runOnlineUpdate().then(() => hint.sync());
        },
      }),
      line ? h('p', { key: 'line', className: 'mov-panel-update-line', 'data-field': 'panel-update-line' }, line) : null,
    ]);
  }

  return { useUpdateHint, UpdateHintDot, UpdateHintBanner };
}
