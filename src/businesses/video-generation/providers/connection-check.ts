import { imageConfig, textConfig, snapshotConfig, resolveApiKey, resolveBaseUrl, resolveModel, resolveTextModel, resolveQueryPath, isVolcengine } from './connection.js';
export const CONNECTION_CHECK_TIMEOUT_MS=12000;
/** 只读诊断。仅读取已保存配置，绝不提交模型任务或返回上游错误/密钥。 */
export async function checkConnections(liveConfig:any,options:any={}) {
  const config=snapshotConfig(liveConfig);
  const fetcher=options.fetcher || fetch;
  const cache=new Map<string,Promise<any>>();
  const probe=(cfg:any)=>{
    const key=resolveApiKey(cfg);
    if(!key)return Promise.resolve({code:'key_missing',level:'error'});
    const base=resolveBaseUrl(cfg);
    let url:URL;
    try {
      url=new URL(isVolcengine(cfg)?base+resolveQueryPath(cfg,'00000000-0000-0000-0000-000000000000'):(/\/v\d+$/.test(base)?base+'/models':base+'/v1/models'));
      if(!['http:','https:'].includes(url.protocol)||url.username||url.password||url.search||url.hash)throw Error();
    }catch{return Promise.resolve({code:'invalid_address',level:'error'});}
    const identity=JSON.stringify([url.href,key]);
    if(!cache.has(identity))cache.set(identity,(async()=>{
      const timeout=AbortSignal.timeout(options.timeoutMs || CONNECTION_CHECK_TIMEOUT_MS);
      const signal=options.signal?AbortSignal.any([options.signal,timeout]):timeout;
      try {
        const response=await fetcher(url.href,{method:'GET',redirect:'error',headers:{accept:'application/json',Authorization:`Bearer ${key}`},signal});
        if(response.status===401)return {code:'auth_failed',level:'error',http_status:401};
        if(response.status===403) {
          if (!isVolcengine(cfg)) {
            // New API 可限制模型清单，但仍允许令牌查询与生成；仅补充只读鉴权证据。
            const authUrl = new URL('/api/log/token', url);
            try {
              const auth = await fetcher(authUrl.href, {method:'GET',redirect:'error',headers:{accept:'application/json',Authorization:`Bearer ${key}`},signal});
              if (auth.ok) {
                const body = await auth.json();
                if (body?.success === true && Array.isArray(body?.data)) return {code:'auth_reachable',level:'warning',http_status:403};
              }
            } catch { /* 补充探测失败不能覆盖模型清单实际返回的状态。 */ }
          }
          return {code:'forbidden',level:'warning',http_status:403};
        }
        if(isVolcengine(cfg))return {code:response.status===404?'query_reachable':'query_unverified',level:'warning',http_status:response.status};
        if(response.status===404||response.status===405)return {code:'models_unsupported',level:'warning',http_status:response.status};
        if(response.status===429)return {code:'rate_limited',level:'warning',http_status:429};
        if(!response.ok)return {code:'server_error',level:'error',http_status:response.status};
        let body;
        try{body=await response.json();}catch{return {code:'invalid_response',level:'error'};}
        if(body?.error||body?.success===false)return {code:'api_rejected',level:'error'};
        if(!Array.isArray(body?.data)||body.data.some(row=>typeof row?.id!=='string'))return {code:'invalid_response',level:'error'};
        return {code:'ok',level:'success',ids:new Set(body.data.map(row=>row.id))};
      }catch{return {code:signal.aborted?'timeout':'network_error',level:'error'};}
    })());
    return cache.get(identity)!;
  };
  const targets=isVolcengine(config)?['video']:['video','image','text'];
  const checks=await Promise.all(targets.map(async target=>{
    let cfg:any;
    try{cfg=target==='image'?imageConfig(config):target==='text'?textConfig(config):config;}
    catch{return {target,code:'key_missing',level:'error'};}
    const model=target==='image'?cfg.imageModel:target==='text'?resolveTextModel(cfg):resolveModel(cfg);
    const result=await probe(cfg);
    const {ids,...safe}=result;
    return {target,model,...safe,...(ids&&!ids.has(model)?{code:'model_not_listed',level:'warning'}:{}),
      ...(target==='text'&&ids?{availableModels:[...ids].sort().slice(0,300)}: {})};
  }));
  return {checks,scope:'read_only',generation_tested:false};
}
