import { createHash } from 'node:crypto';
import { sourceRevisions, revisionsEqual } from '../contracts/index.js';
export const reportDigest=(report:unknown)=>createHash('sha256').update(JSON.stringify(report)).digest('hex');
export function validateReviewProvenance(state:any,report:any) {
 if(state.review_policy!=='isolated_v1')return;
 const receipt=state.independent_review_receipt;
 if(!receipt||receipt.report_digest!==reportDigest(report)||!revisionsEqual(receipt.input_revisions,sourceRevisions(state,'review')))throw Error('INDEPENDENT_REVIEW_REQUIRED');
}
