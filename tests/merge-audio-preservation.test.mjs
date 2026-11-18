import './no-network-analytics.mjs';
import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';
const dir=await mkdtemp(path.join(tmpdir(),'混合音轨 '));after(()=>rm(dir,{recursive:true,force:true}));
await build({stdin:{contents:"export {mergeClips} from './src/businesses/video/media/merge.ts'",resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',outfile:path.join(dir,'api.mjs'),plugins:[{name:'audio-fixture',setup(b){b.onLoad({filter:/media\/ffmpeg\.ts$/},()=>({loader:'js',contents:`
import {writeFile} from 'node:fs/promises';
export const resolveBinary=()=> 'offline';
export const probeMedia=async file=>globalThis.__audioMerge.media[file];
export const hasFfmpeg=async()=>true;
export const ffmpegInstallHint=()=>({hint:'offline'});
export async function runProcess(binary,args){globalThis.__audioMerge.calls.push(args);await writeFile(args.at(-1),'new movie');return {code:globalThis.__audioMerge.fail?1:0,stderr:'offline failure'};}
`}))}}]});
const api=await import(pathToFileURL(path.join(dir,'api.mjs')));
for(const order of [[false,true],[true,false],[true,true],[false,false]])test(`merge retains available audio in order ${order}`,async()=>{
 const out=path.join(dir,'成片.mp4');const media=Object.fromEntries(order.map((hasAudio,i)=>[String(i),{width:320,height:240,fps:24,durationSeconds:1,videoDurationSeconds:1,hasAudio}]));
 globalThis.__audioMerge={media,calls:[]};
 try {
  await api.mergeClips({mergeMode:'reencode'},['0','1'],out);
  const args=globalThis.__audioMerge.calls[0],filter=args[args.indexOf('-filter_complex')+1];
  assert.equal(globalThis.__audioMerge.calls.length,1);
  assert.equal(filter.includes('a=1[v][a]'),order.some(Boolean));
  for(const [i,hasAudio] of order.entries())if(order.some(Boolean))assert.equal(filter.includes(`[${i}:a]`),hasAudio);
  assert.equal(filter.includes('anullsrc='),order.includes(false)&&order.includes(true));
  assert.equal(await readFile(out,'utf8'),'new movie');
 }finally{delete globalThis.__audioMerge;}
});
test('audio failure never retries silently without audio and keeps existing final movie',async()=>{
 const out=path.join(dir,'旧成片.mp4');await writeFile(out,'previous movie');
 globalThis.__audioMerge={fail:true,calls:[],media:{'0':{width:320,height:240,hasAudio:true,durationSeconds:1},'1':{width:320,height:240,hasAudio:false,durationSeconds:1}}};
 try {
  await assert.rejects(api.mergeClips({mergeMode:'copy'},['0','1'],out),e=>e.code==='audio_merge_failed');
  assert.equal(globalThis.__audioMerge.calls.length,1);
  assert.equal(await readFile(out,'utf8'),'previous movie');
 }finally{delete globalThis.__audioMerge;}
});
test('missing audio probe fails safely rather than assuming silence',async()=>{
 globalThis.__audioMerge={calls:[],media:{'0':null,'1':{hasAudio:true}}};
 try{await assert.rejects(api.mergeClips({},['0','1'],path.join(dir,'unknown.mp4')),e=>e.code==='audio_probe_required');assert.equal(globalThis.__audioMerge.calls.length,0);}
 finally{delete globalThis.__audioMerge;}
});
