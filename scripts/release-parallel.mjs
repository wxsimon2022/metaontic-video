import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const platforms = ['platform-install (windows-latest)', 'platform-install (macos-latest)'];
export function platformCheckState(run, expectedSha) {
  if (run.headSha !== expectedSha) throw Error('安装检查提交与发布标签不一致');
  const checks = platforms.map(name => run.jobs?.find(job => job.name === name));
  for (const check of checks) if (check?.status === 'completed' && check.conclusion !== 'success') throw Error(`${check.name} 未通过`);
  if (run.status === 'completed' && checks.some(check => check?.conclusion !== 'success')) throw Error('发布流水线未完成双平台安装检查');
  return checks.every(check => check?.status === 'completed' && check.conclusion === 'success');
}

export async function waitForPlatformChecks({ inspect, expectedSha, wait = ms => new Promise(resolve => setTimeout(resolve, ms)), attempts = 540, log = console.log }) {
  for (let i = 0; i < attempts; i++) {
    if (platformCheckState(await inspect(), expectedSha)) return;
    if (i % 6 === 0) log('等待 Windows/macOS 同一成品安装检查通过…');
    await wait(10000);
  }
  throw Error('双平台安装检查等待超时；保留同版成品后续跑');
}

/** Separate Node processes keep synchronous npm/gh calls from blocking other channels. */
export function spawnReleaseChannel(config, { spawnProcess = spawn, log = console.log } = {}) {
  const worker = fileURLToPath(new URL('./release-channel.mjs', import.meta.url));
  return new Promise((resolve, reject) => {
    const child = spawnProcess(process.execPath, [worker, config], { shell: false, stdio: ['ignore', 'pipe', 'pipe'], env: process.env });
    for (const stream of [child.stdout, child.stderr]) {
      stream?.setEncoding('utf8');
      stream?.on('data', text => log(text.trimEnd()));
    }
    child.once('error', () => reject(Error('发布子进程无法启动')));
    child.once('close', (code, signal) => code === 0 ? resolve() : reject(Error(`发布子进程退出：${signal || code}`)));
  });
}

export async function runReleaseChannels({ common, channels = ['github', 'gitee', 'npm'], run = spawnReleaseChannel, log = console.log }) {
  if (new Set(channels).size !== channels.length || channels.some(name => !['github', 'gitee', 'npm'].includes(name))) throw Error('无效发布任务');
  const bytes = readFileSync(common.archive);
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  if (common.sha256 !== sha256) throw Error('共享成品摘要不一致，未启动发布');
  mkdirSync(common.out, { recursive: true });
  const tasks = channels.map(async channel => {
    const config = path.join(common.out, `channel-${channel}.json`);
    writeFileSync(config, JSON.stringify({ ...common, channel }, null, 2) + '\n', { mode: 0o600 });
    log(`[${channel}] 开始发布／核验同一成品`);
    try { await run(config, { log: text => log(`[${channel}] ${text}`) }); }
    catch (error) { log(`[${channel}] 未完成；其他任务继续`); throw error; }
    log(`[${channel}] 发布及核验完成`);
    return channel;
  });
  // One failure must not terminate healthy uploads or lose their results.
  const settled = await Promise.allSettled(tasks);
  const report = { version: common.version, sha256, channels: Object.fromEntries(channels.map((name, index) => [name,
    settled[index].status === 'fulfilled' ? { status: 'verified' } : { status: 'failed', error: settled[index].reason.message }])) };
  writeFileSync(path.join(common.out, 'channels.json'), JSON.stringify(report, null, 2) + '\n');
  const failed = channels.filter((_, index) => settled[index].status === 'rejected');
  if (failed.length) throw Error(`${failed.join('、')} 未完成；其他端结果已保留，同版本 --all --resume 续跑，已完成端仅核验`);
  return report;
}
