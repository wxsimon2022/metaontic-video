import type { FilmProfile } from '../types.js';
export default {
  "id": "DRAMA",
  "revision": "1",
  "label": "剧情短片",
  "strategy": "人物目标→阻碍→选择→可见后果",
  "boundary": "允许克制的日常矛盾，不机械添加悲情或反转。",
  "creative_fields": {
    "character_goal": "人物此刻的具体目标",
    "choice_and_consequence": "关键选择与后果"
  },
  "script_fields": {
    "causal_progression": "事件之间的因果推进",
    "character_change": "人物或关系的变化"
  },
  "review_criteria": [
    {
      "id": "drama_1",
      "description": "动机是否由行动体现"
    },
    {
      "id": "drama_2",
      "description": "选择和结果是否有因果依据"
    }
  ],
  "role_rules": {
    "screenwriter": "围绕人物选择写场景，配角有自身理由，不用机械误会制造阻碍。",
    "storyboard": "让观众看清选择发生的瞬间与后果，反应镜头承担关系变化。"
  }
} satisfies FilmProfile;
