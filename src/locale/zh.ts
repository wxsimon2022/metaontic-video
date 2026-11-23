/**
 * 插件在「插件」页里显示的标题与描述（中文）。
 *
 * 源码写在 TS 里，构建时由 `scripts/build.mjs` 生成 `dist/locale/zh.json`——
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
    description: '帮助新手快速上手 AI 短视频创作，支持分段续拍、断点续做与本地合并，提供低成本长视频生成方案。',
  },
};

export default locale;
