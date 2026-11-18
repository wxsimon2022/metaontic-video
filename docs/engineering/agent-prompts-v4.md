# Agent 提示词 V4.0 接入

八个角色的专业提示词与共同契约来自根目录 `Agent_Prompts.md`。角色正文集中位于 `src/agents/<角色>/prompt.ts`，`src/businesses/film-production/roles/` 仅保留兼容转导出，共同契约位于 `contracts/index.ts`，由角色注册入口统一注入。回归测试逐段比对文档原文，防止同步遗漏。

角色正文与根提示词文档直接使用当前工具提交字段；`roles/runtime-contract.ts` 补充运行约束与历史别名说明：创意段落使用 structure，剧本保留 screenplay/chapters/scenes/dialogue，人物与场景合并为 assets，镜头使用 shots，提示词使用 prompts，审核使用平铺报告。新产物不输出历史嵌套外壳；兼容别名不是另一套提交协议。

V4.0 是提示词版本，持久化 schema 仍沿用实际项目版本。版本审批、依赖、时间轴、引用、审核评分及费用授权继续由现有运行时代码控制，不能靠自然语言修改策略绕过。

四维 Profile Resolver 位于 `profiles/dimensions.ts`：genre、format、purpose、style_profile 分别解析并注入当前角色；tone 与自由文本 visual_style 独立。create/configure_profile 保存选择，read/next/route 返回解析结果及注册选项。旧 work_type 继续兼容。未选内容维度不自动推断，只有风格不能放行创意批准；配置冲突显式阻断。修改使原材料失效、清除批准并递增项目修订，原材料保留。终审 dimension_review 逐维检查版本、覆盖、证据与问题引用，未评估不能通过。审批记录和产物清单保留配置版本。本文档不表示新增自动独立 Agent 调度或视频执行能力。

本次修改仅涉及跨平台通用的提示词与数据适配，无路径、进程或安装行为变化。构建与模拟测试不调用付费接口，不代表 Windows/macOS 桌面或实际视频质量验证。

## 候选提交预检

`film_project validate` 只读检查候选 content 的 JSON 格式、全部必填顶层数组及现有结构/引用/时间轴规则；失败返回可定位问题，不修改项目修订与审批，不自动清空或补造道具。正常稿直接 submit，失败在同次调用集中返回问题；validate 保留为可选独立检查。最终写入仍执行原有并发、依赖和审批校验。assets 必须同时提供 characters/scenes/locations/scene_states/props，道具确实不适用时显式为空数组。

分镜与提示词的逐项数组要求集中在 `contracts/fields.ts`。next/route 返回 submission_contract，预检一次收集所有镜头缺失的 costume_ids/dialogue_refs 等字段，提交校验复用同一定义。没有对白才使用空 dialogue_refs；服装引用必须来自已批准角色的 costumes，不能自动填空绕过引用。

目标模型只接受真实模型 ID 或未指定，不接受占位文字。实际配置 ID 从 read/next 的 execution_plan.model_name 读取；项目已有占位值用 configure_profile 更新 target_model，不手改持久化文件。只改模型会保留创意/剧本及其批准，失效 assets/shots/prompts/review 并重新检查模型适配；改变创意相关配置仍按原规则重新审批。项目目标模型与实际配置不一致继续阻断 compile，不静默切换实际接入。

## 角色质量与专项加载

八个角色分别补充创作验收、独特切入、行动因果与潜台词、身份与造型分层、空间证据、可读分镜与交接、模型正文与制作说明分离、证据审核规则。根提示词文档与实际角色保持同源比对。

`roleInstructions` 对明确目标时长大于0且不超过60000毫秒的项目，注入短视频共用标准和当前角色唯一的专项卡；长片不加载短视频秒数策略，类型Profile仍独立解析。回归覆盖八角色隔离及60秒边界。镜头只对应独立提示词，实际生成任务与费用沿用production_strategy及制作编译，不改付费审批。

自动验证为构建和683项测试；没有进行实际模型创作对照或付费视频生成，不能把规则优化声称为已验证的成片质量提升。Windows与macOS使用相同提示词产物，本次未运行双平台桌面验证。
