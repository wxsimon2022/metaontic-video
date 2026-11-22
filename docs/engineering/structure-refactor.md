# 公共框架、业务与 Agent

[最新架构总览与制作流程](./plugin-workflow.md)

## 依赖方向

`src/index.ts` 装配 `app/bootstrap.ts`、业务模块清单及 Agent 清单；`src/client.ts` 装配浏览器业务模块。`shared/` 不依赖其他源码层，`platform/` 仅依赖自身与shared；app负责运行装配。业务可依赖公共能力，Agent 声明业务依赖并增加专题提示词。

```text
src/
├── app/                      运行装配、注册表与全局配置组合
├── platform/                 宿主设置、安装迁移、遥测适配
├── shared/                   固定配置、版本、路径及通用工具
├── ui/                       公共主题、更新、迁移与鉴权界面
├── types/                    宿主类型声明
├── businesses/video-generation/
│   ├── index.ts              视频工具、观察器和费用卡口注册
│   ├── client.ts             视频界面装配
│   ├── config.ts             视频配置字段、常量及兼容读取
│   ├── client/               视频设置、进度、媒体预览与侧栏
│   ├── tools/                项目、生成、续拍、查询等工具
│   ├── workflow/             审批、分段、恢复、交付
│   ├── providers/            渠道与图片/视频请求
│   ├── media/                参考图、下载、FFmpeg、合并
│   ├── prompts/              视频规则、生成提示词、业务范围适配
│   ├── utils/                视频错误分类、输出目录与文件工具
│   └── internal/             隐藏的内部视频开发能力
└── agents/
    ├── index.ts              Agent 清单
    └── video-director/        视频创作助手定义，覆盖多题材视频创作
```

## 新增同业务 Agent

1. 在 `src/agents/<id>/index.ts` 定义 `AgentDefinition`，声明 `id/name/businesses/skills/icon`，可选 `prompt(config)` 提供专题规则。视频 Agent 的 `businesses` 填 `['video']`，不用修改视频作用域判断。
2. 加入 `src/agents/index.ts` 的清单。
3. 同步 Harness 静态资源：在 `cordis.patch.yml` 添加独立预设；在 `src/agents/presets/<id>.ts` 创建预设源码并将其加入构建预设清单，生成 `presets/<id>.js` 包装入口、`locale/presets/<id>/{zh,en}.json` 和图标；在 `package.json.exports` 添加预设、locale、icon 导出。同业务可复用现有 YAML 插件锚点，但独立 Agent 身份与 persona 必须符合自己的业务。
4. 需要新技能时在 `skills/<id>/` 添加。Agent 描述是框架清单，不会自动生成 Harness YAML、技能或包导出；这些静态资源仍须显式同步并通过安装检查。

当前由视频创作助手统一承接不同题材；品牌、产品及活动宣传属于创作题材，不再单独注册宿主助手。

## 新增不同业务

例如新增文章业务（仅说明接入方式，仓库尚未实现文章功能）：

```ts
// src/businesses/writing/index.ts
import type { BusinessModule } from '../../app/bootstrap.js';
export const writingBusiness: BusinessModule = {
  id: 'writing',
  prompt: () => '当前业务为文章创作。',
  apply(runtime) {
    runtime.tools.register('writing', {
      name: 'writing_outline', description: '整理文章大纲',
      execute: async args => ({ status: 'succeeded', outline: args.topic }),
    });
    // 观察器/服务注册后立即交给框架，注册中途失败也会清理。
    runtime.defer(runtime.ctx.on('session/event', () => {}));
  },
};
```

将新模块加入 `src/index.ts` 的 `businesses`，增加依赖该业务的 Agent。需要配置时，将业务字段加入 `src/app/config/config-composer.ts`，字段不得与现有字段冲突；不可改动已有字段名称或命名空间。视频专属审批、时长、图片与分段规则留在视频业务，不提取成通用业务默认值。

浏览器模块提供 `create(require)`，返回 `inject` 和 `apply(ctx, { settings })`，加入 `src/client.ts` 清单。使用 `settings.register({ id, namespace, locale, Page })` 注册设置：同命名空间会组合展示，避免多个业务互相覆盖。通用表单保存用 `platform/settings/state.ts`，业务独有校验和凭据规则保留在业务目录。其他界面槽的 key/id 也必须独立，不能占用视频槽。

