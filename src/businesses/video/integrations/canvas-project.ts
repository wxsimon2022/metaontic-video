/** 创作项目自动投影到原版画布；只写本项目管理的节点，不执行任何生成。 */
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { readProject, writeProject, lockProject, projectsOfSession, allProjects } from '../workflow/project.js';
import { ref } from '../config.js';
import { loadCanvasAdapter, readCanvasInput, markCanvasChanged } from './canvas.js';
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');

/** 提取真实剧本分镜表；没有明确的镜头/画面列时不编造镜头或秒数。 */
export function scriptStoryboardShots(script: string) {
  const lines = script.split(/\r?\n/), shots = [];
  const cells = line => line.trim().replace(/^\|/, '').replace(/\|$/, '').split(/(?<!\\)\|/).map(s => s.trim().replace(/\\\|/g, '|'));
  let fenced = false;
  for (let i = 0; i < lines.length - 1; i++) {
    if (/^\s*(```|~~~)/.test(lines[i])) { fenced = !fenced; continue; }
    if (fenced || !lines[i].includes('|')) continue;
    const header = cells(lines[i]), separator = cells(lines[i + 1]);
    if (separator.length !== header.length || !separator.every(x => /^:?-{3,}:?$/.test(x))) continue;
    const titleAt = header.findIndex(x => /镜头|shot/i.test(x));
    const visualAt = header.findIndex(x => /画面|visual/i.test(x));
    if (titleAt < 0 || visualAt < 0 || titleAt === visualAt) continue;
    const timeAt = header.findIndex(x => /时间|时长|time|duration/i.test(x));
    const cameraAt = header.findIndex(x => /景别|运镜|camera/i.test(x));
    const soundAt = header.findIndex(x => /声音|音效|sound|sfx/i.test(x));
    const dialogueAt = header.findIndex(x => /台词|对白|dialogue/i.test(x));
    for (i += 2; i < lines.length && lines[i].includes('|') && lines[i].trim(); i++) {
      const row = cells(lines[i]);
      if (row.length !== header.length || !row[visualAt]) continue;
      const time = row[timeAt] || '', range = time.match(/(\d+(?:\.\d+)?)\s*(?:秒|s)?\s*[–—~～至-]\s*(\d+(?:\.\d+)?)/i);
      const explicit = time.match(/^(\d+(?:\.\d+)?)\s*(?:秒|s)$/i);
      const duration = range ? Number(range[2]) - Number(range[1]) : explicit ? Number(explicit[1]) : null;
      shots.push({ title: row[titleAt], visual: header.map((h, j) => `${h}：${row[j]}`).join('\n'),
        camera: row[cameraAt] || '', sfx: row[soundAt] || '',
        dialogue: row[dialogueAt] ? [{ role: '剧本对白', line: row[dialogueAt] }] : [],
        ...(duration > 0 ? { duration } : {}), metaonticTime: time });
    }
    i--;
  }
  return shots;
}

/** 原版剧本节点是纯文本预览；转换展示副本，原始脚本仍用于审核与分镜解析。 */
export function canvasScriptPreview(script: string) {
  return script.replace(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/, '')
    .split(/\r?\n/).filter(line => !/^\s*(```|~~~)/.test(line) && !/^\s*\|?\s*:?-{3,}:?\s*\|/.test(line))
    .map(line => line.replace(/^#{1,6}\s+/, '').replace(/\*\*([^*]+)\*\*/g, '$1').replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '图片：$1（$2）').replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1（$2）').replace(/`([^`]+)`/g, '$1')
      .replace(/^\s*\|(.+)\|\s*$/, (_, row) => row.split(/(?<!\\)\|/).map(x => x.trim()).join(' · ')))
    .join('\n').trim();
}

/** 能证明是插件写过的画布项目名才算：创建名、上次应用的名字、旧版本用过的固定前缀，
 *  以及已经等于当前会话标题的名字（老版本只写过标题、没记归属）。用户手动改过的名字一律不动。 */
export function pluginNamedCanvas(binding: any, current: any, title: any = '') {
  const name = String(current || '').trim(), wanted = String(title || '').trim();
  if (!name) return false;
  // 已经交付过名字：之后只认那一个名字。画布端把项目名当自己的本地字段，会把旧名推回来，
  // 认创建名就会两边来回改；让给它，画布名（Host 权威）仍然跟着会话标题。
  if (binding?.appliedName) return name === binding.appliedName;
  return name === binding?.name || name.startsWith('MetaOntic 创作') || Boolean(wanted) && name === wanted;
}

/** 画布内的默认画布名同理：只有原版缺省名、上次应用的名字或当前标题能证明是插件写的。
 *  原版端把默认画布名当 Host 权威字段，项目名却由画布端本地缓存回推，所以两处都要跟着标题写。 */
export function pluginNamedCanvasName(binding: any, current: any, title: any = '') {
  const name = String(current || '').trim(), wanted = String(title || '').trim();
  // 空名字就是原版缺省「默认画布」（projectsGet 不带该字段），同样没有用户起过的名字。
  return !name || name === '默认画布' || name === binding?.appliedCanvasName || Boolean(wanted) && name === wanted;
}

export function createCanvasProjectSync(load = loadCanvasAdapter, config: any = {}, sessionTitle: any = null) {
  async function sync(projectId, exec, draft: any = {}) {
    if (ref(config, 'autoCreateCanvas', true) === false) return { status: 'disabled', reason: '已在插件设置关闭自动创建流程画布；已有画布保留。' };
    return lockProject(`canvas:${projectId}`, async () => {
      const project = await readProject(projectId, exec);
      // status重试也恢复已审核材料，不能用空草稿覆盖制作计划。
      draft = { ...(project.canvasDraft || { scriptPath: project.approved?.scriptPath, specification: project.approved?.specification }), ...draft };
      if (draft.specification?.canvas) return { status: 'external', projectId: draft.specification.canvas.projectId, reason: '沿用用户选择的原画布，不另建项目。' };
      let adapter;
      try { adapter = await load(); }
      catch { return { status: 'unavailable', reason: '自动画布尚未就绪，请安装并启用原版无限画布0.20.1；创作项目已保留。' }; }
      const rpc = adapter.rpc;
      let conversationName = '';
      try { conversationName = String(sessionTitle?.get(exec.agent.session)?.title || '').trim().slice(0, 80); } catch { /* 宿主未提供标题时保留原名 */ }
      if (!rpc.canvasCreateProject) return { status: 'unavailable', reason: '原版画布缺少创建接口，未创建替代画布。' };
      const prefix = `mov_${project.id.replaceAll('-', '')}`;
      // 名称先持久化：创建成功但响应/记录保存中断时，重试由原版同名幂等复用。
      // 画布名与会话标题同源，不带创作项目 id；标题未生成时用中性名，冲突时再接序号。
      const baseName = conversationName || 'MetaOntic 创作画布';
      if (!project.canvasAuto) {
        project.canvasAuto = { version: 1, name: baseName, nodes: {}, links: {} };
        await writeProject(project);
      }
      const binding = project.canvasAuto;
      if (!binding.projectId) {
        const created = await createAutoCanvas(rpc, project, binding, baseName);
        if (!created?.ok || !/^[A-Za-z0-9_-]{1,100}$/.test(created.projectId || '')) throw new Error('自动画布创建未确认，请重试同步，不重新创建创作项目。');
        binding.projectId = created.projectId;
        if (created.name) binding.name = String(created.name);
        await writeProject(project);
      }
      const loc = { id: binding.projectId };
      const doc = await rpc.projectsGet(loc);
      if (!doc?.nodes || doc.deleted) throw new Error('自动画布已删除或不可用，不会重新创建已删除的项目。');
      let script = '';
      if (draft.scriptPath) {
        const scriptPath = path.resolve(exec.agent.session.header?.cwd || process.cwd(), draft.scriptPath);
        if (!/\.md$/i.test(scriptPath)) throw new Error('自动同步脚本需要Markdown文件。');
        script = await readFile(scriptPath, 'utf8');
        if (script.length > 200000) throw new Error('脚本过大，自动画布未覆盖旧节点。');
      }
      const specification = draft.specification || null;
      const nodes = { ...doc.nodes }, edges = [...(doc.edges || [])];
      const ensuredEdges: any[] = [], removedEdges: string[] = [];
      const managed = { ...binding.nodes }, managedEdges = { ...(binding.links || {}) };
      const deleted = new Set(doc.tombstones || []), edgeDeleted = new Set(doc.edgeTombstones || []);
      const add = (key, type, label, x, y, data) => {
        const id = `${prefix}_${key}`;
        if (deleted.has(id)) throw new Error('自动节点已被删除，不会自动复活；请在项目中明确选择新的画布绑定。');
        const previous = nodes[id];
        // 旧版空剧本仅在其余字段仍为自动初始值时恢复，不能覆盖用户正文。
        if (key === 'script' && previous?.type === 'script' && previous.data?.output === '' && previous.data?.metaonticProjectId === project.id) {
          const initial = { label: '完整剧本', idea: '由MetaOnticVideo创作项目同步', output: '', status: 'idle', metaonticProjectId: project.id };
          if (JSON.stringify(previous.data) === JSON.stringify(initial)) managed[id] = digest({ type: previous.type, data: previous.data });
        }
        if (previous && (!managed[id] || digest({ type: previous.type, data: previous.data }) !== managed[id])) throw new Error('自动节点已在画布中修改，保留你的编辑；请先处理差异再同步。');
        const next = { ...(previous || { id, x, y, w: type === 'script' ? 420 : 360, h: 280 }), type, data };
        // 只迁移旧自动布局；用户移动或缩放过的节点保留原位。
        const oldX = key === 'production' ? 1550 : key.startsWith('segment_') ? 1050 : null;
        const oldY = key === 'production' ? 60 : key.startsWith('segment_') ? 60 + (Number(key.slice(8)) - 1) * 320 : null;
        if (previous && previous.x === oldX && previous.y === oldY && previous.w === 360 && previous.h === 280) {
          next.x = x; next.y = y;
        }
        nodes[id] = next; managed[id] = digest({ type, data }); return id;
      };
      const connect = (from, to, port = 'prompt') => {
        const id = `${prefix}_edge_${from.slice(prefix.length + 1)}_${to.slice(prefix.length + 1)}`;
        if (edgeDeleted.has(id)) throw new Error('自动连线已被删除，保留你的编辑，不重新连回。');
        const desired = { id, fromNode: from, toNode: to, fromPort: 'out', toPort: port };
        const existing = edges.find(e => e.id === id);
        if (existing && (!managedEdges[id] || digest(existing) !== managedEdges[id])) throw new Error('自动连线已修改，保留你的编辑。');
        if (!existing) edges.push(desired);
        ensuredEdges.push(desired);
        managedEdges[id] = digest(desired);
      };
      const source = add('script', 'script', '完整剧本', 40, 60, { label: '完整剧本', idea: '由MetaOnticVideo创作项目同步', output: canvasScriptPreview(script) || nodes[`${prefix}_script`]?.data?.output || '', status: (script || nodes[`${prefix}_script`]?.data?.output) ? 'done' : 'idle', metaonticProjectId: project.id });
      const overview = add('project', 'text', '创作项目', 40, 400, { label: '创作项目', text: `目标时长：${project.duration ?? '待确认'}秒\n角色图路线：${project.choice || '待确认'}\n脚本、费用与分段审核仍按原流程进行；自动建图不产生模型费用。`, metaonticProjectId: project.id });
      // text/script没有输入端口；清理旧版创建的无效自动连线，保留用户改动。
      for (let i = edges.length - 1; i >= 0; i--) {
        const edge = edges[i];
        if (managedEdges[edge.id] && ['text', 'script'].includes(nodes[edge.toNode]?.type)) {
          if (digest(edge) !== managedEdges[edge.id]) throw new Error('自动连线已修改，保留你的编辑。');
          edges.splice(i, 1); removedEdges.push(edge.id); delete managedEdges[edge.id];
        }
      }
      let nodeId = `${prefix}_production`;
      if (specification) {
        // segmentPrompts代表真实制作段；不把付费段数冒充创作镜头数。
        const prompts = specification.segmentPrompts?.length ? specification.segmentPrompts : [specification.prompt];
        const wanted = new Set(prompts.map((_, i) => `${prefix}_segment_${i + 1}`));
        for (const id of Object.keys(managed)) {
          if (!id.startsWith(`${prefix}_segment_`) || wanted.has(id) || !nodes[id]) continue;
          if (digest({ type: nodes[id].type, data: nodes[id].data }) !== managed[id] || edges.some(e => e.fromNode === id || e.toNode === id))
            throw new Error('旧制作段已在画布中编辑或连接，保留你的编辑；请先处理差异再同步。');
          delete nodes[id]; delete managed[id];
        }
        const shots = scriptStoryboardShots(script); // 不把制作段冒充创作镜头。
        const board = add('storyboard', 'storyboard', '镜头分镜', 540, 60, { label: '镜头分镜', shots, script, output: script, status: 'done', metaonticProjectId: project.id, metaonticPlanNote: shots.length ? '按剧本分镜表同步，制作段计划另列，不触发生成。' : '未识别到分镜表，完整原文保留在剧本中；制作段计划另列。' });
        connect(source, board, 'script');
        for (const [index, prompt] of prompts.entries()) {
          const plan = add(`segment_${index + 1}`, 'text', `第${index + 1}段制作内容`, 540, 420 + index * 320, { label: `第${index + 1}段制作内容`, text: String(prompt), metaonticProjectId: project.id });
          // 制作段是只读文本说明，原版文本节点没有输入端口。
        }
        const results = edges.filter(e => e.fromNode === `${prefix}_production`).map(e => nodes[e.toNode]).filter(Boolean);
        // 新版成果不使用媒体→文本连线，通过显式来源标识关联。
        results.push(...Object.values(nodes).filter((n: any) => n.metaonticSourceNode === `${prefix}_production`));
        const latest: any = results.sort((a: any, b: any) => (b.metaonticCreatedAt || 0) - (a.metaonticCreatedAt || 0))[0];
        const phase = latest?.data?.metaonticPhase;
        const state = phase === 'segment_review' ? '分段待审核' : ['complete', 'generated'].includes(phase) ? '已有生成成果' : phase ? '已有阶段成果' : '待制作';
        const production = add('production', 'video', '视频制作', 1040, 60, { label: `视频制作 · ${state}`, prompt: specification.prompt, ratio: specification.ratio, resolution: specification.resolution, duration: specification.duration,
          status: ['complete', 'generated'].includes(phase) ? 'done' : 'idle', metaonticProjectId: project.id, metaonticAssistantManaged: true });
        nodeId = production; connect(board, production);
      } else if (!nodes[nodeId]) {
        nodeId = source;
      }
      // 画布名跟着会话标题走；会话标题通常首轮之后才生成，那就等 session/title 事件补名。
      const currentName = String(doc.name || '').trim();
      const canvasName = conversationName && pluginNamedCanvas(binding, currentName, conversationName) ? conversationName : currentName;
      const currentCanvasName = String(doc.defaultCanvasName || '').trim();
      const canvasLabel = !doc.defaultCanvasDeleted && conversationName && pluginNamedCanvasName(binding, currentCanvasName, conversationName)
        ? conversationName : currentCanvasName;
      const result = await rpc.projectsPut({ ...loc, name: canvasName, ...(canvasLabel ? { defaultCanvasName: canvasLabel } : {}),
        doc: { ...doc, nodes, edges, ts: Date.now(),
        ...(removedEdges.length ? { edgeTombstones: [...new Set([...(doc.edgeTombstones || []), ...removedEdges])] } : {}) } });
      if (result?.ok === false || result?.deleted) throw new Error('自动画布保存失败，保留原创作项目。');
      if (canvasName) binding.appliedName = canvasName;
      if (canvasLabel) binding.appliedCanvasName = canvasLabel;
      // projectsPut 不产生「文档已变更」信号：不补这一下，打开的画布只会补节点、连线一条都看不到。
      await markCanvasChanged(adapter, binding.projectId, [...ensuredEdges, ...edges]);
      binding.nodes = managed; binding.links = managedEdges; binding.nodeId = nodeId;
      // 获取当前内容摘要，后续生成不必让助手复制定位参数。
      try { binding.canvas = (await readCanvasInput(adapter, { projectId: binding.projectId, nodeId })).canvas; }
      catch { delete binding.canvas; }
      await writeProject(project);
      let opened = false;
      try { opened = (await rpc.canvasOpen?.({ projectId: binding.projectId }))?.ok === true; } catch { /* 已建图不因打开失败重建 */ }
      return { status: 'synced', projectId: binding.projectId, nodeId, openRequested: opened, bindingReady: Boolean(binding.canvas),
        ...(!binding.canvas ? { reason: '画布节点已建立；成果回填前请在原版画布设置数据根目录。' } : {}) };
    });
  }
  /** 原版按名字复用项目：只有「空项目」（上次创建中断留下的）才认领，
   *  已经装了内容或已属于别的创作项目时让开，换带序号的中性名另建，不写进别人的画布。 */
  async function createAutoCanvas(rpc, project, binding, baseName) {
    // 旧记录里的名字带创作项目 id（用户不要这串 id）时不再沿用，直接换成中性名。
    const stored = typeof binding.name === 'string' && binding.name.trim() && !binding.name.includes(project.id) ? binding.name : baseName;
    let created = await rpc.canvasCreateProject({ name: stored });
    for (let index = 2; index <= 5 && created?.ok && created.reused; index++) {
      if (await canvasReusable(rpc, created.projectId, project.id)) return created;
      created = await rpc.canvasCreateProject({ name: `${baseName} ${index}` });
    }
    return created;
  }
  async function canvasReusable(rpc, projectId, selfProjectId) {
    const doc = await rpc.projectsGet({ id: projectId });
    if (!doc?.nodes || Object.keys(doc.nodes).length) return false;
    for (const other of await allProjects()) {
      if (other?.id !== selfProjectId && other?.canvasAuto?.projectId === projectId) return false;
    }
    return true;
  }
  /** 会话标题落定或被改名后补齐画布项目名；只改插件写过的名字，不覆盖用户改名，也不改动图。 */
  async function followTitle(session, event) {
    try {
      if (!session || event?.type !== 'session/title') return;
      const title = String(event.data?.title || '').trim().slice(0, 80);
      if (!title) return;
      for (const project of await projectsOfSession(session)) {
        const binding = project.canvasAuto;
        if (!binding?.projectId) continue;
        try {
          await lockProject(`canvas:${project.id}`, async () => {
            const adapter = await load();
            const loc = { id: binding.projectId };
            const doc = await adapter.rpc.projectsGet(loc);
            if (!doc?.nodes || doc.deleted) return;
            const current = String(doc.name || '').trim(), currentCanvas = String(doc.defaultCanvasName || '').trim();
            // 用户手动改过的名字不动；已经一致的只补记归属，便于以后跟着会话改名。
            const ownsName = pluginNamedCanvas(binding, current, title);
            const ownsCanvasName = !doc.defaultCanvasDeleted && pluginNamedCanvasName(binding, currentCanvas, title);
            if (!ownsName && !ownsCanvasName) return;
            const put: any = { ...loc };
            if (ownsName && current !== title) put.name = title;
            if (ownsCanvasName && currentCanvas !== title) put.defaultCanvasName = title;
            if (put.name || put.defaultCanvasName) {
              // 只写名字：不带 doc 就不会碰节点、连线、视图与设定集。
              const result = await adapter.rpc.projectsPut(put);
              if (result?.ok === false || result?.deleted) return;
            }
            let recorded = false;
            if (ownsName && binding.appliedName !== title) { binding.appliedName = title; recorded = true; }
            if (ownsCanvasName && binding.appliedCanvasName !== title) { binding.appliedCanvasName = title; recorded = true; }
            if (recorded) await writeProject(project);
          });
        } catch { /* 该项目正在同步或画布未就绪：留到下次同步或下个标题事件 */ }
      }
    } catch { /* 后台补名不打断会话 */ }
  }
  function wrapProject(tool) {
    return { ...tool, async execute(args, exec) {
      // 先执行原有创作与审核，未确认时长/角色图不提前创建画布。
      const result = await tool.execute(args, exec);
      if (result?.canvasProject) return result;
      if (!result?.projectId || !['prepare', 'review', 'status'].includes(args.action) || ['pending', 'blocked'].includes(result.status)) return result;
      try {
        const canvas = await sync(result.projectId, exec, args.action === 'review' ? args : {});
        return { ...result, canvasProject: canvas };
      } catch (e) { return { ...result, canvasProject: { status: 'pending', reason: e.message || '自动画布同步未完成，重试项目同步即可，不需要重生成。' } }; }
    } };
  }
  return { sync, wrapProject, followTitle };
}
