# 原版无限画布伴随接入

视频面板接入 `@ninkch/dsh-infinite-canvas`，未复制原版源码，未注册自建画布槽位，未增加插件运行依赖。安装按钮调用宿主 pluginManager.installBundle，固定使用已核对发布的 npm 成品 `0.20.1`。已有任何版本安装（含目录链接）均不替换、不升级；加载异常或已禁用引导插件详情。

上游契约核对：

- https://github.com/NINKCH/dsh-infinite_canvas/blob/main/package.json ：npm 包名、导出和独立插件形态。
- https://github.com/NINKCH/dsh-infinite_canvas/blob/main/client.js ：右侧页签 kind 与主面板 id 均为 `infinite-canvas`。
- npm view 核对 `0.20.1` 已发布；不是从 Git 默认分支安装。

打开顺序为 sidebarRight.openTab，再按服务可用性回退 layout.selectPanel。安装仅在用户点击时发生，不自动复制 API密钥，不复制供应商配置。新增 video_canvas 工具读取项目、节点及上游素材；原生成工具接受画布绑定并验证快照，沿用插件既有规格审核和费用确认，成功素材回填为新增节点。原版节点生成按钮仍使用原版配置，联动通过视频创作助手对话发起。

Windows/macOS 均经宿主服务安装 npm 成品，不拼接平台路径或命令，不触碰已有本地安装目录。仅宿主明确返回 restart-required 时提示重启。

验证：类型检查与构建；安装检测、已有目录保留、固定安装源、失败不重试与重启语义的模拟测试；本机 Chrome 中通过预览宿主验证安装和打开右侧页签动作，无真实安装及付费请求。未做原版插件在真实 Harness 中的安装、热加载、Windows/macOS 桌面端到端验证，因此不承诺这些实测结果。测试包不创建正式 Release 或标签；工作区正式版本与 releaseNotes 已恢复。

## 测试包 3.20.1-test.1

- 地址：https://video.mybfs.cn/test/metaontic-video-3.20.1-test.1.tgz
- SHA-256：e34992b680344c528c6b37c20ba0c4fd605cf60809052c05e00491268219b107，1,286,102 字节。线上下载与本地逐字节一致。
- 类型检查、构建及426项测试全部通过。补充宿主cancelled/overridden/未知回包失败关闭、缺失文件判定及saveExact安装。
- 本机macOS通过宿主Node 24/pnpm 11.28.5 strictDepBuilds成品安装与升级自动检查，配置/任务保留、中文空格路径、原安装源移动后读取、入口、locale及技能、MD/PDF完整。
- 说明书从原工作区恢复到本地并补充无限画布使用说明，重新生成PDF；MD/PDF和配图已纳入测试包，仍由gitignore排除，不提交源码。
- 未运行GitHub双平台CI，未做Windows与macOS真实Harness安装、画布加载及桌面操作实测；Windows仅有构建与打包层面的保证。没有新增付费任务。
- 不创建标签或正式Release，不推送仓库；工作区版本保持3.20.2。

## 设置保存修正版 3.20.1-test.2

原因：persistConnection每次保存写入apiKey/keyOrigin/registerEmail/deviceId/deviceSecret等已从Config移除的登录字段；宿主settings.write逐路径检查volatile，未知字段使整批被拒。同样的问题存在重置字段名单。

保存仅清空当前声明的另一渠道字段；重置使用完整当前配置白名单，不附加旧user键。旧登录记录不参与新任务，不迁移凭据。保留整批原子写入、revision检查、冲突停止、草稿保留与通信不明不重试语义。

回归覆盖保存每项操作与真实Config.dict及volatile声明对照，重置名单与全部当前配置字段一致，旧用户字段不进入重置。构建与428项测试全部通过，macOS宿主Node 24/pnpm 11严格成品安装及升级检查通过。Windows及真实Harness设置保存尚未实测。MD/PDF同步并纳入包，资料仅本地。

地址：https://video.mybfs.cn/test/metaontic-video-3.20.1-test.2.tgz

SHA-256：02b08ca199de6974955c287efd040cbe089896dfb7c889b0add8a7a116e135fd，1,290,466字节，线上与本地逐字节一致。测试包不创建Release/标签，工作区正式版本恢复3.20.2。

## 生成联动测试包 3.20.1-test.3

支持读取指定画布节点、端口关系和上游素材，通过现有图片/视频/续写工具生成并新增结果节点。规格审核包含画布绑定；执行前核对节点快照，变化时停止。结果同步失败保留成功任务，通过所属会话的同步令牌重试回填，不重复付费生成。源节点删除后不复活，重复同步不新增重复节点。

可选适配固定原版0.20.1的私有 _internals 接口，版本或能力不匹配时关闭桥接，不影响未绑定画布的任务。素材写入原版项目数据目录，未复制密钥。涉及文件均使用平台路径API；Windows尚未实际运行。

验证：类型检查、构建、435项测试通过；使用实际npm原版0.20.1执行加载、项目读取、素材注册和幂等回填集成检查（模拟视频，无付费请求）；macOS严格成品安装与升级自动检查通过。未进行真实Harness桌面操作、付费生成或Windows实测，未运行GitHub双平台CI。说明书MD/PDF已同步并纳入包，保留本地忽略。

地址：https://video.mybfs.cn/test/metaontic-video-3.20.1-test.3.tgz

SHA-256：8661db3b57d4efe0f119b2cd1866f3f3a1ca2e9957d66e8b60f59c787d850a71，1,297,305字节，线上与本地逐字节一致。没有创建正式Release或标签，工作区正式版本保持3.20.2。