工具名全局唯一，冲突会回滚已注册资源。Agent 只能执行其声明依赖的业务工具；可声明多个业务。标准模式和未注册的宿主预设保留原有手动工具能力，但不注入业务身份。视频卡口只约束视频依赖的 Agent，不会把视频的问答和创作范围施加给新业务。此机制是插件内的工具防误用边界，不代替宿主权限或付费确认。

## 保持兼容与验证

包名、两个宿主入口、预设 ID、配置字段、工具名、技能目录、任务目录和持久化格式保持不变。不迁移或重写用户已有任务。业务生命周期由框架逐项回收，单个清理函数失败不阻断其余资源；模块加载失败回滚已登记的工具与资源。

统计沿用现有服务端白名单契约；未知业务工具不会加入上报批次。新业务需要统计时，先同步插件和独立服务端的事件字段校验，不能直接发送创作内容或任意错误信息。

`tests/framework.test.mjs` 使用模拟的文章/电商业务验证工具和提示词隔离、动态模式切换、多业务组合、第三个视频 Agent 接入、重复定义、注册失败回滚、清理异常及设置页组合。原有视频模拟测试继续覆盖审核、暂停、恢复与交付。构建保持两端单文件，不增加安装时运行依赖。

Windows/macOS 沿用相同 Node 路径 API、构建入口和 `.tgz` 包。没有新增平台专用路径或命令。自动模拟与 macOS 成品安装检查不等于 Windows 桌面实测；不调用付费 API。用户可见操作不变，使用指南无需增加内部架构说明；版本号与 releaseNotes 不变，本次不发版。

## 本次核对

类型检查和构建通过，421 项模拟测试全部通过，实际 Harness 输出 Schema 校验覆盖无可选配置服务时的 9 个工具。macOS 临时 profile 成品安装检查通过，包含 strictDepBuilds、中文与空格路径、资源完整性、配置/任务哨兵保留及移动原包后仍可导入；升级检查使用从当前成品派生的 0.0.0 测试夹具，不是历史正式版成品升级或桌面 GUI 验收。未安装到真实本地 profile，未运行 Windows 实机或付费生成，未发版。

## 当前结构对齐

应用入口为`app/bootstrap.ts`，Agent注册在`app/registry/agent.registry.ts`，宿主工具适配在`platform/dsh/tool.adapter.ts`，配置组合在`app/config/config-composer.ts`。`agents/<角色>/prompt.ts`维护八个专业逻辑角色，`agents/contracts/agent-definition.ts`定义宿主助手描述；专业角色不会因目录存在就自动成为可独立调用的宿主预设。

专业创作业务为`businesses/film-production/`，实际生成业务为`businesses/video-generation/`；其公共入口委托`production.service.ts`与`generation.service.ts`。目录名变化不改变运行时业务ID `film-director`、`video`，也不改变工具和磁盘数据命名。

专业创作内部按projects、approvals、artifacts、reviews、validation、workflows、profiles拆分。四维策略分别位于profiles/genres、formats、purposes、styles；profile.registry汇总注册项，profile.resolver解析与冲突检查，profile.composer组合角色指令，历史作品类型位于legacy。项目存储、产物版本、审批与复审继续执行原有真实实现，没有添加空实现的模型适配器、技能或调度器。

Windows/macOS共用打包入口，运行时不读取源码目录；本次本地构建和684项自动测试通过，未执行Windows桌面安装验证，也未调用付费生成接口。

脚本展示与确认补充：分镜捕获仅使用最近一条完整脚本消息，审核复用磁盘稿件，防止累计正文混合多稿并覆盖修订。明确的“待确认事项/问题”章节在脚本审核前触发实际提问；答复仅用于改稿，不等于审核通过，取消或未答保持阻断。风险与建议不自动归入此检查。路径仍使用 node:path，无新增平台命令；本次仅本机自动回归，未进行 Windows 桌面验证。

预设创建回归：skill-filesystem 的模块解析必须使用当前 package.json 的 name（dsh-metaontic-video），历史配置命名空间 metaontic-video 不代表 npm 包名。视频创作助手使用独立预设入口与技能目录锚点；增加测试核对 YAML 中 package.json 引用与实际可解析的包名，避免仅检查入口导出而漏掉会话挂载。此路径通过 node:path 组合，Windows/macOS 共用；本机安装验证不代表 Windows 桌面实测。
