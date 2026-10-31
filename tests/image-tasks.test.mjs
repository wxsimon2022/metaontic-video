// Run with: node --test tests/image-tasks.test.mjs. Uses mocked fetch; no paid calls.
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const temp = await mkdtemp(path.join(tmpdir(), 'metaontic-image-test-'));
const previousHome = process.env.DSH_HOME;
process.env.DSH_HOME = temp;
try {
  const outfile = path.join(temp, 'plugin.mjs');
  await build({ stdin: { contents: "export {runTask} from './src/providers/seedance.ts'; export {prepareImageTool} from './src/tools/video-prepare-image.ts';", resolveDir: process.cwd() }, bundle: true, platform: 'node', format: 'esm', outfile });
  const { runTask, prepareImageTool } = await import(pathToFileURL(outfile).href);
  const config = (mode = 'metaontic', baseUrl = 'https://relay.example') => ({ connectionMode: mode, baseUrl, apiKey: 'a', keyOrigin: 'register', metaonticApiKey: 'b' });
  const videoBody = {model:'video',content:[{type:'text',text:'test'},{type:'image_url',image_url:{url:'https://example.com/original.png'},role:'first_frame'}]};
  async function scenario({mode='metaontic',allow='allowed-once',terminal=false,imageFailure=false,repeat=false,otherError=false,noApproval=false}={}) {
    let calls=[], asks=0, videoQueries=0;
    globalThis.fetch = async (url, options) => {
      const body = options.body ? JSON.parse(options.body) : null;
      calls.push({url,body,key:options.headers.Authorization});
      let data;
      if (url.endsWith('/v1/tasks/doubao')) data = {task_id:'image-task',status:'queued'};
      else if (url.endsWith('/v1/tasks/image-task/artifacts')) data = {artifacts:[{type:'text',content_url:'https://example.com/text'},{type:'image',content_url:'https://example.com/cartoon.png'}]};
      else if (url.endsWith('/v1/tasks/image-task')) data = imageFailure ? {status:'FAILED',fail_reason:'sensitive image'} : {status:'SUCCESS'};
      else if (body) {
        const count = calls.filter(c=>c.body?.model==='video').length;
        if ((count===1&&!terminal)||repeat) return new Response(JSON.stringify({error:{code:otherError?'ContentRejected':'InputImageSensitiveContentDetected.HumanFace',message:'rejected'}}),{status:400});
        data={id:'video-'+count};
      } else {
        videoQueries++;
        data=terminal&&videoQueries===1 ? {status:'failed',error:{code:'InputImageSensitiveContentDetected.HumanFace',message:'rejected'}} : {status:'succeeded',content:{video_url:'https://example.com/video.mp4'}};
      }
      return new Response(JSON.stringify(data),{status:200});
    };
    const ctx={get:()=>noApproval?undefined:{request:async()=>{asks++;return allow;}}};
    let result;
    try { result=await runTask(config(mode),structuredClone(videoBody),undefined,{ctx,exec:{agent:{}}}); }
    catch(error) {result={status:'failed',errorCode:error.code};}
    return {result,asks,calls,images:calls.filter(c=>c.url.endsWith('/tasks/doubao')),videos:calls.filter(c=>c.body?.model==='video')};
  }
  for(const mode of ['service','metaontic']) for(const terminal of [false,true]) {
    const x=await scenario({mode,terminal});
    assert.equal(x.result.status,'succeeded'); assert.equal(x.asks,1); assert.equal(x.images.length,1); assert.equal(x.videos.length,2);
    assert.deepEqual(x.images[0].body.image,['https://example.com/original.png']);
    assert.equal(x.images[0].body.size,'2048x2048'); assert.equal(x.images[0].body.n,1);
    assert.equal(x.images[0].key,mode==='service'?'Bearer a':'Bearer b');
    assert.equal(x.videos[1].body.content[1].image_url.url,'https://example.com/cartoon.png');
    assert.equal(x.videos[1].body.content[1].role,'first_frame');
    assert.ok(x.calls.every(c=>!c.url.includes('/images/generations')&&!c.url.includes('/tasks/doubao/')));
  }
  for(const options of [{allow:'rejected'},{allow:'cancelled'},{noApproval:true},{mode:'volcengine'},{otherError:true}]) {
    const x=await scenario(options); assert.equal(x.images.length,0); assert.equal(x.videos.length,1);
  }
  assert.equal((await scenario({imageFailure:true})).videos.length,1);
  const twice=await scenario({repeat:true}); assert.equal(twice.images.length,1); assert.equal(twice.videos.length,2);
  for(const model of ['doubao-seedream-5-0-260128','doubao-seedream-5-0-pro-260628']) {
    let urls=[];
    globalThis.fetch=async(url,options)=>{
      urls.push(url);
      if(options.body) {assert.equal(JSON.parse(options.body).model,model); return new Response(JSON.stringify({task_id:'saved'}));}
      return new Response(JSON.stringify(url.endsWith('/artifacts')?{artifacts:[{type:'image',content_url:'https://example.com/done.png'}]}:{status:'SUCCESS'}));
    };
    const tool=prepareImageTool({...config('metaontic','https://relay.example/v1'),imageModel:model});
    assert.equal((await tool.execute({image:'https://example.com/ref.png',style:'动画'},{})).taskId,'saved');
    assert.deepEqual(urls,['https://relay.example/v1/tasks/doubao','https://relay.example/v1/tasks/saved','https://relay.example/v1/tasks/saved/artifacts']);
    urls=[];
    await tool.execute({taskId:'saved'},{}); assert.equal(urls.length,2);
    globalThis.fetch=async()=>{throw new Error('network failed');};
    await assert.rejects(()=>tool.execute({taskId:'saved'},{}),/task_id=saved/);
    globalThis.fetch=async()=>new Response(JSON.stringify({status:'PROCESSING'}));
    const controller=new AbortController(); controller.abort();
    await assert.rejects(()=>tool.execute({taskId:'saved'},{signal:controller.signal}),/task_id=saved/);
  }
  console.log('PASS: async image protocol, models, A/B auth, base URL, resume/cancel/errors, explicit consent and bounded video retry');
} finally { if (previousHome === undefined) delete process.env.DSH_HOME; else process.env.DSH_HOME = previousHome; await rm(temp,{recursive:true,force:true}); }
