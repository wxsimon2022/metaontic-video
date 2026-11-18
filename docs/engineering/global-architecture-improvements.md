# 全局架构整改记录

范围：创作→审批→编译→制作审核→估价→生成→分段审核→恢复→合并。保持同一助手的专业角色机制；不宣称另启独立模型或完成付费实测。本次开发不更新版本、不发布、不安装。

## 落地

| 检查项 | 实现 |
| --- | --- |
| 分镜出图冲突 | 专业角色、总控、技能统一调用video_project storyboard本地渲染；正文只写一次制作脚本，返回图片先展示再review。 |
| 编译方案绑定 | plan_digest绑定prompt、segmentPrompts、时长、画幅、清晰度、策略、逐镜时长及续拍模式/过渡描述；制作审核及执行前同时检查源版本与内容。允许补充经审核参考图；旧绑定缺摘要须重新compile，不直接放行。 |
| 模型能力 | providers/capabilities为创作和执行共享本地适配器能力。ADAPTER_DEFINED不表示渠道实测；未知字段及verified_at保持null。 |
| 内容证据 | 新建quality_policy=evidence_v1项目要求创意purpose/visual_evidence、场次scene_goal/key_actions/entry_state/exit_state；终审score_evidence和theme_evidence关联场次。中文每秒约4字仅作超时警告，有风险需budget_checks记录处理依据。旧项目兼容。 |
| 锁恢复 | diagnose与read不持写锁，审批等待期间可读最后提交；recover_lock只允许同机、明确不存在的进程，活跃/权限不明/损坏/外部机器记录不恢复。恢复并发由独占恢复锁串行化。 |
| 增量修订 | revise支持characters/scenes/locations/scene_states/props，按人物、场次、地点、状态及道具引用计算受影响镜头；下游仍stale并复审，不清空未修改数据。 |
| 存储与观测 | 保留最近30份及全部批准/依赖版本；未来修订与损坏快照保留。无变化操作不留重复快照。写入临时文件失败清理临时文件，保留旧project.json。film_stage_finished记录动作、阶段、耗时、错误类别、响应字节，不记录原始报错、脚本或密钥。 |
| 独立镜头路线 | 用户明确选择production_strategy=independent_shots；每镜4秒至模型上限整秒，编译shotDurations/segmentPrompts。resolveTargetPlan贯通估价、审批和执行，所有镜头kind=generate，无上一段video输入；每镜付费确认、结果审核、resume与原任务防重沿用。人物依赖获批参考图，不保证一致。默认直接剪辑不裁续拍接缝，不按累计成片丢弃此前镜头。 |

默认continuous_segments不变，不为增加画面丰富度自动增加收费调用。独立路线续做不能修改已保存策略和时长；改计划需新审核。上游任务状态不明继续查询原任务，不能重提。未获批不能进入付费生成。

## 验证与平台影响

- 构建及TypeScript检查通过；完整640项自动测试通过。另从本机Harness安装包读取原版assertSupportedJsonSchema及其原始依赖，核对全部12个工具的输出schema通过；这不是桌面热加载实测。
- 新增真实工具级无付费测试：新项目从创意、剧本审批到资产、分镜、提示词、证据终审和compile完整闭环；等待审批时读取；重复compile不增快照。
- 模拟HTTP执行：独立两镜各只提交一次，首镜暂停，修改计划被拒，原resume完成第二镜、重复resume不新增任务；请求不含reference_video。费用试算两镜均无视频输入。
- 覆盖编译内容篡改、未知能力、质量缺证据、活跃/死亡锁、快照保留及地点/状态/道具修订影响范围。
- Windows/macOS共用node:path、系统临时目录、参数数组和原子rename；process.kill(pid,0)仅ESRCH可恢复，EPERM视为不明。Windows文件占用不能先删旧文件。
- 自动测试使用包含中文和空格的临时路径，不写真实项目、不使用真实密钥、不调用付费接口。未进行Windows/macOS桌面端热加载、真实视频画面/口型/连续性或双平台成品安装实测；不能据此保证生成效果或固定性能提升。
