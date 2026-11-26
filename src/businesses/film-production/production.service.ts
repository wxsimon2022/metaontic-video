import { FILM_ACTIONS, READ_ACTIONS, parseFilmCommand } from './contracts/commands.js';
import { createFilmPresentationGuard } from './approvals/presentation.guard.js';
import { creationIdentity, readJson, atomicJson, journaledReview, reviewRequestSummary, authorizeReviewRetry } from './projects/operation.repository.js';
import { bindCompiledProject } from './workflows/compile.handler.js';
import { boundedTask, scopedInputs } from './roles/context.composer.js';
import { capabilityChannel,readCapabilityObservations } from '../video-generation/providers/capability-observations.js';
import { reportDigest } from './reviews/review.provenance.js';
import { sourceRevisions } from './contracts/index.js';
import { defineChapters, submitChapter } from './chapters/chapter.service.js';
import { independentReviewInput, runIndependentReview } from './reviews/independent-review.js';
import { presentChineseToolCall } from '../../shared/utils/tool-presentation.js';
import { channelCapabilities } from '../video-generation/providers/capabilities.js';
import { withFilmDiagnostics } from './validation/budget.validator.js';
import { hasContentProfile } from './profiles/profile.resolver.js';
import { approvalPreview, approvalPage } from './approvals/approval.presenter.js';
import { checkSubmission } from './contracts/submission.js';
import { projectResponse } from './production.responses.js';
import { resolveModel } from '../video-generation/providers/connection.js';
import { createProjectSpec, configureProfile } from './projects/project.service.js';
import { profileContext } from './profiles/index.js';
import { acquireProjectLock, inspectProjectLock, recoverProjectLock, pruneProjectSnapshots } from './projects/project.repository.js';
import { verifyIssue } from './reviews/issue.service.js';
import { recordApprovalDecision } from './approvals/approval.service.js';
import { artifactManifest, renderDeliverables } from './artifacts/artifact.repository.js';
import { INTENTS, routeIntent } from './roles/index.js';
import { reviseEntities, scheduleTask, taskResult } from './artifacts/artifact.version.js';
import { nextTask, compileProduction } from './workflows/workflow.engine.js';
import { estimatePlan } from '../video-generation/workflow/costs.js';
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
  prompt: (_config, scope) => FILM_WORKFLOW_GUIDANCE + INTENT_GUIDANCE + (scope === 'creation' ? '' : ORCHESTRATION_GUIDANCE + PRODUCTION_STRATEGY_GUIDANCE),
  apply(runtime) {
    const presentation = createFilmPresentationGuard();
    const dispose = runtime.ctx.on?.('session/event', presentation.observe);
    if (typeof dispose === 'function') runtime.defer?.(dispose);
    runtime.tools.register('film-director', withFilmDiagnostics({
      name: 'film_project', description: '专业创作项目：create/read/validate/submit/approve/export。除create外每次调用都必须在参数顶层传projectId，复制返回的project_id，content内部project_id不能替代。正常推进用responseMode:"compact"，submit已内置完整校验，失败集中返回字段问题，无需每稿先validate再submit。validate仅供单独检查，不保存或审批。相同创意或剧本重复提交保持原版本和审批，不产生新版本。磁盘保存，创意与剧本由approve工具直接弹窗人工批准，不要先用ask_user_question重复确认；批准后立即按nextTask继续并提交剧本。中断恢复read原项目，沿用已批准版本。不提交付费视频。submit的content为JSON字符串：creative含theme/logline；script含characters/chapters/scenes/dialogue，正文由结构化数据生成；assets必须含characters/scenes/locations/scene_states/props五个数组（无道具明确props:[]）；shots含shots；prompts含prompts；新项目最终审核用independent_review独立文本请求（使用插件文本模型，不另弹文本费用审批），不能submit自评替代；长片按nextTask的chapter_plan/chapter_submit逐章保存，content为本章JSON、continuity为连续性JSON；capabilities读取渠道能力，review_context只读审核上下文；export返回可读Markdown及版本校验清单。',
      presentCall(args) { return presentChineseToolCall('film_project', args); },
      parameters: { type:'object', properties: {
        materialPart:{type:'integer',minimum:1,description:'长创意或剧本正文分页，按approval_material.parts顺序读取和展示。'},
        responseMode:{type:'string',enum:['compact','full'],description:'写操作默认compact：仅返回项目摘要与下一阶段完整必要材料，减少重复上下文；read默认full，完整恢复也可显式选full。read配合stage可只读单阶段产物。'},
        intent:{type:'string',enum:[...INTENTS]}, entityIds:{type:'array',items:{type:'string'}},
        projectSpec:{type:'string',description:'create可选项目规格JSON：work_type（DRAMA/COMEDY/LIFESTYLE/DOCUMENTARY/COMMERCIAL/PROMOTIONAL）、narrative_mode（FICTION/OBSERVATIONAL/EXPLANATORY/DEMONSTRATION/POETIC/MIXED）、genre/format/purpose/style_profile/tone/aspect_ratio/resolution/language/visual_style/target_audience/distribution_channel/target_model/hard_constraints/soft_preferences/references。其中hard_constraints、soft_preferences、references必须为字符串数组，例如{"hard_constraints":["保留用户原台词"]}；无内容用[]或省略，其余列出的规格为字符串。production_strategy可选continuous_segments/independent_shots（必须先说明费用与连续性差异并获用户选择）。configure_profile可增量传change_scope（visual_only仅视觉/光色/演绎基调且不改故事，story需要重审创意剧本；tone未明确范围默认重审）、production_strategy、work_type、narrative_mode、genre、format、purpose、style_profile、tone、visual_style、target_model；target_model必须是真实模型ID（读取execution_plan.model_name），不得写占位文字；仅改模型保留创意剧本批准并重审资产、分镜、提示词和审核；四维注册选项通过read/next的resolved_profiles.available_profiles读取，genre等使用小写id；修改会失效已有产物并重新审批；类型不同于风格和生成模式，不猜测用户确认。配置修订由运行时固定。'}, operationId:{type:'string',description:'创建项目的稳定操作标识；重试沿用原值，明确创建另一项目时使用新值。不填时同会话同需求复用。'}, requestKey:{type:'string',description:'review_requests返回的请求摘要，仅retry_review使用。'}, issueId:{type:'string'}, taskKey:{type:'string'}, taskStatus:{type:'string',enum:['running','completed','failed']}, errorCode:{type:'string'},
        ratio:{type:'string',enum:['16:9','9:16']}, resolution:{type:'string',enum:['480p','720p']},
        chapterId:{type:'string',description:'章节任务返回的稳定chapter_id；chapter_submit配合stage与content提交本章'},
        continuity:{type:'string',description:'chapter_submit必填，传JSON字符串：established_facts数组、unresolved_threads数组、character_state对象；仅保存已确立信息'},
        action:{type:'string',enum:[...FILM_ACTIONS]}, projectId:{type:'string',description:'除create外所有动作必填；直接复制最近返回的project_id，放在工具参数顶层，content内部project_id不能替代。不编造、不默认另建项目。'}, title:{type:'string'}, sourceBrief:{type:'string'}, durationSeconds:{type:'integer',minimum:15,maximum:3600,description:'create必填，用户已确认的总时长，15–3600整数秒。'}, stage:{type:'string',enum:[...STAGES],description:'submit/validate/revise/approve/chapter_submit必填；approve仅creative或script，chapter_submit仅script/shots/prompts。'}, content:{type:'string',description:'合法JSON字符串：submit/verify_issue传对象，chapter_submit传当前章对象；revise传操作数组，chapter_plan传章节数组[{chapter_id,title,duration_ms}]，不能包在对象中。validate可传待检稿。configure_profile改用projectSpec。'}, expectedRevision:{type:'integer',minimum:0,description:'除create/recover_lock外写操作必填；复制最新工具返回的项目revision或expectedRevision，不是材料修订号，不默认0。'},
      }, required:['action'] },
      output:{schema:{type:'object'},render(_args,value){return [{type:'text',text:JSON.stringify(value)}];}},
      isConcurrencySafe(){return false;},
      async execute(rawArgs,exec) {
        const args = parseFilmCommand(rawArgs);
        const owner = sessionOwner(exec);
        const creation = args.action === 'create' ? creationIdentity(owner, args) : null;
        const id = creation?.id || args.projectId;
        const respond = (state, task, mode?, extra?) => {
          presentation.remember(exec?.agent?.session, state);
          const result=projectResponse(state,boundedTask(task),mode,extra);
          const material=result.approval_material ? approvalPage(result.approval_material.stage,state.artifacts[result.approval_material.stage],args.materialPart || 1) : {};
          const response={...result,...material};
          return JSON.stringify(response).length<=80000 ? response : {...boundedTask({...response,inputs:state.artifacts}),...material,revision:state.revision};
        };
        if (!/^[a-f0-9-]{36}$/.test(id || '')) throw Error('INVALID_PROJECT_ID');
        const readonly=READ_ACTIONS.includes(args.action);
        if (!readonly && locks.has(id)) throw Error('PROJECT_BUSY');
        if(!readonly)locks.add(id);
        let release;
        try {
          const dir = path.join(dshHome(),DATA_DIR,'film-projects',owner,id);
          const file = path.join(dir,'project.json');
          await mkdir(dir,{recursive:true,mode:0o700});
          if(args.action==='diagnose')return {lock:await inspectProjectLock(dir),instructions:'活跃锁不恢复；仅明确死亡的同机进程可recover_lock。read不取写锁，可读取最后完整提交。'};
          if(args.action==='recover_lock')return recoverProjectLock(dir);
          if(!readonly)release=await acquireProjectLock(dir);
          let state;
          if (args.action === 'create') {
            const existing = await readJson<any>(file, null);
            if (existing) {
              if (existing.creation_digest !== creation.digest) throw Error('OPERATION_ID_CONFLICT');
              return respond(existing, nextTask(existing), args.responseMode || 'compact', { reused: true });
            }
            if (!Number.isInteger(args.durationSeconds) || args.durationSeconds<15 || args.durationSeconds>3600 || !args.title?.trim() || !args.sourceBrief?.trim()) throw Error('INVALID_REQUIREMENTS');
            state={creation_digest:creation.digest,script_policy:'canonical_v1',chapter_policy:'chapter_v1',review_policy:'isolated_v1',capability_channel:capabilityChannel(runtime.config),quality_policy:'evidence_v1',schema_version:'3.1.0',project_id:id,title:args.title,source_brief:args.sourceBrief,duration_ms:args.durationSeconds*1000,project_spec:createProjectSpec(args.title,args.sourceBrief,args.durationSeconds*1000,args.projectSpec?JSON.parse(args.projectSpec):{...(args.ratio?{aspect_ratio:args.ratio}:{}),...(args.resolution?{resolution:args.resolution}:{})}),revision:0,status:'REQUIREMENT_ANALYSIS',artifacts:{},approvals:{},decisions:[]};
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
          const taskFor=()=>{const task:any=nextTask(state);return boundedTask({...task,...(task.model_profile?{model_profile:currentCapabilities()}:{}),execution_plan:executionContext(),channel_changed:channelChanged});};

          if(args.action==='capabilities')return currentCapabilities();
          const requestFile = path.join(dir, 'review-requests.json');
          if(args.action==='review_requests')return {project_id:id,requests:await reviewRequestSummary(requestFile)};
          if(args.action==='retry_review') {
            if(state.revision!==args.expectedRevision)throw Error('REVISION_CONFLICT');
            const requests=await reviewRequestSummary(requestFile);
            if(!requests.some(item=>item.key===args.requestKey))throw Error('REVIEW_REQUEST_NOT_FOUND');
            if(exec.signal?.aborted)throw Error('文本审核重试已取消。');
            const checkpointFile=path.join(dir,'review-checkpoints.json');
            const checkpoint=await readJson<Record<string,any>>(checkpointFile,{});
            delete checkpoint[args.requestKey];
            await atomicJson(checkpointFile,checkpoint);
            await authorizeReviewRetry(requestFile,args.requestKey);
            return {status:'prepared',next_action:'independent_review',reason:'已准备重新请求该项文本审核，其他成功审核仍复用。'};
          }
          if(args.action==='review_context')return boundedTask({action:'review_context',...independentReviewInput(state),status:'READY_NOT_EXECUTED',project_id:id,expectedRevision:state.revision});
          if (args.action === 'read') {
            if(args.stage) {
              if(!STAGES.includes(args.stage))throw Error('INVALID_STAGE');
              presentation.remember(exec?.agent?.session,state);
              if(args.entityIds?.length) return boundedTask({action:'read',project_id:id,stage:args.stage,revision:state.revision,expectedRevision:state.revision,complete:false,inputs:scopedInputs(state,args.stage,'director',args.entityIds)});
              const material=approvalPage(args.stage,state.artifacts[args.stage],args.materialPart || 1);
              const result={project_id:id,revision:state.revision,status:state.status,stage:args.stage,artifact:state.artifacts[args.stage]||null,...material,approvals:state.approvals};
              return JSON.stringify(result).length<=80000 ? result : {...boundedTask({action:'read',stage:args.stage,project_id:id,expectedRevision:state.revision,inputs:{[args.stage]:state.artifacts[args.stage]}}),...material};
            }
            return respond(state,taskFor(),args.responseMode,{work_profile:profileContext(state)});
          }
          if (args.action === 'validate') {
            if(!STAGES.includes(args.stage))throw Error('INVALID_STAGE');
            return checkSubmission(state,args.stage,args.content);
          }
          if (args.action === 'next') {
            const task=taskFor();
            const response=respond(state,task,'compact');
            return {...task,...(response.approval_material?{approval_material:response.approval_material,continuation:response.continuation}: {})};
          }
          if (args.action === 'route') return boundedTask({...routeIntent(state,args.intent,args.entityIds),model_profile:currentCapabilities(),execution_plan:executionContext()});
          if (['revise','schedule','task_result','verify_issue','configure_profile','chapter_plan','chapter_submit','independent_review'].includes(args.action) && state.revision!==args.expectedRevision) throw Error('REVISION_CONFLICT');
          if(args.action==='chapter_plan')state=defineChapters(state,args.payload,args.expectedRevision);
          if(args.action==='chapter_submit')state=submitChapter(state,args.stage,args.chapterId,args.payload,JSON.parse(args.continuity||'null'),args.expectedRevision);
          if(['independent_review','compile'].includes(args.action)&&channelChanged)throw Error('CHANNEL_CHANGED_RECONFIGURE_PROFILE:渠道地址已变化，调用configure_profile确认当前target_model并重新审核资产与分镜');
          if(args.action==='independent_review') {
            const checkpointFile=path.join(dir,'review-checkpoints.json');
            let cache:any={};
            try{cache=JSON.parse(await readFile(checkpointFile,'utf8'));}catch(error:any){if(error.code!=='ENOENT')throw Error('REVIEW_CHECKPOINT_UNREADABLE');}
            const report=await runIndependentReview(runtime.config,state,{signal:exec.signal,cache,request: (key, complete) => journaledReview(requestFile,key,complete),onCheckpoint:async(key,report)=>{
              cache[key]=report;
              cache=Object.fromEntries(Object.entries(cache).slice(-64));
              const temp=path.join(dir,`${randomUUID()}.tmp`);
              try{await writeFile(temp,JSON.stringify(cache),{mode:0o600,flag:'wx'});await rename(temp,checkpointFile);}finally{await rm(temp,{force:true}).catch(()=>{});}
            }});
            state.independent_review_receipt={input_revisions:sourceRevisions(state,'review'),report_digest:reportDigest(report)};
            state=commitArtifact(state,'review',report,state.revision);
          }
          if (args.action === 'configure_profile') {
            state=configureProfile(state,args.payload,args.expectedRevision);
            if(channelChanged){if(state.revision===args.expectedRevision)state.revision++;state.capability_channel=channel;for(const stage of ['assets','shots','prompts','review'])if(state.artifacts[stage])state.artifacts[stage].stale=true;state.status='ASSET_DESIGN';}
          }
          if (args.action === 'revise') state=reviseEntities(state,args.stage,args.payload,args.expectedRevision);
          if (args.action === 'schedule') scheduleTask(state,taskFor());
          if (args.action === 'verify_issue') verifyIssue(state,args.issueId,args.payload);
          if (args.action === 'task_result') taskResult(state,args.taskKey,args.taskStatus,args.errorCode);
          if (args.action === 'compile') {
            if (state.revision!==args.expectedRevision) throw Error('REVISION_CONFLICT');
            if(state.project_spec?.target_model && state.project_spec.target_model!=='generic' && state.project_spec.target_model!==resolveModel(runtime.config)) throw Error('PROJECT_SPEC_MISMATCH:target_model。项目模型与当前制作配置不同；先 read 查看 execution_plan.model_name，再用 configure_profile 的 projectSpec.target_model 更新项目并重审模型相关材料；若要改实际调用模型，请到插件设置。不要填写占位文字或直接修改项目文件。');
            const plan=compileProduction(state,estimatePlan(runtime.config,'video_generate',{duration:state.duration_ms/1000}),args.ratio,args.resolution,currentCapabilities());
            if(state.production?.source_revision===state.revision && state.production.model_name && state.production.model_name!==resolveModel(runtime.config))throw Error('MODEL_CHANGED_RECOMPILE:请configure_profile明确当前target_model并重审模型相关材料。');
            if (!state.production || state.production.source_revision!==state.revision || state.production.ratio!==args.ratio || state.production.resolution!==args.resolution || !state.production.plan_digest) {
              state.production=await bindCompiledProject(state,plan,exec,file,resolveModel(runtime.config));
            }
          }
          if (args.action === 'export') return { project:state, markdown:renderDeliverables(state), manifest:artifactManifest(state), status:state.status };
          if (args.action === 'submit') {
            if(state.revision!==args.expectedRevision)throw Error('REVISION_CONFLICT');
            if(!STAGES.includes(args.stage))throw Error('INVALID_STAGE');
            if(state.chapter_policy==='chapter_v1'&&state.duration_ms>=600000&&['script','shots','prompts'].includes(args.stage))throw Error('CHAPTER_SUBMIT_REQUIRED:长片请按nextTask使用chapter_plan/chapter_submit，逐章保存再汇总');
            try {state=commitArtifact(state,args.stage,args.payload,args.expectedRevision);}
            catch(error) {
              const check=checkSubmission(state,args.stage,args.content);
              if(!check.valid)throw Error(`${check.error_code}: ${check.issues.map(i=>`${i.path}：${i.message}`).join('；')}`);
              throw error;
            }
          }
          if (args.action === 'approve') {
            const artifact=state.artifacts[args.stage];
            if (!['creative','script'].includes(args.stage) || !artifact || artifact.stale || state.revision!==args.expectedRevision) throw Error('INVALID_APPROVAL_REVISION');
            if(state.approvals?.[args.stage]===artifact.revision)return respond(state,taskFor(),args.responseMode||'compact');
            if(!presentation.shown(exec?.agent?.session,id,args.stage,artifact)) {
              presentation.remember(exec?.agent?.session,state);
              return {status:'needs_input',projectId:id,...presentation.repair(exec?.agent?.session,id,args.stage,artifact),reason:'当前版本仍有材料尚未在真实对话正文完整展示，审批未打开。仅原样补充approval_material.markdown返回的缺失原文段落或待展示页面，已展示部分不要重贴；补齐后沿原项目与修订号重试approve。'};
            }
            if(args.stage==='creative'&&state.project_spec&&Object.hasOwn(state.project_spec,'work_type')&&!hasContentProfile(state.project_spec))throw Error('WORK_TYPE_REQUIRED_BEFORE_APPROVAL');
            const service=runtime.ctx.get?.('userQuestions') || (exec.agent as any)?.ctx?.get?.('userQuestions');
            if (!service?.ask) return {status:'needs_input',projectId:id,reason:'人工确认服务不可用；本版材料已完整展示，恢复服务后再审核，无需重贴正文'};
            const answer=await service.ask({agent:exec.agent,signal:exec.signal,questions:[{id:'film_approval',header:'创作审核',question:approvalPreview(args.stage,artifact),multiSelect:false,options:[{label:'批准本版',description:'继续下一创作阶段'},{label:'需要修改',description:'保留草稿并修改'},{label:'拒绝当前方案',description:'停止当前创作流程，保留已有资料'}]}]});
            const decision=answer?.answers?.find(a=>a.id==='film_approval');
            if (exec.signal?.aborted || decision?.custom || decision?.selected?.length!==1 || !['批准本版','需要修改','拒绝当前方案'].includes(decision.selected[0])) return {status:'needs_input',projectId:id,reason:'未取得批准；保留已展示的当前材料，不重贴正文，不默认同意，等待用户决定'};
            state=recordApprovalDecision(state,args.stage,{'批准本版':'APPROVED','需要修改':'REVISE','拒绝当前方案':'REJECTED'}[decision.selected[0]],args.expectedRevision);
          }
          if (!['create','submit','approve','compile','revise','schedule','task_result','verify_issue','configure_profile','chapter_plan','chapter_submit','independent_review'].includes(args.action)) throw Error('INVALID_ACTION');
          if(args.action!=='create' && originalState===JSON.stringify(state))return respond(state,taskFor(),args.responseMode||'compact');
          await mkdir(path.join(dir,'snapshots'),{recursive:true,mode:0o700});
          const body=JSON.stringify(state,null,2);
          // 不可变快照先写入，project.json原子替换为唯一提交点；中断遗留快照不代表提交。
          await writeFile(path.join(dir,'snapshots',`${state.revision}-${randomUUID()}.json`),body,{mode:0o600,flag:'wx'});
          const temp=path.join(dir,`${randomUUID()}.tmp`);
          try {await writeFile(temp,body,{mode:0o600,flag:'wx'}); await rename(temp,file);}finally{await rm(temp,{force:true}).catch(()=>{});}
          await pruneProjectSnapshots(dir,state).catch(()=>{});
          return respond(state,taskFor(),args.responseMode||'compact',{sha256:createHash('sha256').update(body).digest('hex')});
        } finally {try{if(release)await release();}finally{if(!readonly)locks.delete(id);}}
      },
    }));
  },
};
