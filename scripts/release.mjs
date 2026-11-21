/** Explicitly invoked release command. --dry-run never writes, commits or pushes. */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function validVersion(value) { return /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(value || ''); }
export function newer(next, previous) {
  if (!validVersion(next) || !validVersion(previous)) return false;
  const a=next.split('.').map(Number),b=previous.split('.').map(Number);
  for(let i=0;i<3;i++) if(a[i]!==b[i]) return a[i]>b[i];
  return false;
}
export function repository(value, host) {
  const match = /^(?:git@(?:ssh\.)?([^:]+):|https:\/\/([^/]+)\/)([\w.-]+\/[\w.-]+?)(?:\.git)?$/.exec(value || '');
  if (!match || (match[1] || match[2]) !== host || match[3].includes('..')) throw Error(`无效${host}仓库地址`);
  return { transport:value, slug:match[3], web:`https://${host}/${match[3]}` };
}
/** 版本更新内容的字数上限：整篇合计（分类前缀不计），只写用户能感知的结论。 */
export const NOTES_LIMIT=100;
/** 版本更新内容只展示这两类；修复并入「优化」，不单独列一节。 */
export const NOTES_CATEGORIES=['新增','优化'];
/** 更新说明实际字数：按分类前缀后的正文计，空格也算一个字。 */
export function notesLength(items) {
  return (items||[]).reduce((total,item)=>total+String(item||'').replace(/^(新增|优化|修复)：/,'').length,0);
}
export function notesFor(version, items) {
  if (items.some(x=>typeof x==='string'&&x.startsWith('修复：'))) throw Error('版本更新内容只展示「新增」与「优化」：修复项请并入「优化」条目，不单列修复分类');
  if (!validVersion(version) || !Array.isArray(items) || !items.length || items.some(x=>typeof x!=='string'||! /^(新增|优化)：\S/.test(x)||/[\r\n]/.test(x))) throw Error('更新说明必须为完整的新增/优化条目');
  const length=notesLength(items);
  if(length>NOTES_LIMIT) throw Error(`更新说明共 ${length} 字，超过 ${NOTES_LIMIT} 字上限；版本更新内容只写用户能感知的结论，实现细节留在提交与工程记录里`);
  return NOTES_CATEGORIES.filter(c=>items.some(x=>x.startsWith(c+'：'))).map(c=>({category:c,items:items.filter(x=>x.startsWith(c+'：')).map(x=>x.slice(c.length+1))}));
}
/** 标签与发行版仅展示用户更新；验证记录单独写入工程文档。 */
export function publicReleaseNotes(version, items) {
  const sections = notesFor(version, items);
  return `MetaOnticVideo v${version}\n\n` + sections.map(s => s.category + '\n' + s.items.map(i => '- ' + i).join('\n')).join('\n\n') + '\n';
}
export function releaseVerification(includeGithub, promoLine = '', pipeline = false) {
  return '验证\n- 本地构建及测试通过。\n'
    + (pipeline ? '- 成品打包与 Gitee Release 由 Gitee Go 流水线按标签完成（scripts/ci-release.mjs，幂等：已有同大小附件只核对不覆盖）；成品同时由流水线的「上传制品」步骤归档到仓库制品库。本机未打包、未上传附件。\n' : '')
    + (includeGithub ? '- Windows/macOS成品安装及升级为CI上传前置条件。\n' : '- 本条按仅 Gitee 发布处理：未运行 GitHub 双平台 CI，也没做 Windows 桌面实测，Windows 兼容性只有构建与打包层面的保证。\n')
    + promoLine + '- 桌面GUI与付费调用未由发布脚本自动验证。\n';
}
const help = `一键发布（准备好完整说明与指南后执行）：
版本号按改动量选：修复、样式/文案/交互微调等小改只升第三位（如 3.29.1），成规模的新增或行为变化才升第二位，别习惯性升第二位。
说明要求：只写「新增」与「优化」两类（修复并入优化），合计不超过 ${NOTES_LIMIT} 字。
发版同步使用说明书；宣传页使用固定最新版安装地址，后续发版不修改宣传页。
  node scripts/release.mjs 3.13.4 --notes release-plan.json
  node scripts/release.mjs 3.13.4 --notes release-plan.json --dry-run
  node scripts/release.mjs 3.13.4 --all --notes release-plan.json
  node scripts/release.mjs 3.13.4 --all --resume
默认只发 Gitee，并在本机打包后直接创建 Release、上传核对成品（需要本机 GITEE_TOKEN）。
想交给 Gitee Go 流水线打包发布时加 --pipeline（--ci 是同义写法）：本机只做准备、提交、打标签并推送，成品打包、制品库归档与 Gitee Release 都由流水线按标签完成，本机不需要 GITEE_TOKEN。
需要同时同步 GitHub（含双平台安装校验）时加 --both，或 --github <地址>；--both 走本机收尾，不要与 --pipeline 同时用。
--all 一键发布 Gitee、GitHub、npm 并校验中国镜像同步；需 npm 发布凭据，与 --pipeline / --github-only 互斥。
可选：--gitee <Gitee仓库地址> --branch master
--dry-run 只显示范围与计划，不写文件、不改版本、不提交、不联网发布。
--github-only 仅推送 GitHub 标签并发布 GitHub Release，不写入 Gitee。
--resume 仅续跑已提交且同一标签的发布，不改旧标签。
`;

