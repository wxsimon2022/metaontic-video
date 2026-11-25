---
name: metaontic-video-maintenance
description: 用于本仓库视频与图片接入、断点恢复、费用确认、清晰度设置、构建验证及发布维护；修改相关流程时读取并执行这些已验证约定。
---

# 项目维护经验

## 自主执行

用户已授权的开发和修复持续完成到构建、验证、文档同步，不反复询问例行实现选择。只有明确要求发版才发布，遵守根 AGENTS.md。开发授权不替代产品内付费处理同意、结果审核或环境权限。

## 接入与付费任务

- A/B 图片接入使用 Seedream 异步协议：POST `/v1/tasks/doubao`，GET `/v1/tasks/{id}`，GET `/v1/tasks/{id}/artifacts`；归一化 base 中的 `/v1`，查询不带通道。不恢复已验证不可用的同步备选。
- 图片模型当前只提供 `doubao-seedream-5-0-pro-260628`；旧型号 `doubao-seedream-5-0-260128` 已下线，读取时由 resolveImageModel 归一到 pro 版。图片参数使用 image 数组、2048x2048、n=1；真实能力以渠道验证为准。
- 仅明确真人限制触发转换。转换前获得同意并说明单独计费；转换完成展示全部参考图，再经用户核对确认后重试视频一次。普通审核、计价、鉴权、网络错误不得触发转换。
- 保存每张图片 taskId、结果、失败态以及转换/审核/视频重试阶段；先落盘后推进。恢复不重画已完成图片，不重置单次重试额度。保留首尾帧角色与精确原请求，包括本地图片归一化后的内容。
- POST 网络异常不能证明上游未创建任务。提交前持久化防重记录，结果不明返回 submission_unknown 并停住；经原渠道核对才能关联 taskId 或确认未创建后解锁。不要以换参数或清记录绕过防重。
- MetaOntic AI 图片默认共用视频 API密钥，关闭共用必须单独填写 imageApiKey，禁止缺失时回退。图片提交、轮询、取件及防重核对统一使用图片连接快照，视频凭据不受影响。
- API密钥路由必须用模拟 HTTP Authorization 验证：MetaOntic AI 共用/独立分别覆盖，火山仅用火山 API密钥；覆盖转换后视频重试、图片取件与异常提交核对，缺失时不得回退其他模型 API密钥。
- 每次调用固定配置快照，后续轮询不得混用新地址或 API密钥。密钥不写断点/日志，私有状态文件限制权限。
- 分段续做的审批文案必须先合并暂停记录 options，再解析清晰度；不得用仅含 resume 的原始参数回退到 720P。覆盖30秒480P两段流程，断言确认文案、估价与两次实际请求一致。
- 清晰度不在插件设置中配置；工具参数、实际请求、估价和恢复保持一致：480p/720p，脚本阶段须由用户明确选择480P/720P（本次需求已指定不重复问），记录到脚本、制作确认并显式传入工具。恢复已提交任务使用原请求参数。
- 对话边界：对话只做视频创作，无关话题不承接（一句话说明后请用户回到视频需求，不展开、不代办）；插件配置（接入方式、API密钥、模型、地址等）只能在设置页修改，`video_config` 只读、`action=set` 直接拒绝并引导设置页，不索取/展示 API密钥。提示词、video-director 技能、README（中英）与使用说明书同步维护；回归用例在 `tests/host-integration.test.mjs`、`tests/config-tool-save.test.mjs`、`tests/image-tasks.test.mjs`。

## 对白准确性

脚本审核前使用 video-director/references/pronunciation.md：正确原文与发音文本分离，仅对读音明确的易错词用同音常用字，不猜专名、不全局替换。生成和前后延长都保留对白执行约束，不覆盖无对白或关闭音频的选择。预算按实际发声时间，完整句不跨段；验收必须试听，不能把任务成功等同读音正确。误读重做仍需费用同意，不承诺自动配音/口型修复。

## 验证与构建

- 优先检查已有测试并覆盖失败恢复、部分完成、提交不明、拒绝授权、结果审核、配置切换和清晰度估价；模拟接口测试不得发起实际付费调用。
- 执行 `node scripts/check-active-video.mjs`；有活动任务先等待，不构建或热替换。
- 执行 `npm run build`、`node --test tests/*.test.mjs` 和 `git diff --check`。工具注册、schema、客户端与构建产物同步；按根约定优先热加载。
- 配置保存遇宿主旧 revision 被拒时，仅在恢复后的待写字段未变化、可写且就绪时原子重试一次；其他拒绝保留草稿，不能无限重试或拆为逐字段写入。后台设备同步期间的保存需等待后继续，避免静默忽略首次点击；React 使用 useSyncExternalStore 订阅宿主配置。
- 同步 README、操作指南和相关内置技能的操作说明；普通开发不修改版本号、releaseNotes 或标签。
- 真实测试仅在用户授权范围内进行，区分实际覆盖的接入、模型和输入类型；不要把普通图片成功等同真人转换或完整视频链路验证。

## 发布经验

- 先比较最近发布到当前工作区的全部逻辑变化，展示完整说明，再按 AGENTS.md 及发布工程文档执行；操作指南必须复核且纳入包；用户要求指南只面向使用，只讲选择 MetaOntic AI 的配置路线，不列其他接入方式，不写 A/B 标记、版本号、更新记录或发布信息；配图优先真实插件组件预览。核对结论及适用版本只写入 docs/engineering/release-<版本>.md，不写进指南或配图；发布时检查指南正文和配图，不得添加“适用版本”“本次更新”“发布核对”等章节。更新内容统一留在 CHANGELOG 和 releaseNotes。
- CI checkout 后显式取回注解标签，再读取完整发布说明，避免 checkout 将标签覆盖为提交引用而只读出提交标题。
- Gitee 更新已有 Release 使用 PATCH，携带 tag_name；发布后核对 GitHub/Gitee 的说明与附件，不只看工作流绿色。
- 发布慢的主因是等 GitHub Actions（GitHub SSH 443 还常整段超时）；改成本地成品直传 Gitee 后，一次发版只剩本地构建测试打包约 3 分钟加三个附件上传，双仓并行推送也避免一仓超时拖累另一仓。GitHub Actions 只在--both时使用，作为双平台安装校验证据；仅 Gitee 发布的 Windows 缺口写进 release 文档。
- 测试包不进 Release：`npm run pack:test -- X.Y.Z-test.N` 会构建、跑测试、打 `.tgz`，直接上传 `https://video.mybfs.cn/test/` 并核对线上 sha256，最后还原包内版本号；版本核心号压在当前正式版之下，更新检查只读正式 Release，因此测试包不影响他人正式版，`--no-upload` 可只出本地包。线上 `/test/` 由 moyubang 仓库 `deploy/nginx/video.mybfs.cn.conf` 提供，目录放在部署目录之外，`deploy.sh` 的 `rsync --delete` 不会清理已上传包。
- Gitee Go 流水线 `.workflow/MetaOnticVideo.yml` 在 master 推送、面向 master 的 PR、`v*` 与 `ci-` 标签时做构建与测试校验，并打出唯一的跨平台成品 `metaontic-video-<版本>.tgz`（不再产出 Windows ZIP）：成品一是作为当次运行的暂存构建物（步骤里的 `artifacts`，有过期时间，运行结果页可下载），二是由紧随其后的「上传制品」步骤 `publish@general_artifacts`（`dependArtifact: PLUGIN_PACKAGE`、`artifactName: metaontic-video`、`dependsOn: build_test`）归档到仓库制品库长期保留；只声明 `artifacts` 不会进制品库。Gitee Release 由这条流水线按标签自己发布（见「流水线发版」），GitHub 侧仍由 Actions `publish` 打包。标签触发时用 `git describe --tags --exact-match` 核对标签与包内版本一致，不一致立即失败（取不到标签时只提示，不阻断）；`ci-` 开头的演练标签跳过该强校验，只演练不出发布件；脚本里变量后紧跟中文标点时必须写 `${VAR}`，否则 bash 会把全角标点并入变量名导致展开为空；构建机不保证自带 Node，命令里先探测常见安装路径，找不到就从 `cdn.npmmirror.com` 下载 Node 20（glibc 低于 2.28 时自动换 `node-unofficial-builds` 的 glibc-217 兼容版），并缓存到 `~/.local/node`，不依赖插件下拉版本；Gitee 免费构建机的 Node 版本字段因此只作占位。

