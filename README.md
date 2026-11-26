# <img src="https://ai.mybfs.cn/promo/readme-title-zh.svg" width="840" height="44" alt="dsh-metaontic-video · DeepSeek Harness AI视频创作插件" />

[English](./README.en.md)

MetaOnticVideo 是 DeepSeek Harness（DSH）的 AI视频创作插件：**帮助新手快速上手AI短视频创作，并通过分段续拍和本地合并，低成本制作长视频。**

## 能做什么

- **快速创作**：说出想法或提供参考图片，助手整理脚本，确认后生成并预览视频。
- **分段制作长视频**：逐段生成与续拍，保留进度，最后在本机合并。

脚本、图片和视频分别使用插件设置中配置的文本、图片和视频模型；普通对话仍使用 Harness 会话模型。文本脚本调用按渠道实际用量计费，不单独弹审批；视频生成仍须审核并确认费用。

图片与视频按接入渠道用量计费，生成前需确认费用。

## 在线安装

在 Harness「插件 → 添加插件」中直接输入包名 `dsh-metaontic-video`。中国大陆网络由 DSH 自动优先选择中国镜像源；Windows 与 macOS 使用同一个安装包。

备用在线安装链接：

Gitee：

```text
https://gitee.com/hackloop/metaontic-video/releases/download/latest/metaontic-video.tgz
```

GitHub 备用：

```text
https://github.com/wxsimon2022/metaontic-video/releases/latest/download/metaontic-video.tgz
```

## 开始使用

1. 打开插件设置，选择 **MetaOntic AI**，填写 API密钥并保存。
2. 在会话中选择 **视频创作助手**，直接描述想制作的内容，包括品牌、产品或活动宣传需求。
3. 确认需求，审核包含脚本、分镜和估价的完整方案，再确认费用并制作、预览结果。

例如：“制作一条30秒竖屏720P的视频，表现清晨湖面的宁静。”

## 相关链接

[官网与使用说明](https://ai.mybfs.cn) · [AI 可读产品摘要](https://ai.mybfs.cn/llms.txt) · [问题反馈](https://github.com/wxsimon2022/metaontic-video/issues) · [更新记录](./CHANGELOG.md) · [开发文档](./docs/engineering/development.md) · [源码许可：禁止修改、禁止出售源码](./LICENSE)
