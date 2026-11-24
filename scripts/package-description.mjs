/** npm 元数据使用中文首页；链接不依赖 registry/unpkg 的相对文件访问。 */
export function packageDescription(markdown) {
  // 已安装插件的详情无需再次展示安装步骤；仓库首页保留完整安装说明。
  markdown = markdown.replace(/^## 在线安装[^\n]*\n[\s\S]*?(?=^## |$(?![\s\S]))/m, '');
  const images = [
    ...[...markdown.matchAll(/<img\b[^>]*\bsrc=["']([^"']+)["']/gi)].map(m=>m[1]),
    ...[...markdown.matchAll(/!\[[^\]]*\]\(([^\s)]+)/g)].map(m=>m[1]),
  ];
  for(const image of images) {
    const url=new URL(image);
    if(url.protocol!=='https:')throw Error('Package description images must use absolute HTTPS URLs');
  }
  return markdown.replace(/\]\(\.\/([^\s)]+)\)/g, (_match,file)=>`](https://github.com/wxsimon2022/metaontic-video/blob/master/${file})`).trim()+'\n';
}