API密钥共用规则：MetaOntic AI 可选择共用或独立图片 API密钥，关闭共用不得回退。

## 脚本审核费用对比

所有接入在写脚本时一并调用只读video_estimate试算，将官方/插件两项基础估价写入script.md最后的“费用预估”一节并随脚本交付（不是脚本之前的前置步骤）；会话中展示脚本也在末尾展示本节，再弹审核窗，按实际分段计入上一段视频输入；手填 API密钥未核实分组按1，火山直连不套中转折扣。未知价目/画幅不猜价，最低用量补足未计入须注明。制作审批与账户额度预检保持独立，不能把本次一段价格当整条预算。用户另行生成的价格参考文档和宣传素材仍仅留本地，不纳入仓库或发布包。

- 版本卡片更新时间读取当前包releaseNotes.publishedAt（ISO时间，转换为UTC+8显示日期与时间，不附加时区字样），不得用检查时间、构建时间或远端其他版本时间代替；发版时同步真实发布时间，缺失则不显示。

## 实际费用（仅A/B）

完成后使用视频调用的连接快照和视频 API密钥查询/api/log/token，严格按other.task_id匹配type=2的最终other.actual_quota，每个任务只计一次；不得将其与预扣或补扣再相加。/api/status提供quota_per_unit与usd_exchange_rate后才换算金额，缺失只报额度。查询有界超时，费用失败不改变视频成功/交付/恢复状态，不触发重生成。video_status可补查；C直接跳过，图片 API密钥不参与。partial为已结算小计，paused为已生成部分，pending不显示0元；只有预扣或最近日志窗口缺失都算待结算/待查询。

## 保存并发与诊断

批量写入和唯一一次安全重试均绑定检查时的 expectedRevision；第二次冲突停止，不覆盖其他编辑。保存成功后只清理本次已提交且未再修改的草稿。失败按配置冲突、页面不可用、只读、通信结果不明分类；诊断只记录固定错误分类及修订号，禁止记录 API密钥、ops、字段值和宿主原始错误。通信异常不自动重试，不把结果不明当未保存后重复提交。

重置后继续会话先用 video_config 读取当前接入与密钥状态，不沿用原配置。缺 API密钥只引导登录/填写并保存，不建议重装、重新启用或重启；工具不可见先核对发现与安装状态。保留脚本审核事实与任务进度，仅补缺失确认，参数变更仍重审。

## 正式版更新

仅发布 X.Y.Z 正式版（prerelease:false），只保留检查更新与二次确认更新到最新正式版；不提供历史版本选择和降级。读取已发布正式 Release，过滤草稿及预发布；仅目标严格高于本机时才能执行安装，工具动作直接调用也必须防止同版本或低版本安装。使用同版本 Release 成品包，不回退 master、不先卸载。

## 宿主 Schema 兼容性

工具注册必须使用 Harness 支持的 JSON Schema 子集：type 只能为单个字符串，可空字段用 oneOf（如 number/null），不能写 type 数组或 anyOf。宿主会在注册时拒绝整个插件；仅导入构建包和模拟 register 成功不足以验收。注册测试遍历嵌套输出 schema，并用本机实际 dsh-tools assertSupportedJsonSchema 校验全部工具，覆盖结算金额、币种、换算参数和任务明细的 null 分支。

## 安装依赖

Hyperframes 属于隐藏的内部开发能力，只能放 devDependencies，不能随公共插件运行依赖引入 esbuild/sharp 等安装脚本。在线更新优先使用对应 Release 的 tgz 成品包，避免 Git 开发依赖；Gitee 附件不可用时只尝试同版本 GitHub 附件，不放宽 pnpm 供应链策略，不指导 approve-builds。发布前在空白 profile 使用同一 pnpm 运行时、strictDepBuilds:true 安装成品包验证，断言运行依赖树不存在 esbuild/hyperframes。

版本选择与降级入口已移除，只允许更新到更高的最新正式版本。

pnpm 11 安装前会校验整份 `pnpm-lock.yaml` 的所有 entries：只要留下一条本插件「远程 tgz 但拿不出合法 `sha512`」的记录，任何地址、任何版本的安装/更新都会以 `ERR_PNPM_MISSING_TARBALL_INTEGRITY` 失败，与插件包和操作系统无关。判定要按「本插件所有远程记录里哪些没有合法校验值」来做，不能只看被 importers 引用的那条：旧版本残留、已经没人引用的记录照样让整次安装失败，`integrity: null`／空串、只删了 `packages` 留下 `snapshots` 的半条记录同样算坏记录。宿主侧自愈见 `src/platform/installation/update-lockfile.ts`：profile 根、下面两层与同级 `.<名字>.staging-*` 目录里的锁文件都扫，加载时检查一次、之后每 2 秒复查，只清本插件这类记录、改前留 `pnpm-lock.yaml.metaontic-backup-时间`、原子替换；客户端命中该错误先等一次清理再退避重试（最多 `UPDATE_ATTEMPTS` 次、不换镜像），仍然失败才提示手动删除。

复现与定性（不要再靠猜，改用宿主自带运行时在临时目录直接跑 pnpm）：`~/.dsh/dsh-runtimes/dsh-primary-runtime/dependencies/node/bin/node`（v24，node 20 会因缺 `node:sqlite` 直接报错）加 `/Applications/DeepSeek Harness.app/Contents/Resources/runtime/primary-runtime/dependencies/pnpm/dist/pnpm.mjs install --registry=https://registry.npmmirror.com/`。三种造好的锁文件对应三种结论：①只有 importer 声明地址、没有 `packages` 条目 → pnpm 重新解析、安装成功；②`packages` 条目只有 `tarball:` 没有 `integrity:` → `ERR_PNPM_MISSING_TARBALL_INTEGRITY`；③旧版本残记录没人引用但缺 `integrity`（Windows 现场形态）→ 同样失败，把这条删掉后 pnpm 重新下载并写回合法 `sha512`。macOS 正常路径（全新安装、store 命中、换版本、本地 tgz 转在线地址、附件 404 下载失败）都写不出这种记录，所以只能按现场锁文件定性，不能凭 Mac 结果下结论。

长视频交付须逐项展示所有已完成分段及真实合并结果，完成30秒两段时展示第一段、第二段、合并后完整视频；暂停/失败不虚构未完成分段或完整成片。仅单段直出时不为了交付再拆付费任务，沿用已确认生成计划。

## 续拍过渡与官方提示词

脚本按主体、动作、场景、光影、镜头、风格、画质、约束组织；定义稳定主体标签，分镜按事件顺序而非付费任务数，动作写部位与幅速力度、惯性及可见情绪，景别/视角/运镜分开，并满足画面不单调的下限：15 秒至少 2 次、30 秒 3–4 次可见的景别或构图变化，每 3–5 秒一个看得见的变化（位移、道具交互、光线或层次、情绪反应），至少一处特写或前景遮挡后的揭示，至少一个镜头有明确前中背景，声音至少两层；整段只有固定中景加缓慢推近视为不合格脚本。用户明确要求一镜到底、固定机位或静态风光时不硬加视角，改用同一镜头内的景别推进、光线、位移、层次与声音避免单调并写明原因；这些变化都在同一次生成内完成，不为丰富度增加付费调用或付费分段。每段续拍先审核具体过渡。单行【过渡画面】优先于通用transitionDescription，续做持久化两者；只进入本地拼接的text，不增加上游参数。自动文案不得使用参考视频1；reference_video协议字段不改。明确过渡安排切镜时取消相同机位/景别/焦段硬约束，未明确时沿用连续默认；不承诺无接缝，不擅自换场景或增加生成调用。

