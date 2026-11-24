import {test} from 'node:test';
import assert from 'node:assert/strict';
import {packageDescription} from '../scripts/package-description.mjs';
test('registry description preserves Chinese text and uses public absolute links',()=>{
 const result=packageDescription('<img src="https://video.mybfs.cn/promo/share-logo.png" />\n中文介绍\n[许可](./LICENSE)');
 assert.match(result,/中文介绍/);
 assert.match(result,/https:\/\/github.com\/wxsimon2022\/metaontic-video\/blob\/master\/LICENSE/);
 assert.match(result,/https:\/\/video.mybfs.cn\/promo\/share-logo.png/);
});
test('relative or insecure images cannot enter registry metadata',()=>{
 assert.throws(()=>packageDescription('<img src="./logo.svg" />'));
 assert.throws(()=>packageDescription('![Logo](./logo.svg)'));
 assert.throws(()=>packageDescription('![Logo](http://example.com/logo.png)'));
});
test('plugin detail excludes installation instructions and preserves usage',()=>{
 const result=packageDescription('# 插件\n\n## 在线安装\n输入包名\n\n```text\nhttps://example.com/plugin.tgz\n```\n\n## 开始使用\n填写密钥\n');
 assert.doesNotMatch(result,/在线安装|输入包名|plugin\.tgz/);
 assert.match(result,/## 开始使用\n填写密钥/);
 assert.equal(packageDescription('# 插件\n## 在线安装\n安装步骤'), '# 插件\n');
});
