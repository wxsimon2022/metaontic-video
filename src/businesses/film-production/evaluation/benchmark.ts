import { evaluateStory } from './story-evaluation.js';
interface Evidence { scene_id: string; reason: string }
interface ConstraintAssessment { constraint: string; status: 'PRESERVED' | 'VIOLATED' | 'UNKNOWN'; evidence: Evidence[] }
export interface BenchmarkRecord {
 case_id: string; script: any; assessment?: any;
 constraints?: { reviewer: string; items: ConstraintAssessment[] };
 measurements?: { source: 'recorded' | 'manual'; tool_calls?: number; revision_rounds?: number; cost?: number; currency?: string };
}
const finite = (value: unknown) => typeof value === 'number' && Number.isFinite(value) && value >= 0;
/** 评测只比较已提供的证据；没有语义评阅、真实用量或人工偏好时保持未知。 */
export function evaluateBenchmark(cases: any[], records: BenchmarkRecord[]) {
 if (!Array.isArray(records) || new Set(records.map(record => record.case_id)).size !== records.length) throw Error('DUPLICATE_BENCHMARK_CASE');
 if (records.length !== cases.length || cases.some(item => !records.some(record => record.case_id === item.id))) throw Error('BENCHMARK_CASE_COVERAGE');
 return { protocol: 'film_benchmark_v1', results: cases.map(test => {
  const record = records.find(item => item.case_id === test.id);
  if (!record.script || !Array.isArray(record.script.scenes) || !Array.isArray(record.script.dialogue)) throw Error('INVALID_BENCHMARK_SCRIPT');
  const quality = evaluateStory(record.script, record.assessment);
  const sceneIds = new Set(record.script.scenes.map(scene => scene.scene_id));
  const constraints = record.constraints;
  if (constraints) {
   if (!constraints.reviewer?.trim() || !Array.isArray(constraints.items) || constraints.items.length !== test.must_preserve.length) throw Error('CONSTRAINT_EVALUATOR_REQUIRED');
   for (const constraint of test.must_preserve) {
    const items = constraints.items.filter(item => item.constraint === constraint);
    const item = items[0];
    if (items.length !== 1 || !['PRESERVED', 'VIOLATED', 'UNKNOWN'].includes(item.status)) throw Error('CONSTRAINT_EVALUATION_COVERAGE');
    if (item.status !== 'UNKNOWN' && (!Array.isArray(item.evidence) || !item.evidence.length || item.evidence.some(e => !sceneIds.has(e.scene_id) || !e.reason?.trim()))) throw Error('CONSTRAINT_EVALUATION_EVIDENCE');
   }
  }
  const measure = record.measurements;
  if (measure) {
   if (!['recorded', 'manual'].includes(measure.source)) throw Error('MEASUREMENT_SOURCE_REQUIRED');
   for (const key of ['tool_calls', 'revision_rounds', 'cost']) if (measure[key] !== undefined && !finite(measure[key])) throw Error('INVALID_BENCHMARK_MEASUREMENT');
   if (measure.cost !== undefined && !/^[A-Z]{3}$/.test(measure.currency || '')) throw Error('MEASUREMENT_CURRENCY_REQUIRED');
  }
  const actual = (record.script.scenes as any[]).reduce((sum, scene) => sum + (finite(scene.duration_ms) ? scene.duration_ms : 0), 0);
  return { case_id: test.id, quality, duration_matches: actual === test.duration_ms,
   constraints: constraints?.items || test.must_preserve.map(constraint => ({ constraint, status: 'UNKNOWN', evidence: [] })),
   measurements: measure || null };
 }) };
}
export function compareBenchmarks(cases: any[], baseline: BenchmarkRecord[], candidate: BenchmarkRecord[], preference?: any) {
 const before = evaluateBenchmark(cases, baseline), after = evaluateBenchmark(cases, candidate);
 if (preference && (!preference.reviewer?.trim() || !Array.isArray(preference.items) || preference.items.length !== cases.length)) throw Error('PREFERENCE_EVALUATOR_REQUIRED');
 const rows = after.results.map((current, index) => {
  const previous = before.results[index];
  let vote = null;
  if (preference) {
   const votes = preference.items.filter(item => item.case_id === current.case_id);
   if (votes.length !== 1 || !['baseline', 'candidate', 'tie', 'unrated'].includes(votes[0].choice) || !votes[0].reason?.trim()) throw Error('INVALID_PREFERENCE');
   vote = votes[0];
  }
  const left = previous.measurements, right = current.measurements;
  const delta = (key: string) => finite(left?.[key]) && finite(right?.[key]) ? right[key] - left[key] : null;
  return { case_id: current.case_id, baseline: previous, candidate: current,
   delta: { tool_calls: delta('tool_calls'), revision_rounds: delta('revision_rounds'),
    cost: left?.currency && left.currency === right?.currency ? delta('cost') : null,
    currency: left?.currency === right?.currency ? left?.currency || null : null }, preference: vote };
 });
 return { protocol: before.protocol, cases: rows, note: '离线比较提供的产物和评阅证据；不代表已执行模型链路，不将未评阅项计为通过。' };
}
