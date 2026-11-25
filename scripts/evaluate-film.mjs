/** 离线创作评测：不发起模型调用；艺术项无评阅证据时明确未评估。 */
import {readFile,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {build} from 'esbuild';
const args=process.argv.slice(2);
if(!args.length||args.includes('--help')) {
 console.log('node scripts/evaluate-film.mjs cases\nnode scripts/evaluate-film.mjs compare <baseline.json> <candidate.json> [report.json]\nnode scripts/evaluate-film.mjs <candidate.json> [report.json]\n候选含 case_id、script，可选 assessment（reviewer、criteria：id/status/evidence[{scene_id,reason}]）。不提供评阅时不宣称艺术质量通过。');
}else if(args[0]==='cases')console.log(await readFile(new URL('../tests/fixtures/story-evaluation/cases.json',import.meta.url),'utf8'));
else {
 const comparing=args[0]==='compare';
 const candidate=JSON.parse(await readFile(args[comparing?2:0],'utf8'));
 const baseline=comparing?JSON.parse(await readFile(args[1],'utf8')):null;
 const cases=JSON.parse(await readFile(new URL('../tests/fixtures/story-evaluation/cases.json',import.meta.url),'utf8'));
 const selected=cases.find(c=>c.id===candidate.case_id);if(!comparing&&!selected)throw Error('UNKNOWN_EVALUATION_CASE');
 const folder=await mkdtemp(path.join(tmpdir(),'film-evaluation-'));
 try {
  const output=path.join(folder,'evaluation.mjs');
  await build({entryPoints:[fileURLToPath(new URL('../src/businesses/film-production/evaluation/story-evaluation.ts',import.meta.url))],outfile:output,bundle:true,platform:'node',format:'esm'});
  const {evaluateStory}=await import(pathToFileURL(output).href);
  let comparison;
  if(comparing){
   const benchmark=path.join(folder,'benchmark.mjs');
   await build({entryPoints:[fileURLToPath(new URL('../src/businesses/film-production/evaluation/benchmark.ts',import.meta.url))],outfile:benchmark,bundle:true,platform:'node',format:'esm'});
   const {compareBenchmarks}=await import(pathToFileURL(benchmark).href);
   comparison=compareBenchmarks(cases,baseline.records||baseline,candidate.records||candidate,candidate.preference);
  }
  const result=JSON.stringify(comparing?comparison:{case:selected,...evaluateStory(candidate.script,candidate.assessment)},null,2)+'\n';
  const destination=args[comparing?3:1];
  if(destination)await writeFile(destination,result);else console.log(result);
 }finally{await rm(folder,{recursive:true,force:true});}
}
