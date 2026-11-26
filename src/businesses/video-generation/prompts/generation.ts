/** prompts/generation：从宿主入口拆出的独立职责模块。 */
import { FORWARD_TRANSITION, CLOSEUP_TRANSITION, CONTINUOUS_TRANSITION } from '../config.js';
import { isOmniExtendModel } from '../providers/connection.js';

/** 只约束声音执行，不自动改写已审核台词或给无对白镜头添加人声。 */
const SPEECH_EXECUTION = '【对白执行】仅在本段已指定对白时发声，按指定语言、说话人和先后顺序清晰自然地说出本段台词；一人说完另一人再接，不抢话、不串台。'
  + '台词以{}、音效以<>、音乐以()区分；如有发音文本映射，{}内为实际朗读文本，展示原文只用于已要求的字幕，不把映射说明读出来。'
  + '每句完整说完，保留句内停顿、人物反应及结尾留白，不为赶时长加速、吞字或截断，不复述上一段。无对白时不新增人声；未要求字幕时不生成字幕。';

/**
 * 延长提示词。开头用「向后延长视频1」/「向前延长视频1」这类显式说法，
 * 并用「视频1」指代输入素材——写成「参考视频1」容易被上游当成「参考生视频」而不是延长。
 * 按新增内容、接缝状态、镜头与声音、必要限制组织；只加载适用的声音规则。
 */
export function buildExtensionPrompt({
  prompt, seconds, startAt, mode, transitionDescription, generateAudio = true, direction = 'backward', wording = 'extend',
}) {
  const forward = direction === 'forward';
  if (transitionDescription !== undefined && typeof transitionDescription !== 'string') throw new Error('过渡描述必须是文字。');
  // 逐段已审核的单行标记优先于整次调用的通用过渡，不改写对白或剧情。
  const embedded = String(prompt || '').match(/【过渡画面】([^\r\n]*)/)?.[1]?.trim();
  const explicitTransition = embedded || String(transitionDescription || '').trim();
  const plotPrompt = String(prompt || '').replace(/【过渡画面】[^\r\n]*/g, '').trim();
  const transitionText = explicitTransition || (forward
    ? '本段末尾的动作、视线和声音逐步进入视频1开头的状态，保持叙事连续，不复制视频1已发生的内容。'
    : mode === 'closeup'
      ? '承接视频1末尾的状态，在完整对白或动作结束后按本段脚本切换景别；未指定时切到听者的近景反应，再推进新剧情，保持轴线、人物关系和声音连续。'
      : '承接视频1末尾人物的动作阶段和视线，同机位顺势进入本段新动作，环境声与配乐自然延续，不重复上一段动作或台词。');
  const plannedCut = Boolean(explicitTransition) || (!forward && mode === 'closeup');
  const head = forward
    ? '向前延长视频1。'
    : (wording === 'after' ? '生成视频1之后的内容：' : '向后延长视频1。');
  const span = forward
    ? (startAt == null
      ? `生成 ${seconds} 秒前置画面，接在视频1第一帧之前。`
      : `生成 ${seconds} 秒前置画面，对应整片第 ${Math.max(0, startAt - seconds)}–${startAt} 秒，紧接在视频1之前。`)
    : (startAt == null
      ? `生成 ${seconds} 秒续拍画面，接在视频1最后一帧之后。`
      : `生成 ${seconds} 秒续拍画面，对应整片第 ${startAt}–${startAt + seconds} 秒，接在视频1之后。`);
  const transition = explicitTransition
    ? '按已审核的过渡画面描述执行接缝；只有描述明确安排切镜、景别或场景变化时才改变，不擅自换人、换装、重新开场或重复已完成动作。'
    : forward
    ? FORWARD_TRANSITION
    : (mode === 'closeup' ? CLOSEUP_TRANSITION : CONTINUOUS_TRANSITION);
  return [
    `${head}${span}`,
    `【本段新增内容】${endWithPunctuation(plotPrompt)}`,
    `【过渡画面】${transitionText}`,
    '【接缝状态】以视频1实际可见的接触、持物手、物件位置、视线和动作阶段为准；保持已有主体外观与服装，不为恢复旧姿态让物件回手、人物跳位或动作倒放。',
    '【镜头与光线】'+(plannedCut
      ? '明确切镜时允许改变景别与机位；未安排切镜时顺接原镜头。曝光、白平衡与场景变化须有脚本依据。'
      : '接缝匹配视频1'+(forward ? '开头' : '结尾')+'的机位、景别与运动，接缝之外按已审核脚本执行，不自行压暗或偏色。'),
    generateAudio === false ? '【声音】关闭音频，不生成对白、环境声或配乐。' :
      '【声音】'+(forward ? '本段末尾衔接视频1开头' : '接续视频1结尾')+'，环境声与配乐按已审核方案交接；未要求新增配乐时沿用原方案。'+speechExecution(plotPrompt, true),
    `【必要限制】仅输出新增${forward ? '前置' : '续拍'}片段，不重复上一段动作或台词，不复用原视频画面；不添加未批准的角色、道具或情节。未要求字幕时不生成字幕。本段已审核的运镜、切镜与声音安排优先。`,
    transition,
  ].join('\n');
}

