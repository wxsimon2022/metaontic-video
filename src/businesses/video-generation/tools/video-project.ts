import { resolveModel } from '../providers/connection.js';
import { assertCompiledProduction } from '../../film-production/production.binding.js';
import { validateExtensionDuration } from '../workflow/planning.js';
import { ensureProjectDuration } from '../workflow/duration-choice.js';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { estimatePlan } from '../workflow/costs.js';
import { resolveSegmentPrompts } from '../workflow/planning.js';
import path from 'node:path';
import { createProject, readProject, writeProject, lockProject, productionFingerprint, normalizeProductionSpec, matchesProductionApproval, scriptDigest, hasProjectImages } from '../workflow/project.js';
import { characterChoiceGate } from '../workflow/character-choice.js';
import { resumeDirOf } from '../workflow/resume.js';
import { approvalPolicy } from '../workflow/approval.js';
import { pendingScriptQuestions, syncScriptQuestions, recordQuestionAnswers } from '../workflow/script-questions.js';
import { captureScriptBody } from '../workflow/script-capture.js';
import { scriptVersion } from '../workflow/script-tracking.js';
import { scriptStoryboardShots } from '../workflow/storyboard-shots.js';
import { nextStoryboardVersion, renderStoryboardSvg, storyboardFileName } from '../workflow/storyboard-image.js';
import { closePendingStage } from './video-stage.js';
import { appendRequestLog } from '../../../shared/utils/logging.js';

/** 脚本落盘：正文是唯一来源，插件代写 script.md，并把脚本设计阶段计时就地收口。
 *  助手不再用写文件工具把同一段脚本写第二遍（实测省 10–25 秒和等量 token）；老路子（助手自己写文件）仍照常工作。 */
async function captureScriptFile(scriptPath: string, text: string) {
  const body = captureScriptBody(text);
  if (!body) return null;
  await mkdir(path.dirname(scriptPath), { recursive: true, mode: 0o700 });
  await writeFile(scriptPath, `${body}\n`, { mode: 0o600 });
  const closed = await closePendingStage('script_design', 'script_saved');
  await appendRequestLog({ event: 'script_saved', path: scriptPath, tool: 'capture', mode: 'create',
    bytes: Buffer.byteLength(body, 'utf8'), characters: body.length, version: scriptVersion(body),
    closedSpanId: closed?.spanId, closedElapsedMs: closed?.elapsedMs });
  return { body, closed };
}

