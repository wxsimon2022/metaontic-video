import type { ReviewReport } from '../contracts/types.js';
/** Reviewer V3.1评分和交付判定由程序复算；旧报告保持原有口径。 */
const WEIGHTS={requirement_fidelity:20,narrative_quality:15,character_consistency:10,scene_consistency:10,cinematic_quality:15,temporal_consistency:10,prompt_executability:15,structural_completeness:5};
export function evaluateReview(report: ReviewReport) {
 if (!['PASS','PASS_WITH_WARNINGS','REVISE_REQUIRED','BLOCKED','NOT_EVALUATED'].includes(report.review_status) || !report.scores || !Array.isArray(report.issues)) throw Error('INVALID_REVIEW_REPORT');
 let sum=0,weight=0;
 for(const [key,w] of Object.entries(WEIGHTS)) {
  const value=report.scores[key];
  if(value===null)continue;
  if(!Number.isFinite(value)||value<0||value>100)throw Error('INVALID_REVIEW_SCORE');
  sum+=value*w;weight+=w;
 }
 const score=weight?Math.round(sum/weight*100)/100:null;
 for(const issue of report.issues) if(!issue || !['CRITICAL','MAJOR','MINOR','INFO'].includes(issue.severity)||!['OPEN','IN_PROGRESS','RESOLVED','VERIFIED','WONT_FIX'].includes(issue.status))throw Error('INVALID_REVIEW_ISSUE');
 const blockers=report.issues.filter(i=>['CRITICAL','MAJOR'].includes(i.severity)&&i.status!=='VERIFIED').length;
 const passed=['PASS','PASS_WITH_WARNINGS'].includes(report.review_status)&&score!==null&&score>=80&&blockers===0;
 if(report.delivery_allowed!==passed || (report.passed!==undefined&&report.passed!==passed) || (report.blocking_issue_count!==undefined&&report.blocking_issue_count!==blockers))throw Error('REVIEW_DECISION_MISMATCH');
 if(['PASS','PASS_WITH_WARNINGS'].includes(report.review_status)&&!passed)throw Error('REVIEW_BLOCKED');
 if(report.weighted_score!==undefined&&report.weighted_score!==score)throw Error('REVIEW_SCORE_MISMATCH');
 return {score,passed,blockers};
}
