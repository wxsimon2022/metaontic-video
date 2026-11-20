import {test} from 'node:test';
import assert from 'node:assert/strict';
import {gzipSync} from 'node:zlib';
import {validateNpmBundle} from '../scripts/npm-bundle.mjs';
import {syncNpmMirror} from '../scripts/sync-npm-mirror.mjs';
const name='dsh-metaontic-video',version='4.0.9';
function archive(manifest,patch=true){
 const entries={'package/package.json':JSON.stringify(manifest),...(patch?{'package/cordis.patch.yml':'plugins: {}'}:{})};
 const blocks=[];
 for(const [file,text] of Object.entries(entries)){
  const body=Buffer.from(text),header=Buffer.alloc(512);header.write(file);header.write(body.length.toString(8).padStart(11,'0'),124);header[156]=48;
  blocks.push(header,body,Buffer.alloc((512-body.length%512)%512));
 }
 return gzipSync(Buffer.concat([...blocks,Buffer.alloc(1024)]));
}
const manifest={name,version,dsh:{bundle:{patch:'./cordis.patch.yml'}}};
test('installable bundle requires a real declaration and included patch',()=>{
 assert.equal(validateNpmBundle(archive(manifest),{name,version}).version,version);
 assert.throws(()=>validateNpmBundle(archive({name,version,stub:true})),/no dsh.bundle/);
 assert.throws(()=>validateNpmBundle(archive(manifest,false)),/missing/);
 assert.throws(()=>validateNpmBundle(archive(manifest),{version:'1.0.0'}),/mismatch/);
});
test('mirror completion checks downloadable identical bundle rather than sync acceptance',async()=>{
 const bytes=archive(manifest);let stale=true;
 const request=async(url,options={})=>{
  url=String(url);
  if(options.method==='PUT')return {ok:true};
  if(url.includes('/latest?'))return {ok:true,json:async()=>url.includes('npmjs.org')?{...manifest,dist:{tarball:'https://registry.npmjs.org/a.tgz'}}:stale?{version:'0.0.0-stage',stub:true}:{...manifest,dist:{tarball:'https://registry.npmmirror.com/a.tgz'}}};
  return {ok:true,arrayBuffer:async()=>bytes};
 };
 await assert.rejects(()=>syncNpmMirror({name,version,request,attempts:1,log:()=>{}}),/mirror not ready/);
 const result=await syncNpmMirror({name,version,request,attempts:2,wait:async()=>{stale=false;},log:()=>{}});
 assert.equal(result.verified,true);
});
