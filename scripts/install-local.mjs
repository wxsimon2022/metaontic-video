/** Build and install a content-addressed archive; CLI success alone never proves live activation. */
import {spawnSync} from 'node:child_process';
import {readFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {verifyBuild,BUILD_OUTPUTS,digest} from './build-identity.mjs';
const profile=process.argv[2]||'desktop';
if(!/^[a-zA-Z0-9_-]+$/.test(profile))throw Error('Invalid profile name');
function run(command,args,capture=false){
 const win=process.platform==='win32'&&['npm','dsh'].includes(command);
 // cmd.exe requires quoting; reject metacharacters rather than accepting shell syntax.
 if(win&&[command,...args].some(value=>/["%\r\n&|<>^!]/.test(value)))throw Error('Windows command contains unsupported shell characters');
 const result=spawnSync(win?process.env.ComSpec||'cmd.exe':command,win?['/d','/s','/c',`"${[command+'.cmd',...args].map(value=>'"'+value+'"').join(' ')}"`]:args,{encoding:'utf8',stdio:capture?'pipe':'inherit',maxBuffer:10*1024*1024});
 if(result.error||result.status!==0)throw Error(result.error?.message||result.stderr||`${command} exited ${result.status}`);
 return result.stdout;
}
run(process.execPath,['scripts/check-active-video.mjs']);
run('npm',['run','build']);
const info=await verifyBuild();
const pkg=JSON.parse(await readFile('package.json','utf8'));
const directory=path.resolve('.local','install',`${info.version}-${info.buildId}`);
await mkdir(directory,{recursive:true});
const output=run('npm',['pack','--json','--pack-destination',directory],true);
// npm lifecycle output may precede the JSON array.
const match=output.match(/\[\s*\{[\s\S]*\}\s*\]\s*$/);
if(!match)throw Error('npm pack did not return an archive manifest');
const filename=JSON.parse(match[0])[0]?.filename;
if(!filename||path.basename(filename)!==filename)throw Error('Invalid packed filename');
const archive=path.join(directory,filename);
run('dsh',['plugin','--profile',profile,'add',archive]);
const installed=path.join(process.env.DSH_HOME||path.join(os.homedir(),'.dsh'),'profiles',profile,'node_modules',pkg.name);
const metadata=JSON.parse(await readFile(path.join(installed,'dist','build-info.json'),'utf8'));
const installedPackage=JSON.parse(await readFile(path.join(installed,'package.json'),'utf8'));
if(metadata.buildId!==info.buildId||metadata.version!==info.version||installedPackage.version!==info.version)throw Error('安装内容与本次构建不一致，未确认成功。');
for(const file of BUILD_OUTPUTS)if(digest(await readFile(path.join(installed,file)))!==info.files[file])throw Error('安装文件校验失败：'+file);
console.log(`文件已安装并校验：${info.version}（${info.buildId.slice(0,12)}）。运行中的版本尚未确认；不能将磁盘校验当作热加载成功。`);
