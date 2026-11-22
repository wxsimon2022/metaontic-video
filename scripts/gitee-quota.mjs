/**
 * Gitee 企业附件配额耗尽时，按仓库发布规范自动回收最旧的正式版。
 *
 * 规则：每个仓库独立保留最近 8 个正式版；删除发行版必须同时删除对应远端标签；
 * 本地标签不由这里删除，避免另一个发布仓库仍保留该版本时链接失效。
 */
import { applyCleanup, createGiteeClient, formatPlan, planCleanup } from './clean-releases.mjs';

export const GITEE_QUOTA_KEEP = 8;

/** Gitee 返回的配额错误可能是 400 正文、Error.message 或上传包装后的文本。 */
export function isGiteeQuotaError(error) {
  const text = [error?.message, error?.body, error?.detail].filter(Boolean).join(' ');
  return /(?:附件|文件).{0,20}配额|配额.{0,20}(?:满|超出|不足)|attachment.{0,20}quota/i.test(text);
}

/**
 * 清理 Gitee 上超出保留数量的旧正式版，并返回清理计划。
 * 仅操作 Gitee：不删除 GitHub 发行版，也不删除本地标签。
 */
export async function recoverGiteeQuota({
  token,
  request = fetch,
  log = console.log,
  keep = GITEE_QUOTA_KEEP,
  protectedTags = [],
  client,
  apply = applyCleanup,
} = {}) {
  const gitee = client || createGiteeClient({ slug: 'hackloop/metaontic-video', token, request });
  const [releases, tags] = await Promise.all([gitee.listReleases(), gitee.listTags()]);
  const plan = planCleanup({
    tags,
    tagsByHost: { gitee: tags },
    releases: { gitee: releases },
    keep,
    keepTags: keep,
    patterns: ['v*'],
    protectedTags,
  });
  log(formatPlan(plan, { apply: true, hosts: ['gitee'] }));
  if (!plan.remove.length) {
    log(`Gitee 配额清理：没有超过 ${keep} 个正式版的旧发行版可回收。`);
    return plan;
  }
  await apply({ plan, gitee, local: null, log });
  log(`Gitee 配额清理完成：回收 ${plan.remove.length} 个旧发行版后重试上传。`);
  return plan;
}
