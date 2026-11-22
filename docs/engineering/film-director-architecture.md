# 影视创作架构与参考目录映射

[最新架构总览与流程图](./plugin-workflow.md)

## 分层

当前插件采用TypeScript/Node，不建立另一套Python状态机。推荐目录的职责映射如下；只有真实接入宿主的代码才算运行能力。

| 参考目录 | 当前落点 | 实际职责 |
| --- | --- | --- |
| agents | src/agents/<role>/prompt.ts、src/businesses/film-production/roles | 八角色提示词与当前阶段契约，逻辑职责切换 |
| skills | skills/video-director | 阶段方法与按需参考文档；覆盖剧情、风景、产品及品牌宣传创作 |
| workflows | film-production/workflows/workflow.engine.ts | 依赖、下一动作及制作编译 |
| contracts | film-production/contracts、validation | 字段、结构、时间轴与交叉引用检查 |
| project | film-production/projects/project.service.ts | 项目规格、原始要求与配置修订 |
| quality | film-production/reviews | 加权评分、阻断规则与问题复审 |
| models | video-generation/providers/capabilities.ts | 本地能力档案，未知能力不冒充实测 |
| runtime | production.service.ts、projects/project.repository.ts、approvals | 工具、原子提交、快照、跨进程锁与真实审批 |
| manifest | film-production/artifacts | 版本、JSON指针、校验清单与可读导出 |
| projects | 宿主DATA_DIR/film-projects/会话归属/项目UUID | 项目权威状态与快照，源码库不存运行数据 |
| tests | tests/film-*.test.mjs及视频业务测试 | 阶段、批准、版本、恢复与制作绑定回归 |

未来若拆出YAML配置或JSON Schema，必须由实际加载器读取，并消除代码中的重复定义，不能仅创建目录或无人读取的配置。依赖关系统一从STAGE_DEPS读取。完整JSON Schema声明、八角色独立执行器与章节后台调度仍未实现。Reviewer现有独立文本请求，章节支持显式逐章提交与恢复；详见[创作质量架构](./creation-quality-architecture.md)。

## 本轮检查与修正

1. 初始Creative的next输入原本为空，缺原始创意、时长与硬约束；现在所有任务携带projectContext。项目规格持久化，未知字段明确为UNKNOWN。
2. next、route和sourceRevisions原本各维护依赖，Prompt阶段可能拿不到剧本；现在统一依赖并返回正式剧本。
3. 审核原本允许单项评分和自标VERIFIED通过；现在终审要求完整范围与适用评分，运行时问题台账阻止遗漏、降级和无来源验证。责任产物改版后才能提交RESOLVED，再由Reviewer实际复审并登记精确版本证据。代码只能校验证据登记流程，不能代替艺术或事实判断。
4. 编译原本跨段复制完整镜头提示词，可能重复对白和动作；新项目禁止截断镜头，同段多地点需重规划。next/route提前返回当前执行分段计划，便于Storyboard对齐。旧项目保持兼容，不能把兼容路径当新项目标准。
5. 编译原本只校验参数枚举；现在核对项目锁定的画幅、清晰度与目标模型。
6. 原先只用进程内Set互斥；现在增加磁盘排他锁，防止不同进程同时覆盖同一状态。正常结束释放，遗留锁需要检查后人工恢复，不用超时猜测活跃审批已经结束。

## 保留的边界

- 八角色仍由同一个宿主助手切换，没有声称独立模型并行执行。
- schedule登记任务，不是后台执行器；完成需实际产物与结构检查。
- Character与Scene仍汇总为一个assets阶段，完整对象提交；局部修订支持范围以工具为准。
- 当前制作桥支持连续续拍与获审的独立镜头策略；独立镜头逐镜生成、直接拼接，不代表任意智能剪辑器。不支持的时长与分段映射明确阻断并返回重规划。
- 长片支持全片/章节数据与时间预算，不等于已有自动逐章上下文检索和后台生产。
- export返回内容与清单，不自动创建独立下载文件。
- 文件锁解决互斥，不构成跨film_project与video_project的数据库事务。编译跨项目中断仍可能留下孤立制作项目，不能自行重复付费处理。

## 验证范围

增加原始需求恢复、统一依赖、终审范围、问题不可消失、修复产物证据、版本绑定复审、跨段拒绝、规格冲突与第二进程互斥用例。使用模拟或本地状态，不调用付费接口。Windows/macOS共用Node标准库路径和文件操作；本轮在macOS运行自动测试，未进行Windows桌面验证。技能与架构修改不更新版本号或发布说明。

源码职责目录与入口见[source-layout.md](source-layout.md)。
