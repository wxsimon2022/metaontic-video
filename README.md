# MetaOnticVideo（DeepSeek Harness 插件）

把 Seedance 的「短视频直出 + 视频延长（向后续拍）」能力封装成 Harness 插件：
目标时长不超过单段上限（默认 15 秒）时一次生成，更长时先直出首段、再逐段续拍，最后用 ffmpeg 合并成一个成片文件。
显示名 **MetaOnticVideo**，npm 包名 `metaontic-video`，profile 条目 id `metaontic-video`。
它不依赖任何特定平台（合并只用本机 ffmpeg），只复用同一套上游语义：

- 提示词以「向后延长视频1」/「向前延长视频1」开头，用 `视频1` 指代输入素材，
  并写清延长方向、剧情发展、主体状态、镜头运动、声音延续；
- `content` 里用 `{"type":"video_url","video_url":{"url":...},"role":"reference_video"}` 传参考视频；
- seedance 2.5 自动改用 `ratio=adaptive` 与 `omni_reference_task_type=extend`；
- 多段延长时，每段都用上一段的成片 URL 继续参考，避免重复拼接。

## 提供的工具

| 工具 | 作用 |
| --- | --- |
| `video_generate` | 生成一段完整视频：不超过单段上限直出；更长时直出首段 + 逐段延长，最后合并成本地 mp4 |
| `video_extend` | 把已有视频向前或向后延长，可一次连续延长多段，返回每段任务 ID 与最终视频链接 |
| `video_status` | 按任务 ID 查询任务状态（单次调用超时后用它取结果） |
| `video_config` | 读取/修改插件自己的配置（不改 YAML 也能换中转站地址、模型、时长） |

## 生成一段完整视频：≤15 秒直出，更长自动续拍再合并

`video_generate` 按目标总时长决定走哪条路：

| 目标时长 | 做法 |
| --- | --- |
| ≤ `singleMaxSeconds`（默认 15 秒） | 直接调用 Seedance 生成一次，不做延长 |
| > 15 秒 | 先按上限直出首段，再用视频延长能力按 `duration`（默认 5 秒，可设 4-15 的整数，建议 ≤14 秒）逐段续拍，每段引用上一段的成片 |

分段全部生成后下载到本地，再合并成一个文件：

- 默认 `mergeMode: copy` 先用 concat demuxer 无损拼接；参数不一致时自动回退统一重编码（带音频，必要时退回只并视频）。
- 每段下载后探测真实时长：实测接近累计时长时，判定上游返回的是「累计成片」，改用这一段作为基础，避免重复拼接。
- 成片落在 `outputDir`（留空用会话工作目录下的 `metaontic-video/`），文件名形如 `20261027-201530-25s.mp4`；
  分段默认在合并成功后删除，`keepSegments: true` 可保留。
- 需要本机有 `ffmpeg` / `ffprobe`（PATH 里没有时在配置里填 `ffmpegBinary` / `ffprobeBinary`）。
  找不到 ffmpeg 不会让任务失败：分段链接照常返回，只是不合并成一个文件。
- 分段秒数是 4-15 的整数（如 5/8/10/14）；**建议 ≤14 秒**——刚好卡 15 秒时，成片因封装略超
  15 秒会被上游拒绝（报错里通常带 `duration`），改成 14 秒即可。

例：「用这段提示词生成 25 秒视频」→ 15 秒直出 + 5 秒 + 5 秒，再合并成 25 秒成片。

差一点点凑不满一段时（16-19 秒这类），插件会把首段缩短，保证每段都落在 4-15 秒：
18 秒 = 14 + 4，17 秒 = 13 + 4。每段实际秒数都写在返回结果里。

## 提示词写法：向前 / 向后延长都可用

插件按五块拼好延长提示词，你只要给出「本段要发生什么」：

| 块 | 写什么 |
| --- | --- |
| 延长方向 | `向后延长视频1`（续拍，默认）或 `向前延长视频1`（前置剧情）；也支持 `生成视频1之后的内容：` |
| 剧情发展 | 本段新发生的事，只写这一段，不复述视频1里的情节 |
| 主体状态 | 人物面貌、体型、服装、姿态、手部位置、动作阶段，以及音色/口音/语速/情绪 |
| 镜头运动 | 机位、景别、焦段、运镜方向与速度，曝光、白平衡、光源与背景布局 |
| 声音延续 | 台词完整说完，对白、环境声与背景音乐连续，不加片头片尾 |

