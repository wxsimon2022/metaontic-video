import { resolveCanvasSelection } from './canvas-launcher.js';

export async function canvasNativeRpc(args, fetcher = fetch) {
  const response = await fetcher('/metaontic-video/canvas-native', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(args), signal: AbortSignal.timeout(20000) });
  let body; try { body = await response.json(); } catch { throw new Error('画布直接制作服务尚未就绪，请核对插件加载状态。'); }
  if (!response.ok || body?.error) throw new Error(body?.error || '制作请求未完成，请查询原记录，不要重复生成。');
  return body;
}

/** 捕获原版0.20.1节点发送/重新生成；不修改宿主或原版文件，不创建聊天草稿。 */
export function mountCanvasNative({ document: doc, MutationObserver: Observer, rpc = canvasNativeRpc, resolve = resolveCanvasSelection }) {
  if (!doc?.body || !Observer) return () => {};
  let disposed = false, dialog: any, timer: any, target: any, current: any, busy = false;
  const badges = new Map<any, any>();
  const composers = new Map<any, any>();
  let info: any = null, infoError = '', readingInfo = false;
  const style = doc.createElement('style');
  style.textContent = '.dshic-composer[data-metaontic-bound] .dshic-composer-controls .is-model{display:none!important}.dshic-composer[data-metaontic-bound] .dshic-send{width:auto!important;min-width:100px;padding:0 12px!important;font-size:12px;white-space:nowrap}.dshic-composer[data-metaontic-bound] .dshic-send svg{display:none}.dshic-composer[data-metaontic-bound] .dshic-send::after{content:"生成并确认费用"}.mov-canvas-binding{margin:0 12px 10px;padding:10px 12px;border-radius:8px;background:#7563ff12;font-size:12px;line-height:1.7;overflow-wrap:anywhere}.mov-canvas-binding strong{display:block}';
  doc.head.append(style);
  const el = (tag, text = '') => { const n = doc.createElement(tag); n.textContent = text; return n; };
  const stop = e => { e.preventDefault(); e.stopImmediatePropagation(); };
  async function refreshInfo() {
    if (disposed || readingInfo) return;
    readingInfo = true;
    try { info = await rpc({ action: 'info' }); infoError = ''; }
    catch { info = null; infoError = 'MetaOnticVideo连接未就绪，请核对插件已加载'; }
    finally { readingInfo = false; if (!disposed) scan(); }
  }
  const clearTimer = () => { if (timer) clearTimeout(timer); timer = undefined; };
  function close() { clearTimer(); dialog?.remove(); dialog = undefined; current = undefined; busy = false; }
  function shell(title) {
    close();
    dialog = el('dialog'); dialog.dataset.metaonticNative = 'dialog';
    dialog.style.cssText = 'width:min(620px,calc(100vw - 32px));max-height:85vh;overflow:auto;box-sizing:border-box;border:1px solid #8886;border-radius:16px;padding:24px;background:var(--dsw-alias-background-primary,#fff);color:var(--dsw-alias-label-primary,#222);z-index:2147483647;';
    dialog.append(el('h3', title));
    const exit = button('关闭', close); exit.style.float = 'right'; dialog.prepend(exit);
    dialog.addEventListener('cancel', e => { e.preventDefault(); close(); });
    dialog.addEventListener('pointerdown', e => e.stopPropagation());
    doc.body.append(dialog); dialog.showModal(); return dialog;
  }
  function button(label, action) {
    const b = el('button', label); b.type = 'button'; b.className = 'dshic-btn'; b.style.cssText = 'margin:6px 8px 6px 0;padding:8px 12px;cursor:pointer;';
    b.addEventListener('click', async () => { if (busy || disposed) return; busy = true; b.disabled = true; try { await action(); } catch (e) { showError(e.message); } finally { busy = false; if (b.isConnected) b.disabled = false; } }); return b;
  }
  function showError(message) { if (!dialog) return; let status = dialog.querySelector('[role=status]'); if (!status) { status = el('p'); status.setAttribute('role', 'status'); dialog.append(status); } status.textContent = message; }
  function check(label) { const row = el('label'), box = el('input'); box.type = 'checkbox'; row.style.cssText = 'display:block;margin:12px 0;line-height:1.6;'; row.append(box, doc.createTextNode(' ' + label)); dialog.append(row); return box; }
  async function preview(operation, draft) {
    const before = dialog;
    const response = await rpc({ action: 'prepare', ...target, operation, draft });
    if (disposed || !dialog || dialog !== before) return;
    if (response.job) return renderJob(response.job);
    const p = response.proposal; const panel = shell('MetaOnticVideo · 制作与费用确认');
    const pre = el('pre', p.prompt); pre.style.cssText = 'white-space:pre-wrap;overflow-wrap:anywhere;max-height:30vh;overflow:auto;font:inherit;background:#8881;padding:12px;'; panel.append(pre);
    panel.append(el('p', `${p.model} · ${p.ratio}${p.duration ? ` · ${p.duration}秒 · ${p.resolution.toUpperCase()} · 音频${p.generateAudio ? '开' : '关'}` : ' · 2048×2048'}`));
    if (p.references.length) panel.append(el('p', `参考素材：${p.references.map(r => `${r.port === 'frame' ? '首帧' : '参考图'} ${r.nodeId}`).join('、')}`));
    panel.append(el('p', p.estimate ? `本次基础估价约 ¥${p.estimate.cny.toFixed(4)}，实际以渠道账单为准。` : '本次会调用模型并单独计费，无法给出可靠金额，按渠道实际用量结算。'));
    for (const note of p.notes || []) panel.append(el('p', note));
    const plan = check('我已核对本段内容、规格及参考素材，认可此制作方案');
    const cost = check('我同意本次模型调用费用');
    const textOnly = p.kind === 'video' && !p.references.length && p.operation === 'generate' ? check('直接文生视频，本次不生成角色参考图') : null;
    panel.append(button('确认并生成', async () => {
      if (!plan.checked || !cost.checked || (textOnly && !textOnly.checked)) throw new Error('请完成上面的确认后再生成。');
      // start按方案id幂等；网络异常保留同一id，不准备第二个付费请求。
      const response = await rpc({ action: 'start', id: p.id, confirmPlan: plan.checked, confirmCost: cost.checked, textOnly: textOnly?.checked === true });
      if (!disposed && dialog === panel) renderJob(response.job);
    }));
  }
  function renderJob(job) {
    current = job;
    const panel = shell('MetaOnticVideo · 画布制作'); current = job;
    const labels = { running: '正在生成，关闭窗口不会重复提交', interrupted: '上次等待已中断，请查询原任务', succeeded: '生成成功，请查看并审核成果', failed: '任务失败，未自动重做', cancelled: '任务已取消', unknown: '任务状态待确认', submission_unknown: '提交结果待核对，已阻止重复生成' };
    panel.append(el('p', labels[job.state] || '任务状态待确认'));
    if (job.taskId) panel.append(el('p', `原任务：${job.taskId}`));
    if (job.message) panel.append(el('p', job.message));
    for (const media of job.media || []) {
      let url; try { url = new URL(media.url); if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) continue; } catch { continue; }
      const player = el(media.kind === 'image' ? 'img' : 'video'); player.src = url.href; player.style.cssText = 'display:block;max-width:100%;max-height:38vh;margin:12px auto;';
      if (media.kind === 'video') { player.controls = true; player.preload = 'metadata'; } else player.alt = '本次生成图片';
      panel.append(player); const link = el('a', '打开成果原文件'); link.href = url.href; link.target = '_blank'; link.rel = 'noopener noreferrer'; panel.append(link);
    }
    if (job.sync?.status === 'pending') { panel.append(el('p', '成果已保留，画布回填待完成；补传不会重新生成。')); panel.append(button('只补传到画布', async () => renderJob((await rpc({ action: 'sync', id: job.id })).job))); }
    else if (job.sync?.status === 'synced') panel.append(el('p', '成果已新增到原画布。'));
    if (job.media?.length && !job.reviewed) {
      panel.append(button('效果可以，完成结果审核', async () => renderJob((await rpc({ action: 'review', id: job.id, accept: true })).job)));
      panel.append(el('p', '不满意可关闭并保留成果；未通过审核不会继续续拍。'));
    } else if (job.reviewed) panel.append(el('p', '结果已审核，可以关闭窗口或选中视频成果节点续拍。'));
    if (['unknown', 'interrupted', 'running'].includes(job.state) && job.taskId && job.state !== 'running') panel.append(button('只查询原任务', async () => renderJob((await rpc({ action: 'query', id: job.id })).job)));
    if (job.state === 'running') timer = setTimeout(async () => {
      try { const response = await rpc({ action: 'status', id: job.id }); if (!disposed && dialog === panel) renderJob(response.job); }
      catch (e) { if (dialog === panel) { showError(e.message); panel.append(button('刷新原制作记录', async () => renderJob((await rpc({ action: 'status', id: job.id })).job))); } }
    }, 2000);
  }
  async function open(selection, isCurrent) {
    const panel = shell('MetaOnticVideo · 读取画布节点'); panel.append(el('p', '正在读取已保存的节点与素材…'));
    target = await resolve(selection.nodeId, selection.visibleIds);
    if (disposed || dialog !== panel) return;
    if (!isCurrent()) throw new Error('画布或节点已变化，请重新点击生成。');
    const response = await rpc({ action: 'latest', ...target });
    if (disposed || dialog !== panel) return;
    if (response.job && (!['succeeded', 'failed', 'cancelled'].includes(response.job.state) || (response.job.media?.length && !response.job.reviewed) || response.job.sync?.status === 'pending')) return renderJob(response.job);
    const form = shell('MetaOnticVideo · 当前节点制作');
    form.append(el('p', '沿用节点已保存的内容、画幅、时长和清晰度；稍后分别确认方案与费用。生成不再打开聊天。'));
    const audio = selection.kind === 'video' ? check('生成同步音频') : null;
    form.append(button('查看本次生成方案', () => preview('generate', { generateAudio: audio?.checked === true })));
    if (selection.kind === 'video') {
      form.append(el('p', '选中本插件直接生成并已审核的视频成果，可在这里填写新的内容续拍。'));
      const prompt = el('textarea'); prompt.placeholder = '本次新增内容（不重演上一段）'; prompt.style.cssText = 'width:100%;min-height:80px;box-sizing:border-box;';
      const transition = el('textarea'); transition.placeholder = '上一段结尾 → 本段动作、镜头与声音衔接'; transition.style.cssText = prompt.style.cssText;
      const seconds = el('input'); seconds.type = 'number'; seconds.min = '4'; seconds.max = '30'; seconds.placeholder = '本次新增秒数';
      const resolution = el('select'); for (const value of ['', '480p', '720p']) { const option = el('option', value ? value.toUpperCase() : '选择续拍清晰度'); option.value = value; resolution.append(option); }
      form.append(prompt, transition, seconds, resolution);
      form.append(button('查看本次续拍方案', () => preview('extend', { prompt: prompt.value, transitionDescription: transition.value, duration: Number(seconds.value), resolution: resolution.value, generateAudio: audio.checked })));
    }
    if (response.job) form.append(button('查看上次成果', () => renderJob(response.job)));
  }
  function selected(root) {
    const nodes = [...root.querySelectorAll('.dshic-canvas .dshic-node[data-node-id]')], selection = nodes.filter(n => n.classList.contains('is-selected'));
    if (selection.length !== 1) return null;
    const node = selection[0], kind = node.classList.contains('type-image') ? 'image' : node.classList.contains('type-video') ? 'video' : '';
    return kind ? { nodeId: node.getAttribute('data-node-id'), visibleIds: nodes.map(n => n.getAttribute('data-node-id')).sort(), kind } : null;
  }
  function capture(event) {
    const b = event.target?.closest?.('button'); if (!b || b.closest('[data-metaontic-native]')) return;
    const composer = b.matches('.dshic-send') && b.closest('.dshic-composer');
    const regenerate = b.closest('.dshic-media-foot') && ['重新生成', 'Regenerate'].includes(b.textContent.trim());
    if (!composer && !regenerate) return;
    const entry = [...badges.values()].find(entry => entry.root.contains(b));
    if (!entry) return;
    let snapshot = selected(entry.root);
    if (regenerate) {
      const node = b.closest('.dshic-node[data-node-id]');
      if (node && (node.classList.contains('type-image') || node.classList.contains('type-video'))) snapshot = { nodeId: node.getAttribute('data-node-id'), visibleIds: [...entry.root.querySelectorAll('.dshic-node[data-node-id]')].map(n => n.getAttribute('data-node-id')).sort(), kind: node.classList.contains('type-image') ? 'image' : 'video' };
    }
    // 剧本/分镜等原版文字工具仍正常工作；图片/视频按钮由本入口独占。
    if (!snapshot) return;
    stop(event); if (event.type !== 'click' || disposed) return;
    if (dialog) { dialog.focus(); return; }
    const before = JSON.stringify(snapshot);
    void open(snapshot, () => entry.root.isConnected && (regenerate ? !!entry.root.querySelector(`[data-node-id="${snapshot.nodeId}"]`) : JSON.stringify(selected(entry.root)) === before)).catch(e => showError(e.message));
  }
  function scan() {
    if (disposed) return;
    for (const [bar, entry] of badges) if (!bar.isConnected) { entry.badge.remove(); badges.delete(bar); }
    for (const bar of doc.querySelectorAll('.dshic-toolbar')) {
      if (badges.has(bar) || !bar.parentElement?.querySelector('.dshic-canvas')) continue;
      const badge = el('span', '图片/视频生成 · MetaOnticVideo'); badge.dataset.metaonticNative = 'badge'; badge.style.cssText = 'font-size:12px;padding:4px 8px;border-radius:8px;background:#7563ff18;'; badge.title = '节点生成与重新生成直接在画布内确认方案、费用和结果；原版批量运行及右键运行仍走原版配置。';
      bar.append(badge); badges.set(bar, { root: bar.parentElement, badge });
    }
    for (const [composer, entry] of composers) {
      const selection = selected(entry.root);
      if (!composer.isConnected || !selection || !entry.root.contains(composer)) {
        entry.binding.remove(); composer.removeAttribute('data-metaontic-bound');
        if (entry.send.isConnected) { entry.send.title = entry.title; entry.send.removeAttribute('aria-label'); }
        composers.delete(composer);
      }
    }
    for (const { root } of badges.values()) {
      const selection = selected(root); if (!selection) continue;
      for (const composer of root.querySelectorAll('.dshic-composer')) {
        let entry = composers.get(composer);
        const send = composer.querySelector('.dshic-send'); if (!send) continue;
        if (!entry) {
          const binding = el('div'); binding.dataset.metaonticNative = 'binding'; binding.className = 'mov-canvas-binding';
          const title = el('strong', 'MetaOnticVideo 直接制作'), model = el('span'); binding.append(title, model);
          composer.prepend(binding); composer.setAttribute('data-metaontic-bound', 'true');
          entry = { root, binding, model, send, original: send.innerHTML, title: send.title }; composers.set(composer, entry);
        }
        const ready = selection.kind === 'image' ? info?.imageReady : info?.videoReady;
        const text = info ? `${info.channel} · ${selection.kind === 'image' ? info.imageModel : info.videoModel} · ${ready ? '沿用插件API密钥' : '请先在插件设置填写API密钥'}\n${selection.kind === 'image' ? '1:1单张图片' : `单段4–${info.singleMax}秒，480P/720P`}；点下方生成，在画布内确认方案、费用并审核结果。` : infoError || '正在读取MetaOnticVideo接入与模型…';
        if (entry.model.textContent !== text) entry.model.textContent = text;
        entry.model.style.whiteSpace = 'pre-line';
        send.title = '使用MetaOnticVideo设置生成；确认费用后才提交'; send.setAttribute('aria-label', 'MetaOnticVideo生成并确认费用');
      }
    }
  }
  doc.addEventListener('click', capture, true);
  doc.defaultView?.addEventListener('focus', refreshInfo);
  const observer = new Observer(scan); observer.observe(doc.body, { childList: true, subtree: true }); scan();
  void refreshInfo();
  return () => { disposed = true; close(); observer.disconnect(); doc.removeEventListener('click', capture, true); doc.defaultView?.removeEventListener('focus', refreshInfo); style.remove(); for (const [composer, entry] of composers) { entry.binding.remove(); composer.removeAttribute('data-metaontic-bound'); if (entry.send.isConnected) { entry.send.title = entry.title; entry.send.removeAttribute('aria-label'); } } composers.clear(); for (const entry of badges.values()) entry.badge.remove(); badges.clear(); };
}
