# AI Film Director — DeepSeek Harness 专业视频脚本生成 Agent 系统设计文档 V2.0（开发实施版）

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



---

## 22. V2.0 实施约束与决策记录（ADR）

### 22.1 不可变需求

| 编号 | 需求 | 验证方式 |
|---|---|---|
| R-001 | 视频时长 15 秒至 3600 秒 | 边界测试：15、60、600、3600 秒 |
| R-002 | 创意和剧本均须人工确认 | 模拟未确认时调用下游，必须拒绝 |
| R-003 | 输出 Markdown 和 JSON | 对每个完成项目检查双份产物 |
| R-004 | 无独立服务端、无数据库 | 运行过程无监听端口、无外部存储依赖 |
| R-005 | 所有创作状态可从磁盘恢复 | 中断后重启继续同一任务 |
| R-006 | 局部修改不破坏已批准的上游内容 | 快照和依赖失效测试 |
| R-007 | 所有镜头有唯一 ID 和全局时间轴 | 程序校验唯一性与连续性 |
| R-008 | 纪录片区分已核实事实和创意性画面 | 来源登记和事实审查 |

### 22.2 ADR-001：文件系统是唯一事实来源

项目根目录中的 `project.json`、`progress.json`、`manifest.json` 是唯一权威状态；对话历史只用于交互，不能作为可恢复的状态数据库。写入采用“临时文件 → 校验 → 原子替换 → 更新 manifest”的顺序。任何子 Agent 不得直接改写 `progress.json`，由 Director 统一提交阶段状态。

### 22.3 ADR-002：创作与验证分离

大模型负责生成候选内容；确定性程序负责 JSON Schema、ID、时长、文件路径、引用完整性校验。Reviewer 负责叙事、连续性和可拍摄性等语义审查。**大模型声称通过不等于验证通过**。

### 22.4 ADR-003：能力适配而非假定 Harness API

`invoke_agent`、`read_file`、`write_file`、`ask_user`、`run_local_validator` 是本项目内部逻辑操作名，不是声称 DeepSeek Harness 原生存在的函数。落地前必须将其映射到当前版本真实可用的 Agent、Skill、工具或命令机制。若不支持子 Agent 调用，则使用 Director 在同一会话按角色提示词串行执行的降级模式；若不支持阻塞式人工确认，则通过保存 `WAIT_*` 状态并结束本轮实现确认。

## 23. 完整工程目录与文件生命周期

```text
ai-film-director/
├── AGENT.md                         # 主入口：只描述加载、路由和不可变规则
├── README.md
├── config/
│   ├── defaults.json                # 时长、语言、模型、质量阈值默认值
│   ├── workflow.json                # 状态与允许的迁移
│   ├── model-profiles.json          # 模型能力声明（需人工维护）
│   └── types.json                   # 视频类型枚举及模板绑定
├── agents/                          # 八份完整系统提示词
├── skills/                          # 七个 Skill，各自包含 SKILL.md
├── templates/                       # 六种视频类型模板
├── schemas/                         # 所有 JSON Schema（含版本）
├── scripts/                         # 可选本地校验、导出、迁移工具
├── fixtures/                        # 示例项目、失败样例、回归用例
├── docs/                            # 适配、操作、维护手册
└── projects/
    └── <project_id>/
        ├── project.json
        ├── progress.json
        ├── manifest.json
        ├── decisions.json           # 用户批准和修改指令日志
        ├── bible/
        │   ├── story-bible.md
        │   ├── character-bible.json
        │   ├── location-bible.json
        │   └── timeline.json
        ├── creative/
        │   ├── creative.json
        │   └── creative.md
        ├── script/
        │   ├── outline.json
        │   ├── script.json
        │   └── script.md
        ├── assets/
        │   ├── characters.json
        │   ├── scenes.json
        │   └── references/
        ├── chapters/
        │   └── ch-001/
        │       ├── chapter.json
        │       ├── screenplay.md
        │       ├── shots.json
        │       └── prompts.json
        ├── exports/
        │   ├── full-screenplay.md
        │   ├── full-storyboard.md
        │   ├── full-prompts.md
        │   └── project-package.json
        ├── reviews/
        │   ├── review-001.json
        │   └── review-001.md
        ├── logs/
        │   └── operations.jsonl
        ├── snapshots/
        └── .tmp/
```

**文件状态**：`draft`、`ready_for_review`、`approved`、`stale`、`rejected`。`approved` 文件只允许通过显式修订命令产生新版本；旧版保留在 `snapshots/`。每个导出文件应记录 `source_revision` 和 `generated_at`，防止用户把过期文件当作最终版。

## 24. 项目元数据、版本和 manifest 契约

### 24.1 project.json 完整示例

```json
{
  "schema_version": "2.0.0",
  "project_id": "afd_20261116_minqin_001",
  "title": "民勤：沙海里的家",
  "type": "DOCUMENTARY",
  "duration_seconds": 600,
  "aspect_ratio": "16:9",
  "language": "zh-CN",
  "narration_language": "普通话",
  "audience": "大众与家乡游客",
  "tone": ["纪实", "温暖"],
  "visual_style": "写实纪录片",
  "target_model": "generic",
  "creative_constraints": ["不得捏造采访对象的真实言论"],
  "status": "WAIT_CREATIVE_APPROVAL",
  "revision": 3,
  "created_at": "2026-11-16T15:00:00+08:00",
  "updated_at": "2026-11-16T15:10:00+08:00"
}
```

### 24.2 manifest.json

