/** 角色任务、候选预检与提交校验共用的数组字段定义。 */
export const STAGE_ARRAYS:Record<string,string[]>={
 creative:['structure','must_preserve','assumptions'],script:['characters','chapters','scenes','dialogue'],assets:['characters','scenes','locations','scene_states','props'],shots:['shots'],prompts:['prompts'],review:['issues','review_scope','unverified_items'],
};
export const ITEM_ARRAYS:Record<string,Record<string,string[]>>={
 shots:{shots:['character_ids','prop_ids','costume_ids','dialogue_refs']},
 prompts:{prompts:['dialogue_refs']},
};
export function submissionContract(stage:string) {
 return {stage,quality_evidence:{creative:['structure[].purpose','structure[].visual_evidence'],script:['scenes[].scene_goal','scenes[].key_actions','scenes[].entry_state','scenes[].exit_state'],review:['score_evidence','theme_evidence（scene_id/evidence）','budget_checks（有超时风险时）']}[stage]||[],required_arrays:structuredClone(STAGE_ARRAYS[stage]||[]),item_required_arrays:structuredClone(ITEM_ARRAYS[stage]||{}),instructions:'content 必须是一个完整 JSON 对象，全部字段位于同一对最外层 { } 内；不要在根对象结束后追加对象。所有列出的数组必须显式提供。assets 必须使用顶层 characters、scenes、locations、scene_states、props 五个数组；每个地点对象只放在 locations 数组，每个场景状态对象只放在 scene_states 数组，不要把 location 与 scene_state 拼成同一对象，也不要添加 scene_states_2、scene2_placeholder 等临时字段。无对应内容时用 []；已有角色、道具、服装与对白必须从批准登记表引用，不能为通过校验清空。分镜 costume_ids 引用本镜人物穿着的服装，dialogue_refs 引用本镜使用的剧本 dialogue_id；无对白才为空。JSON 语法错误会返回行列和附近文本，按提示只修正结构后重新提交。直接 submit 即会校验并在失败时集中返回问题，无需固定增加一次 validate；validate 仅供单独检查，不代表保存或批准。'};
}
