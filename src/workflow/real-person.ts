/** 视频接口真人拒绝后的显式授权恢复。 */
import { prepareImageTool } from '../tools/video-prepare-image.js';
import { resolveImageInput } from '../media/references.js';
import { approvalPolicy } from './approval.js';

export async function recoverRealPersonImages(config, body, ctx, exec, final) {
  const images: any[] = (body.content || []).filter((item) => item.type === 'image_url' && item.image_url?.url);
  if (!images.length) {
    final.error = `${final.error || ''}。本次没有可转换的图片参考；若限制来自参考视频，请提供非真人视频素材。`;
    return null;
  }
  const approval = ctx?.get?.('approval');
  if (!approval?.request || !exec?.agent || approvalPolicy(ctx, exec) === 'never') {
    final.error = `${final.error || ''}。需要用户同意后才能用 Seedream 转换参考图；当前无法发起确认，已停止，未转换或重试。`;
    return null;
  }
  let outcome;
  try {
    outcome = await approval.request({
      agent: exec.agent,
      toolName: 'video_prepare_image',
      ...(exec.callId ? { callId: exec.callId } : {}),
      ...(exec.signal ? { signal: exec.signal } : {}),
      reason: `视频接口返回真人限制。是否将本次 ${images.length} 张参考图转换为非真人二维动画风格，并用转换后的图片重试视频一次？图片处理与视频重试分别按实际调用计费。`,
      displayReason: {
        zh: `视频接口提示参考素材含真人。是否用 Seedream 将本次 ${images.length} 张参考图转为非真人二维动画风格，再重试视频一次？图片处理与视频重试分别计费。拒绝或取消将停止，不转换图片。`,
        en: `The video provider rejected real-person content. Convert ${images.length} reference image(s) to non-photorealistic 2D animation with Seedream and retry the video once? Image processing and the video retry are billed separately. Reject or cancel to stop.`,
      },
    });
  } catch {
    final.error = `${final.error || ''}。未取得转换授权，已停止，未转换图片。`;
    return null;
  }
  if (String(outcome) !== 'allowed-once') {
    final.error = `${final.error || ''}。用户未同意转换，已停止，未转换图片或重试视频。`;
    return null;
  }
  const replacements = new Map<string, string>();
  try {
    for (const item of images) {
      const source = item.image_url.url;
      if (replacements.has(source)) continue;
      const result = await prepareImageTool(config).execute({ image: source, style: '明显的非真人二维动画角色，保持原构图、服装和动作' }, exec);
      const resolved = await resolveImageInput(result.imageUrl, '转换后的参考图');
      replacements.set(source, String(resolved.url));
    }
  } catch (error) {
    final.error = `${final.error || ''}。Seedream 转换未完成：${error?.message || error}。已停止，未重试视频；已完成的图片调用按实际计费。`;
    return null;
  }
  return {
    ...body,
    content: body.content.map((item) => item.type === 'image_url' && replacements.has(item.image_url?.url)
      ? { ...item, image_url: { ...item.image_url, url: replacements.get(item.image_url.url) } }
      : item),
  };
}
