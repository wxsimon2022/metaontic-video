import { createAgentRegistry } from '../app/registry/agent.registry.js';
import { videoDirector } from './video-director/index.js';
export const agents = [videoDirector];
export const agentRegistry = createAgentRegistry(agents);
