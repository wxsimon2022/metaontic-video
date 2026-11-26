import type { Stage } from './types.js';
export const FILM_ACTIONS = ['create', 'read', 'validate', 'submit', 'approve', 'export', 'next', 'compile', 'revise', 'schedule', 'task_result', 'route', 'verify_issue', 'configure_profile', 'diagnose', 'recover_lock', 'chapter_plan', 'chapter_submit', 'review_context', 'independent_review', 'capabilities', 'review_requests', 'retry_review'] as const;
export type FilmAction = typeof FILM_ACTIONS[number];
export const READ_ACTIONS: readonly FilmAction[] = ['read', 'next', 'route', 'validate', 'export', 'diagnose', 'review_context', 'capabilities', 'review_requests'];
interface BaseCommand { action: FilmAction; projectId?: string; expectedRevision?: number; responseMode?: 'compact' | 'full'; stage?: Stage }
export type FilmCommand = BaseCommand & (
  { action: 'create'; title: string; sourceBrief: string; durationSeconds: number; operationId?: string; projectSpec?: string; ratio?: string; resolution?: string } |
  { action: 'submit' | 'validate' | 'revise' | 'chapter_plan' | 'chapter_submit' | 'configure_profile' | 'verify_issue'; content?: string; projectSpec?: string; continuity?: string; payload: any } |
  { action: 'retry_review'; requestKey: string } |
  { action: Exclude<FilmAction, 'create' | 'submit' | 'validate' | 'revise' | 'chapter_plan' | 'chapter_submit' | 'configure_profile' | 'verify_issue' | 'retry_review'> }
);
/** 工具 Schema 保持宿主兼容；入口按动作校验，不再让缺参数一路进入磁盘或模型调用。 */
export function parseFilmCommand(raw: any): FilmCommand & Record<string, any> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw) || !FILM_ACTIONS.includes(raw.action)) throw Error('INVALID_ACTION');
  const args = { ...raw };
  if (args.action !== 'create' && !/^[a-f0-9-]{36}$/.test(args.projectId || '')) throw Error('INVALID_PROJECT_ID:除create外，必须在工具参数顶层传projectId，复制最近返回的project_id；content内部project_id不能替代。保留已有材料，不重新create。');
  if (!READ_ACTIONS.includes(args.action) && !['create', 'recover_lock'].includes(args.action)
    && (!Number.isSafeInteger(args.expectedRevision) || args.expectedRevision < 0)) throw Error('EXPECTED_REVISION_REQUIRED:写操作须在工具参数顶层传expectedRevision，使用最近工具返回的项目revision或expectedRevision，不使用产物修订号，不默认填0；状态不明先read原项目。');
  if (args.responseMode !== undefined && !['compact', 'full'].includes(args.responseMode)) throw Error('INVALID_RESPONSE_MODE');
  if (args.operationId !== undefined && (typeof args.operationId !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(args.operationId))) throw Error('INVALID_OPERATION_ID');
  if (['submit', 'validate', 'approve', 'revise', 'chapter_submit'].includes(args.action)
    && !['creative', 'script', 'assets', 'shots', 'prompts', 'review'].includes(args.stage)) throw Error('INVALID_STAGE');
  if (args.action === 'create') {
    if (!Number.isInteger(args.durationSeconds) || args.durationSeconds < 15 || args.durationSeconds > 3600 || typeof args.title !== 'string' || !args.title.trim() || typeof args.sourceBrief !== 'string' || !args.sourceBrief.trim()) throw Error('INVALID_REQUIREMENTS');
    if (args.projectSpec !== undefined) {
      let spec; try { spec = JSON.parse(args.projectSpec); } catch { throw Error('INVALID_PROJECT_SPEC_JSON'); }
      if (!spec || typeof spec !== 'object' || Array.isArray(spec)) throw Error('INVALID_PROJECT_SPEC_JSON');
    }
  }
  if (args.action === 'chapter_submit') {
    if (typeof args.chapterId !== 'string' || !args.chapterId.trim()) throw Error('CHAPTER_ID_REQUIRED:chapter_submit必须在工具参数顶层传chapterId，使用当前章节任务chapter.chapter_id。');
    let continuity;
    try { continuity = JSON.parse(args.continuity); } catch { throw Error('CHAPTER_CONTINUITY_REQUIRED:chapter_submit必须传continuity JSON字符串，包含established_facts数组、unresolved_threads数组、character_state对象。'); }
    if (!continuity || typeof continuity !== 'object' || Array.isArray(continuity) || !Array.isArray(continuity.established_facts) || !Array.isArray(continuity.unresolved_threads) || !continuity.character_state || typeof continuity.character_state !== 'object' || Array.isArray(continuity.character_state)) throw Error('CHAPTER_CONTINUITY_REQUIRED:continuity必须包含established_facts数组、unresolved_threads数组、character_state对象；只记录已知事实。');
  }
  if (args.action === 'task_result' && (typeof args.taskKey !== 'string' || !args.taskKey || !['running', 'completed', 'failed'].includes(args.taskStatus))) throw Error('INVALID_TASK_RESULT');
  if (args.action === 'verify_issue' && (typeof args.issueId !== 'string' || !args.issueId)) throw Error('ISSUE_ID_REQUIRED');
  if (args.materialPart !== undefined && (!Number.isSafeInteger(args.materialPart) || args.materialPart < 1)) throw Error('INVALID_MATERIAL_PART');
  if (args.action === 'retry_review' && !/^[a-f0-9]{64}$/.test(args.requestKey || '')) throw Error('INVALID_REVIEW_REQUEST_KEY');
  if (args.entityIds !== undefined && (!Array.isArray(args.entityIds) || args.entityIds.some(id => typeof id !== 'string' || !id))) throw Error('INVALID_ENTITY_IDS');
  const jsonField = args.action === 'configure_profile' ? 'projectSpec'
    : ['submit', 'revise', 'chapter_plan', 'chapter_submit', 'verify_issue'].includes(args.action) ? 'content' : null;
  if (jsonField) {
    if (typeof args[jsonField] !== 'string') throw Error('JSON_CONTENT_REQUIRED');
    try { args.payload = JSON.parse(args[jsonField]); } catch { throw Error(args.action === 'submit' ? 'INVALID_ARTIFACT_JSON' : 'INVALID_COMMAND_JSON'); }
    const array = ['revise', 'chapter_plan'].includes(args.action);
    if (!args.payload || typeof args.payload !== 'object' || Array.isArray(args.payload) !== array) throw Error(`INVALID_COMMAND_PAYLOAD:${args.action}的${jsonField}必须是${array ? 'JSON数组' : 'JSON对象'}字符串，不带Markdown围栏；只修正参数形状，保留原内容与项目。`);
  }
  return args;
}
