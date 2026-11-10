/** 插件自带流程画布视图：读内置画布文档，按节点与连线渲染；不依赖原版无限画布。 */
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

  const CSS = `
.movc { display: flex; flex-direction: column; gap: 10px; }
.movc-bar { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.movc-list { display: flex; flex-wrap: wrap; gap: 6px; }
.movc-chip { border: 1px solid ${TOKENS.border}; background: ${TOKENS.cardFill}; color: ${TOKENS.text}; border-radius: 999px; padding: 4px 10px; font-size: 12px; cursor: pointer; }
.movc-chip[data-active="true"] { border-color: ${TOKENS.primaryFill}; color: ${TOKENS.primaryFill}; }
.movc-hint { font-size: 12px; color: ${TOKENS.muted}; line-height: 1.6; }
.movc-stage { position: relative; height: 460px; border: 1px solid ${TOKENS.border}; border-radius: 12px; background: ${TOKENS.controlFill}; overflow: hidden; cursor: grab; touch-action: none; }
.movc-stage[data-panning="true"] { cursor: grabbing; }
.movc-world { position: absolute; inset: 0; transform-origin: 0 0; }
.movc-edge { stroke: ${TOKENS.primaryFill}; stroke-width: 2; fill: none; opacity: .75; }
.movc-node { position: absolute; display: flex; flex-direction: column; gap: 6px; padding: 10px 12px; border: 1px solid ${TOKENS.border}; border-radius: 10px; background: ${TOKENS.cardFill}; box-shadow: 0 1px 4px #0000000f; overflow: hidden; }
.movc-node-head { display: flex; align-items: center; gap: 6px; }
.movc-node-title { font-size: 12px; font-weight: 600; color: ${TOKENS.text}; }
.movc-badge { margin-left: auto; font-size: 11px; color: ${TOKENS.muted}; }
.movc-body { font-size: 11px; line-height: 1.6; color: ${TOKENS.muted}; white-space: pre-wrap; overflow: auto; flex: 1; }
.movc-media { width: 100%; height: 100%; object-fit: contain; border-radius: 6px; background: #0001; }
.movc-shots { margin: 0; padding-left: 16px; }
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
    return h('div', { key: 'text', className: 'movc-body' }, text ? text.slice(0, 600) : '（暂无内容）');
  }
  function FlowCanvas() {
    const [list, setList] = React.useState([] as any[]);
    const [canvas, setCanvas] = React.useState(null as any);
    const [error, setError] = React.useState('');
    const [view, setView] = React.useState({ x: 30, y: 24, scale: 1 });
    const [panning, setPanning] = React.useState(false);
    const drag = React.useRef(null as any);
    const open = React.useCallback(async (projectId?: string) => {
      try {
        setError('');
        const { canvases } = await rpc('list');
        const wanted = projectId || canvases[0]?.projectId;
        setList(canvases);
        if (!wanted) { setCanvas(null); return; }
        const { canvas: doc } = await rpc('get', { projectId: wanted });
        setCanvas(doc);
      } catch (e: any) { setError(e?.message || '流程画布读取失败'); }
    }, []);
    React.useEffect(() => { void open(); }, [open]);
    const onWheel = (event: any) => {
      event.preventDefault();
      const rect = event.currentTarget.getBoundingClientRect();
      const scale = Math.min(2, Math.max(0.3, view.scale * (event.deltaY > 0 ? 0.92 : 1.08)));
      const ratio = scale / view.scale;
      setView({ scale, x: event.clientX - rect.left - (event.clientX - rect.left - view.x) * ratio, y: event.clientY - rect.top - (event.clientY - rect.top - view.y) * ratio });
    };
    const onPointerDown = (event: any) => {
      if (event.button !== 0) return;
      drag.current = { x: event.clientX, y: event.clientY, ox: view.x, oy: view.y };
      setPanning(true);
      event.currentTarget.setPointerCapture?.(event.pointerId);
    };
    const onPointerMove = (event: any) => {
      if (!drag.current) return;
      setView(current => ({ ...current, x: drag.current.ox + (event.clientX - drag.current.x), y: drag.current.oy + (event.clientY - drag.current.y) }));
    };
    const onPointerUp = () => { drag.current = null; setPanning(false); };
    const nodes = canvas ? Object.values(canvas.nodes || {}) : [];
    const edges = canvas?.edges || [];
    const geometry = (node: any) => ({ ...node, ...sizeOf(node) });
    const at = (id: string) => geometry((canvas?.nodes || {})[id]);
    return h('section', { className: 'mov-section movc' }, [
      h('style', { key: 'css' }, CSS),
      h('div', { key: 'title', className: 'mov-section-title' }, '流程画布'),
      list.length ? h('div', { key: 'list', className: 'movc-list' }, list.map(item =>
        h('button', { key: item.projectId, type: 'button', className: 'movc-chip', 'data-active': String(canvas?.projectId === item.projectId), onClick: () => void open(item.projectId) },
          `${item.name} · ${item.nodeCount} 节点`))) : null,
      !list.length ? h('p', { key: 'empty', className: 'movc-hint' }, error || '还没有流程画布：确认创作需求后会在这里自动建立，脚本审核后同步分镜与制作段计划，生成成果自动回填。') : null,
      error && list.length ? h('p', { key: 'error', className: 'movc-hint' }, error) : null,
      canvas ? h('div', { key: 'stage', className: 'movc-stage', 'data-panning': String(panning), onWheel, onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp },
        h('div', { key: 'world', className: 'movc-world', style: { transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})` } }, [
          h('svg', { key: 'edges', style: { position: 'absolute', left: -4000, top: -4000, width: 8000, height: 8000, overflow: 'visible', pointerEvents: 'none' } },
            h('g', { transform: 'translate(4000 4000)' }, edges.map((edge: any) => {
              const from = at(edge.fromNode), to = at(edge.toNode);
              if (!from || !to) return null;
              const x1 = from.x + from.w, y1 = from.y + from.h / 2, x2 = to.x, y2 = to.y + to.h / 2;
              const bend = Math.max(40, Math.abs(x2 - x1) / 2);
              return h('path', { key: edge.id || `${edge.fromNode}-${edge.toNode}`, className: 'movc-edge', d: `M ${x1} ${y1} C ${x1 + bend} ${y1}, ${x2 - bend} ${y2}, ${x2} ${y2}` });
            }))),
          ...nodes.map(raw => {
            const node: any = geometry(raw);
            return h('div', { key: node.id, className: 'movc-node', style: { left: node.x, top: node.y, width: node.w, height: node.h } }, [
              h('div', { key: 'head', className: 'movc-node-head' }, [
                h('span', { key: 'label', className: 'movc-node-title' }, labelOf(node)),
                h('span', { key: 'status', className: 'movc-badge' }, node.data?.status === 'done' ? '已完成' : '待制作'),
              ]),
              nodeBody(node),
            ]);
          }),
        ])) : null,
      canvas ? h('p', { key: 'meta', className: 'movc-hint' }, `数据目录：${canvas.dataRoot}（素材与成果由本插件保存，不使用原版画布数据根）`) : null,
      h('div', { key: 'actions', className: 'movc-bar' }, [
        h('button', { key: 'refresh', type: 'button', className: 'mov-btn', onClick: () => void open(canvas?.projectId) }, '刷新'),
        h('button', { key: 'reset', type: 'button', className: 'mov-btn', onClick: () => setView({ x: 30, y: 24, scale: 1 }) }, '重置视图'),
      ]),
    ]);
  }
  return { FlowCanvas };
}
