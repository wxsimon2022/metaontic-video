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
