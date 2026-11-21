/** 仅保存真实成功任务的规格样本；不保存提示词、凭据、媒体地址，不据此推断能力上限。 */
import { createHash,randomUUID } from 'node:crypto';
import { mkdir,readFile,writeFile,rename,rm,readdir,stat } from 'node:fs/promises';
import path from 'node:path';
import { dshHome } from '../media/references.js';
import { DATA_DIR } from '../../../shared/constants/plugin.js';
import { resolveBaseUrl,isVolcengine } from './connection.js';
export function capabilityChannel(config:any) {
 const mode=isVolcengine(config)?'volcengine':'metaontic';
 return `${mode}@${createHash('sha256').update(resolveBaseUrl(config).replace(/\/$/,'')).digest('hex').slice(0,16)}`;
}
const directory=()=>path.join(dshHome(),'state',DATA_DIR,'capability-observations');
export async function recordCapabilityObservation(config:any,body:any,result:any) {
 if(result.status!=='succeeded'||!result.taskId||!body.model)return;
 if(process.env.NODE_TEST_CONTEXT&&!process.env.DSH_HOME)return;
 const folder=directory();await mkdir(folder,{recursive:true,mode:0o700});
 const channel=capabilityChannel(config);
 const id=createHash('sha256').update(`${channel}:${body.model}:${result.taskId}`).digest('hex');
 const file=path.join(folder,`${id}.json`),temp=path.join(folder,`${randomUUID()}.tmp`);
 const sample={channel_id:channel,model_name:body.model,source_task_id:result.taskId,observed_at:new Date().toISOString(),request_sample:{duration_seconds:body.duration??null,aspect_ratio:body.ratio??null,resolution:body.resolution??null,audio_requested:body.generate_audio??null}};
 try{await writeFile(temp,JSON.stringify(sample),{mode:0o600,flag:'wx'});await rename(temp,file);}finally{await rm(temp,{force:true}).catch(()=>{});}
 const files=await readdir(folder);
 const records=await Promise.all(files.filter(n=>/^[a-f0-9]{64}\.json$/.test(n)).map(async name=>({name,time:(await stat(path.join(folder,name))).mtimeMs})));
 records.sort((a,b)=>b.time-a.time);
 for(const entry of records.slice(256))await rm(path.join(folder,entry.name),{force:true});
}
export async function readCapabilityObservations() {
 if(process.env.NODE_TEST_CONTEXT&&!process.env.DSH_HOME)return [];
 let names:string[];try{names=await readdir(directory());}catch{return [];}
 const samples=[];
 for(const name of names.filter(n=>/^[a-f0-9]{64}\.json$/.test(n)).slice(0,256)) {
  try{samples.push(JSON.parse(await readFile(path.join(directory(),name),'utf8')));}catch{/* 单条损坏不升级为实测证据 */}
 }
 return samples;
}