续拍方式由已审核脚本决定，设置页和 video_config 移除 mode。旧 Config.mode 仅兼容读取，不再控制新请求；本次调用按 args.mode 或默认 continuous，写入断点；已记录的 resume.mode 与原请求优先，过渡描述仍覆盖默认衔接限制。

## 分段确认与续做入口

每段生成完先结束本次调用交付成果、由助手询问、用户确认后再 resume，是既定交互；所以“每段确认”的代码卡口必须挂在续做入口（preflightGate 的 resume 分支），不能在生成循环中间阻塞——工具内部卡在审批框时宿主拿不到工具输出，用户还没看到刚生成的分段就被问要不要继续。v2.13–2.14 的 confirmNextSegment 曾在循环里直接调 approval.request，v2.15 删掉调用点后遗留成未使用的导出。现改为 segmentContinueLine 只产出“第几段做完、接下来第几段、整条还差多少”文案，连同 remainingCostText 的整条预估并入 preflightGate 已有的那次 ask，同一份进度始终只弹一个确认框，不重复提问；拒绝即停止、已完成分段保留且不影响 resume。

## 示意图实际展示

present仅登记文件交付，卡片可能在轮次结束后出现；脚本审核前需先检查图文件存在、present成功，再在正文输出Markdown内嵌SVG/PNG与打开原图链接，然后才问审核。read_image供模型查看，不证明用户看到。优先PNG/SVG，HTML作附加；格式不支持时用已有工具渲染，不擅自付费或安装。用户反馈未见图，先找对应项目文件补展示，不空口重复已画好。

MetaOntic AI 使用手填 API密钥。界面保存及video_config写入须原子补齐非敏感连接默认值（baseUrl、提交/查询路径、视频/图片模型）；不从脱敏快照复制 API密钥。运行端同样提供中转默认地址兜底。火山切回中转不可沿用火山路径。诊断检查effective而非仅看stored；没有HTTP响应不能证明请求未到达上游，不解锁提交不明任务。

视频交付正文必须逐项附Markdown可点击链接，例如[观看第一段](<绝对文件路径>)，路径含空格也用尖括号包裹；有present仍须给正文链接，普通文本或反引号路径不算链接，未经验证不得说上方卡片可直接播放。缺文件先查原任务和交付路径，不重新生成。

所有用户交付的文件（脚本、分镜示意图、转换图片、单段/续拍预览、合并成片、恢复后成果、导出PDF等）都须在用户可见正文给出逐项可点击Markdown链接，不能只给目录、反引号或普通文本路径；本地路径先确认文件存在并转绝对路径，用尖括号包裹。图片另须内嵌，脚本另须完整展示正文；present登记成功仍保留链接，不声称卡片已播放。只链接真实返回或已核实文件，不编造路径，不为补链接重新付费生成。恢复目录、任务ID、配置文件等内部参数继续按原参数使用，不当作可播放成果。

交付卡片只登记「最终成片 + 各分段」（成片第一，其后按段号），脚本、分镜示意图、参考图、转换图片、单段预览、暂停时的部分合并都只在正文内联/链接交付。原因是宿主交付卡片按本轮首次出现路径顺序排列、按路径去重、第5项起折叠（@deepseek-ai/dsh-client-ui-deliverables 的 COLLAPSED_PRESENTED_COUNT=4，注释写明 in first-seen path order），中途登记过的过程材料会把成片挤到后面，事后补发 present 也挪不回来——2026-11-04 事故：同一轮先 present 脚本+分镜、再 present 15s 部分合并+第一段、最后才 present 30s 成片+两段，卡片渲染出来仍是脚本、分镜、第一段、15s 预览，30s 成片排第 5 被折叠隐藏，而原始 present 参数顺序本身是对的。该约束由 workflow/delivery-order 卡口强制：视频工具返回时按 segmentsDir 分组记录真实分段与合并成片，present 提交前依次校验四件事——这次是否最终交付（status=succeeded 且 merged=true 且无 paused/partial/pendingTaskId，否则 deny run_not_finished）、是否带了中间版本成片（deny intermediate_merge_listed）、成片是否排在所有分段之前（deny merged_not_first）、本轮是否漏掉成片（deny merged_missing；成片本轮已登记过则放行追加的分段）。认领交付文件必须逐级降级：绝对路径 → 同名 → 文件字节数；助手交付时经常把成片改名成 final/<项目>-60s.mp4、把分段换成交付目录里的 15s 副本，只比路径会整批漏判、卡口静默失效（曾因此线上一直报「成片没排第一」却没有任何 delivery_order_blocked 记录）。定位这类问题先查插件日志里有没有 delivery_order_blocked，没有就是没认领上，不要先改提示词。暂停时已有累计合并视频标为“已完成部分合并视频”，不标成完整成片；合并失败或未合并时只按段号交付真实文件。

阶段计时：编写脚本前用video_stage(stage:script_design,action:start)，完整脚本保存后finish原spanId（脚本用video_project(action:storyboard/review, captureScript:true)落成script.md时插件就地结束这一段，不必再补finish）；分镜示意图不再由助手画，改由video_project(action:storyboard)本地渲染，storyboard_design只在真由模型画图时才用；展示脚本用script_present。审核/制作/参考图/分段预览等待分别用script_review_wait、production_confirm_wait、reference_review_wait、segment_review_wait，展示成果用result_present。用户回复后结束对应等待标记；不得把等待混入脚本设计时间，不为计时重复生成内容。标记仅记录边界墙钟耗时，不等于模型纯推理时间；标记不可用仍正常推进，不猜耗时。

估价按真实输入区分档位：首段生成无视频输入（参考图/首尾帧仍为无视频输入），每个续拍段有视频输入，用上一段完整视频时长加本段输出时长计token，切换到含视频输入单价；不把累计成片时长当上一段输入。脚本费用预估逐段列档位、输入/输出时长、单价与金额再合计；制作确认和恢复预检同口径，外部视频时长不明就明确无法可靠估价，不按纯生成费用兜底，不调用付费任务试算。

生成脚本提速（2026-11-15，实测见 docs/engineering/infinite-canvas-integration.md 的 3.24.0-canvas.14 一节）：慢的不是插件而是模型生成，真实一轮 139 秒里插件工具调用不到 1 秒，可省的两段是「助手手写 15.6KB 的 draw_storyboard.py 画分镜」（31.0 秒）与「正文把整份脚本再复述一遍」（10.7 秒）。改法：分镜示意图一律由插件本地渲染（video_project action:storyboard，落 storyboard-vN.svg，不调用付费出图模型、不写绘图代码）；脚本只在用户可见正文写一次，captureScript:true 让插件落 script.md 并记 script_saved；提示词要求同一轮把可并行的只读调用一起发（video_project 仍是 isConcurrencySafe:false，省的是模型往返不是并发）。普通脚本生成走 providers/text.ts：默认流式 + max_tokens（按段数）+ 增量 30 秒无输出即报错，finish_reason=length 回报 truncated；客户端 RPC 超时必须是分钟级（TEXT_WRITE_TIMEOUT_MS=180000，默认 20 秒会把 40–70 秒的写脚本直接掐掉），并显示已等待秒数、记 text_model_progress/text_model_done/text_model_failed。排查「写脚本慢」先看 requests.jsonl 的 script_design/storyboard_design/script_present 与 text_model_* 记录，不要猜。
脚本按导演口径写（2026-11-16）：两条链路口径是分开的——普通脚本生成走 providers/text.ts 的 scriptPrompt()，它不读技能文件也不读动态提示词，所以导演前置（观众与记忆点、情绪曲线、视觉母题、一条主线）、表演与情绪、声音设计、开场与结尾、禁止项都写在这一份里；对话路径由 skills/video-director/references/scriptwriting.md 的「导演工作法」承担，SKILL.md 写脚本一步与动态提示词都指向它，且要求这套推演只在内部用、不展示给用户。硬约束没有放松：分镜表表头、正好 N 行、镜别与视角的标准词表由 scriptStoryboardShots → splitScriptPrompts 解析，改这些必须同步 tests/text-model.test.mjs（锁 scriptPrompt 原文）与 tests/host-integration.test.mjs（锁技能与动态提示词原文）。因为一行就是一次生成，段内切镜只能写进画面列的「先…随后…最后…」，不要为凑变化加行。

