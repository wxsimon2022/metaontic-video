import { createAgentRegistry } from '../app/registry/agent.registry.js';
import { videoDirector } from './video-director/index.js';
import { creativeVideoDesigner } from './creative-video-designer/index.js';
export const agents = [videoDirector, creativeVideoDesigner];
export const agentRegistry = createAgentRegistry(agents);
