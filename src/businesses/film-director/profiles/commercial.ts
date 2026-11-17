import type { FilmProfile } from './types.js';
export default {
  "id": "COMMERCIAL",
  "revision": "1",
  "label": "产品广告",
  "strategy": "需求→使用过程→价值证据→行动",
  "boundary": "产品外观、功效、数据与认证须有依据，不通过画面暗示未证实效果。",
  "creative_fields": {
    "user_need": "具体用户需求",
    "supported_benefit": "有资料支持的产品利益"
  },
  "script_fields": {
    "claims_and_evidence": "卖点及对应依据，缺失标待核实",
    "usage_and_action": "可观察使用过程与行动引导"
  },
  "review_criteria": [
    {
      "id": "commercial_1",
      "description": "卖点是否由材料支持"
    },
    {
      "id": "commercial_2",
      "description": "使用过程是否清楚且产品身份准确"
    }
  ],
  "role_rules": {
    "screenwriter": "展示真实需求与使用过程，避免堆卖点及无依据前后效果。",
    "storyboard": "关键产品细节和使用步骤清楚可见，品牌文字与Logo依赖授权素材及后期能力。"
  }
} satisfies FilmProfile;
