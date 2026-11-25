import { createHash } from 'node:crypto';
import { approvalMaterial, approvalChunks } from './approval.presenter.js';

// 只容忍 Markdown 排版差异，不用覆盖率、摘要或多版拼接代替完整材料。
const readable = (text: string) => text.replace(/[#*`>|~_\s]/g, '');
type Target = { key: string; text: string; pages: string[]; next: number; shown: boolean };
export function createFilmPresentationGuard() {
  const sessions = new WeakMap<object, Map<string, Target>>();
  function target(session: object, projectId: string, stage: string, artifact: any) {
    const material = approvalMaterial(stage, artifact).approval_material;
    if (!session || !material) return null;
    const text = readable(material.markdown);
    const key = `${artifact.revision}:${createHash('sha256').update(text).digest('hex')}`;
    let entries = sessions.get(session);
    if (!entries) { entries = new Map(); sessions.set(session, entries); }
    const id = `${projectId}:${stage}`;
    if (entries.get(id)?.key !== key) entries.set(id, { key, text, pages: approvalChunks(material.markdown).map(readable), next: 0, shown: false });
    while (entries.size > 32) entries.delete(entries.keys().next().value);
    return entries.get(id);
  }
  function remember(session: object, state: any) {
    for (const stage of ['creative', 'script']) {
      const artifact = state.artifacts?.[stage];
      if (artifact && !artifact.stale && state.approvals?.[stage] !== artifact.revision) target(session, state.project_id, stage, artifact);
    }
  }
  function observe(session: object, event: any) {
    if (event?.type !== 'assistant/message') return;
    const content = event.data?.message?.content;
    if (!Array.isArray(content)) return;
    const text = readable(content.filter(block => block.type === 'text' && typeof block.text === 'string').map(block => block.text).join('\n'));
    for (const entry of sessions.get(session)?.values() || []) {
      if (entry.shown) continue;
      if (entry.text && text.includes(entry.text)) { entry.shown = true; continue; }
      // 一条消息可以展示连续多页，但不能跳页或把多个旧版本拼起来。
      let rest = text;
      while (entry.next < entry.pages.length) {
        const page = entry.pages[entry.next];
        const offset = rest.indexOf(page);
        if (!page || offset < 0) break;
        rest = rest.slice(offset + page.length); entry.next++;
      }
      entry.shown = entry.next === entry.pages.length;
    }
  }
  return { remember, observe, shown: (session: object, id: string, stage: string, artifact: any) => target(session, id, stage, artifact)?.shown === true };
}