```json
{
  "schema_version": "2.0.0",
  "project_id": "afd_20261116_minqin_001",
  "revision": 3,
  "artifacts": [
    {
      "artifact_id": "creative-main",
      "path": "creative/creative.json",
      "kind": "creative",
      "revision": 2,
      "status": "ready_for_review",
      "depends_on": ["project:3"],
      "sha256": "<写入时由本地工具计算的哈希>"
    }
  ]
}
```

所有相对路径必须在项目根目录内；拒绝 `../` 越界、绝对路径和符号链接逃逸。`sha256` 必须真实计算，不能由 Agent 虚构。文件更新必须使用乐观版本检查：调用方提交 `expected_revision`，若与当前版本不符，停止覆盖并请求重新读取。

## 25. Agent 输入输出协议与任务信封

### 25.1 标准任务信封

```json
{
  "task_id": "task_00027",
  "project_id": "afd_20261116_minqin_001",
  "agent": "storyboard",
  "operation": "generate_chapter_shots",
  "stage": "STORYBOARD_DESIGN",
  "input_artifacts": [
    {"path": "script/script.json", "revision": 4},
    {"path": "assets/characters.json", "revision": 2},
    {"path": "assets/scenes.json", "revision": 2}
  ],
  "scope": {"chapter_ids": ["ch-001"], "shot_ids": []},
  "constraints": {"duration_seconds": 120, "language": "zh-CN"},
  "expected_output": "chapters/ch-001/shots.json",
  "schema_id": "storyboard@2.0.0",
  "retry_count": 0
}
```

### 25.2 标准任务结果

```json
{
  "task_id": "task_00027",
  "status": "success",
  "outputs": ["chapters/ch-001/shots.json"],
  "warnings": [],
  "validation": {"schema": "passed", "references": "passed", "timeline": "passed"},
  "next_action": "review_or_continue"
}
```

`status` 仅允许 `success`、`failed`、`needs_input`、`partial`；失败时提供 `error_code`、`message`、`retryable`、`failed_artifacts`。任务执行必须可重试：同一 `task_id`、相同输入版本不得产生重复镜头或重复审批。输出先进入 `.tmp/`，校验后再提交正式目录。

### 25.3 子 Agent 上下文边界

Creative：只读取项目需求和用户限制；Screenwriter：只读取已批准创意、全局故事设定、类型模板；Character/Scene：读取已批准剧本；Storyboard：读取已批准剧本、角色/场景档案及本章约束；Prompt Engineer：读取分镜和引用的资产、模型能力档案；Reviewer：读取当前交付范围内的所有工件及审核规则。不得把全量 60 分钟剧本每次都塞给每个镜头生成任务。

## 26. 工作流状态迁移表和审批协议

| 当前状态 | 触发事件 | 前置条件 | 下一状态 |
|---|---|---|---|
| INIT | create_project | 输入有效 | REQUIREMENT_ANALYSIS |
| REQUIREMENT_ANALYSIS | requirements_ready | 需求规格校验通过 | CREATIVE_DESIGN |
| CREATIVE_DESIGN | creative_ready | 创意 JSON+MD 均存在 | WAIT_CREATIVE_APPROVAL |
| WAIT_CREATIVE_APPROVAL | approve_creative | 版本匹配、用户明确确认 | SCRIPT_WRITING |
| WAIT_CREATIVE_APPROVAL | revise_creative | 修改指令已记录 | CREATIVE_DESIGN |
| SCRIPT_WRITING | script_ready | 剧本完整且校验通过 | WAIT_SCRIPT_APPROVAL |
| WAIT_SCRIPT_APPROVAL | approve_script | 版本匹配、用户明确确认 | ASSET_DESIGN |
| WAIT_SCRIPT_APPROVAL | revise_script | 修改指令已记录 | SCRIPT_WRITING |
| ASSET_DESIGN | assets_ready | 人物和场景引用完整 | STORYBOARD_DESIGN |
| STORYBOARD_DESIGN | shots_ready | 所有计划章节完成 | VIDEO_PROMPT_GENERATION |
| VIDEO_PROMPT_GENERATION | prompts_ready | 所有镜头提示词完整 | QUALITY_REVIEW |
| QUALITY_REVIEW | review_passed | 无阻断项且分数达标 | FINAL_DELIVERY |
| QUALITY_REVIEW | review_failed | 存在可定位问题 | TARGETED_REPAIR |
| TARGETED_REPAIR | repair_completed | 修复目标已重新校验 | QUALITY_REVIEW |

### 26.1 用户确认记录

```json
{
  "decision_id": "decision_004",
  "project_id": "afd_20261116_minqin_001",
  "stage": "creative",
  "action": "approve",
  "artifact_id": "creative-main",
  "artifact_revision": 2,
  "user_instruction": "确认创意，继续写剧本",
  "recorded_at": "2026-11-16T15:12:00+08:00"
}
```

**不能将“继续”“好的”无条件视为确认**：只有在当前明确处于等待确认状态，且展示了当前版本的待确认内容后，才可按上下文解释。若用户提出修改，应先修订并重新确认。审批必须绑定版本；一旦对应文件变化，旧审批自动失效。

### 26.2 人工确认消息模板

创意阶段：展示主题、梗概、章节规划、风格、时长、已知假设、待确认事项；结尾询问“确认本版创意进入剧本阶段，还是需要修改？”

剧本阶段：展示故事大纲、完整对白/旁白、章节时长、主要角色与场景、已知风险；结尾询问“确认本版剧本进入人物场景与分镜阶段，还是指定章节修改？”

## 27. 需求解析和默认值矩阵