## 选中节点入口测试包 3.20.1-test.4

原版画布工具栏新增“用 MetaOnticVideo 生成”：读取DOM中单个选中节点和当前图节点集合，通过原版只读projectsList/projectsGet定位唯一项目及子画布，自动打开video-director预设并填入请求。用户点击发送，后续沿用方案和费用审核。已有草稿使用append保留，不自动发送或付费。未选/多选禁用；读取失败、未同步、重复归属、读取期间切换选择均停止。DOM观察随插件生命周期清理，不改原版源码、配置或生成按钮。适配原版0.20.1已核对的DOM结构；将来上游结构变化需重新核验。

440项测试、构建、类型检查及macOS严格安装升级检查通过。使用原版0.20.1真实客户端在Chrome渲染（模拟宿主与媒体服务）验证选择/多选、自动草稿定位、重新渲染单一入口、卸载重挂及720px工具栏显示；没有付费调用。Windows与真实Harness桌面点击流程未实测。用户指南MD/PDF已更新纳入包，仍本地忽略。

用户明确要求安装本地，执行dsh plugin --profile desktop add本地tgz成功，从test.2升级到test.4，已核对托管包版本与新客户端入口。CLI安装未提供applied/restart-required回包，不能据此断言运行窗口已热加载，也未要求用户重启。

地址：https://video.mybfs.cn/test/metaontic-video-3.20.1-test.4.tgz

SHA-256：409c6fa0d50812efd6dcfd64f6cddef465344bcb3e11c587aacf5956b4ced7cf，1,300,747字节。线上成品与本地安装包一致。未创建正式Release或标签，源码正式版本保持3.20.2。

本地运行检查补充：使用本机现有Harness登录会话，在独立Chrome上下文连接正在运行的desktop宿主，打开原版无限画布，确认真实页面工具栏已有“用 MetaOnticVideo 生成”与唯一launcher元素，证明运行宿主可加载新客户端。检查时未选择或修改用户节点，未发送会话消息、未发起付费任务。独立浏览器上下文初始图为空，因此未验证真实节点到助手草稿及付费成果回填全链路；不等同Electron原窗口实测。

## 画布内直接制作测试包 3.20.1-test.5

节点内生成与重新生成由客户端捕获，在画布对话框确认方案、费用及纯文生选择，服务端绑定节点摘要、配置快照和单次方案ID执行。没有创建助手会话或自动发送消息，不伪造宿主审批。使用现有Seedream/Seedance协议、请求构造、连接快照与提交防重；图片API密钥仍按共用/独立配置路由。每个节点只执行一个视频段，审核结果后可选成果续拍，续拍审核事实读取本插件私有记录，不信任节点的approved字段。原版批量/右键运行、剧本分镜等其他工具保持原版路由，界面明确说明。

图片仅1:1单张2048×2048；视频4秒至对应模型单段上限，480P/720P。不支持的扩展参数、混用首帧/参考图、尾帧选取连接及@设定引用均停止。成果与taskId先保存到本机私有记录，再回填原画布。记录不存API密钥。重复start幂等，提交不明阻止再次提交，已知taskId只补查，回填失败只补传。关闭确认窗不取消已提交任务。活动任务检查包含直接制作记录；卸载中断等待，不重新提交。

449项自动测试、类型检查及构建通过。使用真实原版0.20.1客户端、模拟宿主和生成服务在Chrome验证原生发送按钮捕获、未确认不提交、不创建草稿、一次提交、视频预览/结果审核、卸载重挂与720px窗口显示，无真实付费请求。指南MD/PDF同步纳入包且仍由gitignore排除。Windows代码使用node:path及同目录临时文件原子替换，未做Windows桌面验证；未做真实付费生成与Electron完整流程实测。

本地包：`.local/test/3.20.1-test.5/metaontic-video-3.20.1-test.5.tgz`；1,214,091字节；SHA-256 `39875ce75b8f32c43ce0d9eff6445ded974e2e25050e304bd2fb0ba48d41e7a0`。未上传服务器或创建Release/标签。经用户要求，desktop profile安装原版0.20.1，并将本插件从test.4升级到test.5，已核对托管包版本及客户端/服务端直接制作入口。CLI未返回applied/restart-required，不能据此承诺当前窗口热加载，未要求重启。源码版本与releaseNotes保持3.20.2。

## 节点接入显示修正版 3.20.1-test.6

用户反馈看不出结合。运行宿主的独立Chrome上下文确认原版画布已加载直接制作入口、服务端路由响应；同时发现另有Agent Forge的Haitang-Hub创作画布，属于不同插件与独立iframe，本桥接只适配原版画布，不冒称两个都能用。

原版媒体节点生成面板增加实际接入、模型、密钥就绪状态与单段能力提示，隐藏未参与本次制作的原版模型选择器，将箭头显示为“生成并确认费用”。只改变媒体节点，退出插件恢复原版控件。只读info接口不返回密钥或完整配置，不产生付费调用。切回窗口刷新接入状态，最终制作仍绑定服务端配置快照并重新核对。

450项测试、构建、类型检查通过，真实原版客户端与模拟服务验证媒体模型选择器隐藏、实际模型展示、按钮确认/审核及卸载恢复；无付费调用。指南MD/PDF同步，macOS desktop已从test.5安装升级到test.6，未运行Windows桌面验证、未宣称Electron原窗口已刷新。

本地成品：`.local/test/3.20.1-test.6/metaontic-video-3.20.1-test.6.tgz`；1,215,871字节；SHA-256 `424be4b79032bf72ff10420f9a810f3afda8652edd14ea3054740f478691b671`。未上传服务器、未发版。

