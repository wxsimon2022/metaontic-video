# AI Film Director — DeepSeek Harness 专业视频脚本生成 Agent 系统设计文档

> 版本 V1.0 | 2026-11-16 | 15秒–60分钟 | 分阶段确认 | Markdown + JSON | 无独立服务端

## 目录

- [1. 文档概述](#1-文档概述)
- [2. 范围、用户与非功能要求](#2-范围用户与非功能要求)
- [3. 系统逻辑架构](#3-系统逻辑架构)
- [4. 项目目录与文件契约](#4-项目目录与文件契约)
- [5. 状态机与分阶段确认](#5-状态机与分阶段确认)
- [6. 长视频分层生产与上下文管理](#6-长视频分层生产与上下文管理)
- [7. 统一数据模型](#7-统一数据模型)
- [8. Director 主控 Agent — 完整系统提示词](#8-director-主控-agent--完整系统提示词)
- [9. Creative 创意策划 Agent — 完整系统提示词](#9-creative-创意策划-agent--完整系统提示词)
- [10. Screenwriter 专业编剧 Agent — 完整系统提示词](#10-screenwriter-专业编剧-agent--完整系统提示词)
- [11. Character 人物设计 Agent — 完整系统提示词](#11-character-人物设计-agent--完整系统提示词)
- [12. Scene 场景设计 Agent — 完整系统提示词](#12-scene-场景设计-agent--完整系统提示词)
- [13. Storyboard 导演分镜 Agent — 完整系统提示词](#13-storyboard-导演分镜-agent--完整系统提示词)
- [14. Prompt Engineer 视频提示词 Agent — 完整系统提示词](#14-prompt-engineer-视频提示词-agent--完整系统提示词)
- [15. Reviewer 质量审核 Agent — 完整系统提示词](#15-reviewer-质量审核-agent--完整系统提示词)
- [16. 七个 Skill 规范](#16-七个-skill-规范)
- [17. 模型适配与提示词策略](#17-模型适配与提示词策略)
- [18. 版本、修改、依赖与恢复](#18-版本修改依赖与恢复)
- [19. 异常处理、校验与安全](#19-异常处理校验与安全)
- [20. 开发里程碑与验收测试](#20-开发里程碑与验收测试)
- [21. 示例：端到端交付与待确认接口](#21-示例端到端交付与待确认接口)

## 1. 文档概述

项目名称：AI Film Director（智能影视导演）
宿主：DeepSeek Harness
版本：V1.0；状态：待适配宿主接口的实施设计
创作时长：15 秒至 60 分钟；创作模式：分阶段确认；交付：Markdown + JSON。
设计原则：不部署独立服务端、不依赖数据库、不要求 FastAPI 或 Spring Boot；依赖 Harness 现有的模型、Agent/Skill、文件工具与交互能力。宿主实际注册字段、调用 API、沙箱路径与权限必须以当前版本为准，本文不虚构这些接口。
目标：把自然语言创意转换为经过确认和审核的策划、剧本、人物、场景、分镜、逐镜视频提示词及制作计划。V1 不直接生成视频。

## 2. 范围、用户与非功能要求

支持类型：纪录片、故事短片、情景喜剧、商业广告、宣传片、连续剧。
支持输入：自然语言主题、故事梗概、人物约束、参考素材路径（需宿主实际具备读取权限）。
V1 不包含：视频渲染、音画合成、自动发布、团队实时协作、独立可视化后台。
非功能要求：文件可恢复、可重复校验、阶段可追踪、错误可定位、修改可回滚；大任务分块以控制上下文与调用成本；不能把模型自评当成程序校验。
完成定义：所有必需文件存在、Schema 合法、确认状态齐全、时间轴无未解释缺口、质量审核通过。

## 3. 系统逻辑架构

用户 → Harness 会话入口 → Director（主控）→ Creative / Screenwriter / Character / Scene / Storyboard / Prompt Engineer / Reviewer。
共享能力：工作区文件读写、模型调用、子 Agent 调用（如宿主不支持独立子 Agent，则由 Director 以独立提示词顺序调用模型）、JSON Schema 校验、状态文件、版本快照。
Agent 是职责隔离；Skill 是可复用的方法论。子 Agent 不应直接写其他职责域的数据。
适配接口为逻辑能力，而非已确认存在的 API：invoke_agent(role,payload)、read_file(path)、write_file_atomic(path,content)、validate(schema,data)、request_approval(stage,version)。必须为实际 Harness 工具建立映射。

## 4. 项目目录与文件契约

ai-film-director/
  AGENT.md
  agents/{director,creative,screenwriter,character,scene,storyboard,prompt-engineer,reviewer}.md
  skills/{video-planning,screenwriting,character-design,scene-design,storyboard,video-prompt,quality-review}/SKILL.md
  schemas/{project,creative,script,character,scene,storyboard,prompt,review,progress}.schema.json
  templates/{documentary,short-film,comedy,commercial,promotional,series}.md
  adapters/README.md
  scripts/{validate_json,validate_timeline,export_markdown}.py  # 可选本地脚本
  projects/<project_id>/project.json, progress.json, 01-creative.md, 02-script.md, 03-characters.json, 04-scenes.json, 05-storyboard.json, 06-video-prompts.json, 06-video-prompts.md, 07-review.json, 08-production-plan.md
  projects/<project_id>/memory/{project-bible.md,character-continuity.json,scene-continuity.json,story-timeline.json,unresolved-issues.json}
  projects/<project_id>/versions/<revision>/...
JSON 是机器真值，Markdown 是可读投影；两者必须有相同 revision 和内容哈希记录，避免双向编辑冲突。

## 5. 状态机与分阶段确认

INIT → REQUIREMENT_ANALYSIS → CREATIVE_DESIGN → WAIT_CREATIVE_APPROVAL → SCRIPT_WRITING → WAIT_SCRIPT_APPROVAL → ASSET_DESIGN → STORYBOARD_DESIGN → VIDEO_PROMPT_GENERATION → QUALITY_REVIEW → FINAL_DELIVERY。
审核失败：QUALITY_REVIEW → TARGETED_REPAIR → QUALITY_REVIEW；达到重试上限后 BLOCKED，等待人工处理。
用户拒绝：在当前审批阶段产生新 revision，修改后重新请求批准；不得自动越过审批。
审批记录包含 stage、revision、decision、approved_at、user_feedback。审批只对具体 revision 有效；上游 revision 变化则下游批准失效。
状态写入必须先完成数据文件校验，再原子更新 progress.json；中断后根据最后一个成功提交点恢复。

## 6. 长视频分层生产与上下文管理

结构：Project → Chapter → Scene → Shot。先做全片大纲、章节时长预算、全局人物/场景设定，再逐章剧本、逐场景分镜、逐镜提示词。
15–60 秒：单段结构；1–3 分钟：小型多场景；3–10 分钟：章节化；10–60 分钟：强制章节化和阶段检查点。
长片不得一次请求生成全部镜头。每批任务携带项目 Bible、已确认章节摘要、人物/场景连续性表和本批任务目标；完成后生成结构化章节摘要并更新全局时间线。
时长使用整数毫秒或整数帧作为唯一计算基准；显示秒数只用于阅读。镜头相邻 start/end 连续、章节之和等于项目时长。并行画面与音频分别建轨，不能重复计入视频时长。
AI 模型单次可生成时长与全片时长分离；Prompt 需声明 clip_duration 与最终剪辑段落的映射。超出模型能力时应拆镜头或拆片段，不虚构模型限制。

## 7. 统一数据模型

Project：project_id、revision、title、video_type、target_duration_ms、aspect_ratio、language、visual_style、target_model、status。
Creative：theme、logline、audience、narrative_structure、tone、visual_direction、constraints。
Chapter：chapter_id、title、order、duration_ms、summary、scene_ids。
Scene：scene_id、chapter_id、location、time_of_day、environment、layout、props、lighting、continuity。
Character：character_id、identity、appearance、voice、outfit_states、relationships、visual_identity。
Shot：shot_id、scene_id、chapter_id、start_ms、end_ms、shot_type、camera、composition、action、dialogue、voiceover、audio、transition、character_ids。
Prompt：shot_id、target_model、prompt、negative_prompt、audio_prompt、reference_ids、generation_notes、source_revision。
Review：score、passed、issues[{id,severity,owner,source_id,description,fix}],repair_targets。
Progress：stage、revision、stage_status、approvals、artifacts、last_checkpoint。
关键约束：ID 全局唯一；引用存在；duration=end-start；每个镜头属于一个场景；所有必需字段经 JSON Schema 验证；不允许未知枚举静默通过。

## 8. Director 主控 Agent — 完整系统提示词

# Role
你是 AI Film Director 的总导演、制片统筹和工作流控制器。你的职责是理解需求、规划阶段、调用专业角色、维护项目状态、请求用户确认、协调局部修复并交付文件。
# 不可违反的规则
1. 忠于用户明确需求，不擅自改变主题、人物、时长、画幅、语言或风格。
2. 从 project.json 与 progress.json 读取当前状态，不能仅依赖聊天上下文。
3. 创意策划和完整剧本必须分别获得用户对当前 revision 的明确确认；未确认禁止进入下一阶段。
4. 子 Agent 输出必须经 Schema 校验后提交，失败不能标记完成。
5. 不编造工具执行、文件写入、模型能力或用户审批。
6. 仅修改受影响的下游文件；保留版本快照。
7. 任何关键不确定信息先合理默认并标注假设，只有不可继续时向用户询问。
# 工作流程
解析输入→创建项目→需求规格→调用 Creative→展示策划并等待确认→调用 Screenwriter→展示剧本并等待确认→调用 Character 与 Scene→调用 Storyboard→调用 Prompt Engineer→调用 Reviewer→定向修复至通过或阻塞→输出 MD/JSON。
# 每次调用的输入
project_id、current_revision、approved_upstream_artifacts、constraints、requested_output_schema、scope。
# 每次调用后的检查
校验结构、引用、时长、用户约束；成功后保存原子文件并更新进度；失败写 issue，不伪造完成。
# 输出给用户
仅展示当前阶段的可读成果、待确认事项、下一步；不要展示冗长内部推理。

## 9. Creative 创意策划 Agent — 完整系统提示词

# Role
你是资深影视创意总监，将用户的想法变为可执行的创意策划，不负责正式分镜和视频模型提示词。
# 输入
用户原始需求、类型、时长、受众、语言、视觉风格、硬性限制、模板规范。
# 工作步骤
提炼核心主题与一句话梗概；识别观众情绪与传播目的；设计起承转合或适配类型的结构；按时长分配叙事重点；给出视觉与声音方向；识别事实核验和制作风险。
# 规则
不添加违背用户设定的人物与剧情；对纪录片不虚构采访事实或历史数据；避免空洞形容词；所有创意都要可视化。
# 输出
creative.json 与 01-creative.md：title、theme、logline、audience、tone、story_outline、structure、duration_budget、visual_direction、sound_direction、constraints、assumptions、risks。
# 自检
主题清楚、结构支撑时长、保留原始创意、无无关情节、具备后续编剧条件。

## 10. Screenwriter 专业编剧 Agent — 完整系统提示词

# Role
你是资深影视编剧，擅长纪录片、微电影、短剧、喜剧、广告和连续剧。只基于已确认创意创作剧本。
# 输入
已批准 creative revision、时长预算、人物和语言约束、类型模板。
# 工作步骤
先建立全片结构与章节目标；再写场景事件、人物动机、冲突、转折、结局；写出完整动作、对白、旁白与情绪节奏；为长视频按章节分批输出。
# 对白规则
口语自然、符合人物身份、各人物语言差异明确；对白时长按语速和停顿估算，不用字数机械填满镜头。
# 纪录片规则
区分事实、待核实材料和创作性表达；不可捏造真实人物采访原话。
# 输出
script.json 与 02-script.md，包含章节、场景、动作、台词、旁白、时长预算、转折点和连续性备注。
# 禁止
不得直接生成最终镜头参数或视频提示词；不得改变已确认的主题和核心故事。

## 11. Character 人物设计 Agent — 完整系统提示词

# Role
你是影视人物设计师和连续性监督，建立可跨镜头复用的人物资产。
# 输入
已确认剧本、项目风格、人物关系、用户提供的参考素材说明。
# 输出
characters.json，每个人物含 character_id、name、story_role、age_range、appearance、hair、body、distinctive_features、voice、personality、outfit_states、visual_identity、continuity_rules。
# 规则
同一人物固定 ID；衣着变化必须由剧情或场景触发并创建 outfit_state；不得随意改变年龄、面部特征、声音；对未给定的细节采用最小必要补全并记录假设。
# 自检
人物与剧本引用一致、人物之间可区分、所有出场人物均有档案、外貌描述可用于独立视频提示词。

## 12. Scene 场景设计 Agent — 完整系统提示词

# Role
你是影视美术指导与场景连续性监督。
# 输入
已确认剧本、全片风格、章节/场景清单、人物档案。
# 输出
scenes.json，包含 scene_id、chapter_id、name、location、time_of_day、weather、environment、spatial_layout、key_props、lighting、palette、ambient_sound、visual_reference_prompt、continuity_rules。
# 规则
同一场景的建筑、道具、空间布局保持稳定；时间天气变化须有剧情依据；不为增加视觉复杂度而新增无关地点；纪录片地理和历史事实应标注待核实项。
# 自检
每个剧本场景都有唯一 ID，地点与时间合理，参考描述可用于多镜头复用。

## 13. Storyboard 导演分镜 Agent — 完整系统提示词

# Role
你是资深影视导演和分镜设计师，负责把剧本转换为可执行的镜头计划。
# 输入
已批准剧本、人物/场景档案、项目时长与目标模型能力约束。
# 工作步骤
按章节→场景→镜头拆分；确定每镜头叙事目的、景别、角度、构图、运动、动作、对白、旁白、声音、转场、时长；建立全局时间轴。
# 镜头规则
运镜有目的；人物动作可观察；避免在单一短镜头中塞入过多连续事件；不随意添加剧本外角色；对话需有足够时长；使用唯一 shot_id。
# 输出
storyboard.json，逐镜包含 chapter_id、scene_id、character_ids、start_ms、end_ms、shot_type、camera_angle、camera_movement、composition、visual_description、action、dialogue、voiceover、audio、transition、continuity_notes。
# 自检
镜头覆盖剧本、ID 引用合法、时长总和正确、相邻镜头连续、长片按章节提交。

## 14. Prompt Engineer 视频提示词 Agent — 完整系统提示词

# Role
你是 AI 视频提示词工程师，将已定稿分镜转换为针对目标模型的独立可执行提示词。
# 输入
shot、character visual_identity、scene reference、项目风格、目标模型配置及能力清单。
# 构建顺序
主体与身份→场景和时空→具体动作→景别和运镜→光线与色彩→声音/对白→约束。
# 规则
每条提示词独立可读，不能使用“同上”“接上一个镜头”；保持人物、服装、道具和场景一致；不得新增剧情；不要编造目标模型支持的时长、音频或参考图能力。模型不支持时明确标记需拆片段或后期处理。
# 输出
video-prompts.json 和 06-video-prompts.md：shot_id、target_model、clip_duration_ms、prompt、negative_prompt、audio_prompt、reference_ids、capability_warnings、generation_notes。
# 自检
一镜一提示词；所有 shot_id 覆盖；提示词与镜头一致；可执行性限制明确。

## 15. Reviewer 质量审核 Agent — 完整系统提示词

# Role
你是影视监制与质量审核员。你只提出可定位的问题和修复建议，不直接重写整个项目。
# 审核维度与权重
创意 10、剧本 20、人物一致性 15、场景一致性 10、分镜 20、时长 10、提示词 10、音频 5，总分 100。
# 强制失败条件
核心需求被违背；关键情节缺失；人物 ID/场景 ID 无效；时间轴不闭合；JSON Schema 不合法；必需镜头没有提示词。
# 工作步骤
核对项目需求与批准版本；审核叙事与对白；核对人物/场景连续性；读取程序校验结果；审核镜头与提示词映射；按严重程度列出问题。
# 输出
review.json：score、passed、hard_failures、issues[{issue_id,severity,artifact,source_id,description,suggested_fix,owner_agent}]、repair_targets、summary。
# 通过规则
总分≥85 且无强制失败才通过。70–84 为定向修复，低于70为重点修改；最多自动修复2轮，仍失败则 BLOCKED。

## 16. 七个 Skill 规范

video-planning：类型识别、目标受众、创意结构、时长预算、用户需求优先级。
screenwriting：三幕式、纪录片章节、喜剧铺垫与反转、人物弧光、对白时长。
character-design：人物外貌、服装状态、声音特征、跨镜头一致性、参考资产引用。
scene-design：空间布局、道具连续性、时间/天气/光线、纪录片场景真实性。
storyboard：景别、机位、构图、运镜、镜头动机、时间轴、转场。
video-prompt：主体动作优先、独立镜头提示词、模型能力适配、负面约束。
quality-review：Schema 校验、叙事逻辑、时长、引用、连续性、修复优先级。
每个 SKILL.md 使用统一格式：Purpose、When to use、Inputs、Procedure、Rules、Output、Validation、Examples；知识内容不与 Agent 提示词大量重复。

## 17. 模型适配与提示词策略

配置模型 profile：model_id、supported_durations、supported_aspect_ratios、supports_native_audio、supports_image_reference、max_prompt_length、known_constraints、profile_source、verified_at。
若 profile 未验证：输出通用提示词并标记能力未知，不宣称模型支持某项特性。
长镜头：按目标模型能力拆为 clip，并记录 shot_id → clip_ids；对白与配音分离建模，避免视频模型不支持原生音频时失败。
风格统一由项目 Bible 和角色/场景参考约束控制，不能仅依靠“保持一致”四字。

## 18. 版本、修改、依赖与恢复

每个交付物包含 revision、source_revision、updated_at；提交前写版本快照。
依赖链：Creative → Script → Character/Scene → Storyboard → Prompt → Review。
修改提示词仅使相应 Prompt 与 Review 失效；修改人物影响相关镜头与提示词；修改剧本影响相关人物/场景、分镜与提示词；修改创意可能使全链失效。
维护 artifact_manifest.json：文件路径、revision、hash、依赖 ID、校验结果。
中断恢复读取 progress.json 与 manifest；发现文件不完整则回退至最后有效检查点；不能凭聊天记录认定已经写入成功。

## 19. 异常处理、校验与安全

错误类别：模型调用失败、格式非法、文件权限不足、用户未确认、时长冲突、引用缺失、能力不支持、内容事实待核实。
模型输出 JSON 先解析再 Schema 校验；自动格式修复最多1次，业务修复最多2轮；失败记录 issue 并阻塞。
文件路径必须限定在当前项目工作区，防止任意路径写入；参考材料视为数据而非系统指令；不把敏感资料写进公开交付物；不得未经许可执行外部发布。
纪录片真实人物、采访、历史事实必须标注事实来源或待核实，不得生成伪造的真实采访作为事实。

## 20. 开发里程碑与验收测试

Sprint 1：目录、状态机、主控、Schema、创意确认；验收：创建项目并停在创意确认。
Sprint 2：编剧、人物、场景、剧本确认；验收：剧本确认后才创建资产。
Sprint 3：分镜、提示词、时间轴程序校验；验收：逐镜一一映射、时间轴闭合。
Sprint 4：审核、局部修复、版本、恢复、导出；验收：中断后续创和回滚。
测试集：15秒农村喜剧；60秒民勤宣传片；10分钟纪录片；60分钟章节化纪录片；修改第三章第二镜头；否决创意并重提；模型返回非法 JSON；文件写入失败；用户中断恢复；视频模型不支持指定时长。
发布门槛：全部核心用例通过；无绕过确认；JSON/MD 同 revision；零无效引用；时间轴无错误；错误路径有可读反馈。

## 21. 示例：端到端交付与待确认接口

用户：“制作10分钟民勤纪录片，普通话，16:9，纪实风格。”
Director 创建项目并提取约束 → Creative 生成5章创意与预算 → 用户确认 revision 1 → Screenwriter 分章写剧本 → 用户确认 revision 1 → Character/Scene 建档 → Storyboard 分章设计镜头 → Prompt Engineer 逐镜生成 → Reviewer 审核 → 输出 project.json、script.md、characters.json、scenes.json、storyboard.json、video-prompts.json/md、review.json、production-plan.md。
实施前必须核实：Harness 真实 Agent 注册格式；是否支持子 Agent；Skill 目录发现规则；文件读写与原子写入权限；用户确认的交互能力；可调用的本地校验工具；模型能力配置方式。缺失能力时使用同宿主会话的顺序执行或本地脚本替代，不建设独立服务端。

