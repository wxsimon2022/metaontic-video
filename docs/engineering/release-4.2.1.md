# v4.2.1 发布核对

实际基线：v4.2.0。

MetaOnticVideo v4.2.1

优化
- 专业创作的独立文本审核不再单独确认文本费用，仍按渠道实际用量计费。

验证
- 本地构建及测试通过。
- 本机成品打包后直传 Gitee Release，版本包与固定最新包均核对通过，SHA-256 为 `1bae8f48a0ee05a2b0bce0333ca3eec59ca44a61e2c4eae730384d8f19fc9297`；Gitee Go 流水线按标签触发并保持同附件幂等。
- GitHub Actions 的 `windows-latest` 与 `macos-latest` 安装检查通过，GitHub 镜像版本包和固定最新包与本地成品字节一致。
- npm 正式版 `4.2.1` 已发布，npm 官方与中国镜像的 `latest`、`dsh.bundle` 声明及成品完整性均核对通过。
- 桌面GUI与付费调用未由发布脚本自动验证。

指南核对：逐项核对安装、配置、脚本、专业创作、独立复审和费用确认说明；独立文本审核已写明不单独弹审批，指南与当前版本一致，Markdown与PDF均无需改动。
