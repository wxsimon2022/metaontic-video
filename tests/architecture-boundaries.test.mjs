import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readdir,readFile} from 'node:fs/promises';
import path from 'node:path';
async function files(dir){return (await Promise.all((await readdir(dir,{withFileTypes:true})).map(e=>e.isDirectory()?files(path.join(dir,e.name)):e.name.endsWith('.ts')?[path.join(dir,e.name)]:[]))).flat();}
test('共享基础与宿主适配不反向依赖应用、业务或界面',async()=>{
 for(const layer of ['shared','platform'])for(const file of await files(path.resolve('src',layer))){
  const text=await readFile(file,'utf8');
  for(const match of text.matchAll(/(?:from\s*|import\s*\()\s*['"]([^'"]+)['"]/g)){
   if(!match[1].startsWith('.'))continue;
   const dependency=path.relative(path.resolve('src'),path.resolve(path.dirname(file),match[1])).split(path.sep)[0];
   const allowed=layer==='shared'?['shared']:['platform','shared'];
   assert.ok(allowed.includes(dependency),`${file} -> ${match[1]}`);
  }
 }
});
