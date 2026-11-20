import { open, unlink, readFile, link } from 'node:fs/promises';
import os from 'node:os';
import { randomUUID } from 'node:crypto';
/** 不按超时抢占：只有同机且明确死亡的进程可恢复。 */
export async function inspectFileLock(file:string) {
 let raw;try{raw=await readFile(file,'utf8');}catch(e:any){if(e.code==='ENOENT')return {status:'unlocked',recoverable:false};throw e;}
 let record;try{record=JSON.parse(raw);}catch{return {status:'unknown',recoverable:false};}
 if(!record?.host || record.host!==os.hostname())return {status:'foreign_host',recoverable:false};
 if(!Number.isSafeInteger(record?.pid)||record.pid<=0)return {status:'unknown',recoverable:false};
 try{process.kill(record.pid,0);return {status:'active',recoverable:false};}
 catch(e:any){return {status:e.code==='ESRCH'?'interrupted':'unknown',recoverable:e.code==='ESRCH',record};}
}
function lockRecord(token:string) {return {pid:process.pid,host:os.hostname(),token,created_at:new Date().toISOString()};}
async function removeOwned(file:string,token:string) {
 let record;try{record=JSON.parse(await readFile(file,'utf8'));}catch(e:any){if(e.code==='ENOENT')return;throw e;}
 if(record.token===token)await unlink(file);
}
/** 先写完整元数据，再用硬链接独占发布，进程中断不会留下空锁。
 * Windows 文件系统不支持硬链接时明确失败，保留原文件。
 */
async function publishLock(file:string,token:string,metadata:Record<string,unknown>={}) {
 const prepared=`${file}.${token}.tmp`;
 const handle=await open(prepared,'wx',0o600);
 try {await handle.writeFile(JSON.stringify({...metadata,...lockRecord(token)}));await handle.close();await link(prepared,file);}
 finally {await handle.close().catch(()=>{});await unlink(prepared).catch(()=>{});}
}
/** 每个死亡token拥有独立清理锁。清理者也中断时递归恢复其锁；
 * 持有清理锁后再次比较token，迟到的恢复者不能删除后来者的锁。 */
async function reclaimDeadLock(file:string,depth=0) {
 const check=await inspectFileLock(file);
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
export async function recoverFileLock(file:string,guardFile=`${file}.recovery`) {
 const token=randomUUID();
 try{await publishLock(guardFile,token);}catch(e:any){if(e.code!=='EEXIST')throw e;await reclaimDeadLock(guardFile);await publishLock(guardFile,token);}
 try {
  const check=await inspectFileLock(file);
  if(check.status==='unlocked')return {status:'unlocked',recoverable:false};
  if(!check.recoverable)throw Error('LOCK_RECOVERY_UNSAFE:锁仍活跃或无法确认所属进程，保留原锁。');
  await unlink(file);return {status:'recovered',recoverable:false};
 }finally{await removeOwned(guardFile,token);}
}
export async function acquireFileLock(file:string,{recoverDead=false,metadata={}}: {recoverDead?:boolean;metadata?:Record<string,unknown>}={}) {
 const token=randomUUID();
 try {await publishLock(file,token,metadata);}
 catch(e:any){
  if(e.code!=='EEXIST')throw e;
  if(!recoverDead)throw Error('PROJECT_LOCKED:使用diagnose检查，明确中断后recover_lock恢复。');
  await recoverFileLock(file);
  await publishLock(file,token,metadata);
 }
 return async()=>{await removeOwned(file,token);};
}