安装后在独立Chrome上下文连接当前运行的Harness，打开原版无限画布，确认直接制作入口存在，info接口HTTP200，返回当前真实视频模型与密钥就绪状态（不返回密钥）。未修改项目/节点，未发送聊天，未付费生成。画布不会按助手对话自动新建项目或铺设分镜，目前仍需用户先创建项目与媒体节点。

## 对话自动融合测试包 3.20.1-test.7

启用既有canvas-project模块，video_project prepare自动建立并请求打开原版项目，review同步完整脚本、分镜和实际制作段计划，status沿已审核材料幂等补同步。生成/角色图工具按projectId自动取得绑定，resume从原断点恢复项目绑定；投影绑定不修改生成参数或审核摘要。自动管理节点或连线被用户修改/删除时停止同步，不覆盖或复活。已有显式canvas绑定仍优先。画布未就绪保留创作项目并返回同步状态，不绕过任何费用与成果审核。

构建、451项自动测试、diff检查通过；实际npm原版0.20.1临时环境验证自动创建/打开、脚本与制作段计划同步、重复调用仅一个项目、隐式项目绑定和模拟媒体回填，无付费请求。macOS宿主Node24/pnpm11严格成品安装升级检查通过；desktop profile从test.6升级至test.7并核对已安装代码。CLI未返回applied/restart-required，未断言Electron原窗口已热加载。未覆盖真实付费全流程和Windows桌面实测；平台路径继续使用node:path和原子写入。

本地包：`.local/test/3.20.1-test.7/metaontic-video-3.20.1-test.7.tgz`，1199994字节，SHA-256 `90a55a883655cc7102231a4187cfda170cf3fb0c668b5bbd48343317391abe69`。未上传、未创建标签或Release；源码正式版本与releaseNotes保持3.20.2。指南在用户后续要求不再更新之前已同步本地MD/PDF，此后未继续调整。

## 连线补发与画布命名修正 3.20.1-test.14

自动同步写画布文档走的是原版 projectsPut，它不产生「文档已变更」信号：画布端只在收到该信号时才 mergeHostDoc，否则只按缺失节点补齐、不合并连线，于是对话侧建好的节点在画布上可见、连线一条都没有。现在每次 projectsPut 后补一次幂等连线确认（canvasConnect，已存在则原样返回），打开中的画布会重新拉取并合并连线。

画布名与会话标题同源：创建时用标题，标题未生成时用中性名（不带创作项目 ID，旧记录里带 ID 的创建名不再沿用）；会话标题落定或被改写时由 session/title 事件补名；同步时也核对一次。会话标题分两步落定（先 fallback、再由标题模型给正式标题），两次事件都会补名。

原版按名字复用项目：只有空项目（上次创建中断留下的）才认领，同名项目已属于别的创作项目或已经装了内容时，改用带序号的名字另建，不写进别人的画布。用户手动改过的项目名、画布名一律不动；已经交付过名字后，画布端推回本地缓存的项目名不再来回改，避免两端反复覆盖。

已把用户现有 6 个自动画布的名字对齐到对应会话标题（改名前用 sqlite3 .backup 备份到 /tmp/canvas-backup-before-rename.db，改后节点/连线数不变）。原版画布端把「默认画布名」当 Host 权威字段、把「项目名」当本地字段并回推，所以画布名会稳定显示会话标题，项目名在画布端缓存过时仍可能显示旧名，可在画布项目树上就地改名。

验证：类型检查、构建、462 项自动测试、diff 检查通过；真实 npm 原版 0.20.1 临时环境核对创建命名、标题事件补名、2 条连线保存后保持、用户改名不被覆盖、同名占用让开，未使用用户数据根、无付费请求；本机运行宿主 RPC 核对现有 6 个画布改名结果。

监听通道用本机证据核对：本机会话日志里存在 session/title 事件（同会话先 fallback 再 provider 标题），插件同一条 session/event 监听已在本机写入 script_saved 日志，说明该事件总线对插件生效。

未覆盖：真实桌面端从建图到回填、标题事件补名的端到端未在真实窗口复核；项目名由画布端本地缓存回推，缓存过期前仍可能显示旧名；标题始终为空的会话只有中性名；Windows 未实测；付费生成全链路未验证。

本地成品：`.local/test/3.20.1-test.14/metaontic-video-3.20.1-test.14.tgz`，1204358 字节，SHA-256 `cd07ebfa176cbfc97aa1bafe52d9d8f8e834370ef1090e785eabcded3773317a`（test.13 为同次中间包，已被 test.14 取代）。未上传、未创建标签或 Release；源码正式版本与 releaseNotes 保持 3.20.2。经用户要求，desktop profile 已从 test.12 安装升级到 test.14，并核对已安装包版本与包内构建产物含本次改动。CLI 未返回 applied/restart-required，不能据此断言运行窗口已热加载，未要求重启。

## 版本门放宽与失败诊断 3.20.1-test.15

现象：本机新建创作项目后没有生成流程画布，项目记录里没有 canvasAuto，只有一句「自动画布尚未就绪」。原因有两层，都在插件这一侧：适配器把原版版本锁成 `0.20.1` 单值，而桌面 profile 里的原版被它自己的更新按钮升到了 `0.20.2`，于是加载直接以 version 失败，创建流程根本没走到建画布那一步。

