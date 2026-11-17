import { validateIssueLifecycle, updateIssueRegistry } from './issues.js';
import { validateV31 } from './schema.js';
import { sourceRevisions } from './contracts.js';
import { validateReferences } from './references.js';
import { evaluateReview } from './review.js';
/** V2 创作数据与确定性校验。执行阶段独立于现有视频任务。 */
export const STAGES = ['creative', 'script', 'assets', 'shots', 'prompts', 'review'] as const;
export const ROLES = ['director', 'creative', 'screenwriter', 'character', 'scene', 'storyboard', 'prompt-engineer', 'reviewer'] as const;
export function validateTimeline(shots: any[], duration: number) {
  let end = 0;
  const ids = new Set();
  for (const shot of shots) {
    if (!shot.shot_id || ids.has(shot.shot_id)) throw Error('DUPLICATE_OR_MISSING_ID');
    ids.add(shot.shot_id);
    if (shot.duration_ms !== undefined && shot.duration_ms !== shot.end_ms-shot.start_ms) throw Error('SHOT_DURATION_MISMATCH');
    if (!Number.isSafeInteger(shot.start_ms) || !Number.isSafeInteger(shot.end_ms) || shot.start_ms !== end || shot.end_ms <= end) throw Error('GAP_OR_OVERLAP');
    end = shot.end_ms;
  }
  if (end !== duration) throw Error('DURATION_MISMATCH');
}
export function validateArtifact(stage: string, value: any, state: any) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('INVALID_ARTIFACT');
  const nonempty = (key: string) => { if (typeof value[key] !== 'string' || !value[key].trim()) throw Error(`MISSING_FIELD:${key}`); };
  validateV31(stage,value,state);
  validateReferences(stage,value,state);
  if (stage === 'creative') {
    nonempty('theme'); nonempty('logline');
    if (value.structure !== undefined) {
      if (!Array.isArray(value.structure) || !value.structure.length) throw Error('INVALID_CREATIVE_STRUCTURE');
      const ids=value.structure.map(s=>s?.section_id);
      if (ids.some(id=>typeof id!=='string'||!id.trim()) || new Set(ids).size!==ids.length) throw Error('INVALID_SECTION_ID');
      if (value.structure.some(s=>!Number.isSafeInteger(s.duration_ms)||s.duration_ms<=0) || value.structure.reduce((n,s)=>n+s.duration_ms,0)!==state.duration_ms) throw Error('CREATIVE_DURATION_MISMATCH');
    }
    if (value.approval_questions !== undefined && (!Array.isArray(value.approval_questions)||value.approval_questions.length>3)) throw Error('TOO_MANY_CREATIVE_QUESTIONS');
  }
  if (stage === 'script') { nonempty('screenplay'); if (!Array.isArray(value.chapters) || !value.chapters.length || value.chapters.some(c => !Number.isSafeInteger(c.duration_ms) || c.duration_ms <= 0) || value.chapters.reduce((n,c) => n+c.duration_ms,0) !== state.duration_ms) throw Error('CHAPTER_DURATION_MISMATCH'); }
  if (stage === 'script') {
    if (value.approved_creative_revision !== undefined && value.approved_creative_revision !== state.approvals.creative) throw Error('CREATIVE_REVISION_MISMATCH');
    if (value.scenes !== undefined) {
      if (!Array.isArray(value.scenes) || !value.scenes.length) throw Error('INVALID_SCRIPT_SCENES');
      const ids=value.scenes.map(s=>s?.scene_id);
      if (ids.some(id=>typeof id!=='string'||!id.trim()) || new Set(ids).size!==ids.length) throw Error('INVALID_SCENE_ID');
      const chapterIds=value.chapters.map(c=>c.chapter_id);
      if (chapterIds.some(id=>typeof id!=='string'||!id.trim()) || new Set(chapterIds).size!==chapterIds.length) throw Error('INVALID_CHAPTER_ID');
      if (value.scenes.some(s=>!chapterIds.includes(s.chapter_id)||!Number.isSafeInteger(s.duration_ms)||s.duration_ms<=0)) throw Error('INVALID_SCENE_BUDGET');
      for (const chapter of value.chapters) {
        const scenes=value.scenes.filter(s=>s.chapter_id===chapter.chapter_id);
        if (!scenes.length || scenes.reduce((n,s)=>n+s.duration_ms,0)!==chapter.duration_ms) throw Error('SCENE_DURATION_MISMATCH');
        if (chapter.scene_ids !== undefined && (!Array.isArray(chapter.scene_ids)||chapter.scene_ids.length!==scenes.length||new Set(chapter.scene_ids).size!==scenes.length||chapter.scene_ids.some(id=>!scenes.some(s=>s.scene_id===id)))) throw Error('SCRIPT_SCENE_REF_MISMATCH');
      }
      if (value.dialogue !== undefined && (!Array.isArray(value.dialogue)||value.dialogue.some(d=>!d||typeof d.speaker_id!=='string'||!d.speaker_id.trim()||!ids.includes(d.scene_id)))) throw Error('INVALID_DIALOGUE_REF');
    }
  }
  if (stage === 'assets') for (const key of ['characters','scenes']) {
    if (!Array.isArray(value[key])) throw Error(`MISSING_FIELD:${key}`);
    const ids = value[key].map(v => v[key === 'characters' ? 'character_id' : 'scene_id']);
    if (ids.some(id => typeof id !== 'string' || !id) || new Set(ids).size !== ids.length) throw Error('INVALID_ASSET_ID');
  }
  if (stage === 'shots') {
    if (!Array.isArray(value.shots)) throw Error('MISSING_SHOTS');
    validateTimeline(value.shots, state.duration_ms);
    const assets = state.artifacts.assets.data;
    for (const shot of value.shots) if (!assets.scenes.some(s => s.scene_id === shot.scene_id) || !Array.isArray(shot.character_ids) || shot.character_ids.some(id => !assets.characters.some(c => c.character_id === id))) throw Error('MISSING_REF');
  }
  if (stage === 'prompts') {
    if (!Array.isArray(value.prompts)) throw Error('MISSING_PROMPTS');
    const shots = state.artifacts.shots.data.shots;
    const ids = value.prompts.map(p => p.shot_id);
    if (new Set(ids).size !== ids.length || ids.length !== shots.length || shots.some(s => !ids.includes(s.shot_id)) || value.prompts.some(p => typeof p.prompt !== 'string' || !p.prompt.trim())) throw Error('PROMPT_COVERAGE');
  }
  if (stage === 'review' && value.review_status !== undefined) { evaluateReview(value); validateIssueLifecycle(value,state); return; }
  if (stage === 'review' && Array.isArray(value.issues) && value.issues.some(i => !i || !['blocker','major','minor','info'].includes(String(i.severity).toLowerCase()))) throw Error('INVALID_SEVERITY');
  if (stage === 'review' && (!Number.isInteger(value.score) || value.score < 85 || value.score > 100 || !Array.isArray(value.issues) || value.issues.some(i => String(i.severity).toLowerCase() === 'blocker') || value.passed !== true)) throw Error('REVIEW_BLOCKED');
}
export function commitArtifact(state: any, stage: string, value: any, expected: number) {
  if (state.revision !== expected) throw Error('REVISION_CONFLICT');
  if (state.status === 'STOPPED') throw Error('PROJECT_STOPPED');
  const index = STAGES.indexOf(stage as any);
  if (index < 0) throw Error('INVALID_STAGE');
  for (const upstream of STAGES.slice(0,index)) {
    if (!state.artifacts[upstream] || state.artifacts[upstream].stale) throw Error('UPSTREAM_REQUIRED');
    if (['creative','script'].includes(upstream) && state.approvals[upstream] !== state.artifacts[upstream].revision) throw Error('APPROVAL_REQUIRED');
  }
  validateArtifact(stage,value,state);
  const next = structuredClone(state);
  next.revision++;
  if(stage==='review' && state.schema_version==='3.1.0') updateIssueRegistry(next,value);
  next.artifacts[stage] = { revision: next.revision, source_revisions:sourceRevisions(state,stage), data: value, stale: false };
  for (const downstream of STAGES.slice(index+1)) if (next.artifacts[downstream]) next.artifacts[downstream].stale = true;
  for (const approved of ['creative','script']) if (STAGES.indexOf(approved as any) >= index) delete next.approvals[approved];
  next.status = ['creative','script'].includes(stage) ? `WAIT_${stage.toUpperCase()}_APPROVAL` : stage === 'review' ? (value.review_status && !evaluateReview(value).passed ? value.review_status : 'FINAL_DELIVERY') : `${stage.toUpperCase()}_READY`;
  return next;
}
export function exportMarkdown(state: any) {
  return `# ${state.title}\n\nRevision: ${state.revision}\n\n` + STAGES.filter(s => state.artifacts[s]).map(s => `## ${s}${state.artifacts[s].stale ? ' (stale)' : ''}\n\n\`\`\`json\n${JSON.stringify(state.artifacts[s].data,null,2)}\n\`\`\``).join('\n\n');
}
