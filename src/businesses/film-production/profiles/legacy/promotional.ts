import type { FilmProfile } from '../types.js';
export default {
  "id": "PROMOTIONAL",
  "revision": "1",
  "label": "品牌／地域宣传",
  "strategy": "识别特征→具体生活→人物或观察对象→情绪落点",
  "boundary": "地域和品牌特征具体可信，不用空泛赞美替代内容；不强制增加人物。",
  "creative_fields": {
    "recognizable_identity": "品牌或地域的可辨识特征",
    "emotional_anchor": "情绪落点及其具体载体"
  },
  "script_fields": {
    "distinctive_details": "具有辨识度的生活或品牌细节",
    "identity_progression": "细节如何共同呈现主题"
  },
  "review_criteria": [
    {
      "id": "promotional_1",
      "description": "画面是否具有当地或品牌辨识度"
    },
    {
      "id": "promotional_2",
      "description": "情绪是否由具体细节而非口号支撑"
    }
  ],
  "role_rules": {
    "screenwriter": "把身份特征落在具体使用或生活细节，真实地点资料不足标待核实。",
    "storyboard": "空间、人物或物件关系体现地域品牌特征，不用通用航拍和素材堆砌替代。"
  }
} satisfies FilmProfile;
