import type { AgentDefinition } from '../contracts/agent-definition.js';
import { promoVideoGuidance } from './instructions.js';
export const promoVideo: AgentDefinition = {
  id: 'promo-video', name: '宣传视频助手', businesses: ['video', 'film-director'],
  skills: ['video-director', 'promo-video'], icon: 'presets/icons/promo-video.svg',
  prompt: promoVideoGuidance,
};
