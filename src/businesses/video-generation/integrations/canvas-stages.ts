/** 创作流程阶段投影：把生成流程（需求确认 → 脚本审核 → 费用确认 → 逐段制作 → 合成成片）
 *  画成画布顶部一排状态节点，文案与状态跟着创作项目、画布内容与画布上的确认动作走。
 *  阶段节点本身不参与生成：不连主链路、没有输入端口，不会被当成提示词素材；卡上的按钮只是入口。
 *  这个模块服务端与浏览器共用，不引入 node:* 依赖。 */

/** 阶段卡的写入版本：升级后旧版本写的卡由插件重写一次，本版写过且被用户改过的仍然保留。 */
export const STAGE_REV = 2;

export const STAGE_KEYS = ['requirement', 'script', 'storyboard', 'assets', 'cost', 'segments', 'film'];
export const STAGE_LABELS: Record<string, string> = {
  requirement: '① 需求确认',
  script: '② 脚本审核',
  storyboard: '③ 分镜确认',
  assets: '④ 素材准备',
  cost: '⑤ 费用确认',
  segments: '⑥ 逐段制作',
  film: '⑦ 合成成片',
};
/** 与客户端 canvas-view.ts 的阶段状态文案保持一致。 */
export const STAGE_STATE_TEXT: Record<string, string> = { done: '已完成', active: '进行中', review: '待审核', ready: '待合成', pending: '未开始' };

export const STAGE_ACTIONS: Record<string, { label: string; hint: string }> = {
  requirement: { label: '填需求', hint: '写想拍什么、总时长、每段时长、画幅与清晰度，也可以让文本模型把想法写成剧本（文本按用量单独计费）；铺节点本身不产生视频费用' },
  script: { label: '看剧本', hint: '打开剧本节点核对或修改内容，分镜与分段计划随脚本一起铺开；这一步只改节点内容，不生成视频、不计费' },
  storyboard: { label: '看分镜', hint: '打开分镜节点核对每个镜头的画面、景别、视角与运镜；没识别到分镜表时按场景与句子切段，这一步只改内容、不生成视频、不计费' },
  assets: { label: '准备素材', hint: '逐段生成前把角色图、首帧或参考图准备好：可以导入自己的图，也可以在图片节点里让模型生成（图片单独计费并要审核）；真人照片要先转成非真人二维动画风格' },
  cost: { label: '看估价', hint: '列出每段提示词、时长与整条链路的预估合计，确认方案与费用后才开跑' },
  segments: { label: '做这一段', hint: '打开当前还没成果的制作节点，核对制作方案并单独确认费用后才会调用模型' },
  film: { label: '合成成片', hint: '把已有成果按连线顺序拼成一条成片，只读成果、不重新生成、不额外计费' },
};

/** 阶段卡上的主行动：卡片不只显示状态，点按钮就走这一步；费用与结果审核照旧单独确认。 */
export function stageAction(key: string) {
  return STAGE_ACTIONS[key] || null;
}

/** 还没写脚本的阶段卡：先按第一步创建的需求写剧本，写完再审核。 */
export const STAGE_DRAFT_ACTION: Record<string, { label: string; hint: string }> = {
  script: { label: '写脚本', hint: '按第一步创建的需求写剧本与分镜（可以让文本模型写，也可以自己写，文本按用量单独计费）；这一步只出剧本与分镜、不生成视频、不产生视频费用，写好后先核对每段提示词，再确认脚本' },
};

/** 脚本审核通过、还没有分镜的阶段卡：按脚本切分镜与每段提示词，跟 LibTV 的「确认镜头」对应。 */
export const STAGE_STORYBOARD_ACTION: Record<string, { label: string; hint: string }> = {
  storyboard: { label: '生成分镜', hint: '按已审核的脚本切分镜与每段提示词：写成 Markdown 分镜表就按镜号切段，否则按场景与句子切段；这一步只铺节点、不生成视频、不产生视频费用' },
};

/** 还没审核的脚本卡：这一步就在画布上完成，所以按钮换成「确认脚本」。 */
export const STAGE_REVIEW_ACTION: Record<string, { label: string; hint: string }> = {
  script: { label: '确认脚本', hint: '核对过剧本与每段提示词就点这里：脚本审核通过后阶段卡②标为已完成，接着看整条链路估价；费用仍逐段单独确认' },
};

