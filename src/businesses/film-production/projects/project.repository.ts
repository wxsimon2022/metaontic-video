import { open, unlink, readFile, readdir, stat, link } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { randomUUID } from 'node:crypto';
/** 不按超时抢占：只有同机且明确死亡的进程可恢复。 */
async function inspectLock(file:string) {
 let raw;try{raw=await readFile(file,'utf8');}catch(e:any){if(e.code==='ENOENT')return {status:'unlocked',recoverable:false};throw e;}
 let record;try{record=JSON.parse(raw);}catch{return {status:'unknown',recoverable:false};}
 if(record?.host && record.host!==os.hostname())return {status:'foreign_host',recoverable:false};
 if(!Number.isSafeInteger(record?.pid)||record.pid<=0)return {status:'unknown',recoverable:false};
 try{process.kill(record.pid,0);return {status:'active',recoverable:false};}
 catch(e:any){return {status:e.code==='ESRCH'?'interrupted':'unknown',recoverable:e.code==='ESRCH',record};}
}
export async function inspectProjectLock(dir:string) {
 return {...await inspectLock(path.join(dir,'.write.lock')),recovery:await inspectLock(path.join(dir,'.recovery.lock'))};
}
function lockRecord(token:string) {return {pid:process.pid,host:os.hostname(),token,created_at:new Date().toISOString()};}
async function removeOwned(file:string,token:string) {
 let record;try{record=JSON.parse(await readFile(file,'utf8'));}catch(e:any){if(e.code==='ENOENT')return;throw e;}
 if(record.token===token)await unlink(file);
}
/** 先写完整元数据，再用硬链接独占发布，进程中断不会留下空锁。
 * Windows 文件系统不支持硬链接时明确失败，保留原文件。
 */
async function publishLock(file:string,token:string) {
 const prepared=`${file}.${token}.tmp`;
 const handle=await open(prepared,'wx',0o600);
 try {await handle.writeFile(JSON.stringify(lockRecord(token)));await handle.close();await link(prepared,file);}
 finally {await handle.close().catch(()=>{});await unlink(prepared).catch(()=>{});}
}
/** 每个死亡token拥有独立清理锁。清理者也中断时递归恢复其锁；
 * 持有清理锁后再次比较token，迟到的恢复者不能删除后来者的锁。 */
async function reclaimDeadLock(file:string,depth=0) {
 const check=await inspectLock(file);
 if(check.status==='unlocked')return;
 if(depth>32||!check.recoverable||!/^[a-f0-9-]{36}$/.test(check.record?.token||''))throw Error('RECOVERY_LOCK_UNSAFE:恢复锁活跃或无法确定所属进程，保留原锁。');
 const claim=`${file}.reclaim-${check.record.token}`;const token=randomUUID();
 try {await publishLock(claim,token);}
 catch(e:any){if(e.code!=='EEXIST')throw e;await reclaimDeadLock(claim,depth+1);await publishLock(claim,token);}
 try {
  let current;try{current=JSON.parse(await readFile(file,'utf8'));}catch(e:any){if(e.code==='ENOENT')return;throw e;}
  if(current.token===check.record.token)await unlink(file);
 }finally{await removeOwned(claim,token);}
}
export async function recoverProjectLock(dir:string) {
 const file=path.join(dir,'.write.lock');const guardFile=path.join(dir,'.recovery.lock');const token=randomUUID();
 try{await publishLock(guardFile,token);}catch(e:any){if(e.code!=='EEXIST')throw e;await reclaimDeadLock(guardFile);await publishLock(guardFile,token);}
 try {
  const check=await inspectLock(file);
  if(check.status==='unlocked')return {status:'unlocked',recoverable:false};
  if(!check.recoverable)throw Error('LOCK_RECOVERY_UNSAFE:锁仍活跃或无法确认所属进程，保留原锁。');
  await unlink(file);return {status:'recovered',recoverable:false};
 }finally{await removeOwned(guardFile,token);}
}
export async function acquireProjectLock(dir:string) {
 const file=path.join(dir,'.write.lock');const token=randomUUID();
 try {await publishLock(file,token);}catch(e:any){if(e.code==='EEXIST')throw Error('PROJECT_LOCKED:使用diagnose检查，明确中断后recover_lock恢复。');throw e;}
 return async()=>{await removeOwned(file,token);};
}
/** 保留最近30份和所有批准/依赖版本；只清理已提交修订，未来/损坏快照留待诊断。 */
export async function pruneProjectSnapshots(dir:string,state:any,keep=30) {
 const folder=path.join(dir,'snapshots');
 const protectedRevisions=new Set([state.revision,...Object.values(state.approvals||{}),...(state.decisions||[]).map(d=>d.artifact_revision),...Object.values(state.artifacts||{}).flatMap((a:any)=>[a.revision,...Object.values(a.source_revisions||{})])]);
 const files=[];
 for(const name of await readdir(folder)) {
  if(!/^\d+-[a-f0-9-]+\.json$/.test(name))continue;
  const revision=Number(name.split('-')[0]);if(revision>state.revision)continue;
  files.push({name,revision,mtime:(await stat(path.join(folder,name))).mtimeMs});
 }
 files.sort((a,b)=>b.mtime-a.mtime);
 for(const item of files.slice(keep)) {
  if(protectedRevisions.has(item.revision))continue;
  const file=path.join(folder,item.name);let saved;
  try{saved=JSON.parse(await readFile(file,'utf8'));}catch{continue;}
  if(saved.revision===item.revision)await unlink(file);
 }
}
