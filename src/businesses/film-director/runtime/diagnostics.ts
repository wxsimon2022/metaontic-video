import { performance } from 'node:perf_hooks';
import { appendRequestLog } from '../../../core/utils/logging.js';
const ACTIONS=['create','read','validate','submit','approve','export','next','compile','revise','schedule','task_result','route','verify_issue','configure_profile','diagnose','recover_lock'];
const STAGES=['creative','script','assets','shots','prompts','review'];
export function withFilmDiagnostics(tool:any) {
 return {...tool,async execute(args:any,exec:any) {
  const started=performance.now();let result:any;let outcome='failed';let category='INTERNAL_ERROR';
  try{result=await tool.execute(args,exec);outcome='success';return result;}
  catch(e:any){const code=String(e?.message||'').split(':')[0];category=/^[A-Z_]{1,70}$/.test(code)?code:'INTERNAL_ERROR';throw e;}
  finally{await appendRequestLog({event:'film_stage_finished',action:ACTIONS.includes(args.action)?args.action:'unknown',stage:STAGES.includes(args.stage)?args.stage:null,elapsedMs:Math.round(performance.now()-started),outcome,errorCode:outcome==='failed'?category:undefined,responseBytes:result?Buffer.byteLength(JSON.stringify(result)):0});}
 }};
}
