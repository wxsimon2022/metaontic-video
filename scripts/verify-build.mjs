import {verifyBuild} from './build-identity.mjs';
const info=await verifyBuild();
console.log(`Verified ${info.version} build ${info.buildId.slice(0,12)}`);
