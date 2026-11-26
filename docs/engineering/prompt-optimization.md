# 提示词分阶段维护与验证

## 当前约定

- 用户明确改稿时先修改、展示新版再审核；仅要求继续审批时补弹当前有效版本，不要求批准旧稿。
- canonical_v1从scenes/beats/dialogue渲染screenplay；历史项目沿原契约保留正文。审批使用保存成功后的approval_material，不另写第二份剧情。
- 移除常驻导演角色正文和全部阶段字段清单。会话成功执行film_project创作操作后，只注入创作公共规则；编译成功或进入video_project制作后加载制作规则。具体角色与字段仍由nextTask/route及submission_contract提供。
- 阶段缓存仅存creation/production，按会话隔离，不保存提示词、台词、API密钥或项目材料。会话有id/header.id时使用最多128项缓存，无ID时用弱引用；重载或缓存未命中保守加载完整制作规则，通过read原项目恢复阶段。该缓存只优化上下文，不决定审批、权限或付费状态。
- 质量证据要求分别放在Creative、Screenwriter、Reviewer角色；资产数组和镜头引用只进入相关提交契约。公共规则继续约束版本、保存、审批、付费和未知提交防重。
- chapter_v1达到600秒或已有chapter_workbench时遵循chapter_plan/chapter_submit，由工具汇总，不额外提交整片聚合对象。历史非章节项目保留原路径。
- 续拍按新增内容、过渡、接缝、镜头、声音和限制组织；保留逐段过渡优先级、正反向续拍及原台词。关闭音频时不追加朗读要求；明确无对白且无对白线索时加载短规则，其他情况保留完整声音契约。

## 验证

- live-prompt.test.mjs使用实际构建注册与真实本地项目创建/读取，验证创作阶段常驻提示词少于制作阶段的65%、跨会话隔离、失败编译不切阶段，以及进入制作和恢复创作时切换规则。比较的是相同配置下的字符数，不能当作渠道token或费用数据。
- prompt-optimization.test.mjs覆盖角色字段隔离、章节策略、静音正反向续拍、空镜、逐字台词和会话ID兼容；既有video-transition、image-tasks、film-architecture等继续验证过渡、参数及状态边界。
- 本次执行构建、完整755项测试及git diff --check；不使用真实密钥，不请求付费模型。
- Windows/macOS共用相同提示词和会话状态逻辑；未改变路径、外部命令、安装或更新流程。本地自动检查通过，不等于Windows/macOS桌面实测。
- 创作质量沿用eval:film的六类案例与人工证据评阅机制。本次未调用真实模型、未新增人工盲评结果，不宣称故事艺术质量、生成画面或真实延迟已提升。