指代方式：延长任务里用 `视频1`、`视频2` 指代输入素材。
**不要写成「参考视频1」**，那样容易被上游识别成「参考生视频」而不是延长。

- 向后续拍：`direction` 默认 `backward`；`wording: 'after'` 可换成「生成视频1之后的内容：」的说法。
- 向前延长：`direction: 'forward'`，提示词变成「向前延长视频1。生成 N 秒前置画面，接在视频1第一帧之前」，
  并用 `startAt` 标出这一段在整片里的位置（多段向前延长时逐段前移）。
- 常规示例：「向后延长视频1：+ 后续剧情 / 人物状态 / 镜头运动 / 声音延续」；
  「生成视频1之后的内容：+ 描述」；「向前延长视频1：+ 前置剧情描述」。

## 两种上游：New API 中转站 / 火山方舟官方

`provider: newapi`（默认）走 New API 中转站的火山原生路由：

| 配置 | 默认值（newapi） |
| --- | --- |
| `baseUrl` | 空；读 `NEWAPI_VIDEO_BASE_URL` / `NEWAPI_BASE_URL`，都没有时必须在 config 里填 |
| `submitPath` | `/doubao/api/v3/contents/generations/tasks` |
| `queryPath` | `/doubao/api/v3/contents/generations/tasks/{task_id}` |
| `apiKey` | 读 `NEWAPI_API_KEY`，回退 `ARK_API_KEY` |
| `model` | 读 `NEWAPI_VIDEO_MODEL`，回退 `doubao-seedance-2-0-mini-260615` |

`provider: ark` 走火山官方接口（`https://ark.cn-beijing.volces.com/api/v3`、`/contents/generations/tasks`）。

注意：延长必须用「接受火山原生 content 格式」的接口。
中转站的 `/video/generations` 不接受原生 content 格式，
所以要按中转站文档填成它给豆包模型分流的那条路径（例如 `/doubao/api/v3/...`）。

中转站响应形状不同也能解析：状态别名（`success` / `completed` …）、
任务 ID 字段（`id` / `task_id` / `taskId`）、深层取件（`data.content.video_url` / `download_url`），
并会跳过 `cover_url`、首尾帧等图片字段；额度不足、鉴权失败、限流、内容审核拒绝会分别给出可读提示。

## 让别人安装

插件管理页（侧栏**插件** → 安装）里填下面任意一种 spec 即可：

| 来源 | 填什么 |
| --- | --- |
| npm | `metaontic-video`（装指定版本：`metaontic-video@1.0.0`） |
| GitHub | `github:wxsimon2022/metaontic-video`（也可以带 tag：`github:wxsimon2022/metaontic-video#v1.0.0`） |
| 本地目录 / 压缩包 | 绝对路径，或 `npm pack` 出来的 `.tgz` 路径 |

命令行等价写法：`dsh plugin --profile <profile> add metaontic-video`。

## 发布

```bash
npm pack --dry-run          # 先看会打包哪些文件
npm login                   # 第一次发布前
npm version patch           # 或 minor / major，写入 git tag
npm publish                 # 无作用域包直接发布
git push --follow-tags
```

推 tag 后 `.github/workflows/publish.yml` 会用仓库 secret `NPM_TOKEN` 自动发布（带 provenance）。

## 安装

在 Harness 里让 Agent 用 `plugin_manager` 的 `install_bundle` 安装本目录
（用绝对路径作为 `target`）。插件管理页只能开关组合包，改配置要写 profile 的 patch 层。

## 配置写在哪儿

配置写在 profile 的 patch 层文件里：

```
~/.dsh/profiles/<profile>/cordis.patch.yml
```

（桌面端当前 profile 是 `desktop`，即 `~/.dsh/profiles/desktop/cordis.patch.yml`；
如果这个文件里已经有 `- id: metaontic-video` 的覆盖项，就改那一项，覆盖项会整体替换 `config`。）

中转站（New API）示例：

