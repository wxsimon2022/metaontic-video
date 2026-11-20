import { acquireFileLock } from '../../../shared/utils/file-lock.js';
import { validatePauseRecord } from './result-state.js';
/** workflow/resume：从宿主入口拆出的独立职责模块。 */
import path from 'node:path';
import { readFile, open, rm, mkdir, writeFile, rename } from 'node:fs/promises';
import { ref, MAX_SEGMENT_SECONDS, MAX_SEGMENTS, MIN_SECONDS, MAX_TOTAL_SECONDS } from '../config.js';
import { uniqueSuffix } from '../utils/files.js';
import os from 'node:os';
import { requestLogContext, appendRequestLog } from '../../../shared/utils/logging.js';
import { isMetaontic, isVolcengine, resolveModel, resolveBaseUrl, resolveSubmitPath, resolveQueryPath } from '../providers/connection.js';
import { sumStepSeconds, modelMaxSeconds } from './planning.js';

/* ---------------- 长视频的循环迭代：分段之间的人工确认 + 暂停后接着做 ---------------- */

/**
 * 暂停记录文件名。长视频是「先直出、再逐段延长」，每段生成完都先问用户要不要继续；
 * 用户点了「先不继续」就把「已经生成到哪一步」写进这个文件，随时能用 resume 接着做。
 */
const PAUSE_FILE = 'paused-plan.json';

/** resume 参数：目录路径字符串，或上次结果里那个 resumeDir 对象。 */
export function resumeDirOf(value) {
  const raw = typeof value === 'string'
    ? value
    : (value?.dir ?? value?.path ?? value?.resumeDir ?? value?.token ?? '');
  const dir = String(raw ?? '').trim();
  return dir ? path.resolve(dir) : '';
}

export async function readPauseFile(dir) {
  const file = path.join(dir, PAUSE_FILE);
  let text;
  try {
    text = await readFile(file, 'utf8');
  } catch {
    throw new Error(
      `没有找到暂停记录：${file}。resume 要传上一次结果里的 resumeDir`
      + '（用户选择先不继续时，结果里给的那个分段目录），不要自己拼路径。',
    );
  }
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`暂停记录不是合法 JSON：${file}。`);
  }
  return validatePauseRecord(data, file);
}

/* ---------------- 暂停目录的「续做锁」：同一份进度只能有一次 resume 在跑 ---------------- */

const RESUME_LOCK = 'resume.lock';

/** 仅恢复同机、明确死亡进程的锁；超时、损坏或异机锁不得自动抢占。 */
async function acquireResumeLock(dir, {toolName,callId}) {
 const file=path.join(dir,RESUME_LOCK);
 try {
  const release=await acquireFileLock(file,{recoverDead:true,metadata:{tool:toolName,callId:callId||null}});
  return {file,release};
 } catch(error) {
  if(error?.code==='ENOENT')return {file:null,async release(){}};
  throw Object.assign(new Error('这份暂停进度已有续做锁，或无法确认旧调用是否结束。本次已停止，未新增任务；请先核对原调用，不能按等待时间抢锁或手动删除未知锁。'),{code:'resume_locked'});
 }
}

export function withResumeLock(tool, toolName, config) {
  return {
    ...tool,
    async execute(args, exec) {
      return requestLogContext.run({ ...requestLogContext.getStore(), callId: exec?.callId || requestLogContext.getStore()?.callId || uniqueSuffix('call'), tool: toolName }, async () => {
        const started = Date.now();
        const dir = resumeDirOf(args?.resume);
        let lock;
        await appendRequestLog({ event: 'tool_started', provider: isVolcengine(config) ? 'volcengine' : 'metaontic',
          model: resolveModel(config), duration: args?.duration, segmentSeconds: args?.segmentSeconds,
          resuming: Boolean(dir), resumeDir: dir || undefined });
        try {
          if (dir) {
            lock = await acquireResumeLock(dir, { toolName, callId: exec?.callId,  });
            await appendRequestLog({ event: 'resume_lock_acquired', resumeDir: dir });
          }
          const result = await tool.execute(args, exec);
          if (result?.resumeDir && args?.cumulativePreview !== true) {
            const record = await readPauseFile(result.resumeDir);
            record.deliveryPending = Boolean(result.deliveryError || result.ffmpegMissing);
            await writePauseFile(result.resumeDir, record);
          }
          await appendRequestLog({ event: 'tool_completed', elapsedMs: Date.now() - started,
            status: result?.status, paused: result?.paused, videoPath: result?.videoPath,
            segmentsDir: result?.segmentsDir, segmentCount: result?.segments?.length,
            actualSeconds: result?.actualSeconds, errorCode: result?.errorCode });
          return result;
        } catch (error) {
          await appendRequestLog({ event: 'tool_failed', elapsedMs: Date.now() - started, errorCode: String(error?.code || 'tool_error') });
          throw error;
        } finally {
          if (lock) { await lock.release(); await appendRequestLog({ event: 'resume_lock_released', resumeDir: dir }); }
        }
      });
    },
  };
}

