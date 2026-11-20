import {test} from 'node:test';
import assert from 'node:assert/strict';
import {previousRelease} from '../scripts/download-previous-release.mjs';
test('upgrade checks choose an available older stable artifact after release cleanup',()=>{
 const r=(v,extra={})=>({tag_name:`v${v}`,assets:[{name:`metaontic-video-${v}.tgz`}],...extra});
 assert.equal(previousRelease([r('4.0.9'),r('4.0.8'),r('4.0.7'),r('4.0.10',{draft:true}),r('4.0.11',{prerelease:true})],'4.0.9'),'v4.0.8');
 assert.throws(()=>previousRelease([r('4.0.8',{assets:[]})],'4.0.9'),/No previous/);
});
