import { COMMON_CONTRACT, GENERIC_MODEL_PROFILE, sourceRevisions, STAGE_DEPS, projectContext, modelProfile } from '../contracts/index.js';
import director from './director.js';
import creative from './creative.js';
import screenwriter from './screenwriter.js';
import character from './character.js';
import scene from './scene.js';
import storyboard from './storyboard.js';
import promptEngineer from './prompt-engineer.js';
import reviewer from './reviewer.js';
import { profileInstructions, profileContext } from '../profiles/index.js';
import { runtimeContract } from './runtime-contract.js';
import { submissionContract } from '../contracts/fields.js';
const ROLE_TEXTS = {director,creative,screenwriter,character,scene,storyboard,'prompt-engineer':promptEngineer,reviewer};
export const ROLE_PROMPTS = Object.fromEntries(Object.entries(ROLE_TEXTS).map(([key,text])=>[key,text+'\n'+COMMON_CONTRACT+runtimeContract(key)])) as typeof ROLE_TEXTS;
export function roleInstructions(state:any,role:string) {return ROLE_PROMPTS[role]+'\n'+profileInstructions(state,role);}
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
 const inputs=Object.fromEntries([...new Set([...dependencies,...(stage?[stage]:[])])].filter(s=>state.artifacts[s]).map(s=>[s,state.artifacts[s]]));
 return {submission_contract:stage?submissionContract(stage):null,intent,role,stage,scope:{entity_ids:entityIds},status:missing.length||approvals.length||scopeRequired?'needs_input':'ready',missing,approval_required:approvals,scope_required:scopeRequired,...projectContext(state),work_profile:profileContext(state),input_revisions:sourceRevisions(state,stage),model_profile:modelProfile(state),expectedRevision:state.revision,instructions:roleInstructions(state,role),inputs,
   next_action:scopeRequired?'明确修改对象ID；不要猜测或改写全片':missing.length||approvals.length?'完成缺失上游或批准后再修改':'按职责生成候选；提交仍受现有状态机与审批约束'};
}