顺带核对出一个上游问题：npm 上 `@ninkch/dsh-infinite-canvas@0.20.2` 成品包不完整，`index.js` 第 20 行 `import { planShotSegments } from './shot-segments.js'`，但包内没有这个文件（`npm pack` 解包共 245 个文件，无 shot-segments.js；包内 `files` 字段也没列它）。当前运行中的宿主是升级前装载的旧模块，所以画布 RPC 还能用，一旦重启原版就整块加载失败。故本机用 `dsh plugin --profile desktop add @ninkch/dsh-infinite-canvas@0.20.1` 回到完整可用的 0.20.1，插件安装按钮继续固定 0.20.1。

改动：`canvasVersionSupported` 把版本门从「等于 0.20.1」改成「0.20.1 起」（0.20.x 及更高主版本放行），真正的开关仍是 rpc/_internals 能力核对；失败分四类分别报出——未安装、版本不支持、模块加载失败（安装不完整）、缺少联动接口，并把原因透传到 canvasProject 的 unavailable reason，用户据此知道该重装、该升级还是该等。

验证：类型检查、构建、463 项自动测试、diff 检查通过；`.local/canvas-qa/version-gate.mjs` 用真实包核对四种失败分类（无包／伪 0.20.0／官方 0.20.2 解包／完整 0.20.1）；`.local/canvas-qa/auto-name.mjs` 用真实 0.20.1 复核创建命名、标题补名、连线保持、用户改名不被覆盖，未使用用户数据根、无付费请求。本机重启宿主后 `/infinite-canvas/api/rpc` 的 projectsList/dataRootGet 正常返回，说明 0.20.1 修复在真实进程里生效。

未覆盖：官方 0.20.2 无法加载（上游缺文件），未验证它在任何环境可用；桌面窗口内的建图到回填未复核；Windows 未实测；付费生成全链路未验证。

本地成品：`.local/test/3.20.1-test.15/metaontic-video-3.20.1-test.15.tgz`，1204708 字节，SHA-256 `06d06de2f85e39c31b31a4bd4246edc0fa55984f2cef33aecee88deb0227dda7`。未上传、未创建标签或 Release；源码正式版本与 releaseNotes 保持 3.20.2。desktop profile 已从 test.14 升级到 test.15，并核对包内构建产物含本次改动。

## 上游 0.20.3 补齐与安装固定版本更新 3.20.1-test.16

上游已发布 `0.20.3`（npm `latest`），它补上了 0.20.2 漏打包的 `shot-segments.js`，`index.js` 的本地依赖（index-core-skill-profile／skill-pack-loader／skill-pack／production／shot-segments）现在全部在包内。核对结果：host 半部可直接加载，`projectsGet/projectsPut/projectsList/assetsGet/assetCreate/projectDirGet/dataRootGet/canvasCreateProject` 与 `canvasConnect/objectAbsFor/physicalRel` 齐全；真实 0.20.3 临时环境复核自动创建命名、会话标题补名、2 条连线保存后保持、用户改名不被覆盖，未用用户数据根、无付费请求。

因此插件安装入口的固定版本由 `0.20.1` 升到 `0.20.3`（`src/client/infinite-canvas.ts` 的 CANVAS_SPEC），适配器的版本门仍是「0.20.1 起」，老安装继续可用；已有安装依旧不替换、不升级。`.local/canvas-qa/version-gate.mjs` 现覆盖没装／版本过旧／装不全（官方 0.20.2 解包）／正常 0.20.1／正常 0.20.3 五种情况，`.local/canvas-qa/auto-name-0203.mjs` 用真实 0.20.3 复核与 0.20.1 相同的建图行为（该脚本需先 `apply` 原版插件，`_internals` 的 rpc 表在 apply 时才装配）。

本机 desktop profile 已装原版 0.20.3，运行中的宿主画布接口恢复（dataRootGet 正常返回既有数据根）。验证：类型检查、构建、463 项自动测试、diff 检查通过。

未覆盖：桌面窗口内从建图到回填的端到端未复核；Windows 未实测；付费生成全链路未验证。

本地成品：`.local/test/3.20.1-test.16/metaontic-video-3.20.1-test.16.tgz`，1204708 字节，SHA-256 `88fe4dc572e525694830b94303199ba0a383ba4a80b30d1bd5c5b8c80fbc4b41`。未上传、未创建标签或 Release；源码正式版本与 releaseNotes 保持 3.20.2。desktop profile 已从 test.15 升级到 test.16，并核对包内构建产物含本次改动。

## 内置流程画布 3.20.1-test.17

不再依赖原版：新增 `src/businesses/video/integrations/canvas-builtin.ts`，在插件自己的目录里实现与原版同形的 `projectsGet/projectsPut/projectsList/assetsGet/assetCreate/dataRootGet/projectDirGet/canvasCreateProject/canvasRename/canvasOpen` 与 `connect`（幂等连线）。因为接口同形，`readCanvasInput`、`publishCanvasResult`、`markCanvasChanged`、`canvas-project` 的建图与补名全部原样复用，没有第二套映射逻辑。

后端选择规则（`resolveCanvasAdapter` / `adapterForNewCanvas`）：内置存储里有这份文档就走内置；老绑定（已有原版 projectId）继续留在原版；新建画布默认写内置，设置项 `canvasBackend: 'original'` 可强制回原版；显式注入的加载器（自动化检查、备用实现）优先。存储位置 `~/.dsh/metaontic-video/canvas/projects/<id>.json`，素材与成果在 `~/.dsh/metaontic-video/canvas/data/`，不再需要用户去原版画布设置数据根。