| 字段 | 缺省策略 | 需要追问的情况 |
|---|---|---|
| type | 从输入内容分类，低置信度时标记推断 | 类型决定剧本结构且存在冲突 |
| duration_seconds | 用户未给时建议 60 秒，需明确为建议 | 用户要求严格控制但没有时长 |
| aspect_ratio | 默认 16:9 | 明确发布平台要求且格式冲突 |
| language | 默认简体中文、普通话对白 | 方言或多语言是剧情关键 |
| target_model | 默认 generic | 用户要求厂商特定能力但未指明模型 |
| style | 优先用户风格，其次类型模板 | 参考风格与禁用要求冲突 |
| audience | 根据主题推断并注明 | 涉及明确年龄分级或儿童内容 |
| character_count | 不擅自添加主要人物 | 用户要求固定人物数量但叙事不可完成 |

输入原文须原样保存 `source_brief`；Agent 推断的内容写入 `assumptions[]`，不能冒充用户明确要求。

## 28. 章节规划、时间预算与镜头分配算法

### 28.1 分层规划

1. 将目标时长 `T` 转为整数秒，限制 15 ≤ T ≤ 3600。
2. 根据类型模板生成章节候选，给每章分配 `target_duration`。
3. 计算章节时长之和必须等于 `T`；余数优先分配到结尾或过渡段，而非悄悄丢弃。
4. 对每章生成场景预算，再对场景生成镜头预算。
5. 每个镜头生成 `start_ms`、`end_ms`，避免浮点秒累积误差。
6. 章节跨界时采用全局时间轴和章节局部时间轴双坐标。

### 28.2 镜头数量估算

镜头数量不是固定公式。可以用 `N≈T/平均镜头长度` 作为初始规划，再由类型和动作复杂度调整。例如 60 秒宣传片平均 5 秒约 12 镜头；10 分钟纪录片平均 8 秒约 75 镜头；60 分钟可能涉及数百镜头，必须分批生成。这些仅是容量估算，不是强制标准。

### 28.3 精确时间线校验伪代码

```python
def validate_timeline(shots, expected_duration_ms):
    assert shots, 'EMPTY_SHOTS'
    shots = sorted(shots, key=lambda s: s['start_ms'])
    assert shots[0]['start_ms'] == 0, 'START_NOT_ZERO'
    cursor = 0
    seen = set()
    for shot in shots:
        sid = shot['shot_id']
        assert sid not in seen, 'DUPLICATE_SHOT_ID'
        seen.add(sid)
        assert shot['start_ms'] == cursor, 'GAP_OR_OVERLAP'
        assert shot['end_ms'] > shot['start_ms'], 'NONPOSITIVE_DURATION'
        assert shot['duration_ms'] == shot['end_ms'] - shot['start_ms'], 'DURATION_MISMATCH'
        cursor = shot['end_ms']
    assert cursor == expected_duration_ms, 'TOTAL_DURATION_MISMATCH'
```

该算法针对主画面剪辑轨道；旁白、音乐和叠加素材使用独立音视频轨道，不与主镜头时长简单相加。转场如交叉溶解必须明确 `overlap_ms` 并采用单独的编辑时间轴规则，不能直接复用零重叠算法。

## 29. 角色、场景和服装连续性约束

### 29.1 角色身份不可变字段

`character_id`、基础身份、稳定面部特征、人物关系、固定声音描述属于角色 Bible 的稳定字段。服装、发型和年龄变化属于带时间条件的状态字段；只有剧情明确要求时才新增 `appearance_state`，不能覆盖原有身份。

### 29.2 连续性引用

```json
{
  "shot_id": "sh-0012",
  "character_refs": [
    {"character_id": "char-001", "appearance_state_id": "look-001"}
  ],
  "scene_ref": {"scene_id": "sc-004", "environment_state_id": "env-morning"},
  "continuity": {"previous_shot_id": "sh-0011", "prop_state": ["prop-cup-on-table"]}
}
```

角色未出现在画面但有画外音时，必须使用 `voice_only_character_refs`，不能误标为出镜。纪录片真实人物与虚构演绎人物要有明确标签。角色外貌描述仅用于生成一致性，不可替代获得真实人物肖像使用许可。

## 30. 剧本语义协议与对白时长

每个剧本段落必须有 `beat_id`、`scene_id`、`purpose`、`action`、`dialogue[]`、`voiceover[]`、`estimated_duration_ms`。每句对白必须包含说话人 ID、文本、语速、停顿和可选情绪/表演指导。不能把所有对白写在单个字符串里，否则无法定位修订。

对白时长估算：`estimated_seconds = 中文字符数 / 语速(字/秒) + 停顿秒数`。常规口语可以先以 3–4 字/秒作为初值，具体依据人物年龄、情绪、方言和表演复核。多个角色交替对话要计入转接停顿；画外音可以与画面动作并行，不应重复加到主画面总时长。

**对话示例：**

```json
{
  "dialogue_id": "dlg-001",
  "speaker_id": "char-001",
  "text": "这瓜啊，得等它自己熟。",
  "delivery": "平静、自然",
  "speech_rate_cps": 3.2,
  "pause_after_ms": 500,
  "on_screen": true,
  "source": "scripted"
}
```

## 31. 提示词构建器和模型能力适配

### 31.1 统一提示词 IR（中间表示）

```json
{
  "shot_id": "sh-001",
  "subject": "一名中年瓜农",
  "identity_constraints": ["深蓝工作服", "短发", "外貌与角色参考一致"],
  "setting": "民勤蜜瓜田，清晨自然光",
  "action": "弯腰查看蜜瓜表皮，轻轻托起果实",
  "camera": {"framing": "中景", "movement": "缓慢侧向跟拍"},
  "style": "真实乡土纪录片",
  "audio": {"dialogue": [], "ambience": ["轻风", "田间虫鸣"]},
  "constraints": ["单一连续镜头", "不新增人物", "无水印"],
  "duration_seconds": 8,
  "aspect_ratio": "16:9"
}
```

