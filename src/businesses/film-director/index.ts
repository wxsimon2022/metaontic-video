import { randomUUID, createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import path from 'node:path';
import { dshHome } from '../video/media/references.js';
import { DATA_DIR } from '../../core/hardcoded-config.js';
import { sessionOwner } from '../video/workflow/project.js';
import { STAGES, commitArtifact, exportMarkdown } from './project.js';
import { FILM_WORKFLOW_GUIDANCE } from './creative.js';
import type { BusinessModule } from '../../core/runtime.js';
const locks = new Set<string>();
export const filmDirectorBusiness: BusinessModule = {
  id: 'film-director',
  prompt: () => FILM_WORKFLOW_GUIDANCE,
  apply(runtime) {
    runtime.tools.register('film-director', {
      name: 'film_project', description: '专业创作项目：create/read/submit/approve/export。磁盘保存，创意与剧本独立人工批准，不提交付费视频。submit的content为JSON字符串：creative含theme/logline；script含screenplay/chapters（duration_ms）；assets含characters/scenes；shots含shots；prompts含prompts；review含score/passed/issues。',
      parameters: { type:'object', properties: {
        action:{type:'string',enum:['create','read','submit','approve','export']}, projectId:{type:'string'}, title:{type:'string'}, sourceBrief:{type:'string'}, durationSeconds:{type:'integer'}, stage:{type:'string',enum:[...STAGES]}, content:{type:'string'}, expectedRevision:{type:'integer'},
      }, required:['action'] },
      output:{schema:{type:'object'},render(_args,value){return [{type:'text',text:JSON.stringify(value)}];}},
      isConcurrencySafe(){return false;},
      async execute(args,exec) {
        const owner = sessionOwner(exec);
        const id = args.action === 'create' ? randomUUID() : args.projectId;
        if (!/^[a-f0-9-]{36}$/.test(id || '')) throw Error('INVALID_PROJECT_ID');
        if (locks.has(id)) throw Error('PROJECT_BUSY');
        locks.add(id);
        try {
          const dir = path.join(dshHome(),DATA_DIR,'film-projects',owner,id);
          const file = path.join(dir,'project.json');
          let state;
          if (args.action === 'create') {
            if (!Number.isInteger(args.durationSeconds) || args.durationSeconds<15 || args.durationSeconds>3600 || !args.title?.trim() || !args.sourceBrief?.trim()) throw Error('INVALID_REQUIREMENTS');
            state={schema_version:'2.0.0',project_id:id,title:args.title,source_brief:args.sourceBrief,duration_ms:args.durationSeconds*1000,revision:0,status:'REQUIREMENT_ANALYSIS',artifacts:{},approvals:{},decisions:[]};
          } else state=JSON.parse(await readFile(file,'utf8'));
          if (args.action === 'read') return state;
          if (args.action === 'export') return { project:state, markdown:exportMarkdown(state), status:state.status };
          if (args.action === 'submit') state=commitArtifact(state,args.stage,JSON.parse(args.content),args.expectedRevision);
          if (args.action === 'approve') {
            const artifact=state.artifacts[args.stage];
            if (!['creative','script'].includes(args.stage) || !artifact || artifact.stale || state.revision!==args.expectedRevision) throw Error('INVALID_APPROVAL_REVISION');
            const service=runtime.ctx.get?.('userQuestions') || (exec.agent as any)?.ctx?.get?.('userQuestions');
            if (!service?.ask) return {status:'needs_input',reason:'人工确认服务不可用'};
            const answer=await service.ask({agent:exec.agent,signal:exec.signal,questions:[{id:'film_approval',header:'创作审核',question:`审核${args.stage} revision ${artifact.revision}：\n${JSON.stringify(artifact.data)}\n是否批准本版进入下一阶段？`,multiSelect:false,options:[{label:'批准本版',description:'继续下一创作阶段'},{label:'需要修改',description:'保留草稿并修改'}]}]});
            const decision=answer?.answers?.find(a=>a.id==='film_approval');
            if (exec.signal?.aborted || decision?.custom || decision?.selected?.length!==1 || decision.selected[0]!=='批准本版') return {status:'needs_input',projectId:id};
            state.approvals[args.stage]=artifact.revision;
            state.decisions.push({stage:args.stage,revision:artifact.revision,decision:'approve',approved_at:new Date().toISOString()});
            state.revision++; state.status=args.stage==='creative'?'SCRIPT_WRITING':'ASSET_DESIGN';
          }
          if (!['create','submit','approve'].includes(args.action)) throw Error('INVALID_ACTION');
          await mkdir(path.join(dir,'snapshots'),{recursive:true,mode:0o700});
          const body=JSON.stringify(state,null,2);
          // 不可变快照先写入，project.json原子替换为唯一提交点；中断遗留快照不代表提交。
          await writeFile(path.join(dir,'snapshots',`${state.revision}-${randomUUID()}.json`),body,{mode:0o600,flag:'wx'});
          const temp=path.join(dir,`${randomUUID()}.tmp`);
          await writeFile(temp,body,{mode:0o600,flag:'wx'}); await rename(temp,file);
          return {...state,sha256:createHash('sha256').update(body).digest('hex')};
        } finally {locks.delete(id);}
      },
    });
  },
};
