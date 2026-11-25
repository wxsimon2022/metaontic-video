import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import path from 'node:path';
import os from 'node:os';
import { createHash, randomUUID } from 'node:crypto';
import * as fs from 'node:fs/promises';
import { sourceOf } from './source.mjs';
const c = vm.createContext({ path, Buffer, process, URL, createHash, randomUUID, ...fs, dshHome: () => '/nonexistent-test-host' });
vm.runInContext(sourceOf('businesses/video-generation/assets/storage', 'businesses/video-generation/integrations/assets'), c);
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64');
async function* chunks(bytes) { yield bytes.subarray(0, 8); yield bytes.subarray(8); }

test('uploads persist atomically, deduplicate content, retain original names and isolate workspaces', async () => {
 const root = await fs.mkdtemp(path.join(os.tmpdir(), '素材 assets-'));
 const other = await fs.mkdtemp(path.join(os.tmpdir(), 'other-assets-'));
 try {
  const [a,b] = await Promise.all([c.saveLibraryUpload(root,'产品 图.png',chunks(png)),c.saveLibraryUpload(root,'same.png',chunks(png))]);
  assert.equal(a.localPath,b.localPath);
  assert.ok(a.localPath.startsWith(path.join(root,'metaontic-video','assets')));
  assert.deepEqual(await fs.readFile(a.localPath),png);
  const list = await c.listLibraryUploads(root); assert.equal(list.length,1);
  assert.ok(['产品 图.png','same.png'].includes(list[0].name));
  assert.equal((await c.listLibraryUploads(other)).length,0);
  assert.ok((await fs.readdir(path.dirname(a.localPath))).every(name => !name.endsWith('.tmp')));
  await fs.writeFile(path.join(root,'unrelated.png'),png);
  assert.equal((await c.listLibraryUploads(root)).length,1);
 } finally { await fs.rm(root,{recursive:true,force:true}); await fs.rm(other,{recursive:true,force:true}); }
});

test('uploads reject unsupported content, declared oversize, symlink directories and unregistered projects', async () => {
 const root = await fs.mkdtemp(path.join(os.tmpdir(),'asset-boundary-'));
 const outside = await fs.mkdtemp(path.join(os.tmpdir(),'asset-outside-'));
 try {
  await assert.rejects(c.saveLibraryUpload(root,'fake.png',chunks(Buffer.from('<html>bad</html>'))), e=>e.code==='unsupported_media');
  await assert.rejects(c.saveLibraryUpload(root,'huge.mp4',chunks(png),101*1024*1024), e=>e.code==='asset_too_large');
  const ctx={get:()=>({list:()=>[{path:root}]})};
  assert.equal(await c.resolveAssetWorkspace(ctx,root),await fs.realpath(root));
  await assert.rejects(c.resolveAssetWorkspace(ctx,outside), e=>e.code==='workspace_not_registered');
  await assert.rejects(c.resolveAssetWorkspace({get:()=>undefined},outside), e=>e.code==='workspace_not_registered');
  await fs.symlink(outside,path.join(root,'metaontic-video'),process.platform==='win32'?'junction':'dir');
  await assert.rejects(c.saveLibraryUpload(root,'image.png',chunks(png)),e=>e.code==='asset_directory_invalid');
  assert.equal((await fs.readdir(outside)).length,0);
 } finally { await fs.rm(root,{recursive:true,force:true}); await fs.rm(outside,{recursive:true,force:true}); }
});

test('local upload route validates origin and scope and returns only media metadata', async () => {
 const root = await fs.mkdtemp(path.join(os.tmpdir(),'asset-route-'));
 let handler;
 const ctx={get:()=>({list:()=>[{path:root}]}),inject(_names,fn){return fn({webServer:{register(options){handler=options.handler;return ()=>{};}}});}};
 c.registerLibraryAssets(ctx);
 async function request(method,origin,bytes=png){const req=chunks(bytes);Object.assign(req,{method,url:'/metaontic-video/assets?project='+encodeURIComponent(root)+'&name='+encodeURIComponent('商品.png'),headers:{origin,host:'127.0.0.1:1234','content-type':'application/octet-stream'}});const res={statusCode:200,setHeader(){},end(value){this.body=JSON.parse(value);}};await handler(req,res);return res;}
 try {
  assert.equal((await request('POST','https://unrelated.invalid')).statusCode,403);
  const saved=await request('POST','dsh-app://app');assert.equal(saved.statusCode,201);
  const listed=await request('GET','dsh-app://app');assert.equal(listed.body.assets.length,1);
  assert.equal(listed.body.assets[0].name,'商品.png');
  assert.equal((await request('DELETE','dsh-app://app')).statusCode,405);
 } finally { await fs.rm(root,{recursive:true,force:true}); }
});
