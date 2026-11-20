import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
export function previousRelease(releases,current){
 const parts=v=>v.replace(/^v/,'').split('.').map(Number);
 const compare=(a,b)=>{const x=parts(a),y=parts(b);for(let i=0;i<3;i++)if(x[i]!==y[i])return x[i]-y[i];return 0;};
 const valid=releases.filter(r=>!r.draft&&!r.prerelease&&/^v\d+\.\d+\.\d+$/.test(r.tag_name)&&compare(r.tag_name,current)<0&&(r.assets||[]).some(a=>a.name===`metaontic-video-${r.tag_name.slice(1)}.tgz`));
 valid.sort((a,b)=>compare(b.tag_name,a.tag_name));
 if(!valid[0])throw Error('No previous stable installation artifact available');
 return valid[0].tag_name;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const repo=process.env.GITHUB_REPOSITORY||'wxsimon2022/metaontic-video';
 const releases=JSON.parse(execFileSync('gh',['api',`repos/${repo}/releases?per_page=100`],{encoding:'utf8'}));
 const version=JSON.parse(readFileSync('package.json','utf8')).version;
 const tag=previousRelease(releases,version);
 execFileSync('gh',['release','download',tag,'--repo',repo,'--pattern',`metaontic-video-${tag.slice(1)}.tgz`,'--dir','previous'],{stdio:'inherit'});
 console.log(`Upgrade baseline: ${tag}`);
}
