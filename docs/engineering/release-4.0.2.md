# v4.0.2 发布核对

实际基线：v4.0.1。

MetaOnticVideo v4.0.2

优化
- 完善旧版迁移，支持切换并清理旧包；保留配置与任务，清理失败可重试，新版设置持续可用。

验证
- 本地构建及测试通过。
- Windows/macOS成品安装及升级为CI上传前置条件。
- 宣传页安装地址已同步为 v4.0.2（/Users/simon/Documents/my_python/MetaOnticVideoService/frontend/public/promo/index.html，属服务端仓库，需在那里提交并部署）。
- 桌面GUI与付费调用未由发布脚本自动验证。

指南核对：已核对切换并清理旧版、仅停用切换、确认任务结束与同意卸载、旧包停用后继续提供清理入口、清理失败重试、宿主要求停止运行环境及重启的分层处理；配置、API密钥、任务与素材保留说明一致。指南Markdown、打印HTML和PDF同步，安装链接同步，指南及配图仅本地维护并纳入成品，不含版本日志与价格资料。

实际发布结果
- 本地673项测试及实际Harness的11个工具Schema校验通过。
- GitHub Actions 44245920985成功：Windows/macOS使用同一成品，通过安装、旧版成品升级与配置/任务保留自动检查。
- Gitee、GitHub均为正式发布，说明一致，附件均为metaontic-video-4.0.2.tgz，1430264字节。
- 原始成品、重复打包、Gitee下载及GitHub下载SHA-256一致：d23650e0e5ff53794265965f136cb8ebfabc6abc7c10a044dac81ce0d42418a8。
- 此次未安装到本机，未进行真实Harness桌面迁移、Windows桌面实测或付费视频调用。17项迁移回归属于自动检查，不等于桌面实测。
