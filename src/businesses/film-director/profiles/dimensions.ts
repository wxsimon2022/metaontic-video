/** 可组合的四维创作策略；不从用户自由文本风格推断类型。 */
type Dimension = 'genre' | 'format' | 'purpose' | 'style_profile';
type Entry = {label:string; rules:Partial<Record<string,string>>; criterion:string};
const entry=(label:string,creative:string,screenwriter:string,storyboard:string,criterion:string):Entry=>({label,rules:{creative,screenwriter,storyboard,reviewer:criterion},criterion});
const REGISTRY: Record<Dimension,Record<string,Entry>> = {
 genre:{
  comedy:entry('喜剧','寻找人物欲望与情境反差，不强制反转。','以铺垫、升级、行为笑点与回应推进。','为笑点兑现和反应留时间，不靠密集切镜。','笑点有铺垫且符合人物逻辑。'),
  drama:entry('剧情','建立目标、阻碍、选择与后果。','事件因果推动人物或关系变化。','呈现决定与后果，不用空镜代替行动。','人物选择与可见后果成立。'),
  documentary:entry('纪录','建立真实问题、观察对象与素材来源。','使用真实材料、采访问题或明确标注的戏剧化重现，不编造受访者原话。','区分拟拍摄方案、真实素材和重现镜头。','陈述有来源，VERIFIED_FACT/USER_PROVIDED/UNVERIFIED/DRAMATIZATION 分离。'),
  animation:entry('动画','明确世界规则、角色辨识与目标受众。','动作有视觉因果，遵守世界规则。','动作路径清楚，角色比例与空间规则稳定。','世界规则、角色和动作可读性一致。'),
  romance:entry('爱情','围绕具体关系变化与情感障碍提炼体验。','用互动、试探、回应推进关系，不靠告白口号。','通过距离、视线与回应呈现关系变化。','情感变化有具体互动与回应支撑。'),
  thriller:entry('悬疑惊悚','规划观众已知和未知信息及线索。','悬念有因果铺垫与回收，不依赖无原因反转。','控制视点与信息揭示，不能藏掉理解所需证据。','线索公平、因果成立且关键悬念得到处理。'),
 },
 format:{
  skit:entry('情景小品','集中在单一情境与核心互动。','减少支线，动作、对白和反应可在预算内完成。','少量必要机位保持互动可读。','单一情境完整，关键反应有时长。'),
  short_film:entry('短片','构建适合时长的完整体验。','每场有功能与状态变化。','镜头覆盖关键事件并控制节奏。','结构完整，场景推进有必要性。'),
  micro_drama:entry('微短剧','设计单集核心事件与连续人物关系。','记录关系变化和未解决线索，不重置角色。','关键冲突与回应清楚，不能用快切掩盖因果。','单集成立并与连续人物线一致。'),
  series:entry('连续作品','建立全片主线、单集功能与跨集状态。','维护伏笔、前情与人物状态，按章交付。','分章场镜分层规划，复查跨章边界。','单集进度和全片完成状态准确，线索可追踪。'),
  interview:entry('访谈','明确问题、对象与真实素材需求。','提供采访问题；未取得的回答不得当成真实原话。','安排采访、反应与相关证据画面，不虚构已拍素材。','采访来源真实，拟问与已回答内容区分。'),
  commercial:entry('广告片','围绕需求、可信利益与行动目标设计。','只使用有依据的产品主张与演示。','展示产品使用过程和证据，避免暗示未证实功效。','产品主张有依据，使用与行动目标清楚。'),
  vlog:entry('生活记录','寻找日常观察、细节与体验变化。','保留自然行动和环境反馈，不强加戏剧冲突。','观察性构图与自然节奏，避免无意义运镜。','日常细节有观察价值，节奏自然。'),
  music_video:entry('音乐影像','建立音乐与视觉母题的关联。','用动作和意象递进，不强塞对白或剧情。','按音乐段落规划节奏与视觉变化。','声画关联和意象递进明确。'),
 },
 purpose:{
  entertainment:entry('娱乐','明确观众的情绪收益。','保持人物与事件吸引力，避免空洞刺激。','保证看点可见且节奏可读。','观众体验有事件或画面支撑。'),
  promotion:entry('宣传','提炼地域或品牌辨识与记忆点。','用具体可核实细节代替口号。','展示可辨识地点、人物和生活细节。','辨识度与传播信息具体且可信。'),
  education:entry('科普教育','确定观众要理解的问题与边界。','按问题、证据、解释推进，事实不确定处标待核实。','用演示或对比解释信息，不只堆字幕。','知识准确，解释清楚，有证据与适用边界。'),
  sales:entry('销售转化','定义需求、证据与行动目标。','不编造性能、数据、认证或承诺。','让使用过程与利益证据可见。','卖点可信，行动清楚，无夸大主张。'),
 },
 style_profile:{
  rural_documentary:entry('乡村观察','从具体生活观察寻找细节，不刻板化农村。','语言自然，地域事实需来源。','自然光、现场声与可辨空间，不自动添加破败贫困。','生活细节可信，地域事实与观察边界清楚。'),
  minidv:entry('千禧 MiniDV','以生活片段与自然观察组织视觉母题。','对白小声自然，动作与停顿有生活感。','按需轻微手持、对焦搜索、低饱和原生色彩和颗粒，不掩盖关键动作。','DV 表现克制，人物动作与关键信息保持清楚。'),
  cinematic_realism:entry('写实电影','以具体事件承载表达。','行为和对白自然，不用抽象形容词代替剧情。','以光源、材质、空间和动作描述风格，不堆参数。','视觉细节真实并服务叙事。'),
  stylized_animation:entry('风格化动画','明确统一的造型和世界规则。','表演与动作符合设定。','统一比例、材质、色彩和动作物理规则。','造型风格与世界物理规则跨镜一致。'),
 },
};
export const DIMENSION_FIELDS = ['genre','format','purpose','style_profile','tone'] as const;
export function availableDimensions() {
 return Object.fromEntries(Object.entries(REGISTRY).map(([dim,items])=>[dim,Object.entries(items).map(([id,v])=>({id,label:v.label,revision:'1'}))]));
}
export function resolveDimensions(spec:any={}) {
 const profiles:any={};const warnings:string[]=[];
 if(spec.dimension_profile_revision!=null&&spec.dimension_profile_revision!=='1')throw Error('UNSUPPORTED_DIMENSION_PROFILE_REVISION');
 for(const dim of Object.keys(REGISTRY) as Dimension[]) {
  const id=spec[dim];if(id==null)continue;
  if(typeof id!=='string'||!id.trim())throw Error(`INVALID_PROFILE_DIMENSION:${dim}`);
  if(!Object.hasOwn(REGISTRY[dim],id)) {
   // 历史 genre 是自由文本，保留其元数据，不冒充已解析策略。
   if(dim==='genre'&&!spec.dimension_profile_revision){warnings.push('LEGACY_GENRE_UNRESOLVED');continue;}
   throw Error(`UNKNOWN_PROFILE_DIMENSION:${dim}`);
  }
  const selected=REGISTRY[dim][id];
  profiles[dim]={id,revision:'1',label:selected.label,criterion:selected.criterion};
 }
 const conflicts:string[]=[];
 const fact=profiles.genre?.id==='documentary'||profiles.format?.id==='interview'||spec.work_type==='DOCUMENTARY';
 if(fact&&spec.narrative_mode==='FICTION')conflicts.push('纪录或真实访谈不能将虚构材料标为真实事实；重现请明确标注并选择 MIXED。');
 if(profiles.style_profile?.id==='stylized_animation'&&profiles.genre?.id==='documentary')warnings.push('动画重现必须标 DRAMATIZATION，不能声称为真实拍摄。');
 return {status:conflicts.length?'PROFILE_CONFLICT':Object.keys(profiles).length?'RESOLVED':'UNSELECTED',revision:'1',profiles,tone:spec.tone||null,visual_style:spec.visual_style||null,warnings,conflicts,fact_provenance_required:fact,available_profiles:availableDimensions()};
}
export function assertDimensions(spec:any) {
 const resolved=resolveDimensions(spec);
 if(resolved.conflicts.length)throw Error('PROFILE_CONFLICT:'+resolved.conflicts.join('；'));
 return resolved;
}
export function hasContentProfile(spec:any) {
 const r=assertDimensions(spec);
 return !!spec?.work_type||['genre','format','purpose'].some(k=>r.profiles[k]);
}
export function dimensionInstructions(spec:any,role:string) {
 const r=resolveDimensions(spec);
 if(!Object.keys(r.profiles).length&&!r.conflicts.length)return '';
 const rules=Object.entries(r.profiles).map(([dim,p]:[string,any])=>{
  const own=REGISTRY[dim as Dimension][p.id].rules[role];
  const common=role==='director'?`按${p.label}策略组织任务与类型审核。`:role==='character'?'只细化批准角色的身份、服装、声音与可变状态。':role==='scene'?'只细化批准地点的空间、材质、光照与道具连续性。':role==='prompt-engineer'?'忠实转换已批准镜头的风格与动作，不新增剧情或台词。':'';
  return `${dim}=${p.id}（${p.label} · ${p.revision}）：${own||common}`;
 }).join('\n');
 return `\n【四维 Profile】${rules}\n情绪基调：${r.tone||'未指定'}；自由视觉风格：${r.visual_style||'未指定'}。未选维度保持未知，不从其他维度自动推断。用户约束与批准内容高于类型建议。\n${r.fact_provenance_required?'事实门禁：陈述标 VERIFIED_FACT/USER_PROVIDED/UNVERIFIED/DRAMATIZATION 并提供来源；未经核实的采访、事件和产品数据不能作为已核实事实。\n':''}${r.conflicts.length?'PROFILE_CONFLICT：'+r.conflicts.join('；')+' 暂停创作并交 Director 处理。\n':''}${role==='reviewer'?'最终报告增加 dimension_review，含 profile_revision="1"、checks 数组；逐一覆盖已选维度，记录 dimension、profile_id、status(PASS/CONCERN/NOT_EVALUATED)、evidence。CONCERN 关联 issues 中可定位建议或错误；NOT_EVALUATED 不可通过终审。\n':''}`;
}
export function validateDimensionReview(value:any,spec:any) {
 const r=assertDimensions(spec);const selected=Object.entries(r.profiles);
 if(!selected.length)return;
 const review=value.dimension_review;
 if(!review||review.profile_revision!=='1'||!Array.isArray(review.checks))throw Error('DIMENSION_REVIEW_REQUIRED');
 if(review.checks.length!==selected.length)throw Error('DIMENSION_REVIEW_COVERAGE');
 for(const [dim,p] of selected as [string,any][]) {
  const checks=review.checks.filter(c=>c.dimension===dim&&c.profile_id===p.id);
  if(checks.length!==1||!['PASS','CONCERN','NOT_EVALUATED'].includes(checks[0].status)||typeof checks[0].evidence!=='string'||!checks[0].evidence.trim())throw Error('DIMENSION_REVIEW_COVERAGE');
  const check=checks[0];
  if(check.status==='CONCERN'&&!value.issues?.some(i=>i.issue_id===check.issue_id))throw Error('DIMENSION_REVIEW_ISSUE_REQUIRED');
  if(check.status==='NOT_EVALUATED'&&['PASS','PASS_WITH_WARNINGS'].includes(value.review_status))throw Error('DIMENSION_REVIEW_NOT_EVALUATED');
 }
}
