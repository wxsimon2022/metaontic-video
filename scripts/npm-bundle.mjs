import { gunzipSync } from 'node:zlib';

/** 发布及镜像检查共用成品校验，不能只检查 registry 元数据。 */
export function validateNpmBundle(bytes, { name, version } = {}) {
  const tar = gunzipSync(bytes, { maxOutputLength: 64 * 1024 * 1024 });
  const files = new Map();
  for (let offset = 0; offset + 512 <= tar.length;) {
    const header = tar.subarray(offset, offset + 512);
    if (header.every(byte => byte === 0)) break;
    const entry = header.subarray(0,100).toString().replace(/\0.*$/, '');
    const size = parseInt(header.subarray(124,136).toString().replace(/\0.*$/, '').trim() || '0',8);
    if (!Number.isSafeInteger(size) || size < 0 || offset + 512 + size > tar.length) throw Error('Invalid npm archive');
    if (['0','\0'].includes(String.fromCharCode(header[156]))) files.set(entry,tar.subarray(offset + 512,offset + 512 + size));
    offset += 512 + Math.ceil(size / 512) * 512;
  }
  const manifest = JSON.parse(files.get('package/package.json')?.toString() || 'null');
  if (!manifest || manifest.stub || !manifest.dsh?.bundle) throw Error('Package declares no dsh.bundle');
  if (name && manifest.name !== name || version && manifest.version !== version) throw Error('npm archive name/version mismatch');
  const patch = manifest.dsh.bundle.patch;
  if (typeof patch !== 'string' || !/^\.\/[a-zA-Z0-9_./-]+$/.test(patch) || patch.split('/').includes('..') || !files.has(`package/${patch.slice(2)}`)) throw Error('dsh.bundle.patch is invalid or missing from archive');
  return manifest;
}
