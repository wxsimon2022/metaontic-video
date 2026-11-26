/** 角色任务、候选预检与提交校验共用的数组字段定义。 */
export const STAGE_ARRAYS:Record<string,string[]>={
 creative:['structure','must_preserve','assumptions'],script:['characters','chapters','scenes','dialogue'],assets:['characters','scenes','locations','scene_states','props'],shots:['shots'],prompts:['prompts'],review:['issues','review_scope','unverified_items'],
};
export const ITEM_ARRAYS:Record<string,Record<string,string[]>>={
 shots:{shots:['character_ids','prop_ids','costume_ids','dialogue_refs']},
 prompts:{prompts:['dialogue_refs']},
};
const STAGE_INSTRUCTIONS: Record<string,string> = {
 assets:'assets 顶层必须包含 characters、scenes、locations、scene_states、props 五个数组；地点和状态分别放在 locations、scene_states，不合并对象或增加临时字段。道具放在 props，不只写入描述；保留已有人物与道具，无对应内容才用 []。',
 shots:'character_ids、prop_ids、costume_ids、dialogue_refs 引用批准登记表；costume_ids 对应本镜人物服装，dialogue_refs 引用本镜剧本对白，无对白才为空。',
 prompts:'逐镜引用批准shot_id及其dialogue_refs，逐字保留本镜对白；一镜一提示词不授权新增付费调用。',
};
export function submissionContract(stage:string) {
 return {stage,quality_evidence:{creative:['structure[].purpose','structure[].visual_evidence'],script:['scenes[].scene_goal','scenes[].key_actions','scenes[].entry_state','scenes[].exit_state'],review:['score_evidence','theme_evidence（scene_id/evidence）','budget_checks（有超时风险时）']}[stage]||[],required_arrays:structuredClone(STAGE_ARRAYS[stage]||[]),item_required_arrays:structuredClone(ITEM_ARRAYS[stage]||{}),instructions:'content 必须是一个完整 JSON 对象，全部字段位于同一对最外层 { } 内；不要在根对象结束后追加对象。所有列出的数组必须显式提供。'+(STAGE_INSTRUCTIONS[stage] || '')+' JSON 语法错误按返回的行列和附近文本修复，不为通过校验清空批准内容。直接 submit 会集中校验，无需固定增加 validate；validate 不代表保存或批准。'};
}
