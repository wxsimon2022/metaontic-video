/** 插件自带的流程画布组件：读取插件自己的画布文档，在面板内渲染、编辑、连线，
 *  并在图片/视频节点内完成「生成 → 费用确认 → 结果审核 → 续拍」，不依赖任何第三方画布插件。 */
import { FRAME_MARK, MATERIAL_MARK, STAGE_LABELS, STAGE_STATE_TEXT, canvasReadiness, canvasSegmentStats, canvasSegments, flowAuthors, pendingStageAction, requirementNodeData, requirementNodeOf, rewriteStageNodes, sealedStageData, stageAction, stageNodeId, stagePrefixOf, stageSpot, stageSummary } from '../integrations/canvas-stages.js';

/** 文本模型写脚本是画布上最慢的一次等待（实测 40–70 秒）：默认 20 秒的 RPC 超时会把它掐掉，
 *  这里单独放宽，配合弹窗里的等待计数让用户知道还在写而不是卡住。 */
export const TEXT_WRITE_TIMEOUT_MS = 180000;

/** 画布内制作服务：与内置画布同一个插件、同一份配置，费用确认沿用插件设置里的API密钥。 */
export async function canvasNativeRpc(args: any, fetcher: any = fetch, timeoutMs = 20000) {
  const response = await fetcher('/metaontic-video/canvas-native', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(args), signal: AbortSignal.timeout(timeoutMs) });
  let body;
  try { body = await response.json(); } catch { throw new Error('画布制作服务尚未就绪，请核对插件加载状态。'); }
  if (!response.ok || body?.error) throw new Error(body?.error || '制作请求未完成，请查询原记录，不要重复生成。');
  return body;
}

/** 复制节点时只带走可编辑内容：成果素材、原任务标识与来源关系不复制，
 *  否则复制出来的节点会被当成已有成果，续拍与审核都会指向别人的结果。 */
export function duplicateNodePayload(node: any, spot: any) {
  const data: any = {};
  for (const key of ['label', 'prompt', 'text', 'output', 'script', 'requirement', 'ratio', 'resolution', 'duration']) {
    if (node?.data?.[key] !== undefined) data[key] = node.data[key];
  }
  // 素材节点复制出来还是素材：不带这个标记的话，「复制一张参考图」会变成一个新的制作段，
  // 把制作段计数和「合成成片」的就绪判断一起带偏。
  if (node?.data?.[MATERIAL_MARK]) {
    data[MATERIAL_MARK] = true;
    if (node.data.metaonticSegmentOf) data.metaonticSegmentOf = node.data.metaonticSegmentOf;
  }
  return { type: node?.type || 'text', x: Number(spot?.x || 0) + 40, y: Number(spot?.y || 0) + 40, w: spot?.w, h: spot?.h, data };
}

/** 画布上已经有成果的源节点：成果节点用 metaonticSourceNode 指回它生成的那个节点。 */
export function producedNodeIds(canvas: any) {
  return new Set<unknown>(Object.values(canvas?.nodes || {}).map((node: any) => node?.metaonticSourceNode).filter(Boolean));
}

/** 流程执行顺序：图片/视频节点按连线从上游排到下游，成果节点不参与排队。
 *  节点「是否已产出」看画布上有没有它生成的成果节点（metaonticSourceNode 指回本节点）。 */
export function flowSteps(canvas: any) {
  const nodes: any[] = Object.values(canvas?.nodes || {});
  const edges: any[] = Array.isArray(canvas?.edges) ? canvas.edges : [];
  const produced = producedNodeIds(canvas);
  // 走流程的节点口径与阶段投影一致：素材节点（参考图）与导入素材不参与「制作「…」」的推进顺序，
  // 自动铺出的画面节点要跟着走（先出画面再出视频）。
  const author = flowAuthors(canvas);
  const byId = new Map(author.map(node => [node.id, node]));
  const inbound = new Map(author.map(node => [node.id, [] as string[]]));
  for (const edge of edges) {
    if (edge?.metaonticResult) continue;
    if (byId.has(edge?.toNode) && byId.has(edge?.fromNode)) inbound.get(edge.toNode)!.push(edge.fromNode);
  }
  const ordered: any[] = [], seen = new Set();
  const visit = (node: any) => {
    if (!node || seen.has(node.id)) return;
    seen.add(node.id);
    for (const up of inbound.get(node.id) || []) visit(byId.get(up));
    ordered.push(node);
  };
  for (const node of author) visit(node);
  return ordered.map(node => ({ id: node.id, type: node.type, label: String(node?.data?.label || (node.type === 'image' ? '图片' : '视频')), done: produced.has(node.id) }));
}

/** 成片可合成性：视频制作节点按连线顺序每个都要有成果视频，缺哪段单独列出来。
 *  与界面「合成成片」按钮和服务端的合并规则同一套判断。 */
export function filmStatus(canvas: any) {
  const nodes: any[] = Object.values(canvas?.nodes || {});
  const order = flowSteps(canvas).filter(step => step.type === 'video');
  const missing = order.filter(step => !nodes.some(node => node?.metaonticSourceNode === step.id && node?.type === 'video'
    && (node?.data?.assetId || node?.data?.metaonticVideoUrl)));
  return { total: order.length, readyCount: order.length - missing.length, missing: missing.map(step => step.label) };
}

/** 节点默认尺寸：新建节点、复制节点与自动排版都用同一份，避免各处写死不一样。 */
export const NODE_SIZE: any = { script: [420, 320], storyboard: [460, 340], text: [360, 200], video: [360, 300], image: [360, 300] };
export function nodeSize(node: any) {
  const fallback = NODE_SIZE[node?.type] || [360, 260];
  return { w: Number(node?.w) || fallback[0], h: Number(node?.h) || fallback[1] };
}

/** 一键美化布局：按连线从左到右分层、同层按上下游重心排序、整列竖直居中，再对齐到 10px 网格。
 *  只算坐标，不改内容与连线；是否落库由界面决定。 */
export function tidyLayout(canvas: any) {
  // 流程阶段卡固定排在主链路上方，不参与按连线的分层排版，免得被排进第一列。
  const nodes: any[] = Object.values(canvas?.nodes || {}).filter((node: any) => !node?.data?.metaonticStage);
  const positions: any = {};
  if (!nodes.length) return { positions, moved: 0, width: 0, height: 0 };
  const GAP_X = 140, GAP_Y = 56, MARGIN = 60, GRID = 10;
  const ids = new Set(nodes.map(node => node.id));
  const links = (Array.isArray(canvas?.edges) ? canvas.edges : [])
    .filter((edge: any) => ids.has(edge?.fromNode) && ids.has(edge?.toNode) && edge.fromNode !== edge.toNode);
  const inbound = new Map<string, string[]>(nodes.map(node => [node.id, []]));
  const outbound = new Map<string, string[]>(nodes.map(node => [node.id, []]));
  for (const edge of links) { inbound.get(edge.toNode)!.push(edge.fromNode); outbound.get(edge.fromNode)!.push(edge.toNode); }
  // 分层：按入度归零逐层推平（最长路径）；互相连线（环）按原顺序就地断开一层，保证排版不会卡死。
  const layer = new Map<string, number>(nodes.map(node => [node.id, 0]));
  const indegree = new Map<string, number>(nodes.map(node => [node.id, (inbound.get(node.id) || []).length]));
  const queue: string[] = nodes.filter(node => (indegree.get(node.id) || 0) === 0).map(node => node.id);
  const settled = new Set<string>();
  const settle = (id: string) => {
    if (settled.has(id)) return;
    settled.add(id);
    for (const down of outbound.get(id) || []) {
      if (settled.has(down)) continue; // 回边（环）不再回推，避免层级被越推越高
      layer.set(down, Math.max(layer.get(down) || 0, (layer.get(id) || 0) + 1));
      indegree.set(down, (indegree.get(down) || 0) - 1);
      if ((indegree.get(down) || 0) <= 0) queue.push(down);
    }
  };
  const drain = () => { while (queue.length) settle(queue.shift()!); };
  drain();
  for (const node of nodes) { if (!settled.has(node.id)) { settle(node.id); drain(); } }
  const ranks = [...new Set(nodes.map(node => layer.get(node.id) || 0))].sort((a, b) => a - b);
  const columnOf = new Map(ranks.map((rank, index) => [rank, index]));
  const columns: any[][] = ranks.map(() => []);
  for (const node of nodes) columns[columnOf.get(layer.get(node.id) || 0)!].push(node);
  const widthOfColumn = columns.map(column => Math.max(...column.map(node => nodeSize(node).w)));
  const lefts: number[] = [];
  let cursor = MARGIN;
  for (const width of widthOfColumn) { lefts.push(cursor); cursor += width + GAP_X; }
  const width = cursor - GAP_X + MARGIN;
  // 排一版：每列从顶部堆叠；重心用于同层排序（父/子节点的纵向中心）。
  const stack = (order: any[][]) => {
    const tops = new Map<string, number>();
    let height = 0;
    for (const column of order) {
      let y = MARGIN;
      for (const node of column) { tops.set(node.id, y); y += nodeSize(node).h + GAP_Y; }
      height = Math.max(height, y - GAP_Y + MARGIN);
    }
    const centers = new Map<string, number>();
    for (const column of order) for (const node of column) centers.set(node.id, (tops.get(node.id) || 0) + nodeSize(node).h / 2);
    return { tops, centers, height };
  };
  const barycenter = (node: any, centers: Map<string, number>) => {
    const around = [...(inbound.get(node.id) || []), ...(outbound.get(node.id) || [])]
      .map(id => centers.get(id)).filter((value): value is number => typeof value === 'number');
    return around.length ? around.reduce((sum, value) => sum + value, 0) / around.length : Number.POSITIVE_INFINITY;
  };
  let order = columns;
  let draft = stack(order);
  for (let round = 0; round < 3; round += 1) {
    order = order.map(column => [...column].sort((a, b) => barycenter(a, draft.centers) - barycenter(b, draft.centers) || String(a.id).localeCompare(String(b.id))));
    draft = stack(order);
  }
  const snap = (value: number) => Math.round(value / GRID) * GRID;
  let moved = 0;
  order.forEach((column, index) => {
    const columnHeight = column.reduce((sum, node) => sum + nodeSize(node).h + GAP_Y, -GAP_Y);
    const offset = snap((draft.height - columnHeight) / 2);
    for (const node of column) {
      const x = snap(lefts[index]);
      const y = snap((draft.tops.get(node.id) || 0) + offset);
      positions[node.id] = { x, y };
      if (Math.round(Number(node.x) || 0) !== x || Math.round(Number(node.y) || 0) !== y) moved += 1;
    }
  });
  return { positions, moved, width, height: draft.height };
}

