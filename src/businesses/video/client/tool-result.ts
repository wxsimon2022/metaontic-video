/** 工具结果和运行进度分开：完成后只显示成果预览，不显示生成进度。
 *  脚本审核、费用试算这类只返回结构化数据的工具没有自定义卡片时，宿主会用默认卡片把返回 JSON 铺成代码块；
 *  这里给它们换成插件自己的摘要卡片：默认只列关键结论，原始返回折叠在下面，按普通正文换行显示，不铺代码块。 */

/** 需要摘要卡片的结构化工具。<key> 是工具名，值是卡片标题。 */
const SUMMARY_TOOLS: Record<string, string> = { video_project: '脚本审核', video_estimate: '费用试算' };
const ACTION_LABELS: Record<string, string> = { prepare: '准备项目', review: '脚本审核', review_segment: '分段结果审核', status: '读取项目状态' };
const STATUS_LABELS: Record<string, string> = { approved: '已通过', draft: '待修改', pending: '待确认', blocked: '未通过校验', running: '进行中' };
/** 画布同步结果的人话标签；`disabled` 是默认关闭自动投影的常态，不占用卡片一行。 */
const CANVAS_SYNC_LABELS: Record<string, string> = { synced: '已同步', pending: '待补传（用video_canvas补传，不重新生成）', unavailable: '暂不可用', external: '沿用所选画布' };

const textOf = (block: any) => (Array.isArray(block?.content) ? block.content : [])
  .filter(part => part?.type === 'text').map(part => String(part.text || '')).join('\n').trim();
const money = (value: any) => Number.isFinite(Number(value)) ? `¥${(Math.round(Number(value) * 10000) / 10000).toFixed(4)}` : '';
function parseJson(text: string) {
  const body = text.trim().replace(/^```[a-zA-Z]*\s*/, '').replace(/```$/, '').trim();
  try { const data = JSON.parse(body); return data && typeof data === 'object' ? data : null; } catch { return null; }
}

/** 纯函数：给定工具名与卡片数据，得出标题、状态、关键行与原始返回，便于直接断言。 */
export function toolSummary(toolName: string, block: any) {
  const title = SUMMARY_TOOLS[toolName];
  if (!title) return null;
  const raw = textOf(block);
  if (!block || !('kind' in block)) {
    const args = block?.args || {};
    const rows: string[][] = [];
    if (args.action) rows.push(['动作', ACTION_LABELS[String(args.action)] || String(args.action)]);
    if (args.duration) rows.push(['目标时长', `${Number(args.duration)} 秒`]);
    if (args.resolution) rows.push(['清晰度', String(args.resolution).toUpperCase()]);
    return { title, state: 'running', stateLabel: '进行中', rows, raw: '' };
  }
  if (block.isError) return { title, state: 'error', stateLabel: '未完成', rows: [] as string[][], raw };
  const data = parseJson(raw);
  if (!data) return { title, state: 'done', stateLabel: '已完成', rows: [] as string[][], raw };
  const rows: string[][] = [];
  const push = (label: string, value: any) => { if (value !== undefined && value !== null && String(value) !== '') rows.push([label, String(value)]); };
  if (toolName === 'video_estimate') {
    push('目标时长', data.duration ? `${data.duration} 秒` : '');
    push('画幅 / 清晰度', [data.ratio, data.resolution && String(data.resolution).toUpperCase()].filter(Boolean).join(' · '));
    push('火山官方方案', money(data.official?.cny));
    push('插件方案', money(data.plugin?.cny));
    push('价目日期', data.priceDate);
    return { title, state: 'ok', stateLabel: '已试算', rows, raw };
  }
  push('状态', STATUS_LABELS[String(data.status)] || data.status);
  push('项目', data.projectId);
  push('下一步', data.nextAction);
  push('说明', data.reason);
  const canvasSync = String(data.canvasProject?.status || '');
  if (canvasSync && canvasSync !== 'disabled') push('画布同步', CANVAS_SYNC_LABELS[canvasSync] || canvasSync);
  const state = data.status === 'approved' ? 'ok' : ['draft', 'blocked'].includes(String(data.status)) ? 'warn' : 'done';
  return { title, state, stateLabel: STATUS_LABELS[String(data.status)] || '已完成', rows, raw };
}

/** 摘要卡片的样式：沿用宿主的卡片与标签语言（描边、10px 圆角、结果胶囊）。 */
const SUMMARY_CSS = `
  .mov-summary { box-sizing: border-box; width: 100%; min-width: 0; margin: 6px 0; padding: 10px 12px; border: 1px solid var(--dsw-alias-border-l2,#dfe3eb); border-radius: 10px; color: inherit; }
  .mov-summary-head { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .mov-summary-title { font-size: 13px; font-weight: 600; }
  .mov-summary-rows { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 4px 10px; margin: 8px 0 0; font-size: 12.5px; }
  .mov-summary-key { color: var(--dsw-alias-label-caption,#737b8b); }
  .mov-summary-val { margin: 0; min-width: 0; overflow-wrap: anywhere; white-space: pre-wrap; }
  .mov-summary-raw { margin-top: 8px; font-size: 12px; }
  .mov-summary-raw > summary { color: var(--dsw-alias-label-caption,#737b8b); cursor: pointer; }
  .mov-summary-text { margin-top: 6px; color: var(--dsw-alias-label-caption,#737b8b); line-height: 1.6; white-space: pre-wrap; overflow-wrap: anywhere; }
`;

export function createToolResultView({ h, MediaPreview, VideoTaskProgress }: any) {
  /** 摘要卡片没有状态，直接算成节点返回，省一层组件。 */
  function summaryView(props: any) {
    const summary = toolSummary(props?.toolName, props?.block);
    if (!summary) return null;
    const chip = summary.state === 'ok' ? 'mov-chip mov-chip-ok' : summary.state === 'running' ? 'mov-chip movc-badge' : 'mov-chip mov-chip-bad';
    return h('div', { className: 'mov-summary', 'data-field': 'tool-summary' }, [
      h('style', { key: 'style' }, SUMMARY_CSS),
      h('div', { key: 'head', className: 'mov-summary-head' }, [
        h('span', { key: 'title', className: 'mov-summary-title' }, summary.title),
        h('span', { key: 'state', className: chip }, summary.stateLabel),
      ]),
      summary.rows.length ? h('dl', { key: 'rows', className: 'mov-summary-rows' }, summary.rows.flatMap(([key, value]) => [
        h('dt', { key: `${key}-key`, className: 'mov-summary-key' }, key),
        h('dd', { key: `${key}-value`, className: 'mov-summary-val' }, value),
      ])) : null,
      summary.raw ? h('details', { key: 'raw', className: 'mov-summary-raw' }, [
        h('summary', { key: 'label' }, '查看完整返回'),
        h('div', { key: 'text', className: 'mov-summary-text' }, summary.raw),
      ]) : null,
    ]);
  }
  function ToolResultView(props: any) {
    if (toolSummary(props?.toolName, props?.block)) return summaryView(props);
    if (props.block && 'kind' in props.block) return h(MediaPreview, props);
    if (!['video_generate', 'video_extend'].includes(props.toolName)) return null;
    return h(VideoTaskProgress, props);
  }
  return { ToolResultView };
}