### 31.2 模型能力档案

```json
{
  "profile_id": "generic",
  "display_name": "通用视频模型",
  "capabilities": {
    "text_to_video": "unknown",
    "image_to_video": "unknown",
    "native_audio": "unknown",
    "lip_sync": "unknown",
    "supported_durations_seconds": [],
    "supported_aspect_ratios": []
  },
  "prompt_format": "natural_language",
  "verified_at": null,
  "source": "需根据目标模型官方资料维护"
}
```

`unknown` 不是 `true`。如果模型原生音频或指定时长能力未验证，不可承诺一条提示词能生成完整音画。对于 60 分钟项目，最终产物是分镜及逐镜生成计划，而非声称单次生成 60 分钟视频。

### 31.3 提示词拼装顺序

`主体身份 → 场景 → 具体动作 → 摄影机 → 光线与风格 → 音频 → 明确限制`。不要输出“很震撼”“很有电影感”等不可观察形容词代替可拍摄内容。避免同一提示词要求多次地点切换、人物突然换装或互相矛盾的摄影机动作。

### 31.4 模型适配降级

- 不支持原生对白：提示词仅描述表演和口型需求，另输出配音/TTS 任务，不虚构同步成功。
- 不支持目标镜头时长：标记 `requires_split=true` 并拆分为多个连续镜头建议，等待用户确认对分镜的修改。
- 不支持参考图：强化人物文字描述并将一致性风险标记为 `high`。
- 不支持目标画幅：提示人工选择裁切/扩边方案，不能静默改变画幅。

## 32. 七个 Skill 的正式执行契约

所有 Skill 均应包含 YAML 元数据（仅在实际 Harness 支持该格式时启用）、适用范围、输入文件、操作步骤、输出文件、校验规则、失败处理和示例。不能只写几段知识说明。

### 32.1 video-planning

输入：用户原始需求、项目默认值。输出：`creative/creative.json` 和 `creative.md`。步骤：解析约束→识别类型→拟定主题→生成结构→分配时长→列出假设→自检。校验：核心主题、受众、时长、类型均存在；无未经授权的主要人物。

### 32.2 screenwriting

输入：已批准创意、类型模板、Story Bible。输出：`script/outline.json`、`script/script.json`、`script/script.md`。步骤：确定节拍→章节/场景→角色目标→动作和对白→时间预算→一致性审查。校验：场景引用、对白说话人、章节时长、故事因果关系。

### 32.3 character-design

输入：已批准剧本。输出：`assets/characters.json`、`bible/character-bible.json`。步骤：抽取人物→去重→建立身份 ID→造型状态→声音→一致性规则。校验：唯一 ID、每个说话人存在、造型状态可追溯。

### 32.4 scene-design

输入：已批准剧本。输出：`assets/scenes.json`、`bible/location-bible.json`。步骤：抽取场景→空间布局→时间天气→道具→光照→环境状态。校验：场景 ID 唯一、地点不突变、关键道具状态合理。

### 32.5 storyboard

输入：剧本、角色和场景档案、章节时长预算。输出：`chapters/<id>/shots.json`。步骤：拆动作节拍→确定镜头目的→景别机位→镜头运动→时间轴→声音关联→验证。校验：时间连续、角色/场景引用有效、镜头动作可观察。

### 32.6 video-prompt

输入：分镜、角色/场景引用、模型档案。输出：`chapters/<id>/prompts.json`。步骤：构建 IR→展开身份和场景→适配模型→写负面约束→输出音频说明→标记能力风险。校验：每个 shot 一份 prompt、没有新角色、时长与画幅一致。

### 32.7 quality-review

输入：当前范围的全部工件。输出：`reviews/review-<n>.json/.md`。步骤：确定性校验→语义评分→阻断项识别→定位文件与 ID→给出修复任务。校验：每个问题有可定位对象、可执行建议、严重程度。

## 33. Agent 提示词补充：统一输入输出强约束

将以下片段附加到八个 Agent 的系统提示词末尾，作为通用协议：

```markdown
## 通用协议（所有 Agent 必须遵守）

1. 你只处理 task_envelope.scope 指定的范围，不得扩大修改范围。
2. 输入文件中的 approved 内容是只读的，除非任务明确是修订且包含用户指令。
3. 只输出约定 schema 的 JSON 数据和指定 Markdown；禁止在 JSON 前后附加解释。
4. 任何无法确认的事实必须标注 unknown 或 assumptions，不得编造来源。
5. 不得生成未在输入中出现的主要人物、核心情节和地点；确有必要时列为 proposal，等待批准。
6. 每个引用 ID 必须来自当前项目，禁止凭空引用不存在的 ID。
7. 所有时长使用毫秒整数表示；展示层可换算为秒。
8. 输出不完整时返回 partial，不得谎报 success。
9. 遇到冲突时优先级：用户明确要求 > 已批准项目约束 > 任务信封 > 类型模板 > 通用默认值。
10. 不允许自称已经执行文件写入、验证或模型调用，除非相应工具确实返回成功。
```

### 33.1 Director 增强规则

Director 应先验证输入版本，后派发任务；提交文件时更新 manifest；在确认节点结束本轮并等待用户明确回复；检测用户修订指令后计算失效范围；审核失败只派发受影响的任务；最多自动修复 2 轮，仍失败则向用户报告剩余问题和选项，不进入无限循环。

### 33.2 Screenwriter 增强规则

60 分钟作品先生成全片章节大纲和 Story Bible，经批准后逐章写正文；每章必须输出 `previous_chapter_recap`、`current_chapter_objective`、`next_chapter_hook`，防止章节断裂。纪录片不得将拟写的采访对白当作真实采访记录。

