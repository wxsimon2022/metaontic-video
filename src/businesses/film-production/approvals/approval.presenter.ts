/** 审批展示与机器数据分开；不截断关键内容，不改变批准绑定的版本。 */
const LABELS:Record<string,string>={
 title_options:'备选标题',premise:'核心创意',logline:'一句话故事',theme:'核心表达',audience_insight:'观众洞察',audience_experience:'观众体验',genre:'题材',format:'作品形式',purpose:'创作目的',tone:'情绪基调',hook:'核心看点',central_conflict_or_question:'核心冲突或问题',visual_motifs:'视觉母题',sound_motifs:'声音母题',structure:'故事结构',narrative_beats:'情节推进',must_preserve:'必须保留',assumptions:'创作假设',research_needed:'待核实资料',facts_to_verify:'待核实事实',feasibility_risks:'制作风险',risks:'风险',approval_questions:'待确认事项',recommended_direction:'推荐方向',visual_details:'可视化细节',visual_evidence:'画面依据',visual_direction:'视觉方向',sound_direction:'声音方向',approval_summary:'审批要点',type_details:'类型创作要点',characters_or_subjects:'人物或观察对象',characters:'人物',chapters:'章节',scenes:'场次',dialogue:'对白',synopsis:'故事梗概',narrative_arc:'叙事推进',character_arcs:'人物变化',timeline_summary:'时间预算',continuity_state:'连续性状态',unresolved_threads:'未解决线索',research_flags:'待核实事项',self_review:'自检',title:'标题',name:'名称',objective:'目标',action_or_observation:'行动或观察',payoff:'落点',beats:'事件节拍',emotion:'情绪',transition_logic:'衔接逻辑',duration_ms:'时长',detail:'细节',narrative_function:'叙事作用',section_id:'段落',scene_id:'场次编号',chapter_id:'章节编号',character_id:'人物编号',speaker_id:'说话人',exact_text:'台词',description:'内容',evidence:'依据',character_goal:'人物目标',choice_and_consequence:'选择与后果',causal_progression:'因果推进',character_change:'人物变化',audience:'目标观众',hard_constraints_check:'硬约束核对',factual_status:'事实状态',change_requests:'变更请求',continuity_notes:'连续性说明',visual_anchors:'外貌锚点',scene_ids:'场次引用',state_change:'场景变化',estimated_duration_ms:'预计时长',target_duration_ms:'目标时长',location_hint:'地点',dramatic_purpose:'场景目的',props_needed:'所需道具',dialogue_exact:'准确对白',action:'动作',narration:'旁白',beat_id:'节拍编号',dialogue_id:'对白编号',emotion_landing:'情绪落点',memory_point:'观众记忆点',core_attraction:'核心看点',conflict:'人物冲突',plot_progression:'情节推进',reversal_or_emotional_landing:'转折或情绪落点',visualizable_details:'可视化细节',audience_memory_point:'观众记忆点',
};
const META=new Set(['schema_version','project_id','task_id','agent_id','input_revision','input_revisions','source_revisions','revision','output_revision','approved_creative_revision','based_on_creative_revision','approval_required','creative_id','script_id']);
function readable(value:any,depth=0):string {
 if(value==null)return '未提供';
 if(typeof value==='boolean')return value?'是':'否';
 if(typeof value!=='object')return String(value);
 if(Array.isArray(value))return value.length?value.map((v,i)=>typeof v==='object'&&v!==null?`${i+1}. ${readable(v,depth+1)}`:`- ${readable(v,depth+1)}`).join('\n\n'):'无';
 return Object.entries(value).filter(([key])=>!META.has(key)).map(([key,v])=>{
  const label=LABELS[key]||key;
  const content=key.endsWith('duration_ms')&&typeof v==='number'?`${v/1000} 秒`:readable(v,depth+1);
  return `${depth===0?'### ':''}${label}${typeof v==='object'&&v!==null?'\n':'：'}${content}`;
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
 return {approval_material:{stage,revision:artifact.revision,markdown}};
}
