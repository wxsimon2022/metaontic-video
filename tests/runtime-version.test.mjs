import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const identity='a'.repeat(64);
const bundle=await build({stdin:{contents:"export * from './src/platform/installation/runtime-version.ts';export * from './src/ui/updates/update.service.ts';",resolveDir:process.cwd()},bundle:true,write:false,platform:'node',format:'esm',define:{__PLUGIN_VERSION__:'"4.2.5"',__PLUGIN_BUILD_ID__:JSON.stringify(identity)}});
const api=await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
function handler(readInstalled){let route;api.registerRuntimeVersion({inject(_deps,callback){return callback({webServer:{register(value){route=value;}}});}},readInstalled);return async(method='GET')=>{let body;const response={statusCode:200,setHeader(){},end(value){body=JSON.parse(value);}};await route.handler({method},response);return {status:response.statusCode,body};};}
test('runtime endpoint distinguishes executing code from newly installed files and rejects writes',async()=>{
 const call=handler(async()=>({version:'4.2.5',buildId:'b'.repeat(64)}));
 const result=await call();assert.equal(result.body.running.buildId,identity);assert.equal(result.body.matches,false);
 assert.equal((await call('POST')).status,405);
 assert.equal((await handler(async()=>{throw Error('missing');})()).status,503);
});
test('activation needs matching version AND identity, not host applied or a matches flag',async()=>{
 const check=(data)=>api.verifyRuntimeInstallation('4.2.5',{attempts:1,fetcher:async()=>({ok:true,json:async()=>data})});
 assert.equal(await check({matches:true,running:{version:'4.2.5',buildId:identity},installed:{version:'4.2.5',buildId:'b'.repeat(64)}}),false);
 assert.equal(await check({running:{version:'4.2.4',buildId:identity},installed:{version:'4.2.5',buildId:identity}}),false);
 assert.equal(await check({running:{version:'4.2.5'},installed:{version:'4.2.5'}}),false);
 assert.equal(await check({running:{version:'4.2.5',buildId:identity},installed:{version:'4.2.5',buildId:identity}}),true);
});
test('activation check bounds both fetch and response body stalls',async()=>{
 for(const fetcher of [()=>new Promise(()=>{}),async()=>({ok:true,json:()=>new Promise(()=>{})})]){
  assert.equal(await api.verifyRuntimeInstallation('4.2.5',{attempts:1,timeoutMs:5,fetcher}),false);
 }
});