/** 逐段执行契约：连续剧情只带当前段内容，上一段只提供状态。 */
export function buildSegmentExecutionPrompt({ prompt, kind, index, count }) {
  const last = index >= count - 1;
  const boundary = kind === 'generate'
    ? count === 1
      ? '这是完整单段作品：按已审核脚本完成开场、发展与结尾，结尾落实本片指定变化和收束，不等待不存在的下一段。'
      : '这是首段：只演本段事件，结尾停在本段指定状态，不抢演后段剧情，不做整片结束式收尾。'
    : '这是续拍段：视频1提供上一段结束状态，从其后的新事件继续。不要重演进场、递接物品或已说台词。';
  return [
    `【生成段 ${index + 1}/${count}】生成段编号不是切镜指令；镜头是否切换以脚本为准。`,
    '【执行内容】' + String(prompt).trim(),
    boundary,
    !last
      ? '在完整句结束、动作完成或自然反应处交接，保留人物位置、视线、持物手和镜头运动状态，不用定格等待填满时长。关键字、首次接触和剧情揭示放在可完整看清的位置，不把唯一关键信息挤在最后几帧；收尾仍按原时长自然表演，不额外增加等待或改写台词。'
      : '完成本段的故事变化，再用自然反应或画面收束；不重述前情。',
  ].join('\n');
}

export function buildGenerationPrompt({ prompt, seconds, model = '', generateAudio = true }) {
  const timing = isOmniExtendModel(model)
    ? '按本段事件顺序推进；如有时间区间，以本段0秒为起点，区间连续，不遗漏停顿与反应时间。'
    : '按本段事件顺序自然推进，以镜头序号或先后阶段组织内容，不依赖精确时间戳，不为追逐秒点压缩动作或对白。';
  return [
    `生成 ${seconds} 秒视频。`,
    String(prompt).trim(),
    timing,
    speechExecution(String(prompt), generateAudio),
    '人物身份、服装、场景与光线按已审核脚本保持连贯；未明确要求时不新增字幕、水印、片头片尾或配乐。',
  ].join('\n');
}

/** 明确无对白时使用短规则；无法判断时保留完整契约，关闭音频优先。 */
function speechExecution(prompt: string, generateAudio: boolean) {
  if (generateAudio === false) return '【声音】关闭音频，不生成对白、环境声或配乐；无对白时不新增人声。';
  const explicitSpeech = /[{｛“「]|(?:对白|台词|旁白|配音|说|问|回答|唱)[：:]|\b(says?|speaks?|narration)\b/i.test(prompt);
  const noSpeech = /无对白|无台词|无人声|空镜|仅环境声|\bno (?:dialogue|speech|voices?)\b/i.test(prompt);
  if (noSpeech && !explicitSpeech) return '仅执行已审核的声音安排；无对白时不新增人声，环境声与配乐按原方案。';
  // 未标注的自然语言对白仍保留完整契约，不把没识别到格式当成没有对白。
  return SPEECH_EXECUTION;
}

/** 把用户给的剧情描述接成完整句子时补个句号，避免两句粘在一起。 */
function endWithPunctuation(text) {
  const value = String(text ?? '').trim();
  if (!value) return '';
  return /[。．.!！?？;；~～:：,，]$/.test(value) ? value : `${value}。`;
}
