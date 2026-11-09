/** 创作项目自动投影到原版画布；只写本项目管理的节点，不执行任何生成。 */
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { readProject, writeProject, lockProject } from '../workflow/project.js';
import { loadCanvasAdapter, readCanvasInput } from './canvas.js';
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');

export function createCanvasProjectSync(load = loadCanvasAdapter) {
  async function sync(projectId, exec, draft: any = {}) {
    return lockProject(`canvas:${projectId}`, async () => {
      const project = await readProject(projectId, exec);
      let adapter;
      try { adapter = await load(); }
      catch { return { status: 'unavailable', reason: '自动画布尚未就绪，请安装并启用原版无限画布0.20.1；创作项目已保留。' }; }
      const rpc = adapter.rpc;
      if (!rpc.canvasCreateProject) return { status: 'unavailable', reason: '原版画布缺少创建接口，未创建替代画布。' };
      const prefix = `mov_${project.id.replaceAll('-', '')}`;
      // 名称先持久化：创建成功但响应/记录保存中断时，重试由原版同名幂等复用。
      if (!project.canvasAuto) {
        project.canvasAuto = { version: 1, name: `MetaOntic 创作 ${project.id}`, nodes: {}, links: {} };
        await writeProject(project);
      }
      const binding = project.canvasAuto;
      if (!binding.projectId) {
        const created = await rpc.canvasCreateProject({ name: binding.name });
        if (!created?.ok || !/^[A-Za-z0-9_-]{1,100}$/.test(created.projectId || '')) throw new Error('自动画布创建未确认，请重试同步，不重新创建创作项目。');
        binding.projectId = created.projectId; await writeProject(project);
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
      const managed = { ...binding.nodes }, managedEdges = { ...(binding.links || {}) };
      const deleted = new Set(doc.tombstones || []), edgeDeleted = new Set(doc.edgeTombstones || []);
      const add = (key, type, label, x, y, data) => {
        const id = `${prefix}_${key}`;
        if (deleted.has(id)) throw new Error('自动节点已被删除，不会自动复活；请在项目中明确选择新的画布绑定。');
        const previous = nodes[id];
        if (previous && (!managed[id] || digest({ type: previous.type, data: previous.data }) !== managed[id])) throw new Error('自动节点已在画布中修改，保留你的编辑；请先处理差异再同步。');
        const next = { ...(previous || { id, x, y, w: type === 'script' ? 420 : 360, h: 280 }), type, data };
        nodes[id] = next; managed[id] = digest({ type, data }); return id;
      };
      const connect = (from, to, port = 'prompt') => {
        const id = `${prefix}_edge_${from.slice(prefix.length + 1)}_${to.slice(prefix.length + 1)}`;
        if (edgeDeleted.has(id)) throw new Error('自动连线已被删除，保留你的编辑，不重新连回。');
        const desired = { id, fromNode: from, toNode: to, fromPort: 'out', toPort: port };
        const existing = edges.find(e => e.id === id);
        if (existing && (!managedEdges[id] || digest(existing) !== managedEdges[id])) throw new Error('自动连线已修改，保留你的编辑。');
        if (!existing) edges.push(desired);
        managedEdges[id] = digest(desired);
      };
      const source = add('script', 'script', '完整剧本', 40, 60, { label: '完整剧本', idea: '由MetaOnticVideo创作项目同步', output: script || nodes[`${prefix}_script`]?.data?.output || '', status: script ? 'done' : 'idle', metaonticProjectId: project.id });
      const overview = add('project', 'text', '创作项目', 40, 400, { label: '创作项目', text: `目标时长：${project.duration ?? '待确认'}秒\n角色图路线：${project.choice || '待确认'}\n脚本、费用与分段审核仍按原流程进行；自动建图不产生模型费用。`, metaonticProjectId: project.id });
      connect(overview, source);
      let nodeId = `${prefix}_production`;
      if (specification) {
        // segmentPrompts代表真实制作段；不把付费段数冒充创作镜头数。
        const prompts = specification.segmentPrompts?.length ? specification.segmentPrompts : [specification.prompt];
        const shots = prompts.map((prompt, index) => ({ id: `${prefix}_plan_${index + 1}`, title: `制作段${index + 1}`, visual: prompt, prompt }));
        const board = add('storyboard', 'storyboard', '分镜与制作提示词', 540, 60, { label: '分镜与制作提示词', shots, output: script, status: 'done', metaonticProjectId: project.id, metaonticPlanNote: '完整创作分镜见剧本；此列表保留实际制作段提示词，不按段数推断镜头。' });
        connect(source, board, 'script');
        for (const [index, prompt] of prompts.entries()) {
          const plan = add(`segment_${index + 1}`, 'text', `第${index + 1}段制作内容`, 1050, 60 + index * 320, { label: `第${index + 1}段制作内容`, text: String(prompt), metaonticProjectId: project.id });
          connect(board, plan);
        }
        const production = add('production', 'video', '视频制作', 1550, 60, { label: '视频制作', prompt: specification.prompt, ratio: specification.ratio, resolution: specification.resolution, duration: specification.duration,
          status: 'idle', metaonticProjectId: project.id, metaonticAssistantManaged: true });
        nodeId = production; connect(board, production);
      } else if (!nodes[nodeId]) {
        nodeId = source;
      }
      const result = await rpc.projectsPut({ ...loc, name: doc.name, doc: { ...doc, nodes, edges, ts: Date.now() } });
      if (result?.ok === false || result?.deleted) throw new Error('自动画布保存失败，保留原创作项目。');
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
  function wrapProject(tool) {
    return { ...tool, async execute(args, exec) {
      // 先执行原有创作与审核，未确认时长/角色图不提前创建画布。
      const result = await tool.execute(args, exec);
      if (!result?.projectId || !['prepare', 'review', 'status'].includes(args.action) || ['pending', 'blocked'].includes(result.status)) return result;
      try {
        const canvas = await sync(result.projectId, exec, args.action === 'review' ? args : {});
        return { ...result, canvasProject: canvas };
      } catch (e) { return { ...result, canvasProject: { status: 'pending', reason: e.message || '自动画布同步未完成，重试项目同步即可，不需要重生成。' } }; }
    } };
  }
  return { sync, wrapProject };
}