/** 需求建好之后①卡的主行动改成「改需求」：点它回到第一步，需求节点就地更新，已铺开的脚本与制作段不动。 */
export const STAGE_EDIT_ACTION: Record<string, { label: string; hint: string }> = {
  requirement: { label: '改需求', hint: '需求已创建：要改想拍什么、总时长、每段时长、画幅或清晰度就点这里，改的是需求节点与阶段卡、不调用模型也不计费；已铺开的脚本与制作段不受影响，要顺着新规格重做就删除旧节点再走一遍' },
};

/** 阶段卡的主行动分步走，跟对话里的顺序一致：① 先创建需求；② 先写脚本 → 再确认审核 → 之后只看剧本；
 *  ③ 脚本审核通过、还没分镜时给「生成分镜」（对齐 LibTV 的「确认镜头」）。 */
export function pendingStageAction(key: string, facts: any) {
  if (key === 'requirement') return facts?.requirementSettled ? STAGE_EDIT_ACTION.requirement : null;
  if (key === 'storyboard') return facts?.storyboardReady ? null : STAGE_STORYBOARD_ACTION.storyboard;
  if (key !== 'script') return null;
  if (!facts?.scriptDrafted) return STAGE_DRAFT_ACTION.script;
  return facts?.scriptApproved !== true ? STAGE_REVIEW_ACTION.script : null;
}

export function stageNodeId(prefix: string, key: string) { return `${prefix}_stage_${key}`; }
/** 第一步「创建需求」的产物：一个普通文本节点，承载想法与规格；第二步生成脚本时读它当输入。 */
export const REQUIREMENT_MARK = 'metaonticRequirement';
export function requirementNodeData(brief: string, seconds: number, segmentSeconds: number, ratio: string, resolution: string, workType?:string) {
  const text = [`想拍什么：${brief}`, `目标总时长：${seconds} 秒`, `每段时长：${segmentSeconds} 秒`,
    `画幅：${ratio}`, `清晰度：${String(resolution).toUpperCase()}`].join('\n');
  return { label: '需求', text, status: 'done', [REQUIREMENT_MARK]: true,
    metaonticRequirementBrief: brief, metaonticRequirementSpec: { seconds, segmentSeconds, ratio, resolution, ...(workType?{work_type:workType}:{}) } };
}
/** 画布上已有的需求节点；第二步写脚本时用它当输入，不在对话里重复问一遍。 */
export function requirementNodeOf(doc: any): any {
  return Object.values(doc?.nodes || {}).find((node: any) => node?.data?.[REQUIREMENT_MARK]) || null;
}
/** 阶段卡的 id 前缀：需求节点是先建的那一步，从它反推前缀，写脚本时复用同一批卡，不另铺一套。 */
export function stagePrefixOf(doc: any) {
  const id = Object.keys(doc?.nodes || {}).find(key => /_stage_requirement$/.test(key));
  return id ? id.slice(0, id.length - '_stage_requirement'.length) : '';
}

/** 阶段条排在主链路之上，彼此不连线：文本节点没有输入端口，连线只会污染生成输入。 */
/** 阶段卡位置：横向一排、排在主链路上方；卡间留出 60px 让流程箭头看得清。 */
export function stageSpot(index: number) { return { x: 40 + index * 400, y: -340, w: 340, h: 180 }; }
/** 稳定的短哈希：浏览器与 Node 都能算，只用来判断阶段卡还是不是插件写的那份，不做安全用途。 */
export function stageSeal(label: any, text: any, state: any, facts: any) {
  const source = JSON.stringify([label, text, state, facts]);
  let hash = 0x811c9dc5;
  for (let i = 0; i < source.length; i++) { hash ^= source.charCodeAt(i); hash = Math.imul(hash, 0x01000193) >>> 0; }
  return hash.toString(16).padStart(8, '0');
}
/** 阶段节点统一用这套字段写入，便于判断「还是插件写的那份」。 */
export function sealedStageData(key: string, state: string, text: string, facts: any) {
  const label = STAGE_LABELS[key] || key;
  return { label, text, status: state === 'done' ? 'done' : 'idle', metaonticStage: key, metaonticStageState: state, metaonticStageRev: STAGE_REV,
    metaonticStageFacts: facts || {}, metaonticStageSeal: stageSeal(label, text, state, facts || {}) };
}
/** 本版插件写过、且用户没改过的阶段卡：内容与 seal 完全一致。 */
export function stageNodeOwned(node: any) {
  const data = node?.data;
  return Boolean(data?.metaonticStage) && Number(data.metaonticStageRev) === STAGE_REV
    && data.metaonticStageSeal === stageSeal(data.label, data.text, data.metaonticStageState, data.metaonticStageFacts || {});
}
/** 插件可以重写的阶段卡：本版写过且用户没改过，或者是更早版本写的（只作状态展示，升级时重写一次）。 */
export function stageNodeRewriteable(node: any) {
  if (!node?.data?.metaonticStage) return false;
  return stageNodeOwned(node) || Number(node.data.metaonticStageRev) !== STAGE_REV;
}

