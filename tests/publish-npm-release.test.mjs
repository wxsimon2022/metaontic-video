import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {publishNpmRelease} from '../scripts/publish-npm-release.mjs';

test('三端续跑核对已有 npm 包字节并同步镜像，不重复发布；不同字节必须拒绝',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'meta-release-'));
 try{
  const archive=join(dir,'package.tgz');writeFileSync(archive,'original');let synced=0;
  let bytes=Buffer.from('original');
  const request=async url=>String(url).endsWith('/4.0.12')?{ok:true,json:async()=>({name:'dsh-metaontic-video',version:'4.0.12',dsh:{bundle:{patch:'./cordis.patch.yml'}},dist:{tarball:'https://registry.npmjs.org/dsh-metaontic-video/-/dsh-metaontic-video-4.0.12.tgz'}})}:{ok:true,arrayBuffer:async()=>bytes};
  const args={name:'dsh-metaontic-video',version:'4.0.12',archive,request,publish:()=>assert.fail('不能重发已有版本'),sync:async()=>synced++};
  await publishNpmRelease(args);assert.equal(synced,1);
  bytes=Buffer.from('different');await assert.rejects(()=>publishNpmRelease(args),/成品不同/);assert.equal(synced,1);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
test('仅 npm 明确404才发新版本；网络或权限错误停止',async()=>{
 let published=0;
 const args={name:'dsh-metaontic-video',version:'4.0.12',archive:'unused',publish:async argv=>{assert.deepEqual(argv,['4.0.12']);published++;}};
 await publishNpmRelease({...args,request:async()=>({status:404})});assert.equal(published,1);
 await assert.rejects(()=>publishNpmRelease({...args,request:async()=>({status:403,ok:false})}),/查询失败/);assert.equal(published,1);
});
