/** 审批展示与机器数据分开；不截断关键内容，不改变批准绑定的版本。 */
const LABELS:Record<string,string>={
 target_model:'生成模型',
 capability_warnings:'能力限制与待验证项',
 story_assessment:'叙事质量分析',
 narrative_coherence:'叙事连贯性',
 causal_chain:'因果关系',
 character_agency:'人物主动性',
 dialogue_quality:'对白表现',
 visual_specificity:'画面具体程度',
 ending_payoff:'结尾回收',
 score:'评分',
 id:'编号',
 screenplay:'剧本正文',
 type_review:'类型专项审核',
 checks:'核对项目',
 criterion_id:'核对项编号',
 work_type:'作品类型',
 profile_revision:'配置修订',
 review_stage:'审核阶段',
 review_id:'审核编号',
 issue_id:'问题编号',
 identity_lock:'身份一致性',
 spatial_anchors:'空间锚点',
 materials:'材质',
 spatial_layout:'空间布局',
 state_id:'状态编号',
 voice:'声音',
 role:'角色',
 relationship:'人物关系',
 relationships:'人物关系',
 age:'年龄',
 gender:'性别',
 personality:'性格',
 motivation:'动机',
 screen_presence:'出场特点',
 shot_size:'景别',
 camera_angle:'机位角度',
 lens:'镜头焦段',
 movement:'运动',
 composition:'构图',
 environment:'环境',
 ambient_sound:'环境声',
 music:'音乐',
 negative_prompt:'避免出现的内容',
 continuity:'连续性说明',
 character_state:'人物状态',
 prop_state:'道具状态',
 title_options:'备选标题',
 premise:'核心创意',
 logline:'一句话故事',
 theme:'核心表达',
 audience_insight:'观众洞察',
 audience_experience:'观众体验',
 genre:'题材',
 format:'作品形式',
 purpose:'创作目的',
 tone:'情绪基调',
 hook:'核心看点',
 central_conflict_or_question:'核心冲突或问题',
 visual_motifs:'视觉母题',
 sound_motifs:'声音母题',
 structure:'故事结构',
 narrative_beats:'情节推进',
 must_preserve:'必须保留',
 assumptions:'创作假设',
 research_needed:'待核实资料',
 facts_to_verify:'待核实事实',
 feasibility_risks:'制作风险',
 risks:'风险',
 approval_questions:'待确认事项',
 recommended_direction:'推荐方向',
 visual_details:'可视化细节',
 visual_evidence:'画面依据',
 visual_direction:'视觉方向',
 sound_direction:'声音方向',
 approval_summary:'审批要点',
 type_details:'类型创作要点',
 characters_or_subjects:'人物或观察对象',
 characters:'人物',
 chapters:'章节',
 scenes:'场次',
 dialogue:'对白',
 synopsis:'故事梗概',
 narrative_arc:'叙事推进',
 character_arcs:'人物变化',
 timeline_summary:'时间预算',
 continuity_state:'连续性状态',
 unresolved_threads:'未解决线索',
 research_flags:'待核实事项',
 self_review:'自检',
 title:'标题',
 name:'名称',
 objective:'目标',
 action_or_observation:'行动或观察',
 payoff:'落点',
 beats:'事件节拍',
 emotion:'情绪',
 transition_logic:'衔接逻辑',
 duration_ms:'时长',
 detail:'细节',
 narrative_function:'叙事作用',
 section_id:'段落',
 scene_id:'场次编号',
 chapter_id:'章节编号',
 character_id:'人物编号',
 speaker_id:'说话人',
 exact_text:'台词',
 description:'内容',
 evidence:'依据',
 character_goal:'人物目标',
 choice_and_consequence:'选择与后果',
 causal_progression:'因果推进',
 character_change:'人物变化',
 audience:'目标观众',
 hard_constraints_check:'硬约束核对',
 factual_status:'事实状态',
 change_requests:'变更请求',
 continuity_notes:'连续性说明',
 visual_anchors:'外貌锚点',
 scene_ids:'场次引用',
 state_change:'场景变化',
 estimated_duration_ms:'预计时长',
 target_duration_ms:'目标时长',
 location_hint:'地点',
 dramatic_purpose:'场景目的',
 props_needed:'所需道具',
 dialogue_exact:'准确对白',
 action:'动作',
 narration:'旁白',
 beat_id:'节拍编号',
 dialogue_id:'对白编号',
 emotion_landing:'情绪落点',
 memory_point:'观众记忆点',
 core_attraction:'核心看点',
 conflict:'人物冲突',
 plot_progression:'情节推进',
 reversal_or_emotional_landing:'转折或情绪落点',
 visualizable_details:'可视化细节',
 audience_memory_point:'观众记忆点',
 comic_premise:'喜剧前提',
 setup_payoff:'铺垫与回收',
 reaction_budget:'反应与停顿',
 experience_line:'体验主线',
 detail_discovery:'细节发现',
 observation_progression:'观察推进',
 sensory_rhythm:'感官节奏',
 central_question:'核心问题',
 evidence_plan:'取证计划',
 evidence_sources:'论据与来源',
 fact_fiction_boundary:'事实与重现边界',
 user_need:'用户需求',
 supported_benefit:'产品价值依据',
 claims_and_evidence:'卖点与依据',
 usage_and_action:'使用过程与行动引导',
 recognizable_identity:'辨识特征',
 emotional_anchor:'情绪落点',
 distinctive_details:'特色细节',
 identity_progression:'主题呈现',
 scene_goal:'场景目标',
 key_actions:'关键行动',
 entry_state:'开场状态',
 exit_state:'结束状态',
 location:'地点',
 time_of_day:'时间',
 locations:'地点档案',
 scene_states:'场景状态',
 props:'道具',
 costumes:'服装',
 voice_profile:'声音特点',
 state_timeline:'状态变化',
 continuity_rules:'连续性要求',
 appearance_anchors:'外貌特征',
 character_ids:'出场人物',
 prop_ids:'使用道具',
 costume_ids:'服装引用',
 location_id:'地点编号',
 scene_state_id:'场景状态编号',
 prop_id:'道具编号',
 costume_id:'服装编号',
 shots:'镜头安排',
 shot_id:'镜头编号',
 prompts:'生成提示词',
 prompt:'提示词正文',
 generation_mode:'生成方式',
 dialogue_refs:'对白引用',
 dialogue_ref:'对白引用',
 start_ms:'开始时间',
 end_ms:'结束时间',
 narrative_purpose:'叙事目的',
 action_start_state:'动作起点',
 action_end_state:'动作终点',
 camera:'摄影安排',
 camera_movement:'运镜',
 framing:'构图',
 lighting:'光线',
 sound:'声音',
 review_scope:'审核范围',
 review_status:'审核结论',
 scores:'分项评分',
 score_evidence:'评分依据',
 theme_evidence:'主题表达依据',
 issues:'待处理问题',
 unverified_items:'待核实内容',
 blocking_issue_count:'阻断问题数',
 delivery_allowed:'是否可交付',
 passed:'是否通过',
 weighted_score:'综合评分',
 requirement_fidelity:'需求符合度',
 narrative_quality:'叙事质量',
 character_consistency:'人物一致性',
 scene_consistency:'场景一致性',
 cinematic_quality:'视听表现',
 temporal_consistency:'时间连续性',
 prompt_executability:'提示词可执行性',
 structural_completeness:'结构完整性',
 severity:'严重程度',
 status:'处理状态',
 expected_behavior:'预期表现',
 actual_behavior:'实际表现',
 responsible_agent:'负责角色',
 recheck_criteria:'复核标准',
 suggested_fix:'修改建议',
 budget_checks:'时间预算核对',
 narrative_diagnostics:'叙事检查',
 summary:'总体说明',
 reason:'原因',
 notes:'说明',
 constraints:'创作约束',

};
const META=new Set(['schema_version','project_id','task_id','agent_id','input_revision','input_revisions','source_revisions','revision','output_revision','approved_creative_revision','based_on_creative_revision','approval_required','creative_id','script_id','document_source','reviewed_revisions','profile_ref','dimension_profile_ref','execution_provenance']);
/** 只翻译展示标签与明确的枚举；台词、正文、提示词与专名逐字保留。 */
const ENUM_FIELDS=new Set(['review_status','status','severity','generation_mode','responsible_agent','review_scope','work_type','review_stage','continuity_rules','shot_size','factual_status']);
const VALUES:Record<string,string>={IDENTITY_LOCK:'身份保持一致',COSTUME_LOCK:'服装保持一致',VOICE_LOCK:'声音保持一致',RELATIONSHIP_LOCK:'人物关系保持一致',ELS:'大远景',LS:'远景',FS:'全景',MLS:'中远景',MS:'中景',MCU:'中近景',CU:'近景',ECU:'特写',CONCERN:'需要关注',FINAL_REVIEW:'全片终审',DRAMA:'剧情短片',COMEDY:'情景喜剧',LIFESTYLE:'生活记录／氛围片',DOCUMENTARY:'纪录／知识片',COMMERCIAL:'产品广告',PROMOTIONAL:'品牌／地域宣传',PASS:'通过',PASS_WITH_WARNINGS:'通过，附注意事项',REVISE_REQUIRED:'需要修改',BLOCKED:'暂不可继续',NOT_EVALUATED:'尚未评估',CRITICAL:'严重',MAJOR:'重要',MINOR:'一般',INFO:'提示',OPEN:'待处理',IN_PROGRESS:'处理中',RESOLVED:'已处理，待复核',VERIFIED:'已复核',WONT_FIX:'保留现状',creative:'创意方案',script:'正式剧本',assets:'人物与场景',shots:'导演分镜',prompts:'生成提示词',review:'质量审核',director:'总导演',screenwriter:'编剧',character:'人物设计',scene:'场景设计',storyboard:'分镜设计','prompt-engineer':'提示词设计',reviewer:'审核',text_to_video:'文生视频',image_to_video:'图生视频',first_last_frame:'首尾帧生成'};
/** 创意结构按时间推进展示，避免将每段拆成一长列协议字段。 */
function storyStructure(items:any[],depth:number):string {
 let elapsed:number|null=0;
 return items.map((item,index)=>{
  if(!item||typeof item!=='object'||Array.isArray(item)){elapsed=null;return readable(item,depth+1);}
  const {title,section_id,duration_ms,purpose,beats,visual_evidence,emotion,transition_logic,...extra}=item;
  const duration=Number.isSafeInteger(duration_ms)&&duration_ms>0?duration_ms:null;
  const range=duration!==null&&elapsed!==null?`${elapsed/1000}–${(elapsed+duration)/1000} 秒`:duration!==null?`${duration/1000} 秒`:'时长待确认';
  elapsed=duration!==null&&elapsed!==null?elapsed+duration:null;
  const heading='#'.repeat(Math.min(6,depth+3));
  const parts=[`${heading} ${index+1}. ${title||'故事段落'}｜${range}`];
  const add=(label:string,value:any,field:string)=>{
   if(value===undefined)return;
   parts.push(`**${label}**${typeof value==='object'&&value!==null?'\n\n':'：'}${readable(value,depth+2,field)}`);
  };
  if(duration===null&&duration_ms!==undefined)add('时长记录',duration_ms,'duration_ms');
  add('发生什么',beats,'beats');
  add('这一段的作用',purpose,'purpose');
  add('观众能看到',visual_evidence,'visual_evidence');
  add('情绪变化',emotion,'emotion');
  add('如何接下一段',transition_logic,'transition_logic');
  if(Object.keys(extra).length)parts.push(readable(extra,depth+1));
  // 编号保留供后续定位，不再占据一整组“段落/标题/时长”字段。
  if(section_id!==undefined)parts.push(`段落编号：${section_id}`);
  return parts.join('\n\n');
 }).join('\n\n');
}
export function readable(value:any,depth=0,field=''):string {
 if(value==null)return '待补充';
 if(typeof value==='boolean')return value?'是':'否';
 if(typeof value!=='object')return ENUM_FIELDS.has(field)?VALUES[String(value)]||String(value):String(value);
 if(Array.isArray(value)&&['structure','narrative_beats'].includes(field))return value.length?storyStructure(value,depth):'无';
 if(Array.isArray(value))return value.length?value.map((v,i)=>typeof v==='object'&&v!==null?`**${({scenes:'场次',chapters:'章节',characters:'人物',shots:'镜头',issues:'问题',structure:'段落',checks:'核对项'} as Record<string,string>)[field]||'条目'} ${i+1}**\n\n${readable(v,depth+1,field)}`:`- ${readable(v,depth+1,field)}`).join('\n\n'):'无';
 return Object.entries(value).filter(([key])=>!META.has(key)).map(([key,v])=>{
  // 扩展字段仍保留内容，但不把内部协议名交给用户阅读。
  const label=LABELS[key]||(/^[A-Z]+[\d_-]*\d[\w-]*$/.test(key)?key:'补充说明');
  const content=(key.endsWith('_ms')&&typeof v==='number')?`${v/1000} 秒`:readable(v,depth+1,key);
  return `${depth===0?'### '+label:'**'+label+'**'}${typeof v==='object'&&v!==null?'\n\n':depth===0?'\n\n':'：'}${content}`;
 }).join('\n\n');
}

