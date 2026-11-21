/** Check the Git index without changing local files or repository history. */
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const files = execFileSync('git', ['ls-files', '-z', '-ci', '--exclude-standard'], {
  cwd: root, encoding: 'utf8',
}).split('\0').filter(Boolean);

if (files.length) {
  console.error('以下本地文件已被忽略，但仍在 Git 跟踪范围内。提交前请取消跟踪并保留本地文件：');
  for (const file of files) console.error(`- ${file}`);
  process.exitCode = 1;
} else {
  console.log('仓库检查通过：没有仍被 Git 跟踪的忽略文件。');
}