export function createCanvasView({ React, h, TOKENS, PAGE_CSS = '' }: any) {
  // PAGE_CSS 带上按钮/输入框这套控件外观：画布页可能单独打开，不能指望别的插件页面已经把样式挂上。
  // 流程画布只作为插件自己的独立页面渲染，空间大，工具条与画布区按整页尺寸排布。
  const ROOT_CLASS = 'mov-section movc';
  const rpc = async (method: string, args: any = {}) => {
    const response = await fetch('/metaontic-video/canvas', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ method, args }) });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || body?.error) throw new Error(body?.error || '流程画布服务尚未就绪，请核对插件加载状态。');
    return body;
  };
  const mediaUrl = (assetId: string) => `/metaontic-video/canvas-media?assetId=${encodeURIComponent(assetId)}`;
  const sizeOf = (node: any) => nodeSize(node);
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
.movc { display: flex; flex-direction: column; gap: 14px; }
.movc-bar { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.movc-top { display: flex; flex-direction: column; align-items: stretch; gap: 10px; margin-bottom: 4px; padding: 12px 14px; border: 1px solid ${TOKENS.border}; border-radius: 12px; background: ${TOKENS.cardFill}; }
.movc-list { display: flex; flex-wrap: nowrap; gap: 6px; overflow-x: auto; overflow-y: hidden; padding-bottom: 2px; }
.movc-pick { flex: 0 0 auto; font-size: 12px; color: ${TOKENS.muted}; }
.movc-name-empty { font-size: 13px; font-weight: 600; color: ${TOKENS.muted}; }
/* 画布内按钮统一成一套：描边 + 主色悬停，不吃宿主默认的灰底；主按钮才用实心主色。 */
.movc .mov-btn, .movc-modal .mov-btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; box-sizing: border-box; border: 1px solid ${TOKENS.border}; border-radius: 8px; background: transparent; color: ${TOKENS.text}; font: inherit; font-size: 12px; line-height: 1.2; cursor: pointer; white-space: nowrap; transition: background .15s, border-color .15s, color .15s, opacity .15s; }
.movc .mov-btn:hover:not(:disabled), .movc-modal .mov-btn:hover:not(:disabled) { border-color: ${TOKENS.primaryFill}; background: transparent; color: ${TOKENS.primaryFill}; }
.movc .mov-btn:disabled, .movc-modal .mov-btn:disabled { opacity: .5; cursor: default; }
.movc .mov-btn-primary, .movc-modal .mov-btn-primary { border-color: ${TOKENS.primaryFill}; background: ${TOKENS.primaryFill}; color: #fff; font-weight: 600; }
.movc .mov-btn-primary:hover:not(:disabled), .movc-modal .mov-btn-primary:hover:not(:disabled) { background: ${TOKENS.primaryFill}; color: #fff; opacity: .88; }
.movc .movc-danger:hover:not(:disabled), .movc-modal .movc-danger:hover:not(:disabled) { border-color: ${TOKENS.error}; color: ${TOKENS.error}; }
/* 工具条按钮：只把固定 120px 宽改成按内容排布，高度与内距和选择画布胶囊对齐。 */
.movc-ops { flex: 1 1 auto; min-width: 0; gap: 6px; row-gap: 8px; container-type: inline-size; }
.movc-ops .mov-btn { flex: 0 0 auto; width: auto; min-width: 0; height: 32px; min-height: 32px; padding: 0 14px; overflow-wrap: normal; }
.movc-flow { flex: 0 0 auto; font-size: 12px; color: ${TOKENS.muted}; white-space: nowrap; }
/* 流程主行动：用主色描边突出，但不和「新建画布…」的实心主按钮抢注意力。 */
.movc-ops .movc-run { border-color: ${TOKENS.primaryFill}; color: ${TOKENS.primaryFill}; }
.movc-ops .movc-run:disabled { border-color: ${TOKENS.border}; color: ${TOKENS.text}; }
.movc-sep { flex: 0 0 auto; width: 1px; height: 18px; margin: 0 2px; background: ${TOKENS.border}; }
/* 面板窄的时候按钮本来就会换行，分组竖线会落在行首，直接不收。 */
@container (max-width: 460px) { .movc-sep { display: none; } }
.movc-ops .mov-btn:focus-visible, .movc-chip:focus-visible, .movc-mini:focus-visible, .movc-name-text:focus-visible { outline: 2px solid ${TOKENS.primaryFill}; outline-offset: 1px; }
.movc-ops .mov-btn:active:not(:disabled), .movc-chip:active, .movc-mini:active { opacity: .82; }
.movc-chip { display: inline-flex; align-items: center; box-sizing: border-box; height: 32px; padding: 0 14px; border: 1px solid ${TOKENS.border}; border-radius: 8px; background: transparent; color: ${TOKENS.text}; font: inherit; font-size: 12px; white-space: nowrap; cursor: pointer; transition: background .15s, border-color .15s, color .15s; }
.movc-chip:hover { border-color: ${TOKENS.primaryFill}; background: transparent; color: ${TOKENS.primaryFill}; }
.movc-chip[data-active="true"] { border-color: ${TOKENS.primaryFill}; background: ${TOKENS.primaryFill}; color: #fff; font-weight: 600; }
.movc-hint { font-size: 12px; color: ${TOKENS.muted}; line-height: 1.6; }
.movc-stage { position: relative; height: clamp(520px, calc(100vh - 320px), 1400px); border: 1px solid ${TOKENS.border}; border-radius: 12px; background-color: ${TOKENS.controlFill}; background-image: radial-gradient(${TOKENS.border} 1px, transparent 1px); background-size: 22px 22px; overflow: hidden; cursor: grab; touch-action: none; }
.movc-stage[data-panning="true"] { cursor: grabbing; }
.movc-stage[data-connect="true"] { cursor: crosshair; }
.movc-world { position: absolute; inset: 0; transform-origin: 0 0; }
.movc-edge { stroke: ${TOKENS.primaryFill}; stroke-width: 2; fill: none; opacity: .75; }
.movc-edge-hit { stroke: transparent; stroke-width: 14; fill: none; cursor: pointer; }
.movc-node { position: absolute; display: flex; flex-direction: column; gap: 6px; padding: 10px 12px; border: 1px solid ${TOKENS.border}; border-radius: 10px; background: ${TOKENS.cardFill}; box-shadow: 0 1px 4px #0000000f; overflow: hidden; cursor: grab; }
.movc-node:hover { box-shadow: 0 3px 12px #0000001f; }
.movc-node[data-selected="true"] { border-color: ${TOKENS.primaryFill}; box-shadow: 0 0 0 1px ${TOKENS.primaryFill}, 0 3px 12px #0000001f; }
.movc-node[data-current="true"]:not([data-selected="true"]) { outline: 2px dashed ${TOKENS.primaryFill}; outline-offset: 2px; }
.movc-node[data-stage-state="active"] { border-color: ${TOKENS.primaryFill}; }
.movc-node[data-stage-state="active"] .movc-node-title { color: ${TOKENS.primaryFill}; }
.movc-stage-edge { stroke: ${TOKENS.primaryFill}; stroke-width: 1.6; stroke-dasharray: 6 5; fill: none; opacity: .7; }
.movc-stage-arrowhead { fill: ${TOKENS.primaryFill}; opacity: .75; }
.movc-stage-text { font-size: 12px; line-height: 1.7; white-space: pre-wrap; }
.movc-node[data-stage-state] .movc-body { display: flex; flex-direction: column; gap: 8px; }
.movc-stage-action { margin-top: auto; align-self: flex-start; display: inline-flex; align-items: center; height: 28px; padding: 0 12px; border: 1px solid ${TOKENS.primaryFill}; border-radius: 8px; background: transparent; color: ${TOKENS.primaryFill}; font: inherit; font-size: 12px; cursor: pointer; transition: background .15s, color .15s; }
.movc-stage-action:hover { background: ${TOKENS.primaryFill}; color: #fff; }
.movc-stage-active { border-color: ${TOKENS.primaryFill}; color: ${TOKENS.primaryFill}; font-weight: 600; }
.movc-stage-review { border-color: ${TOKENS.primaryFill}; color: ${TOKENS.primaryFill}; }
.movc-node-head { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.movc-node-title { font-size: 13px; font-weight: 600; color: ${TOKENS.text}; }
.movc-badge { color: ${TOKENS.muted}; }
.movc-actions { display: flex; flex-wrap: wrap; gap: 4px; margin-left: auto; }
.movc-mini { flex: 0 0 auto; font: inherit; font-size: 11px; padding: 3px 10px; border: 1px solid ${TOKENS.border}; border-radius: 6px; background: transparent; color: ${TOKENS.text}; cursor: pointer; transition: border-color .15s, color .15s, opacity .15s; }
.movc-mini:hover { border-color: ${TOKENS.primaryFill}; color: ${TOKENS.primaryFill}; }
.movc-mini-danger:hover { border-color: ${TOKENS.error}; color: ${TOKENS.error}; }
.movc-mini-primary { border-color: ${TOKENS.primaryFill}; color: ${TOKENS.primaryFill}; }
.movc-body { font-size: 12px; line-height: 1.6; color: ${TOKENS.muted}; white-space: pre-wrap; overflow: auto; flex: 1; }
.movc-media { width: 100%; height: 100%; object-fit: contain; border-radius: 6px; background: #0001; }
.movc-shots { margin: 0; padding-left: 16px; }
.movc-modal { position: fixed; inset: 0; background: #0006; display: flex; align-items: center; justify-content: center; z-index: 2147483000; }
.movc-modal-body { width: min(640px, calc(100vw - 32px)); max-height: 86vh; overflow: auto; box-sizing: border-box; border: 1px solid ${TOKENS.border}; border-radius: 12px; padding: 18px 20px; background: ${TOKENS.cardFill}; color: ${TOKENS.text}; display: flex; flex-direction: column; gap: 8px; }
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
.movc-link { display: inline-flex; align-items: center; box-sizing: border-box; height: 32px; padding: 0 14px; border: 1px solid ${TOKENS.border}; border-radius: 8px; color: ${TOKENS.text}; font-size: 12px; text-decoration: none; white-space: nowrap; transition: border-color .15s, color .15s; }
.movc-link:hover { border-color: ${TOKENS.primaryFill}; color: ${TOKENS.primaryFill}; }
.movc-marquee { position: absolute; border: 1px dashed ${TOKENS.primaryFill}; background: ${TOKENS.primaryFill}1f; pointer-events: none; border-radius: 4px; }
.movc-flow-entry { position: absolute; left: 12px; top: 12px; z-index: 2; display: inline-flex; align-items: center; height: 30px; padding: 0 12px; border: 1px solid ${TOKENS.border}; border-radius: 8px; background: ${TOKENS.cardFill}; color: ${TOKENS.text}; font: inherit; font-size: 12px; cursor: pointer; transition: border-color .15s, color .15s; }
.movc-flow-entry:hover { border-color: ${TOKENS.primaryFill}; color: ${TOKENS.primaryFill}; }
.movc-invite { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); z-index: 2; display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 22px 26px; border: 1px dashed ${TOKENS.border}; border-radius: 14px; background: ${TOKENS.cardFill}; color: ${TOKENS.muted}; cursor: pointer; text-align: center; }
.movc-invite:hover { border-color: ${TOKENS.primaryFill}; }
.movc-invite strong { font-size: 14px; color: ${TOKENS.text}; }
.movc-invite span { font-size: 12px; line-height: 1.6; max-width: 340px; }
.movc-name { display: inline-flex; align-items: center; gap: 6px; flex: 1 1 160px; min-width: 0; }
.movc-name-text { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; border: 1px solid transparent; border-radius: 8px; padding: 5px 12px; font-size: 14px; font-weight: 600; color: ${TOKENS.text}; background: transparent; cursor: text; }
.movc-name-text:hover { border-color: ${TOKENS.primaryFill}; color: ${TOKENS.primaryFill}; }
.movc-name input { flex: 1 1 auto; min-width: 0; font: inherit; font-size: 13px; color: inherit; background: ${TOKENS.controlFill}; border: 1px solid ${TOKENS.primaryFill}; border-radius: 8px; padding: 5px 12px; }
.movc-name-err { flex: 1 1 100%; font-size: 12px; color: #c0392b; }
/* 弹窗里的按钮按内容自适应，不撑成设置页那种 120px 方块。 */
.movc-modal .mov-btn { flex: 0 0 auto; width: auto; min-width: 104px; border-radius: 8px; white-space: nowrap; overflow-wrap: normal; }
`;

  /** 分镜节点里的预览：有「画面」列就只显示详情，镜别与运镜另接在前面。 */
  function shotVisual(shot: any) {
    const visual = String(shot?.visual || shot?.text || shot?.scene || '').trim();
    const line = visual.split(/\r?\n/).map(part => part.trim()).find(part => /^(?:画面|visual)[:：]/.test(part));
    return (line ? line.replace(/^(?:画面|visual)[:：]\s*/, '') : visual).trim();
  }

  function nodeBody(node: any) {
    const data = node?.data || {};
    if (data.assetId) return h(node.type === 'image' ? 'img' : 'video', {
      key: 'media', className: 'movc-media',
      ...(node.type === 'image' ? { src: mediaUrl(data.assetId), alt: data.label || '' } : { src: mediaUrl(data.assetId), controls: true, preload: 'metadata' }),
    });
    if (node.type === 'storyboard' && Array.isArray(data.shots) && data.shots.length) return h('div', { key: 'shots', className: 'movc-body' }, [
      h('ul', { key: 'list', className: 'movc-shots' }, data.shots.slice(0, 12).map((shot: any, index: number) =>
        h('li', { key: index }, `${shot?.index || index + 1}. ${[shot?.camera, shotVisual(shot).slice(0, 60)].filter(Boolean).join(' · ')}`))),
      data.shots.length > 12 ? h('div', { key: 'more' }, `…共 ${data.shots.length} 个镜头`) : null,
    ]);
    const text = textOf(node);
    return h('div', { key: 'text', className: 'movc-body' }, text ? text.slice(0, 600) : '（暂无内容，可先编辑）');
  }

  /** 连拍状态一句话，界面与提示共用，避免各处写不一样的措辞。 */
  const chainStatusText = (chain: any) => ({
    running: `连拍进行中：第 ${chain.index + 1}/${chain.total} 段生成中…`,
    review: `第 ${chain.index + 1}/${chain.total} 段已有成果，等你审核`,
    done: `连拍完成：${chain.total} 段都已有成果`,
    stopped: `连拍已停止：已完成 ${chain.done}/${chain.total} 段`,
    stale: `连拍需要重排：已完成 ${chain.done}/${chain.total} 段`,
  }[chain.state] || `连拍状态：${chain.state}`);

  function FlowCanvas() {
    const [list, setList] = React.useState([] as any[]);
    const [canvas, setCanvas] = React.useState(null as any);
    const [error, setError] = React.useState('');
    const [notice, setNotice] = React.useState('');
    const [view, setView] = React.useState({ x: 30, y: 24, scale: 1 });
    const [panning, setPanning] = React.useState(false);
    const [positions, setPositions] = React.useState({} as any);
    const [selectedIds, setSelectedIds] = React.useState([] as string[]);
    const [marquee, setMarquee] = React.useState(null as any);
    const [connectFrom, setConnectFrom] = React.useState('');
    const [inline, setInline] = React.useState(null as any);
    const [createDialog, setCreateDialog] = React.useState(null as any);
    const [scriptDialog, setScriptDialog] = React.useState(null as any);
    const [clock, setClock] = React.useState(0);
    const [chainDialog, setChainDialog] = React.useState(null as any);
    const [filmDialog, setFilmDialog] = React.useState(null as any);
    const [importing, setImporting] = React.useState(false);
    const [confirmDelete, setConfirmDelete] = React.useState(false);
    const [dialog, setDialog] = React.useState(null as any);
    const pan = React.useRef(null as any);
    const moving = React.useRef(null as any);
    const marqueeDone = React.useRef(false);
    const timer = React.useRef(null as any);
    const chainTimer = React.useRef(null as any);
    const importRef = React.useRef(null as any);
    const alive = React.useRef(true);
    const stageRef = React.useRef(null as any);
    React.useEffect(() => () => { alive.current = false; if (timer.current) clearInterval(timer.current); if (chainTimer.current) clearInterval(chainTimer.current); }, []);
    // 写脚本那几十秒里每秒走一下表：把「还在写」和「卡住了」区分开。
    React.useEffect(() => {
      if (!scriptDialog?.writing) return undefined;
      const ticker = setInterval(() => setClock(Date.now()), 1000);
      return () => clearInterval(ticker);
    }, [scriptDialog?.writing]);

    const load = React.useCallback(async (projectId?: string) => {
      try {
        setError('');
        const { canvases } = await rpc('list');
        const wanted = projectId || canvases[0]?.projectId;
        setList(canvases);
        if (!wanted) { setCanvas(null); setInline(null); return; }
        const { canvas: doc } = await rpc('get', { projectId: wanted });
        setCanvas(doc); setInline(null); setPositions({}); setSelectedIds([]); setMarquee(null);
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

    const removeNodes = React.useCallback(async (ids: string[]) => {
      if (!canvas || !ids.length) return;
      for (const id of ids) await rpc('nodeDelete', { projectId: canvas.projectId, nodeId: id });
      setSelectedIds(all => all.filter(id => !ids.includes(id)));
      if (connectFrom && ids.includes(connectFrom)) setConnectFrom('');
      await refresh();
    }, [canvas, connectFrom, refresh]);

    /** 复制节点只带可编辑内容：成果素材、原任务标识与来源关系不复制，避免把别人的成果当成本节点结果。 */
    const duplicateNode = React.useCallback(async (node: any) => {
      if (!canvas) return;
      const spot = { ...sizeOf(node), ...(positions[node.id] || {}) };
      const id = `usr_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
      await saveNode(id, duplicateNodePayload(node, spot));
      setSelectedIds([id]);
      setNotice('已复制节点（不含成果素材与原任务标识）；改完内容再生成，费用照常单独确认。');
    }, [canvas, positions, saveNode]);

    /** 导出当前画布文档（节点、连线、视图与名字），只读导出，不改画布也不含API密钥。 */
    const exportCanvas = React.useCallback(() => {
      if (!canvas || typeof document === 'undefined') return;
      try {
        const payload = { name: canvas.name, projectId: canvas.projectId, view: canvas.view, nodes: canvas.nodes, edges: canvas.edges, exportedAt: new Date().toISOString() };
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${String(canvas.name || canvas.projectId).replace(/[\\/:*?"<>|]/g, '_')}.canvas.json`;
        document.body.append(link); link.click(); link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      } catch (e: any) { setError(e?.message || '导出画布失败'); }
    }, [canvas])

    /** 导入自己的图片素材：整张写进画布数据目录，再建一个图片节点；
     *  之后连到视频节点的「首帧」或「参考图」端口就能直接用于制作，不依赖任何外部图床。 */
    const importImages = React.useCallback(async (files: any, attachTo?: string) => {
      const picked = Array.from(files || []) as any[];
      if (!canvas || !picked.length) return;
      setError(''); setImporting(true);
      const made: string[] = [];
      try {
        for (const file of picked) {
          const response = await fetch(`/metaontic-video/canvas-import?projectId=${encodeURIComponent(canvas.projectId)}&name=${encodeURIComponent(String(file?.name || ''))}`,
            { method: 'POST', headers: { 'content-type': file?.type || 'application/octet-stream' }, body: file });
          const body = await response.json().catch(() => ({}));
          if (!response.ok || body?.error) throw new Error(body?.error || '导入图片未完成。');
          const id = `usr_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
          const count = Object.keys(canvas.nodes || {}).length + made.length;
          await saveNode(id, { type: 'image', x: 60 + (count % 4) * 420, y: 60 + Math.floor(count / 4) * 360,
            w: NODE_SIZE.image[0], h: NODE_SIZE.image[1],
            data: { label: body.name || String(file?.name || '导入图片'), assetId: body.assetId, ratio: '1:1', resolution: '720p', prompt: '',
              ...(attachTo ? { metaonticSegmentOf: attachTo } : {}) } });
          // 从制作窗口导入时顺手接到本节点的「参考图」端口，省掉一次手工连线。
          if (attachTo) await rpc('edgeAdd', { projectId: canvas.projectId, fromNode: id, toNode: attachTo, fromPort: 'out', toPort: 'ref' });
          made.push(id);
        }
        if (made.length) {
          setSelectedIds(made); await refresh();
          if (attachTo) setNotice(`已导入 ${made.length} 张参考素材，并连到本节点的「参考图」端口；在制作窗口里也可以把端口切成「首帧」。真人照片会被视频接口拒绝，先把照片连到图片节点生成一张非真人二维动画风格的图，再用那张当首帧。`);
          else setNotice(`已导入 ${made.length} 张图片素材：连到视频节点的「首帧」或「参考图」端口就能直接用于制作。真人照片会被视频接口拒绝，先把照片连到图片节点生成一张非真人二维动画风格的图，再用那张当首帧。`);
        }
      } catch (e: any) { setError(e?.message || '导入图片失败'); }
      finally { setImporting(false); if (importRef.current) importRef.current.value = ''; }
    }, [canvas, saveNode, refresh]);

    /** 合成成片：把已生成的每段视频按连线顺序拼成一条，完成后直接预览、下载。
     *  合成只读取已有成果，不会重新生成任何段落；缺段会明确报出是第几段。 */
    const mergeFilm = React.useCallback(async () => {
      if (!canvas) return;
      setError('');
      setFilmDialog({ busy: true, film: canvas.film || null, message: '' });
      try {
        const data = await canvasNativeRpc({ action: 'mergeFilm', projectId: canvas.projectId }, fetch, 900000);
        setFilmDialog({ busy: false, film: data?.film || null, message: '' });
        await refresh();
        setNotice(`成片已合成：${data?.film?.count || 0} 段${data?.film?.seconds ? ` · 约 ${Math.round(data.film.seconds)} 秒` : ''}，可直接预览或下载。`);
      } catch (e: any) { setFilmDialog((current: any) => ({ ...(current || {}), busy: false, message: e?.message || '合成成片未完成。' })); }
    }, [canvas, refresh]);

    /** 落库一版按连线排好的坐标：只写 x/y，不动内容与连线。 */
    const applyLayout = React.useCallback(async (doc: any) => {
      const { positions: spots, moved } = tidyLayout(doc);
      for (const node of Object.values(doc?.nodes || {}) as any[]) {
        const spot = spots[node.id];
        if (!spot) continue;
        if (Math.round(Number(node.x) || 0) === spot.x && Math.round(Number(node.y) || 0) === spot.y) continue;
        await rpc('nodeSave', { projectId: doc.projectId, node: { id: node.id, x: spot.x, y: spot.y } });
      }
      return { spots, moved };
    }, []);

    /** 把整张图（按排好的坐标）缩放居中到画布区，排完版一眼能看到全貌。 */
    const fitStage = React.useCallback((doc: any, spots: any) => {
      const rect = stageRef.current?.getBoundingClientRect?.();
      if (!rect?.width || !rect?.height) return;
      const boxes = (Object.values(doc?.nodes || {}) as any[]).map(node => ({ ...nodeSize(node), ...(spots[node.id] || { x: Number(node.x) || 0, y: Number(node.y) || 0 }) }));
      if (!boxes.length) return;
      const left = Math.min(...boxes.map(box => box.x)), top = Math.min(...boxes.map(box => box.y));
      const spanX = Math.max(1, Math.max(...boxes.map(box => box.x + box.w)) - left), spanY = Math.max(1, Math.max(...boxes.map(box => box.y + box.h)) - top);
      const scale = Math.min(1, Math.max(0.3, Math.min((rect.width - 80) / spanX, (rect.height - 80) / spanY)));
      setView({ scale, x: 40 - left * scale + Math.max(0, (rect.width - 80 - spanX * scale) / 2), y: 30 - top * scale + Math.max(0, (rect.height - 80 - spanY * scale) / 2) });
    }, []);

    // 流程阶段条排在主链路上方（负坐标）：首次打开带阶段条的画布时按内容适配一次视图，
    // 免得阶段卡落在可视区外；同一张画布只适配一次，之后刷新与用户自己的缩放平移都不打断。
    const fitted = React.useRef('');
    React.useEffect(() => {
      if (!canvas?.projectId || fitted.current === canvas.projectId) return;
      fitted.current = canvas.projectId;
      if (!Object.values(canvas.nodes || {}).some((node: any) => node?.data?.metaonticStage)) return;
      const id = requestAnimationFrame(() => fitStage(canvas, {}));
      return () => cancelAnimationFrame(id);
    }, [canvas, fitStage]);

    const patchChainDialog = React.useCallback((patch: any) => setChainDialog((current: any) => current ? { ...current, ...patch } : current), []);

    const stopChainPolling = React.useCallback(() => { if (chainTimer.current) { clearInterval(chainTimer.current); chainTimer.current = undefined; } }, []);

    /** 连拍状态：让界面跟着服务端记录走（换窗口、刷新后都还能接着看）。 */
    const pullChain = React.useCallback(async (id?: string) => {
      try {
        const data = await canvasNativeRpc({ action: 'chainStatus', ...(id ? { id } : { projectId: canvas?.projectId }) });
        if (!alive.current) return null;
        patchChainDialog({ chain: data?.chain || null, busy: false });
        if (!data?.chain || !['running'].includes(data.chain.state)) stopChainPolling();
        if (data?.chain && !['running', 'review'].includes(data.chain.state)) await refresh();
        return data?.chain || null;
      } catch (e: any) { if (alive.current) patchChainDialog({ busy: false, error: e?.message || '连拍状态没读到。' }); return null; }
    }, [canvas, patchChainDialog, refresh, stopChainPolling]);

    const watchChain = React.useCallback((id?: string) => {
      stopChainPolling();
      chainTimer.current = setInterval(() => { void pullChain(id); }, 3000);
    }, [pullChain, stopChainPolling]);

    /** 「连拍」：先出整条链路的方案（每段几秒、提示词、估价与合计），确认一次再开跑。 */
    const openChain = React.useCallback(async () => {
      if (!canvas) return;
      setError('');
      setChainDialog({ loading: true, busy: false, error: '', chain: null, plan: null, confirm: { plan: false, cost: false } });
      try {
        const data = await canvasNativeRpc({ action: 'chainPlan', projectId: canvas.projectId });
        if (!alive.current) return;
        patchChainDialog({ loading: false, plan: data, chain: data?.active || null });
        if (data?.active && data.active.state === 'running') watchChain(data.active.id);
        else if (data?.active && ['done', 'stopped', 'stale'].includes(data.active.state)) { await pullChain(data.active.id); }
      } catch (e: any) { if (alive.current) patchChainDialog({ loading: false, error: e?.message || '连拍方案没算出来。' }); }
    }, [canvas, patchChainDialog, pullChain, watchChain]);

    const startChain = React.useCallback(async () => {
      if (!canvas || !chainDialog?.plan) return;
      patchChainDialog({ busy: true, error: '' });
      try {
        const { chain } = await canvasNativeRpc({ action: 'chainStart', projectId: canvas.projectId, confirmPlan: true, confirmCost: true, identity: chainDialog.plan.identity });
        if (!alive.current) return;
        patchChainDialog({ chain, busy: false });
        watchChain(chain?.id);
        setNotice('连拍已开始：会按顺序逐段生成，每段出成果后停下来等你审核，确认无误再继续下一段。');
      } catch (e: any) { if (alive.current) patchChainDialog({ busy: false, error: e?.message || '连拍没开始。' }); }
    }, [canvas, chainDialog, patchChainDialog, watchChain]);

    const advanceChain = React.useCallback(async (accept: boolean) => {
      if (!chainDialog?.chain) return;
      patchChainDialog({ busy: true, error: '' });
      try {
        const { chain } = await canvasNativeRpc({ action: 'chainNext', id: chainDialog.chain.id, accept });
        if (!alive.current) return;
        patchChainDialog({ chain, busy: false });
        await refresh();
        if (chain?.state === 'running') watchChain(chain.id); else stopChainPolling();
      } catch (e: any) { if (alive.current) patchChainDialog({ busy: false, error: e?.message || '这一段没能继续。' }); }
    }, [chainDialog, patchChainDialog, refresh, stopChainPolling, watchChain]);

    const stopChain = React.useCallback(async () => {
      if (!chainDialog?.chain) return;
      patchChainDialog({ busy: true, error: '' });
      try {
        const { chain } = await canvasNativeRpc({ action: 'chainStop', id: chainDialog.chain.id });
        if (!alive.current) return;
        stopChainPolling();
        patchChainDialog({ chain, busy: false });
      } catch (e: any) { if (alive.current) patchChainDialog({ busy: false, error: e?.message || '连拍没能停下。' }); }
    }, [chainDialog, patchChainDialog, stopChainPolling]);

    /** 当前段成果还没回填时补一次回填；回填只新增成果节点，不重新生成。 */
    const syncChainSegment = React.useCallback(async () => {
      const job = chainDialog?.chain?.job;
      if (!job) return;
      patchChainDialog({ busy: true, error: '' });
      try {
        await canvasNativeRpc({ action: 'sync', id: job.id });
        await refresh();
        await pullChain(chainDialog.chain.id);
      } catch (e: any) { if (alive.current) patchChainDialog({ busy: false, error: e?.message || '补回填没完成。' }); }
    }, [chainDialog, patchChainDialog, pullChain, refresh]);

    /** 一键美化：按连线重排节点坐标（不动内容与连线），随后把整张图适配进画布区。 */
    const tidy = React.useCallback(async () => {
      if (!canvas) return;
      try {
        setError('');
        const { canvas: doc } = await rpc('get', { projectId: canvas.projectId });
        const { spots, moved } = await applyLayout(doc);
        if (!moved) { setNotice('当前布局已经整齐，无需调整。'); return; }
        setPositions({});
        await refresh();
        fitStage(doc, spots);
        setNotice(`已美化布局：${moved} 个节点按连线重排；内容与连线没动，之后仍可手动微调。`);
      } catch (e: any) { setError(e?.message || '美化布局失败'); }
    }, [canvas, refresh, applyLayout, fitStage]);

    const patchScriptDialog = React.useCallback((patch: any) => setScriptDialog((current: any) => current ? { ...current, ...patch } : current), []);

    /** 创作流程按对话里的顺序两步走：第一步创建需求，第二步再写脚本。
     *  默认值按当前模型上限来，打开时问一次服务端就够。 */
    const openRequirement = React.useCallback(async () => {
      setError('');
      // 「改需求」也走这一步：已有需求节点就带出原来的想法与规格，确认后就地更新同一份需求。
      const requirement = requirementNodeOf(canvas);
      const spec = requirement?.data?.metaonticRequirementSpec || {};
      setScriptDialog({ step: 'requirement', text: '', idea: String(requirement?.data?.metaonticRequirementBrief || ''),
        totalSeconds: spec.seconds || 15, segmentSeconds: spec.segmentSeconds || 15, singleMax: 15,
        ratio: spec.ratio || '16:9', resolution: spec.resolution || '720p', busy: false, error: '', plan: null });
      try {
        const info = await canvasNativeRpc({ action: 'info' });
        if (!alive.current) return;
        patchScriptDialog({ singleMax: info?.singleMax || 15, textModel: info?.textModel || '', textReady: info?.textReady !== false,
          totalSeconds: Math.min(15, info?.singleMax || 15), segmentSeconds: info?.singleMax || 15,
          ...(info?.videoReady === false ? { error: '还没配置视频API密钥，可以先创建需求，配置好再生成。' } : {}) });
      } catch (e: any) { if (alive.current) patchScriptDialog({ error: e?.message || '制作服务尚未就绪。' }); }
    }, [canvas, patchScriptDialog]);

    /** 第二步「写脚本」：读第一步建好的需求当输入，写剧本与分镜，再铺制作节点。 */
    const openScript = React.useCallback(async () => {
      setError('');
      const requirement = requirementNodeOf(canvas);
      const spec = requirement?.data?.metaonticRequirementSpec || {};
      setScriptDialog({ step: 'script', text: '', idea: String(requirement?.data?.metaonticRequirementBrief || ''),
        totalSeconds: spec.seconds || 15, segmentSeconds: spec.segmentSeconds || 15, singleMax: 15,
        ratio: spec.ratio || '16:9', resolution: spec.resolution || '720p', busy: false, error: '', plan: null });
      try {
        const info = await canvasNativeRpc({ action: 'info' });
        if (!alive.current) return;
        patchScriptDialog({ singleMax: info?.singleMax || 15, textModel: info?.textModel || '', textReady: info?.textReady !== false,
          ...(info?.videoReady === false ? { error: '还没配置视频API密钥，可以先写脚本，配置好再生成。' } : {}) });
      } catch (e: any) { if (alive.current) patchScriptDialog({ error: e?.message || '制作服务尚未就绪。' }); }
    }, [canvas, patchScriptDialog]);

    /** 让文本模型把一句想法写成剧本与分镜表：写回来的正文仍要用户过一遍再建节点。 */
    const writeWithModel = React.useCallback(async () => {
      if (!canvas || !scriptDialog) return;
      const idea = String(scriptDialog.idea || '').trim();
      if (!idea) { patchScriptDialog({ error: '先写一句想拍什么，文本模型才有得写。' }); return; }
      patchScriptDialog({ busy: true, writing: true, writingSince: Date.now(), error: '', plan: null });
      try {
        const result = await canvasNativeRpc({ action: 'write', projectId: canvas.projectId, idea,
          totalSeconds: scriptDialog.totalSeconds, segmentSeconds: scriptDialog.segmentSeconds, ratio: scriptDialog.ratio }, fetch, TEXT_WRITE_TIMEOUT_MS);
        if (!alive.current) return;
        patchScriptDialog({ busy: false, writing: false, writingSince: 0, text: result.script,
          error: result.truncated === true ? '文本模型写到了输出上限，脚本可能不完整：把目标时长调短一些，或分两次写，再核对分镜表。' : '' });
        setNotice(`文本模型（${result.model}）已写出剧本：核对分镜表后点「预览分段」，再生成制作节点。`);
      } catch (e: any) { if (alive.current) patchScriptDialog({ busy: false, writing: false, writingSince: 0, error: e?.message || '文本模型没有写出脚本。' }); }
    }, [canvas, scriptDialog, patchScriptDialog]);

    /** 先出计划：让用户看清会被拆成几段、每段多少秒、每段提示词是什么，再决定要不要建节点。 */
    const previewScript = React.useCallback(async () => {
      if (!canvas || !scriptDialog) return;
      const text = String(scriptDialog.text || '').trim();
      if (!text) { patchScriptDialog({ error: '请先写下脚本内容。' }); return; }
      patchScriptDialog({ busy: true, error: '', plan: null });
      try {
        const plan = await canvasNativeRpc({ action: 'plan', projectId: canvas.projectId, script: text,
          totalSeconds: scriptDialog.totalSeconds, segmentSeconds: scriptDialog.segmentSeconds });
        if (!alive.current) return;
        patchScriptDialog({ busy: false, plan });
      } catch (e: any) { if (alive.current) patchScriptDialog({ busy: false, error: e?.message || '分段计划没算出来。' }); }
    }, [canvas, scriptDialog, patchScriptDialog]);

    /** 第一步「创建需求」：写下想拍什么与规格，建需求节点并铺出五张阶段卡；不写脚本、不建制作节点、不调用任何模型。
     *  需求确认后工具条与阶段卡②都会指向第二步「写脚本」，跟对话里先确认需求再写脚本的顺序一致。 */
    const createRequirement = React.useCallback(async () => {
      if (!canvas || !scriptDialog) return;
      const brief = String(scriptDialog.idea || '').trim();
      if (!brief) { patchScriptDialog({ error: '先写一句想拍什么，需求才有内容。' }); return; }
      patchScriptDialog({ busy: true, error: '' });
      try {
        const projectId = canvas.projectId;
        const seconds = Math.max(4, Math.min(3600, Number(scriptDialog.totalSeconds) || 15));
        const resolution = scriptDialog.resolution;
        const ratio = scriptDialog.ratio;
        const segmentSeconds = Math.max(4, Math.min(Number(scriptDialog.segmentSeconds) || 15, scriptDialog.singleMax || 15));
        const stamp = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
        const prefix = stagePrefixOf(canvas) || `usr_${stamp}`;
        const count = Object.keys(canvas.nodes || {}).length;
        const baseX = 60 + (count % 3) * 60, baseY = 60 + (count % 3) * 60;
        // 「改需求」就地更新原来那个需求节点，不另建一份。
        const existing = requirementNodeOf(canvas);
        const requirementId = existing?.id || `usr_${stamp}_requirement`;
        await saveNode(requirementId, { type: 'text', x: Number(existing?.x ?? baseX), y: Number(existing?.y ?? baseY), w: 420, h: 260,
          data: requirementNodeData(brief, seconds, segmentSeconds, ratio, resolution) });
        // 需求确认就把五张阶段卡铺出来：① 已完成，② 等第二步写脚本，后面几步按画布内容重算。
        const facts = { requirementSettled: true, duration: seconds, choice: '画布内创作', ratio, resolution,
          scriptDrafted: false, scriptApproved: false, specApproved: false, segmentTotal: 0 };
        const stats = { total: 0, produced: 0, filmReady: false, filmCount: 0 };
        for (const [index, stage] of stageSummary(facts, stats).entries()) {
          const spot = stageSpot(index);
          await saveNode(stageNodeId(prefix, stage.key), { type: 'text', x: spot.x, y: spot.y, w: spot.w, h: spot.h,
            data: { ...sealedStageData(stage.key, stage.state, stage.text, facts), label: STAGE_LABELS[stage.key] } });
        }
        const { canvas: doc } = await rpc('get', { projectId });
        const { spots } = await applyLayout(doc);
        await refresh();
        fitStage(doc, spots);
        setScriptDialog(null);
        setNotice('需求已创建：① 需求确认标为已完成。再点画布空白处或阶段卡②的「写脚本」，按这份需求写剧本与分镜。');
      } catch (e: any) { if (alive.current) patchScriptDialog({ busy: false, error: e?.message || '需求节点没建出来。' }); }
    }, [canvas, scriptDialog, patchScriptDialog, saveNode, applyLayout, refresh, fitStage]);

    /** 第二步「写脚本」→ 铺开制作节点：剧本（+分镜）→ 每段一个视频节点，全部连线并自动排版。 */
    const createFromScript = React.useCallback(async () => {
      if (!canvas || !scriptDialog) return;
      const text = String(scriptDialog.text || '').trim();
      if (!text) { patchScriptDialog({ error: '请先写下脚本内容。' }); return; }
      patchScriptDialog({ busy: true, error: '' });
      try {
        const projectId = canvas.projectId;
        const plan = await canvasNativeRpc({ action: 'plan', projectId, script: text,
          totalSeconds: scriptDialog.totalSeconds, segmentSeconds: scriptDialog.segmentSeconds });
        const stamp = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
        const ratio = scriptDialog.ratio, resolution = scriptDialog.resolution;
        const count = Object.keys(canvas.nodes || {}).length;
        const baseX = 60 + (count % 3) * 60, baseY = 60 + (count % 3) * 60;
        const scriptId = `usr_${stamp}_script`;
        await saveNode(scriptId, { type: 'script', x: baseX, y: baseY, w: 420, h: 320, data: { label: '剧本', text } });
        let upstream = scriptId;
        if (plan.shots?.length) {
          const boardId = `usr_${stamp}_board`;
          const shots = plan.shots.map((shot: any) => ({ index: shot.index, visual: shot.visual, ...(shot.camera ? { camera: shot.camera } : {}), ...(shot.sfx ? { sfx: shot.sfx } : {}), ...(shot.duration ? { duration: shot.duration } : {}) }));
          await saveNode(boardId, { type: 'storyboard', x: baseX + 560, y: baseY, w: 460, h: 340, data: { label: '分镜', shots } });
          await rpc('edgeAdd', { projectId, fromNode: scriptId, toNode: boardId, fromPort: 'out', toPort: 'script' });
          upstream = boardId;
        }
        for (const [index, segment] of plan.segments.entries()) {
          const id = `usr_${stamp}_seg${index + 1}`, frameId = `usr_${stamp}_frame${index + 1}`;
          // 每段先铺一个「画面」节点：对齐 LibTV 的 剧本 → 分镜 → 画面 → 视频合成。
          // 画面是一张图，出图后作为这一段的首帧接进视频节点；图片与视频各自单独确认方案与费用。
          await saveNode(frameId, { type: 'image', x: baseX + 1160, y: baseY + index * 340, w: 360, h: 300,
            data: { label: `第${index + 1}段 · 画面`, prompt: segment.prompt, ratio, resolution, imageCount: 1, [FRAME_MARK]: id } });
          await saveNode(id, { type: 'video', x: baseX + 1720, y: baseY + index * 340, w: 360, h: 300,
            data: { label: `第${index + 1}段 · ${segment.seconds}秒`, prompt: segment.prompt, ratio, resolution, duration: segment.seconds } });
          await rpc('edgeAdd', { projectId, fromNode: upstream, toNode: frameId, fromPort: 'out', toPort: 'prompt' });
          await rpc('edgeAdd', { projectId, fromNode: frameId, toNode: id, fromPort: 'out', toPort: 'frame' });
        }
        // 第一步建过需求就补上需求节点，规格以第二步面板上的值为准。
        if (!requirementNodeOf(canvas)) {
          const brief = String(scriptDialog.idea || '').trim() || text.split(/\r?\n/)[0].slice(0, 80);
          await saveNode(`usr_${stamp}_requirement`, { type: 'text', x: baseX - 500, y: baseY, w: 420, h: 260,
            data: requirementNodeData(brief, Number(scriptDialog.totalSeconds) || 15, Number(scriptDialog.segmentSeconds) || 15, ratio, resolution) });
        }
        // 同一套阶段卡：需求那一步已经铺过就复用同一批卡、只把事实推进到「脚本已写」，
        // 不另铺一套；之后回填与合成成片由服务端按画布内容重算，字段与助手建图完全一致。
        const facts = { requirementSettled: true, duration: Number(scriptDialog.totalSeconds) || null, choice: '画布内创作',
          ratio, resolution, scriptDrafted: true, scriptApproved: false, specApproved: true, segmentTotal: plan.segments.length };
        const { nodes: rewritten, changed } = rewriteStageNodes(canvas, facts);
        const existing = Object.values(rewritten).filter((node: any) => node?.data?.metaonticStage) as any[];
        if (existing.length) {
          for (const id of changed) await saveNode(id, { data: rewritten[id].data });
        } else {
          const stats = { total: plan.segments.length, produced: 0, filmReady: false, filmCount: 0 };
          for (const [index, stage] of stageSummary(facts, stats).entries()) {
            const spot = stageSpot(index);
            await saveNode(stageNodeId(stagePrefixOf(canvas) || `usr_${stamp}`, stage.key), { type: 'text', x: spot.x, y: spot.y, w: spot.w, h: spot.h,
              data: { ...sealedStageData(stage.key, stage.state, stage.text, facts), label: STAGE_LABELS[stage.key] } });
          }
        }
        const { canvas: doc } = await rpc('get', { projectId });
        const { spots } = await applyLayout(doc);
        await refresh();
        fitStage(doc, spots);
        setScriptDialog(null);
        setNotice(`已按脚本铺开 ${plan.segments.length} 段流程（剧本 → 分镜 → 画面 → 视频）：先核对每段提示词，确认无误后点剧本节点或阶段卡②的「确认脚本」，再点「制作「…」」逐段走——先出每段前面的「画面」（它接成这一段的首帧），再出视频；图片与视频都单独确认方案与费用。`);
      } catch (e: any) { if (alive.current) patchScriptDialog({ busy: false, error: e?.message || '脚本节点没建出来。' }); }
    }, [canvas, scriptDialog, patchScriptDialog, saveNode, applyLayout, refresh, fitStage]);

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

    /** 切换媒体端口：首帧和参考图共用同一条边，只是 toPort 不同；改端口就重建这条线，
     *  让「一张自己的图当开头」和「多张参考图」都能在画布里直接连出来。 */
    const setEdgePort = React.useCallback(async (edge: any, toPort: string) => {
      if (!canvas || !edge || edge.toPort === toPort) return;
      try {
        setError('');
        await rpc('edgeDelete', { projectId: canvas.projectId, edgeId: edge.id });
        await rpc('edgeAdd', { projectId: canvas.projectId, fromNode: edge.fromNode, toNode: edge.toNode, fromPort: 'out', toPort });
        await refresh();
      } catch (e: any) { setError(e?.message || '切换素材端口未完成。'); }
    }, [canvas, refresh]);

    /** 在视频节点的制作窗口里新建一个参考图节点并接好线：图片节点自己去「制作」生成，再作为参考素材。 */
    const addReferenceImage = React.useCallback(async (nodeId: string) => {
      if (!canvas) return;
      const source = (canvas.nodes || {})[nodeId];
      const id = `usr_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
      try {
        setError('');
        // 参考图节点是「素材」不是制作段：产出的图喂给这一段当资产，不占用「逐段制作」的推进顺序。
        await saveNode(id, { type: 'image', x: Number(source?.x || 60) - 520, y: Number(source?.y || 60), w: NODE_SIZE.image[0], h: NODE_SIZE.image[1],
          data: { label: '参考图', prompt: '', ratio: '1:1', resolution: '720p', imageCount: 1,
            [MATERIAL_MARK]: true, metaonticSegmentOf: nodeId } });
        await rpc('edgeAdd', { projectId: canvas.projectId, fromNode: id, toNode: nodeId, fromPort: 'out', toPort: 'ref' });
        setSelectedIds([id]);
        await refresh();
        setNotice('已新建参考图节点并接到本节点的「参考图」端口：点它的「制作」生成图片，生成前仍要单独确认方案与费用。');
      } catch (e: any) { setError(e?.message || '新建参考图节点未完成。'); }
    }, [canvas, saveNode, refresh]);

    /** 删除整张画布要二次确认：删掉的是这份文档，成果素材文件仍留在插件数据目录里。 */
    const deleteCanvas = React.useCallback(async () => {
      if (!canvas) return;
      try {
        setError('');
        const gone = canvas.projectId;
        await rpc('delete', { projectId: gone });
        setConfirmDelete(false);
        const next = list.find(item => item.projectId !== gone)?.projectId;
        await load(next);
        setNotice('画布已删除；已生成的成果素材文件仍保留在插件数据目录，便于另行取用。');
      } catch (e: any) { setConfirmDelete(false); setError(e?.message || '删除画布失败'); }
    }, [canvas, list, load]);

    /** 就地改名：空名放弃本次编辑（保留原名），重名或保存失败时显示原因并退出编辑。 */
    const commitRename = React.useCallback(async () => {
      if (!canvas || !inline) return;
      const name = String(inline.value || '').trim();
      if (!name) { setInline(null); setError('画布名不能为空，已保留原名。'); return; }
      if (name === canvas.name) { setInline(null); return; }
      try {
        await rpc('rename', { projectId: canvas.projectId, name });
        setInline(null); setError('');
        await refresh();
      } catch (e: any) {
        setInline(null);
        setError(e?.message || '改名未保存，已保留原名。');
      }
    }, [canvas, inline, refresh]);

    const submitCreate = React.useCallback(async () => {
      if (!createDialog) return;
      const name = String(createDialog.value || '').trim();
      if (!name) { setCreateDialog({ ...createDialog, error: '画布名不能为空' }); return; }
      try {
        const { canvas: made } = await rpc('create', { name });
        setCreateDialog(null);
        await load(made.projectId);
        setNotice('已新建流程画布：可以加节点开始画布内的制作，也可以直接用于既有创作项目。');
      } catch (e: any) {
        setCreateDialog({ ...createDialog, error: e?.message || '新建画布未完成。' });
      }
    }, [createDialog, load]);

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

    /** 点画布空白处或「＋ 创作流程」：走到当前该做的那一步——还没有需求就创建需求，有需求没脚本就写脚本，
     *  已经铺好剧本就打开剧本节点。有选中的节点时先只取消选择，避免想取消选择却弹出面板。 */
    const openFlow = React.useCallback(() => {
      if (!canvas) return;
      if (selectedIds.length) { setSelectedIds([]); return; }
      const stages: any[] = Object.values(canvas.nodes || {}).filter((node: any) => node?.data?.metaonticStage);
      const factsOf = (key: string) => (stages.find((node: any) => String(node.data.metaonticStage) === key)?.data?.metaonticStageFacts) || {};
      if (!factsOf('requirement').requirementSettled) { void openRequirement(); return; }
      // 脚本还没审核通过就回到第二步核对/改脚本；审核通过后只打开剧本节点查看，不重铺一套节点。
      if (factsOf('script').scriptApproved !== true) { void openScript(); return; }
      const scriptNode = (Object.values(canvas.nodes || {}) as any[]).find((node: any) => node?.type === 'script');
      if (scriptNode) { void openDialog(scriptNode); return; }
      void openScript();
    }, [canvas, selectedIds.length, openRequirement, openScript, openDialog]);

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
      event.currentTarget.setPointerCapture?.(event.pointerId);
      // Shift+拖空白 = 框选；普通拖空白仍然平移。
      if (event.shiftKey) {
        const rect = event.currentTarget.getBoundingClientRect();
        const local = { x: event.clientX - rect.left, y: event.clientY - rect.top };
        setMarquee({ x1: local.x, y1: local.y, x2: local.x, y2: local.y });
        return;
      }
      pan.current = { x: event.clientX, y: event.clientY, ox: view.x, oy: view.y, moved: false };
      setPanning(true);
    };
    const onPointerMove = (event: any) => {
      if (moving.current) {
        const { ids, x, y, origins } = moving.current;
        setPositions((all: any) => {
          const next = { ...all };
          for (const id of ids) {
            const origin = origins[id];
            if (!origin) continue;
            next[id] = { x: origin.x + (event.clientX - x) / view.scale, y: origin.y + (event.clientY - y) / view.scale };
          }
          return next;
        });
        return;
      }
      if (marquee) {
        const rect = event.currentTarget.getBoundingClientRect();
        setMarquee((current: any) => current ? { ...current, x2: event.clientX - rect.left, y2: event.clientY - rect.top } : current);
        return;
      }
      if (!pan.current) return;
      if (Math.abs(event.clientX - pan.current.x) > 4 || Math.abs(event.clientY - pan.current.y) > 4) pan.current.moved = true;
      setView((current: any) => ({ ...current, x: pan.current.ox + (event.clientX - pan.current.x), y: pan.current.oy + (event.clientY - pan.current.y) }));
    };
    const onPointerUp = () => {
      if (marquee) {
        const world = (value: number, offset: number) => (value - offset) / view.scale;
        const left = world(Math.min(marquee.x1, marquee.x2), view.x), top = world(Math.min(marquee.y1, marquee.y2), view.y);
        const right = world(Math.max(marquee.x1, marquee.x2), view.x), bottom = world(Math.max(marquee.y1, marquee.y2), view.y);
        const hits = nodes.map(raw => geometry(raw)).filter(node => node.x < right && node.x + node.w > left && node.y < bottom && node.y + node.h > top).map(node => node.id);
        if (hits.length) { setSelectedIds(hits); marqueeDone.current = true; }
        setMarquee(null);
        return;
      }
      if (moving.current) {
        const { ids } = moving.current;
        const spots = ids.map((id: string) => [id, positions[id]]).filter(([, spot]: any) => spot);
        moving.current = null;
        for (const [id, spot] of spots as any) void saveNode(id, { x: spot.x, y: spot.y });
        return;
      }
      // 没有拖动的空白单击 = 点击画布：没有流程时进入「创作流程」。
      const clickedEmpty = Boolean(pan.current && !pan.current.moved);
      pan.current = null; setPanning(false);
      if (clickedEmpty) openFlow();
    };
    const startMove = (event: any, node: any) => {
      if (event.button !== 0) return;
      event.stopPropagation();
      // 选中多个时拖动其中任意一个，整组一起移动。
      const ids = selectedIds.includes(node.id) ? selectedIds : [node.id];
      if (!selectedIds.includes(node.id)) setSelectedIds([node.id]);
      const origins: any = {};
      for (const id of ids) {
        const raw = (canvas?.nodes || {})[id];
        if (!raw) continue;
        const spot = { ...sizeOf(raw), ...(positions[id] || {}) };
        origins[id] = { x: spot.x || 0, y: spot.y || 0 };
      }
      moving.current = { ids, x: event.clientX, y: event.clientY, origins };
      event.currentTarget.setPointerCapture?.(event.pointerId);
    };

    const steps = flowSteps(canvas);
    const film = canvas ? filmStatus(canvas) : null;
    const nextStep = steps.find(step => !step.done) || null;
    const doneSteps = steps.filter(step => step.done).length;
    const nodes = canvas ? Object.values(canvas.nodes || {}) : [];
    const edges = canvas?.edges || [];
    const producedIds = producedNodeIds(canvas);
    // 头部状态胶囊：显式标了完成，或画布上已经有它的成果节点。插件自己写 status 的节点（如自动投影的
    // 制作节点）按阶段走「待制作/已完成」，不被成果回填覆盖掉未审核的中间状态。
    const achieved = (node: any) => node?.data?.status === 'done' || (node?.data?.status === undefined && producedIds.has(node?.id));
    // 导入的图片是素材而不是待制作的镜头：状态标签区分开，免得被当成「还没生成」。
    const materialOf = (node: any) => Boolean(node?.data?.assetId) && !node?.metaonticSourceNode;
    // 流程阶段节点是插件投影出来的只读卡片：状态标签直接显示阶段进度，别的节点仍按「素材/已完成/待制作」。
    const nodeChip = (node: any) => {
      if (node?.data?.metaonticStage) {
        const state = String(node.data.metaonticStageState || '');
        return { text: STAGE_STATE_TEXT[state] || '待制作',
          className: state === 'done' ? 'mov-chip mov-chip-ok' : state === 'pending' ? 'mov-chip movc-badge' : `mov-chip movc-stage-${state === 'active' ? 'active' : 'review'}` };
      }
      if (materialOf(node)) return { text: '素材', className: 'mov-chip movc-badge' };
      return achieved(node) ? { text: '已完成', className: 'mov-chip mov-chip-ok' } : { text: '待制作', className: 'mov-chip movc-badge' };
    };
    const stageNodes: any[] = nodes.filter((node: any) => (node as any)?.data?.metaonticStage);
    // 当前阶段：优先正在进行的那个，其次是还没完成的第一个；虚线框跟着它走。
    const currentStage: any = stageNodes.find((node: any) => ['active', 'review', 'ready'].includes(String(node?.data?.metaonticStageState)))
      || stageNodes.find((node: any) => node?.data?.metaonticStageState !== 'done');
    const activeStageId = String(currentStage?.id || '');
    const stageFactsOf = (key: string) => (stageNodes.find((node: any) => String(node?.data?.metaonticStage) === key)?.data?.metaonticStageFacts) || {};
    // 脚本审核在画布上完成：确认过就不再回到「待审核」，也不被助手侧的事实回退。
    const scriptDrafted = Boolean(stageFactsOf('script').scriptDrafted);
    const scriptApproved = Boolean(stageFactsOf('script').scriptApproved);
    // 分镜与素材这两步的状态看画布内容：有分镜表或已切出制作段就算分镜就绪，有素材图才算素材备好。
    const stageStats = canvas ? canvasSegmentStats(canvas) : { total: 0, produced: 0, shots: 0, assets: 0 };
    const storyboardReady = stageStats.shots > 0 || stageStats.total > 0;
    const assetsReady = stageStats.assets > 0;
    // 就绪度体检：只看画布内容（缺成果的段、没接上的素材、断链、成片与段数对不上），不动费用与审核。
    const readiness = canvas ? canvasReadiness(canvas) : [];
    // 摘要只报非零的档位：0 处提示这种话不用写给用户看。
    const readinessErrors = readiness.filter((item: any) => item.severity === 'error').length;
    const readinessWarnings = readiness.filter((item: any) => item.severity === 'warning').length;
    const readinessNotes = readiness.length - readinessErrors - readinessWarnings;
    const readinessBrief = [readinessErrors ? `${readinessErrors} 处错误` : '', readinessWarnings ? `${readinessWarnings} 处提醒` : '',
      readinessNotes ? `${readinessNotes} 处提示` : ''].filter(Boolean).join('、');
    // 连拍要按视频制作节点排方案，一个都没有时它会直接报错，就别把用户指到那里去看清单。
    const chainable = canvasSegments(canvas).some((node: any) => node?.type === 'video');
    // 连线可能还指着一个已经删掉的节点（断链）：几何计算直接返回空，画布照常渲染，
    // 断链交给「画布体检」提示，不在这里静默改动画布。
    const geometry = (node: any) => (node ? { ...node, ...sizeOf(node), ...(positions[node.id] || {}) } : null);
    const at = (id: string) => geometry((canvas?.nodes || {})[id]);
    const kindOf = (id: string) => (canvas?.nodes || {})[id]?.type;
    const dialogNode = dialog ? (canvas?.nodes || {})[dialog.nodeId] : null;

    // 阶段卡之间画虚线箭头：一眼看成一条从需求到成片的流程，而不是一排说明卡。
    const stageOrder = stageNodes.map((raw: any) => geometry(raw)).sort((left: any, right: any) => left.x - right.x);
    const stageArrows = stageOrder.slice(1).map((to: any, index: number) => {
      const from = stageOrder[index];
      const x1 = from.x + from.w + 6, y1 = from.y + from.h / 2, x2 = to.x - 12, y2 = to.y + to.h / 2;
      const bend = Math.max(24, (x2 - x1) / 2);
      return { key: `stage-${to.id}`, d: `M ${x1} ${y1} C ${x1 + bend} ${y1}, ${x2 - bend} ${y2}, ${x2} ${y2}` };
    });

    // 连拍（批量生成）前的准备清单：参考 LibTV 画布的「开始批量生成前，请先完成」。
    const batchChecks = [
      { key: 'shots', ok: storyboardReady, label: '「确认镜头」', hint: '至少已切出 1 段制作内容' },
      { key: 'assets', ok: assetsReady || ['not_needed', 'text_only'].includes(String(stageFactsOf('requirement').choice || '')),
        label: '「准备素材」', hint: `为角色图 / 首帧 / 参考图准备形象图（当前 ${stageStats.assets} 张）` },
      { key: 'cost', ok: true, label: '「确认费用」', hint: '每段生成前仍要单独确认方案与费用' },
    ];

    // 连拍方案里真正要生成的是「还没有成果」的段：已有成果的段跳过，不提交也不重复计费。
    const chainPlanPending = chainDialog?.plan ? chainDialog.plan.segments.filter((segment: any) => !segment.skip).length : 0;

    /** 画布上确认脚本审核：把「已通过」写进阶段卡事实并重算五张卡，之后不再回退。
     *  这一步只记「用户核对过剧本与每段提示词」，不代替每段的方案与费用确认。 */
    const confirmScript = React.useCallback(async () => {
      if (!canvas) return;
      if (!stageFactsOf('script').scriptDrafted) { void openScript(); return; }
      // 审核通过后阶段卡①需求确认、②脚本审核都是已完成，③费用确认开始「进行中」。
      const { nodes: rewritten, changed } = rewriteStageNodes(canvas, { scriptApproved: true });
      try {
        for (const id of changed) await saveNode(id, { data: rewritten[id].data });
        await refresh();
        setNotice('脚本审核已通过：画布上的阶段卡②标为已完成。接着点「看估价」核对整条链路，或点「做这一段」逐段生成，每段仍要单独确认方案与费用。');
      } catch (e: any) { setError(e?.message || '脚本审核没记上，请重试。'); }
    }, [canvas, refresh, saveNode, stageFactsOf, openScript]);

    /** 阶段卡上的主行动：点一下就进这一步，费用与结果审核仍照旧单独确认，不替用户跳过。 */
    const runStageAction = (key: string) => {
      if (!canvas) return;
      // 需求卡：填需求 / 改需求都打开同一步「创建需求」，确认后就地更新需求节点。
      if (key === 'requirement') { void openRequirement(); return; }
      if (key === 'script') {
        if (!scriptDrafted) { void openScript(); return; }
        if (!scriptApproved) { void confirmScript(); return; }
        const scriptNode = (Object.values(canvas.nodes || {}) as any[]).find((node: any) => node?.type === 'script');
        if (scriptNode) { void openDialog(scriptNode); return; }
        void openScript();
        return;
      }
      // 分镜卡：还没分镜就回到写脚本那一步（预览分段 → 生成制作节点），有分镜表就打开分镜节点。
      if (key === 'storyboard') {
        if (!storyboardReady) { void openScript(); return; }
        const board = (Object.values(canvas.nodes || {}) as any[]).find((node: any) => node?.type === 'storyboard');
        if (board) { void openDialog(board); return; }
        setNotice('这份脚本按场景与句子切段，没有单独的分镜节点；每段提示词在对应的制作节点里。');
        return;
      }
      // 素材卡：对应 LibTV 的「准备资产」——需要角色图而画布上还没有素材图时，先建一个参考图节点并连到当前这段。
      if (key === 'assets') {
        const node = (canvas.nodes || {})[nextStep?.id];
        if (!node) {
          setNotice('制作段都已有成果；要补素材，点某个节点自己的「制作」，在窗口里用「导入图片素材」或「新建参考图节点」。');
          return;
        }
        if (!assetsReady) { void addReferenceImage(node.id); return; }
        void openDialog(node);
        return;
      }
      if (key === 'cost') { void openChain(); return; }
      if (key === 'film') { void mergeFilm(); return; }
      if (key === 'segments') {
        const node = (canvas.nodes || {})[nextStep?.id];
        if (node) { void openDialog(node); return; }
        setNotice('制作段都已有成果；要重做某一段，点那个节点自己的「制作」，重新核对方案并确认费用。');
      }
    };

    /** 阶段卡在画布上就是流程的一步：状态文字 + 这一步的主行动按钮。 */
    const stageBody = (node: any) => {
      const key = String(node?.data?.metaonticStage || '');
      const action = pendingStageAction(key, { ...(node?.data?.metaonticStageFacts || {}), storyboardReady, assetsReady }) || stageAction(key);
      return h('div', { key: 'stage', className: 'movc-body' }, [
        h('div', { key: 'state', className: 'movc-stage-text' }, textOf(node)),
        action ? h('button', { key: 'act', type: 'button', className: 'movc-stage-action', title: action.hint, 'data-stage-action': key,
          onPointerDown: (e: any) => e.stopPropagation(),
          onClick: (e: any) => { e.stopPropagation(); runStageAction(key); } }, action.label) : null,
      ]);
    };

    // 视频节点的上游媒体端口：默认按连线落在「参考图」，需要开头画面时在这里切成「首帧」。
    const mediaInbound = dialog?.type === 'video' && dialog.stage === 'form'
      ? edges.filter((edge: any) => edge.toNode === dialog.nodeId && ['ref', 'frame'].includes(edge.toPort) && ['image', 'video'].includes(kindOf(edge.fromNode))) : [];

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
      // 参考素材在制作窗口里就地补充：导入自己的图片，或新建一个图片节点去生成参考图。
      dialog.type === 'video' && dialog.stage === 'form' ? h('div', { key: 'refs-add', className: 'movc-row' }, [
        h('button', { key: 'import', type: 'button', className: 'mov-btn', disabled: importing, title: '把自己的图片写进画布数据目录，并接到本节点的「参考图」端口', onClick: () => importRef.current?.click() }, importing ? '导入中…' : '导入图片素材'),
        h('button', { key: 'image-node', type: 'button', className: 'mov-btn', title: '新建一个图片节点并接到本节点的「参考图」端口，在它自己的「制作」里生成参考图', onClick: () => void addReferenceImage(dialog.nodeId) }, '新建参考图节点'),
        h('input', { key: 'import-input', type: 'file', multiple: true, accept: 'image/png,image/jpeg,image/webp', ref: importRef, style: { display: 'none' },
          onChange: (e: any) => void importImages(e.target.files, dialog.nodeId) }),
      ]) : null,
      dialog.stage === 'plan' && dialog.plan?.operation === 'extend' ? h('label', { key: 'transition', className: 'movc-field' }, ['上一段结尾到本段的衔接描述', h('textarea', { value: dialog.form.transitionDescription, onChange: (e: any) => patchDialog({ form: { ...dialog.form, transitionDescription: e.target.value } }) })]) : null,
      mediaInbound.length ? h('div', { key: 'ports', className: 'movc-plan' }, [
        h('div', { key: 'hint' }, '上游素材端口：「首帧」用一张图开画，「参考图」按参考素材参与生成；两者不能同时使用。'),
        ...mediaInbound.map((edge: any) => h('div', { key: edge.id, className: 'movc-row' }, [
          h('span', { key: 'name' }, labelOf((canvas?.nodes || {})[edge.fromNode])),
          h('select', { key: 'port', value: edge.toPort, onChange: (e: any) => void setEdgePort(edge, e.target.value) },
            ['ref', 'frame'].map(port => h('option', { key: port, value: port }, port === 'frame' ? '首帧' : '参考图'))),
          h('button', { key: 'off', type: 'button', className: 'mov-btn movc-danger', onClick: () => void removeEdge(edge.id) }, '断开'),
        ])),
      ]) : null,
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

    return h('section', { className: ROOT_CLASS }, [
      h('style', { key: 'css' }, PAGE_CSS + CSS),
      h('div', { key: 'title', className: 'mov-section-title' }, '流程画布'),
      // 画布操作全部放最上面：先选画布、再操作当前画布，画布区只负责画本事。
      h('div', { key: 'top', className: 'movc-top' }, [
        h('div', { key: 'ops', className: 'movc-bar movc-ops' }, [
          canvas ? h('span', { key: 'name', className: 'movc-name' }, inline ? [
            h('input', { key: 'input', autoFocus: true, value: inline.value, 'aria-label': '画布名称',
              onChange: (e: any) => setInline({ value: e.target.value, error: '' }),
              onKeyDown: (e: any) => { if (e.key === 'Enter') { e.preventDefault(); void commitRename(); } if (e.key === 'Escape') { e.preventDefault(); setInline(null); } },
              onBlur: () => void commitRename() }),
          ] : [
            h('button', { key: 'text', type: 'button', className: 'movc-name-text', title: '双击画布名重命名', onDoubleClick: () => setInline({ value: canvas.name || '', error: '' }) }, canvas.name || canvas.projectId),
            h('button', { key: 'edit', type: 'button', className: 'movc-mini', title: '重命名', onClick: () => setInline({ value: canvas.name || '', error: '' }) }, '✎'),
          ]) : h('span', { key: 'name-empty', className: 'movc-name-empty' }, '未选择画布'),
          h('span', { key: 'sep-a', className: 'movc-sep' }),
          h('button', { key: 'new-canvas', type: 'button', className: 'mov-btn mov-btn-primary', onClick: () => setCreateDialog({ value: '', error: '' }) }, '新建画布…'),
          canvas ? h('span', { key: 'sep-b', className: 'movc-sep' }) : null,
          canvas ? h('button', { key: 'chain', type: 'button', className: 'mov-btn', title: '一次确认整条链路的方案与总费用，按顺序逐段生成；每段成果仍需你审核', onClick: () => void openChain() }, '连拍') : null,
          canvas ? h('button', { key: 'merge-film', type: 'button', className: 'mov-btn movc-run', disabled: Boolean(filmDialog?.busy) || !film?.total,
            title: film?.missing?.length ? `还有 ${film.missing.length} 段没有成果：${film.missing.join('、')}`
              : film?.total ? '把已生成的每段视频按连线顺序拼成一条成片，只需一次确认' : '画布上还没有视频节点',
            onClick: () => void mergeFilm() }, filmDialog?.busy ? '合成中…' : '合成成片') : null,
          canvas ? h('span', { key: 'sep-flow', className: 'movc-sep' }) : null,
          canvas ? h('button', { key: 'run-next', type: 'button', className: 'mov-btn movc-run', disabled: !nextStep,
            title: nextStep ? `当前读取节点内容并沿上游拼接提示词，生成前仍需确认方案与费用` : '流程里的制作节点都已有成果',
            onClick: () => { const node = (canvas?.nodes || {})[nextStep?.id]; if (node) void openDialog(node); } },
            nextStep ? `制作「${labelOf((canvas?.nodes || {})[nextStep.id])}」` : '流程已完成') : null,
          canvas && steps.length ? h('span', { key: 'flow-progress', className: 'movc-flow' }, `流程进度 ${doneSteps}/${steps.length}${nextStep ? '' : ' · 全部有成果'}`) : null,
          canvas ? h('span', { key: 'sep-c', className: 'movc-sep' }) : null,
          canvas ? h('button', { key: 'refresh', type: 'button', className: 'mov-btn', onClick: () => void refresh() }, '刷新') : null,
          canvas ? h('button', { key: 'tidy', type: 'button', className: 'mov-btn', title: '按连线重排节点、自动留白对齐并适配视图，不改内容与连线', onClick: () => void tidy() }, '美化布局') : null,
          canvas ? h('button', { key: 'reset', type: 'button', className: 'mov-btn', title: '把视图恢复到默认位置；带流程阶段条时按整张图适配', onClick: () => stageNodes.length ? fitStage(canvas, {}) : setView({ x: 30, y: 24, scale: 1 }) }, '重置视图') : null,
          canvas ? h('button', { key: 'export', type: 'button', className: 'mov-btn', onClick: () => exportCanvas() }, '导出 JSON') : null,
          canvas ? h('span', { key: 'sep-d', className: 'movc-sep' }) : null,
          canvas && selectedIds.length ? h('button', { key: 'del-selected', type: 'button', className: 'mov-btn movc-danger', onClick: () => void removeNodes(selectedIds) }, `删除选中（${selectedIds.length}）`) : null,
          canvas ? h('button', { key: 'del-canvas', type: 'button', className: 'mov-btn movc-danger', onClick: () => setConfirmDelete(true) }, '删除画布') : null,
        ]),
        h('div', { key: 'picker', className: 'movc-bar movc-picker' }, [
          h('span', { key: 'pick-label', className: 'movc-pick' }, '选择画布'),
          list.length ? h('div', { key: 'list', className: 'movc-list' }, list.map(item =>
            h('button', { key: item.projectId, type: 'button', className: 'movc-chip', 'data-active': String(canvas?.projectId === item.projectId), onClick: () => void load(item.projectId) },
              `${item.name} · ${item.nodeCount} 节点`))) : h('span', { key: 'no-canvas', className: 'movc-hint' }, '暂无画布，点「新建画布…」创建一份空白文档。'),
        ]),
      ]),
      error ? h('p', { key: 'error', className: 'movc-hint' }, error) : null,
      !list.length ? h('p', { key: 'empty', className: 'movc-hint' }, '还没有流程画布：点「新建画布…」可以立刻创建一份空白文档；如果在设置页打开「自动创建流程画布」（默认关闭），普通创作确认需求后也会在这里自动建立，脚本审核后同步分镜与制作段计划，生成成果自动回填。') : null,
      canvas ? h('div', { key: 'stage', ref: stageRef, className: 'movc-stage', 'data-panning': String(panning), 'data-connect': String(Boolean(connectFrom)),
        onClick: (event: any) => {
          if (connectFrom) { setConnectFrom(''); return; }
          if (marqueeDone.current) { marqueeDone.current = false; return; }
          if (!event?.shiftKey) setSelectedIds([]);
        },
        onWheel, onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp }, [
        h('div', { key: 'world', className: 'movc-world', style: { transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})` } }, [
          h('svg', { key: 'edges', style: { position: 'absolute', left: -4000, top: -4000, width: 8000, height: 8000, overflow: 'visible' } },
            h('g', { transform: 'translate(4000 4000)' }, [
              // 阶段卡之间的虚线箭头（只画出来，不落进画布连线，阶段卡不参与生成）。
              h('defs', { key: 'stage-arrow-def' }, h('marker', { id: 'movc-stage-arrow', viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 6, markerHeight: 6, orient: 'auto-start-reverse' },
                h('path', { key: 'head', className: 'movc-stage-arrowhead', d: 'M0,0 L10,5 L0,10 z' }))),
              ...edges.map((edge: any) => {
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
              }),
              ...stageArrows.map((arrow: any) => h('path', { key: arrow.key, className: 'movc-stage-edge', markerEnd: 'url(#movc-stage-arrow)', d: arrow.d })),
            ])),
          ...nodes.map(raw => {
            const node: any = geometry(raw);
            const media = ['image', 'video'].includes(node.type);
            const isStage = Boolean(node?.data?.metaonticStage);
            const chip = nodeChip(node);
            return h('div', { key: node.id, className: 'movc-node', 'data-selected': String(selectedIds.includes(node.id)),
              'data-current': String(nextStep?.id === node.id || node.id === activeStageId),
              ...(node?.data?.metaonticStage ? { 'data-stage-state': String(node.data.metaonticStageState || '') } : {}),
              style: { left: node.x, top: node.y, width: node.w, height: node.h },
              onPointerDown: (e: any) => startMove(e, node), onClick: (e: any) => {
                e.stopPropagation();
                if (connectFrom && connectFrom !== node.id) { void connectTo(node.id); return; }
                if (e.shiftKey) setSelectedIds(all => all.includes(node.id) ? all.filter(id => id !== node.id) : [...all, node.id]);
                else setSelectedIds([node.id]);
              } }, [
              h('div', { key: 'head', className: 'movc-node-head' }, [
                h('span', { key: 'label', className: 'movc-node-title' }, labelOf(node)),
                // 状态标签直接复用宿主的结果胶囊样式（.mov-chip / .mov-chip-ok）。
                h('span', { key: 'status', className: chip.className }, chip.text),
                isStage ? null : h('span', { key: 'actions', className: 'movc-actions' }, [
                  // 脚本审核就在剧本节点上完成：没审核时按钮用主色突出，审核过就只作状态。
                  node.type === 'script' ? h('button', { key: 'approve', type: 'button', className: `movc-mini${scriptApproved ? '' : ' movc-mini-primary'}`,
                    title: scriptApproved ? '剧本已核对通过；点开可继续修改内容' : '核对过剧本与每段提示词后点这里：脚本审核通过，阶段卡②标为已完成',
                    onPointerDown: (e: any) => e.stopPropagation(),
                    onClick: (e: any) => { e.stopPropagation(); if (scriptApproved) void openDialog(node); else void confirmScript(); } }, scriptApproved ? '已审核' : '确认脚本') : null,
                  h('button', { key: 'edit', type: 'button', className: 'movc-mini', onPointerDown: (e: any) => e.stopPropagation(), onClick: (e: any) => { e.stopPropagation(); void openDialog(node); } }, media ? '制作' : '编辑'),
                  h('button', { key: 'copy', type: 'button', className: 'movc-mini', onPointerDown: (e: any) => e.stopPropagation(), onClick: (e: any) => { e.stopPropagation(); void duplicateNode(node); } }, '复制'),
                  h('button', { key: 'link', type: 'button', className: 'movc-mini', onPointerDown: (e: any) => e.stopPropagation(), onClick: (e: any) => { e.stopPropagation(); setConnectFrom(connectFrom === node.id ? '' : node.id); setSelectedIds([node.id]); } }, connectFrom === node.id ? '取消连线' : '连线'),
                  h('button', { key: 'del', type: 'button', className: 'movc-mini movc-mini-danger', onPointerDown: (e: any) => e.stopPropagation(), onClick: (e: any) => { e.stopPropagation(); void removeNodes([node.id]); } }, '删除'),
                ]),
              ]),
              isStage ? stageBody(node) : nodeBody(node),
            ]);
          }),
        ]),
        marquee ? h('div', { key: 'marquee', className: 'movc-marquee', style: {
          left: Math.min(marquee.x1, marquee.x2), top: Math.min(marquee.y1, marquee.y2),
          width: Math.abs(marquee.x2 - marquee.x1), height: Math.abs(marquee.y2 - marquee.y1),
        } }) : null,
        // 画布本身就是生成流程：入口放在画布上，不放工具条的一排建节点按钮。
        canvas && nodes.length ? h('button', { key: 'flow-entry', type: 'button', className: 'movc-flow-entry', title: '跟对话一样两步走：先创建需求，再写脚本，然后铺开分镜与每段制作', onClick: (event: any) => { event.stopPropagation(); void openFlow(); } }, '＋ 创作流程') : null,
        canvas && !nodes.length ? h('div', { key: 'invite', className: 'movc-invite', role: 'button', tabIndex: 0,
          onClick: (event: any) => { event.stopPropagation(); void openFlow(); },
          onKeyDown: (event: any) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); void openFlow(); } } }, [
          h('strong', { key: 'h' }, '点击画布开始创作'),
          h('span', { key: 'p' }, '跟对话一样两步走：先创建需求，再写脚本，然后铺开整条生成流程——需求确认 → 剧本 → 分镜 → 每段制作 → 合成成片。生成前仍要逐段确认方案与费用。'),
        ]) : null,
      ]) : null,
      canvas?.film?.assetId ? h('div', { key: 'film-bar', className: 'movc-bar' }, [
        h('span', { key: 'label', className: 'movc-flow' }, `成片：${canvas.film.count} 段${canvas.film.seconds ? ` · 约 ${Math.round(canvas.film.seconds)} 秒` : ''} · ${new Date(canvas.film.updatedAt || Date.now()).toLocaleString()} · 已保存到画布数据目录`),
        h('button', { key: 'play', type: 'button', className: 'mov-btn', onClick: () => setFilmDialog({ busy: false, film: { ...canvas.film, url: mediaUrl(canvas.film.assetId) }, message: '' }) }, '播放成片'),
        h('a', { key: 'download', className: 'movc-link', href: mediaUrl(canvas.film.assetId), download: `${String(canvas.name || '成片')}.mp4` }, '下载成片'),
      ]) : null,
      canvas && steps.length ? h('p', { key: 'flow-hint', className: 'movc-hint' }, nextStep
        ? `流程：按连线顺序逐个制作，当前轮到「${nextStep.label}」（画布上虚线框标出）。点「制作「${nextStep.label}」」会读取节点内容与上游剧本/分镜拼出提示词，仍然要先核对制作方案、单独确认费用才会调用模型。`
        : `流程：${steps.length} 个制作节点都已有回填成果。要重做某一段，点该节点里的「制作」，重新核对方案并确认费用。`) : null,
      stageNodes.length ? h('p', { key: 'stage-hint', className: 'movc-hint' }, '画布上的七张「流程阶段」卡就是这条生成流程，箭头表示先后，步骤跟对话与专业画布一致：① 填需求（写想法/时长/画幅/清晰度，只建需求节点与阶段卡，不调用模型）→ ② 写脚本（没有脚本时）/确认脚本（写好看）/看剧本（通过后）→ ③ 看分镜（没有分镜时是「生成分镜」）→ ④ 准备素材（角色图/首帧/参考图）→ ⑤ 看估价 → ⑥ 做这一段 → ⑦ 合成成片。状态由插件同步，当前阶段用虚线框标出；卡上的按钮只是入口，生成前仍要逐段核对方案、单独确认费用，卡本身不参与生成。') : null,
      canvas && readiness.length ? h('p', { key: 'health', className: 'movc-hint' }, `画布体检：${readinessBrief}——${readiness[0].message}${chainable ? '点「连拍」可以看到完整清单与处理建议；' : ''}这里只提示画布内容问题，不涉及费用与审核。`) : null,
      canvas ? h('p', { key: 'hint', className: 'movc-hint' }, `点击画布空白处就会打开「创作流程」面板（有选中的节点时先取消选择）；拖动空白处平移、滚轮缩放，拖动节点移动（拖动已选中的任一节点可整组移动），Shift+拖空白框选（Shift+点节点可加选），点「连线」后再点目标节点连接（点连线可断开）；想一次确认整条链路再逐段生成就点「连拍」，参考素材在视频节点的制作窗口里用「导入图片素材」或「新建参考图节点」补，每段都出成果后点「合成成片」拼成一条可预览、可下载的成片。数据目录：${canvas.dataRoot}（素材与成果由本插件保存）`) : null,
      connectFrom ? h('p', { key: 'connect', className: 'movc-hint' }, '连线模式：点击目标节点完成连接，点空白处取消。') : null,
      confirmDelete ? h('div', { key: 'delete-modal', className: 'movc-modal', onPointerDown: (e: any) => e.stopPropagation(), onClick: (e: any) => { if (e.target === e.currentTarget) setConfirmDelete(false); } },
        h('div', { key: 'body', className: 'movc-modal-body', style: { width: 'min(420px, calc(100vw - 32px))' } }, [
          h('h4', { key: 'h' }, '删除画布'),
          h('p', { key: 'ask', className: 'movc-status' }, `确定删除「${canvas?.name || ''}」吗？画布上的节点与连线会一起删除，且不会自动重建；已生成的成果素材文件仍保留在插件数据目录。`),
          h('div', { key: 'ops', className: 'movc-bar' }, [
            h('button', { key: 'cancel', type: 'button', className: 'mov-btn', onClick: () => setConfirmDelete(false) }, '取消'),
            h('button', { key: 'ok', type: 'button', className: 'mov-btn', onClick: () => void deleteCanvas() }, '确认删除'),
          ]),
        ])) : null,
      filmDialog ? h('div', { key: 'film-modal', className: 'movc-modal', onPointerDown: (e: any) => e.stopPropagation(), onClick: (e: any) => { if (e.target === e.currentTarget && !filmDialog.busy) setFilmDialog(null); } },
        h('div', { key: 'body', className: 'movc-modal-body' }, [
          h('h4', { key: 'h' }, '合成成片'),
          filmDialog.busy ? h('p', { key: 'busy', className: 'movc-status' }, '正在按连线顺序读取每段成果并合并，长视频需要一点时间…') : null,
          filmDialog.film?.url ? h('video', { key: 'player', src: filmDialog.film.url, controls: true, preload: 'metadata', className: 'movc-media', style: { maxHeight: '46vh' } }) : null,
          filmDialog.film ? h('p', { key: 'info', className: 'movc-status' },
            `成片：${filmDialog.film.count} 段${filmDialog.film.seconds ? ` · 约 ${Math.round(filmDialog.film.seconds)} 秒` : ''}；文件已保存到画布数据目录，可直接预览或下载。`) : null,
          filmDialog.film?.segments?.length ? h('div', { key: 'segs', className: 'movc-plan' },
            filmDialog.film.segments.map((segment: any) => h('div', { key: `s${segment.index}` },
              `第${segment.index}段「${segment.label}」${segment.seconds ? `${segment.seconds}秒` : ''}`))) : null,
          filmDialog.message ? h('p', { key: 'msg', className: 'movc-status', 'data-error': 'true' }, filmDialog.message) : null,
          h('p', { key: 'note', className: 'movc-status' }, '合成只读取已经生成的成果，不会重新生成任何段落，也不产生新的模型费用。'),
          h('div', { key: 'ops', className: 'movc-bar' }, [
            h('button', { key: 'close', type: 'button', className: 'mov-btn', disabled: filmDialog.busy, onClick: () => setFilmDialog(null) }, '关闭'),
            filmDialog.film?.url ? h('a', { key: 'download', className: 'movc-link', href: filmDialog.film.url, download: `${String(canvas?.name || '成片')}.mp4` }, '下载成片') : null,
            !filmDialog.busy ? h('button', { key: 'again', type: 'button', className: 'mov-btn mov-btn-primary', onClick: () => void mergeFilm() }, '重新合成') : null,
          ]),
        ])) : null,
      chainDialog ? h('div', { key: 'chain-modal', className: 'movc-modal', onPointerDown: (e: any) => e.stopPropagation(), onClick: (e: any) => { if (e.target === e.currentTarget && !chainDialog.busy) { stopChainPolling(); setChainDialog(null); } } },
        h('div', { key: 'body', className: 'movc-modal-body' }, [
          h('h4', { key: 'h' }, '连拍：一次确认，逐段生成'),
          chainDialog.loading ? h('p', { key: 'loading', className: 'movc-status' }, '正在按画布上的视频节点排连拍方案…') : null,
          chainDialog.plan ? h('div', { key: 'plan', className: 'movc-plan' }, [
            h('div', { key: 'head' }, chainPlanPending
              ? `连拍方案：本次生成 ${chainPlanPending} 段${chainDialog.plan.segments.length > chainPlanPending ? `（另有 ${chainDialog.plan.segments.length - chainPlanPending} 段已有成果，跳过不重复生成）` : ''}${chainDialog.plan.cny !== null ? ` · 预估 ¥${(Math.round(chainDialog.plan.cny * 10000) / 10000).toFixed(4)}（基础公式，按渠道账单结算）` : ' · 按实际调用计费'}${chainDialog.plan.priceDate ? ` · 价目 ${chainDialog.plan.priceDate}` : ''}`
              : `连拍方案：整条链路 ${chainDialog.plan.segments.length} 段都已有成果，没有要生成的了`),
            ...chainDialog.plan.segments.map((segment: any) => h('div', { key: `s${segment.index}`, ...(segment.skip ? { 'data-skip': 'true' } : {}) },
              segment.skip
                ? `✓ 第${segment.index + 1}段「${segment.label}」${segment.seconds}秒：已有成果，本次跳过（不重复生成、不重复计费）`
                : `第${segment.index + 1}段「${segment.label}」${segment.seconds}秒 · ${segment.operation === 'extend' ? '续拍上一段' : '首段直出'} · ${segment.ratio} ${String(segment.resolution).toUpperCase()}：${String(segment.prompt).slice(0, 70)}${String(segment.prompt).length > 70 ? '…' : ''}`)),
            h('div', { key: 'note' }, '没有成果的段才会生成：接着已有成果的段落续拍，整条链路一段成果都没有时第 1 段直出；每段出成果后都会停下来等你审核，审核通过才继续下一段。已有成果的段不重复生成，也不重复计费。'),
          ]) : null,
          chainDialog.chain ? h('div', { key: 'chain', className: 'movc-plan' }, [
            h('div', { key: 'head' }, `${chainStatusText(chainDialog.chain)}`),
            chainDialog.chain.segments.map((segment: any) => h('div', { key: `c${segment.index}` },
              `${segment.index < chainDialog.chain.done ? '✓ ' : segment.index === chainDialog.chain.index ? '▶ ' : '· '}第${segment.index + 1}段「${segment.label}」${segment.seconds}秒${segment.skip ? '：已有成果，本次跳过' : segment.index < chainDialog.chain.done ? '：已有成果' : ''}`)),
            chainDialog.chain.message ? h('div', { key: 'msg' }, chainDialog.chain.message) : null,
          ]) : null,
          chainDialog.chain?.job?.media?.length && chainDialog.chain.state === 'review' ? h('div', { key: 'media' },
            chainDialog.chain.job.media.map((media: any, index: number) => h(media.kind === 'image' ? 'img' : 'video', {
              key: `m${index}`, src: media.url, alt: media.label || '', controls: media.kind === 'video', preload: 'metadata', className: 'movc-media', style: { maxHeight: '38vh' },
            }))) : null,
          chainDialog.chain && chainDialog.chain.state === 'review' ? h('p', { key: 'review-note', className: 'movc-status' }, '先看这一段：满意就「确认并继续下一段」，不满意可以停止连拍，已生成的成果都保留在画布上。') : null,
          chainDialog.error ? h('p', { key: 'err', className: 'movc-status', 'data-error': 'true' }, chainDialog.error) : null,
          chainDialog.plan && !chainDialog.chain && chainPlanPending ? h('div', { key: 'batch-checks', className: 'movc-plan' }, [
            h('div', { key: 'head' }, '开始批量生成前，请先完成：'),
            ...batchChecks.map((item: any) => h('div', { key: item.key, 'data-batch-check': item.key, 'data-ok': String(item.ok) },
              `${item.ok ? '✓ ' : '· '}${item.label}— ${item.hint}`)),
            h('div', { key: 'tail' }, '这几项都就绪后再开始连拍；每段出成果仍会停下来等你审核。'),
          ]) : null,
          chainDialog.plan && !chainDialog.chain && chainPlanPending ? h('div', { key: 'readiness', className: 'movc-plan' }, [
            h('div', { key: 'head' }, readiness.length ? `画布体检：还有 ${readiness.length} 处没准备齐` : '画布体检：没有发现问题'),
            ...readiness.slice(0, 6).map((item: any) => h('div', { key: `${item.code}-${item.nodeId}`,
              'data-readiness': item.code, 'data-severity': item.severity },
              `${item.severity === 'error' ? '✕ ' : '· '}${item.message}${item.suggestedAction}`)),
            readiness.length > 6 ? h('div', { key: 'more' }, `还有 ${readiness.length - 6} 处，先处理上面这些。`) : null,
            h('div', { key: 'tail' }, '体检只看画布内容：缺成果的段、没接到制作段的素材、断掉的连线，以及成片段数和现在的视频成果对不上。费用与审核仍按每段自己确认。'),
          ]) : null,
          chainDialog.plan && !chainDialog.chain && !chainPlanPending ? h('p', { key: 'nothing', className: 'movc-status' }, '整条链路的视频段都已有成果，不需要再连拍；要重做哪一段，就点那个节点自己的「制作」。') : null,
          chainDialog.plan && !chainDialog.chain && chainPlanPending ? h('div', { key: 'confirms' }, [
            h('label', { key: 'p', className: 'movc-check' }, [h('input', { type: 'checkbox', checked: chainDialog.confirm.plan === true, onChange: (e: any) => patchChainDialog({ confirm: { ...chainDialog.confirm, plan: e.target.checked } }) }), ' 我已核对整条链路的方案（每段提示词、时长、画幅与清晰度）']),
            h('label', { key: 'c', className: 'movc-check' }, [h('input', { type: 'checkbox', checked: chainDialog.confirm.cost === true, onChange: (e: any) => patchChainDialog({ confirm: { ...chainDialog.confirm, cost: e.target.checked } }) }), ' 我已确认整条链路的预估费用，按渠道账单结算']),
          ]) : null,
          h('div', { key: 'ops', className: 'movc-bar' }, [
            h('button', { key: 'close', type: 'button', className: 'mov-btn', disabled: chainDialog.busy, onClick: () => { stopChainPolling(); setChainDialog(null); } }, '关闭'),
            chainDialog.chain?.state === 'running' ? h('button', { key: 'stop', type: 'button', className: 'mov-btn movc-danger', disabled: chainDialog.busy, onClick: () => void stopChain() }, '停止连拍') : null,
            chainDialog.chain?.state === 'review' && chainDialog.chain.job?.sync?.status !== 'synced' ? h('button', { key: 'sync', type: 'button', className: 'mov-btn', disabled: chainDialog.busy, onClick: () => void syncChainSegment() }, '补回填画布') : null,
            chainDialog.chain?.state === 'review' ? h('button', { key: 'stop2', type: 'button', className: 'mov-btn movc-danger', disabled: chainDialog.busy, onClick: () => void stopChain() }, '停止连拍') : null,
            chainDialog.chain?.state === 'review' ? h('button', { key: 'next', type: 'button', className: 'mov-btn mov-btn-primary', disabled: chainDialog.busy, onClick: () => void advanceChain(true) }, '确认并继续下一段') : null,
            chainDialog.plan && !chainDialog.chain && chainPlanPending ? h('button', { key: 'start', type: 'button', className: 'mov-btn mov-btn-primary', disabled: chainDialog.busy || !(chainDialog.confirm.plan && chainDialog.confirm.cost), onClick: () => void startChain() }, '确认并开始连拍') : null,
            chainDialog.chain && ['done', 'stopped', 'stale'].includes(chainDialog.chain.state) && chainDialog.plan ? h('button', { key: 'again', type: 'button', className: 'mov-btn', disabled: chainDialog.busy, onClick: () => void openChain() }, '重新看方案') : null,
            chainDialog.chain && chainDialog.chain.state === 'done' ? h('button', { key: 'close2', type: 'button', className: 'mov-btn', disabled: chainDialog.busy, onClick: () => { stopChainPolling(); setChainDialog(null); } }, '完成') : null,
          ]),
        ])) : null,
      scriptDialog ? h('div', { key: 'script-modal', className: 'movc-modal', onPointerDown: (e: any) => e.stopPropagation(), onClick: (e: any) => { if (e.target === e.currentTarget && !scriptDialog.busy) setScriptDialog(null); } },
        h('div', { key: 'body', className: 'movc-modal-body' }, scriptDialog.step === 'requirement' ? [
          // 第一步：只创建需求（想法 + 规格），不写脚本、不调用模型、不产生视频费用。
          h('h4', { key: 'h' }, '创建需求'),
          h('p', { key: 'flow-note', className: 'movc-status' }, '跟对话一样先确认需求：写下想拍什么与规格，创建后阶段卡①标为已完成；再点一次画布或阶段卡②写脚本。这一步只建需求节点与阶段卡，不调用任何模型、不产生视频费用。'),
          h('label', { key: 'idea', className: 'movc-field' }, ['想拍什么', h('input', { value: scriptDialog.idea,
            placeholder: '一句话就够，例如：青旅天台的清晨，一个人拖着行李住进城市。',
            onChange: (e: any) => patchScriptDialog({ idea: e.target.value, error: '' }) })]),
          h('div', { key: 'spec', className: 'movc-row' }, [
            h('label', { key: 'total', className: 'movc-field' }, ['目标总时长（秒）', h('input', { type: 'number', min: 4, max: 3600, value: scriptDialog.totalSeconds, onChange: (e: any) => patchScriptDialog({ totalSeconds: e.target.value }) })]),
            h('label', { key: 'segment', className: 'movc-field' }, ['每段时长（秒）', h('input', { type: 'number', min: 4, max: scriptDialog.singleMax || 15, value: scriptDialog.segmentSeconds, onChange: (e: any) => patchScriptDialog({ segmentSeconds: e.target.value }) })]),
          ]),
          h('div', { key: 'spec2', className: 'movc-row' }, [
            h('label', { key: 'ratio', className: 'movc-field' }, ['画幅', h('select', { value: scriptDialog.ratio, onChange: (e: any) => patchScriptDialog({ ratio: e.target.value }) }, RATIOS.map(r => h('option', { key: r, value: r }, r)))]),
            h('label', { key: 'resolution', className: 'movc-field' }, ['清晰度', h('select', { value: scriptDialog.resolution, onChange: (e: any) => patchScriptDialog({ resolution: e.target.value }) }, RESOLUTIONS.map(r => h('option', { key: r, value: r }, r.toUpperCase())))]),
          ]),
          h('p', { key: 'note', className: 'movc-status' }, `当前模型单段上限 ${scriptDialog.singleMax || 15} 秒：目标时长不超过上限只建一段，超过才按每段时长排续拍段。需求确认后仍要逐段核对方案、单独确认费用。`),
          scriptDialog.error ? h('p', { key: 'err', className: 'movc-status', 'data-error': 'true' }, scriptDialog.error) : null,
          h('div', { key: 'ops', className: 'movc-bar' }, [
            h('button', { key: 'cancel', type: 'button', className: 'mov-btn', disabled: scriptDialog.busy, onClick: () => setScriptDialog(null) }, '取消'),
            h('button', { key: 'ok', type: 'button', className: 'mov-btn mov-btn-primary', disabled: scriptDialog.busy, onClick: () => void createRequirement() }, scriptDialog.busy ? '创建中…' : '创建需求'),
          ]),
        ] : [
          // 第二步：按第一步的需求写脚本，预览分段后再铺制作节点。
          h('h4', { key: 'h' }, '写脚本'),
          h('p', { key: 'flow-note', className: 'movc-status' }, '按第一步创建的需求写剧本与分镜：可以自己写，也可以让文本模型写。先「预览分段」看清会被拆成几段、每段多少秒与提示词，再「生成制作节点」；节点建好后仍要逐段核对方案、单独确认费用。'),
          h('div', { key: 'need', className: 'movc-plan' }, [
            h('div', { key: 'brief' }, `需求：${String(scriptDialog.idea || '').trim() || '（需求节点里没有写下想法，先补一句）'}`),
            h('div', { key: 'spec' }, `目标 ${scriptDialog.totalSeconds} 秒 · 每段 ${scriptDialog.segmentSeconds} 秒 · ${scriptDialog.ratio} · ${String(scriptDialog.resolution).toUpperCase()}${scriptDialog.textModel ? ` · 文本模型 ${scriptDialog.textModel}` : ''}`),
          ]),
          !String(scriptDialog.idea || '').trim() ? h('label', { key: 'idea', className: 'movc-field' }, ['想拍什么（让文本模型写脚本用）', h('input', { value: scriptDialog.idea,
            placeholder: '一句话就够，例如：青旅天台的清晨，一个人拖着行李住进城市。',
            onChange: (e: any) => patchScriptDialog({ idea: e.target.value, error: '' }) })]) : null,
          h('label', { key: 'text', className: 'movc-field' }, ['脚本内容（可以直接写，也可以让文本模型写）', h('textarea', { value: scriptDialog.text,
            placeholder: '写下要拍的内容。写成 Markdown 分镜表（表头含「镜号」「镜别」「视角」「运镜」「画面」列）时会按分镜切段，镜别、视角与运镜会一起带进该段提示词；否则按句子、段落按字数均分。写多少拆多少，不自动编内容。',
            onChange: (e: any) => patchScriptDialog({ text: e.target.value, error: '' }) })]),
          h('p', { key: 'note', className: 'movc-status' }, `「AI 写脚本」会按设置页的文本模型（${scriptDialog.textModel || '文本模型'}）把需求写成剧本与分镜表，单独按文本计费；要改时长、画幅或清晰度，先回上一步「改需求」。${scriptDialog.writing ? ` 文本模型正在写：已等待 ${Math.max(0, Math.round((clock - (scriptDialog.writingSince || clock)) / 1000))} 秒（一次通常 30–90 秒，可以先去别的地方看看）。` : ''}`),
          scriptDialog.plan ? h('div', { key: 'plan', className: 'movc-plan' }, [
            h('div', { key: 'head' }, `分段计划：${scriptDialog.plan.segments.length} 段 · 共 ${scriptDialog.plan.totalSeconds} 秒${scriptDialog.plan.shots?.length ? ` · 识别到 ${scriptDialog.plan.shots.length} 个分镜` : ''}`),
            ...scriptDialog.plan.segments.map((segment: any, index: number) => h('div', { key: `s${index}` }, `第${index + 1}段 ${segment.seconds} 秒（${segment.kind === 'extend' ? '续拍' : '首段'}）：${String(segment.prompt).slice(0, 90)}${String(segment.prompt).length > 90 ? '…' : ''}`)),
          ]) : null,
          scriptDialog.error ? h('p', { key: 'err', className: 'movc-status', 'data-error': 'true' }, scriptDialog.error) : null,
          h('div', { key: 'ops', className: 'movc-bar' }, [
            h('button', { key: 'cancel', type: 'button', className: 'mov-btn', disabled: scriptDialog.busy, onClick: () => setScriptDialog(null) }, '取消'),
            h('button', { key: 'write', type: 'button', className: 'mov-btn', disabled: scriptDialog.busy, title: '用设置页里配置的文本模型把需求写成剧本与分镜表，会调用一次文本模型', onClick: () => void writeWithModel() }, scriptDialog.writing ? '正在写脚本…' : 'AI 写脚本'),
            h('button', { key: 'preview', type: 'button', className: 'mov-btn', disabled: scriptDialog.busy, onClick: () => void previewScript() }, '预览分段'),
            h('button', { key: 'ok', type: 'button', className: 'mov-btn mov-btn-primary', disabled: scriptDialog.busy, onClick: () => void createFromScript() }, '生成制作节点'),
          ]),
        ])) : null,
      createDialog ? h('div', { key: 'create-modal', className: 'movc-modal', onPointerDown: (e: any) => e.stopPropagation(), onClick: (e: any) => { if (e.target === e.currentTarget) setCreateDialog(null); } },
        h('div', { key: 'body', className: 'movc-modal-body', style: { width: 'min(420px, calc(100vw - 32px))' } }, [
          h('h4', { key: 'h' }, '新建画布'),
          h('label', { key: 'name', className: 'movc-field' }, ['画布名称', h('input', {
            autoFocus: true, value: createDialog.value, placeholder: '画布名称',
            onChange: (e: any) => setCreateDialog({ ...createDialog, value: e.target.value, error: '' }),
            onKeyDown: (e: any) => { if (e.key === 'Enter') { e.preventDefault(); void submitCreate(); } if (e.key === 'Escape') { e.preventDefault(); setCreateDialog(null); } },
          })]),
          createDialog.error ? h('p', { key: 'err', className: 'movc-status', 'data-error': 'true' }, createDialog.error) : null,
          h('p', { key: 'note', className: 'movc-status' }, '新画布是一份空白文档，与自动创建的画布并存；名称不能为空，也不能和已有画布重名。'),
          h('div', { key: 'ops', className: 'movc-bar' }, [
            h('button', { key: 'cancel', type: 'button', className: 'mov-btn', onClick: () => setCreateDialog(null) }, '取消'),
            h('button', { key: 'ok', type: 'button', className: 'mov-btn mov-btn-primary', onClick: () => void submitCreate() }, '新建画布'),
          ]),
        ])) : null,
      selectedIds.length > 1 ? h('p', { key: 'multi', className: 'movc-hint' }, `已选中 ${selectedIds.length} 个节点：可整组拖动或删除。`) : null,
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