界面：`src/businesses/video/client/canvas-view.ts` 在插件面板新增「流程画布」区，按画布列出（名字即会话标题）并渲染节点与连线（平移、缩放、重置），图片/视频成果用 `/metaontic-video/canvas-media` 回看；画布文档读取走 `/metaontic-video/canvas`，两个路由都与原版一样限定同源 POST／同源 GET。

验证：类型检查、构建、464 项自动测试、diff 检查通过。新增 `tests/canvas-builtin.test.mjs` 在「原版画布完全不存在」的前提下（`loadCanvasAdapter` 断言必须失败）完成：建图（script/storyboard/两段制作计划/production + 2 条连线）、画布名与默认画布名等于会话标题且不含创作项目 id、重复同步幂等、标题事件补名、用户改名不被覆盖、`readCanvasInput` 读回、成果回填落到插件自己的数据根并登记资产。

未覆盖：真实桌面窗口里的画布交互（需要宿主重载后复核）；画布节点上的「生成并确认费用」「审核」入口尚未接到内置画布（当前仍走助手与工具、原版节点捕获不变）；Windows 未实测；付费生成全链路未验证。

本地成品：`.local/test/3.20.1-test.17/metaontic-video-3.20.1-test.17.tgz`，SHA-256 `7cce8ee7700649036b89c50b3b46ed26f3cfd7a740cf2162ec3d99942b10d801`。未上传、未创建标签或 Release；源码正式版本与 releaseNotes 保持 3.20.2。desktop profile 已从 test.16 升级到 test.17；运行中的宿主尚未重载，`/metaontic-video/canvas` 仍返回 405（旧版本进程），重载后复核。

## 自有实现完整化与移除第三方画布 3.20.1-test.18

流程画布现在是插件自己的功能组件：不再安装、加载、读取或依赖任何第三方画布插件，也不要求用户设置画布数据根目录。

实现完整性（都走插件自己的存储与既有审核）：

- 画布内制作：图片/视频节点点「制作」→ 填内容、画幅、时长、清晰度 → 查看制作方案与预估费用 → 分别确认制作方案与费用（纯文生视频再确认一次）→ 提交 → 轮询任务状态 → 画布内查看并审核成果 → 审核通过后续拍下一段。费用确认与结果审核都在画布内，不跳聊天；API密钥沿用插件设置，不复制。
- 画布编辑：新建文本/图片/视频节点、编辑节点内容与生成参数、拖动节点、平移缩放、连线与断开（连线记墓碑，自动线不会被同步复活）、删除节点（不复活）、重命名画布。新增 `builtinCanvasHandle` 方法 `nodeSave/nodeDelete/edgeAdd/edgeDelete`，只接受界面能编辑的创作字段，成果标识与来源关系等既有数据不被覆盖。
- 删除第三方耦合代码：`src/client/infinite-canvas.ts`（安装入口/CANVAS_SPEC/bundle 状态）、`src/client/canvas-launcher.ts`（原版 DOM 选中捕获）、`src/client/canvas-native.ts`（原版节点内按钮捕获与弹窗）；面板不再有安装/打开/查看画布插件按钮，`client.ts` 不再取 `sidebarRight/layout` 去切原版页签。`loadCanvasAdapter` 现在直接返回内置适配器，`canvasVersionSupported` 与版本门一并删除；`resolveCanvasAdapter`/`adapterForNewCanvas` 只按内置文档解析，仍保留测试注入加载器。
- 画布内制作服务 `createCanvasNativeService` 改为按项目标识解析适配器（`options.resolve` 可注入），因此服务端不需要第三方插件即可对内画布运行；`/metaontic-video/canvas-native` 路由与同源校验不变。
- `video_canvas` 工具的 list 只列内置画布，read/sync 语义不变；动态提示词、面板文案、README 中英文与使用说明书同步改为「插件自带流程画布」。

验证：类型检查、构建、455 项自动测试、diff 检查通过。新增测试覆盖内置画布编辑动作（新建/编辑/连线幂等/断开记墓碑/删除不复活/字段保护）与「无第三方插件在场时建图→按项目解析适配器→生成→审核→成果回填到 `~/.dsh/metaontic-video/canvas/data`」；`tests/canvas-builtin.test.mjs` 原先断言「默认加载器必须失败」改为断言内置适配器可用。

未覆盖：真实桌面窗口内的画布点击/拖拽与画布内付费生成全链路（需要宿主重载后人工复核）；Windows 未实测；真实 Harness 桌面端到端未验证。

本地成品：`.local/test/3.20.1-test.18/metaontic-video-3.20.1-test.18.tgz`。未上传、未创建标签或 Release；源码正式版本与 releaseNotes 保持 3.20.2。desktop profile 由 test.17 升级到 test.18，并按用户要求卸载第三方画布插件；运行中的宿主需重载后生效。

## 流程画布独立页面 3.20.1-test.19

流程画布改为插件自己的独立页面，不再只作为视频创作面板里的一个区块：

- 新增左侧栏入口 `sidebar.panellist: metaontic-video-canvas`（名字走字典 `canvasPanelLabel`，中英分别为「流程画布」「Workflow canvas」）与对应 `main` 键位槽 `metaontic-video-canvas`，页面用更高的画布区（620px）。
- 视频创作面板里仍保留一份紧凑的内嵌画布（460px），并在工具条提供「打开独立页面」；点击走 `layout.selectPanel('metaontic-video-canvas')`（老宿主回退 `sidebarRight.openTab`），两者都不可用时按钮不显示、不报错。
- 独立页面与内嵌区块共用同一份组件与同一套画布服务（`/metaontic-video/canvas`、`/metaontic-video/canvas-native`、`/metaontic-video/canvas-media`），没有第二套状态或存储。

