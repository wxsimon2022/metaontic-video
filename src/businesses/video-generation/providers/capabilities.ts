/** 本地适配器能力，不声称已对任意中转渠道实测。 */
export function videoCapabilities(model: string) {
 const known=/^(?:doubao-)?seedance-2[-.](0|5)(?:-|$)/i.test(model);
 const omni=/seedance-2[-.]5(?:-|$)/i.test(model);
 return {model_name:model,profile_revision:'adapter-1',capability_status:known?'ADAPTER_DEFINED':'UNVERIFIED',
  generation_modes:known?['TEXT_TO_VIDEO','IMAGE_TO_VIDEO']:null,
  supported_durations_ms:known?{min:4000,max:omni?30000:15000,step:1000}:null,
  supported_aspect_ratios:known?['16:9','9:16','4:3','3:4','1:1']:null,
  native_audio_supported:known?true:null,reference_image_supported:known?true:null,
  reference_video_supported:known?true:null,reference_image_limit:known?(omni?30:9):null,
  prompt_length_limit:null,verified_at:null,source:'local_adapter_contract',
  caveat:'渠道可用性及实际画面效果仍需验证；未知模型不推断能力。'};
}

export interface CapabilityObservation {
 channel_id:string; model_name:string; observed_at:string; source_task_id:string;
 supported_durations_ms?:{min:number;max:number;step:number}; native_audio_supported?:boolean;
 reference_image_supported?:boolean;
}
/** 渠道能力与模型声明分开；一条成功样本不升级为所有参数已验证。 */
export function channelCapabilities(model:string,channel:string,observations:CapabilityObservation[]=[]) {
 const declared=videoCapabilities(model);
 const supported=['metaontic','volcengine'].includes(channel.split('@')[0]);
 const evidence=observations.filter(o=>o.channel_id===channel&&o.model_name===model&&o.source_task_id&&Number.isFinite(Date.parse(o.observed_at)));
 return {...declared,channel_id:channel,profile_revision:`${channel}:adapter-2`,
  capability_status:supported?declared.capability_status:'UNVERIFIED',
  ...(supported?{}:{generation_modes:null,supported_durations_ms:null,supported_aspect_ratios:null,native_audio_supported:null,reference_image_supported:null,reference_video_supported:null,reference_image_limit:null}),
  verified_at:evidence.map(o=>o.observed_at).sort().at(-1)||null,
  verification_scope:evidence.length?'OBSERVED_TASKS_ONLY':'NOT_OBSERVED',observations:evidence,
  caveat:'本地渠道适配器不是实测保证；成功样本仅证明对应任务，不推断未测试的时长、音频或参考图上限。'};
}
