import { operationUuid, readJson } from '../projects/operation.repository.js';
import { productionDigest } from '../production.binding.js';
import { writeProject, sessionOwner } from '../../video-generation/workflow/project.js';
import { dshHome } from '../../video-generation/media/references.js';
import { DATA_DIR } from '../../../shared/constants/plugin.js';
import path from 'node:path';

/** 稳定目标ID让两份文件间中断可重入；不把孤立制作文件当专业项目已提交。 */
export async function bindCompiledProject(state: any, plan: any, exec: any, sourceFile: string, model: string) {
  const digest = productionDigest(plan.specification);
  const owner = sessionOwner(exec);
  const id = operationUuid({ owner, project: state.project_id, revision: state.revision, digest, model });
  const file = path.join(dshHome(), DATA_DIR, 'projects', `${id}.json`);
  let project = await readJson<any>(file, null);
  if (project) {
    if (project.owner !== owner || project.filmSource?.path !== sourceFile || project.filmSource?.revision !== state.revision
      || project.filmSource?.plan_digest !== digest || project.filmSource?.model_name !== model) throw Error('COMPILE_RECOVERY_CONFLICT');
  } else {
    project = { version: 1, id, owner, subjectType: state.artifacts.assets.data.characters.length ? 'fixed_subject' : 'scenery',
      choice: '', approved: null, duration: state.duration_ms / 1000,
      filmSource: { path: sourceFile, revision: state.revision, plan_digest: digest, model_name: model } };
    await writeProject(project);
  }
  return { ...plan, model_name: model, plan_digest: digest, videoProjectId: id };
}
