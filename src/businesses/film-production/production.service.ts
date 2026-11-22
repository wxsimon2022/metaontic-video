import { capabilityChannel,readCapabilityObservations } from '../video-generation/providers/capability-observations.js';
import { reportDigest } from './reviews/review.provenance.js';
import { sourceRevisions } from './contracts/index.js';
import { defineChapters, submitChapter } from './chapters/chapter.service.js';
import { independentReviewInput, runIndependentReview, reviewBatches, reviewCacheKey } from './reviews/independent-review.js';
import { presentChineseToolCall } from '../../shared/utils/tool-presentation.js';
import { channelCapabilities } from '../video-generation/providers/capabilities.js';
import { withFilmDiagnostics } from './validation/budget.validator.js';
import { productionDigest } from './production.binding.js';
import { hasContentProfile } from './profiles/profile.resolver.js';
import { approvalPreview } from './approvals/approval.presenter.js';
import { checkSubmission } from './contracts/submission.js';
import { projectResponse } from './production.responses.js';
import { resolveModel } from '../video-generation/providers/connection.js';
import { createProjectSpec, configureProfile } from './projects/project.service.js';
import { profileContext } from './profiles/index.js';
import { acquireProjectLock, inspectProjectLock, recoverProjectLock, pruneProjectSnapshots } from './projects/project.repository.js';
import { verifyIssue } from './reviews/issue.service.js';
import { recordApprovalDecision } from './approvals/approval.service.js';
import { artifactManifest, renderDeliverables } from './artifacts/artifact.repository.js';
import { INTENTS, routeIntent, roleInstructions } from './roles/index.js';
import { reviseEntities, scheduleTask, taskResult } from './artifacts/artifact.version.js';
import { nextTask, compileProduction } from './workflows/workflow.engine.js';
import { estimatePlan } from '../video-generation/workflow/costs.js';
import { createProject, writeProject } from '../video-generation/workflow/project.js';
import { randomUUID, createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, rename, rm } from 'node:fs/promises';
import path from 'node:path';
import { dshHome } from '../video-generation/media/references.js';
import { DATA_DIR } from '../../shared/constants/plugin.js';
import { sessionOwner } from '../video-generation/workflow/project.js';
import { STAGES, commitArtifact } from './artifacts/artifact.service.js';
import { FILM_WORKFLOW_GUIDANCE, ORCHESTRATION_GUIDANCE, INTENT_GUIDANCE, PRODUCTION_STRATEGY_GUIDANCE } from './prompts/guidance.js';
import type { BusinessModule } from '../../app/bootstrap.js';
const locks = new Set<string>();
export const filmDirectorBusiness: BusinessModule = {
  id: 'film-director',
  prompt: () => roleInstructions({duration_ms:0},'director') + FILM_WORKFLOW_GUIDANCE + ORCHESTRATION_GUIDANCE + INTENT_GUIDANCE + PRODUCTION_STRATEGY_GUIDANCE,
  apply(runtime) {
    runtime.tools.register('film-director', withFilmDiagnostics({
      name: 'film_project', description: '专业创作项目：create/read/validate/submit/approve/export。正常推进用responseMode:"compact"，submit已内置完整校验，失败集中返回字段问题，无需每稿先validate再submit。validate仅供单独检查，不保存或审批。磁盘保存，创意与剧本由approve工具直接弹窗人工批准，不要先用ask_user_question重复确认；批准后立即按nextTask继续并提交剧本。中断恢复read原项目，沿用已批准版本。不提交付费视频。submit的content为JSON字符串：creative含theme/logline；script含characters/chapters/scenes/dialogue，正文由结构化数据生成；assets必须含characters/scenes/locations/scene_states/props五个数组（无道具明确props:[]）；shots含shots；prompts含prompts；新项目最终审核用independent_review独立文本请求（弹窗确认文本费用），不能submit自评替代；长片按nextTask的chapter_plan/chapter_submit逐章保存，content为本章JSON、continuity为连续性JSON；capabilities读取渠道能力，review_context只读审核上下文；export返回可读Markdown及版本校验清单。',
      presentCall(args) { return presentChineseToolCall('film_project', args); },
      parameters: { type:'object', properties: {
        responseMode:{type:'string',enum:['compact','full'],description:'写操作默认compact：仅返回项目摘要与下一阶段完整必要材料，减少重复上下文；read默认full，完整恢复也可显式选full。read配合stage可只读单阶段产物。'},
        intent:{type:'string',enum:[...INTENTS]}, entityIds:{type:'array',items:{type:'string'}},
        projectSpec:{type:'string',description:'create可选项目规格JSON：work_type（DRAMA/COMEDY/LIFESTYLE/DOCUMENTARY/COMMERCIAL/PROMOTIONAL）、narrative_mode（FICTION/OBSERVATIONAL/EXPLANATORY/DEMONSTRATION/POETIC/MIXED）、genre/format/purpose/style_profile/tone/aspect_ratio/resolution/language/visual_style/target_audience/distribution_channel/target_model/hard_constraints/soft_preferences/references。production_strategy可选continuous_segments/independent_shots（必须先说明费用与连续性差异并获用户选择）。configure_profile可增量传change_scope（visual_only仅视觉/光色/演绎基调且不改故事，story需要重审创意剧本；tone未明确范围默认重审）、production_strategy、work_type、narrative_mode、genre、format、purpose、style_profile、tone、visual_style、target_model；target_model必须是真实模型ID（读取execution_plan.model_name），不得写占位文字；仅改模型保留创意剧本批准并重审资产、分镜、提示词和审核；四维注册选项通过read/next的resolved_profiles.available_profiles读取，genre等使用小写id；修改会失效已有产物并重新审批；类型不同于风格和生成模式，不猜测用户确认。配置修订由运行时固定。'}, issueId:{type:'string'}, taskKey:{type:'string'}, taskStatus:{type:'string',enum:['running','completed','failed']}, errorCode:{type:'string'},
        ratio:{type:'string',enum:['16:9','9:16']}, resolution:{type:'string',enum:['480p','720p']},
        chapterId:{type:'string',description:'章节任务返回的稳定chapter_id；chapter_submit配合stage与content提交本章'},
        continuity:{type:'string',description:'章节连续性JSON：established_facts数组、unresolved_threads数组、character_state对象；仅保存已确立信息'},
        action:{type:'string',enum:['create','read','validate','submit','approve','export','next','compile','revise','schedule','task_result','route','verify_issue','configure_profile','diagnose','recover_lock','chapter_plan','chapter_submit','review_context','independent_review','capabilities']}, projectId:{type:'string'}, title:{type:'string'}, sourceBrief:{type:'string'}, durationSeconds:{type:'integer'}, stage:{type:'string',enum:[...STAGES]}, content:{type:'string'}, expectedRevision:{type:'integer'},
      }, required:['action'] },
      output:{schema:{type:'object'},render(_args,value){return [{type:'text',text:JSON.stringify(value)}];}},
      isConcurrencySafe(){return false;},
      async execute(args,exec) {
        const owner = sessionOwner(exec);
        const id = args.action === 'create' ? randomUUID() : args.projectId;
        if (!/^[a-f0-9-]{36}$/.test(id || '')) throw Error('INVALID_PROJECT_ID');
        const readonly=['read','next','route','validate','export','diagnose','review_context','capabilities'].includes(args.action);
        if (!readonly && locks.has(id)) throw Error('PROJECT_BUSY');
        if(!readonly)locks.add(id);
        let release;
        try {
          const dir = path.join(dshHome(),DATA_DIR,'film-projects',owner,id);
          const file = path.join(dir,'project.json');
          await mkdir(dir,{recursive:true,mode:0o700});
          if(args.action==='diagnose')return {lock:await inspectProjectLock(dir),instructions:'活跃锁不恢复；仅明确死亡的同机进程可recover_lock。read不取写锁，可读取最后完整提交。'};
          if(args.action==='recover_lock')return recoverProjectLock(dir);
          if(!['read','next','route','validate','export','review_context','capabilities'].includes(args.action))release=await acquireProjectLock(dir);
          let state;
          if (args.action === 'create') {
            if (!Number.isInteger(args.durationSeconds) || args.durationSeconds<15 || args.durationSeconds>3600 || !args.title?.trim() || !args.sourceBrief?.trim()) throw Error('INVALID_REQUIREMENTS');
            state={script_policy:'canonical_v1',chapter_policy:'chapter_v1',review_policy:'isolated_v1',capability_channel:capabilityChannel(runtime.config),quality_policy:'evidence_v1',schema_version:'3.1.0',project_id:id,title:args.title,source_brief:args.sourceBrief,duration_ms:args.durationSeconds*1000,project_spec:createProjectSpec(args.title,args.sourceBrief,args.durationSeconds*1000,args.projectSpec?JSON.parse(args.projectSpec):{...(args.ratio?{aspect_ratio:args.ratio}:{}),...(args.resolution?{resolution:args.resolution}:{})}),revision:0,status:'REQUIREMENT_ANALYSIS',artifacts:{},approvals:{},decisions:[]};
          } else state=JSON.parse(await readFile(file,'utf8'));
          const originalState=JSON.stringify(state);
          const executionContext=()=>{
            try {
              let cursor=0;
              const independent=state.project_spec?.production_strategy==='independent_shots';
              const segments=independent?(state.artifacts.shots?.data.shots||[]).map(s=>({kind:'generate',start_ms:s.start_ms,end_ms:s.end_ms,duration_ms:s.duration_ms})):estimatePlan(runtime.config,'video_generate',{duration:state.duration_ms/1000}).map(part=>{const start=cursor;cursor+=part.seconds*1000;return {kind:part.kind,start_ms:start,end_ms:cursor,duration_ms:part.seconds*1000};});
              return {model_name:resolveModel(runtime.config),strategy:state.project_spec?.production_strategy || 'continuous_segments',segments,instructions:independent?'独立镜头：每镜独立生成与计费，每镜4秒至模型上限的整秒；可跨地点剪辑，不要求连续分段边界。人物一致性依赖参考图，未提交分镜时segments为空。':'连续续拍预规划：分镜不得跨生成段截断动作与对白，同一生成段多地点需重新规划；这不是付费调用或画面效果验证。'};
            } catch {return {capability_status:'UNVERIFIED',instructions:'当前执行分段无法预规划；可继续创意与剧本，分镜提交前须确认实际制作模型和分段边界。'};}
          };
          const channel=capabilityChannel(runtime.config);
          const observations=await readCapabilityObservations();
          const channelChanged=!!state.capability_channel&&state.capability_channel!==channel;
          const currentCapabilities=()=>channelCapabilities(state.project_spec?.target_model||resolveModel(runtime.config),channel,observations);
          const taskFor=()=>{const task:any=nextTask(state);return {...task,...(task.model_profile?{model_profile:currentCapabilities()}:{}),execution_plan:executionContext(),channel_changed:channelChanged};};

          if(args.action==='capabilities')return currentCapabilities();
          if(args.action==='review_context')return {...independentReviewInput(state),status:'READY_NOT_EXECUTED'};
          if (args.action === 'read') {
            if(args.stage) {
              if(!STAGES.includes(args.stage))throw Error('INVALID_STAGE');
              return {project_id:id,revision:state.revision,status:state.status,stage:args.stage,artifact:state.artifacts[args.stage]||null,approvals:state.approvals};
            }
            return projectResponse(state,taskFor(),args.responseMode,{work_profile:profileContext(state)});
          }
          if (args.action === 'validate') {
            if(!STAGES.includes(args.stage))throw Error('INVALID_STAGE');
            return checkSubmission(state,args.stage,args.content);
          }
          if (args.action === 'next') return taskFor();
          if (args.action === 'route') return {...routeIntent(state,args.intent,args.entityIds),model_profile:currentCapabilities(),execution_plan:executionContext()};
          if (['revise','schedule','task_result','verify_issue','configure_profile','chapter_plan','chapter_submit','independent_review'].includes(args.action) && state.revision!==args.expectedRevision) throw Error('REVISION_CONFLICT');
          if(args.action==='chapter_plan')state=defineChapters(state,JSON.parse(args.content),args.expectedRevision);
          if(args.action==='chapter_submit')state=submitChapter(state,args.stage,args.chapterId,JSON.parse(args.content),JSON.parse(args.continuity||'null'),args.expectedRevision);
          if(['independent_review','compile'].includes(args.action)&&channelChanged)throw Error('CHANNEL_CHANGED_RECONFIGURE_PROFILE:渠道地址已变化，调用configure_profile确认当前target_model并重新审核资产与分镜');
          if(args.action==='independent_review') {
            const checkpointFile=path.join(dir,'review-checkpoints.json');
            let cache:any={};
            try{cache=JSON.parse(await readFile(checkpointFile,'utf8'));}catch(error:any){if(error.code!=='ENOENT')throw Error('REVIEW_CHECKPOINT_UNREADABLE');}
            const reviewRequests=reviewBatches(state).filter(b=>!cache[reviewCacheKey(runtime.config,b)]).length;
            if(reviewRequests>0) {
            const service=runtime.ctx.get?.('userQuestions') || (exec.agent as any)?.ctx?.get?.('userQuestions');
            if(!service?.ask)return {status:'needs_input',reason:'独立文本审核需要确认文本模型调用费用；确认服务不可用'};
            const answer=await service.ask({agent:exec.agent,signal:exec.signal,questions:[{id:'independent_review_cost',header:'独立审核',question:`使用当前文本模型，预计${reviewRequests}次文本请求，在不带聊天历史的独立上下文审核当前创作方案。文本调用按渠道计费；不生成视频、不替代创意/剧本批准或视频费用确认。是否执行？`,multiSelect:false,options:[{label:'执行独立审核',description:'同意本次文本模型调用费用'},{label:'暂不执行',description:'保留已有创作进度，不发起文本调用'}]}]});
            const decision=answer?.answers?.find(a=>a.id==='independent_review_cost');
            if(exec.signal?.aborted||decision?.custom||decision?.selected?.length!==1||decision.selected[0]!=='执行独立审核')return {status:'needs_input',reason:'未授权独立文本审核，未调用模型'};
            }
            const report=await runIndependentReview(runtime.config,state,{signal:exec.signal,cache,onCheckpoint:async(key,report)=>{
              cache[key]=report;
              cache=Object.fromEntries(Object.entries(cache).slice(-64));
              const temp=path.join(dir,`${randomUUID()}.tmp`);
              try{await writeFile(temp,JSON.stringify(cache),{mode:0o600,flag:'wx'});await rename(temp,checkpointFile);}finally{await rm(temp,{force:true}).catch(()=>{});}
            }});
            state.independent_review_receipt={input_revisions:sourceRevisions(state,'review'),report_digest:reportDigest(report)};
            state=commitArtifact(state,'review',report,state.revision);
          }
          if (args.action === 'configure_profile') {
            state=configureProfile(state,JSON.parse(args.projectSpec),args.expectedRevision);
            if(channelChanged){if(state.revision===args.expectedRevision)state.revision++;state.capability_channel=channel;for(const stage of ['assets','shots','prompts','review'])if(state.artifacts[stage])state.artifacts[stage].stale=true;state.status='ASSET_DESIGN';}
          }
          if (args.action === 'revise') state=reviseEntities(state,args.stage,JSON.parse(args.content),args.expectedRevision);
          if (args.action === 'schedule') scheduleTask(state,taskFor());
          if (args.action === 'verify_issue') verifyIssue(state,args.issueId,JSON.parse(args.content));
          if (args.action === 'task_result') taskResult(state,args.taskKey,args.taskStatus,args.errorCode);
          if (args.action === 'compile') {
            if (state.revision!==args.expectedRevision) throw Error('REVISION_CONFLICT');
            if(state.project_spec?.target_model && state.project_spec.target_model!=='generic' && state.project_spec.target_model!==resolveModel(runtime.config)) throw Error('PROJECT_SPEC_MISMATCH:target_model。项目模型与当前制作配置不同；先 read 查看 execution_plan.model_name，再用 configure_profile 的 projectSpec.target_model 更新项目并重审模型相关材料；若要改实际调用模型，请到插件设置。不要填写占位文字或直接修改项目文件。');
            const plan=compileProduction(state,estimatePlan(runtime.config,'video_generate',{duration:state.duration_ms/1000}),args.ratio,args.resolution,currentCapabilities());
            if(state.production?.source_revision===state.revision && state.production.model_name && state.production.model_name!==resolveModel(runtime.config))throw Error('MODEL_CHANGED_RECOMPILE:请configure_profile明确当前target_model并重审模型相关材料。');
            if (!state.production || state.production.source_revision!==state.revision || state.production.ratio!==args.ratio || state.production.resolution!==args.resolution || !state.production.plan_digest) {
              const project:any=await createProject(exec,state.artifacts.assets.data.characters.length?'fixed_subject':'scenery');
              project.duration=state.duration_ms/1000;
              project.filmSource={path:file,revision:state.revision,plan_digest:productionDigest(plan.specification),model_name:resolveModel(runtime.config)};
              await writeProject(project);
              state.production={...plan,model_name:resolveModel(runtime.config),plan_digest:productionDigest(plan.specification),videoProjectId:project.id};
            }
          }
          if (args.action === 'export') return { project:state, markdown:renderDeliverables(state), manifest:artifactManifest(state), status:state.status };
          if (args.action === 'submit') {
            if(state.revision!==args.expectedRevision)throw Error('REVISION_CONFLICT');
            if(!STAGES.includes(args.stage))throw Error('INVALID_STAGE');
            if(state.chapter_policy==='chapter_v1'&&state.duration_ms>=600000&&['script','shots','prompts'].includes(args.stage))throw Error('CHAPTER_SUBMIT_REQUIRED:长片请按nextTask使用chapter_plan/chapter_submit，逐章保存再汇总');
            try {state=commitArtifact(state,args.stage,JSON.parse(args.content),args.expectedRevision);}
            catch(error) {
              const check=checkSubmission(state,args.stage,args.content);
              if(!check.valid)throw Error(`${check.error_code}: ${check.issues.map(i=>`${i.path}：${i.message}`).join('；')}`);
              throw error;
            }
          }
          if (args.action === 'approve') {
            const artifact=state.artifacts[args.stage];
            if (!['creative','script'].includes(args.stage) || !artifact || artifact.stale || state.revision!==args.expectedRevision) throw Error('INVALID_APPROVAL_REVISION');
            if(state.approvals?.[args.stage]===artifact.revision)return projectResponse(state,taskFor(),args.responseMode||'compact');
            if(args.stage==='creative'&&state.project_spec&&Object.hasOwn(state.project_spec,'work_type')&&!hasContentProfile(state.project_spec))throw Error('WORK_TYPE_REQUIRED_BEFORE_APPROVAL');
            const service=runtime.ctx.get?.('userQuestions') || (exec.agent as any)?.ctx?.get?.('userQuestions');
            if (!service?.ask) return {status:'needs_input',reason:'人工确认服务不可用'};
            const answer=await service.ask({agent:exec.agent,signal:exec.signal,questions:[{id:'film_approval',header:'创作审核',question:approvalPreview(args.stage,artifact),multiSelect:false,options:[{label:'批准本版',description:'继续下一创作阶段'},{label:'需要修改',description:'保留草稿并修改'},{label:'拒绝当前方案',description:'停止当前创作流程，保留已有资料'}]}]});
            const decision=answer?.answers?.find(a=>a.id==='film_approval');
            if (exec.signal?.aborted || decision?.custom || decision?.selected?.length!==1 || !['批准本版','需要修改','拒绝当前方案'].includes(decision.selected[0])) return {status:'needs_input',projectId:id};
            state=recordApprovalDecision(state,args.stage,{'批准本版':'APPROVED','需要修改':'REVISE','拒绝当前方案':'REJECTED'}[decision.selected[0]],args.expectedRevision);
          }
          if (!['create','submit','approve','compile','revise','schedule','task_result','verify_issue','configure_profile','chapter_plan','chapter_submit','independent_review'].includes(args.action)) throw Error('INVALID_ACTION');
          if(args.action!=='create' && originalState===JSON.stringify(state))return projectResponse(state,taskFor(),args.responseMode||'compact');
          await mkdir(path.join(dir,'snapshots'),{recursive:true,mode:0o700});
          const body=JSON.stringify(state,null,2);
          // 不可变快照先写入，project.json原子替换为唯一提交点；中断遗留快照不代表提交。
          await writeFile(path.join(dir,'snapshots',`${state.revision}-${randomUUID()}.json`),body,{mode:0o600,flag:'wx'});
          const temp=path.join(dir,`${randomUUID()}.tmp`);
          try {await writeFile(temp,body,{mode:0o600,flag:'wx'}); await rename(temp,file);}finally{await rm(temp,{force:true}).catch(()=>{});}
          await pruneProjectSnapshots(dir,state).catch(()=>{});
          return projectResponse(state,taskFor(),args.responseMode||'compact',{sha256:createHash('sha256').update(body).digest('hex')});
        } finally {try{if(release)await release();}finally{if(!readonly)locks.delete(id);}}
      },
    }));
  },
};
