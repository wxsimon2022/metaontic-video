/** 角色任务、候选预检与提交校验共用的数组字段定义。 */
export const STAGE_ARRAYS:Record<string,string[]>={
 creative:['structure','must_preserve','assumptions'],script:['characters','chapters','scenes','dialogue'],assets:['characters','scenes','locations','scene_states','props'],shots:['shots'],prompts:['prompts'],review:['issues','review_scope','unverified_items'],
};
export const ITEM_ARRAYS:Record<string,Record<string,string[]>>={
 shots:{shots:['character_ids','prop_ids','costume_ids','dialogue_refs']},
 prompts:{prompts:['dialogue_refs']},
};
export function submissionContract(stage:string) {
 return {stage,required_arrays:structuredClone(STAGE_ARRAYS[stage]||[]),item_required_arrays:structuredClone(ITEM_ARRAYS[stage]||{}),instructions:'所有列出的数组必须显式提供。无对应内容时用 []；已有角色、道具、服装与对白必须从批准登记表引用，不能为通过校验清空。分镜 costume_ids 引用本镜人物穿着的服装，dialogue_refs 引用本镜使用的剧本 dialogue_id；无对白才为空。先 validate，再 submit，不把校验当作保存或批准。'};
}
