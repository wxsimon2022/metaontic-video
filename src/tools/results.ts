/** tools/results：从宿主入口拆出的独立职责模块。 */
import { formatSeconds } from '../utils/files.js';

export function previewInstruction(value) {
  const latest = (value?.segments || []).filter((segment) => segment.status === 'succeeded').at(-1);
  const target = latest?.localPath || value?.videoPath || latest?.videoUrl || value?.videoUrl;
  return `【下一步：先展示视频，等待用户预览】请立即使用当前宿主的 present/文件展示工具展示本次完成的分段：${target || '见本次分段结果'}。`
    + '不能只说“生成成功”或只列任务ID。展示后询问“先看这段，效果可以吗？确认后再继续下一段。”并结束本轮等待回复。'
    + '用户首次授权制作不等于已看过本段，不得自动resume或调用其他生成工具绕过预览；展示工具不可用时给出可点击视频路径或播放链接，仍须等待明确确认。';
}

export function renderResult(value) {
  const {
    status, segments = [], videoUrl, error, videoPath, mergeMode, segmentsDir,
    paused, resumeDir, remainingSeconds, note,
  } = value || {};
  const lines = segments.map((segment) => {
    const head = `第 ${segment.index} 段：+${segment.seconds}s（任务 ${segment.taskId}）`;
    if (segment.status !== 'succeeded' || !segment.videoUrl) {
      return `${head} → ${segment.status}${segment.error ? `：${segment.error}` : ''}`;
    }
    return segment.localPath
      ? `${head} → ${segment.videoUrl}\n    本地文件：${segment.localPath}`
      : `${head} → ${segment.videoUrl}`;
  });

  if (status === 'succeeded') {
    const parts = [];
    if (paused) {
      parts.push(previewInstruction(value));
      parts.push(
        `已延长并交付前 ${segments.length} 段（共 ${formatSeconds(segments.reduce(
          (sum, item) => sum + (item.seconds || 0), 0,
        ))} 秒）：每段延长完都会问一次要不要继续；这次先交付到这里`
        + '（当前暂停等待预览确认；也可能因停止或超时暂停）。',
      );
    } else {
      parts.push('视频延长成功。');
    }
    parts.push(...lines);
    if (videoPath) parts.push(`成片（本地文件）：${videoPath}（${mergeModeLabel(mergeMode)}）`);
    if (paused && resumeDir) {
      parts.push(
        `还没生成的部分：还剩 ${formatSeconds(remainingSeconds)} 秒。`
        + `要接着做就把 resume="${resumeDir}" 传回 video_extend（prompt 可以省略，其余参数照旧）：`
        + '前面几段不会重新生成、不会重复扣费。',
      );
    }
    parts.push(`最终视频链接（约 24 小时内有效）：${videoUrl || '（无）'}`);
    if (note) parts.push(note);
    return [{ type: 'text', text: parts.filter(Boolean).join('\n') }];
  }
  if (status === 'timeout') {
    return [
      {
        type: 'text',
        text: [
          '延长任务仍在生成中（已超出单次等待时间）。',
          ...lines,
          `可用 video_status 查询任务 ${
            segments.at(-1)?.taskId || '（未知）'
          } 的状态与视频链接。`,
        ].join('\n'),
      },
    ];
  }
  if (status === 'unknown') {
    return [
      {
        type: 'text',
        text: [
          '没能确认这段延长任务的状态（查询失败，不是任务失败）。任务已经提交，可能仍在生成；'
          + '用 video_status 按任务 ID 复查，不要重新提交。',
          ...lines,
          `可用 video_status 查询任务 ${segments.at(-1)?.taskId || '（未知）'} 的状态与视频链接。`,
        ].join('\n'),
      },
    ];
  }
  if (status === 'cancelled') {
    return [{ type: 'text', text: `延长任务已取消。\n${lines.join('\n')}` }];
  }
  return [
    {
      type: 'text',
      text: [
        `视频延长失败${error ? `：${error}` : ''}。`,
        ...lines,
        videoUrl ? `已完成部分的视频链接：${videoUrl}` : '',
      ].filter(Boolean).join('\n'),
    },
  ];
}

export const SEGMENT_OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    index: { type: 'integer' },
    kind: { type: 'string' },
    seconds: { type: 'integer' },
    taskId: { type: 'string' },
    status: { type: 'string' },
    videoUrl: { type: 'string' },
    localPath: { type: 'string' },
    durationSeconds: { type: 'number' },
    error: { type: 'string' },
  },
};

