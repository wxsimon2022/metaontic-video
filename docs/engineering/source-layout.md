# 源码目录与职责

## 项目入口

- `src/index.ts`：宿主入口，注册配置、业务模块与预设。
- `src/client.ts`：浏览器入口，组合设置、工具结果和画布。
- `src/config.ts`：汇总宿主配置。
- `src/agents/`：Harness 会话预设与入口身份，不等同影视八角色。
- `src/core/`：跨业务的工具注册、设置、安装、路径、日志和匿名统计。
- `src/client/`：跨业务的客户端组件与主题、更新和错误提示。
- `src/locale/`：语言资源源码。

## 专业创作业务

```text
src/businesses/film-director/
├── index.ts                  # film_project 工具注册与宿主适配
├── roles/                    # 八角色提示词和意图路由
│   ├── index.ts
│   ├── director.ts
│   ├── creative.ts
│   ├── screenwriter.ts
│   ├── character.ts
│   ├── scene.ts
│   ├── storyboard.ts
│   ├── prompt-engineer.ts
│   └── reviewer.ts
├── profiles/                 # 六种作品类型、配置版本、扩展字段及类型检查
├── prompts/                  # 共用创作指导与写作方法
│   ├── guidance.ts
│   ├── content-quality.ts
│   ├── short-video.ts
│   ├── script-craft.ts
│   └── narrative-enhancement.ts
├── contracts/                # 共同数据契约、结构和交叉引用校验
│   ├── index.ts
│   ├── schema.ts
│   └── references.ts
├── runtime/                  # 项目状态、规格、批准、存储锁与问题台账
│   ├── project.ts
│   ├── spec.ts
│   ├── approvals.ts
│   ├── storage.ts
│   ├── issues.ts
│   └── deliverables.ts
├── workflows/                # 下一动作、修订、任务登记和制作编译
│   ├── orchestration.ts
│   └── revisions.ts
└── quality/
    └── review.ts             # 通用评分与交付判定
```

`roles/` 专注职责，公共创作方法放入 `prompts/`，作品差异放入 `profiles/`。运行时结构检查与类型检查不能替代 Reviewer 的艺术或事实判断。`index.ts` 保持原业务注册入口；项目数据仍写宿主数据目录，不随源码移动。已保存 JSON 的字段、状态、版本与视频项目关联不因目录整理变化。

## 视频执行业务

保留现有已分层的 `src/businesses/video/`：

| 目录 | 职责 |
| --- | --- |
| tools | 对外工具及输入输出协议 |
| workflow | 制作、费用审批、分段执行、恢复、审核与交付状态 |
| providers | 渠道请求、鉴权路由、轮询与结果解析 |
| integrations | 画布与只读连接验证接口 |
| media | 下载、参考媒体适配、FFmpeg 和拼接 |
| prompts | 生成/续拍执行提示词及对话指导 |
| client | 设置、画布、进度与成果预览 |
| internal | 内部开发能力 |
| utils | 仅供本业务使用的辅助函数 |

创作业务通过已有制作桥调用视频业务；画布写作可复用作品类型和公共创作规则，不复制另一套配置。

## 开发与成品

`skills/` 存按阶段加载的专业方法；`tests/` 存实际使用的测试与辅助模块；`scripts/` 存构建、预览、验证和发布工具；`docs/engineering/` 存开发说明与验证记录。这些目录不混入项目运行状态。

根目录 `index.js`、`client.js`、`locale/`、`presets/` 是现有包入口或构建资源，按 package.json 的导出和 Harness 约定保留。改源文件后用 `npm run build` 同步产物，不手工编辑构建包。仅移动源码不会改变安装目录、用户配置或运行项目数据；本次不更新版本、不发版、不自动安装。

## 验证边界

移动后同步 TypeScript 相对导入、测试入口和维护文档引用；执行类型检查、构建、全量测试与 diff 检查。Windows/macOS 继续使用同一打包入口，目录名不含平台专用路径；本次在 macOS 运行自动检查，未进行 Windows 或 Harness 桌面实测，也未发起付费生成。
