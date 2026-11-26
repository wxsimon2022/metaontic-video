const TOOL_TITLES: Record<string, string> = {
  video_script: '生成视频脚本',
  video_generate: '视频生成',
  video_extend: '视频续拍',
  video_estimate: '视频费用预估',
  video_config: '检查插件设置',
  video_prepare_image: '准备角色参考图',
  video_status: '查询视频任务',
  video_setup: '检查视频生成环境',
  video_stage: '记录制作进度',
  media_submission: '登记最终成片',
  video_hyperframes: '渲染本地视频',
};

const FILM_ACTION_TITLES: Record<string, string> = {
  create: '创建专业创作项目',
  read: '读取创作项目',
  validate: '检查创作资料',
  submit: '提交创作阶段成果',
  approve: '审核创意或剧本',
  export: '导出创作资料',
  next: '推进创作阶段',
  compile: '准备视频制作方案',
  revise: '修订创作内容',
  schedule: '安排创作任务',
  task_result: '更新创作任务状态',
  route: '识别创作意图',
  verify_issue: '复核问题修复',
  configure_profile: '配置作品创作方向',
  diagnose: '检查项目状态',
  recover_lock: '恢复项目状态',
  chapter_plan: '规划剧本章节',
  chapter_submit: '提交章节剧本',
  review_context: '读取审核资料',
  independent_review: '独立质量审核',
  capabilities: '查询模型能力',
  review_requests: '查看审核请求状态',
  retry_review: '准备重新审核',
};

const FILM_STAGE_ROLES: Record<string, string> = {
  creative: '创意策划',
  script: '专业编剧',
  assets: '人物与场景设计',
  shots: '导演分镜',
  prompts: 'AI 视频提示词工程师',
  review: '质量审核',
};

const INTENT_ROLES: Record<string, string> = {
  new_project: '总导演',
  develop_idea: '创意策划',
  write_script: '专业编剧',
  revise_dialogue: '专业编剧',
  revise_story: '专业编剧',
  design_character: '人物设计',
  revise_character: '人物设计',
  design_scene: '场景设计',
  revise_scene: '场景设计',
  design_shots: '导演分镜',
  revise_camera: '导演分镜',
  revise_timing: '导演分镜',
  write_prompts: 'AI 视频提示词工程师',
  adapt_model: 'AI 视频提示词工程师',
  review: '质量审核',
  verify_facts: '事实核查',
  resume: '总导演',
  produce: '视频制作',
  clarify: '总导演',
};

const VIDEO_PROJECT_ACTION_TITLES: Record<string, string> = {
  prepare: '准备视频制作项目',
  review: '审核视频脚本',
  storyboard: '生成分镜示意图',
  status: '查看视频项目进度',
  review_segment: '审核当前视频片段',
};

/**
 * Chinese UI title for a tool call. Keep wire names and enum values stable for DSH/model calls.
 */
export function presentChineseToolCall(name: string, rawArgs: unknown) {
  const args = rawArgs && typeof rawArgs === 'object' ? rawArgs as Record<string, unknown> : {};
  let title = TOOL_TITLES[name];
  if (name === 'film_project') {
    const action = String(args.action);
    const stageRole = FILM_STAGE_ROLES[String(args.stage)];
    const intentRole = INTENT_ROLES[String(args.intent)];
    title = action === 'independent_review' ? '质量审核 · 独立审核'
      : action === 'route' && intentRole ? `${intentRole} · 创作意图匹配`
      : ['submit', 'approve'].includes(action) && stageRole ? `${stageRole} · ${FILM_ACTION_TITLES[action]}`
        : FILM_ACTION_TITLES[action] || '专业创作项目';
  }
  if (name === 'video_project') title = VIDEO_PROJECT_ACTION_TITLES[String(args.action)] || '视频制作项目';
  return title ? { card: 'generic' as const, title } : undefined;
}