async function writePauseFile(dir, data) {
  await mkdir(dir, { recursive: true, mode: 0o700 });
  const file = path.join(dir, PAUSE_FILE);
  // 先写唯一的临时文件、再原子 rename 顶上：并发读（另一次 resume）不会读到写到一半的 JSON。
  const temp = `${file}.${uniqueSuffix('part')}`;
  try {
    await writeFile(temp, `${JSON.stringify(data, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
    await rename(temp, file);
  } catch (failure) {
    await rm(temp, { force: true }).catch(() => {});
    throw failure;
  }
}

/**
 * 接着跑：默认沿用原计划剩下的段；这次传了更大的 duration 就按每段上限往后补延伸段。
 * @returns fullPlan 整条视频从头到尾的计划（暂停时写回记录用）、plan 这次要跑的部分、
 *   cursor 已经生成好的秒数、total 整条的总秒数。
 */
export function resumePlanFrom(data, { askedTotal, segmentSeconds }) {
  if(data.options?.productionStrategy==='independent_shots' && askedTotal!=null && askedTotal!==sumStepSeconds(data.plan || []))throw Error('INDEPENDENT_PLAN_CHANGE_REQUIRES_NEW_REVIEW');
  const done = Number(data.done) || 0;
  const cursor = Number(data.cursor) || 0;
  const fullPlan = (data.plan || []).map((step) => ({ ...step }));
  const remaining = fullPlan.slice(done).map((step) => ({ ...step }));
  const wanted = Number.isFinite(askedTotal) ? Math.min(askedTotal, MAX_TOTAL_SECONDS) : 0;
  const cap = segmentSeconds > 0 ? segmentSeconds : MAX_SEGMENT_SECONDS;
  let total = cursor + sumStepSeconds(remaining);
  while (wanted > total && fullPlan.length < MAX_SEGMENTS && total + MIN_SECONDS <= wanted) {
    const seconds = Math.max(MIN_SECONDS, Math.min(cap, wanted - total));
    fullPlan.push({ kind: 'extend', seconds });
    remaining.push({ kind: 'extend', seconds });
    total += seconds;
  }
  return { fullPlan, plan: remaining, cursor, total };
}

/** 续做时要沿用的参数：调用方只传 resume 时，靠这份记录还原上次的口径。 */
export function pickResumeOptions(args) {
  const keys = ['projectId', 'productionStrategy','shotDurations','shotFrames',
    'mode', 'ratio', 'generateAudio', 'watermark', 'segmentPrompts', 'transitionDescription', 'merge',
    // 这几个是 video_extend 的口径（延长方向、提示词写法、整片时间轴位置）
    'direction', 'wording', 'startAt', 'inputVideoSeconds',
    'firstFrameUrl', 'lastFrameUrl', 'referenceImages', 'characterReferenceImages', 'resolution', 'seed', 'user', 'returnLastFrame',
  ];
  const options = {};
  for (const key of keys) {
    if (args?.[key] !== undefined) options[key] = args[key];
  }
  return options;
}

/** 暂停时写进分段目录的记录：接着做时照它恢复计划、进度和最后一段的链接。 */
function pauseRecordAt({ stamp, prompt, fullPlan, done, cursor, lastVideoUrl, options, segments }) {
  return {
    plugin: 'metaontic-video',
    kind: 'paused-plan',
    version: 1,
    createdAt: new Date().toISOString(),
    stamp,
    prompt,
    plan: fullPlan,
    done,
    cursor,
    lastVideoUrl,
    options,
    steps: segments.map((segment) => ({
      index: segment.index,
      kind: segment.kind,
      seconds: segment.seconds,
      taskId: segment.taskId,
      videoUrl: segment.videoUrl,
    })),
  };
}

/** 暂停后怎么接着做：这段说明会交到模型手里，正是「循环迭代」的续做入口。 */
export function resumeHint(dir, remainingSeconds, toolName = 'video_generate') {
  return `要接着做就把 resume="${dir}" 再调一次 ${toolName}（prompt 可以省略，其余参数照旧）：`
    + `插件会接着已经生成的分段继续，已完成分段不重新生成；剩余 ${remainingSeconds} 秒仍需确认费用并计费。`;
}

/** Non-secret connection identity. Never copy API keys into progress files. */
function progressConnection(config) {
  return {
    provider: isVolcengine(config) ? 'volcengine' : 'metaontic',
    model: resolveModel(config), baseUrl: resolveBaseUrl(config),
    submitPath: resolveSubmitPath(config), queryPath: resolveQueryPath(config, '{task_id}'),
  };
}

export function assertResumeConnection(data, config, args) {
  if (!data?.connection) return; // Old records predate connection snapshots.
  if (JSON.stringify(data.connection) === JSON.stringify(progressConnection(config))) return;
  if (data.pendingTask || Object.values(data.operationState || {}).some((state: any) => state.phase === 'converting' || state.phase === 'review' || (state.retryUsed && !state.retryResult))) throw new Error('这份进度还有已提交的任务，请恢复原模型和接入渠道后查询，不能切换渠道重复提交。');
  if (args?.resumeWithCurrentConfig === true) {
    if (data.plan.slice(Number(data.done) || 0).some(step => step.seconds > modelMaxSeconds(config))) {
      throw new Error('原进度中的分段超过当前模型单段上限，请恢复原模型后继续，不自动缩短已审核分段。');
    }
    return;
  }
  throw new Error('当前模型或接入渠道与原进度不一致。请恢复原配置；如需更换，先向用户说明变化并确认，再传 resumeWithCurrentConfig:true。');
}

/** Persist before delivery, including pending task IDs and the final completed cursor. */
export async function saveProgress(dir, { config, toolName, stamp, prompt, fullPlan, cursor, referenceUrl, options, segments, pendingTask, operationState = {}, characterReferences = undefined }) {
  const completed = segments.filter(step => step.status === 'succeeded' && step.videoUrl);
  const record = pauseRecordAt({ stamp, prompt, fullPlan, done: completed.length, cursor,
    lastVideoUrl: referenceUrl, options, segments: completed });
  Object.assign(record, { toolName, connection: progressConnection(config),
    deliveryPending: !pendingTask && completed.length > 0,
    state: pendingTask ? 'pending' : completed.length >= fullPlan.length ? 'completed' : 'paused',
    pendingTask: pendingTask || null, operationState,
    ...(characterReferences !== undefined ? { characterReferences } : {}) });
  await writePauseFile(dir, record);
}
