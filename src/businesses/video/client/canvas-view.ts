/** 插件自带的流程画布组件：读取插件自己的画布文档，在面板内渲染、编辑、连线，
 *  并在图片/视频节点内完成「生成 → 费用确认 → 结果审核 → 续拍」，不依赖任何第三方画布插件。 */

/** 画布内制作服务：与内置画布同一个插件、同一份配置，费用确认沿用插件设置里的API密钥。 */
export async function canvasNativeRpc(args: any, fetcher: any = fetch) {
  const response = await fetcher('/metaontic-video/canvas-native', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(args), signal: AbortSignal.timeout(20000) });
  let body;
  try { body = await response.json(); } catch { throw new Error('画布制作服务尚未就绪，请核对插件加载状态。'); }
  if (!response.ok || body?.error) throw new Error(body?.error || '制作请求未完成，请查询原记录，不要重复生成。');
  return body;
}

export function createCanvasView({ React, h, TOKENS }: any) {
  const rpc = async (method: string, args: any = {}) => {
    const response = await fetch('/metaontic-video/canvas', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ method, args }) });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || body?.error) throw new Error(body?.error || '流程画布服务尚未就绪，请核对插件加载状态。');
    return body;
  };
  const mediaUrl = (assetId: string) => `/metaontic-video/canvas-media?assetId=${encodeURIComponent(assetId)}`;
  const NODE_SIZE = { script: [420, 320], storyboard: [460, 340], text: [360, 200], video: [360, 300], image: [360, 300] };
  const sizeOf = (node: any) => ({ w: Number(node?.w) || (NODE_SIZE[node?.type] || [360, 260])[0], h: Number(node?.h) || (NODE_SIZE[node?.type] || [360, 260])[1] });
  const labelOf = (node: any) => String(node?.data?.label || { script: '剧本', storyboard: '分镜', text: '说明', video: '视频', image: '图片' }[node?.type] || '节点');
  const textOf = (node: any) => String(node?.data?.output || node?.data?.text || node?.data?.prompt || '');
  const RATIOS = ['16:9', '9:16', '1:1', '4:3', '3:4'];
  const RESOLUTIONS = ['480p', '720p'];
  const money = (value: any) => Number.isFinite(Number(value)) ? `¥${(Math.round(Number(value) * 10000) / 10000).toFixed(4)}` : '按实际调用计费';
  const phaseText = (state: any) => ({
    succeeded: '生成成功', running: '正在制作', interrupted: '已中断，可查询原任务',
    failed: '制作失败，未自动重试', unknown: '任务状态待确认', submission_unknown: '提交结果未确认', cancelled: '已取消',
  }[state] || '状态未知');

  const CSS = `
.movc { display: flex; flex-direction: column; gap: 10px; }
.movc-bar { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.movc-list { display: flex; flex-wrap: wrap; gap: 6px; }
.movc-chip { border: 1px solid ${TOKENS.border}; background: ${TOKENS.cardFill}; color: ${TOKENS.text}; border-radius: 999px; padding: 4px 10px; font-size: 12px; cursor: pointer; }
.movc-chip[data-active="true"] { border-color: ${TOKENS.primaryFill}; color: ${TOKENS.primaryFill}; }
.movc-hint { font-size: 12px; color: ${TOKENS.muted}; line-height: 1.6; }
.movc-stage { position: relative; height: 460px; border: 1px solid ${TOKENS.border}; border-radius: 12px; background: ${TOKENS.controlFill}; overflow: hidden; cursor: grab; touch-action: none; }
.movc-stage[data-panning="true"] { cursor: grabbing; }
.movc-stage[data-connect="true"] { cursor: crosshair; }
.movc-world { position: absolute; inset: 0; transform-origin: 0 0; }
.movc-edge { stroke: ${TOKENS.primaryFill}; stroke-width: 2; fill: none; opacity: .75; }
.movc-edge-hit { stroke: transparent; stroke-width: 14; fill: none; cursor: pointer; }
.movc-node { position: absolute; display: flex; flex-direction: column; gap: 6px; padding: 8px 10px; border: 1px solid ${TOKENS.border}; border-radius: 10px; background: ${TOKENS.cardFill}; box-shadow: 0 1px 4px #0000000f; overflow: hidden; }
.movc-node[data-selected="true"] { border-color: ${TOKENS.primaryFill}; }
.movc-node-head { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.movc-node-title { font-size: 12px; font-weight: 600; color: ${TOKENS.text}; }
.movc-badge { font-size: 11px; color: ${TOKENS.muted}; }
.movc-actions { display: flex; flex-wrap: wrap; gap: 4px; margin-left: auto; }
.movc-mini { font-size: 11px; padding: 2px 6px; border: 1px solid ${TOKENS.border}; border-radius: 6px; background: transparent; color: ${TOKENS.text}; cursor: pointer; }
.movc-mini:hover { border-color: ${TOKENS.primaryFill}; color: ${TOKENS.primaryFill}; }
.movc-body { font-size: 11px; line-height: 1.6; color: ${TOKENS.muted}; white-space: pre-wrap; overflow: auto; flex: 1; }
.movc-media { width: 100%; height: 100%; object-fit: contain; border-radius: 6px; background: #0001; }
.movc-shots { margin: 0; padding-left: 16px; }
.movc-modal { position: fixed; inset: 0; background: #0006; display: flex; align-items: center; justify-content: center; z-index: 2147483000; }
.movc-modal-body { width: min(640px, calc(100vw - 32px)); max-height: 86vh; overflow: auto; box-sizing: border-box; border: 1px solid ${TOKENS.border}; border-radius: 14px; padding: 18px 20px; background: ${TOKENS.cardFill}; color: ${TOKENS.text}; display: flex; flex-direction: column; gap: 8px; }
.movc-modal-body h4 { margin: 0; font-size: 14px; }
.movc-field { display: flex; flex-direction: column; gap: 4px; font-size: 12px; }
.movc-field textarea, .movc-field input, .movc-field select { width: 100%; box-sizing: border-box; font: inherit; color: inherit; background: ${TOKENS.controlFill}; border: 1px solid ${TOKENS.border}; border-radius: 8px; padding: 6px 8px; }
.movc-field textarea { min-height: 88px; resize: vertical; }
.movc-row { display: flex; gap: 8px; flex-wrap: wrap; }
.movc-row > * { flex: 1 1 120px; }
.movc-check { display: block; font-size: 12px; line-height: 1.6; margin: 4px 0; }
.movc-status { font-size: 12px; color: ${TOKENS.muted}; line-height: 1.6; }
.movc-status[data-error="true"] { color: #c0392b; }
.movc-plan { font-size: 12px; line-height: 1.7; background: ${TOKENS.controlFill}; border-radius: 8px; padding: 10px 12px; }
`;

  function nodeBody(node: any) {
    const data = node?.data || {};
    if (data.assetId) return h(node.type === 'image' ? 'img' : 'video', {
      key: 'media', className: 'movc-media',
      ...(node.type === 'image' ? { src: mediaUrl(data.assetId), alt: data.label || '' } : { src: mediaUrl(data.assetId), controls: true, preload: 'metadata' }),
    });
    if (node.type === 'storyboard' && Array.isArray(data.shots) && data.shots.length) return h('div', { key: 'shots', className: 'movc-body' }, [
      h('ul', { key: 'list', className: 'movc-shots' }, data.shots.slice(0, 12).map((shot: any, index: number) =>
        h('li', { key: index }, `${shot?.index || index + 1}. ${String(shot?.visual || shot?.text || shot?.scene || '').slice(0, 60)}`))),
      data.shots.length > 12 ? h('div', { key: 'more' }, `…共 ${data.shots.length} 个镜头`) : null,
    ]);
    const text = textOf(node);
    return h('div', { key: 'text', className: 'movc-body' }, text ? text.slice(0, 600) : '（暂无内容，可先编辑）');
  }

  function FlowCanvas() {
    const [list, setList] = React.useState([] as any[]);
    const [canvas, setCanvas] = React.useState(null as any);
    const [error, setError] = React.useState('');
    const [notice, setNotice] = React.useState('');
    const [view, setView] = React.useState({ x: 30, y: 24, scale: 1 });
    const [panning, setPanning] = React.useState(false);
    const [positions, setPositions] = React.useState({} as any);
    const [selected, setSelected] = React.useState('');
    const [connectFrom, setConnectFrom] = React.useState('');
    const [nameDraft, setNameDraft] = React.useState('');
    const [dialog, setDialog] = React.useState(null as any);
    const pan = React.useRef(null as any);
    const moving = React.useRef(null as any);
    const timer = React.useRef(null as any);
    const alive = React.useRef(true);
    React.useEffect(() => () => { alive.current = false; if (timer.current) clearInterval(timer.current); }, []);

    const load = React.useCallback(async (projectId?: string) => {
      try {
        setError('');
        const { canvases } = await rpc('list');
        const wanted = projectId || canvases[0]?.projectId;
        setList(canvases);
        if (!wanted) { setCanvas(null); setNameDraft(''); return; }
        const { canvas: doc } = await rpc('get', { projectId: wanted });
        setCanvas(doc); setNameDraft(doc.name || ''); setPositions({}); setSelected('');
      } catch (e: any) { setError(e?.message || '流程画布读取失败'); }
    }, []);
    React.useEffect(() => { void load(); }, [load]);
    const refresh = React.useCallback(async () => { if (canvas?.projectId) await load(canvas.projectId); }, [canvas, load]);

    const saveNode = React.useCallback(async (id: string, patch: any) => {
      if (!canvas) return;
      const current = (canvas.nodes || {})[id] || {};
      const { canvas: saved } = await rpc('nodeSave', { projectId: canvas.projectId, node: { ...current, id, ...patch, data: { ...(current.data || {}), ...(patch.data || {}) } } });
      setCanvas((doc: any) => doc ? { ...doc, nodes: { ...doc.nodes, [saved.node.id]: saved.node } } : doc);
      setPositions((all: any) => { const next = { ...all }; delete next[id]; return next; });
    }, [canvas]);

    const newNode = React.useCallback(async (type: string) => {
      if (!canvas) return;
      const count = Object.keys(canvas.nodes || {}).length;
      const id = `usr_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
      const [w, hh] = NODE_SIZE[type] || [360, 260];
      const data = type === 'video' || type === 'image'
        ? { label: type === 'video' ? '视频节点' : '图片节点', prompt: '', ratio: type === 'image' ? '1:1' : '16:9', resolution: '720p', ...(type === 'video' ? { duration: 5 } : { imageCount: 1 }) }
        : { label: type === 'script' ? '剧本' : '说明', text: '' };
      await saveNode(id, { type, x: 60 + (count % 4) * 420, y: 60 + Math.floor(count / 4) * 360, w, h: hh, data });
      setSelected(id);
      setNotice('已新建节点：先在节点里填写内容，再生成；生成前会单独确认方案与费用。');
    }, [canvas, saveNode]);

    const removeNode = React.useCallback(async (id: string) => {
      if (!canvas) return;
      await rpc('nodeDelete', { projectId: canvas.projectId, nodeId: id });
      setSelected(''); if (connectFrom === id) setConnectFrom('');
      await refresh();
    }, [canvas, connectFrom, refresh]);

    const connectTo = React.useCallback(async (to: string) => {
      if (!canvas || !connectFrom || connectFrom === to) return;
      const from = (canvas.nodes || {})[connectFrom];
      const target = (canvas.nodes || {})[to];
      const media = ['image', 'video'].includes(from?.type) && ['image', 'video'].includes(target?.type);
      const toPort = ['image', 'video'].includes(target?.type) ? (media ? 'ref' : 'prompt') : 'prompt';
      await rpc('edgeAdd', { projectId: canvas.projectId, fromNode: connectFrom, toNode: to, fromPort: 'out', toPort });
      setConnectFrom('');
      await refresh();
    }, [canvas, connectFrom, refresh]);

    const removeEdge = React.useCallback(async (id: string) => {
      if (!canvas) return;
      await rpc('edgeDelete', { projectId: canvas.projectId, edgeId: id });
      await refresh();
    }, [canvas, refresh]);

    const rename = React.useCallback(async () => {
      if (!canvas || !nameDraft.trim()) return;
      await rpc('rename', { projectId: canvas.projectId, name: nameDraft.trim() });
      await refresh();
    }, [canvas, nameDraft, refresh]);

    const stopPolling = React.useCallback(() => { if (timer.current) { clearInterval(timer.current); timer.current = undefined; } }, []);
    const closeDialog = React.useCallback(() => { stopPolling(); setDialog(null); }, [stopPolling]);
    React.useEffect(() => { if (!dialog) stopPolling(); }, [dialog, stopPolling]);

    const patchDialog = React.useCallback((patch: any) => setDialog((current: any) => current ? { ...current, ...patch } : current), []);

    const openDialog = React.useCallback(async (node: any) => {
      if (!canvas) return;
      setError('');
      const data = node.data || {};
      const isMedia = ['image', 'video'].includes(node.type);
      setDialog({ nodeId: node.id, type: node.type, stage: isMedia ? 'form' : 'edit', busy: false,
        form: { text: String(data.output || data.text || ''), prompt: String(data.prompt || ''), ratio: String(data.ratio || (node.type === 'image' ? '1:1' : '16:9')),
          duration: Number(data.duration) || 5, resolution: String(data.resolution || '720p').toLowerCase(), generateAudio: false, transitionDescription: '' },
        confirm: { plan: false, cost: false, textOnly: false }, plan: null, job: null, message: '' });
      if (!isMedia || Array.isArray(data.shots)) return;
      try {
        const { job } = await canvasNativeRpc({ action: 'latest', projectId: canvas.projectId, nodeId: node.id });
        if (job && alive.current) patchDialog({ stage: 'job', job });
      } catch (e: any) { if (alive.current) patchDialog({ message: e?.message || '' }); }
    }, [canvas, patchDialog]);

    const watch = React.useCallback((id: string) => {
      stopPolling();
      const tick = async () => {
        try {
          const { job } = await canvasNativeRpc({ action: 'status', id });
          if (!alive.current) return;
          patchDialog({ job, stage: 'job' });
          if (job.state !== 'running') { stopPolling(); await refresh(); }
        } catch (e: any) { if (alive.current) patchDialog({ message: e?.message || '', busy: false }); }
      };
      timer.current = setInterval(() => { void tick(); }, 3000);
      void tick();
    }, [patchDialog, refresh, stopPolling]);

    const prepare = React.useCallback(async (operation: string) => {
      if (!canvas || !dialog) return;
      patchDialog({ busy: true, message: '', stage: 'plan' });
      try {
        const draft: any = { prompt: dialog.form.prompt, ratio: dialog.form.ratio };
        if (dialog.type === 'video') { draft.duration = Number(dialog.form.duration); draft.resolution = dialog.form.resolution; draft.generateAudio = dialog.form.generateAudio === true; }
        if (operation === 'extend') draft.transitionDescription = dialog.form.transitionDescription;
        const response = await canvasNativeRpc({ action: 'prepare', projectId: canvas.projectId, nodeId: dialog.nodeId, operation, draft });
        if (!alive.current) return;
        if (response.job) patchDialog({ stage: 'job', job: response.job, busy: false });
        else patchDialog({ plan: response.proposal, confirm: { plan: false, cost: false, textOnly: false }, busy: false });
      } catch (e: any) { if (alive.current) patchDialog({ busy: false, message: e?.message || '制作方案未生成。' }); }
    }, [canvas, dialog, patchDialog]);

    const start = React.useCallback(async () => {
      if (!dialog?.plan) return;
      patchDialog({ busy: true, message: '' });
      try {
        const { job } = await canvasNativeRpc({ action: 'start', id: dialog.plan.id,
          confirmPlan: dialog.confirm.plan === true, confirmCost: dialog.confirm.cost === true, textOnly: dialog.confirm.textOnly === true });
        if (!alive.current) return;
        patchDialog({ stage: 'job', job, busy: false });
        watch(job.id);
      } catch (e: any) { if (alive.current) patchDialog({ busy: false, message: e?.message || '制作未提交。' }); }
    }, [dialog, patchDialog, watch]);

    const act = React.useCallback(async (action: string, extra: any = {}) => {
      if (!dialog?.job) return;
      patchDialog({ busy: true, message: '' });
      try {
        const { job } = await canvasNativeRpc({ action, id: dialog.job.id, ...extra });
        if (!alive.current) return;
        patchDialog({ job, busy: false });
        if (['sync', 'review'].includes(action)) await refresh();
      } catch (e: any) { if (alive.current) patchDialog({ busy: false, message: e?.message || '操作未完成。' }); }
    }, [dialog, patchDialog, refresh]);

    const onWheel = (event: any) => {
      event.preventDefault();
      const rect = event.currentTarget.getBoundingClientRect();
      const scale = Math.min(2, Math.max(0.3, view.scale * (event.deltaY > 0 ? 0.92 : 1.08)));
      const ratio = scale / view.scale;
      setView({ scale, x: event.clientX - rect.left - (event.clientX - rect.left - view.x) * ratio, y: event.clientY - rect.top - (event.clientY - rect.top - view.y) * ratio });
    };
    const onPointerDown = (event: any) => {
      if (event.button !== 0) return;
      pan.current = { x: event.clientX, y: event.clientY, ox: view.x, oy: view.y };
      setPanning(true);
      event.currentTarget.setPointerCapture?.(event.pointerId);
    };
    const onPointerMove = (event: any) => {
      if (moving.current) {
        const { id, x, y, ox, oy } = moving.current;
        setPositions((all: any) => ({ ...all, [id]: { x: ox + (event.clientX - x) / view.scale, y: oy + (event.clientY - y) / view.scale } }));
        return;
      }
      if (!pan.current) return;
      setView((current: any) => ({ ...current, x: pan.current.ox + (event.clientX - pan.current.x), y: pan.current.oy + (event.clientY - pan.current.y) }));
    };
    const onPointerUp = () => {
      if (moving.current) {
        const { id } = moving.current;
        const spot = positions[id];
        moving.current = null;
        if (spot) void saveNode(id, { x: spot.x, y: spot.y });
        return;
      }
      pan.current = null; setPanning(false);
    };
    const startMove = (event: any, node: any) => {
      if (event.button !== 0) return;
      event.stopPropagation();
      moving.current = { id: node.id, x: event.clientX, y: event.clientY, ox: node.x, oy: node.y };
      event.currentTarget.setPointerCapture?.(event.pointerId);
    };

    const nodes = canvas ? Object.values(canvas.nodes || {}) : [];
    const edges = canvas?.edges || [];
    const geometry = (node: any) => ({ ...node, ...sizeOf(node), ...(positions[node.id] || {}) });
    const at = (id: string) => geometry((canvas?.nodes || {})[id]);
    const kindOf = (id: string) => (canvas?.nodes || {})[id]?.type;
    const dialogNode = dialog ? (canvas?.nodes || {})[dialog.nodeId] : null;

    const formFields = dialog && ['form', 'plan', 'edit'].includes(dialog.stage) ? h('div', { key: 'fields' }, [
      dialog.stage === 'edit'
        ? h('label', { key: 'text', className: 'movc-field' }, ['节点内容', h('textarea', { value: dialog.form.text, onChange: (e: any) => patchDialog({ form: { ...dialog.form, text: e.target.value } }) })])
        : h('label', { key: 'prompt', className: 'movc-field' }, ['本次要生成的画面 / 续拍内容', h('textarea', { value: dialog.form.prompt, placeholder: '写清主体、动作、镜头与声音；留空会用节点与上游脚本文本。', onChange: (e: any) => patchDialog({ form: { ...dialog.form, prompt: e.target.value } }) })]),
      dialog.type === 'video' && dialog.stage !== 'edit' ? h('div', { key: 'spec', className: 'movc-row' }, [
        h('label', { key: 'ratio', className: 'movc-field' }, ['画幅', h('select', { value: dialog.form.ratio, onChange: (e: any) => patchDialog({ form: { ...dialog.form, ratio: e.target.value } }) }, RATIOS.map(r => h('option', { key: r, value: r }, r)))]),
        h('label', { key: 'duration', className: 'movc-field' }, ['本段时长（秒）', h('input', { type: 'number', min: 4, value: dialog.form.duration, onChange: (e: any) => patchDialog({ form: { ...dialog.form, duration: e.target.value } }) })]),
        h('label', { key: 'resolution', className: 'movc-field' }, ['清晰度', h('select', { value: dialog.form.resolution, onChange: (e: any) => patchDialog({ form: { ...dialog.form, resolution: e.target.value } }) }, RESOLUTIONS.map(r => h('option', { key: r, value: r }, r.toUpperCase())))]),
      ]) : null,
      dialog.type === 'video' && dialog.stage !== 'edit' ? h('label', { key: 'audio', className: 'movc-check' }, [h('input', { type: 'checkbox', checked: dialog.form.generateAudio === true, onChange: (e: any) => patchDialog({ form: { ...dialog.form, generateAudio: e.target.checked } }) }), ' 本次生成音频']) : null,
      dialog.stage === 'plan' && dialog.plan?.operation === 'extend' ? h('label', { key: 'transition', className: 'movc-field' }, ['上一段结尾到本段的衔接描述', h('textarea', { value: dialog.form.transitionDescription, onChange: (e: any) => patchDialog({ form: { ...dialog.form, transitionDescription: e.target.value } }) })]) : null,
    ]) : null;

    const planView = dialog?.stage === 'plan' && dialog.plan ? h('div', { key: 'plan', className: 'movc-plan' }, [
      h('div', { key: 'prompt', style: { whiteSpace: 'pre-wrap', maxHeight: '26vh', overflow: 'auto' } }, dialog.plan.prompt),
      h('div', { key: 'spec' }, `${dialog.plan.model} · ${dialog.plan.ratio}${dialog.plan.duration ? ` · ${dialog.plan.duration}秒 · ${String(dialog.plan.resolution).toUpperCase()} · 音频${dialog.plan.generateAudio ? '开' : '关'}` : ' · 2048×2048'}`),
      h('div', { key: 'refs' }, dialog.plan.references?.length ? `参考素材：${dialog.plan.references.map((r: any) => `${r.port}←${r.nodeId}`).join('、')}` : '无参考素材（纯文本生成）'),
      h('div', { key: 'cost' }, dialog.plan.estimate ? `预估费用：${money(dialog.plan.estimate.cny)}（基础公式估价，实际按渠道账单结算）` : '当前价目未知：确认后按实际调用计费，不编造金额。'),
      ...(dialog.plan.notes || []).map((note: string, index: number) => h('div', { key: `n${index}` }, note)),
    ]) : null;

    const jobView = dialog?.stage === 'job' && dialog.job ? h('div', { key: 'job' }, [
      h('div', { key: 'state', className: 'movc-plan' }, [
        h('div', { key: 's' }, `${dialog.job.operation === 'extend' ? '续拍' : '生成'} · ${phaseText(dialog.job.state)}${dialog.job.taskId ? ` · 任务 ${dialog.job.taskId}` : ''}`),
        h('div', { key: 'r' }, `结果审核：${dialog.job.reviewed ? '已通过' : '未通过'}；回填：${dialog.job.sync?.status || (dialog.job.media?.length ? '待回填' : '无成果')}`),
        dialog.job.message ? h('div', { key: 'm' }, dialog.job.message) : null,
      ]),
      ...(dialog.job.media || []).map((media: any, index: number) => h(media.kind === 'image' ? 'img' : 'video', {
        key: `m${index}`, src: media.url, alt: media.label || '', controls: media.kind === 'video', preload: 'metadata', className: 'movc-media', style: { maxHeight: '38vh' },
      })),
      h('div', { key: 'ops', className: 'movc-row' }, [
        dialog.job.media?.length && !dialog.job.reviewed ? h('button', { key: 'ok', type: 'button', className: 'mov-btn', disabled: dialog.busy, onClick: () => void act('review', { accept: true }) }, '确认结果并继续') : null,
        dialog.job.media?.length && !dialog.job.reviewed ? h('button', { key: 'no', type: 'button', className: 'mov-btn', disabled: dialog.busy, onClick: () => void closeDialog() }, '不通过（保留成果）') : null,
        dialog.job.sync?.status !== 'synced' && dialog.job.media?.length ? h('button', { key: 'sync', type: 'button', className: 'mov-btn', disabled: dialog.busy, onClick: () => void act('sync') }, '补回填画布') : null,
        ['unknown', 'interrupted', 'submission_unknown'].includes(dialog.job.state) ? h('button', { key: 'query', type: 'button', className: 'mov-btn', disabled: dialog.busy, onClick: () => void act('query') }, '查询原任务') : null,
        dialog.type === 'video' && dialog.job.reviewed && dialog.job.media?.length ? h('button', { key: 'extend', type: 'button', className: 'mov-btn', disabled: dialog.busy, onClick: () => patchDialog({ stage: 'form', plan: null }) }, '续拍下一段') : null,
        dialog.job.state !== 'running' ? h('button', { key: 'again', type: 'button', className: 'mov-btn', disabled: dialog.busy, onClick: () => patchDialog({ stage: 'form', job: null, plan: null }) }, '重新生成（重新确认费用）') : null,
      ]),
    ]) : null;

    return h('section', { className: 'mov-section movc' }, [
      h('style', { key: 'css' }, CSS),
      h('div', { key: 'title', className: 'mov-section-title' }, '流程画布'),
      list.length ? h('div', { key: 'list', className: 'movc-list' }, list.map(item =>
        h('button', { key: item.projectId, type: 'button', className: 'movc-chip', 'data-active': String(canvas?.projectId === item.projectId), onClick: () => void load(item.projectId) },
          `${item.name} · ${item.nodeCount} 节点`))) : null,
      !list.length ? h('p', { key: 'empty', className: 'movc-hint' }, error || '还没有流程画布：确认创作需求后会在这里自动建立，脚本审核后同步分镜与制作段计划，生成成果自动回填。') : null,
      error && list.length ? h('p', { key: 'error', className: 'movc-hint' }, error) : null,
      canvas ? h('div', { key: 'stage', className: 'movc-stage', 'data-panning': String(panning), 'data-connect': String(Boolean(connectFrom)),
        onClick: () => { if (connectFrom) setConnectFrom(''); },
        onWheel, onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp },
        h('div', { key: 'world', className: 'movc-world', style: { transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})` } }, [
          h('svg', { key: 'edges', style: { position: 'absolute', left: -4000, top: -4000, width: 8000, height: 8000, overflow: 'visible' } },
            h('g', { transform: 'translate(4000 4000)' }, edges.map((edge: any) => {
              const from = at(edge.fromNode), to = at(edge.toNode);
              if (!from || !to) return null;
              const x1 = from.x + from.w, y1 = from.y + from.h / 2, x2 = to.x, y2 = to.y + to.h / 2;
              const bend = Math.max(40, Math.abs(x2 - x1) / 2);
              const path = `M ${x1} ${y1} C ${x1 + bend} ${y1}, ${x2 - bend} ${y2}, ${x2} ${y2}`;
              return h('g', { key: edge.id || `${edge.fromNode}-${edge.toNode}` }, [
                h('path', { key: 'line', className: 'movc-edge', d: path }),
                h('path', { key: 'hit', className: 'movc-edge-hit', d: path, onClick: (e: any) => { e.stopPropagation(); void removeEdge(edge.id); } },
                  h('title', { key: 'title' }, '点击断开这条连线')),
              ]);
            }))),
          ...nodes.map(raw => {
            const node: any = geometry(raw);
            const media = ['image', 'video'].includes(node.type);
            return h('div', { key: node.id, className: 'movc-node', 'data-selected': String(selected === node.id), style: { left: node.x, top: node.y, width: node.w, height: node.h },
              onPointerDown: (e: any) => startMove(e, node), onClick: (e: any) => { e.stopPropagation(); if (connectFrom && connectFrom !== node.id) void connectTo(node.id); else setSelected(node.id); } }, [
              h('div', { key: 'head', className: 'movc-node-head' }, [
                h('span', { key: 'label', className: 'movc-node-title' }, labelOf(node)),
                h('span', { key: 'status', className: 'movc-badge' }, node.data?.status === 'done' ? '已完成' : '待制作'),
                h('span', { key: 'actions', className: 'movc-actions' }, [
                  h('button', { key: 'edit', type: 'button', className: 'movc-mini', onPointerDown: (e: any) => e.stopPropagation(), onClick: (e: any) => { e.stopPropagation(); void openDialog(node); } }, media ? '制作' : '编辑'),
                  h('button', { key: 'link', type: 'button', className: 'movc-mini', onPointerDown: (e: any) => e.stopPropagation(), onClick: (e: any) => { e.stopPropagation(); setConnectFrom(connectFrom === node.id ? '' : node.id); setSelected(node.id); } }, connectFrom === node.id ? '取消连线' : '连线'),
                  h('button', { key: 'del', type: 'button', className: 'movc-mini', onPointerDown: (e: any) => e.stopPropagation(), onClick: (e: any) => { e.stopPropagation(); void removeNode(node.id); } }, '删除'),
                ]),
              ]),
              nodeBody(node),
            ]);
          }),
        ])) : null,
      canvas ? h('div', { key: 'meta', className: 'movc-bar' }, [
        h('input', { key: 'name', value: nameDraft, onChange: (e: any) => setNameDraft(e.target.value), style: { flex: '1 1 160px' }, 'aria-label': '画布名称' }),
        h('button', { key: 'rename', type: 'button', className: 'mov-btn', onClick: () => void rename() }, '重命名'),
        h('button', { key: 'text', type: 'button', className: 'mov-btn', onClick: () => void newNode('text') }, '+ 文本'),
        h('button', { key: 'image', type: 'button', className: 'mov-btn', onClick: () => void newNode('image') }, '+ 图片'),
        h('button', { key: 'video', type: 'button', className: 'mov-btn', onClick: () => void newNode('video') }, '+ 视频'),
        h('button', { key: 'refresh', type: 'button', className: 'mov-btn', onClick: () => void refresh() }, '刷新'),
        h('button', { key: 'reset', type: 'button', className: 'mov-btn', onClick: () => setView({ x: 30, y: 24, scale: 1 }) }, '重置视图'),
      ]) : null,
      canvas ? h('p', { key: 'hint', className: 'movc-hint' }, `拖动空白处平移、滚轮缩放；拖动节点移动，点「连线」后再点目标节点连接（点连线可断开）。数据目录：${canvas.dataRoot}（素材与成果由本插件保存）`) : null,
      connectFrom ? h('p', { key: 'connect', className: 'movc-hint' }, '连线模式：点击目标节点完成连接，点空白处取消。') : null,
      notice ? h('p', { key: 'notice', className: 'movc-hint' }, notice) : null,
      dialog ? h('div', { key: 'modal', className: 'movc-modal', onPointerDown: (e: any) => e.stopPropagation(), onClick: (e: any) => { if (e.target === e.currentTarget) closeDialog(); } },
        h('div', { key: 'body', className: 'movc-modal-body' }, [
          h('h4', { key: 'h' }, dialogNode ? `${labelOf(dialogNode)} · ${dialog.stage === 'job' ? '制作记录与结果审核' : dialog.type === 'video' || dialog.type === 'image' ? '制作与费用确认' : '编辑节点内容'}` : '流程画布'),
          formFields,
          planView,
          jobView,
          dialog.message ? h('p', { key: 'msg', className: 'movc-status', 'data-error': 'true' }, dialog.message) : null,
          h('p', { key: 'note', className: 'movc-status' }, '生成前必须分别确认制作方案与费用；确认后才会调用模型。成果回填只新增成果节点，不代表结果已审核。'),
          h('div', { key: 'ops', className: 'movc-bar' }, [
            dialog.stage === 'edit' ? h('button', { key: 'save', type: 'button', className: 'mov-btn', disabled: dialog.busy, onClick: async () => { patchDialog({ busy: true, message: '' }); try { await saveNode(dialog.nodeId, { data: { text: dialog.form.text } }); closeDialog(); } catch (e: any) { patchDialog({ busy: false, message: e?.message || '保存失败' }); } } }, '保存内容') : null,
            dialog.stage === 'form' ? h('button', { key: 'gen', type: 'button', className: 'mov-btn mov-btn-primary', disabled: dialog.busy, onClick: () => void prepare('generate') }, '生成并确认费用') : null,
            dialog.job?.reviewed && dialog.stage === 'job' ? h('button', { key: 'extend-form', type: 'button', className: 'mov-btn', disabled: dialog.busy, onClick: () => patchDialog({ stage: 'form', plan: null }) }, '续拍下一段') : null,
            dialog.stage === 'form' && dialog.job?.reviewed ? h('button', { key: 'extend', type: 'button', className: 'mov-btn mov-btn-primary', disabled: dialog.busy, onClick: () => void prepare('extend') }, '确认续拍与费用') : null,
            dialog.stage === 'plan' ? h('button', { key: 'confirm', type: 'button', className: 'mov-btn mov-btn-primary', disabled: dialog.busy || !(dialog.confirm.plan && dialog.confirm.cost), onClick: () => void start() }, '确认并开始') : null,
            dialog.stage === 'plan' ? h('button', { key: 'back', type: 'button', className: 'mov-btn', disabled: dialog.busy, onClick: () => patchDialog({ stage: 'form', plan: null }) }, '返回修改') : null,
            h('button', { key: 'close', type: 'button', className: 'mov-btn', onClick: () => closeDialog() }, '关闭'),
          ]),
          dialog.stage === 'plan' ? h('div', { key: 'confirms' }, [
            h('label', { key: 'p', className: 'movc-check' }, [h('input', { type: 'checkbox', checked: dialog.confirm.plan === true, onChange: (e: any) => patchDialog({ confirm: { ...dialog.confirm, plan: e.target.checked } }) }), ' 我已核对本次制作方案（节点内容、画幅、时长与清晰度）']),
            h('label', { key: 'c', className: 'movc-check' }, [h('input', { type: 'checkbox', checked: dialog.confirm.cost === true, onChange: (e: any) => patchDialog({ confirm: { ...dialog.confirm, cost: e.target.checked } }) }), ' 我已确认费用，按渠道账单结算']),
            dialog.plan?.kind === 'video' && dialog.plan?.operation === 'generate' && !(dialog.plan?.references || []).length
              ? h('label', { key: 't', className: 'movc-check' }, [h('input', { type: 'checkbox', checked: dialog.confirm.textOnly === true, onChange: (e: any) => patchDialog({ confirm: { ...dialog.confirm, textOnly: e.target.checked } }) }), ' 本次没有参考素材，确认按纯文生视频提交'])
              : null,
          ]) : null,
        ])) : null,
    ]);
  }
  return { FlowCanvas };
}
