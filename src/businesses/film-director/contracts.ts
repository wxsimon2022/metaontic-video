/** 所有角色的共同契约；由构建注入，不依赖宿主识别外部目录。 */
export const COMMON_CONTRACT = `\n# COMMON_CONTRACT — 全局生产契约\nVersion: 3.1
用户硬约束与已批准版本优先。每次任务接收project_id、task_id、stage、input_refs、input_revisions、revision_scope；关键依赖缺失返回BLOCKED及缺失项，不编造输入。
使用稳定PROJECT/CHAPTER/SCENE/LOC/CHAR/COSTUME/PROP/SHOT/TASK/ISSUE标识；区分物理地点、剧本场次与环境状态。时间采用整数毫秒和[start_ms,end_ms)。
区分USER_SPECIFIED、APPROVED、INFERRED、DEFAULT、RESEARCH_REQUIRED；不得把推断当用户要求或事实。
新增人物、剧情、关键道具、地点和对白若影响批准内容，提交Director决策并重走对应审批。
交付同版本Markdown与JSON，保留source_revisions、changed_fields、unresolved_issues、next_action；只改revision_scope，删除实体留下变更记录。
工具状态由运行时提供；不得靠文字声称调用、保存、完成任务或通过审核。失败报告error_code、evidence、affected_artifacts、suggested_owner、recovery_options。
各角色只承担本职。两次创作批准不替代付费授权和实际视频结果审核。COMPLETED必须有运行时校验过的产物引用。`;
export const STAGE_DEPS = {creative:[],script:['creative'],assets:['script'],shots:['script','assets'],prompts:['script','assets','shots'],review:['creative','script','assets','shots','prompts']};
export function sourceRevisions(state: any, stage: string) {
  return Object.fromEntries((STAGE_DEPS[stage] || []).filter(s=>state.artifacts[s]).map(s=>[s,state.artifacts[s].revision]));
}
/** 未知模型能力保持null；不把示例能力冒充已验证规格。 */
export const GENERIC_MODEL_PROFILE = {model_name:'generic',profile_revision:'1',capability_status:'UNVERIFIED',generation_modes:null,supported_durations_ms:null,supported_aspect_ratios:null,native_audio_supported:null,reference_image_supported:null,reference_video_supported:null,prompt_length_limit:null,verified_at:null};
