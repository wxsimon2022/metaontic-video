import { createHash, randomUUID } from 'node:crypto';
import { readFile, writeFile, rename, rm } from 'node:fs/promises';

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  return JSON.stringify(value) ?? 'null';
}
export const operationDigest = (value: unknown) => createHash('sha256').update(canonical(value)).digest('hex');
export function operationUuid(value: unknown) {
  const h = operationDigest(value);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
}
export function creationIdentity(owner: string, args: any) {
  const digest = operationDigest({ title: args.title, brief: args.sourceBrief, duration: args.durationSeconds,
    projectSpec: args.projectSpec ? JSON.parse(args.projectSpec) : {}, ratio: args.ratio, resolution: args.resolution });
  return { digest, id: operationUuid({ owner, create: args.operationId || digest }) };
}
export async function readJson<T>(file: string, fallback: T): Promise<T> {
  try { return JSON.parse(await readFile(file, 'utf8')); }
  catch (error) { if (error?.code === 'ENOENT') return fallback; throw error; }
}
export async function atomicJson(file: string, value: unknown) {
  const temporary = `${file}.${randomUUID()}.tmp`;
  try { await writeFile(temporary, JSON.stringify(value), { mode: 0o600, flag: 'wx' }); await rename(temporary, file); }
  finally { await rm(temporary, { force: true }).catch(() => {}); }
}

export interface ReviewAttempt { status: 'in_flight' | 'response_saved' | 'retry_authorized'; at: string; response?: any }
export type ReviewJournal = Record<string, ReviewAttempt[]>;
/** 调用前先持久化；不确定的付费请求不自动重放。原始回包只留本地，先落盘再解析。 */
export async function journaledReview(file: string, key: string, complete: () => Promise<any>) {
  const journal = await readJson<ReviewJournal>(file, {});
  const attempts = journal[key] || [];
  const previous = attempts.at(-1);
  if (previous?.status === 'response_saved') return previous.response;
  if (previous?.status === 'in_flight') throw Error('REVIEW_REQUEST_UNCERTAIN:上次文本审核结果不明，未重复调用。先查看review_requests；核对后需要重试时调用retry_review后再执行independent_review，不弹额外确认窗。');
  const attempt: ReviewAttempt = { status: 'in_flight', at: new Date().toISOString() };
  attempts.push(attempt); journal[key] = attempts;
  await atomicJson(file, journal);
  const response = await complete();
  attempt.status = 'response_saved'; attempt.response = response;
  await atomicJson(file, journal);
  return response;
}
export async function reviewRequestSummary(file: string) {
  const journal = await readJson<ReviewJournal>(file, {});
  return Object.entries(journal).map(([key, attempts]) => ({ key, attempts: attempts.length,
    status: attempts.at(-1)?.status, at: attempts.at(-1)?.at, has_response: attempts.at(-1)?.response !== undefined }));
}
export async function authorizeReviewRetry(file: string, key: string) {
  if (!/^[a-f0-9]{64}$/.test(key || '')) throw Error('INVALID_REVIEW_REQUEST_KEY');
  const journal = await readJson<ReviewJournal>(file, {});
  if (!journal[key]?.length) throw Error('REVIEW_REQUEST_NOT_FOUND');
  if (journal[key].at(-1).status === 'retry_authorized') return;
  journal[key].push({ status: 'retry_authorized', at: new Date().toISOString() });
  await atomicJson(file, journal);
}
