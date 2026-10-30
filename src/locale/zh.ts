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
  };
}

export const locale: PluginLocale = {
  meta: {
    title: 'MetaOnticVideo',
    description: '视频生成插件：说一句话就出片——15 秒以内一次直出、一镜到底；更长的自动逐段续拍并无缝合并成一条完整成片，直接落到你本机。已有视频也能接着往下拍或往前补一段。',
  },
};

export default locale;