```yaml
- id: metaontic-video
  name: 'metaontic-video'
  config:
    provider: newapi
    apiKey: 'sk-...'                  # 也可用环境变量 NEWAPI_API_KEY
    baseUrl: 'https://ai.bileego.com' # 不带 /v1，也不要重复 /api/v3
    model: 'doubao-seedance-2-0-mini-260615'
    duration: 5
```

官方（火山方舟）示例：

```yaml
- id: metaontic-video
  name: 'metaontic-video'
  config:
    provider: ark
    apiKey: 'sk-...'                  # 也可用环境变量 ARK_API_KEY
    model: 'doubao-seedance-2-5-260628'
    duration: 5
```

除了这两项差异，其余可调项相同：

```yaml
    singleMaxSeconds: 15 # ≤ 它一次直出，超过它才分段延长
    duration: 5          # 超过单段上限时，每段延长多少秒（4-15 的整数，建议 ≤14）
    mode: continuous     # continuous 同机位续拍 / closeup 切近景续拍
    resolution: 720p
    ratio: adaptive
    generateAudio: true
    watermark: false
    pollIntervalMs: 5000
    maxWaitMs: 600000
    extraParams: '{}'    # JSON 对象字符串，合并进请求体
    mergeMode: copy      # copy 先无损拼接（失败自动重编码）/ reencode 统一重编码
    outputDir: ''        # 留空 = 会话工作目录下的 metaontic-video/
    keepSegments: false  # 合并成功后是否保留分段原片
    ffmpegBinary: ffmpeg # PATH 里没有 ffmpeg 时填绝对路径
    ffprobeBinary: ffprobe
```

## 在插件里改配置

配置字段都用 `.volatile()` 声明，所以它们是宿主管理的「可热改」字段：
插件通过宿主 `settings` 服务读写，改动写进 profile 的 `cordis.patch.yml`，重载后立即生效。

- 对话里改：Agent 调 `video_config`
  - 「看一下现在的视频插件配置」→ `action: get`
  - 「把 baseUrl 换成 https://new-relay.example，模型换成 doubao-seedance-2-5-260628」→ `action: set`
  - 工具内部用 `settings.describe()` 取修订号，再 `settings.update(...)` 合并写入，
    所以不会覆盖你手写的其它字段，也不会踩到并发改动。
- 手改：直接编辑 profile patch（见上一节），效果相同。

### App 内的配置页

本插件自带浏览器半侧（`client.js`），在侧栏**插件**页里给本插件加了一张配置卡片：

- 卡片摘要显示「上游 · 模型 · 每段秒数」，没配好的时候提示先去选上游填密钥。
- 打开卡片就是表单：上游、API Key、基础地址、模型、每段秒数、直出上限、续拍方式、分辨率、
  画面比例、音频/水印开关、合并方式、输出目录、保留分段、ffmpeg/ffprobe 路径，
  以及提交路径、查询路径、额外参数、轮询间隔、最长等待。
- 改完点**保存**只写你改过的字段（`form.set`），**恢复默认**清除 profile 里的覆盖（`form.unset`）；
  写入带宿主修订号校验，被更高层配置覆盖时不会静默写坏。
- API Key 只显示「是否已配置」，留空表示保持原值，不会把掩码值写回去。
- 页面用宿主主题 token（`--dsw-alias-*`）着色、控件自己实现，没有 import 任何 Harness 客户端包；
  只有宿主确实提供本插件命名空间时卡片才出现（`configForms.whileServed`）。

页面只做「改配置」；连线测试（真的提交一次延长）仍走 `video_extend` 或 `video_generate` 工具。

## 使用示例

- 「把 `https://.../cat.mp4` 往后延长 5 秒，继续橘猫舔爪子」
- 「这段 15 秒的口播再加 5 秒，用近景切到听众反应」（`mode: closeup`）
- 「连续延长 2 段，每段 5 秒，做成 10 秒续片」（`segments: 2`）

## 限制

- 参考视频必须是上游能直接拉取的公网 URL；本地文件路径不支持。
- 含人脸续拍通常需要同一上游账号下的受信原始产物，否则会被内容审核拒绝。
- 不保证人脸、声线、口型和背景完全连续；上游返回的成品链接一般 24 小时内有效。
- 超过单段上限的成片由多段拼成，接缝处仍需自己预览；合并只统一容器与编码，不做画面修补。
