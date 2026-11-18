import type { FilmProfile } from '../types.js';
export default {
  "id": "COMEDY",
  "revision": "1",
  "label": "情景喜剧",
  "strategy": "预期→升级→反差→回收",
  "boundary": "笑点来自人物与情境，不依赖刻板印象、夸张表情或音效。",
  "creative_fields": {
    "comic_premise": "观众预期与喜剧前提",
    "payoff": "反差落点与回收"
  },
  "script_fields": {
    "setup_payoff": "铺垫与笑点的对应",
    "reaction_budget": "笑点前后反应与停顿的时间安排"
  },
  "review_criteria": [
    {
      "id": "comedy_1",
      "description": "笑点是否有可辨识的铺垫"
    },
    {
      "id": "comedy_2",
      "description": "反差是否由人物行为引发且有反应时间"
    }
  ],
  "role_rules": {
    "screenwriter": "先让预期成立再偏离，避免角色为笑话突然失去常识。",
    "storyboard": "关键笑点信息不可被运镜遮住，给观众读懂反差和人物反应的时间。"
  }
} satisfies FilmProfile;
