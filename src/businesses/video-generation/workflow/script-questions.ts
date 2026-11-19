import {createHash} from 'node:crypto';
/** 从明确的确认章节读取问题；不将风险、建议或已确认说明变成人工审批。 */
export function pendingScriptQuestions(script:string):string[] {
 const result:string[]=[];let active=false,depth=0;
 const headingTitle=(text:string)=>text.replace(/[*`]/g,'').replace(/^[一二三四五六七八九十\d]+[、.．）)]\s*/,'').trim();
 const isPending=(text:string)=>/^(?:用户)?(?:待(?:用户)?确认(?:的)?(?:问题|事项)?|确认事项)(?:\s*[（(:：]|\s*$)/.test(text);
 for(const raw of script.split(/\r?\n/)) {
  const line=raw.trim();const heading=/^(#{1,6})\s+(.+)$/.exec(line);
  const bold=/^\*\*(.+?)\*\*[:：]?$/.exec(line);
  if(heading||bold) {
   const level=heading?heading[1].length:2,title=headingTitle(heading?heading[2]:bold[1]);
   if(active&&level<=depth)active=false;
   if(isPending(title)){active=true;depth=level;}
   continue;
  }
  if(!active)continue;
  const value=line.replace(/^(?:[-*+]\s+(?:\[[ xX]\]\s*)?|\d+[.、）)]\s*)/,'').trim();
  if(!value||/^[-*_\s]+$/.test(value)||/^(?:无|暂无|无待确认(?:事项|问题)?|无需确认|均已确认|已全部确认)[。.!！]?$/.test(value))continue;
  result.push(value);
 }
 return [...new Set(result)];
}
export function questionId(question:string) {
 return 'script_pending_'+createHash('sha256').update(question.replace(/\s/g,'')).digest('hex').slice(0,20);
}
/** 删除标题或问题不能抹去未回答的记录；答复只有来自宿主提问服务才写入。 */
export function syncScriptQuestions(project:any,questions:string[],scriptHash:string) {
 const records=project.clarifications ||= [];
 for(const question of questions) {
  const id=questionId(question);
  if(!records.some(item=>item.id===id))records.push({id,question,status:'PENDING',introducedScriptHash:scriptHash});
 }
 const current=new Set(questions.map(questionId));
 for(const item of records) {
  if(current.has(item.id)&&item.status==='APPLIED')item.status='ANSWERED';
  if(item.status==='ANSWERED'&&!current.has(item.id)&&item.answeredScriptHash!==scriptHash){item.status='APPLIED';item.appliedScriptHash=scriptHash;}
 }
 return records.filter(item=>item.status!=='APPLIED');
}
export function recordQuestionAnswers(records:any[],asked:any[],result:any,scriptHash:string,aborted:boolean) {
 if(aborted)return;
 for(const item of asked) {
  const answer=result?.answers?.find(value=>value.id===item.id);
  // 本组为自由输入问题，没有可选项；其他审批答复或空答复不能冒充本问题的答案。
  const text=typeof answer?.custom==='string'?answer.custom.trim():'';
  if(!text)continue;
  const record=records.find(value=>value.id===item.id);
  record.answer=text;record.status='ANSWERED';record.answeredScriptHash=scriptHash;record.answeredAt=new Date().toISOString();
 }
}