脚本审核展示防漏：监听session/event，必须有assistant/message正文text内嵌本版分镜图（绝对路径解析后文件仍存在），才放行脚本审核ask_user_question。present 不再参与分镜展示——交付卡片只登记最终成片，present 登记的分镜图对用户不产生可见展示，只被留作提示；reasoning、工具看图、文字描述都不算。改稿是否发新版按同目录 mtime 判断：目录里存在比内嵌那张更新的分镜图（文件名含 storyboard/分镜/示意）就 deny stale_storyboard_version，避免改稿后仍发旧图。交付卡片在轮次结束后才可见，故先发独立图片正文再提问。只观测事件，不新增已弃用的session同步日志读取。反向漏问（2026-11-04 实例）：正文单独成一条消息且不带任何工具调用时，助手在正文后直接stop结束回合，审核窗不弹。对照同模型成功轮次，正文消息都同时带着video_stage调用（收口script_present/开始script_review_wait）；失败那轮把start script_present提到present之前、提前用掉了这条锚点。因此提示词要求正文消息内必须带收口调用，禁止在present前提前start/finish；守卫在turn/end（或下一轮首个事件）见到已present未提问就记storyboard_review_missing，便于判断修复是否生效。正文脚本比对按覆盖率而不是逐字相等（2026-11-15 实例）：`video_project(action:review)` 传的 requiredScriptText 之前要求正文逐字包含，助手把脚本整理成带标题、「· 第 1 版」的展示版就在第一个差异点被拦，插件返回 blocked、审核窗一直不弹，用户看到的是助手空转。按真实会话还原该轮：script.md 3,880 字、展示版逐字比对失败，但相邻两字覆盖率 0.850，各段 0.71–1.00，即内容没漏、只是改写排版。现改为 `scriptCoverage(script, visible)`（`readableText` 去掉 Markdown 标记与空白并保留链接文字，比相邻两字集合）配 `SCRIPT_COVERAGE_MIN = 0.7`：整理排版 0.960、去掉 Markdown 标记 1.000、加标题补解说 1.000 全放行；只贴分镜表 0.272、只贴开头 120 字 0.232、摘要 0.015、只给链接与打招呼 0 仍拦下。拦下时 deny 理由带实际百分比并写明「排版差异不算问题、不要改写措辞删段或只给链接」，同时记 storyboard_review_blocked（reason script_text_mismatch，带 coverage），便于回溯。

设置布局：模型按视频/图片分组，共用开关及共用 API密钥在上方，独立 API密钥各在所属模型下；画幅/音频等高排列、窄窗口堆叠。重置在底部。改布局用真实组件模拟当前渠道、共用切换、保存、键盘和明暗/窄屏验证，不写实际宿主配置；同步真实指南截图，截图不含版本或真实 API密钥。

更多设置按画面、视频合并、查询与等待、本地工具分组；相关帮助归各组，本地工具路径全宽，宽屏成对字段控件对齐、窄屏堆叠。浏览器验证秒数单位转换和水印保存，指南采用真实组件截图并同步PDF。

仓库可发现性：About简介、主页、相关Topics与README首屏准确说明DeepSeek Harness插件及Seedance 2.0多段续拍用途，不堆砌无关关键词、不承诺排名或效果。中英文README互链，新增README.en.md同步纳入package.files；修改简介/Topics后回读验证。SEO调整不将价格参考资料提交仓库。

最初角色图持续参考：每段续拍携带上一段视频与同一套最初已审核角色图；characterReferenceImages可明确指定，未指定时沿用首段referenceImages或首帧，首帧在续拍中改作reference_image而不是first_frame。角色图归一化后随断点保存，不使用后续段落截图替代初始角色，不自动重画；无初始图片时仍为纯视频续拍，不虚构角色参考图。真人限制须先获转换同意、展示审核，再单次视频重试；成功后复用已审核转换图。原已提交任务保留originalBody，不因加图而重新提交。

纯文生视频角色图选择：有需要固定外形的人物/主体且未提供图片时，在需求阶段通过video_project(action:prepare)询问“是否先生成角色参考图？图片调用单独计费，生成后先看图确认。”两个选项为“直接文生视频/先生成角色图（单独计费）”。本次已明确同意或拒绝则记录到项目，不重复问；未答/取消/pending不表示同意，不调用图片或视频。用户拒绝时保留纯文生方案，不自动加图；没有固定主体的空镜不强加角色。用户同意后先明确外形与画面风格，依次提供真人写实（第一位）、二维动画、卡通、插画；必须按用户选择执行，调用video_prepare_image(operation:create_character,prompt:角色设定,style:已确认风格,characterType:真人写实选realistic其余选stylized)，默认一次一张，不需要原图。记录taskId/imageUrl；超时查询原taskId，不重发；失败或不满意先停止，重画先确认新增费用。结果在正文内嵌并给原图链接，单独询问“这张角色图可以用于接下来的视频吗？”，待明确认可后，将imageUrl同时写入video_generate.referenceImages和characterReferenceImages。再展示含角色图、脚本、分镜与费用预估的本版材料并审核，最后由视频工具付费审批确认制作。脚本末尾注明角色图单独计费且不包含在视频估价中；项目记录角色图选择、任务及审核状态，恢复后不重复出图或重复问已确认选择。火山直连无此图片通道时先说明限制，可让用户提供角色图，不谎称可代画。

安装稳定性：宿主入口必须内置schemastery及运行依赖（仅开发依赖），成品不依赖外部node_modules；同步第三方MIT声明。发布前把dist/index.js复制到无依赖空目录导入并校验Config/工具，用实际Harness Schema解析器验证。卸载重装后若仍指本地路径，核对HMR覆盖；仅改本插件HMR目标为已安装目录，保留 API密钥与其他配置，工作区外修改走系统权限。

角色图选择在需求阶段用video_project(action:prepare)完成，以projectId持久化，不随提示词、时长或清晰度重复询问。空镜选scenery不强加角色；生成入口仅核验既有选择。

Windows首次安装遇ERR_PNPM_GIT_RESOLVE_FAILED时先区分Git传输与供应链检查：供应链通过不代表Git可达。用户安装入口、说明书及配图统一推荐Release的.tgz成品附件或解压后的package目录，不引导全局Git重写、SSH配置或关闭策略；插件代码无法在尚未安装时修复宿主Git传输。保留完整错误核对旧Git来源，不盲目清配置或 API密钥。

角色图真人写实仅用于create_character，characterType=realistic；建议顺序真人写实第一，其后二维动画、卡通、插画。未指定类型保持原stylized行为，不能推断用户同意写实。真人限制转换仍必须非真人，不改变审核/单次重试规则；写实出图被拒就停止并如实报错，不自动去图、换风格、重画或重提视频，另选风格需用户同意及重新费用确认。

