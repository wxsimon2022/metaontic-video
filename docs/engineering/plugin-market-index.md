# DSH 插件市场索引（收录口径）

## 结论：官方目前没有市场

宿主内 `@deepseek-ai/dsh-plugin-market` 的说明和官方 Agent Note
`.agents/notes/implemented/feature/2026-10-02-plugin-market-index-format.zh.md`
都写明同一件事：

> 市场只能从用户已知的 spec 安装第三方组合包……**目前没有官方市场**，以后可能会增加官方市场，因此市场机制必须支持第三方发布的索引。

> 目前没有官方市场，因此 DSH 无法随附默认源；**索引源属于用户数据**。

宿主里也确实只有示例地址（`https://market.example/dsh/index.json`、`example.com/index.json`），
没有任何官方索引 URL；`plugin-market` 的 `indexes` 默认值是 `[]`，即用户不添加索引源之前，「插件 → 发现」页不会发出任何请求。

因此现在的「收录」只有两条口径：

1. **第三方索引源（今天就能做）**：自己发布一份格式 1 的索引 JSON，用户把它添加为索引源即可在「发现」页浏览和安装。
2. **官方收录（今天做不到）**：官方还没有市场可收录；等它出现后，通过官方渠道反馈，请求把我们的索引源纳入默认源或官方索引。

## 我们发布的索引

- 文件：`market/index.json`，随仓库主干发布。
- 索引源地址（用户要粘贴的就是这一行）：
  `https://gitee.com/hackloop/metaontic-video/raw/master/market/index.json`
- 条目：`dsh-metaontic-video`，分类 `video`，标签 `video-director`（视频创作），
  图标内联为 `data:` SVG（不依赖外部主机），`repository` 指向 Gitee 主仓库，`homepage` 指向 `https://ai.mybfs.cn`。
- 安装来源：已发布到 npm 的版本用 `npm` 来源（大陆自动走 `registry.npmmirror.com`），
  其余版本用 `git` 来源固定到发布提交，例如
  `git+https://gitee.com/hackloop/metaontic-video.git#9b2759b48c8949ddbf112acf7099c60dd6694fbe`。

### 用户怎么用

1. 打开 DSH 的「插件 → 发现」页，点索引源管理。
2. 粘贴上面的索引源地址（对话框会带信任提示，索引源属于用户数据，添加它是用户自己的决定）。
3. 列表出现 `MetaOnticVideo` 后点安装，走的是宿主已有的安装对话框，确认后可见版本、来源与索引 URL。

### 怎么刷新

索引里的每个版本都要写死发布提交，所以**打完新版本标签后再刷新**：

发版时 `scripts/release.mjs` 会自动做这一步（打标签后重写索引并追加提交）；单独补刷时：

```bash
npm run market:index      # 读取最近的 vX.Y.Z 标签，重写 market/index.json
git add market/index.json && git commit -m "chore(market): 刷新插件市场索引" && git push
```

`scripts/market-index.mjs` 只做事实搬运：版本号取自标签，`commit` 与 `publishTimestamp` 取自标签提交
（格式要求 `publishTimestamp` 用提交者时间），`engines.dsh` 原样复制 `package.json` 的 `engines.dsh`，
`dist-tags.latest` 取最高版本，图标取自仓库根目录的 `icon.svg`。

## 格式要点（写进索引前必须满足）

- 根字段 `format` 必须是数字 `1`，`title` 必须含 `en`，`plugins` 必须是数组（顺序就是默认展示顺序）。
- `metadata.category`、`metadata.labels`、`metadata.sortKeys` 里的 id 必须在根级 `metadata` 声明过，否则整份索引被拒绝。
- `source.type` 只能是 `npm` 或 `git`；`git` 的 `url` 必须是规范 `https:` 仓库地址（至少两段路径、不以 `.tgz` 结尾），`commit` 必须是 40 位小写十六进制。
- 每个版本必须有有效 `engines.dsh`（SemVer 范围，`*` 表示不限）。本项目在 `package.json` 声明 `engines.dsh = ">=0.2.0"`。
- `icon` 要么是不超过 32 KiB 的 `data:` SVG/PNG/JPEG/WebP，要么解析后是 `https:` 或与索引同源。
- 列表页的全部内容都在索引里，客户端不会为每条目再拉 manifest；索引写错 = 整份索引被拒绝，不会静默丢弃条目。
- 「详细介绍」不在索引里：它按条目的安装来源读取，Git 来源取该提交下的 README（gitee.com 没有单文件 API，走宿主的部分克隆回退）。

## 中国大陆镜像源

**npmmirror 是只读同步镜像，不能直接发布**：`registry.npmmirror.com` 从 npm 官方同步，
首页写明「只读，尽量与官方服务同步」。所以「发布到大陆镜像源」的正规路径只有一条：
**先发 npmjs.com，再由 npmmirror 自动同步**。

DSH 里的表现：插件管理页会在 `registry.npmjs.org/-/ping` 与 `registry.npmmirror.com/-/ping`
之间竞速（默认 1.5 秒，结果缓存 5 分钟），先答应的那个成为安装对话框显示的 registry——
大陆网络选中的就是 `registry.npmmirror.com`。市场索引里 `source: { "type": "npm" }`
不写 `registry`，安装就用客户端自己选中的这个源，不会把用户钉死在某一个镜像上。

