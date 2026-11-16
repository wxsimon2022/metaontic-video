# Film Director V2 结构迁移

创作域为 src/businesses/film-director，视频执行域维持 src/businesses/video。两个现有助手装配两业务，通过 film_project 提供独立创作项目。角色采用同一助手顺序切换职责，未接入独立子 Agent 运行时。

已实现：15–3600秒创作项目、JSON权威状态、阶段提交、版本冲突保护、真实用户问题服务批准创意和剧本、下游失效、基础时间轴/引用/覆盖校验、不可变快照、JSON与Markdown返回。Markdown当前为结构化数据可读导出，不是完整排版剧本。

项目文件保存在 dshHome()/DATA_DIR/film-projects/<会话哈希>/<UUID>。project.json为唯一原子提交点，快照先写入；崩溃遗留快照不算完成。进程内互斥，不承诺多进程写入安全。无独立服务、数据库或新增运行依赖。

尚未实现：完整JSON Schema、独立角色与七技能文件、章节批调度、工件manifest与完整性恢复、实体级依赖、回滚工具、语义Reviewer自动修复、导出文件落盘、实际视频制作计划适配。不得声称已满足V2全部验收条件。

平台：使用node:path、随机临时文件与rename，无Shell命令和平台特有路径；Windows文件占用导致rename失败时原提交保留。仅本机自动测试，未做Windows或Harness桌面实测。未发布、未安装。

提示词参考本地ALL_AGENT_PROMPTS.md，公共专业方法在creative.ts，film_project实际工具契约单独注入；不复制未实现的文件信封与子Agent承诺。冲突以V2设计和现有产品审批为准：业务修复上限2轮，审核严重级别统一小写，程序兼容大小写blocker。画布文本入口明确按生成段聚合表格，避免一镜一行破坏现有解析。不新增平台相关调用。
