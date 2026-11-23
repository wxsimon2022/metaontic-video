# v4.2.3 发布核对

实际基线：v4.2.2。

MetaOnticVideo v4.2.3

优化
- 插件改用 MIT 开源许可，可自由使用、修改和分发；安装统计仅记录固定来源类型，不上传链接、路径或凭据。

验证
- 本地构建及全量测试通过；成品包 SHA-256 为 `19e1ee717dfef2fe8ae07c281466762f13ff5b7e3522dc6b13ac226b3ac8a711`。
- 因 Gitee 流水线额度不足，本次不依赖流水线，改为本机打包并直传 Gitee Release；版本包与固定最新包均下载核对，SHA-256 与本地成品一致。
- GitHub Actions 运行 `45184190657` 成功，`prepare`、`platform-install (windows-latest)`、`platform-install (macos-latest)` 与 `release` 均通过；GitHub 版本包及固定最新包下载核对，SHA-256 与 Gitee、本地成品一致。
- npm 正式版 `4.2.3` 已发布，npm 官方与中国镜像的 `latest`、`dsh.bundle` 声明及成品完整性均核对通过，成品与本地一致。
- 插件市场索引已切换到 npm 来源并推送到两个仓库。
- 桌面GUI与付费调用未由发布脚本自动验证。

指南核对：逐项核对安装、配置、脚本审核、费用确认、续做、合并、更新与常见问题；本次仅调整许可、安装统计与构建目录，用户操作步骤不变，Markdown、配图与PDF无需改写。