/** 素材节点的标记：参考图这类只喂给下游当素材的节点，产出的图算「资产」而不是要交付的镜头内容（对齐 LibTV 的资产与镜头之分）。 */
export const MATERIAL_MARK = 'metaonticMaterial';

/** 自动铺出的「画面」节点：一段一张首帧图，是这个镜头的前置画面（对齐 LibTV 的 剧本 → 分镜 → 画面 → 视频合成）。
 *  它自己要生成、也要跟着流程走，但不算一个独立的制作段。值指向它服务的那个视频节点。 */
export const FRAME_MARK = 'metaonticFrameOf';

/** 走流程的生成节点：还没成果的图片/视频节点（含自动铺出的画面节点）。
 *  素材节点（参考图）不在这里，它不占用「制作「…」」的推进顺序。 */
export function flowAuthors(doc: any) {
  return (Object.values(doc?.nodes || {}) as any[]).filter(node => ['image', 'video'].includes(node?.type)
    && !node?.metaonticSourceNode && !node?.data?.assetId && !node?.data?.[MATERIAL_MARK]);
}

/** 制作段：要交付的段。成果节点用 metaonticSourceNode 指回它生成的那一段；
 *  导入进来的素材（带 assetId）、素材节点（参考图）与画面节点都不算段，免得把前置准备混进「逐段制作」。 */
export function canvasSegments(doc: any) {
  return flowAuthors(doc).filter(node => !node?.data?.[FRAME_MARK]);
}

/** 素材图：导入的图，以及图片节点/素材节点产出的图，都算「准备资产」这一步的素材。 */
export function canvasAssets(doc: any) {
  return (Object.values(doc?.nodes || {}) as any[]).filter(node => node?.type === 'image'
    && Boolean(node?.data?.assetId || node?.metaonticSourceNode));
}

/** 素材图服务哪几段：优先用它自己的 metaonticSegmentOf，否则按连线推——素材图接到哪一段就服务哪一段，
 *  素材节点产出的图顺着它的来源节点找接到的段。对齐 LibTV 把素材反绑到镜头（media.shotIds）的做法。 */
export function canvasAssetLinks(doc: any) {
  const edges = Array.isArray(doc?.edges) ? doc.edges : [];
  const segments = new Set(canvasSegments(doc).map((node: any) => String(node.id)));
  // 从某个节点出发，它喂给了哪几个制作段。
  const feeds = (id: string) => [...new Set(edges
    .filter((edge: any) => String(edge?.fromNode || '') === id && segments.has(String(edge?.toNode || '')))
    .map((edge: any) => String(edge.toNode)))];
  return canvasAssets(doc).map((node: any) => {
    const explicit = String(node?.data?.metaonticSegmentOf || '');
    const owner = String(node?.metaonticSourceNode || '');
    const serving = segments.has(explicit) ? [explicit] : feeds(owner || String(node.id));
    return { nodeId: String(node.id), label: String(node?.data?.label || '素材图'), segments: serving };
  });
}

/** 画布内容侧的制作进度：制作段（图片/视频）与它们产出的成果节点，成片看画布自己的 film 记录。
 *  助手流程是一张制作节点累积多段成果，画布内手作是一段一个节点，两种都按「成果数」计已完成段数。 */
