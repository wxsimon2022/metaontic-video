# Agent 提示词 V4.0 接入

八个角色的专业提示词与共同契约来自根目录 `Agent_Prompts.md`。角色正文分别位于 `src/businesses/film-director/roles/`，共同契约位于 `contracts/index.ts`，由角色注册入口统一注入。回归测试逐段比对文档原文，防止同步遗漏。

`roles/runtime-contract.ts` 将文档的输出示例映射到当前工具协议：创意段落使用 structure，剧本保留 screenplay/chapters/scenes/dialogue，人物与场景合并为 assets，镜头使用 shots，提示词使用 prompts，审核使用平铺报告。文档中的外壳与别名不是新的工具参数。

V4.0 是提示词版本，持久化 schema 仍沿用实际项目版本。版本审批、依赖、时间轴、引用、审核评分及费用授权继续由现有运行时代码控制，不能靠自然语言修改策略绕过。

文档提出的 genre/format/purpose/style 四维 Profile Resolver 尚未实现；目前只注入已注册的 work_type/profile_revision/narrative_mode 与独立 visual_style。角色必须说明这一边界，不得虚构已解析配置。本文档不表示新增自动独立 Agent 调度或视频执行能力。

本次修改仅涉及跨平台通用的提示词与数据适配，无路径、进程或安装行为变化。构建与模拟测试不调用付费接口，不代表 Windows/macOS 桌面或实际视频质量验证。