export async function main(argv) {
  if(argv[0]==='--interactive') {
    const {createInterface}=await import('node:readline/promises');
    const input=createInterface({input:process.stdin,output:process.stdout});
    let entered;
    try { console.log('正式发布：请先填写release-plan.json并同步指南；默认在本机打包并发布 Gitee Release（加 --pipeline 交给流水线）。'); entered=(await input.question('请输入正式版本号（小改升第三位，如3.13.4；留空退出）：')).trim(); } finally { input.close(); }
    if(!entered)return;
    return main([entered,...argv.slice(1)]);
  }
  if (!argv.length || argv.includes('--help') || argv.includes('-h')) { console.log(help); return; }
  const version = argv[0]; if (!validVersion(version)) throw Error('版本号必须为X.Y.Z正式版');
  const opts={branch:'master',targets:'gitee',github:'git@ssh.github.com:wxsimon2022/metaontic-video.git',gitee:'git@ssh.gitee.com:hackloop/metaontic-video.git'};
  for(let i=1;i<argv.length;i++) {
    const key=argv[i];
    if(['--dry-run','--resume','--no-promo'].includes(key)) opts[key.slice(2)]=true;
    // 默认在本机打包发布（需要 GITEE_TOKEN）；--pipeline（--ci 同义）才交给 Gitee Go 流水线，--local 是同义写法。
    else if(key==='--pipeline'||key==='--ci') opts.pipeline=true;
    else if(key==='--local') opts.local=true;
    // --both 要等 GitHub CI 的成品再收尾，所以仍然在本机打包发布。
    else if(key==='--github-only') { opts.targets='github'; opts.local=true; }
    else if(key==='--all') { opts.all=true; opts.targets='both'; opts.local=true; }
    else if(key==='--both') { opts.targets='both'; opts.local=true; }
    // GitHub 只在明确要求时同步；不带地址的 --github 表示“连同 GitHub 一起发”。
    else if(key==='--github' && (!argv[i+1] || argv[i+1].startsWith('--'))) opts.targets='both';
    else if(['--notes','--github','--gitee','--branch'].includes(key) && argv[i+1] && !argv[i+1].startsWith('--')) { opts[key.slice(2)]=argv[++i]; if(key==='--github')opts.targets='both'; }
    else throw Error(`未知参数或缺少参数值：${key}`);
  }
  if(opts.all&&argv.includes('--github-only'))throw Error('--all 不能与 --github-only 同用');
  if(opts.all&&opts.pipeline)throw Error('--all 不能与 --pipeline 同用');
  if(opts.pipeline&&opts.local)throw Error('--pipeline（或 --ci）与 --local（或 --both）不能同时用：前者交给 Gitee Go 流水线发布，后者在本机打包发布');
  // 发布路径：默认本机打包并发 Release；--pipeline / --ci 才交给 Gitee Go 流水线（本机只推标签）。
  const pipeline=Boolean(opts.pipeline);
  if(!/^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(opts.branch)||opts.branch.includes('..'))throw Error('无效分支');
  const github=repository(opts.github,'github.com'),gitee=repository(opts.gitee,'gitee.com');
  const includeGithub=opts.targets!=='gitee';
  const githubOnly=opts.targets==='github';
  const channel=opts.all?'Gitee + GitHub + npm / 中国镜像':githubOnly?'仅 GitHub':includeGithub?'Gitee + GitHub':'仅 Gitee';
  // Current workflow mirrors to this configured Gitee repository. Reject silently publishing elsewhere.
  if(gitee.slug!=='hackloop/metaontic-video')throw Error('当前CI绑定hackloop/metaontic-video，变更目标前请同步CI镜像配置');
  process.chdir(root);
  const withdrawnFile=path.join(root,'docs/engineering/withdrawn-releases.json');
  if (existsSync(withdrawnFile) && JSON.parse(readFileSync(withdrawnFile,'utf8')).includes(version)) throw Error(`v${version} 已撤回，禁止重新发布或续跑；请使用新版本号`);
  const run=(command,args,{capture=false,optional=false}={})=>{
    const result=spawnSync(command,args,{cwd:root,encoding:'utf8',stdio:capture?'pipe':'inherit',shell:false});
    if(result.error || result.status!==0) { if(optional)return null; throw Error(`${command} ${args[0]||''} 失败（${result.status??result.error?.code}）`); }
    return capture?result.stdout.trim():'';
  };
  const git=(...args)=>run('git',args,{capture:true});
  const gh=(...args)=>run('gh',args,{capture:true});
  const tag=`v${version}`,target=`${opts.branch}`;
  const out=path.join(root,'.local/releases',version);
  // Gitee 是默认发布渠道，本地成品直接上传；GitHub 是可选镜像。
  const assets=[`metaontic-video-${version}.tgz`];
  if(git('branch','--show-current')!==target)throw Error(`请在${target}分支执行，脚本不会切换分支`);
  if(git('ls-files','-u'))throw Error('有未解决的合并冲突');
  const local=git('describe','--tags','--abbrev=0');
  const changes=git('log',`${local}..HEAD`,'--oneline');
  const dirty=git('status','--short');
  const pkg=JSON.parse(readFileSync('package.json','utf8'));
  let plan;
  if(opts.notes) plan=JSON.parse(readFileSync(path.resolve(opts.notes),'utf8'));
  else if(existsSync('release-plan.json'))plan=JSON.parse(readFileSync('release-plan.json','utf8'));
  else if(opts.resume)plan={items:pkg.releaseNotes?.items,guideReview:'沿用已提交的发布核对'};
  else throw Error('缺少release-plan.json；复制docs/engineering/release-plan.example.json并填写完整更新内容及guideReview');
  const sections=notesFor(version,plan.items);
  if(plan.items.some(x=>/请填写|请替换|占位/.test(x))||/请替换/.test(plan.guideReview||''))throw Error('请先替换发布计划中的模板占位文字');
  if(typeof plan.guideReview!=='string'||plan.guideReview.trim().length<8)throw Error('请填写具体guideReview，记录本次指南核对结果');
  for(const f of ['MetaOnticVideo使用说明书.md','MetaOnticVideo使用说明书.pdf'])if(!existsSync(f))throw Error(`缺少${f}`);
  const guide=readFileSync('MetaOnticVideo使用说明书.md','utf8');
  if(/适用版本|发布核对|^#{1,6}.*(?:更新日志|发布说明|版本更新)/m.test(guide))throw Error('使用说明书含发布内容，请移至工程发布记录');
  // 指南里写死的成品地址必须指向本次版本，否则用户会照旧版本地址安装。
  for(const match of guide.matchAll(/https:\/\/([^/]+)\/[^\s`]+?\/releases\/download\/v(\d+\.\d+\.\d+)\//g))if((!githubOnly||match[1]==='github.com')&&match[2]!==version)throw Error(`使用说明书里的成品地址仍指向 v${match[2]}，请更新为 v${version}`);
  const files=git('ls-files','--cached','--others','--exclude-standard','-z').split('\0').filter(Boolean);
  if(files.some(f=>/(?:价格对比|计费参考|比价视频)|(?:^|\/)\.env(?:$|\.)|(?:^|\/)\.local\//.test(f)))throw Error('待提交文件中存在本地价格资料或环境文件，请先核对忽略规则');
  console.log(`版本：${tag}\n发布渠道：${channel}\nGitee：${gitee.web}${includeGithub?`\nGitHub：${github.web}`:''}\n本地最近标签：${local}\n提交范围：\n${changes||'（无新提交，包含下列工作区改动）'}\n工作区：\n${dirty||'（干净）'}`);
  console.log(sections.map(x=>x.category+'\n'+x.items.map(i=>'- '+i).join('\n')).join('\n\n'));
  const printLinks=()=>console.log(githubOnly ? `\nGitHub发布页：${github.web}/releases/tag/${tag}\n插件地址：${github.web}/releases/download/${tag}/metaontic-video-${version}.tgz` : `\nGitee发布页：${gitee.web}/releases/tag/${tag}\n插件地址：${gitee.web}/releases/download/${tag}/metaontic-video-${version}.tgz${includeGithub?`\nGitHub发布页：${github.web}/releases/tag/${tag}`:''}\n注意：安装框填写tgz地址，不填写发布页或ZIP地址。`);
  if(opts['dry-run']) {
    console.log('宣传页使用固定最新版地址，无需随版本同步。');
    const route=pipeline
      ? '提交/标签 → 推送标签 → Gitee Go 流水线按标签构建、测试、打包 → 发布 Gitee Release 并归档制品库'
      : (includeGithub?'打包/核对 → 提交/标签 → 推送 → 等待双平台CI → 核对两处附件':'打包/核对 → 提交/标签 → 推送 → 上传并核对 Gitee Release 附件');
    console.log(`\nDRY RUN（${channel}）：计划检查 → 构建/测试 → ${route}${opts.all ? ' → npm 成品发布 → 中国镜像同步核对' : ''}。`);printLinks();return;
  }
  // 最新正式版以发布渠道为准：Gitee 单仓发布时不能依赖 GitHub Release 列表。
  const latestOfficial=async()=>{
    const token=process.env.GITEE_TOKEN;
    if(token) {
      try {
        const response=await fetch(`https://gitee.com/api/v5/repos/${gitee.slug}/releases?access_token=${encodeURIComponent(token)}&per_page=50`,{signal:AbortSignal.timeout(20000)});
        if(response.ok) {
          const tags=(await response.json()).filter(r=>!r.prerelease&&/^v\d+\.\d+\.\d+$/.test(r.tag_name||'')).map(r=>r.tag_name);
          if(tags.length)return tags.reduce((a,b)=>newer(b.slice(1),a.slice(1))?b:a);
        }
      } catch(error) { console.log(`读取 Gitee 正式版列表失败：${error.message}`); }
    }
    const tags=git('tag','-l','v*').split('\n').filter(t=>/^v\d+\.\d+\.\d+$/.test(t));
    return tags.length?tags.reduce((a,b)=>newer(b.slice(1),a.slice(1))?b:a):undefined;
  };
  if(includeGithub)run('gh',['auth','status']);
  const giteeLatest=githubOnly?undefined:await latestOfficial();
  const githubLatest=includeGithub
    ? JSON.parse(gh('release','list','--repo',github.slug,'--exclude-drafts','--exclude-pre-releases','--limit','1','--json','tagName'))[0]?.tagName
    : undefined;
  const latest=[giteeLatest,githubLatest].filter(Boolean).reduce((a,b)=>!a||newer(b.replace(/^v/,''),a.replace(/^v/,''))?b:a,undefined);
  if(!opts.resume && latest && !newer(version,latest.replace(/^v/,'')))throw Error(`目标必须高于最新正式版${latest}`);
  const exists=run('git',['rev-parse','--verify',`refs/tags/${tag}`],{capture:true,optional:true});
  if(opts.resume) {
    // 标签之后还会追加一个“刷新插件市场索引”的提交，所以续跑允许标签之后只有市场索引的净变更。
    const tagCommit=git('rev-parse',`${tag}^{commit}`),headCommit=git('rev-parse','HEAD');
    const indexRefreshOnly=headCommit!==tagCommit
      && git('diff','--name-only',`${tagCommit}..HEAD`)==='market/index.json';
    if(!exists||pkg.version!==version||(headCommit!==tagCommit&&!indexRefreshOnly)||dirty)throw Error('续跑要求：标签/版本/HEAD一致（或只有市场索引变更）且工作区干净');
  } else {
    if(exists)throw Error('标签已存在，禁止覆盖；如仅重试发布请使用--resume');
    run(process.execPath,['scripts/check-active-video.mjs']);
    const base=latest||local;
    console.log(`实际待发布范围 ${base}..HEAD：\n${git('log',`${base}..HEAD`,'--oneline')}`);
    // Refuse a changed guide without a refreshed PDF; explicit review also covers unchanged guides.
    const before=run('git',['show',`${base}:MetaOnticVideo使用说明书.md`],{capture:true,optional:true});
    const priorPdf=run('git',['rev-parse',`${base}:MetaOnticVideo使用说明书.pdf`],{capture:true,optional:true});
    if(before!==guide.trim() && priorPdf===git('hash-object','MetaOnticVideo使用说明书.pdf'))throw Error('指南正文已变更，但PDF未同步');
    const now=new Date().toISOString();
    pkg.version=version;pkg.releaseNotes={version,prerelease:false,publishedAt:now,items:plan.items};
    writeFileSync('package.json',JSON.stringify(pkg,null,2)+'\n');
    const lock=JSON.parse(readFileSync('package-lock.json','utf8'));lock.version=version;lock.packages[''].version=version;
    writeFileSync('package-lock.json',JSON.stringify(lock,null,2)+'\n');
    for (const file of ['README.md', 'README.en.md']) {
      const readme=readFileSync(file,'utf8');
      writeFileSync(file,readme.replace(/https:\/\/([^/]+)\/[^\s`]+?\/releases\/download\/v\d+\.\d+\.\d+\/metaontic-video-\d+\.\d+\.\d+\.tgz/g,url=>githubOnly&&!url.includes('github.com/')?url:url.replace(/v\d+\.\d+\.\d+\/metaontic-video-\d+\.\d+\.\d+/,`v${version}/metaontic-video-${version}`)));
    }
    const markdown=sections.map(s=>'### '+s.category+'\n\n'+s.items.map(i=>'- '+i).join('\n')).join('\n\n');
    for(const [file,header] of [['CHANGELOG.md',`## ${tag}`]]) {
      let text=readFileSync(file,'utf8');
      if(text.includes(header)) { const start=text.indexOf(header);const rest=text.slice(start+header.length);const next=rest.search(/^## v\d+\.\d+\.\d+/m);text=text.slice(0,start)+(next<0?'':rest.slice(next)); }
      const at=text.search(/^## v\d+\.\d+\.\d+/m);if(at<0)throw Error(`${file}缺少更新区插入位置`);
      writeFileSync(file,text.slice(0,at)+header+'\n\n'+markdown+'\n\n'+text.slice(at));
    }
    // 固定安装链接由发布附件维护；不修改独立服务端仓库的宣传页。
    const promoLine='';
    mkdirSync(out,{recursive:true});
    // npm CLI is JavaScript; invoking it through Node avoids .cmd shell quoting on Windows.
    const npm=process.env.npm_execpath||run(process.platform==='win32'?'where.exe':'which',['npm'],{capture:true}).split(/\r?\n/).find(x=>x.endsWith('npm'));
    let npmCli=process.env.npm_execpath;
    if(!npmCli && process.platform!=='win32')npmCli=run(process.execPath,['-p',`require('fs').realpathSync(${JSON.stringify(npm)})`],{capture:true});
    if(!npmCli && process.platform==='win32') {
      const cmd=run('where.exe',['npm.cmd'],{capture:true}).split(/\r?\n/)[0];npmCli=path.join(path.dirname(cmd),'node_modules/npm/bin/npm-cli.js');
    }
    if(!npmCli||!existsSync(npmCli))throw Error('未找到npm CLI；建议用npm run release调用');
    if(!existsSync('node_modules/esbuild'))run(process.execPath,[npmCli,'ci']);
    run(process.execPath,[require.resolve('typescript/bin/tsc'),'-p','tsconfig.json']);
    run(process.execPath,[require.resolve('typescript/bin/tsc'),'-p','tsconfig.contracts.json']);
    run(process.execPath,['scripts/build.mjs']);
    run(process.execPath,['--test',...readdirSync('tests').filter(x=>x.endsWith('.test.mjs')).map(x=>'tests/'+x)]);
    run(process.execPath,['scripts/validate-release.mjs']);
    if(pipeline) console.log(`本机不打包：成品由 Gitee Go 流水线按标签 ${tag} 产出（scripts/ci-release.mjs 负责发布与核对，并归档到制品库）。`);
    else {
      run(process.execPath,[npmCli,'pack','--pack-destination',out]);
      run(process.execPath, ['scripts/normalize-package-name.mjs', out]);
      // Python is a packaging tool only; Windows py launcher is accepted.
      const python=process.platform==='win32'?'py':'python3';
      // 包内 README 会被宿主插件页当成「详细介绍」渲染，成品包统一裁掉。
      run(python,[...(python==='py'?['-3']:[]),'scripts/strip-package-readme.py',path.join(out,`metaontic-video-${version}.tgz`)]);
    }
    run('git',['diff','--check']);
    const body=publicReleaseNotes(version,plan.items);
    const verification=releaseVerification(includeGithub,promoLine,pipeline);
    const notes=path.join(out,'release-notes.txt');writeFileSync(notes,body);
    writeFileSync(`docs/engineering/release-${version}.md`,`# ${tag} 发布核对\n\n实际基线：${base}。\n\n${body}\n${verification}\n指南核对：${plan.guideReview}\n`);
    run('git',['add','-A']);run('git',['commit','-m',`release: ${tag}`]);run('git',['tag','-a',tag,'-F',notes]);
    // 插件市场索引里的每个版本都要固定到发布提交，标签刚建好才拿得到这个提交，所以索引在这里单独刷新并提交。
    if(!githubOnly)run(process.execPath,['scripts/market-index.mjs']);
    if(git('status','--short','--','market/index.json')) {
      run('git',['add','market/index.json']);run('git',['commit','-m',`chore(market): 刷新插件市场索引到 ${tag}`]);
    }
  }
  // 先确认发布渠道凭据，避免推送成功后才因为缺令牌停半路；走流水线时本机不发布，所以不需要令牌。
  const token=process.env.GITEE_TOKEN;
  if(!token && !pipeline && !githubOnly)throw Error('缺少 GITEE_TOKEN，无法发布 Gitee Release 附件；设置后可用相同版本 --resume 续跑');
  if(!token && pipeline)console.log('本机不发布 Release，无需 GITEE_TOKEN；令牌配在 Gitee 流水线变量里（GITEE_TOKEN）。');
  // 双仓并行推送，单仓失败按退避重试三次；GitHub 走 ssh 443，实测偶尔整段连不通，单次就放弃最耗时。
  const push=async(repo,host,label,refs=[target,tag])=>{
    const args=repo.transport.startsWith('git@ssh.')?['-c',`core.sshCommand=ssh -p 443 -o HostKeyAlias=${host} -o ConnectTimeout=30 -o ServerAliveInterval=10 -o ServerAliveCountMax=3`]:[];
    for(let attempt=1;attempt<=3;attempt++) {
      const result=spawnSync('git',[...args,'push',repo.transport,...refs],{cwd:root,encoding:'utf8',stdio:'inherit',shell:false});
      if(!result.error&&result.status===0) { console.log(`${label} 已推送`);return true; }
      if(attempt<3) { console.log(`${label} 第 ${attempt} 次推送失败，${attempt*10} 秒后重试`);await new Promise(r=>setTimeout(r,attempt*10000)); }
    }
    console.log(`${label} 推送失败`);
    return false;
  };
  if (includeGithub) {
    // Stage the local package as a draft; CI checks these exact bytes before public release.
    // Only the version tag is pushed to GitHub: its default branch may have independent history.
    if (!githubOnly && !await push(gitee,'gitee.com','Gitee 分支',[target])) throw Error('Gitee 分支推送失败；保留标签后用 --resume 续跑');
    if (!await push(github,'github.com','GitHub 标签',[tag])) throw Error('GitHub 标签推送失败；保留标签后用 --resume 续跑');
    const archive=path.join(out,assets[0]);
    if (!existsSync(archive)) throw Error(`缺少成品 ${archive}`);
    const staged=run('gh',['release','view',tag,'--repo',github.slug,'--json','isDraft'],{capture:true,optional:true});
    if (!staged) run('gh',['release','create',tag,archive,'--repo',github.slug,'--verify-tag','--draft','--title',`MetaOnticVideo ${tag}`,'--notes-file',path.join(out,'release-notes.txt')]);
    else if (JSON.parse(staged).isDraft) {
      const listed=JSON.parse(gh('release','view',tag,'--repo',github.slug,'--json','assets')).assets||[];
      if (!listed.some(a=>a.name===assets[0])) run('gh',['release','upload',tag,archive,'--repo',github.slug]);
    }
  } else if (!await push(gitee,'gitee.com','Gitee')) {
    printLinks();throw Error('Gitee 推送失败；保留标签后用 --resume 续跑');
  }
  if(pipeline) {
    // 流水线按标签触发：构建、测试、打包、制品库归档、发布与附件核对都在 Gitee 构建机上跑，完成后回来核对发布页。
    console.log(`\n已推送 ${tag}：Gitee Go 流水线会按这个标签构建、打包，把成品归档到制品库并发布 Gitee Release（scripts/ci-release.mjs），发布页与附件核对结果见流水线日志。`);
    printLinks();return;
  }
  // --local 备用路径：本机成品直接建 Release 并上传，适合流水线不可用时。
  const {publishGiteeWithAlias:publishGitee}=await import('./publish-gitee.mjs');
  // 续跑也从结构化条目生成，避免旧的本地说明文件夹带验证信息。
  const notesText=publicReleaseNotes(version,plan.items);
  if(!includeGithub) {
    for(const name of assets) {
      const file=path.join(out,name);
      if(!existsSync(file))throw Error(`缺少成品 ${file}；请先重新构建打包再续跑`);
      await publishGitee({token,tag,archive:file,notes:notesText,prerelease:false});
    }
    console.log(`Gitee Release 附件已核对：${assets.join('、')}`);
    console.log('同标签也会触发 Gitee Go 流水线：它只核对已有附件、不重复上传，成品以本次本机发布的为准。');
    printLinks();return;
  }
  // Poll by tag: never watch some unrelated release's run.
  let workflow;
  for(let i=0;i<20;i++) {
    const runs=JSON.parse(gh('run','list','--repo',github.slug,'--workflow','publish.yml','--branch',tag,'--limit','10','--json','databaseId,headSha,status,conclusion'));
    workflow=runs.find(x=>x.headSha===git('rev-parse',`${tag}^{commit}`));
    if(workflow)break;await new Promise(r=>setTimeout(r,3000));
  }
  if(!workflow) {printLinks();throw Error('已推送，但尚未找到匹配CI；稍后用--resume续跑');}
  if(workflow.conclusion==='failure' && opts.resume)run('gh',['run','rerun',String(workflow.databaseId),'--failed','--repo',github.slug]);
  const watched=run('gh',['run','watch',String(workflow.databaseId),'--exit-status','--interval','10','--repo',github.slug],{optional:true});
  const release=run('gh',['release','view',tag,'--repo',github.slug,'--json','assets,isPrerelease,body'],{capture:true,optional:true});
  const data=release?JSON.parse(release):null;
  if(data?.isPrerelease)throw Error('远端错误地标记为预发布');
  const names=data?.assets?.filter(a=>a.state==='uploaded').map(a=>a.name)||[];
  const complete=[...assets,'metaontic-video.tgz'].every(x=>names.includes(x));
  console.log(`GitHub附件：${complete?'齐全':'未齐全'}；双仓CI：${watched===null?'未全部成功':'成功'}`);printLinks();
  if(!complete||watched===null)throw Error('发布未全部完成；保留现有标签，用相同版本--resume续跑，不要重新打版本');
  if(data.body.trim()!==notesText.trim())throw Error('GitHub发行版说明与本版用户更新条目不一致');
  // 双仓模式必须先通过双平台安装检查，再用GitHub同一成品发布Gitee。
  const localDigest=createHash('sha256').update(readFileSync(path.join(out,assets[0]))).digest('hex');
  const verifiedDir=path.join(out,'verified');mkdirSync(verifiedDir,{recursive:true});
  run('gh',['release','download',tag,'--repo',github.slug,'--dir',verifiedDir,'--pattern',`metaontic-video-${version}.tgz`,'--clobber']);
  const remoteDigest=createHash('sha256').update(readFileSync(path.join(verifiedDir,assets[0]))).digest('hex');
  if (remoteDigest!==localDigest) throw Error('GitHub 安装包与本机原始成品不一致，停止向 Gitee 发布');
  if (githubOnly) { console.log('仅 GitHub 正式发布完成，未向 Gitee 推送或发布。'); return; }
  if (!await push(gitee,'gitee.com','Gitee 标签',[tag])) throw Error('Gitee 标签推送失败；保留同版成品后续跑');
  for(const name of assets)await publishGitee({token,tag,archive:path.join(out,name),notes:notesText,prerelease:false});
  console.log(`双平台CI通过，GitHub与Gitee已发布同一成品：${assets.join('、')}`);
  if(opts.all) {
    const {publishNpmRelease}=await import('./publish-npm-release.mjs');
    try { await publishNpmRelease({name:pkg.name,version,archive:path.join(out,assets[0])}); }
    catch(error) { throw Error(`仓库发行版已完成，npm/中国镜像未完成：${error.message}；若 npm 提示 staged，请在 npm 批准后以同版本 --all --resume 续跑，不改标签`); }
    run(process.execPath,['scripts/market-index.mjs']);
    if(git('status','--short','--','market/index.json')) {
      run('git',['add','market/index.json']);run('git',['commit','-m',`chore(market): 切换 ${tag} 到 npm 来源`]);
      if(!await push(gitee,'gitee.com','Gitee 市场索引',[target]))throw Error('npm 已完成但 Gitee 索引未推送');
      if(!await push(github,'github.com','GitHub 市场索引',[target]))throw Error('npm 已完成但 GitHub 索引未推送');
    }
    console.log('三端发布完成：中国镜像已核对目标版本、组合包声明和成品完整性。');
  }


}
if(process.argv[1] && realpathSync(process.argv[1])===fileURLToPath(import.meta.url))main(process.argv.slice(2)).catch(error=>{console.error(`发布停止：${error.message}`);process.exitCode=1;});
