import { performance } from 'node:perf_hooks';
import { diagnosticError } from '../../../shared/utils/timing.js';
import { appendRequestLog } from '../../../shared/utils/logging.js';
const ACTIONS=['create','read','validate','submit','approve','export','next','compile','revise','schedule','task_result','route','verify_issue','configure_profile','diagnose','recover_lock'];
const STAGES=['creative','script','assets','shots','prompts','review'];
export function filmOutput(value:any) {
 const text=JSON.stringify(value,(_key,item)=>{
  if(typeof item==='number'&&!Number.isFinite(item))throw Error('INVALID_FILM_OUTPUT:nonfinite_number');
  return item;
 });
 if(text===undefined)throw Error('INVALID_FILM_OUTPUT:empty_result');
 // 持久化协议使用 JSON；省略可选 undefined 字段，避免宿主在 execute 返回后拒收已保存项目。
 return JSON.parse(text);
}
export function withFilmDiagnostics(tool:any) {
 return {...tool,async execute(args:any,exec:any) {
  const started=performance.now();let result:any;let outcome='failed';let category='INTERNAL_ERROR';let errorCategory='internal';
  try{result=filmOutput(await tool.execute(args,exec));outcome=['failed','blocked','review_required','partial'].includes(result?.status)?result.status:'success';return result;}
  catch(e:any){const code=String(e?.message||'').split(':')[0];category=/^[A-Z_]{1,70}$/.test(code)?code:diagnosticError(e).errorCode;errorCategory=diagnosticError({code:category}).errorCategory;throw e;}
  finally{await appendRequestLog({event:'film_stage_finished',action:ACTIONS.includes(args.action)?args.action:'unknown',stage:STAGES.includes(args.stage)?args.stage:null,projectId:args.projectId||result?.project_id,callId:exec?.callId,sessionId:exec?.agent?.session?.id,elapsedMs:Math.round(performance.now()-started),outcome,errorCode:outcome==='failed'?category:undefined,errorCategory:outcome==='failed'?errorCategory:undefined,responseBytes:result?Buffer.byteLength(JSON.stringify(result)):0});}
 }};
}
