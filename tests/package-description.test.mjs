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