Windows解压目录安装在更新时出现空目录/locale缺失：先核对成品中语言文件，再恢复原路径完整package，不清 API密钥；空目录原因未实证时不归因宿主删除。新Windows ZIP包含原始tgz，推荐填写tgz绝对路径安装，由pnpm托管，减少外部目录依赖；保留package作资料和恢复用途。ZIP采用固定时间戳可复现，跨仓及重试使用同一内容，校验文件须对应实际附件。

双平台兼容为默认开发/发版要求，按platform-compatibility.md执行；CI的Windows/macOS成品安装检查必须先于Release上传，覆盖中文空格路径、locale、技能、说明书、入口与安装源移动。桌面GUI/更新实机未覆盖须明确记录，不用自动烟测代替。

更新安全：runOnlineUpdate先用pluginManager.listBundles读取本插件installed/source（兼容原数组和ok/value回包），本地目录/link一律禁止直接替换；来源未知、接口缺失、元信息异常失败关闭。用户已复现Windows点击立即更新清空外部目录，之前成品首次安装验收遗漏本地链接迁移；不能再以恢复目录代替修复更新动作。记录来源与实际解析路径可能在异常迁移后不同，来源检查不能宣称自动修复既有损坏。双平台烟测需真实旧成品升级并断言原安装文件、配置、任务保留。

一键发布使用scripts/release.mjs（npm run release -- X.Y.Z），先准备本地 `.local/release-plan.json` 完整条目及指南核对；更新说明只写新增与优化两类（修复并入优化，出现修复分类直接失败），整篇不超过100字（分类前缀不计，notesFor按notesLength统计，超限直接失败），只写用户能感知的结论；纯文案与措辞替换（如设置页把“Key”统一改成“API密钥”）、链接地址调整（注册地址、下载地址、宣传页地址）、文档与配图改写、代码重构与注释、测试与发布脚本调整、版本号与宣传页同步动作都不计入更新说明，也不因此加条目；整版只有这类改动时不主动发版，用户仍要求发版时按用户可感知的结论写一条并先确认措辞；--dry-run不改文件/版本/标签，不触发发布。脚本从实际最新正式版核对范围（仅 Gitee 发布时读 Gitee 接口，取不到再退回本地标签），禁止覆盖标签；默认只发 Gitee 且默认在本机打包发布：本机用GITEE_TOKEN直接建Release并逐个上传核对附件；加--pipeline（--ci同义）才交给 Gitee Go 流水线按标签打包、归档制品库并发布（本机只准备与推标签，不需要GITEE_TOKEN）；加--both才同步GitHub并轮询publish.yml（本机收尾，勿与--pipeline同用）。同标签已有同名附件时只核对不覆盖，谁先发布谁作数。推送按仓库并行、失败各退避重试三次，GitHub走ssh 443并带ServerAliveInterval；任一仓库最终失败即报告，同版本--resume续跑。跨平台构建使用scripts/build.mjs的esbuild API，禁止POSIX命令替换使Windows构建失败。发版同时用scripts/sync-promo-address.mjs把服务端仓库宣传页（MetaOnticVideoService/frontend/public/promo/index.html）的Gitee附件地址、tgz文件名与页脚版本号同步到本次版本，说明书地址由脚本强校验，宣传页同步结果写入发布记录的验证；未找到宣传页必须手动同步。编写或测试发布脚本本身不等于获准执行真实发布。

历史版本回收使用scripts/clean-releases.mjs（npm run clean:releases -- --apply）：默认演练，只删计划内对象，最新正式版、当前package.json版本以及README/说明书/CHANGELOG/本文件里.tgz下载地址引用过的版本永不删除；先附件、再发行版、最后标签，GitHub与Gitee同一计划并同步本地标签，演练同时给出预计释放的附件体积；待删标签默认取所选GitHub/Gitee平台标签API的并集，不依赖本机SSH；显式--remote才额外读取Git远端，API失败时停止而不按不完整本地数据删除，Gitee开放接口没有删除标签的端点（DELETE /tags只会404），只能用私人令牌走HTTPS推送删引用。定期删除由.github/workflows/clean-releases.yml按周演练，只有仓库变量CLEANUP_APPLY=true或手动勾选apply才真正执行。回收不是发版，但删除不可逆，先看演练输出的保留集与待删清单再执行，不在发布流程中间插入清理。
回收默认发行版与标签各保留最近5个（--keep / --keep-tags，后者默认跟随前者，两条保留线取并集）；Gitee标签只能用git push删引用，Gitee操作需要GITEE_TOKEN。

分段收尾与重复逻辑：video_generate 与 video_extend 的分段循环共用 workflow/segment-run.ts（结果落盘、中断收尾、暂停说明、merge:false、下载合并收尾），结果文案共用 tools/results.ts 的 renderVideoResult/renderResult（同一实现在 RENDER_WORDING 里分工具措辞），改措辞只改一处，不要再各自复制一份。media/merge.ts 的分段下载与 ffprobe 探测并发跑（mapLimit，上限 SEGMENT_TASK_CONCURRENCY=4），跑完仍按段号顺序处理，因为「累计成片」识别依赖 files 的推进顺序；下载失败仍按段号取最靠前的那一段报错。参考图适配缓存在系统临时目录只增不减，写入成功后调 pruneReferenceCache（7 天、上限 200 个，5 分钟内带 .fit- 的临时文件不删）；日志目录按天缓存 mkdir，失败不记缓存以便下次重试。

宿主插件页的「详细介绍」不可关闭，只能靠包里没有文档来隐藏：Harness 的插件页（组合包页面）会读安装目录里的介绍文档，顺序是 locale/<界面语言>.json 的 meta.detail → 包内 README.md / readme.md / Readme.md / README.markdown / README（README.en.md 不在名单里，也没有任何开关或布尔配置能关掉这块）；找到就整篇渲染，找不到才整块不显示，因此成品包用 scripts/strip-package-readme.py 在打包后裁掉 package/README.md（release.mjs 与 pack-test.mjs 已接入，放在算 sha256/Windows ZIP 之前），仓库首页的 README 保持不动；本地 link 安装仍读工作区，会照旧显示，要看隐藏效果必须装成品包。给页面换成简短介绍才用 locale 的 meta.detail（文件也得进 files）。

插件已移除服务端登录接入、账户额度、钱包及充值逻辑。默认 MetaOntic AI，火山已有配置仍支持；独立服务端仓库保留。旧服务端凭据仅供清理，不迁移为其他渠道密钥。

项目流程由video_project管理，review通过后生成工具付费审批即制作确认，不再另问开始制作；正文完整展示脚本并内嵌分镜才允许审核。状态绑定项目、脚本摘要和制作参数，改稿重审，审核后不再改script.md状态。分段暂停默认只交付新段，最终合并；resume+cumulativePreview:true只交付已有累计视频，不生成、不改变deliveryPending。动态创作提示词仅在当前agentPresets.presetForSession为video-director时注入，标准模式返回空串，不能由历史header覆盖当前标准选择。

分段结果审核不得并入或省略：paused返回后，助手先正文展示最新分段可点击链接，再立即调用video_project(action:review_segment,resume:原目录)；只在独立工具中用userQuestions弹窗，不能在生成循环里等待。续做入口和执行前校验segment-review.json中的会话/完成段数/末段taskId；未答、取消、拒绝均不放行，下一段必须新审。原任务查询、交付恢复及累计预览不新增任务则跳过，重载可复用已通过记录。Windows/macOS均用node:path和原子写入，Windows占用失败保留原文件并报错；已跑自动模拟，未跑付费与双平台桌面实测。

