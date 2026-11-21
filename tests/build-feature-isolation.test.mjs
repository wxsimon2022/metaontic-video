import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {build} from 'esbuild';
const defines={__PLUGIN_VERSION__:'"test"',__FLOW_CANVAS_AVAILABLE__:'false'};
test('disabled canvas UI is excluded while host history and recovery endpoints remain',async()=>{
 const client=await build({entryPoints:['src/client.ts'],bundle:true,write:false,metafile:true,minifySyntax:true,format:'iife',platform:'browser',loader:{'.svg':'text','.png':'dataurl'},define:defines});
 const clientInputs=Object.values(client.metafile.outputs)[0].inputs;
 assert.equal(clientInputs['src/businesses/video-generation/client/canvas-view.ts']?.bytesInOutput||0,0);
 assert.equal(clientInputs['src/businesses/video-generation/integrations/canvas-stages.ts']?.bytesInOutput||0,0);
 const host=await build({entryPoints:['src/index.ts'],bundle:true,write:false,minifySyntax:true,format:'esm',platform:'node',define:defines});
 const output=host.outputFiles[0].text;
 assert.ok(output.includes('/metaontic-video/canvas-native'),'history/native recovery interface remains');
 assert.ok(output.includes('registerBuiltinCanvas'),'historical storage and media interface remains');
 assert.ok(!output.includes('function createCanvasProjectSync('),'hidden automatic projection excluded');
 assert.ok(!output.includes('function createCanvasBridge('),'hidden chat bridge excluded');
});
test('release entry does not load or inspect the promotional page',()=>{
 const source=readFileSync('scripts/release.mjs','utf8');
 assert.ok(!source.includes('sync-promo-address'));
});