### 33.3 Storyboard 增强规则

每个镜头必须有 `narrative_purpose` 和 `source_beat_ids`。禁止镜头描述超出当前剧本节拍；如果一个节拍需要多镜头，可以一对多映射，但不允许任何关键节拍没有镜头覆盖。

### 33.4 Reviewer 增强规则

必须先执行或读取确定性验证结果，再进行语义审核；若确定性验证失败，`passed=false`，即使语义分数高也不得通过。输出每个问题的 `owner_agent`、`artifact_path`、`entity_id`、`suggested_patch_scope`。

## 34. JSON Schema：可直接实现的关键结构

以下是 V2 最小可执行 Schema，使用 JSON Schema Draft 2020-12。正式项目应拆分为独立文件并补充枚举和跨文件引用检查。跨文件引用、时间连续性不能仅靠 JSON Schema 完成，需额外校验器。

### 34.1 project.schema.json

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://example.invalid/afd/project.schema.json",
  "type": "object",
  "additionalProperties": false,
  "required": ["schema_version", "project_id", "title", "type", "duration_seconds", "aspect_ratio", "language", "status", "revision"],
  "properties": {
    "schema_version": {"const": "2.0.0"},
    "project_id": {"type": "string", "pattern": "^afd_[a-zA-Z0-9_-]+$"},
    "title": {"type": "string", "minLength": 1},
    "type": {"enum": ["DOCUMENTARY", "SHORT_FILM", "COMEDY", "COMMERCIAL", "PROMOTIONAL", "SERIES"]},
    "duration_seconds": {"type": "integer", "minimum": 15, "maximum": 3600},
    "aspect_ratio": {"enum": ["16:9", "9:16", "1:1", "4:3", "2.35:1"]},
    "language": {"type": "string", "minLength": 2},
    "narration_language": {"type": "string"},
    "audience": {"type": "string"},
    "tone": {"type": "array", "items": {"type": "string"}},
    "visual_style": {"type": "string"},
    "target_model": {"type": "string"},
    "creative_constraints": {"type": "array", "items": {"type": "string"}},
    "status": {"type": "string", "minLength": 1},
    "revision": {"type": "integer", "minimum": 1},
    "created_at": {"type": "string", "format": "date-time"},
    "updated_at": {"type": "string", "format": "date-time"}
  }
}
```

### 34.2 storyboard.schema.json

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "required": ["chapter_id", "shots"],
  "properties": {
    "chapter_id": {"type": "string", "minLength": 1},
    "shots": {
      "type": "array", "minItems": 1,
      "items": {
        "type": "object", "additionalProperties": false,
        "required": ["shot_id", "scene_id", "start_ms", "end_ms", "duration_ms", "narrative_purpose", "visual_description", "camera", "character_refs"],
        "properties": {
          "shot_id": {"type": "string", "minLength": 1},
          "scene_id": {"type": "string", "minLength": 1},
          "start_ms": {"type": "integer", "minimum": 0},
          "end_ms": {"type": "integer", "minimum": 1},
          "duration_ms": {"type": "integer", "minimum": 1},
          "narrative_purpose": {"type": "string", "minLength": 1},
          "source_beat_ids": {"type": "array", "items": {"type": "string"}},
          "visual_description": {"type": "string", "minLength": 1},
          "character_refs": {"type": "array", "items": {"type": "string"}},
          "camera": {
            "type": "object", "required": ["framing", "movement"],
            "properties": {"framing": {"type": "string"}, "movement": {"type": "string"}, "angle": {"type": "string"}}
          },
          "dialogue_ids": {"type": "array", "items": {"type": "string"}},
          "voiceover_ids": {"type": "array", "items": {"type": "string"}},
          "audio_notes": {"type": "string"},
          "transition": {"type": "string"}
        }
      }
    }
  }
}
```