发布成品包：

```bash
npm run npm:token -- npm_xxxxxxxx        # 一次性：把令牌存到本地，之后不用再贴
npm run npm:token                       # 看当前凭据来源；--check 联网校验，--clear 删除
npm run npm:publish                     # 发布 package.json 的当前版本，自动读取本地令牌
npm run npm:publish -- --dry-run         # 只检查不上传
npm run npm:publish -- --otp 123456      # 账号开了 2FA 又没令牌时，用一次性验证码
NPM_TOKEN=xxxx npm run npm:publish       # CI：带 Bypass 2FA 的 granular token，优先于本地令牌
```

**登录 npmmirror 不能发布**：它只接受同步，不接受上传。账号开启 2FA 后，npmjs 会对发布返回
`E403 ... granular access token with bypass 2fa enabled is required`，此时只能二选一：
带 `--otp` 发一次性验证码，或到 npmjs 生成带 Bypass 2FA 的 granular access token。

**凭据按 NPM_TOKEN → 本地令牌文件 → npm 登录态（`~/.npmrc`）的顺序取。** 本地令牌存在
`.local/npm-token`（写入时 0600）：`.local/` 已被 `.gitignore` 忽略，既不进源码仓库、也不进发布包，
脚本还会确认它没有被 git 跟踪；发布时令牌只写进临时 userconfig（用完即删），不改动本机 `~/.npmrc`，
日志里也从不回显令牌内容。换令牌时重跑一次 `npm run npm:token -- <新令牌>` 覆盖即可。

`scripts/publish-npm.mjs` 发布的是 Gitee 那个**同一个成品包**
（`.local/releases/<版本>/metaontic-video-<版本>.tgz`），并会先确认包内没有 `README.md`
（宿主会把包内 README 当详细介绍渲染，发布约定要求裁掉），所以两处装的代码完全一致。

同步与索引：

1. 上传后到 `https://npmmirror.com/package/metaontic-video` 看同步状态。
2. 重跑 `npm run market:index`：该版本会被自动识别为 npm 来源，`publishTimestamp` 取 registry 的发布时间
   （格式要求用发布时间，不是标签时间）；查不到就退回 Git 来源，断网也不会写坏索引。
3. `publishConfig` 已固定在 npm 官方 registry，避免误发到镜像站。

CI 里要做这一步的话，在 Gitee 流水线加一个 `NPM_TOKEN` 变量，并在发布步骤后执行
`npm run npm:publish -- <版本>`；没配变量时这一步跳过，索引自动保持 Git 来源，不影响发版。

## 校验方式

用宿主自带的校验器直接验，避免“看着像对”：

```bash
ASAR="/Applications/DeepSeek Harness.app/Contents/Resources/app.asar"
# 把 @deepseek-ai/dsh-plugin-market-index 与它的依赖 semver 从 asar 解出来，再
# parseMarketIndex(index, 'https://gitee.com/hackloop/metaontic-video/raw/master/market/index.json')
```

判定标准是 `parseMarketIndex` 不抛 `MarketIndexError`；`marketInstallTarget('metaontic-video', version)`
应还原出 `git+https://gitee.com/hackloop/metaontic-video.git#<commit>`。

## 官方渠道投稿草稿（`show-your-plugins`）

官方仓库 `https://github.com/deepseek-ai/deepseek-harness` 公开、关闭 Issues、开放 Discussions，
分类里有 **show-your-plugins**，发布插件应当发在这里：

> 标题：MetaOnticVideo — DSH 视频创作组合包（含插件市场索引源）
>
> 正文：
> - 插件：`metaontic-video`，在 DSH 里显示为「MetaOnticVideo」。
> - 作用：说出想法 → 助手带你完善创意 → 写脚本确认 → 生成视频；通过分段续拍与本机合并做低成本长视频。
> - 安装：在线安装包与说明见 `https://ai.mybfs.cn`。
> - 索引源：`https://gitee.com/hackloop/metaontic-video/raw/master/market/index.json`（格式 1，条目随版本刷新）。
> - 仓库：`https://gitee.com/hackloop/metaontic-video`（GitHub 为镜像）。
> - 如果官方后续提供默认市场或精选列表，希望把这个索引源/条目纳入；在此之前我们按第三方索引源分发。

## 待办与风险

- GitHub 镜像停在 `v3.26.0`（默认分支 `master`），所以索引的安装来源只能指向 Gitee；镜像补齐后可改成 GitHub 以加快介绍文档读取。
- gitee.com 不在宿主的单文件 API 白名单（只有 `github.com` 与 `gitlab.com`），首次读「详细介绍」要走一次仓库部分克隆，可能偏慢。
- 索引刷新已接进 `scripts/release.mjs`：打标签后自动重写索引并追加一个 `chore(market)` 提交（续跑判定已放行这多出来的一个提交）。npm 发布仍在索引刷新之后，所以要等 `npm run npm:publish` 后再手动重跑一次 `npm run market:index`。
- npm 发布需要账号与 `NPM_TOKEN`（本机当前未登录 npm）；在发布前，索引一直用 Git 来源，用户装的是 Gitee 成品。
