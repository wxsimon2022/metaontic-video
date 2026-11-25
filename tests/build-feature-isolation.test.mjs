import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {build} from 'esbuild';
const defines={__PLUGIN_VERSION__:'"test"'};
test('workflow canvas implementation and endpoints are absent from both bundles',async()=>{
 for(const [entry, platform, format] of [['src/client.ts','browser','iife'],['src/index.ts','node','esm']]) {
  const result=await build({entryPoints:[entry],bundle:true,write:false,metafile:true,minifySyntax:true,format,platform,loader:{'.svg':'text','.png':'dataurl','.jpg':'dataurl'},define:defines});
  assert.ok(!Object.keys(result.metafile.inputs).some(file=>/integrations\/canvas|client\/canvas-view/.test(file)));
  const output=result.outputFiles[0].text;
  for(const forbidden of ['video_canvas','canvas-native','registerBuiltinCanvas','createCanvasBridge','canvasEnabled','autoCreateCanvas']) assert.ok(!output.includes(forbidden), `${entry}: ${forbidden}`);
 }
});
test('release entry does not load or inspect the promotional page',()=>{
 const source=readFileSync('scripts/release.mjs','utf8');
 assert.ok(!source.includes('sync-promo-address'));
});
