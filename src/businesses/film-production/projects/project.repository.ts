import { readFile, readdir, stat, unlink } from 'node:fs/promises';
import path from 'node:path';
import {inspectFileLock,recoverFileLock,acquireFileLock} from '../../../shared/utils/file-lock.js';
export async function inspectProjectLock(dir:string) {
 return {...await inspectFileLock(path.join(dir,'.write.lock')),recovery:await inspectFileLock(path.join(dir,'.recovery.lock'))};
}
export async function recoverProjectLock(dir:string) {
 return recoverFileLock(path.join(dir,'.write.lock'),path.join(dir,'.recovery.lock'));
}
export async function acquireProjectLock(dir:string) {
 return acquireFileLock(path.join(dir,'.write.lock'));
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