媒体预览使用output.presentationMeta投影成果字段，客户端读取block.meta.metaonticMedia；不投影请求、配置或密钥。本地媒体走宿主鉴权api/file，支持Windows盘符和macOS绝对路径，禁止file://及UNC；加载失败回退上游URL，保留正文原文件链接。预览不登记present、不改变交付顺序。

视频进度仅由providers/seedance.runTaskOnce的withGenerationProgress发起，结束等待即清除，不能由整个工具execute发起。外层只做finally清理与交付登记。客户端仅允许generate/extend运行时显示，完成结果只保留媒体预览；status和image不得显示视频进度。

文案按真实阶段陈述：上游成功及链接→本段生成成功，本地文件→下载完成，真实合并结果→合并完成，正文逐项链接→已交付。下载前不写已合并交付；暂停文件不称整条成片。查询失败只称状态未确认；续做复用已完成分段，新增分段仍计费；merge:false只给上游链接，无本地文件。不得保证上游链接24小时或建议因更新入口缺失直接卸载。

发布说明与验证记录分开：标签（tag）的附注和发行版（Release）正文仅包含版本标题及面向用户的“新增”“优化”，不写构建、测试、校验、CI、平台实测覆盖、未验证范围或宣传页同步等验证信息。所有验证结果与限制统一记录在 `docs/engineering/release-<版本>.md`；不得为调整说明强制覆盖已公开标签。

正式版和测试版仅提供 Windows/macOS 通用 `.tgz` 成品，不再生成或上传 Windows ZIP 及 `.zip.sha256`；Windows 与 macOS 仍须验证同一 `.tgz` 的安装与升级。历史已发布 ZIP 保留，避免旧链接失效。README 与宣传页仅展示在线安装，不推荐下载解压或目录安装。

结构维护：生成与续拍共用workflow/segment-executor.ts的executeSegmentPlan，仅请求构造、时长规划和方向游标保留在各工具；每次成功、查询不明、原始请求及onCreated仍先落盘，暂停不在工具内部弹审核。结果文案、媒体元信息与交付守卫统一读取workflow/result-state.ts；断点由validatePauseRecord验证，兼容无version及旧可选字段，损坏时保留文件并停止。进度只负责运行中的视频，tool-result独立切换成果预览。设置保存/重置/控件由settings-actions复用；测试用module-test-api导入源码，不按打包函数名或缩进截取代码，成品入口另有整包烟测。

需求时长不得默认15秒。video_project.prepare只在用户已明确时传duration，否则由duration-choice弹15/30/45/60秒和自定义，选自定义后用无选项问题输入4–120整数秒。取消/未答/保存失败保持pending，不进入角色图、脚本或视频。时长绑定项目，已有审核时长兼容沿用，修改后重审；review核对完整目标时长，续拍为本次新增总时长。

时长与完善创意同轮询问：先用一次ask_user_question分别列出完善/方向、时长、画幅、清晰度的缺失项；时长15/30/45/60秒及自定义，等回答后prepare传确认duration。prepare内询问仅作遗漏兜底，不能让“先prepare”把时长拆到创意之后。

创意完整也要确认是否完善：与缺失规格同轮询问，已明确选择不重复问。完善只补原意细节，不改主题、人物关系、核心情节或结尾；实质改动须另获同意。

流程修复：普通明确失败段重试前清除旧请求快照并按本次已审核参数构造，pending/真人转换保持原请求。费用卡口注册异常时工具执行也必须拒绝。video_extend的duration是每段秒数，review/估价/执行共同校验上限与segments，禁止静默夹短。合并与单文件交付临时写入成功后rename，不能先删已有成片；Windows文件占用报错并保留旧文件。制作确认只用视频工具付费审批，需求时长在对话中改，不引导设置页。

用户原创意中的时长/横竖屏/分辨率直接作为确认值，仅询问缺失项；完善创意不清空规格。“30秒竖屏720P”不得再问这三项，不支持的参数单独说明并询问可执行替代，不静默改值。

流水线发版（2026-11-15）：Gitee 侧的打包 + 发版都放在 Gitee Go 流水线 `.workflow/MetaOnticVideo.yml`——`v*` 标签触发时，打包步骤末尾执行 `node scripts/ci-release.mjs --dist dist --tag "$TAG"`，发行说明从 package.json 的 releaseNotes 生成并发布 Gitee Release（只发正式版；ci- 演练标签、分支与 PR 只出制品）。手动运行时可在 Gitee「运行流水线」里填 RELEASE_TAG（要发布的标签）与 RELEASE_NOTES（发版描述，逐行「新增：…」「优化：…」或整段发行版正文，合计≤100 字；都不填就按 git 标签与 package.json 的 releaseNotes 走）；描述与仓库 releaseNotes 不一致时照常发布但要在日志里提示同步回仓库。令牌配在流水线变量里（GITEE_TOKEN，别名 TOKEN_GITEE 等），绝不写进仓库或流水线 YAML——`.workflow/流水线-202611031408.yml`（Gitee 界面导出的空壳流水线）里原来写死过明文 TOKEN_GITEE，2026-11-16 已连同文件一起删除；旧值仍留在 git 历史与 Gitee 侧的流水线变量里，必须在 Gitee 上吊销换新，只删文件不算修好。发版默认在本机打包发布：`node scripts/release.mjs X.Y.Z --notes .local/release-plan.json` 直接建 Gitee Release 并核对附件；要交给流水线就加 `--pipeline`（`--ci` 同义），本机只做准备、提交并推标签，不本地打包、不需要 GITEE_TOKEN。`--both` 是本机收尾、不要与 `--pipeline` 同用。幂等靠 publish-gitee 的「已有同名附件只核对不覆盖」：本机发布后流水线又按标签跑一遍也不会互相覆盖，成品以先发布的那份为准。流水线发版失败先看 ci-release.mjs 日志里的标签与包版本、成品路径、令牌来源与 sha256，不要重打版本。打包步骤里的 `artifacts` 只是当次运行的暂存构建物（会过期），成品要长期留档必须靠同一 stage 的「上传制品」步骤 `publish@general_artifacts`（制品名 metaontic-video）。正式版还会在 Gitee Release 之后把标签推到 GitHub（流水线变量 `GITHUB_TOKEN`，细粒度令牌需 contents:write，勾选私密）：publish.yml 发现 Gitee 已有该版本就用同一个 tgz 镜像发布并跑双平台安装检查，不重新打包；没配令牌时只打印提示、不影响 Gitee 发布。

当前仅注册video-director宿主预设；剧情、风景、产品及品牌宣传等题材均由该助手按项目意图处理。新增独立预设时核对宿主YAML解析、技能入包和动态模式切换；旧会话固定身份不追溯修改。

组件中文名称：宿主包含组件列表按row.moduleName读取<完整模块名>/locale/en.json及同目录语言文件，不读预设config.name。视频创作助手预设用dsh-metaontic-video/presets/video-director独立入口转导出宿主dsh-agent-preset，并导出对应locale；不修改宿主文件。打包核对wrapper与locale均纳入，宿主解析名称而非仅模式列表名称。

Agent组件图标使用<完整预设模块>/icon导出，SVG在presets/icons；需核对宿主readPluginMeta返回图标、成品入包和24/40px明暗背景显示，不修改插件总Logo。

鉴权提示分层：聊天“本轮运行失败/API密钥无效”来自宿主AUTH turn-error，与视频接口工具错误不同。客户端通过conversation.chat.node官方keyed扩展包装原renderer，仅AUTH使用友好提示并引导Harness模型设置，其余code里再认一类「工具参数不是合法 JSON」：模型把 480p、16:9 这类值裸写、不带引号时，宿主只在解析参数阶段抛 Json 报错，用户只看到「本轮运行失败」；这类换成「没真正调用工具、也没产生费用，回一句按原参数重试」的说法并保留原始报错，其他消息原样委托原组件。参数说明与动态提示词都要写明枚举值要带引号，试算侧还要把 480、480P 这类写法归一成 480p，双保险；不得覆盖宿主词典或写宿主安装文件。视频HTTP401/403在classifyError中保留provider_auth与状态码，提示插件设置及客服，不直断密钥无效、不回显原始鉴权报错，不改轮询重试与防重。

