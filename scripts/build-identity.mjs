/** Content identities exclude generated files and local credentials. */
import {createHash} from 'node:crypto';
import {readFile,readdir} from 'node:fs/promises';
import path from 'node:path';
export const BUILD_OUTPUTS=['dist/index.js','dist/client.js','dist/presets/video-director.js','dist/locale/en.json','dist/locale/zh.json','locale/en.json','locale/zh.json'];
export const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
export async function sourceIdentity(root=process.cwd()){
 const files=['package.json','package-lock.json','LICENSE','THIRD_PARTY_NOTICES.md','cordis.patch.yml','plugin-detail.md','scripts/build.mjs','scripts/build-identity.mjs','scripts/package-description.mjs'];
 async function walk(relative){for(const entry of (await readdir(path.join(root,relative),{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name,'en'))){const file=relative+'/'+entry.name;if(entry.isDirectory())await walk(file);else if(entry.isFile())files.push(file);}}
 for(const folder of ['src','skills','locale/presets'])await walk(folder);
 const hash=createHash('sha256');
 for(const file of files.sort()){hash.update(file+'\0');hash.update(await readFile(path.join(root,file)));hash.update('\0');}
 return hash.digest('hex');
}
export async function verifyBuild(root=process.cwd()){
 const pkg=JSON.parse(await readFile(path.join(root,'package.json'),'utf8'));
 const info=JSON.parse(await readFile(path.join(root,'dist/build-info.json'),'utf8'));
 if(info.version!==pkg.version || info.buildId!==await sourceIdentity(root))throw Error('STALE_BUILD: 源码或版本已改变，请先 npm run build，再打包。');
 for(const file of BUILD_OUTPUTS)if(info.files?.[file]!==digest(await readFile(path.join(root,file))))throw Error('BUILD_OUTPUT_MISMATCH: '+file);
 return info;
}
