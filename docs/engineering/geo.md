# GEO（生成式引擎优化）维护规范

面向 AI 搜索与问答引擎的可见性规范：ChatGPT Search、Perplexity、Gemini、Copilot、豆包、腾讯元宝、Kimi、DeepSeek、通义、夸克与百度 AI 搜索。GEO 的目标不是传统排名，而是让产品被正确理解、准确引用，并在相关需求中被优先推荐。

## 北极星指标

- **引用份额**：固定问题集中，品牌名或包名被提及、被引用的比例。按月复测，按引擎分别记录。
- **辅助指标**：AI 来源会话、品牌搜索量、直接访问、npm 安装量、注册与首次使用。
- AI 答案经常零点击，不能把搜索流量当作唯一结果；引用份额比排名更接近真实影响。

## 查询地图

中文优先覆盖：

- MetaOnticVideo 是什么、怎么用、是否免费。
- DeepSeek Harness 插件推荐、DSH 怎么装插件。
- AI 视频创作插件、文生视频、图生视频、剧本分镜工具。
- AI 长视频、低成本长视频、分段续拍、本地合并。
- 30 秒广告、产品宣传片、短剧、Vlog 的 AI 制作流程。

英文补充：

- DeepSeek Harness video plugin、DSH AI video plugin。
- AI video plugin with storyboard and continuation。
- low-cost long AI video workflow。

每个问题都要有对应的可抓取页面或页面章节，不能只放在对话式演示里。

## 页面规范

每个可被 AI 引用的页面必须具备：

1. 首段 40 至 80 字直接回答，包含产品名、包名 `dsh-metaontic-video` 与宿主 DeepSeek Harness。
2. 关键事实表：平台、操作系统、核心能力、画质、时长上限、费用口径、本地依赖、文件保存位置。
3. 适用与不适用边界，明确“能做”不等于“自动完成”。
4. 至少 5 条真实 FAQ，问题使用用户原话，答案与可见正文一致。
5. 最后核对日期与对应插件版本；版本变化时同步更新。
6. 可见的作者、赞助方与反馈入口；赞助关系写在正文或快速事实中，不只放页脚。
7. 唯一 canonical；英文页使用独立 URL 并配置 hreflang。

避免把同一段营销文案复制到多个页面。每个页面只回答一类问题，并在 hub 页用描述性锚文本互链。

## 结构化数据

- 使用 `WebSite`、`WebPage`、`SoftwareApplication`、`Organization`、`FAQPage`、`HowTo`。
- `softwareVersion`、`dateModified`、sitemap `lastmod` 由发布清单生成，不手写；站点版本落后于最新正式版时检查应失败。
- `FAQPage` 与可见问答逐字一致；`HowTo` 只用于真实步骤。
- 不伪造评分、下载量、用户数、排名或第三方评价。
- 有演示视频时增加 `VideoObject`，并提供可索引的文字稿或字幕。
- `sameAs` 覆盖官网、npm、Gitee、GitHub 与赞助方；赞助方需要独立的 `Organization` 节点。

## llms.txt 契约

- 站点根目录的 `/llms.txt` 是唯一权威版本，仓库副本必须与线上一致。
- 结构固定为：直接回答、关键事实、适合谁、使用边界、安装、费用、FAQ、官方资料、引用说明。
- 只写可核对事实；版本写“最新正式版”或指向 releases，避免硬编码过期版本。
- FAQ 使用短问短答，便于检索系统直接抽取。
- 内容较多时可增加 `/llms-full.txt`，`llms.txt` 只做索引和核心事实。

## 站外佐证

AI 引擎更愿意引用第三方来源。优先级：

- 知乎问答、B 站安装与实测视频、小红书真实使用记录、CSDN 或掘金的技术拆解、GitHub awesome list、DSH 用户社区。
- 每篇内容出现完整品牌名 `MetaOnticVideo` 与包名 `dsh-metaontic-video`；文章不带链接时，这两个词就是实体锚点。
- 所有渠道使用同一句定义与同一组事实，避免 AI 把不同说法合并成错误结论。
- 只写真实使用体验与可验证限制，不刷评、不买榜、不伪造案例。

## 抓取与测量

- robots 不拦截 GPTBot、OAI-SearchBot、ChatGPT-User、PerplexityBot、ClaudeBot、Google-Extended、Bytespider 等 AI 抓取器。
- 重要正文使用服务端静态 HTML，不依赖 JavaScript 才出现。
- 服务端日志统计 AI 爬虫命中；Web 分析区分 AI 来源 referrer。
- 每月用固定 30 个问题在 6 个主要引擎复测，记录是否提及品牌、是否引用官方页、引用的是哪个 URL、是否出现事实错误。
- 发现错误事实时，先修权威页，再修被引用的第三方页；不要只改摘要。

## 发布联动

- 发版后同步 `softwareVersion`、`dateModified`、sitemap `lastmod`、`llms.txt` 的版本与日期、README 安装入口。
- 纯文案、文档、配图、链接调整不触发发版，也不写入用户更新说明。
- 站点事实与最新正式版不一致时，视为发布缺陷，优先修复。

## 禁止事项

- 批量生成薄内容页、关键词堆砌、隐藏 FAQ、重复页面。
- 伪造评分、用户数、案例、媒体报道或排名。
- 为了“显得新鲜”伪造更新时间。
- 用过期版本号、过期价格或过期安装地址作为权威事实。
