/** 原版0.20.1起的界面伴随入口；只读取DOM选择与只读RPC，不改写原版源码/配置。 */
const ID = /^[A-Za-z0-9_-]{1,100}$/;
export async function canvasReadRpc(method, args = {}, fetcher = fetch) {
  if (!['projectsList', 'projectsGet'].includes(method)) throw new Error('不支持的画布读取操作');
  const response = await fetcher('/infinite-canvas/api/rpc', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ method, args }), signal: AbortSignal.timeout(10000),
  });
  let body;
  try { body = await response.json(); } catch { throw new Error('画布服务尚未就绪，请核对原版画布已启用。'); }
  if (!response.ok || !body || body.error) throw new Error('画布读取失败，请稍后重试。');
  return body;
}
/** 用当前画布完整节点集合消歧；绝不按同名项目或第一条记录猜测。 */
export async function resolveCanvasSelection(nodeId, visibleIds, rpc = canvasReadRpc) {
  if (!ID.test(nodeId) || !visibleIds.length || visibleIds.some(id => !ID.test(id)) || !visibleIds.includes(nodeId)) throw new Error('请先选中一个画布节点。');
  const listed = await rpc('projectsList');
  const projects = Array.isArray(listed) ? listed : listed?.projects || listed?.items;
  if (!Array.isArray(projects)) throw new Error('画布项目列表不可用。');
  const locations = [];
  for (const p of projects) {
    if (!ID.test(p.id)) throw new Error('画布项目标识无效。');
    if (!p.defaultCanvasDeleted && (!Array.isArray(p.nodeIds) || visibleIds.every(id => p.nodeIds.includes(id)))) locations.push({ projectId: p.id });
    for (const c of p.canvases || []) {
      if (!ID.test(c.id)) throw new Error('子画布标识无效。');
      locations.push({ projectId: p.id, canvasId: c.id });
    }
  }
  if (locations.length > 200) throw new Error('画布数量较多，请暂用视频创作助手指定项目和节点。');
  const matches = [];
  // 分批只读，限制并发；任何读取失败都不能忽略，否则可能误判唯一归属。
  for (let i = 0; i < locations.length; i += 6) {
    const batch = await Promise.all(locations.slice(i, i + 6).map(async loc => {
      const doc = await rpc('projectsGet', { id: loc.projectId, ...(loc.canvasId ? { canvasId: loc.canvasId } : {}) });
      return visibleIds.every(id => Object.hasOwn(doc.nodes || {}, id)) ? loc : null;
    }));
    matches.push(...batch.filter(Boolean));
  }
  if (matches.length !== 1) throw new Error(matches.length ? '多个画布包含相同节点，无法确定归属；请在助手中指定项目和节点。' : '节点尚未同步到画布服务，请等待保存完成后重试。');
  return { ...matches[0], nodeId };
}
export function canvasCreationPrompt(target) {
  return `请使用 MetaOnticVideo 处理我在无限画布中选中的节点。定位信息：${JSON.stringify(target)}。先调用 video_canvas(action:read)读取最新节点及有向上游素材，按节点类型和内容确定图片或视频需求；缺失规格集中询问。沿用现有方案审核、费用确认和分段审核，生成时传入读取返回的canvas，结果自动回填原画布。不要调用原版画布的生成工具，不要在未确认前付费生成。`;
}
export async function launchCanvasSelection({ nodeId, visibleIds, rpc, isCurrent, workspace, returnToChat }) {
  if (typeof workspace?.startSession !== 'function') throw new Error('当前宿主无法打开联动会话，请从视频创作助手发起。');
  const target = await resolveCanvasSelection(nodeId, visibleIds, rpc);
  if (!isCurrent()) throw new Error('选中的节点或画布已改变，请重新点击。');
  await workspace.startSession(undefined, { agentPreset: 'video-director', prompt: canvasCreationPrompt(target), whenDraftExists: 'append' });
  await returnToChat?.();
}
/** 每个原版画布工具栏加独立按钮；卸载移除入口、断开观察，不接管原版按钮。 */
export function mountCanvasLauncher({ document: doc, MutationObserver: Observer, workspace, returnToChat, rpc = canvasReadRpc }) {
  if (!doc?.body || !Observer) return () => {};
  let disposed = false, scheduled = false;
  const entries = new Map<any, any>();
  const selection = root => {
    const nodes = [...root.querySelectorAll('.dshic-canvas .dshic-node[data-node-id]')];
    const selected = nodes.filter(n => n.classList.contains('is-selected'));
    const visibleIds = nodes.map(n => n.getAttribute('data-node-id')).sort();
    return { nodeId: selected.length === 1 ? selected[0].getAttribute('data-node-id') : '', visibleIds };
  };
  const signature = root => JSON.stringify(selection(root));
  const setText = (el, text) => { if (el.textContent !== text) el.textContent = text; };
  function scan() {
    scheduled = false;
    if (disposed) return;
    for (const [bar, entry] of entries) if (!bar.isConnected || !entry.root.contains(bar)) { entry.container.remove(); entries.delete(bar); }
    for (const bar of doc.querySelectorAll('.dshic-toolbar')) {
      const root = bar.parentElement;
      if (!root?.querySelector('.dshic-canvas')) continue;
      let entry = entries.get(bar);
      if (!entry) {
        const container = doc.createElement('span'); container.dataset.metaonticCanvas = 'launcher';
        container.style.cssText = 'display:inline-flex;align-items:center;gap:6px;flex-wrap:wrap;max-width:100%;';
        const button = doc.createElement('button'); button.type = 'button'; button.className = 'dshic-btn';
        button.textContent = '用 MetaOnticVideo 生成';
        const status = doc.createElement('span'); status.setAttribute('role', 'status'); status.style.cssText = 'font-size:12px;max-width:340px;white-space:normal;';
        container.append(button, status); bar.append(container);
        entry = { root, container, button, status, busy: false }; entries.set(bar, entry);
        button.addEventListener('pointerdown', e => e.stopPropagation());
        button.addEventListener('click', async e => {
          e.stopPropagation(); if (entry.busy || disposed) return;
          const snapshot = selection(root), before = signature(root);
          if (!snapshot.nodeId) { setText(status, '请只选中一个节点。'); return; }
          entry.busy = true; button.disabled = true; setText(status, '正在读取选中节点…');
          try {
            await launchCanvasSelection({ ...snapshot, rpc, workspace: workspace(), returnToChat,
              isCurrent: () => !disposed && bar.isConnected && signature(root) === before });
            if (!disposed) setText(status, '已请求打开创作助手，发送已填好的请求即可。');
          } catch (error) { if (!disposed) setText(status, error.message || '联动未完成，请重试。'); }
          finally { entry.busy = false; schedule(); }
        });
      } else if (!bar.contains(entry.container)) bar.append(entry.container);
      const selected = selection(root).nodeId;
      entry.button.disabled = entry.busy || !selected;
      entry.button.title = selected ? '自动带入选中节点及上游素材，打开创作助手；发送后确认方案和费用' : '请先选中一个节点（一次处理一个）';
    }
  }
  function schedule() { if (!disposed && !scheduled) { scheduled = true; queueMicrotask(scan); } }
  const observer = new Observer(schedule);
  observer.observe(doc.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['class', 'data-node-id'] });
  scan();
  return () => { disposed = true; observer.disconnect(); for (const entry of entries.values()) entry.container.remove(); entries.clear(); };
}