/** 真实用户答复只由宿主 userQuestions 获取，不接受助手提交 approved:true。 */
export function projectTool(config, ctx, reviewGuard, generationProperties, extensionProperties, segmentReview = null, onReviewReady = null) {
  return {
    name: 'video_project',
    description: '先在完善创意的同一轮合并询问时长、画幅和清晰度，用户回答后prepare创建独立projectId并传已确认duration，决定角色图路线。脚本只在正文生成一次：贴出完整脚本后调storyboard（传captureScript与scriptPath，插件据此落script.md并就地渲染本版分镜示意图，返回markdown与链接），把示意图正文发出，再调review（复用scriptPath，不再传captureScript、不再重贴同版脚本）弹审核；不要自己写绘图代码/SVG，也不要用写文件工具再把脚本写一遍。原始需求未写时长但已在完善创意中回答，也必须传确认的duration，禁止省略造成重复询问；只有从未确认时长才由工具兜底询问，未答不继续，禁止自行默认15秒。scenery仅用于无固定主体空镜，fixed_subject用于需要固定外形的人物/主体。角色图选择绑定项目不随提示词改变。脚本、分镜、逐段生成提示词及完整制作参数准备后，正文完整展示，再review弹本版脚本审核（同版已通过不重复，改稿需重审）；通过后直接调用对应生成工具，工具付费审批即开始制作确认，不另弹开始制作问题。改稿或参数改变须review，status只读取真实状态。每段完成后先展示视频，再调用review_segment并传resume弹结果确认窗；这不属于重复制作确认，禁止跳过。不会生成或扣费。',
    parameters: { type: 'object', properties: {
      resume: { type: 'string', description: 'review_segment审核已完成分段，传原resumeDir；先正文展示视频，再调用本动作弹结果确认窗。' },
      action: { type: 'string', enum: ['prepare', 'review', 'storyboard', 'status', 'review_segment'] }, projectId: { type: 'string' },
      captureScript: { type: 'boolean', description: '传true时插件把本轮用户可见正文里的完整脚本落成script.md：脚本只需在正文生成一次，不要再用写文件工具写一遍。首次storyboard时使用；review复用已保存稿件，不重复捕获。改稿后重新storyboard并展示新版。' },
      duration: { type: 'integer', description: 'prepare时仅传用户已明确指定或回答确认的目标总秒数（4–3600）；原始需求未写但已在完善创意中回答也必须传值；同项目沿用已保存值，只有从未确认才省略。续拍指本次新增的总秒数，不是每段时长。' },
      subjectType: { type: 'string', enum: ['fixed_subject', 'scenery', 'provided_images'] },
      resetCharacterChoice: { type: 'boolean', description: '仅用户明确改变角色图路线时传true' },
      toolName: { type: 'string', enum: ['video_generate', 'video_extend'] },
      scriptPath: { type: 'string', description: '完整脚本文件路径；审核后不要改写状态标记，真实审核状态由插件保存' },
      specification: { type: 'object', properties: { ...extensionProperties, ...generationProperties }, description: '之后生成调用的完整参数，不含projectId；续做改稿需包含原resume；含prompt、逐段segmentPrompts、素材、duration、ratio、resolution等' },
    }, required: ['action'] },
    output: { schema: { type: 'object' }, render(_args, value) { return [{ type: 'text', text: JSON.stringify(value) }]; } },
    timeoutMs: 600000,
    isConcurrencySafe() { return false; },
    async execute(args, exec) {
      if (args.action === 'review_segment') {
        if (!segmentReview) throw new Error('结果审核服务不可用');
        return segmentReview.review(args, exec);
      }
      if (args.action === 'status') {
        const data = await readProject(args.projectId, exec);
        let sourceCurrent=true;let staleReason;
        if(data.approved && data.filmSource) {
          try {assertCompiledProduction(data,JSON.parse(await readFile(data.filmSource.path,'utf8')),data.approved.specification,resolveModel(config));}
          catch {sourceCurrent=false;staleReason='专业源项目、模型或编译方案已改变或无法读取，请重新编译并审核。';}
        }
        const current = sourceCurrent && data.approved && await scriptDigest(data.approved.scriptPath).catch(() => '') === data.approved.scriptHash
          && matchesProductionApproval(config,data.approved,data.approved.name,data.approved.specification);
        return { projectId: data.id, subjectType: data.subjectType, choice: data.choice, duration: data.duration, status: current ? 'approved' : 'draft',...(staleReason?{approval_stale:true,reason:staleReason}:{}) };
      }
      if (args.action === 'storyboard') {
        // 分镜示意图改由插件按脚本分镜表本地渲染：秒级、确定性，不再让模型手写绘图程序或 SVG。
        const owner=await readProject(args.projectId,exec);
        return lockProject(owner.id,async()=>{
        const project=await readProject(owner.id,exec);
        const session = exec.agent?.session;
        const scriptPath = path.resolve(session?.header?.cwd || process.cwd(), String(args.scriptPath || ''));
        if (!/\.md$/i.test(scriptPath)) throw new Error('storyboard需传脚本文件路径scriptPath（.md）。');
        if (args.captureScript === true && !await captureScriptFile(scriptPath, reviewGuard.visibleText?.(session) || '')) {
          throw new Error('正文里没有找到完整脚本：先把本版脚本正文完整贴进用户可见正文（摘要、链接、示意图都不算），再让插件出分镜示意图。');
        }
        const script = await readFile(scriptPath, 'utf8').catch(() => '');
        if (!String(script).trim()) throw new Error('还没读到脚本文件：先在正文贴出完整脚本并传captureScript，或先把脚本写到scriptPath。');
        const version = nextStoryboardVersion(await readdir(path.dirname(scriptPath)).catch(() => []));
        const svg = renderStoryboardSvg(script, { version });
        const target = path.join(path.dirname(scriptPath), storyboardFileName(version));
        await writeFile(target, svg, { mode: 0o600,flag:'wx' });
        project.storyboard={projectId:project.id,path:target,scriptPath,scriptHash:await scriptDigest(scriptPath),imageHash:await scriptDigest(target),version};
        syncScriptQuestions(project,pendingScriptQuestions(script),project.storyboard.scriptHash);
        project.approved=null;
        await writeProject(project);
        return { path: target, version, shots: scriptStoryboardShots(script).length, bytes: Buffer.byteLength(svg, 'utf8'),
          markdown: `![分镜示意图](<${target}>)`, link: `[打开原图](<${target}>)`,
          hint: '脚本已保存，后续review只传scriptPath，不传captureScript，也不重复展示同版脚本。把 markdown 内嵌进本轮正文、link 一并给出，再调用review；示意图由插件本地渲染，不要自己写绘图代码或 SVG，也不要调用付费出图模型。' };
        });
      }
      if (!['prepare', 'review'].includes(args.action)) throw new Error('未知项目操作');
      let data = args.projectId ? await readProject(args.projectId, exec) : null;
      if (!data) {
        if (args.action !== 'prepare' || !['fixed_subject', 'scenery', 'provided_images'].includes(args.subjectType)) throw new Error('先prepare并明确subjectType。');
        data = await createProject(exec, args.subjectType);
      }
      return lockProject(data.id, async () => {
        data = await readProject(data.id, exec);
        if (args.action === 'prepare') {
          if (args.subjectType && args.subjectType !== data.subjectType) throw new Error('新主体方案请创建新项目，不覆盖原项目。');
          const length = await ensureProjectDuration(ctx, exec, data, args.duration, writeProject);
          if (length.status !== 'confirmed') return { projectId: data.id, status: 'pending', nextAction: length.reason };
          if (args.resetCharacterChoice) { data.choice = ''; data.approved = null; await writeProject(data); }
          if (data.subjectType === 'scenery' || data.subjectType === 'provided_images') {
            data.choice = data.subjectType === 'scenery' ? 'not_needed' : 'provided_images'; await writeProject(data);
            return { projectId: data.id, status: 'prepared', duration: data.duration, choice: data.choice };
          }
          const gate = await characterChoiceGate(ctx, config, { ...exec, name: 'video_generate' }, { projectId: data.id, preparation: true, resetCharacterChoice: args.resetCharacterChoice });
          const saved = await readProject(data.id, exec);
          return { projectId: data.id, duration: data.duration, choice: saved.choice, status: saved.choice ? 'prepared' : 'pending', nextAction: gate?.reason || '编写脚本与分镜，完成后review。' };
        }
        const spec = args.specification ? normalizeProductionSpec(config,args.toolName||'video_generate',args.specification) : null;
        if(data.filmSource) {
          if(args.toolName && args.toolName!=='video_generate')throw Error('COMPILED_TOOL_MISMATCH');
          const source=JSON.parse(await readFile(data.filmSource.path,'utf8'));
          assertCompiledProduction(data,source,spec,resolveModel(config));
        }
        const allowed = new Set(Object.keys(args.toolName === 'video_extend' ? extensionProperties : generationProperties));
        if (args.specification && Object.keys(args.specification).some(k => !allowed.has(k))) throw new Error('specification只能包含对应生成工具的公开参数，禁止凭据或未知字段。');
        if (!spec || !spec.prompt || !spec.duration || !spec.ratio || !spec.resolution || spec.projectId) throw new Error('review需完整specification：prompt、duration、ratio、resolution，不能包含projectId。');
        if (!data.choice) throw new Error('角色图选择未完成，请先prepare。');
        if (['generate_first', 'provided_images'].includes(data.choice) && !hasProjectImages(spec)) throw new Error('先提供角色图并展示审核，再提交带图specification。');
        const name = args.toolName || 'video_generate';
        if (!['video_generate', 'video_extend'].includes(name)) throw new Error('未知生成工具');
        if (data.duration == null) throw new Error('视频总时长尚未确认，请先prepare询问用户，不得默认15秒。');
        if (name === 'video_extend') validateExtensionDuration(config, spec);
        const requestedTotal = name === 'video_extend' ? Number(spec.duration) * Number(spec.segments || 1) : Number(spec.duration);
        if (requestedTotal !== data.duration && !spec.resume) throw new Error('脚本时长与用户确认的总时长不一致，请先用prepare确认变更，再重新审核。');
        const scriptPath = path.resolve(exec.agent.session.header?.cwd || process.cwd(), String(args.scriptPath || ''));
        if (!/\.md$/i.test(scriptPath)) throw new Error('scriptPath需为Markdown脚本文件。');
        if (args.captureScript === true && !await readFile(scriptPath, 'utf8').catch(() => '') && !await captureScriptFile(scriptPath, reviewGuard.visibleText?.(exec.agent.session) || '')) {
          throw new Error('正文里没有找到完整脚本：请先把本版脚本正文完整贴进用户可见正文（摘要、链接、示意图都不算），再调用review；脚本只需在正文写这一次，插件会据此落成script.md。');
        }
        const scriptHash = await scriptDigest(scriptPath);
        const scriptBody = (await readFile(scriptPath, 'utf8')).replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '').trim();
        if (!scriptBody) throw new Error('脚本正文不能为空。');
        const unresolved=syncScriptQuestions(data,pendingScriptQuestions(scriptBody),scriptHash);
        await writeProject(data);
        if(unresolved.length) {
          data.approved=null;await writeProject(data);
          const asked=unresolved.filter(item=>item.status==='PENDING').slice(0,3);
          const service=ctx.get?.('userQuestions') || exec.agent?.ctx?.get?.('userQuestions');
          const result=asked.length && service?.ask && approvalPolicy(ctx,exec)!=='never'
            ? await service.ask({agent:exec.agent,signal:exec.signal,...(exec.callId?{wait:{callId:exec.callId}}:{}),
              questions:asked.map(item=>({id:item.id,header:'待确认事项',question:item.question,multiSelect:false}))}) : null;
          recordQuestionAnswers(data.clarifications,asked,result,scriptHash,Boolean(exec.signal?.aborted));
          await writeProject(data);
          return {projectId:data.id,status:'blocked',pendingQuestions:unresolved.map(item=>item.question),
            clarifications:data.clarifications,
            reason:'待确认事项尚未全部落实。未回答的问题须明确答复；已回答问题无需重复询问，按保存答复修改脚本、移出待确认清单，再展示新版分镜并review。删除问题不能代替答复，答复也不等于脚本批准。'};
        }

        if (name === 'video_generate' && !spec.resume) resolveSegmentPrompts(spec.segmentPrompts, estimatePlan(config, name, spec).length);
        const fingerprint = productionFingerprint(config, name, spec);
        // 同步发生在审核等待前；草稿持久化用于取消后或status补同步，不代表审核通过。
        data.canvasDraft = { scriptPath, specification: spec };
        await writeProject(data);
        let canvasProject;
        if (onReviewReady) {
          try { canvasProject = await onReviewReady(data.id, exec); }
          catch { canvasProject = { status: 'pending', reason: '画布同步未完成，可用项目status补同步；未新增生成任务。' }; }
          // 同步会更新canvasAuto，后续保存审核事实不能用旧data覆盖绑定。
          data = await readProject(data.id, exec);
        }
        const canvasOutput = canvasProject ? { canvasProject } : {};
        const gate = await reviewGuard.gate({ ...exec, name: 'ask_user_question', arguments: { requireStoryboard: true, requiredProjectId:data.id,requiredScriptPath:scriptPath,requiredScriptHash:scriptHash,requiredStoryboard:data.storyboard,requiredScriptText: scriptBody, questions: [{ id: 'script_review', question: '审核当前脚本' }] } });
        if (gate) {
          const board=data.storyboard;
          const currentBoard=board?.projectId===data.id && board.scriptHash===scriptHash
            && path.resolve(board.scriptPath)===scriptPath
            && await scriptDigest(board.path).catch(()=>'')===board.imageHash;
          return {projectId:data.id,status:'blocked',...canvasOutput,reason:gate.reason,
            repairAction:currentBoard?'present_current_materials':'regenerate_storyboard',
            ...(currentBoard?{presentation:{scriptPath,storyboardPath:board.path,
              markdown:scriptBody+`\n\n![分镜示意图](<${board.path}>)\n\n[打开原图](<${board.path}>)`}}:{}),
            nextAction:currentBoard?'将presentation.markdown原样放在一条用户可见正文中（不要省略项目行、改写或自行转图），然后沿用同一projectId、scriptPath和specification重试review；不重建项目、不重写文件、不重复捕获脚本。':'本项目分镜缺失或已过期。沿用本projectId与scriptPath调用storyboard，展示返回的原图后再review；不使用其他项目或自行转换的图片。'};
        }
        const service = ctx.get?.('userQuestions') || exec.agent?.ctx?.get?.('userQuestions');
        if (!service?.ask || approvalPolicy(ctx, exec) === 'never') return { projectId: data.id, status: 'pending', ...canvasOutput, reason: '无法取得脚本审核答复，未生成。' };
        data.approved = null; await writeProject(data);
        const result = await service.ask({ agent: exec.agent, signal: exec.signal, ...(exec.callId ? { wait: { callId: exec.callId } } : {}), questions: [{ id: 'script_review', header: '脚本审核', question: '请审核刚展示的本版脚本、分镜、角色图及费用预估。是否通过？通过后仍会单独确认视频调用费用。', multiSelect: false, options: [{ label: '脚本通过', description: '使用本版材料，下一步确认视频制作费用。' }, { label: '需要修改', description: '先修改并重新展示审核，不生成。' }] }] });
        const answer = result?.answers?.find(a => a.id === 'script_review');
        if (exec.signal?.aborted || answer?.custom || answer?.selected?.length !== 1 || answer.selected[0] !== '脚本通过') return { projectId: data.id, status: 'draft', ...canvasOutput, reason: '未取得审核通过，未生成。' };
        if (!data.storyboard || await scriptDigest(data.storyboard.path).catch(()=>'')!==data.storyboard.imageHash || await scriptDigest(scriptPath) !== scriptHash || productionFingerprint(config, name, spec) !== fingerprint) throw new Error('等待审核期间材料或配置改变，请重新展示审核。');
        if(data.filmSource)assertCompiledProduction(data,JSON.parse(await readFile(data.filmSource.path,'utf8')),spec,resolveModel(config));
        data.approved = { scriptPath, scriptHash, fingerprint, specification: spec, name, resumeDir: resumeDirOf(spec.resume), reviewedAt: new Date().toISOString() };
        await writeProject(data);
        return { projectId: data.id, status: 'approved', ...canvasOutput, nextAction: `直接调用${name}并带projectId和本次specification；工具付费审批承担制作确认，不再另问一次。` };
      });
    },
  };
}
