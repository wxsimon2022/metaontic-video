# <img src="https://ai.mybfs.cn/promo/readme-title-en.svg" width="840" height="44" alt="dsh-metaontic-video · DeepSeek Harness AI Video Creation Plugin" />

[简体中文](./README.md)

MetaOnticVideo is a DeepSeek Harness (DSH) AI video generation plugin that **helps beginners get started with AI short videos and offers a lower-cost long-video workflow through segment continuation and local merging**.

## What it does

- **Create videos quickly**: describe an idea or provide reference images, review the script, then generate and preview your video.
- **Build longer videos**: generate and continue segments, save progress, and merge them locally.

Scripts, images, and videos use the text, image, and video models configured in plugin settings. Regular chat still uses the Harness session model. Text script calls are billed by actual provider usage without a separate approval prompt; video production still requires review and cost confirmation.

Image and video generation is billed by your provider, with cost confirmation before generation.

## Online installation

Enter the package name `dsh-metaontic-video` in Harness → Plugins → Add plugin. DSH automatically prefers the China mirror for mainland China networks. Windows and macOS use the same package.

Fallback online installation links:

Gitee:

```text
https://gitee.com/hackloop/metaontic-video/releases/download/latest/metaontic-video.tgz
```

GitHub fallback:

```text
https://github.com/wxsimon2022/metaontic-video/releases/latest/download/metaontic-video.tgz
```

## Get started

1. Open plugin settings, choose **MetaOntic AI**, enter your API key and save.
2. Choose **视频创作助手** to make videos, or **Creative Video Designer** to design video prompts independently.
3. Confirm requirements, review the complete script, storyboard and estimate, then approve production costs and preview the results.

Example: “Make a 30-second vertical 720P video showing a peaceful lake at dawn.”

## Links

[Website & user guide](https://ai.mybfs.cn) · [AI-readable product summary](https://ai.mybfs.cn/llms.txt) · [Issues](https://github.com/wxsimon2022/metaontic-video/issues) · [Changelog](./CHANGELOG.md) · [Development](./docs/engineering/development.md) · [Source license: no modifications or source sales](./LICENSE)
