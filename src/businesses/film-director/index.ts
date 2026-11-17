import { resolveModel } from '../video/providers/connection.js';
import { createProjectSpec, configureProfile } from './runtime/spec.js';
import { profileContext } from './profiles/index.js';
import { acquireProjectLock } from './runtime/storage.js';
import { verifyIssue } from './runtime/issues.js';
import { recordApprovalDecision } from './runtime/approvals.js';
import { artifactManifest, renderDeliverables } from './runtime/deliverables.js';
import { INTENTS, routeIntent, ROLE_PROMPTS } from './roles/index.js';
import { reviseEntities, scheduleTask, taskResult } from './workflows/revisions.js';
import { nextTask, compileProduction } from './workflows/orchestration.js';
import { estimatePlan } from '../video/workflow/costs.js';
import { createProject, writeProject } from '../video/workflow/project.js';
import { randomUUID, createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import path from 'node:path';
import { dshHome } from '../video/media/references.js';
import { DATA_DIR } from '../../core/hardcoded-config.js';
import { sessionOwner } from '../video/workflow/project.js';
import { STAGES, commitArtifact } from './runtime/project.js';
import { FILM_WORKFLOW_GUIDANCE, ORCHESTRATION_GUIDANCE, INTENT_GUIDANCE } from './prompts/guidance.js';
import type { BusinessModule } from '../../core/runtime.js';
const locks = new Set<string>();
export const filmDirectorBusiness: BusinessModule = {
  id: 'film-director',
  prompt: () => ROLE_PROMPTS.director + FILM_WORKFLOW_GUIDANCE + ORCHESTRATION_GUIDANCE + INTENT_GUIDANCE,
  apply(runtime) {
    runtime.tools.register('film-director', {
      name: 'film_project', description: '专业创作项目：create/read/submit/approve/export。磁盘保存，创意与剧本独立人工批准，不提交付费视频。submit的content为JSON字符串：creative含theme/logline；script含screenplay/chapters（duration_ms）；assets含characters/scenes；shots含shots；prompts含prompts；review含review_status/scores/issues/delivery_allowed；export返回可读Markdown及版本校验清单。',
      parameters: { type:'object', properties: {
        intent:{type:'string',enum:[...INTENTS]}, entityIds:{type:'array',items:{type:'string'}},
        projectSpec:{type:'string',description:'create可选项目规格JSON：work_type（DRAMA/COMEDY/LIFESTYLE/DOCUMENTARY/COMMERCIAL/PROMOTIONAL）、narrative_mode（FICTION/OBSERVATIONAL/EXPLANATORY/DEMONSTRATION/POETIC/MIXED）、genre/aspect_ratio/resolution/language/visual_style/target_audience/distribution_channel/target_model/hard_constraints/soft_preferences/references。configure_profile时仅传work_type和可选narrative_mode；类型不同于风格和生成模式，不猜测用户确认。配置修订由运行时固定。'}, issueId:{type:'string'}, taskKey:{type:'string'}, taskStatus:{type:'string',enum:['running','completed','failed']}, errorCode:{type:'string'},
        ratio:{type:'string',enum:['16:9','9:16']}, resolution:{type:'string',enum:['480p','720p']},
        action:{type:'string',enum:['create','read','submit','approve','export','next','compile','revise','schedule','task_result','route','verify_issue','configure_profile']}, projectId:{type:'string'}, title:{type:'string'}, sourceBrief:{type:'string'}, durationSeconds:{type:'integer'}, stage:{type:'string',enum:[...STAGES]}, content:{type:'string'}, expectedRevision:{type:'integer'},
      }, required:['action'] },
      output:{schema:{type:'object'},render(_args,value){return [{type:'text',text:JSON.stringify(value)}];}},
      isConcurrencySafe(){return false;},
      async execute(args,exec) {
        const owner = sessionOwner(exec);
        const id = args.action === 'create' ? randomUUID() : args.projectId;
        if (!/^[a-f0-9-]{36}$/.test(id || '')) throw Error('INVALID_PROJECT_ID');
        if (locks.has(id)) throw Error('PROJECT_BUSY');
        locks.add(id);
        let release;
        try {
          const dir = path.join(dshHome(),DATA_DIR,'film-projects',owner,id);
          const file = path.join(dir,'project.json');
          await mkdir(dir,{recursive:true,mode:0o700});
          release=await acquireProjectLock(dir);
          let state;
          if (args.action === 'create') {
            if (!Number.isInteger(args.durationSeconds) || args.durationSeconds<15 || args.durationSeconds>3600 || !args.title?.trim() || !args.sourceBrief?.trim()) throw Error('INVALID_REQUIREMENTS');
            state={schema_version:'3.1.0',project_id:id,title:args.title,source_brief:args.sourceBrief,duration_ms:args.durationSeconds*1000,project_spec:createProjectSpec(args.title,args.sourceBrief,args.durationSeconds*1000,args.projectSpec?JSON.parse(args.projectSpec):{...(args.ratio?{aspect_ratio:args.ratio}:{}),...(args.resolution?{resolution:args.resolution}:{})}),revision:0,status:'REQUIREMENT_ANALYSIS',artifacts:{},approvals:{},decisions:[]};
          } else state=JSON.parse(await readFile(file,'utf8'));
          const executionContext=()=>{
            try {
              let cursor=0;
              const segments=estimatePlan(runtime.config,'video_generate',{duration:state.duration_ms/1000}).map(part=>{const start=cursor;cursor+=part.seconds*1000;return {kind:part.kind,start_ms:start,end_ms:cursor,duration_ms:part.seconds*1000};});
              return {model_name:resolveModel(runtime.config),strategy:'continuous_segments',segments,instructions:'制作预规划，不是付费调用或已验证画面效果。分镜不得跨生成段截断动作与对白；同一生成段的多地点切换需重新规划。独立镜头执行器尚未接入。'};
            } catch {return {capability_status:'UNVERIFIED',instructions:'当前执行分段无法预规划；可继续创意与剧本，分镜提交前须确认实际制作模型和分段边界。'};}
          };
          const taskFor=()=>({...nextTask(state),execution_plan:executionContext()});

          if (args.action === 'read') return {...state,work_profile:profileContext(state),nextTask:taskFor()};
          if (args.action === 'next') return taskFor();
          if (args.action === 'route') return {...routeIntent(state,args.intent,args.entityIds),execution_plan:executionContext()};
          if (['revise','schedule','task_result','verify_issue','configure_profile'].includes(args.action) && state.revision!==args.expectedRevision) throw Error('REVISION_CONFLICT');
          if (args.action === 'configure_profile') state=configureProfile(state,JSON.parse(args.projectSpec),args.expectedRevision);
          if (args.action === 'revise') state=reviseEntities(state,args.stage,JSON.parse(args.content),args.expectedRevision);
          if (args.action === 'schedule') scheduleTask(state,taskFor());
          if (args.action === 'verify_issue') verifyIssue(state,args.issueId,JSON.parse(args.content));
          if (args.action === 'task_result') taskResult(state,args.taskKey,args.taskStatus,args.errorCode);
          if (args.action === 'compile') {
            if (state.revision!==args.expectedRevision) throw Error('REVISION_CONFLICT');
            if(state.project_spec?.target_model && state.project_spec.target_model!=='generic' && state.project_spec.target_model!==resolveModel(runtime.config)) throw Error('PROJECT_SPEC_MISMATCH:target_model');
            const plan=compileProduction(state,estimatePlan(runtime.config,'video_generate',{duration:state.duration_ms/1000}),args.ratio,args.resolution);
            if (!state.production || state.production.source_revision!==state.revision || state.production.ratio!==args.ratio || state.production.resolution!==args.resolution) {
              const project:any=await createProject(exec,state.artifacts.assets.data.characters.length?'fixed_subject':'scenery');
              project.duration=state.duration_ms/1000;
              project.filmSource={path:file,revision:state.revision};
              await writeProject(project);
              state.production={...plan,videoProjectId:project.id};
            }
          }
          if (args.action === 'export') return { project:state, markdown:renderDeliverables(state), manifest:artifactManifest(state), status:state.status };
          if (args.action === 'submit') state=commitArtifact(state,args.stage,JSON.parse(args.content),args.expectedRevision);
          if (args.action === 'approve') {
            const artifact=state.artifacts[args.stage];
            if (!['creative','script'].includes(args.stage) || !artifact || artifact.stale || state.revision!==args.expectedRevision) throw Error('INVALID_APPROVAL_REVISION');
            if(args.stage==='creative'&&state.project_spec&&Object.hasOwn(state.project_spec,'work_type')&&!state.project_spec.work_type)throw Error('WORK_TYPE_REQUIRED_BEFORE_APPROVAL');
            const service=runtime.ctx.get?.('userQuestions') || (exec.agent as any)?.ctx?.get?.('userQuestions');
            if (!service?.ask) return {status:'needs_input',reason:'人工确认服务不可用'};
            const answer=await service.ask({agent:exec.agent,signal:exec.signal,questions:[{id:'film_approval',header:'创作审核',question:`审核${args.stage} revision ${artifact.revision}：\n${JSON.stringify(artifact.data)}\n是否批准本版进入下一阶段？`,multiSelect:false,options:[{label:'批准本版',description:'继续下一创作阶段'},{label:'需要修改',description:'保留草稿并修改'},{label:'拒绝当前方案',description:'停止当前创作流程，保留已有资料'}]}]});
            const decision=answer?.answers?.find(a=>a.id==='film_approval');
            if (exec.signal?.aborted || decision?.custom || decision?.selected?.length!==1 || !['批准本版','需要修改','拒绝当前方案'].includes(decision.selected[0])) return {status:'needs_input',projectId:id};
            state=recordApprovalDecision(state,args.stage,{'批准本版':'APPROVED','需要修改':'REVISE','拒绝当前方案':'REJECTED'}[decision.selected[0]],args.expectedRevision);
          }
          if (!['create','submit','approve','compile','revise','schedule','task_result','verify_issue','configure_profile'].includes(args.action)) throw Error('INVALID_ACTION');
          await mkdir(path.join(dir,'snapshots'),{recursive:true,mode:0o700});
          const body=JSON.stringify(state,null,2);
          // 不可变快照先写入，project.json原子替换为唯一提交点；中断遗留快照不代表提交。
          await writeFile(path.join(dir,'snapshots',`${state.revision}-${randomUUID()}.json`),body,{mode:0o600,flag:'wx'});
          const temp=path.join(dir,`${randomUUID()}.tmp`);
          await writeFile(temp,body,{mode:0o600,flag:'wx'}); await rename(temp,file);
          return {...state,nextTask:taskFor(),sha256:createHash('sha256').update(body).digest('hex')};
        } finally {try{if(release)await release();}finally{locks.delete(id);}}
      },
    });
  },
};