说明书源码仓库政策：用户要求MD/PDF及其docs/guide配图仅留本地。git rm --cached保留本地，.gitignore阻止误提交；README统一链接https://ai.mybfs.cn，不重写历史。成品包是否附带属于独立范围，未明确要求时不擅自移除包内说明书。

插件对外亮点固定两点：新手快速上手视频创作、低成本长视频生成方案。README、插件描述、仓库简介、宣传页和社区介绍均围绕这两点，不把其他能力扩成独立卖点；操作说明保留必要事实，不承诺所有模型下固定低价。


专业链路维护：分镜示意统一video_project storyboard本地渲染，不注入手写SVG指令。compile保存plan_digest，video_project审核和assertProjectApproved均核对compiled提示词/分段/规格；参考图等补充仍需制作审核。旧绑定缺摘要必须重新编译。production_strategy默认continuous_segments，显式independent_shots按4秒至模型上限逐镜生成，估价/执行共享resolveTargetPlan，断点保存策略和时长，续做不得改计划；各镜无video输入，直接剪辑不裁接缝、不作累计成片识别。付费确认及逐段审核不变。能力来自providers/capabilities本地适配器，ADAPTER_DEFINED不是渠道实测，未知保持null。新quality_policy=evidence_v1检查场次可观察证据、评分依据和主题场次引用，口速估时仅提示并要求复核。锁恢复只认同机死亡进程，不按超时夺锁；read不持锁。快照保留最近30份和批准/依赖版本；未变化写操作不留重复快照。film_stage_finished只记录固定类别、耗时和响应字节，无正文或密钥。相关测试film-global-improvements.test.mjs；Windows实机未验证时不得宣称已覆盖。

边界补充：独立镜头shotFrames按完整shotDurations保存和恢复，全局首尾帧仅首镜/末镜，首帧不提升为共享人物参考。hasProjectImages与角色选择共用素材判断。video_project status和审核答复后均核对filmSource版本/摘要/模型。视觉visual_style/style_profile仅失效资产与下游，tone默认叙事变化，显式change_scope=visual_only才保留故事批准且不能混改内容字段。合并混合音轨须补静音、统一时间戳及长度，音频编码失败不能退无声。写锁/恢复锁元数据完整后硬链接独占发布；恢复者中断时递归清理同机死亡token，未知/空/异机/活跃锁不得自动删除。跨平台硬链接不支持时明确失败，不降级为不安全抢锁。

流程画布已完整移除：不恢复任何入口、开关、工具、原生接口、历史读取或自动同步代码。既有本地文件保留，不删除用户资料；普通视频任务按原taskId/resume继续查询和交付。参考图画幅适配不是流程画布。见canvas-hidden.md。

README 不展示各版本更新条目；发布脚本只同步其在线安装链接，更新内容写入 CHANGELOG、包内 releaseNotes 与 Release。包名为 dsh-metaontic-video，配置命名空间与历史数据目录仍为 metaontic-video；发布附件文件名保持 metaontic-video-X.Y.Z.tgz。市场索引只收录清单包名匹配的标签，不能将旧包名版本伪装成新包名版本。

README 编辑先遵守 docs/engineering/readme-guidelines.md，功能变化不逐条追加到首页。纯文档修改只检查文档结构和链接，无需构建或重复业务测试。

包名迁移必须验证双包同时安装且启用的真实状态，不能在测试中手动改好启用列表后称迁移通过。新宿主等待旧 bundle 停用后才注册工具，新客户端先挂独立迁移设置页，核实 setBundleEnabled 后再装配共享界面。停用不等于卸载，不删除配置或任务；仅真实 restart-required 提示重启。docs/engineering/withdrawn-releases.json 中的版本不得重新发布或出现在市场索引中。

迁移完成需区分停用与卸载：旧包已停用时正常设置页仍提供清理入口；仅经确认通过宿主removeBundle清理旧包，前后核实新包启用及旧包移除，失败保留正常设置。stop-profile是结束当前运行环境的要求，不能伪装成自动清理成功；自动回归不代表真实桌面迁移验证。

迁移异步操作每次停用/卸载前重新检查AbortSignal；清单查询超时只取消等待，不重放变更接口。安装检查从双包启用的初始状态驱动实际成品客户端按钮，不能写好预期启用列表替代验证；临时profile API适配验证与真实桌面验证分别说明。

## 市场固定安装包

GitHub 正式版完成双平台安装检查后，通过 `scripts/publish-stable-alias.mjs` 将已验证版本包原字节复制为 `metaontic-video.tgz`，下载复核后公开并维护 Latest；续跑不覆盖附件，补发旧版不倒退 Latest。清理附件时保留该固定名称。市场固定地址首次切换须等待正式版真实具备附件，不能提前提交失效地址；具体流程见 `stable-market-download.md`。内部升级仍使用具体版本成品地址。

## 专业工具返回与审核补展示

Harness 拒绝带 undefined 的工具输出，错误为 INVALID_TOOL_OUTPUT / value is not lossless JSON；execute 内部成功不等于宿主接收成功。film_project 在返回边界转换为可无损传输的 JSON，回归覆盖 create/read/next/route/export；非有限数字拒绝返回。发生输出错误时不要重复create或未经用户决定降级，应先核对保存状态。审核守卫拦截若返回presentation，按其markdown补齐同一保存稿和绑定原图，沿原projectId与specification重试；分镜失效才重新storyboard，不自行转图或查源码试错。

Gitee 固定最新版包：用户要求后续发版同步维护 `https://gitee.com/hackloop/metaontic-video/releases/download/latest/metaontic-video.tgz`。本机、Gitee Go 与手动同步统一调用 publishGiteeWithAlias，先发布版本包，再从线上版本包复制原字节为固定名称并下载校验，不重复打包、不覆盖已有不同内容。宣传页使用固定地址。内部更新按用户新要求使用固定最新地址，附已确认版本参数隔离缓存，宿主返回版本不一致时不可报告成功；此前“内部更新只用具体版本 URL”的约定由本次明确要求调整。

宣传页同步约定：用户明确要求后续发版不更新宣传页。release.mjs 不读取或写入服务端宣传页，仅维护正式版固定安装附件；sync-promo-address.mjs 保留为单独维护工具，用户明确要求更新页面时才执行。

历史发行版清理：用户最新要求每仓仅保留最近8个正式版，清理工具和定时工作流默认保留8个；按平台独立排名，删除发行版必须同步删除对应平台标签，固定名称最新版附件仍保留。Gitee 上传遇到企业附件配额已满时，`publish-gitee.mjs` 和固定最新包入口会自动走 `scripts/gitee-quota.mjs`：只清理 Gitee 超额旧版、打印保留/删除清单、同步删标签并重试同一成品；不动 GitHub 与本地标签，不换版本号，清理后仍不足则明确失败。

日志维护：appendRequestLog入口固定字段、移除原始错误/请求正文，路径只留文件名；NODE_TEST_CONTEXT且未指定DSH_HOME时不写真实用户目录，真实落盘测试必须使用临时DSH_HOME。每日5MB、历史清理阈值50MB、30天保留，有界队列256；达到上限记dropped，失败记只读健康状态，video_config get返回logging。错误与审批/暂停状态分开，调用/session/project/task/index关联，嵌套阶段保存parentSpanId。不要以日志异常重提付费任务。详情见logging.md。
匿名身份维护：主文件与锚点的初始化/修复统一跨进程锁+原子替换，持锁后重读，失败不缓存null；不得宣称硬件设备唯一或清除整个数据目录仍可识别。真实12进程并发测试见analytics-identity-process.test.mjs。