export function canvasSegmentStats(doc: any) {
  const nodes = Object.values(doc?.nodes || {}) as any[];
  const authors = new Set(canvasSegments(doc).map((node: any) => node.id));
  const produced = nodes.filter(node => authors.has(node?.metaonticSourceNode) && (node?.data?.assetId || node?.data?.metaonticVideoUrl)).length;
  // 分镜数与素材图数：分镜是「确认镜头」这一步的产物，素材是角色图/首帧/参考图这类图片（对齐 LibTV 的「准备资产」）。
  const shots = nodes.filter(node => node?.type === 'storyboard').reduce((sum, node) => sum + (Array.isArray(node?.data?.shots) ? node.data.shots.length : 0), 0);
  const links = canvasAssetLinks(doc);
  return { total: authors.size, produced, shots, assets: links.length,
    assetsBound: links.filter(link => link.segments.length).length, assetsOrphan: links.filter(link => !link.segments.length).length,
    filmReady: Boolean(doc?.film?.assetId), filmCount: Number(doc?.film?.count || 0) };
}

/** 就绪度体检：对齐 LibTV 画布的 issues——把画布上还没准备齐的地方列出来，只读不改画布。
 *  费用与审核不在这里判断，仍由每段自己的方案与费用确认把关。 */
export function canvasReadiness(doc: any) {
  const nodes = Object.values(doc?.nodes || {}) as any[];
  const edges = Array.isArray(doc?.edges) ? doc.edges : [];
  const ids = new Set(nodes.map((node: any) => String(node.id)));
  const stats = canvasSegmentStats(doc);
  const issues: any[] = [];
  // 引用来校：连线两头的节点都还在，跟 LibTV 用 issues 校验引用一致。
  for (const edge of edges) {
    if (ids.has(String(edge?.fromNode || '')) && ids.has(String(edge?.toNode || ''))) continue;
    issues.push({ code: 'DANGLING_EDGE', severity: 'error', scope: 'edge', nodeId: String(edge?.id || ''),
      message: '有一条连线指向已被删除的节点。', suggestedAction: '选中那条线断开，或重新连到还在的节点上。' });
  }
  for (const node of canvasSegments(doc)) {
    const done = nodes.some((item: any) => item?.metaonticSourceNode === node.id && (item?.data?.assetId || item?.data?.metaonticVideoUrl));
    if (done) continue;
    issues.push({ code: 'SEGMENT_MISSING_OUTPUT', severity: 'warning', scope: 'segment', nodeId: String(node.id),
      message: `制作段「${String(node?.data?.label || '未命名')}」还没有成果。`, suggestedAction: '点这个节点的「制作」，核对方案并确认费用后生成。' });
  }
  // 画面节点是新流程的前置：还没出图时下游视频节点一定会报「参考端口连的上游节点还没有生成好的图片」，
  // 提前在这里列出来，让用户先出图再做这一段。
  const hasResult = (id: string) => nodes.some((item: any) => String(item?.metaonticSourceNode || '') === id
    && (item?.data?.assetId || item?.data?.metaonticVideoUrl));
  for (const node of flowAuthors(doc)) {
    if (!node?.data?.[FRAME_MARK] || hasResult(String(node.id))) continue;
    issues.push({ code: 'FRAME_MISSING_IMAGE', severity: 'warning', scope: 'frame', nodeId: String(node.id),
      message: `画面「${String(node?.data?.label || '本段画面')}」还没有出图。`,
      suggestedAction: '先点这个画面节点的「制作」出一张图；出图后它会作为这一段的首帧接给后面的视频节点，图片按用量单独计费并要审核。' });
  }
  for (const link of canvasAssetLinks(doc)) {
    if (link.segments.length) continue;
    issues.push({ code: 'ORPHAN_ASSET', severity: 'info', scope: 'asset', nodeId: link.nodeId,
      message: `素材图「${link.label}」还没接到任何制作段。`, suggestedAction: '把它连到某个制作节点的「参考图」或「首帧」端口，不用的素材可以删掉。' });
  }
  // 成果的来源节点已经不在（典型是整段被删）：这种视频成果既不算进制作段，也进不了成片，单独说出来，
  // 免得用户以为它还留在流程里。图片成果由上面的 ORPHAN_ASSET 覆盖，不重复报。
  for (const node of nodes) {
    const owner = String(node?.metaonticSourceNode || '');
    if (!owner || ids.has(owner) || node?.type !== 'video') continue;
    if (!(node?.data?.assetId || node?.data?.metaonticVideoUrl)) continue;
    issues.push({ code: 'ORPHAN_RESULT', severity: 'info', scope: 'media', nodeId: String(node.id),
      message: `成果「${String(node?.data?.label || '视频成果')}」对应的制作段已被删除。`,
      suggestedAction: '它不参与制作段计数，也不会进入成片；要重做先按流程铺出制作段，成果文件仍保留在画布数据目录。' });
  }
  // 成片与画布内容对账：只比视频段，图片素材不参与合成。
  const videoSegments = canvasSegments(doc).filter(node => node?.type === 'video');
  const videoDone = videoSegments.filter(node => nodes.some((item: any) => item?.metaonticSourceNode === node.id
    && (item?.data?.assetId || item?.data?.metaonticVideoUrl))).length;
  // 老文档里的成片记录可能没有段数；没有可比的数字就不硬报「0 段」，免得给出一条错的账。
  const filmCount = Number(doc?.film?.count);
  if (stats.filmReady && Number.isFinite(filmCount) && filmCount !== videoDone) {
    issues.push({ code: 'FILM_STALE', severity: 'warning', scope: 'film', nodeId: '',
      message: `已合成的成片是 ${filmCount} 段，画布上现在的视频成果有 ${videoDone} 段。`,
      // 建议按「画布上还有没有视频制作段」分岔：一段都不剩时合并没有任何输入，会直接报错，
      // 也就不能再劝用户「每段都出成果后重新合成」。
      suggestedAction: videoSegments.length ? '每段都出成果后重新点「合成成片」，成片会按当前连线顺序重拼。'
        : '画布上已经没有视频制作段了：要重做先按流程铺出制作段；已合成的成片文件仍保留在画布数据目录。' });
  }
  return issues;
}