### 34.3 review.schema.json

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "required": ["review_id", "scope", "score", "passed", "issues"],
  "properties": {
    "review_id": {"type": "string"},
    "scope": {"type": "string"},
    "score": {"type": "integer", "minimum": 0, "maximum": 100},
    "passed": {"type": "boolean"},
    "issues": {"type": "array", "items": {
      "type": "object",
      "required": ["issue_id", "severity", "owner_agent", "artifact_path", "entity_id", "description", "suggestion"],
      "properties": {
        "issue_id": {"type": "string"},
        "severity": {"enum": ["blocker", "major", "minor", "info"]},
        "owner_agent": {"type": "string"},
        "artifact_path": {"type": "string"},
        "entity_id": {"type": "string"},
        "description": {"type": "string"},
        "suggestion": {"type": "string"}
      }
    }}
  }
}
```

**注意**：上面的 `$id` 使用 `.invalid` 占位，表示本地 Schema 标识，不应被当作真实线上地址。`format: date-time` 是否强制校验取决于验证器配置。

## 35. 确定性校验器设计

建议至少实现以下函数：

```python
validate_schema(artifact_path, schema_path)
validate_project_bounds(project)
validate_unique_ids(artifacts)
validate_references(project, script, characters, scenes, shots)
validate_timeline(shots, expected_duration_ms)
validate_chapter_sums(chapters, total_duration_ms)
validate_prompt_coverage(shots, prompts)
validate_approval_revision(progress, decisions, manifest)
validate_manifest_integrity(manifest, project_root)
validate_export_freshness(exports, manifest)
```

校验输出统一为：

```json
{
  "validator": "timeline",
  "passed": false,
  "errors": [
    {
      "code": "GAP_OR_OVERLAP",
      "artifact": "chapters/ch-001/shots.json",
      "entity_id": "sh-008",
      "message": "镜头起点与上一镜头终点不一致"
    }
  ]
}
```

校验程序应返回非零退出码表示失败；日志要记录错误代码、文件和 ID，禁止在校验失败时仍将阶段设为 completed。

## 36. 局部修订、失效传播和版本回滚

### 36.1 依赖图

`project requirements → creative → script → characters/scenes → shots → prompts → review → exports`。任何节点变更，直接依赖它的节点标记为 `stale`；但不是所有下游都必须全文重生成。例如角色服装变更，只失效引用该 `character_id` 的镜头提示词及相关审核结果。

### 36.2 变更分类

| 变更 | 最小重算范围 | 是否重新确认 |
|---|---|---|
| 标题文字 | 项目元数据和导出封面 | 否 |
| 创意核心主题 | 创意及所有下游 | 是，创意与剧本 |
| 单章对白 | 该章剧本、相关镜头、提示词、审核 | 是，剧本修订 |
| 人物服装 | 相关人物状态、关联镜头提示词 | 视是否改变已批准剧情 |
| 单镜运镜 | 指定镜头、对应提示词、局部审核 | 通常不需重审剧本 |
| 模型类型 | 提示词适配结果和能力审查 | 否 |
| 总时长 | 章节预算、场景、镜头、提示词 | 是，若影响剧情 |

### 36.3 修订事务步骤

1. 接收用户修改指令，解析 `target_artifact` 和 `target_entity_ids`。
2. 验证当前版本和审批状态。
3. 创建快照，记录 `change_request`。
4. 在临时目录生成修订候选。
5. 进行结构和语义校验。
6. 原子提交目标文件，递增 revision。
7. 计算依赖失效集合，标记 `stale`。
8. 更新进度与 manifest，输出修改摘要。
9. 按需要请求重新确认。

回滚必须恢复文件内容、manifest 引用和进度状态；不能只把某个 Markdown 文件复制回去。

## 37. 失败重试、断点续创与幂等

### 37.1 故障分类

| 错误代码 | 含义 | 处理 |
|---|---|---|
| MODEL_TIMEOUT | 模型超时 | 同一任务最多重试两次 |
| INVALID_JSON | 生成 JSON 无法解析 | 先结构修复一次，仍失败重新生成 |
| SCHEMA_FAIL | 字段不符合协议 | 提供校验错误，局部修复 |
| MISSING_REF | 引用人物/场景不存在 | 回退到资产校验 |
| APPROVAL_REQUIRED | 缺少有效审批 | 保存状态，等待用户 |
| REVISION_CONFLICT | 输入版本已变化 | 停止提交，重新读取 |
| FILE_WRITE_FAIL | 写文件失败 | 保留临时文件，禁止标记完成 |
| REVIEW_BLOCKED | 语义审核未通过 | 定向修复，最多两轮 |
| MODEL_CAPABILITY_UNKNOWN | 目标模型能力不确定 | 输出风险说明，不承诺可生成 |

### 37.2 断点恢复算法

```text
load project.json, progress.json, manifest.json
validate manifest and approved revisions
find last committed stage
if current stage is WAIT_*:
    show exact artifact revision and ask for approval
elif partial task exists:
    compare task input revisions with current manifest
    if same: resume or retry missing outputs
    else: invalidate task and replan affected scope
else:
    dispatch next permitted stage