专业创作断点：先查真实session与project.json，区分user abort和接口失败。创意/剧本只由film_project approve弹窗，不能先通用问卷再审批；同版本已批准的重复approve直接返回下一任务，不重复弹窗，旧expectedRevision仍拒绝。read/approve返回continuation提示继续尚未保存的剧本，不能将规划文字当剧本已交付。

冗余治理：tsconfig启用noUnusedLocals/noUnusedParameters；保留公共函数参数位置，明确未使用参数以_前缀标记。八角色统一从src/agents/<role>/index.ts加载，不增加roles重复包装。流程画布代码已移除，构建不再使用相关功能开关。宣传页检查归sync-promo-address独立工具，release不导入。

中国镜像包介绍：成品不含README.md时，npm会回退读取README.en.md，导致中文镜像显示英文。build将中文README写入package.json标准readme元数据，所有图片必须HTTPS绝对地址，文档相对链接转换仓库绝对链接；不得依赖npmmirror unpkg单文件权限。宿主meta.detail继续指向空plugin-detail.md，避免把仓库README重新塞进插件设置页。公开npm同版本成品不可覆盖，修改随下次明确发版生效。

创作质量维护：新专业项目canonical_v1从场次/节拍/对白渲染正文；chapter_v1长片使用chapter_plan/chapter_submit保存连续性，不能把部分章当完成。isolated_v1终审通过independent_review真实文本请求，文本按渠道实际用量计费且不另弹费用审批，隔离聊天与自评，运行时摘要绑定报告；手工submit不能绕过。大型稿件分章完整审阅，成功报告按输入/模型/地址/提示词断点复用；失败或未知调用不擅自重放。六维艺术结论必须有场次证据，离线自动项不能冒充艺术通过。渠道能力按地址摘要隔离，成功样本不推断上限。新用例film-architecture.test.mjs，具体边界见creation-quality-architecture.md。

最低支持版本维护：config/update-policy.json 通过双仓 contents API 下发；先发布可安装正式版，再提高 minimum_version 并递增 revision。普通更新可跳过，强制提示不接受稍后缓存；工具装配层统一阻断新创作与付费提交，不阻断已有任务查询、图片取件、结果核对/回写和导出。resume 会新增付费调用，不能豁免。断网保留已验证策略，首次离线无缓存不封禁；撤销门槛须用更大 revision。旧版无此协议不能追溯控制，本地修改不等于策略已经公开。详见 mandatory-updates.md。

专业剧本批准前展示：submit/read/next返回待script批准时，full与compact均携带approval_material（绑定已保存剧本修订号和完整Markdown）。助手先独立正文完整展示，再单独film_project approve；不再要求仅在审批卡片展示全文。未展示不能沿用批准，应补展示后重新审核。不重建项目、不重做已批准创意。

审批展示补齐：创意也返回完整approval_material；next及read(stage)不能丢失同版材料。问题服务缺失/未答返回材料并保持未批准。专业展示由当前会话assistant/message文本事件强制匹配当前修订号材料；创意和剧本都先submit再展示，长稿按approval_material分页顺序展示全部页后批准，不把工具返回或推理当用户已看见；见approval-presentation-audit.md。

设备数优先：plugin_started/plugin_installed共用持久化独占登记标记和确定性eventId，每匿名设备只尝试登记一次。标记先落盘，结果不明不重试，失败不清标记；工具与任务统计仍按原逻辑。普通重装保留状态不重报，清空全部身份状态不能保证物理设备去重。不更新版本或发版除非用户明确要求。

专业Agent执行可靠性：create默认按会话与规范化需求复用，operationId用于显式重试/另建，冲突不得覆盖。compile固定制作ID并在一次原子写入中保存完整绑定，中断恢复校验来源、修订号、模型与摘要。独立审核先落本地review-requests，再调用模型；原始回包先保存后解析，结果不明或解析失败不自动重放。review_requests只返回状态摘要；retry_review必须经原生问题窗确认可能重复计费，仅清该项checkpoint并授权再次请求。上下文80,000字符预算超限返回scope_required或阻断审核，不静默截断；逐章终审后增加有跨章证据的全片结构审核。离线compare评测须覆盖六案例，约束、艺术结论、用量和人工偏好都需要证据；无记录保持未知。见creation-quality-architecture.md。

制作review补展示必须按missingMaterials独立计算正文与绑定图状态，只缺分镜时返回图片和链接，不重贴已展示的同版剧本。旧稿不可复用新版展示事实，转换PNG不能代替绑定SVG；回归film-output-contract.test.mjs。

设置页README回退根因：宿主dsh-plugin-detail直接read包内locale/<语言>.json，不走package.exports。build必须同时生成dist/locale与物理locale两处相同JSON，files纳入locale/*.json及空plugin-detail.md；局部build:host/client不能删除物理locale。仅有dist/locale与exports映射不够，安装检查必须断言物理文件、meta.detail及空正文，避免每次重装回退README。组件元信息仍通过原导出路径读取；npm中文readme元数据独立保留。

本地同版本反复打包安装时必须使用新的成品路径；覆盖原tgz再pnpm add同路径可能仍复用旧缓存（exit0但added0、托管dist哈希仍旧）。复制同一已验证成品到新安装批次目录后再通过dsh plugin add安装，核对托管dist和物理locale哈希，不能只看CLI成功。

运行代码更新验收：同版本dsh plugin add成功、磁盘哈希一致都不证明已加载。profile HMR root=[]且启用bundle列表未变时，宿主manifest刷新可能直接返回并保留旧模块。检查无执行中视频后，备份并只调整本插件已安装入口的HMR监听；保留其他监听与业务配置。以真实工具响应的新协议字段或宿主明确HMR事件验收，无法读取运行状态时说明未实测，不无证要求重启。

用户可读材料：不得将type_details英文键名或review_status等枚举直接当正文标签。审批和新旧导出共用approval.presenter的readable；新增类型字段同步中文标签，六类配置回归覆盖。用户正文分组、要点列表，保留对白/提示词/专名原文；JSON工具协议不翻译。构建与运行身份及内容寻址安装见build-identity.md，npm pack前必须通过源码与文件摘要校验，磁盘安装不等于运行模块已切换。

工具调用中文标题通过宿主ToolDefinition.presentCall返回generic卡片title，公共tool.adapter统一注入并由计时/统计包装保留；不能直接将name改为中文，以免破坏模型协议与历史记录。新增工具及film_project动作须同步shared/utils/tool-presentation.ts，真实构建注册覆盖见host-integration.test.mjs。工具展开后的技术标识与原始参数仍由宿主控制，插件不修改宿主文件。

创意重复展示先比对真实assistant正文与保存稿，不把“自行润色省略后被守卫拦截”误判成卡片重复。首次原样展示已排版approval_material，短稿补缺按完整原文段落，不再退回整篇；长稿继续严格逐页，不能语义相似度放行。故事结构使用标题加累计时间范围和内容分组，不堆段落/标题/时长字段；未知时长不补造后续时间点。

三端并行发布：release.mjs --all 在共享构建、测试、Windows/macOS安装检查和CI暂存包摘要核对之后，启动GitHub/Gitee/npm三个独立Node子进程，避免同步npm/gh命令堵塞其他渠道。Promise.allSettled保留各端结果并写channels.json；续跑按同版成品核验已完成端，不改标签或覆盖附件。npm提交前落npm-submission.json，平台处理中或提交结果不明时不因404重放，核对公开包与镜像；npm-publish.lock防止同版本并发提交。进程异常留下锁时先核对进程和提交状态，不清提交记录绕过防重。回归见release-parallel.test.mjs；该调整属于工程工具，不单独发版或写入用户更新说明。
