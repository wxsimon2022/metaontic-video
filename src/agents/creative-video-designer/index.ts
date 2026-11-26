import type { AgentDefinition } from '../contracts/agent-definition.js';
import { CINEMATIC_VIDEO_DIRECTOR_PROMPT, DESIGNER_MODE_BOUNDARY } from './prompt.js';
export const creativeVideoDesigner: AgentDefinition = {
  id: 'creative-video-designer', name: '创意视频设计师', businesses: [], skills: [],
  icon: 'presets/icons/creative-video-designer.svg',
  prompt: () => `${DESIGNER_MODE_BOUNDARY}\n\n${CINEMATIC_VIDEO_DIRECTOR_PROMPT}`,
};