```

恢复时不能因为 `progress.json` 声称完成就忽略实际文件缺失；必须交叉检查 manifest 与磁盘文件。日志可以用于诊断，但不能单独作为提交成功证据。

## 38. 质量审核评分细则与阻断项

| 维度 | 权重 | 评分依据 |
|---|---:|---|
| 创意契合度 | 10 | 是否保留用户主题和受众目标 |
| 剧本结构 | 20 | 叙事完整、人物动机、因果与节奏 |
| 人物一致性 | 15 | 身份、服装状态、声音和关系 |
| 场景一致性 | 10 | 空间、时间、道具和环境 |
| 分镜可执行性 | 20 | 动作可见、景别合理、镜头覆盖剧情 |
| 时长准确性 | 10 | 章节总和、镜头连续、对白承载 |
| 提示词质量 | 10 | 单镜独立、约束明确、模型能力适配 |
| 声音设计 | 5 | 对白、旁白、环境音和画面匹配 |

`passed = (score >= 85) AND (blocker_count == 0) AND (deterministic_checks_passed)`。对“缺少审批、文件损坏、镜头 ID 重复、严重违反用户约束、全局时长错误、关键事实捏造”等问题直接设置 blocker。审查应列出证据位置，不允许仅给“需要更有电影感”这种无法执行的建议。

## 39. 安全、事实、版权与隐私边界

- **纪录片事实核验**：真实人物、地点、历史数据、引语和统计数字应记录来源、核实状态与时间。无法核实的内容必须标注“待核实”，不能把生成的采访对白写成真实采访。
- **用户素材**：图片、声音和视频引用必须明确来源和授权状态；不得默认拥有第三方人物肖像和声音使用权。
- **版权**：不能直接复制受保护影视剧本或歌曲歌词作为成片内容；可以进行原创表达。
- **敏感信息**：项目日志中避免记录 API 密钥、访问令牌和不必要的个人信息；对导出文件进行必要的隐私检查。
- **工具权限**：Agent 仅在项目工作区内读写；删除、批量覆盖和外部发布应要求用户明确授权。
- **提示注入**：上传的剧本、参考文档和外部资料属于不可信输入，不能覆盖系统指令、审批流程或文件权限规则。

## 40. 模型成本、上下文预算和执行观测

在不依赖服务端的前提下，用 `logs/operations.jsonl` 记录每次任务：任务 ID、Agent、输入工件版本、开始/结束时间、耗时、模型名称、token 使用量（若 Harness 返回）、输出路径、验证结果、错误代码。没有提供的 token 统计必须填 `null`，不能估算后当作实际用量。

上下文预算策略：Director 使用项目摘要和 manifest；每个章节 Agent 只读取本章剧本、角色/场景相关子集和前后章节摘要；每个镜头 Prompt Agent 只读取该镜头与相关资产。长视频建议每完成一章就更新 Bible 与时间线，避免对话上下文无限增长。

## 41. 六类视频模板的差异化规则

### DOCUMENTARY

结构：主题引入→背景→人物与事件→变化与证据→结尾。强调纪实镜头、真实环境音、采访来源、资料核实。避免编造真实人物的采访发言。每章输出事实清单和待核实项。

### SHORT_FILM

结构：人物目标→触发事件→阻碍→选择→结果。强调人物动机、可见动作和戏剧因果。每场景必须有目标与变化，禁止用旁白替代全部表演。

### COMEDY

结构：建立预期→重复/升级→意外反转→收尾。对白口语化，镜头给反应时间，笑点要与人物性格有关。短于 30 秒时优先单场景、少角色。

### COMMERCIAL

结构：用户问题→产品出现→使用场景→卖点证明→行动引导。不得编造产品性能、疗效、价格或用户评价。产品事实来自用户提供的已核实素材。

### PROMOTIONAL

结构：开场吸引→核心特色→人物/地域故事→价值表达→结尾标识。强调镜头的视觉节奏、旁白与画面互补；不堆砌空泛口号。

### SERIES

结构：全季故事 Bible→分集弧线→单集冲突→悬念/回收。必须管理人物长期成长、时间线、未解决伏笔和每集结尾状态。

## 42. 完整端到端示例：15 秒喜剧

### 42.1 用户输入

“两个农村老头讨论退休金。老张退休金高但身体不好；老李没有退休金但身体很好。15 秒，16:9，真实生活风格，普通话。”

### 42.2 创意提案

标题：《谁更富》。人物：老张、老李。场景：北方农村院门口。核心冲突：收入数字和生活状态反差。结构：0–4 秒老张炫耀；4–10 秒老李反问；10–15 秒老张看着药盒语塞。**此处等待用户确认创意。**

### 42.3 剧本候选

- 0–4 秒：老张坐在椅子上，拍拍衣兜：“我一个月退休金两万。”
- 4–10 秒：老李站在旁边活动肩膀：“你天天吃药，我天天下地。咱俩谁过得舒坦？”
- 10–15 秒：老张低头看手里的药盒，停顿。老李笑着走开。

这段对白应进行口播时长校验，若表演节奏超时则缩短台词。**此处等待用户确认剧本。**

### 42.4 镜头规划（演示版）

| shot_id | 全局时间 | 景别 | 内容 | 音频 |
|---|---|---|---|---|
| sh-001 | 0–4s | 中景 | 老张坐椅子上拍衣兜 | 老张对白 |
| sh-002 | 4–10s | 双人中景 | 老李活动肩膀，反问老张 | 老李对白 |
| sh-003 | 10–15s | 老张近景 | 老张低头看药盒，欲言又止 | 环境音、轻微停顿 |

### 42.5 独立视频提示词示例（sh-003）

> 16:9 横屏，5 秒，真实北方农村生活纪实风格。北方农村土院门口，白天自然散射光，一名约 65 岁的中国男性老人坐在旧木椅上，灰白短发，面部皱纹明显，穿深蓝色旧外套。他低头看手里一个普通药盒，嘴角微微抽动，张了张嘴却没有说话。固定近景，摄影机与人物视线接近，背景保留院墙和木门虚化轮廓。自然环境音，无字幕、无水印，不新增人物，不改变服装，不切换场景。

### 42.6 审核

检查人物造型与前镜一致、总时长 15 秒、三镜头时间连续、对白可承载、提示词没有引入额外人物。若所有确定性校验通过且语义审核达标，则导出 Markdown + JSON。

## 43. 完整端到端示例：60 分钟纪录片

主题：《民勤：沙海里的家》。建议先生成并确认全片创意，再生成全片章节大纲和剧本框架，经用户确认后分章完成详细剧本和分镜。示例章节预算：第一章 8 分钟、第二章 12 分钟、第三章 15 分钟、第四章 15 分钟、第五章 10 分钟，总计 60 分钟。该分配只是创作候选，不代表已核实的真实纪录片素材。

**章节执行循环：**

```text
for chapter in approved_outline.chapters:
    load story_bible + adjacent_chapter_summaries
    write detailed chapter screenplay
    validate chapter beats and duration budget
    build chapter-specific character/scene references
    generate chapter storyboard in bounded batches
    validate shot IDs, references and timeline
    generate prompt for each shot
    run chapter QA and repair
    commit chapter snapshot
    update story_bible and global timeline