export function approvalPreview(stage:string,artifact:any):string {
 const data=artifact.data||{};
 if(stage==='creative') {
  return `创意方案 · 修订 ${artifact.revision}\n\n完整方案应已在当前对话正文展示，请回看并按该版本作出决定。若当前对话没有展示完整方案，应先由助手补充展示，再进行审批。此卡片只确认版本，不重复渲染提案。`;
 }
 const title=stage==='creative'?'创意方案':'正式剧本';
 let content=readable(data);
 if(stage==='script'&&typeof data.screenplay==='string'&&data.screenplay.trim()) {
  const {screenplay,...details}=data;
  content=screenplay+'\n\n### 剧本核对资料\n\n'+readable(details);
 }
 return `${title}（修订 ${artifact.revision}）\n\n${content}\n\n是否批准本版进入下一阶段？`;
}

/** 正文材料独立于审批卡片：创意不能复用只提示回看的短卡。 */
export function approvalMaterial(stage:string, artifact:any) {
 if (!['creative','script'].includes(stage) || !artifact || artifact.stale) return {};
 const markdown = stage === 'creative'
  ? `创意方案（修订 ${artifact.revision}）\n\n${readable(artifact.data || {})}`
  : approvalPreview(stage, artifact);
 return {approval_material:{stage,revision:artifact.revision,markdown,instructions:'本次正文只展示此markdown一次，原样保留标题、文字、标点与完整内容；它已完成中文排版，不再另写一版创意或剧本，不概括、不润色、不先展示草稿。随后单独调用approve；已展示同版时直接请求批准。'}};
}

