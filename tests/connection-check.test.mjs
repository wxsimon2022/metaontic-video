import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const bundle=await build({stdin:{contents:"export * from './src/businesses/video-generation/providers/connection-check.ts';export * from './src/businesses/video-generation/integrations/connection-check.ts';export * from './src/businesses/video-generation/client/connection-check.ts';",resolveDir:process.cwd()},bundle:true,write:false,platform:'node',format:'esm'});
const api=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const config={connectionMode:'metaontic',baseUrl:'https://relay.invalid/v1/',model:'video-test',imageModel:'image-test',textModel:'deepseek-v4.1',metaonticApiKey:'video-private',imageApiKey:'image-private',textApiKey:'text-private'};
const ok=()=>Response.json({data:[{id:'video-test'},{id:'image-test'},{id:'deepseek-v4.1'}]});
test('只读验证使用GET模型清单，共用密钥去重，不创建任务',async()=>{
 const calls=[];
 const result=await api.checkConnections(config,{fetcher:async(url,options)=>{calls.push({url,options});return ok();}});
 assert.equal(calls.length,1);assert.equal(calls[0].url,'https://relay.invalid/v1/models');assert.equal(calls[0].options.method,'GET');assert.equal(calls[0].options.headers.Authorization,'Bearer video-private');assert.equal(calls[0].options.redirect,'error');assert.equal(calls[0].options.body,undefined);
 assert.equal(result.checks.length,3);assert.equal(result.generation_tested,false);
 assert.ok(!JSON.stringify(result).includes('private'));
});
test('独立图片和文本密钥按实际路由验证，缺失不得回退视频密钥',async()=>{
 const keys=[];
 await api.checkConnections({...config,imageUseVideoKey:false},{fetcher:async(_url,options)=>{keys.push(options.headers.Authorization);return ok();}});
 assert.deepEqual(keys.sort(),['Bearer video-private','Bearer image-private','Bearer text-private'].sort());
 keys.length=0;
 const result=await api.checkConnections({...config,imageUseVideoKey:false,imageApiKey:'',textApiKey:''},{fetcher:async(_url,options)=>{keys.push(options.headers.Authorization);return ok();}});
 assert.deepEqual(keys,['Bearer video-private']);assert.deepEqual(result.checks.slice(1).map(c=>c.code),['key_missing','key_missing']);
});
test('鉴权、权限、模型未列出与接口不支持分别报告，不回传上游正文',async()=>{
 for(const [status,code] of [[401,'auth_failed'],[403,'forbidden'],[404,'models_unsupported'],[429,'rate_limited'],[500,'server_error']]) {
  const result=await api.checkConnections(config,{fetcher:async()=>new Response('secret-private-provider-error',{status})});
  assert.ok(result.checks.every(c=>c.code===code));assert.ok(!JSON.stringify(result).includes('secret'));
 }
 const result=await api.checkConnections(config,{fetcher:async()=>Response.json({data:[]})});
 assert.ok(result.checks.every(c=>c.code==='model_not_listed'&&c.level==='warning'));
 const invalid=await api.checkConnections(config,{fetcher:async()=>new Response('<html>private</html>')});assert.ok(invalid.checks.every(c=>c.code==='invalid_response'));
});
test('地址无效不发送密钥，网络错误与超时有界返回',async()=>{
 let calls=0;
 const invalid=await api.checkConnections({...config,baseUrl:'https://user:pass@relay.invalid'},{fetcher:async()=>{calls++;return ok();}});
 assert.equal(calls,0);assert.ok(invalid.checks.every(c=>c.code==='invalid_address'));
 const failed=await api.checkConnections(config,{fetcher:async()=>{throw Error('video-private');}});assert.ok(failed.checks.every(c=>c.code==='network_error'));
 const timer=setTimeout(()=>{},100);
 try {
  const timed=await api.checkConnections(config,{timeoutMs:5,fetcher:async(_url,{signal})=>new Promise((_,reject)=>signal.addEventListener('abort',()=>reject(Error('aborted')),{once:true}))});
  assert.ok(timed.checks.every(c=>c.code==='timeout'));
 }finally{clearTimeout(timer);}
});
test('火山只使用火山密钥和查询GET，不以404声称生成权限通过',async()=>{
 const calls=[];
 const result=await api.checkConnections({...config,connectionMode:'volcengine',volcengineApiKey:'volc-private'},{fetcher:async(url,options)=>{calls.push({url,options});return new Response('',{status:404});}});
 assert.equal(calls.length,1);assert.match(calls[0].url,/ark\.cn-beijing\.volces\.com\/api\/v3\/contents\/generations\/tasks\//);assert.equal(calls[0].options.headers.Authorization,'Bearer volc-private');assert.equal(calls[0].options.method,'GET');assert.equal(result.checks[0].code,'query_reachable');assert.equal(result.checks[0].level,'warning');
});
test('设置验证不发送配置；重复点击去重，编辑后忽略在途旧结果',async()=>{
 let state,calls=0,resolve;const snapshot={revision:1};
 const controller=api.createConnectionCheckController({setState:v=>state=v,readSnapshot:()=>snapshot,fetcher:async(_url,options)=>{calls++;assert.equal(options.body,'{}');return new Promise(r=>resolve=r);}});
 const running=controller.run(true);await controller.run(true);assert.equal(calls,1);assert.equal(state.status,'working');
 controller.invalidate();resolve(Response.json({checks:[{target:'video',code:'ok'}]}));await running;assert.equal(state.status,'idle');
 await controller.run(false);assert.equal(calls,1);
});
test('宿主配置修订变化后不展示旧验证结论',async()=>{
 let state,resolve;const snapshot={revision:1};
 const controller=api.createConnectionCheckController({setState:v=>state=v,readSnapshot:()=>snapshot,fetcher:async()=>new Promise(r=>resolve=r)});
 const run=controller.run(true);snapshot.revision=2;resolve(Response.json({checks:[{target:'video',code:'ok'}]}));await run;
 assert.notEqual(state.status,'done');controller.dispose();
});
test('设置专用接口拒绝跨站、GET及配置覆盖，不发起外网请求',async()=>{
 let handler,calls=0;const previous=globalThis.fetch;
 globalThis.fetch=async()=>{calls++;return ok();};
 try {
  api.registerConnectionCheck({inject(_deps,cb){return cb({webServer:{register(route){handler=route.handler;return ()=>{};}}});}},config);
  async function request(method,headers,body='{}') {
   const req={method,headers:{host:'localhost',...headers},async *[Symbol.asyncIterator](){yield Buffer.from(body);}};
   const res={statusCode:200,setHeader(){},end(body){this.body=JSON.parse(body);}};await handler(req,res);return res;
  }
  assert.equal((await request('GET',{})).statusCode,405);
  assert.equal((await request('POST',{'content-type':'application/json',origin:'https://outside.invalid'})).statusCode,403);
  assert.equal((await request('POST',{'content-type':'application/json'},'{"apiKey":"private"}')).statusCode,400);
  assert.equal(calls,0);
  const result=await request('POST',{'content-type':'application/json',origin:'http://localhost'});assert.equal(result.statusCode,200);assert.equal(result.body.checks.length,3);assert.equal(calls,1);
 }finally{globalThis.fetch=previous;}
});

test('模型清单403但令牌只读鉴权正常时不误判生成权限失败',async()=>{
 const calls=[];
 const result=await api.checkConnections(config,{fetcher:async(url,options)=>{calls.push(url);assert.equal(options.method,'GET');assert.equal(options.body,undefined);return url.endsWith('/v1/models')?new Response('{}',{status:403}):Response.json({success:true,data:[]});}});
 assert.deepEqual(calls,['https://relay.invalid/v1/models','https://relay.invalid/api/log/token']);
 assert.ok(result.checks.every(c=>c.code==='auth_reachable'&&c.level==='warning'));
 assert.equal(result.generation_tested,false);
});
test('补充鉴权失败保留403证据，不将未知权限标为通过',async()=>{
 const result=await api.checkConnections(config,{fetcher:async()=>new Response('{}',{status:403})});
 assert.ok(result.checks.every(c=>c.code==='forbidden'&&c.level==='warning'));
});