验证：类型检查、构建、456 项自动测试、diff 检查通过。新增/更新测试：预览宿主确认注册了画布页图标与 `main:metaontic-video-canvas`，`openCanvasPage` 切到该页面；面板测试确认把入口转交给画布组件且不再出现第三方画布安装文案；画布内制作测试改为等待「终态与回填记录都落盘」后再断言，消除中间快照导致的偶发失败。

未覆盖：真实桌面窗口里点左侧栏切页与画布交互（需宿主重载后人工复核）；Windows 未实测。

本地成品：`.local/test/3.20.1-test.19/metaontic-video-3.20.1-test.19.tgz`。未上传、未创建标签或 Release；源码正式版本与 releaseNotes 保持 3.20.2。

## 画布操作完善与新建画布 3.20.1-test.20

补齐画布上的操作，并新增「新建画布」：

- 新建画布：`builtinCanvasHandle({method:'create'})` 走新的 `builtinCanvasCreate`，每次强制新建一份空白文档（`newId()`），不套用自动建图的「同名空画布复用」规则；面板工具条「新建画布」用名称输入框的值，空则用「新建流程画布 N」。
- 复制节点：新增纯函数 `duplicateNodePayload(node, spot)`（`canvas-view.ts`），只带走 `label/prompt/text/output/script/requirement/ratio/resolution/duration`，成果素材（`assetId`）、任务标识（`metaonticTaskId/metaonticNativeJob/metaonticVideoUrl/metaonticSeconds`）、来源关系与 `status` 都不复制，定位在原节点右下 +40px。
- 多选与框选：`selected` 改为 `selectedIds` 数组；Shift+拖空白=框选（普通拖空白仍是平移），Shift+点节点=加选/取消；拖动已选中的任一节点整组移动，工具条出现「删除选中（n）」；框选结束后的一次点击不再误清空选择。
- 导出：工具条「导出 JSON」把 `{name, projectId, view, nodes, edges, exportedAt}` 下载成文件；只读导出，不含API密钥，不改画布。

验证：类型检查、构建、458 项自动测试、diff 检查通过。新增测试：`create` 同名各建一份、空节点/空连线、数据根在插件目录、列表可见、默认名；`duplicateNodePayload` 断言复制内容不含成果素材与 `https://example.invalid` 等任务标识。面板提示文案同步说明框选与多选。

未覆盖：真实桌面窗口里的框选/整组拖动、导出下载与新建画布点击（需宿主重载后人工复核）；Windows 未实测。

本地成品：`.local/test/3.20.1-test.20/metaontic-video-3.20.1-test.20.tgz`。未上传、未创建标签或 Release；源码正式版本与 releaseNotes 保持 3.20.2。

## 新建/改名/删除画布的完整链路 3.20.1-test.21

对照原版无限画布的口径补齐画布生命周期（原版：`新建画布…` 走命名弹窗且必须命名、同范围内不许重名；`重命名画布` 双击就地编辑，Enter 提交、Esc 取消、空名保留原名）：

- 新建画布：面板「新建画布…」弹命名窗口（标题「新建画布」/字段「画布名称」，Enter 提交、Esc 关闭、点遮罩关闭），空名与重名都留在窗口里显示原因（沿用原版措辞「画布名不能为空」「同名画布已存在」）。服务端 `builtinCanvasCreate` 先过 `assertCanvasName`，再 `newId()` 建新文档，不复用同名的自动建图画布。
- 改名：画布名改为就地编辑（双击名称或点 ✎ → input，Enter/失焦提交、Esc 取消）；空名放弃本次编辑并提示，重名或保存失败显示原因并保留原名。`builtinCanvasHandle({method:'rename'})` 同样走 `assertCanvasName`（排除自身，改成原名是幂等的）。
- 删除画布：`builtinCanvasHandle({method:'delete'})` 写 `{deleted:true}` 墓碑文档，`allDocs()` 过滤已删除项，因此列表不再出现、`get/rename/nodeSave` 一律以「画布不存在或已删除」停住；面板通过二次确认弹窗触发，删除后自动切到列表里的下一张画布，并说明成果素材文件仍保留在插件数据目录。
- 自动建图路径不受影响：`canvasCreateProject`/`projectsPut` 不经过 `assertCanvasName`，会话标题重名不会把自动同步卡死。

验证：类型检查、构建、458 项自动测试、diff 检查通过。链路测试（`tests/canvas-builtin.test.mjs`）现在从面板「新建画布（命名）」开始：建空画布 → 建节点 → 生成 → 结果审核 → 审核后准备续拍方案 → 改名 → 列表可见 → 删除后列表消失且 `get/rename` 拒绝；另有重名/空名拒绝、幂等改回原名、`allDocs` 过滤墓碑的断言。

未覆盖：真实桌面窗口里的命名弹窗、双击改名、删除确认与下载导出（需宿主重载后人工复核）；Windows 未实测。

本地成品：`.local/test/3.20.1-test.21/metaontic-video-3.20.1-test.21.tgz`。未上传、未创建标签或 Release；源码正式版本与 releaseNotes 保持 3.20.2。

## 画布操作集中到画布上方 3.20.1-test.22

按用户「支持新增画布、选择画布、画布的操作放上面去」的要求，把流程画布的操作区整体移到画布区之前：

