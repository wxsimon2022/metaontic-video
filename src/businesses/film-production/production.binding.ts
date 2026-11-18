import { createHash } from 'node:crypto';
const KEYS=['prompt','segmentPrompts','duration','ratio','resolution','productionStrategy','shotDurations','mode','transitionDescription'];
export function productionDigest(spec:any) {
 return createHash('sha256').update(JSON.stringify(KEYS.map(k=>[k,spec?.[k]??(k==='productionStrategy'?'continuous_segments':k==='mode'?'continuous':null)]))).digest('hex');
}
export function assertCompiledProduction(project:any,source:any,spec:any,actualModel?:string) {
 if(!project.filmSource)return;
 if(actualModel && project.filmSource.model_name && project.filmSource.model_name!==actualModel)throw Error('COMPILED_MODEL_MISMATCH:制作模型已改变，请修订项目模型并重新编译审核。');
 if(source.revision!==project.filmSource.revision)throw Error('创作项目已改稿，请重新编译制作计划并审核。');
 const expected=source.production;
 if(!expected||expected.videoProjectId!==project.id||expected.source_revision!==source.revision||!project.filmSource.plan_digest||productionDigest(expected.specification)!==project.filmSource.plan_digest)throw Error('COMPILED_PLAN_REQUIRED:请重新编译专业制作方案。');
 if(productionDigest(spec)!==project.filmSource.plan_digest)throw Error('COMPILED_PLAN_MISMATCH:提示词、分段或规格与批准的编译方案不一致，请回到专业项目修订并重审。');
}
