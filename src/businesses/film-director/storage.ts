import { open, unlink } from 'node:fs/promises';
import path from 'node:path';
/** 跨进程互斥；不按超时删除活跃审批的锁，也不猜测崩溃锁已经失效。 */
export async function acquireProjectLock(dir:string) {
  const file=path.join(dir,'.write.lock');
  let handle;
  try {handle=await open(file,'wx',0o600);} catch(error:any) {
    if(error.code==='EEXIST')throw Error('PROJECT_LOCKED: another process or interrupted write requires inspection');
    throw error;
  }
  try {await handle.writeFile(JSON.stringify({pid:process.pid,created_at:new Date().toISOString()}));}
  catch(error){await handle.close();await unlink(file);throw error;}
  return async()=>{try{await handle.close();}finally{await unlink(file);}};
}
