import './no-network-analytics.mjs';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {mkdtemp,rm} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import * as plugin from '../dist/index.js';

test('an existing prompt registration reads current configuration on each request', async () => {
 const dir=await mkdtemp(path.join(os.tmpdir(),'meta-prompt-'));const prior=process.env.DSH_HOME;
 process.env.DSH_HOME=dir;
 let section;let dispose;const tools=new Map();
 try {
  const config={model:'seedance-2-0-mini'};
  dispose=plugin.apply({tools:{register(tool){tools.set(tool.name,tool);return()=>{};}},on:()=>()=>{},inject(names,install){
   if(names.includes('systemPrompt'))return install({systemPrompt:{section(value){section=value;return()=>{};}}});
  }},config);
  const director={agent:{session:{header:{agentPreset:'video-director'}}}};
  assert.equal(typeof section.text,'function');
  assert.match(section.text(director),/总时长 ≤ 15 秒/);
  const prompt=section.text(director);
  assert.match(prompt,/完善创意的同一轮用ask_user_question合并询问所有缺失信息/);
  assert.match(prompt,/等用户回答后才调用video_project/);
  assert.match(prompt,/15秒、30秒、45秒、60秒和“自定义时长”/);
  assert.doesNotMatch(prompt,/需求阶段先调用video_project|用video_project\(action:prepare\)省略duration/);
  assert.match(prompt,/禁止省略已确认值导致工具重复提问/);
  assert.match(prompt,/无论创意是否完整/);
  assert.match(prompt,/用户创意原文已写明时长、横竖屏或分辨率时，直接记录对应值/);
  assert.match(prompt,/这三项都不出现在提问中/);
  assert.doesNotMatch(prompt,/地址、时长等/);
  assert.match(prompt,/不得借完善另起创意/);
  assert.match(prompt,/工具参数必须是合法 JSON/);
  assert.match(prompt,/把 480p、16:9 这类枚举值裸写（不加引号）会让本轮调用在解析参数时就失败/);
  assert.match(prompt,/按原参数补齐引号重试一次/);
  assert.doesNotMatch(prompt,/完整方案不增加完善询问|不完善且尚未授权时/);
  assert.equal(section.text({}),'');
  assert.equal(section.text({agent:{session:{header:{agentPreset:null}}}}),'');
  config.model='seedance-2.5';assert.match(section.text(director),/总时长 ≤ 30 秒/);
  const current={agent:{session:{id:'prompt-scope-current',header:{agentPreset:'video-director',cwd:dir}}}};
  const other={agent:{session:{id:'prompt-scope-other',header:{agentPreset:'video-director',cwd:dir}}}};
  const before=section.text(current);
  const created=await tools.get('film_project').execute({action:'create',title:'沙葱',sourceBrief:'观察沙葱从沙地到饭桌',durationSeconds:30,responseMode:'compact'},current);
  const creationPrompt=section.text(current);
  assert.ok(creationPrompt.length<before.length*0.65,'专业创作不重复携带完整制作及导演角色规则');
  assert.doesNotMatch(creationPrompt,/【分镜图必须实际可见】|· 真人图生视频：|· 续拍估价口径：|# Director Agent/);
  assert.match(creationPrompt,/用户提出修改先改稿/);
  assert.equal(section.text(other),before,'会话之间不串阶段');
  await assert.rejects(tools.get('film_project').execute({action:'compile',projectId:created.project_id,expectedRevision:created.revision,ratio:'16:9',resolution:'720p'},current));
  assert.equal(section.text(current),creationPrompt,'失败的编译不切换阶段');
  await tools.get('video_project').execute({action:'prepare',subjectType:'scenery',duration:30},current);
  assert.match(section.text(current),/· 续拍估价口径：/,'进入制作后恢复制作规则');
  await tools.get('film_project').execute({action:'read',projectId:created.project_id,responseMode:'compact'},current);
  assert.equal(section.text(current),creationPrompt,'恢复创作项目后重新加载创作规则');
 }finally{dispose?.();if(prior===undefined)delete process.env.DSH_HOME;else process.env.DSH_HOME=prior;await rm(dir,{recursive:true,force:true});}
});

