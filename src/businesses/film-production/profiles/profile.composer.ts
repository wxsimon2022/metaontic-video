import { resolveDimensions } from './profile.resolver.js';
import { PROFILE_REGISTRY as REGISTRY } from './profile.registry.js';
import type { Dimension } from './profile.definition.js';
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
