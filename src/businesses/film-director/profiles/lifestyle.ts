import type { FilmProfile } from './types.js';
export default {
  "id": "LIFESTYLE",
  "revision": "1",
  "label": "生活Vlog／氛围片",
  "strategy": "体验起点→细节发现→感受变化",
  "boundary": "可以无冲突、无对白、无人像；生活质感与观察顺序成立即可，不强造戏剧。",
  "creative_fields": {
    "experience_line": "本片体验或观察主线",
    "detail_discovery": "值得观看的具体细节发现"
  },
  "script_fields": {
    "observation_progression": "细节如何逐步被发现",
    "sensory_rhythm": "生活动作、环境声及留白的节奏"
  },
  "review_criteria": [
    {
      "id": "lifestyle_1",
      "description": "观察是否有推进而非重复风景"
    },
    {
      "id": "lifestyle_2",
      "description": "生活动作和声音是否可信且符合用户氛围"
    }
  ],
  "role_rules": {
    "screenwriter": "以生活动作和感官发现组织内容，允许留白，不虚构苦难或硬加反转。",
    "storyboard": "构图让观众发现细节，空间光线与环境声音参与叙事，固定机位可以成立。"
  }
} satisfies FilmProfile;
