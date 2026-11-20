# 插件市场固定安装地址

市场最终使用以下地址，仅在 GitHub 正式发行版已经包含固定名称附件且下载核对成功后才切换：

`https://github.com/wxsimon2022/metaontic-video/releases/latest/download/metaontic-video.tgz`

## 发布顺序

1. 保留 `metaontic-video-X.Y.Z.tgz` 版本包；Gitee 和 GitHub 继续镜像同一成品。
2. GitHub 的 Windows/macOS 安装与升级检查均通过后，发布任务调用 `scripts/publish-stable-alias.mjs`。
3. 下载该标签的版本包，与已验证成品比对 SHA-256；直接复制生成 `metaontic-video.tgz`，不重新打包。
4. 上传后再下载固定名称附件核对 SHA-256；续跑时已有附件仅核对、不覆盖。
5. 全部核对通过才公开草稿，并更新 Latest。若已有更高正式版本，补发旧版本不能把 Latest 指针倒退。发布任务串行，避免并发更新指针。
6. 本机双仓发版收尾必须确认 GitHub 同时具有版本包和固定名称包。附件清理白名单保留固定名称包。

首次上线需要在带有固定名称包的正式版本发布后，再将插件市场 YAML 的 tarball 一次性替换成上述地址。此后每次发版无需修改收录地址。尚未上线前仍用具体版本安装地址，避免 404。

内部更新器按用户要求使用最新正式版固定地址，并附已确认版本查询参数隔离缓存；宿主返回实际版本不一致时不报告成功，要求重新检查。市场对非固定标签地址的版本/宿主元信息可能标为未知，固定安装地址不等于市场版本元信息一定实时刷新。

## 验证与平台影响

`node --test tests/stable-release-alias.test.mjs tests/release-script.test.mjs` 使用模拟 GitHub 调用与临时目录，覆盖同字节上传、续跑不覆盖、错误附件阻断、旧版本补发和预发布拒绝。脚本使用 node:path、系统临时目录与 spawnSync 参数数组，兼容 Windows/macOS；实际发布仍由 Linux runner 在两平台安装检查之后执行。本次未执行远端发布或桌面安装。

市场规范：https://github.com/awesome-dsh-plugin/awesome-dsh-plugin/blob/main/contributing.md
GitHub 文档：https://docs.github.com/en/repositories/releasing-projects-on-github/linking-to-releases

## Gitee 固定地址

`https://gitee.com/hackloop/metaontic-video/releases/download/latest/metaontic-video.tgz`

Gitee 的 latest 位于 download 后。`publishGiteeWithAlias` 统一接入本机、流水线及手动同步入口；从已公开版本附件下载原字节，上传固定名称后下载核对 SHA-256，已有附件只核对、不覆盖。宣传页使用此地址，后续只同步展示版本。插件市场仍使用其规范要求的 GitHub 地址。

已给 v4.0.7 补齐固定附件，SHA-256：`f5b0b1266039c48f466e8ed5db16ae1ddf18193faf32e2009f7e1114b2049131`。本次发布维护不重打包、不改标签，沿用该版本已通过双平台检查的同一成品。
