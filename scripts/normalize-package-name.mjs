/** Keep published archive URLs stable when the npm package name changes. */
import { existsSync, readFileSync, renameSync } from 'node:fs';
import path from 'node:path';
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
if (!/^[a-z0-9-]+$/.test(pkg.name) || !/^\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?$/.test(pkg.version)) throw Error('Invalid package identity');
const directory = process.argv[2];
if (!directory) throw Error('Usage: node scripts/normalize-package-name.mjs <directory>');
const source = path.join(directory, `${pkg.name}-${pkg.version}.tgz`);
const target = path.join(directory, `metaontic-video-${pkg.version}.tgz`);
if (source !== target) {
  if (existsSync(target)) throw Error(`Refusing to overwrite ${target}`);
  renameSync(source, target);
}
console.log(target);
