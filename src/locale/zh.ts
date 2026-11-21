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
    description: '新手用对话完成创意、脚本审核与视频制作；长视频通过分段续拍和本地合并完成，生成前确认费用。',
  },
};

export default locale;