run cross_chapter_continuity_review
export all chapters and full project manifest
```

分批大小根据模型上下文和输出稳定性调整，例如一次生成 5–12 个镜头，不能把该范围写成模型硬限制。每批结束后都进行结构校验并提交快照。若第 4 章失败，前三章不应丢失。最终审核应检查章节连接处的时间、人物状态、主题重复和旁白风格一致性。

## 44. 测试矩阵与验收用例

| 用例 | 输入/操作 | 预期结果 |
|---|---|---|
| T-001 | 15 秒视频 | 创建成功，主轨时长恰为 15000ms |
| T-002 | 3600 秒视频 | 分章规划，章节总和恰为 3600000ms |
| T-003 | 14 秒视频 | 拒绝或明确请求调整 |
| T-004 | 3601 秒视频 | 拒绝或明确请求调整 |
| T-005 | 创意未批准时要求生成分镜 | 阻止并提示确认 |
| T-006 | 修改创意后使用旧审批 | 拒绝，旧审批失效 |
| T-007 | 同一任务重试两次 | 不产生重复镜头或重复提交 |
| T-008 | 镜头引用不存在的人物 | 校验失败并定位 ID |
| T-009 | 镜头时间存在 200ms 空隙 | 校验失败 |
| T-010 | 第三章生成中途退出 | 恢复时从未提交部分继续 |
| T-011 | 只修改 sh-008 运镜 | 只失效相关提示词和审核 |
| T-012 | 导出文件源版本落后 | 标记 stale 并重新导出 |
| T-013 | 目标模型音频能力 unknown | 不声称原生音频可用 |
| T-014 | 纪录片包含未核实数字 | 标记待核实，不能当事实输出 |
| T-015 | JSON 缺少 required 字段 | Schema 校验失败 |
| T-016 | 写入中断留下临时文件 | 不改变已提交版本 |
| T-017 | 文件路径含 ../ | 拒绝越界访问 |
| T-018 | 用户要求回滚上一版 | 恢复 manifest、状态和工件一致性 |
| T-019 | 角色在同一场景突然换装 | 连续性审核报错 |
| T-020 | 同时存在对白和画外音 | 分轨处理，不重复计入主轨时长 |

**验收门槛**：全部阻断性用例通过；对 15 秒、60 秒、10 分钟、60 分钟四种时长分别完成一次端到端创作；每个完成项目具有 MD+JSON、审批记录、manifest、审核报告和可恢复的状态文件。

## 45. 开发任务分解与交付清单

### Sprint 1：运行基础

交付：项目目录初始化、配置默认值、project/progress/manifest 读写、状态机、审批记录、Schema 校验器、原子写入。验收：能创建项目，生成创意并停在确认节点，重启后状态不丢失。

### Sprint 2：创作闭环

交付：Director/Creative/Screenwriter/Character/Scene 的真实 Harness 适配、六类模板、人物场景 Bible。验收：确认创意和剧本后能生成可校验的剧本及资产。

### Sprint 3：镜头生产

交付：Storyboard/Prompt Engineer、模型能力档案、分镜时间线校验、逐镜提示词。验收：镜头覆盖完整、时长准确、提示词不引入新人物。

### Sprint 4：可靠性和长视频

交付：Reviewer、依赖失效传播、定向修复、快照回滚、断点续创、章节批处理、完整导出。验收：通过 20 项测试矩阵及 60 分钟章节化测试。

### 45.1 Definition of Done

每个功能完成必须同时满足：有可执行输入样例、有输出 Schema、有错误码、有至少一个失败测试、有操作日志、有恢复策略、有对应用户可见结果。仅“模型能输出一段文字”不算功能完成。

## 46. Harness 实际接入前必须核对的接口清单

以下项目必须从你实际使用的 DeepSeek Harness 仓库或安装版本中确认，不允许凭空写死：

1. Agent 的注册入口和文件命名规则；是否支持动态子 Agent。
2. Skill 的发现路径、元数据格式、加载时机和作用域。
3. 工具调用是否支持文件读写、执行本地命令、返回结构化结果。
4. 工作区根路径和文件访问权限；是否允许创建 `projects/`。
5. 人工确认能否跨轮次保持状态；是否有原生暂停/恢复。
6. 模型路由配置、上下文长度、最大输出限制和重试语义。
7. 并行任务和文件锁的支持情况。
8. 本地脚本执行环境：Python/Node/Shell 是否可用。
9. 是否支持输出 JSON Schema 约束；若不支持，采用生成后校验。
10. 是否提供 token 使用量、调用耗时和错误详情。

### 46.1 三档兼容方案

**A 档：Harness 原生多 Agent + 工具 + 暂停恢复。** 直接按状态机编排并使用原生工具提交文件。

**B 档：Harness 支持 Agent/Skill 和文件工具，但没有原生暂停恢复。** Director 在 `WAIT_*` 阶段保存文件并结束回合；下一次用户确认后继续。

**C 档：Harness 仅支持单 Agent + 文件/命令。** 通过 Director 顺序加载不同角色提示词完成同一套工作流；不声称真正存在独立子 Agent 运行时。仍保留八份提示词、数据契约与阶段确认。

## 47. 维护、升级与兼容性

Schema 版本遵循语义版本：增加可选字段为次版本；删除或重命名字段为主版本。每个项目记录 `schema_version`，升级时先备份再迁移。模型能力档案需要定期核对，但不能通过未经验证的网上传言自动更新。Agent 提示词应带版本号并写入任务日志，保证同一项目的结果可追溯。

发布前应执行：Schema 回归测试、20 项验收用例、4 种时长端到端测试、文件恢复测试、越界路径测试和 Markdown/JSON 导出一致性检查。

## 48. 最终交付清单与实施边界

本设计文档提供：需求基线、架构、目录、八个 Agent 提示词、七个 Skill 执行契约、六种模板、统一任务信封、状态迁移、审批协议、长视频分批算法、关键 JSON Schema、确定性校验器设计、版本回滚、失败恢复、模型适配、测试矩阵和实施计划。

**尚需结合实际仓库完成的工作**：Harness Agent/Skill 的真实注册配置、实际工具调用封装、可运行校验脚本、完整 Schema 文件集、自动化测试代码和演示项目文件。设计文档不能代替这些实现；不应将其标记为已经可以直接执行的完整插件。
