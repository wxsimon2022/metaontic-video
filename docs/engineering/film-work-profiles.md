# 作品类型配置

## 运行接入

`src/businesses/film-director/profiles/` 是实际加载的配置注册层，六个文件分别定义剧情、喜剧、生活Vlog/氛围、纪录/知识、产品广告和品牌/地域宣传的策略、边界、角色补充、产物字段与审核准则。公共角色保持八种逻辑职责，不增加独立模型或后台执行器。

`createProjectSpec` 保存 `work_type`、运行时生成的 `profile_revision`、独立的 `narrative_mode` 与 `visual_style`。`genre` 继续保留为自由题材标签，不从自由文本偷偷推断已批准的类型。未选择类型的新项目显示 UNSELECTED；创意草拟可以继续，但批准前必须保存明确类型。旧项目无 work_type 字段显示 LEGACY_GENERIC，不自动迁移或失效既有批准。未知类型、未知配置修订、错误叙事方式直接报错，不静默回退。

`nextTask/routeIntent` 按项目配置返回 `work_profile`、当前阶段角色指令及类型补充；assets 的 Character/Scene 同时获得对应要求。复审沿用 Reviewer 类型规则。作品类型不等于风格或生成模式；MiniDV 可用于不同类型，IMAGE_TO_VIDEO 不是叙事方式。

## 修订与审批

`film_project configure_profile` 在同一个磁盘锁和原子提交中修改类型，要求 expectedRevision；projectSpec 仅允许 work_type 与可选 narrative_mode。有效变化增加项目修订，保留并失效所有产物、清空当前批准；原决策历史保留，旧制作绑定因 source_revision 不匹配而过期。相同配置不增加修订。停止的项目拒绝修改。

创意批准与剧本批准继续由真实 userQuestions 服务处理；批准记录带作品类型和配置修订。类型选择本身不等同用户已批准创意，也不触发任何生成。产物 profile_ref 和导出清单记录类型修订。后续扩展配置版本时必须显式增加加载/迁移支持，不能改旧版本内容后静默套用。

## 契约与审核

显式选择类型的 creative/script 产物要求 type_details，字段名来自该配置 creative_fields/script_fields，内容为非空文本。共同的场景、人物、对白、时间和引用契约保持有效。不同作品可以无人像、无对白或无冲突，不强行填入这些内容。

终审新增 type_review，必须匹配当前类型与配置版本，并用 criterion_id 完整覆盖 review_criteria；每项含 PASS/CONCERN/NOT_EVALUATED 与具体 evidence。CONCERN 需 issue_id 关联审核问题，艺术担忧与客观错误由 Reviewer 区分。NOT_EVALUATED 阻止 PASS/PASS_WITH_WARNINGS；严重错误仍按原问题台账与加权评分阻断，类型规则不豁免。

代码只核对结构、覆盖与版本，不能自动判定故事好坏、来源真伪或成片表演。类型检查文字通过不等于实际媒体质量通过。

## 画布

“创建需求”从同一注册表提供六种可选类型，默认未指定；选择随 metaonticRequirementSpec 保存，重新打开“写脚本”恢复并将 workType 传给服务端。服务端验证类型，文本写作复用相同策略及编剧/分镜补充，但保持既有 Markdown 分镜行数和付费段规划，不要求专业项目 JSON，不伪造专业审批。未选择类型不自动套用剧情片。

## 验证与平台影响

tests/film-profiles.test.mjs 覆盖六类及八角色加载、未知配置拒绝、版本独立、类型变更失效、批准门槛、类型扩展字段、审核覆盖及未评估阻断，并用临时数据目录运行真实 film_project 创建/审批/修改/重读。画布交互测试验证选择保存与写作传参。测试不访问付费接口。

配置文件编译入现有 Node/浏览器产物，无额外安装目录和外部依赖；持久化复用跨平台路径和原子写入。已在 macOS 自动测试，未进行 Windows 或 Harness 桌面实机验证；未运行付费视频来宣称风格差异或质量提升。
