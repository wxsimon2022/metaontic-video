/** 共享人物参考与逐镜首尾帧分开；省略的逐镜字段不继承其他镜头。 */
export function validateShotFrames(args:any,count:number) {
 if(args.shotFrames===undefined)return;
 if(args.productionStrategy!=='independent_shots'||!Array.isArray(args.shotFrames)||args.shotFrames.length!==count)throw Error('INVALID_SHOT_FRAMES');
 for(const frame of args.shotFrames)if(!frame||typeof frame!=='object'||Array.isArray(frame)||Object.keys(frame).some(k=>!['firstFrameUrl','lastFrameUrl'].includes(k))||Object.values(frame).some(v=>typeof v!=='string'||!v.trim()))throw Error('INVALID_SHOT_FRAMES');
}
export function shotMaterials(args:any,index:number,count:number) {
 if(args.productionStrategy!=='independent_shots')return {...args};
 validateShotFrames(args,count);
 const selected=args.shotFrames?.[index] || {};
 return {...args,firstFrameUrl:selected.firstFrameUrl ?? (index===0?args.firstFrameUrl:undefined),lastFrameUrl:selected.lastFrameUrl ?? (index===count-1?args.lastFrameUrl:undefined)};
}
