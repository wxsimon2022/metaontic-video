import type { FilmProfile } from '../types.js';
export default {
  "id": "DOCUMENTARY",
  "revision": "1",
  "label": "纪录／知识片",
  "strategy": "核心问题→证据与例子→解释→回应",
  "boundary": "区分已核实事实、用户材料、待核实内容与戏剧化重现；不编造采访和真实经历。",
  "creative_fields": {
    "central_question": "要回应的具体问题",
    "evidence_plan": "已有来源与待补证据计划"
  },
  "script_fields": {
    "evidence_sources": "论据与对应来源，缺失标待核实",
    "fact_fiction_boundary": "事实、解释和重现的边界"
  },
  "review_criteria": [
    {
      "id": "documentary_1",
      "description": "关键陈述是否有来源或明确待核实"
    },
    {
      "id": "documentary_2",
      "description": "事实与虚构重现是否清楚区分"
    }
  ],
  "role_rules": {
    "screenwriter": "用可核实材料支撑说明，不为制造冲突编造真实人物心理。",
    "storyboard": "证据画面与解释对应，重现须明确标识，画面不能暗示未经证实的因果。"
  }
} satisfies FilmProfile;
