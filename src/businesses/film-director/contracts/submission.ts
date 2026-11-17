import { validateArtifact } from '../runtime/project.js';
import { STAGE_ARRAYS, ITEM_ARRAYS } from './fields.js';
/** 仅检查候选，不写材料、不改变修订或批准，更不补造剧情道具。 */
export function checkSubmission(state:any,stage:string,content:string) {
 let data:any;
 try {data=JSON.parse(content);} catch {
  return {valid:false,error_code:'INVALID_ARTIFACT_JSON',issues:[{path:'content',message:'材料不是合法 JSON。检查多余字符、逗号、引号或代码围栏；保留原内容，只修正格式后重新校验。'}],expectedRevision:state.revision};
 }
 const arrays=STAGE_ARRAYS[stage]||[];
 if(!data||typeof data!=='object'||Array.isArray(data))return {valid:false,error_code:'INVALID_ARTIFACT',issues:[{path:'content',message:'材料顶层必须是 JSON 对象。'}],expectedRevision:state.revision};
 const issues=arrays.filter(k=>!Array.isArray(data[k])).map(k=>({path:k,message:`顶层 ${k} 必须是数组。无适用内容时显式提供 []；如有已批准内容，须完整保留，不得为通过校验清空。`}));
 for(const [collection,fields] of Object.entries(ITEM_ARRAYS[stage]||{})) {
  if(!Array.isArray(data[collection]))continue;
  data[collection].forEach((item,index)=>{
   if(!item||typeof item!=='object'||Array.isArray(item)){issues.push({path:`${collection}[${index}]`,message:'必须是对象。'});return;}
   for(const key of fields)if(!Array.isArray(item[key]))issues.push({path:`${collection}[${index}].${key}`,message:`${key} 必须是数组；从已批准登记表填写本镜引用，无对应内容才使用 []。`});
  });
 }
 if(issues.length)return {valid:false,error_code:'REQUIRED_ARTIFACT_ARRAYS',issues,expectedRevision:state.revision};
 try {validateArtifact(stage,data,state);}catch(error) {
  return {valid:false,error_code:'ARTIFACT_VALIDATION_FAILED',issues:[{path:stage,message:String(error?.message||'材料未通过校验')}],expectedRevision:state.revision};
 }
 return {valid:true,stage,expectedRevision:state.revision,next_action:'submit',note:'仅候选材料校验通过，尚未保存或批准；submit 仍校验依赖、审批和当前修订。'};
}