/** 角色图路线的机器码写成用户看得懂的说法。 */
const CHOICE_TEXT: Record<string, string> = { not_needed: '不需要角色图', provided_images: '使用已有角色图',
  generate_first: '先生成角色图再制作', text_only: '纯文本生成' };

/** 七个阶段的状态与文案：facts 来自创作项目，stats 来自画布内容，两者任一变化都重算。
 *  流程顺序对齐 LibTV 画布：需求 → 脚本 → 分镜（确认镜头）→ 素材（准备资产）→ 费用 → 逐段制作 → 合成。 */
export function stageSummary(facts: any = {}, stats: any = {}) {
  const duration = Number.isFinite(Number(facts.duration)) && facts.duration !== null && facts.duration !== undefined ? Number(facts.duration) : null;
  const produced = Number(stats.produced || 0), total = Math.max(Number(facts.segmentTotal || 0), Number(stats.total || 0));
  const shots = Number(stats.shots || 0), assets = Number(stats.assets || 0);
  const choice = CHOICE_TEXT[facts.choice] || facts.choice || '待确认';
  const requirementText = [`目标时长：${duration === null ? '待确认' : `${duration} 秒`}`,
    `画幅：${facts.ratio || '待确认'}`, `清晰度：${String(facts.resolution || '待确认').toUpperCase()}`,
    `角色图路线：${choice}`].join('\n');
  const scriptText = [`剧本：${facts.scriptDrafted || facts.scriptApproved ? '已同步' : '未开始'}`,
    `审核：${facts.scriptApproved ? '已通过' : facts.scriptDrafted ? '等待用户审核' : '未开始'}`].join('\n');
  const storyboardText = shots > 0 ? [`分镜：${shots} 个镜头`, `每段提示词见制作节点`].join('\n')
    : total > 0 ? [`分镜：按场景与句子切段，共 ${total} 段`, `每段提示词见制作节点`].join('\n')
    : '还没有分镜：先写脚本并确认审核，再按分镜表或句子切段。';
  const bound = Number.isFinite(Number(stats.assetsBound)) ? Number(stats.assetsBound) : assets;
  const assetsText = [`角色图路线：${choice}`,
    `素材图：${assets} 张（角色图 / 首帧 / 参考图）${assets > bound ? `，其中 ${assets - bound} 张还没接到制作段` : ''}`].join('\n');
  const costText = [`制作方案：${facts.specApproved ? '已审核' : '未产出'}`,
    `费用：${produced > 0 ? '已确认（已有生成记录）' : '生成前仍要单独确认'}`].join('\n');
  const segmentsText = total > 0
    ? [`制作段：${total} 段`, `已完成：${Math.min(produced, total)} 段`].join('\n')
    : '暂无制作段：先在画布上写脚本、确认脚本审核与制作方案。';
  const filmText = stats.filmReady ? `已合成成片（${Number(stats.filmCount || 0)} 段）`
    : total > 0 && produced >= total ? '每段都有成果，可以点「合成成片」' : '等待每段都产出成果';
  const needsAssets = !['not_needed', 'text_only'].includes(String(facts.choice || ''));
  const state: Record<string, { state: string; text: string }> = {
    requirement: { state: facts.requirementSettled ? 'done' : 'active', text: requirementText },
    script: { state: facts.scriptApproved ? 'done' : facts.scriptDrafted ? 'review' : 'pending', text: scriptText },
    storyboard: { state: shots > 0 || total > 0 ? 'done' : facts.scriptApproved ? 'active' : 'pending', text: storyboardText },
    assets: { state: !needsAssets || assets > 0 ? 'done' : facts.requirementSettled ? 'active' : 'pending', text: assetsText },
    cost: { state: produced > 0 ? 'done' : facts.specApproved ? 'active' : 'pending', text: costText },
    segments: { state: total > 0 && produced >= total ? 'done' : produced > 0 || total > 0 ? 'active' : 'pending', text: segmentsText },
    film: { state: stats.filmReady ? 'done' : total > 0 && produced >= total ? 'ready' : 'pending', text: filmText },
  };
  return STAGE_KEYS.map(key => ({ key, ...state[key] }));
}

