import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import {AsyncLocalStorage} from 'node:async_hooks';
import {sourceOf} from './source.mjs';

test('清理只删除自有日志，保留当前文件、未知文件和符号链接',async()=>{
 const home=await fs.mkdtemp(path.join(os.tmpdir(),'日志 清理 '));
 try {
  const root=path.join(home,'logs','metaontic-video');
  for(const day of ['20000101','20000102','20990101'])await fs.mkdir(path.join(root,day),{recursive:true});
  const old=path.join(root,'20000101','requests.jsonl'),extra=path.join(root,'20000101','notes.txt');
  const current=path.join(root,'20990101','requests.jsonl');
  await fs.writeFile(old,'old');await fs.writeFile(extra,'keep');await fs.writeFile(current,'current');
  const external=path.join(home,'external');await fs.writeFile(external,'never-delete');
  // Windows 创建符号链接可能需要权限；硬链接同样不应导致目标内容被修改。
  await fs.link(external,path.join(root,'20000102','requests.jsonl'));
  const context=vm.createContext({...fs,path,AsyncLocalStorage,TextEncoder,dshHome:()=>home,PLUGIN_VERSION:'test'});
  vm.runInContext(sourceOf('shared/utils/logging'),context);
  await context.pruneRequestLogs(root,current);
  await assert.rejects(fs.stat(old),{code:'ENOENT'});
  assert.equal(await fs.readFile(extra,'utf8'),'keep');assert.equal(await fs.readFile(current,'utf8'),'current');
  assert.equal(await fs.readFile(external,'utf8'),'never-delete');
 }finally{await fs.rm(home,{recursive:true,force:true});}
});

test('超过总量阈值时从最旧日志清理，不删除当前日志',async()=>{
 const home=await fs.mkdtemp(path.join(os.tmpdir(),'日志 总量 '));
 try{
  for(const day of ['20990101','20990102']){await fs.mkdir(path.join(home,day));await fs.writeFile(path.join(home,day,'requests.jsonl'),'1234567890');}
  const ctx=vm.createContext({...fs,path,AsyncLocalStorage,TextEncoder,PLUGIN_VERSION:'test',dshHome:()=>home});
  vm.runInContext(sourceOf('shared/utils/logging')+'\nLOG_POLICY.totalBytes=15;',ctx);
  const current=path.join(home,'20990102','requests.jsonl');await ctx.pruneRequestLogs(home,current);
  await assert.rejects(fs.stat(path.join(home,'20990101','requests.jsonl')),{code:'ENOENT'});
  assert.equal((await fs.stat(current)).size,10);
 }finally{await fs.rm(home,{recursive:true,force:true});}
});
