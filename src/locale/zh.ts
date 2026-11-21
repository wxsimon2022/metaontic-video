/**
 * 插件在「插件」页里显示的标题与描述（中文）。
 *
 * 源码写在 TS 里，构建时由 `scripts/build-locale.mjs` 生成 `locale/zh.json`——
 * DSH 是按 `./locale/*.json` 这个导出路径读元信息的，运行时只认 JSON。
 */
export interface PluginLocale {
  meta: {
    title: string;
    description: string;
    detail?: string;
  };
}

export const locale: PluginLocale = {
  meta: {
    title: 'MetaOnticVideo',
    detail: 'plugin-detail.md',
    description: 'DeepSeek Harness AI视频创作插件：新手用对话完善创意、审核脚本并制作视频；通过分段续拍、断点续做与本地合并，低成本制作长视频。模型调用单独计费。',
  },
};

export default locale;