/** 分页仅影响传输与展示，持久化稿件保持完整；每页按顺序真实展示。 */
export function approvalChunks(markdown: string, size = 16000) {
 const chunks: string[] = [];
 let current = '';
 for (const line of markdown.split(/(?<=\n)/)) {
  if (current.length + line.length > size && current) { chunks.push(current); current = ''; }
  for (let offset = 0; offset < line.length; offset += size) {
   const piece = line.slice(offset, offset + size);
   if (current.length + piece.length > size && current) { chunks.push(current); current = ''; }
   current += piece;
  }
 }
 if (current) chunks.push(current);
 return chunks.length ? chunks : [''];
}
export function approvalPage(stage: string, artifact: any, part = 1) {
 const material = approvalMaterial(stage, artifact).approval_material;
 if (!material) return {};
 const pages = approvalChunks(material.markdown);
 if (!Number.isSafeInteger(part) || part < 1 || part > pages.length) throw Error('INVALID_MATERIAL_PART');
 return { approval_material: { ...material, markdown: pages[part - 1], part, parts: pages.length,
  ...(pages.length > 1 ? { instructions: part < pages.length
   ? `先单独正文展示第${part}/${pages.length}部分；随后read(stage:"${stage}",materialPart:${part + 1})读取下一部分。全部按顺序展示后再approve，不拼接摘要。`
   : '这是最后一部分。先单独正文展示，再沿原项目和当前修订号approve。' } : {}) } };
}
