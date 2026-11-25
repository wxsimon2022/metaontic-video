import { TASK_CONTRACT, promptMetrics, scopedInputs, boundedTask } from './context.composer.js';
import { COMMON_CONTRACT, sourceRevisions, STAGE_DEPS, projectContext, modelProfile } from '../contracts/index.js';
import director from '../../../agents/director/index.js';
import creative from '../../../agents/creative/index.js';
import screenwriter from '../../../agents/screenwriter/index.js';
import character from '../../../agents/character/index.js';
import scene from '../../../agents/scene/index.js';
import storyboard from '../../../agents/storyboard/index.js';
import promptEngineer from '../../../agents/prompt-engineer/index.js';
import reviewer from '../../../agents/reviewer/index.js';
import { profileInstructions, profileContext } from '../profiles/index.js';
import { runtimeContract } from './runtime-contract.js';
import { SHORT_VIDEO_COMMON, SHORT_VIDEO_ROLE } from '../prompts/short-video.js';
import { submissionContract } from '../contracts/fields.js';
const ROLE_TEXTS = {director,creative,screenwriter,character,scene,storyboard,'prompt-engineer':promptEngineer,reviewer};
export const ROLE_PROMPTS = Object.fromEntries(Object.entries(ROLE_TEXTS).map(([key,text])=>[key,text+'\n'+COMMON_CONTRACT+runtimeContract(key)])) as typeof ROLE_TEXTS;
export function roleInstructions(state:any,role:string) {return ROLE_TEXTS[role]+'\n'+TASK_CONTRACT+runtimeContract(role)+'\n'+profileInstructions(state,role)
 + (state.duration_ms > 0 && state.duration_ms <= 60000 ? '\n'+SHORT_VIDEO_COMMON+'\n'+(SHORT_VIDEO_ROLE[role] || '') : '')
 + (state.script_policy==='canonical_v1'&&role==='screenwriter'?'\n当前项目采用canonical_v1：场次、动作节拍beats和对白是唯一剧情来源；正文由工具生成，screenplay可以省略，不能维护另一份剧情。beats按表演顺序列action或dialogue_ref，每句对白须且只须引用一次；局部修改可revise(stage:script)替换scenes/dialogue/characters/chapters并重新审批。':'')
 + (role==='screenwriter'?'\n【剧本单次展示】先提交结构化剧本并核对保存成功，在用户可见正文完整展示返回的approval_material.markdown，再单独调用film_project approve(stage:"script")。只给摘要、路径或说已保存不算展示；不得先弹窗后补全文。':'');}
export const INTENTS = ['new_project','develop_idea','write_script','revise_dialogue','revise_story','design_character','revise_character','design_scene','revise_scene','design_shots','revise_camera','revise_timing','write_prompts','adapt_model','review','verify_facts','resume','produce','clarify'] as const;
const ROUTES = {
 new_project:['director',null],develop_idea:['creative','creative'],write_script:['screenwriter','script'],revise_dialogue:['screenwriter','script'],revise_story:['screenwriter','script'],
 design_character:['character','assets'],revise_character:['character','assets'],design_scene:['scene','assets'],revise_scene:['scene','assets'],
 design_shots:['storyboard','shots'],revise_camera:['storyboard','shots'],revise_timing:['storyboard','shots'],write_prompts:['prompt-engineer','prompts'],adapt_model:['prompt-engineer','prompts'],
 review:['reviewer','review'],verify_facts:['reviewer','review'],resume:['director',null],produce:['director',null],clarify:['director',null],
};
const DEPS = STAGE_DEPS;
/** 意图由主控按语义显式选择；不通过关键词猜测批准或自动执行写操作。 */
export function routeIntent(state: any, intent: string, entityIds: string[] = []) {
 if (!Object.hasOwn(ROUTES,intent)) throw Error('UNKNOWN_INTENT');
 if (!Array.isArray(entityIds) || entityIds.some(id=>typeof id!=='string'||!id.trim()))throw Error('INVALID_SCOPE');
 const [role,stage] = ROUTES[intent];
 const dependencies=stage ? DEPS[stage] : [];
 const missing=dependencies.filter(s=>!state.artifacts[s] || state.artifacts[s].stale);
 const approvals=dependencies.filter(s=>['creative','script'].includes(s) && state.approvals[s]!==state.artifacts[s]?.revision);
 const local=['revise_dialogue','revise_character','revise_scene','revise_camera','revise_timing'].includes(intent);
 const scopeRequired=local && !entityIds.length;
 const ids=stage==='assets' ? (role==='character'? state.artifacts.assets?.data.characters?.map(v=>v.character_id):['scenes','locations','scene_states','props'].flatMap(k=>(state.artifacts.assets?.data[k]||[]).map(v=>v[{scenes:'scene_id',locations:'location_id',scene_states:'scene_state_id',props:'prop_id'}[k]]))) : stage==='shots'||stage==='prompts'?state.artifacts.shots?.data.shots?.map(v=>v.shot_id):undefined;
 if(ids && entityIds.some(id=>!ids.includes(id))) throw Error('UNKNOWN_ENTITY');
 const inputs=stage?scopedInputs(state,stage,role,entityIds):{};
 const instructions=roleInstructions(state,role)+(entityIds.length?'\n本次只修改指定ID；保留其他内容，不重写整片。':'');
 return boundedTask({submission_contract:stage?submissionContract(stage):null,intent,role,stage,scope:{entity_ids:entityIds},status:missing.length||approvals.length||scopeRequired?'needs_input':'ready',missing,approval_required:approvals,scope_required:scopeRequired,...projectContext(state),work_profile:profileContext(state),input_revisions:sourceRevisions(state,stage),model_profile:modelProfile(state),expectedRevision:state.revision,instructions,inputs,context_metrics:promptMetrics(instructions,inputs),
   next_action:scopeRequired?'明确修改对象ID；不要猜测或改写全片':missing.length||approvals.length?'完成缺失上游或批准后再修改':'按职责生成候选；提交仍受现有状态机与审批约束'});
}
