export function validateTimeline(shots: any[], duration: number) {
  let end = 0;
  const ids = new Set();
  for (const shot of shots) {
    if (!shot.shot_id || ids.has(shot.shot_id)) throw Error('DUPLICATE_OR_MISSING_ID');
    ids.add(shot.shot_id);
    if (shot.duration_ms !== undefined && shot.duration_ms !== shot.end_ms-shot.start_ms) throw Error('SHOT_DURATION_MISMATCH');
    if (!Number.isSafeInteger(shot.start_ms) || !Number.isSafeInteger(shot.end_ms) || shot.start_ms !== end || shot.end_ms <= end) throw Error('GAP_OR_OVERLAP');
    end = shot.end_ms;
  }
  if (end !== duration) throw Error('DURATION_MISMATCH');
}
