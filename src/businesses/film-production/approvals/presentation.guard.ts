import { createHash } from 'node:crypto';
import { approvalMaterial, approvalChunks, approvalPage } from './approval.presenter.js';

// 只容忍 Markdown 排版差异，不用覆盖率、摘要或多版拼接代替完整材料。
const readable = (text: string) => text.replace(/^\s*(?:[-+*]|\d+\.)\s+/gm, '').replace(/[#*`>|~_\s]/g, '');
type Target = { key: string; text: string; pages: string[]; next: number; shown: boolean; blocks:Array<{markdown:string;text:string;shown:boolean}> };
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
    if (entries.get(id)?.key !== key) {
      const pages=approvalChunks(material.markdown);
      // 短稿逐段原文核验并补缺；长稿保持既有逐页顺序，不用零散片段绕过分页。
      const blocks=pages.length===1?material.markdown.split(/\n\s*\n/).filter(value=>value.trim()).map(markdown=>({markdown,text:readable(markdown),shown:false})):[];
      entries.set(id, { key, text, pages:pages.map(readable), next:0, shown:false, blocks });
    }
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
      for(const block of entry.blocks)if(block.text&&text.includes(block.text))block.shown=true;
      if(entry.blocks.length&&entry.blocks.every(block=>block.shown)){entry.shown=true;continue;}
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
  function repair(session:object,id:string,stage:string,artifact:any) {
    const entry=target(session,id,stage,artifact);
    if(!entry||entry.shown)return {};
    if(!entry.blocks.length)return approvalPage(stage,artifact,entry.next+1);
    const missing=entry.blocks.filter(block=>!block.shown);
    const output:string[]=[];let heading='',lastHeading='';
    for(const block of entry.blocks){
      if(/^#{3,6} /.test(block.markdown))heading=block.markdown;
      if(block.shown)continue;
      if(heading&&heading!==block.markdown&&lastHeading!==heading){output.push(heading);lastHeading=heading;}
      output.push(block.markdown);
      if(heading===block.markdown)lastHeading=heading;
    }
    return {approval_material:{stage,revision:artifact.revision,markdown:output.join('\n\n'),partial:missing.length<entry.blocks.length,missing_blocks:missing.length,instructions:'只将此markdown原样补充到用户可见正文；这是尚未展示的原文段落，仅保留必要标题定位，已展示正文不要重贴。不能润色、省略或另写一版。补齐后沿原项目和修订号重试approve。'}};
  }
  return { remember, observe, repair, shown: (session: object, id: string, stage: string, artifact: any) => target(session, id, stage, artifact)?.shown === true };
}
