import assert from 'node:assert/strict';
import {test} from 'node:test';
import {api} from './module-test-api.mjs';
const h=(type,props,...children)=>({type,props,children});
test('chat AUTH uses actionable copy while all other failures retain the host renderer',()=>{
 const Original=()=>{};const hostT=()=>{};
 const Notice=api.createAuthNotice({h,Original,hostT,t:key=>({authNoticeTitle:'服务连接验证未通过',authNoticeHint:'请到 Harness 的模型设置检查当前 API密钥和中转地址',supportContact:'客服'}[key])});
 const rendered=Notice({node:{data:{code:'AUTH',message:'API 密钥无效'}}});
 const json=JSON.stringify(rendered);assert.match(json,/服务连接验证未通过/);assert.match(json,/Harness 的模型设置/);assert.doesNotMatch(json,/API 密钥无效/);
 for(const code of ['QUOTA','ACCOUNT_SIGNED_OUT','INTERRUPTED',undefined]){
  const node={data:{code,message:'host detail'}};const delegated=Notice({node,extra:1});
  assert.equal(delegated.type,Original);assert.equal(delegated.props.node,node);assert.equal(delegated.props.t,hostT);assert.equal(delegated.props.extra,1);
 }
});
test('工具参数不是合法 JSON 时给一句看得懂的说明，其他失败仍交给宿主',()=>{
 const Original=()=>{};
 const Notice=api.createAuthNotice({h,Original,hostT:()=>{},t:key=>({toolArgsNoticeTitle:'这一轮助手把工具参数写成了不合法的 JSON',toolArgsNoticeHint:'多半是 480p、16:9 这类值少了引号，本轮没有真正调用工具、也没有产生费用'}[key])});
 const message='Tool call "video_estimate": Expected \',\' or \'}\' after property value in JSON at position 34 (line 1 column 35) Received arguments: {"duration": 60, "resolution": 480p}';
 const rendered=Notice({node:{data:{code:undefined,message}}});
 const json=JSON.stringify(rendered);
 assert.match(json,/不合法的 JSON/);
 assert.match(json,/没有真正调用工具、也没有产生费用/);
 assert.match(json,/Expected ',' or /,'原始报错保留下来，方便核对');
 assert.match(json,/resolution/, '把原始报错一并显示，方便核对是哪次调用');
 for(const detail of ['host detail','rate limit exceeded','JSON 里写错了模型名']){
  const node={data:{code:undefined,message:detail}};
  assert.equal(Notice({node}).type,Original,`${detail} 仍用宿主原样展示`);
 }
});

test('authentication slot is reversible and missing host capabilities do not break the plugin',()=>{
 assert.equal(api.registerAuthNotice({slots:{}},h,()=>{}),undefined);
 let options,view;const dispose=()=>{};const Original=()=>{};
 const ctx={locale:{bind:()=>()=>{}},slots:{entriesOfSlot:()=>[{options:{key:'turn-error',priority:0},component:Original,locale:'chat'}],register:(o,v)=>{options=o;view=v;return dispose;}}};
 assert.equal(api.registerAuthNotice(ctx,h,()=>{}),dispose);assert.equal(options.key,'turn-error');assert.equal(options.priority,1);assert.equal(typeof view,'function');
});
test('HTTP 401 and 403 remain auth failures with friendly video-settings guidance, regardless of upstream wording',()=>{
 for(const status of [401,403]){
  const r=api.classifyError(status,{error:{message:'invalid API key quota_exceeded'}});
  assert.equal(r.code,'provider_auth');assert.match(r.message,new RegExp(String(status)));assert.match(r.message,/插件设置/);assert.match(r.message,/客服/);assert.doesNotMatch(r.message,/invalid API key|quota_exceeded/);
 }
});