/** facts 只留能证明阶段进度的进度事实，不写密钥、路径等无关字段。 */
export function stageFacts(project: any, specification: any, drafted: boolean, segmentTotal: number) {
  const duration = Number(project?.duration);
  return {
    requirementSettled: Boolean(project?.subjectType) && Number.isFinite(duration),
    duration: Number.isFinite(duration) ? duration : null,
    choice: project?.choice || '',
    ratio: specification?.ratio || '',
    resolution: specification?.resolution || '',
    scriptDrafted: Boolean(drafted),
    scriptApproved: Boolean(project?.approved),
    specApproved: Boolean(specification),
    segmentTotal: Number(segmentTotal || 0),
  };
}

/** 按这份补充事实重算画布上的阶段卡：只改写插件自己写过的卡（用户改过内容的原样保留），
 *  patch 为空即「按现有事实重算」，画布上的确认动作（如脚本审核）就是往这里合并事实。 */
export function rewriteStageNodes(doc: any, patch: any = {}) {
  const nodes: any = { ...(doc?.nodes || {}) };
  const ids = Object.keys(nodes).filter(id => nodes[id]?.data?.metaonticStage);
  if (!ids.length) return { nodes, changed: [] };
  const stats = canvasSegmentStats({ ...doc, nodes });
  const changed: string[] = [];
  for (const id of ids) {
    const node = nodes[id];
    if (!stageNodeRewriteable(node) || !node.data.metaonticStageFacts) continue;
    const facts = { ...(node.data.metaonticStageFacts || {}), ...patch };
    const key = String(node.data.metaonticStage);
    const found = stageSummary(facts, stats).find(stage => stage.key === key);
    if (!found) continue;
    const data = sealedStageData(key, found.state, found.text, facts);
    if (JSON.stringify(data) === JSON.stringify(node.data)) continue;
    nodes[id] = { ...node, data };
    changed.push(id);
  }
  return { nodes, changed };
}

/** 回填或合成成片之后按画布内容重算阶段条：事实不变，只让状态跟上画布内容。 */
export function refreshStageNodes(doc: any) {
  return rewriteStageNodes(doc, {});
}

/** 助手侧同步时用的合并口径：用户在画布上确认过的脚本审核保持通过，不被助手侧还没审核的事实回退。 */
export function preserveCanvasConfirmations(prev: any, next: any) {
  return prev?.scriptApproved === true && next?.scriptApproved !== true ? { ...next, scriptApproved: true } : next;
}