- 组件结构改为三段：标题 → 操作区（`movc-top`：第一行 `ops`，第二行 `picker`）→ 画布区 `movc-stage`，之后才是提示文案与弹窗。原来的底部 `meta` 工具条删除，不再有第二份重复按钮。
- 第一行 `ops`：画布名（双击或 ✎ 就地改名）、`新建画布…`，以及当前画布可用时的 `+ 文本 / + 图片 / + 视频`、`刷新`、`重置视图`、`导出 JSON`、`打开独立页面`、`删除选中（n）`、`删除画布`（破坏性操作放最后）。
- 第二行 `picker`：`选择画布` 说明文字 + 画布芯片列表（`名字 · N 节点`，当前画布高亮）；列表超过一定高度时内部滚动，避免把画布区顶下去。
- 没有选中画布时也保留操作行：此时只显示「未选择画布」+ `新建画布…`，因此删掉最后一张画布后仍能新建（此前工具条只在有画布时渲染，删空列表后没有任何新建入口，已修掉）；没有画布时 `选择画布` 行提示「暂无画布，点「新建画布…」创建一份空白文档。」。
- 画布区、节点、连线、框选、导出、生成/审核/续拍逻辑与内置 rpc 形状不变。

验证：类型检查、构建、460 项自动测试、diff 检查通过。新增 `tests/canvas-view-layout.test.mjs`（用 hook 桩渲染组件树）：断言操作区 `top`（含 `ops` 与 `picker`）排在 `movc-stage` 之前、旧的 `meta` 底部工具条已移除、芯片列表在选择画布行内、操作行包含全部按钮文案；另一条断言空列表时仍有「新建画布…」且不渲染画布区。使用说明书、README 中英文同步改为「画布操作在上方」。

未覆盖：真实桌面窗口里的新布局外观与点击位置（需宿主重载后人工复核）；Windows 未实测。

本地成品：`.local/test/3.20.1-test.22/metaontic-video-3.20.1-test.22.tgz`。未上传、未创建标签或 Release；源码正式版本与 releaseNotes 保持 3.20.2。

## 画布只做独立页面 + 页面版样式 3.20.1-test.23

按用户「优化单独页面的、侧边栏那个页面的去掉流程画布」调整布局与观感：

- 视频创作面板不再内嵌流程画布：`createSidebarPanel` 去掉 `FlowCanvas` 参数与 `flow-canvas` 节点，面板注入里不再有 `openCanvasPage`，`client.ts` 只构造一份画布组件（独立页面）。画布入口只剩左侧栏那一行 `sidebar.panellist:metaontic-video-canvas`（名字走字典 `canvasPanelLabel`），点开就是 `main:metaontic-video-canvas` 整页。
- 画布组件只保留整页形态：删掉 `variant`/`stageHeight` 分支与「打开独立页面」按钮，根节点固定为 `mov-section movc`，画布区高度改为 `clamp(520px, calc(100vh - 320px), 1400px)`，随窗口高度撑开。
- 工具条样式：`.movc-top` 一张卡片两行——第一行 `movc-ops` 放画布名与全部操作，第二行 `movc-picker` 放「选择画布」与画布芯片；画布芯片改为单行横向滚动，按钮统一为胶囊小按钮（`height 34px`、字号 13、宽度自适应），不再沿用设置页 `120px` 方块；危险操作（删除选中/删除画布）悬停转红，`新建画布…` 保持主色。
- 画布本身：画布区加 22px 点阵底纹，节点选中加主色描边环、悬停加深阴影，节点状态改胶囊标签（`已完成` 绿、`待制作` 灰），节点内小按钮改胶囊并在悬停时变色；弹窗按钮宽度自适应，不再固定 120px。窄容器下（`@container max-width: 460px`）分组竖线自动隐藏，避免落在行首。
- 画布行为、rpc 形状与存储路径不变。

验证：类型检查、构建、461 项自动测试、diff 检查通过；新增/更新 `tests/canvas-view-layout.test.mjs`（操作区在选择画布行之前、工具条按钮 34px、画布区 clamp 高度、独立页面不再有「打开独立页面」按钮）、`tests/sidebar-panel.test.mjs`（面板不再内嵌画布、不再转交 `openCanvasPage`、源码里没有 `FlowCanvas`/`openCanvasPage`）、`tests/preview-boot.test.mjs`（面板不提供 `openCanvasPage`，画布页注册仍在）。另外用本机 Chrome 无头渲染真实组件 + 主题 CSS 截图人工核对整页、弹窗与空状态（脚本留在 `.local/canvas-qa/style-preview/`，截图 `/tmp/canvas-page3.png`、`/tmp/canvas-modal.png`、`/tmp/canvas-empty.png`）。

未覆盖：真实 Harness 桌面窗口里的实际观感与交互（需宿主重载后人工复核）；Windows 未实测。

本地成品：`.local/test/3.20.1-test.23/metaontic-video-3.20.1-test.23.tgz`。未上传、未创建标签或 Release；源码正式版本与 releaseNotes 保持 3.20.2。

## 画布流程操作 + 按钮风格对齐宿主 3.20.1-test.24