export const VIDEO_SEGMENT_OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    index: { type: 'integer' },
    kind: { type: 'string' },
    seconds: { type: 'integer' },
    taskId: { type: 'string' },
    status: { type: 'string' },
    videoUrl: { type: 'string' },
    localPath: { type: 'string' },
    durationSeconds: { type: 'number' },
    error: { type: 'string' },
  },
};

/** 合并方式的说法（两个工具的结果里都用它）。 */
export function mergeModeLabel(mergeMode) {
  if (mergeMode === 'copy') return '无损拼接';
  if (mergeMode === 'segment') return '这一段暂时按原始分段交付（续做时再和后面的段合并）';
  if (mergeMode === 'single') return '一段直出，无需拼接';
  if (mergeMode === 'seamless') return '直接拼接（旧配置兼容）';
  return '重编码拼接';
}

export function renderVideoResult(value) {
  const {
    status, mode, segments = [], videoUrl, videoPath, mergeMode, segmentsDir, note, error,
    pendingTaskId, paused, resumeDir, remainingSeconds,
  } = value || {};
  const lines = segments.map((segment) => {
    const label = segment.kind === 'extend' ? `延长 +${segment.seconds}s` : `直出 ${segment.seconds}s`;
    const head = `第 ${segment.index} 段：${label}（任务 ${segment.taskId}）`;
    if (segment.status !== 'succeeded' || !segment.videoUrl) {
      return `${head} → ${segment.status}${segment.error ? `：${segment.error}` : ''}`;
    }
    return segment.localPath
      ? `${head} → ${segment.videoUrl}\n    本地文件：${segment.localPath}`
      : `${head} → ${segment.videoUrl}`;
  });

  const parts = paused ? [previewInstruction(value)] : [];
  if (status === 'succeeded') {
    if (paused) {
      parts.push(
        `已生成并交付前 ${segments.length} 段（共 ${formatSeconds(segments.length
          ? segments.reduce((sum, item) => sum + (item.seconds || 0), 0) : 0)} 秒）：`
        + '每段生成完都会问一次要不要继续；这次先交付到这里'
        + '（当前暂停等待预览确认；也可能因停止或超时暂停）。',
      );
    } else if (mode === 'extended') {
      parts.push(`视频生成成功：先直出 ${formatSeconds(segments[0]?.seconds)} 秒，再延长 ${segments.length - 1} 段。`);
    } else {
      parts.push(`视频生成成功：一次直出 ${formatSeconds(segments[0]?.seconds)} 秒，没有超过单段上限，不需要延长。`);
    }
  } else if (status === 'timeout') {
    parts.push('任务仍在生成中（已超出单次等待时间）。');
  } else if (status === 'unknown') {
    parts.push(
      '没能确认任务状态（查询失败，不是任务失败）。任务已经提交，可能仍在生成；'
      + '用 video_status 按下面的任务 ID 复查，不要重新提交。',
    );
  } else if (status === 'cancelled') {
    parts.push('任务已取消。');
  } else {
    parts.push(`视频生成失败${error ? `：${error}` : ''}。`);
  }
  parts.push(...lines);

  if (status === 'succeeded') {
    if (videoPath) {
      parts.push(`成片（本地文件）：${videoPath}（${mergeModeLabel(mergeMode)}）`);
    } else if (segmentsDir) {
      parts.push(`没有合并成一条：分段文件都在 ${segmentsDir}（每段路径见上面的列表）。`);
    } else {
      parts.push('没有生成合并文件，请按上面的上游链接自行下载分段。');
    }
  }
  if (paused && resumeDir) {
    parts.push(
      `还没生成的部分：还剩 ${formatSeconds(remainingSeconds)} 秒。`
      + `要接着做就把 resume 原样传回 video_generate（resume="${resumeDir}"），`
      + '插件会接着已有的分段往下生成，前面几段不会重新生成、也不会重复扣费。',
    );
  }
  if (videoUrl) parts.push(`最后一段上游链接（约 24 小时内有效）：${videoUrl}`);
  if (note) parts.push(note);
  if (status === 'timeout' || status === 'unknown') {
    const taskId = pendingTaskId || segments.at(-1)?.taskId || '（未知）';
    parts.push(`可用 video_status 查询任务 ${taskId} 的状态与视频链接。`);
  }
  return [{ type: 'text', text: parts.filter(Boolean).join('\n') }];
}
