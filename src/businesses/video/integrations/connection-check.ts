import { checkConnections } from '../providers/connection-check.js';
/** 设置页专用本机接口；请求体不接受密钥、地址或配置覆盖。 */
export function registerConnectionCheck(ctx:any,config:any) {
  return ctx.inject(['webServer'],scope=>{
    if(typeof scope.webServer?.register!=='function')return;
    let running=false;
    const remove=scope.webServer.register({kind:'exact',path:'/metaontic-video/check-connection',async handler(req,res){
      res.setHeader('content-type','application/json; charset=utf-8');res.setHeader('cache-control','no-store');
      try {
        if(req.method!=='POST'){res.statusCode=405;res.end(JSON.stringify({error:'method_not_allowed'}));return;}
        if(req.headers['sec-fetch-site']==='cross-site'||(req.headers.origin&&new URL(req.headers.origin).host!==req.headers.host)){res.statusCode=403;res.end(JSON.stringify({error:'invalid_origin'}));return;}
        if(!String(req.headers['content-type']||'').startsWith('application/json'))throw Error('invalid_request');
        let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>1024)throw Error('invalid_request');}
        const body=JSON.parse(raw || '{}');if(!body||Array.isArray(body)||typeof body!=='object'||Object.keys(body).length)throw Error('invalid_request');
        if(running){res.statusCode=409;res.end(JSON.stringify({error:'busy'}));return;}
        running=true;
        try{res.end(JSON.stringify(await checkConnections(config)));}finally{running=false;}
      }catch{res.statusCode=400;res.end(JSON.stringify({error:'check_failed'}));}
    }});
    return ()=>{if(typeof remove==='function')remove();};
  });
}