- 按钮风格回到宿主（DSH）语言：画布工具条与节点内按钮不再用胶囊，统一 8px/6px 圆角描边按钮，高度与字号按工具条收紧（`32px`/`12px`，节点内 `11px`），主行动沿用 `.mov-btn-primary`，不再自己叠加 primary 覆盖；节点状态标签直接复用宿主的结果胶囊类 `mov-chip` / `mov-chip-ok`；画布芯片（选择画布）改为 8px 圆角的按钮式选择控件，选中仍用主色实心；画布区与弹窗圆角对齐宿主卡片 `12px`。危险操作（删除选中/删除画布）只在悬停时转 `error` 色。
- 流程操作：新增纯函数 `flowSteps(canvas)`，按连线把图片/视频制作节点从上游排到下游（成果节点、`metaonticSourceNode` 节点不参与排队，环由 seen 兜住），并按画布上是否有指回该节点的成果节点标注 `done`。工具条新增「制作「节点名」」主行动（下一个未完成节点，禁用于流程已完成）与「流程进度 x/y」，当前待制作节点在画布上标 `data-current` 虚线框，底部提示说明当前轮到哪个节点。点主行动直接打开该节点的制作弹窗，方案与费用确认、结果审核、回填都走原有链路，不新增付费入口。
- 提示词同步：`prompts/guidance.ts` 里"面板里的「流程画布」"改为"左侧栏「流程画布」那一行打开独立页面，视频创作面板里不再内嵌"，并补一句画布按连线顺序执行、进度与虚线框的说明。

验证：类型检查、构建、463 项自动测试、diff 检查通过。新增测试：`flowSteps` 排队顺序/成果节点排除/`done` 标记/空画布；渲染断言工具条含「制作「第一段」」与「流程进度 0/1」、当前节点被标记、提示说明当前节点；样式断言工具条按钮不再是胶囊且高度 32px。另用 Chrome 无头渲染真实组件截图核对（`/tmp/canvas-dsh.png`）。

未覆盖：真实 Harness 桌面窗口里的观感与点击（需宿主重载后人工复核）；画布内付费生成链路未实跑；Windows 未实测。

本地成品：`.local/test/3.20.1-test.24/metaontic-video-3.20.1-test.24.tgz`。未上传、未创建标签或 Release；源码正式版本与 releaseNotes 保持 3.20.2。

## 脚本审核/费用试算改成插件摘要卡片 3.20.1-test.25

用户反馈"脚本审核时出现了代码块"：插件只给 `video_generate/video_extend/video_status/video_prepare_image` 注册了 `tool.call.toolview`，而卡片里真正自绘的只有 `video_generate/video_extend`；脚本审核用的 `video_project`（prepare/review/review_segment/status）和费用试算 `video_estimate` 没有自定义视图，于是落到宿主默认卡片，把工具返回的 JSON 铺成代码块。

- `client/tool-result.ts` 新增纯函数 `toolSummary(toolName, block)` 与摘要卡片 `summaryView`，并给 `video_project`、`video_estimate` 注册 `tool.call.toolview`：
  - 等待中（无 `kind`）：标题「脚本审核 / 费用试算」+「进行中」胶囊 + 动作/目标时长/清晰度等参数行。
  - 有结果：解析返回 JSON，只列关键结论（项目、状态、下一步、说明、画布同步；试算则给目标时长、画幅/清晰度、两个方案金额与价目日期），状态胶囊用宿主结果标签语言（`mov-chip` / `mov-chip-ok` / `mov-chip-bad`）。原始返回折叠在 `details` 里，按普通正文 `white-space: pre-wrap` 显示，不用 `pre/code`，因此默认视图不再出现代码块。
  - JSON 解析失败或工具报错时只显示原文/错误态，不编结论；非摘要工具（含 `video_generate` 结果 → 媒体预览、未完成 → 进度条）行为不变。
- 摘要卡片样式自带（`SUMMARY_CSS`），沿用宿主卡片描边、10px 圆角与 `--dsw-alias-*` 变量，不依赖其它组件的样式是否渲染。

验证：类型检查、构建、464 项自动测试、diff 检查通过。新增测试：等待中卡片结构、审核通过结果的关键行与状态胶囊、原始返回在 `details` 内且整棵卡片树没有 `pre/code`、费用试算两个方案金额、非法 JSON 退回原文、非摘要工具仍走媒体预览/进度；`video views register…` 断言注册键扩到六个工具。另用 Chrome 无头渲染四张卡片截图核对（`/tmp/canvas-toolcard.png`）。

未覆盖：真实宿主对话里的实际渲染（需宿主重载后人工复核）；Windows 未实测。

本地成品：`.local/test/3.20.1-test.25/metaontic-video-3.20.1-test.25.tgz`。未上传、未创建标签或 Release；源码正式版本与 releaseNotes 保持 3.20.2。

## 顶部工具条圆角收敛成 8px 3.20.1-test.26

用户反馈顶部按钮"还是有点丑""带上圆角"后又说"圆角小一点""我指的是顶部的按钮"：上一版把工具条按钮、「选择画布」胶囊和节点小按钮都改成了 999px 全圆角，顶部一行看下来偏"药丸"，与宿主按钮语言不一致。

- `canvas-view.ts` 顶部工具条（`.movc-ops .mov-btn`、弹窗按钮、画布名输入）统一回宿主 `.mov-btn` 的 `border-radius: 8px`；「选择画布」胶囊 `.movc-chip` 同为 8px；节点上用的小按钮 `.movc-mini` 收成 6px。高度、内距、描边与配色不变。
- 测试 `canvas-view-layout` 的断言从"不用胶囊"改为显式校验 `border-radius: 8px`，并禁止画布样式里再出现 `999px`。

验证：类型检查、构建、464 项自动测试、`git diff --check` 通过；用 `.local/canvas-qa/style-preview` 重新构建预览并 Chrome 无头截图（`/tmp/canvas-round8.png`）核对顶部两行按钮圆角。

未覆盖：真实 Harness 桌面窗口里的观感与点击（需宿主重载后人工复核）；Windows 未实测。

本地成品：`.local/test/3.20.1-test.26/metaontic-video-3.20.1-test.26.tgz`。未上传、未创建标签或 Release；源码正式版本与 releaseNotes 保持 3.20.2。
