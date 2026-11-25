import {readFile} from 'node:fs/promises';
import {PLUGIN_VERSION,PLUGIN_BUILD_ID} from '../../shared/constants/version.js';
/** Reports the executing module, rather than claiming the on-disk version is already running. */
export function registerRuntimeVersion(ctx:any,readInstalled=async()=>JSON.parse(await readFile(new URL('./build-info.json',import.meta.url),'utf8'))){
 return ctx.inject(['webServer'],scope=>{
  if(typeof scope.webServer?.register!=='function')return;
  return scope.webServer.register({kind:'exact',path:'/metaontic-video/runtime-version',async handler(req,res){
   res.setHeader('content-type','application/json; charset=utf-8');res.setHeader('cache-control','no-store');
   if(req.method!=='GET'){res.statusCode=405;res.end(JSON.stringify({error:'method_not_allowed'}));return;}
   try{
    const info=await readInstalled();
    const valid=(v:any)=>typeof v?.version==='string'&&/^[a-f0-9]{64}$/.test(v.buildId||'');
    const running={version:PLUGIN_VERSION,buildId:PLUGIN_BUILD_ID},installed={version:info.version,buildId:info.buildId};
    if(!valid(running)||!valid(installed))throw Error();
    res.end(JSON.stringify({running,installed,matches:running.version===installed.version&&running.buildId===installed.buildId}));
   }catch{res.statusCode=503;res.end(JSON.stringify({error:'runtime_version_unavailable'}));}
  }});
 });
}
