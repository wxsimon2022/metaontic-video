# Agent 提示词维护

八个专业角色分别在 `src/agents/<角色>/prompt.ts` 维护提示词正文。每个 `.ts` 文件只导出一个文本字符串，编辑模板字符串中的中文即可，不包含执行逻辑。

| 文件 | 角色 |
| --- | --- |
| director/prompt.ts | 总导演 |
| creative/prompt.ts | 创意策划 |
| screenwriter/prompt.ts | 编剧 |
| character/prompt.ts | 人物设计 |
| scene/prompt.ts | 场景美术 |
| storyboard/prompt.ts | 导演分镜 |
| prompt-engineer/prompt.ts | 视频提示词工程师 |
| reviewer/prompt.ts | 质量审核 |

角色入口 `src/businesses/film-production/roles/` 保留兼容转导出；角色选择、运行数据协议和类型策略仍由运行代码管理。短视频专项规则位于 `src/businesses/film-production/prompts/short-video.ts`，按时长与角色注入。

提示词随构建嵌入插件 `index.js`，安装后不需要读取源码目录。修改正文时同步根目录 `Agent_Prompts.md`，运行构建与测试；测试核对八个角色与文档一致，并检查专项加载范围。
