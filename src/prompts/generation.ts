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
 * 正文分五块写清，减少衔接断层：延长方向、剧情发展、主体状态、镜头运动、声音延续。
 */
export function buildExtensionPrompt({
  prompt, seconds, startAt, mode, direction = 'backward', wording = 'extend',
}) {
  const forward = direction === 'forward';
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
  const transition = forward
    ? FORWARD_TRANSITION
    : (mode === 'closeup' ? CLOSEUP_TRANSITION : CONTINUOUS_TRANSITION);
  return [
    `${head}${span}`,
    `【延长方向】${forward ? '向前延长（前置剧情，放在视频1之前）' : '向后延长（续拍剧情，接在视频1之后）'}。`,
    `【剧情发展】${endWithPunctuation(prompt)}${forward
      ? '只演视频1之前发生的前置剧情，不复述视频1里的情节。'
      : '只演视频1之后发生的新剧情，不重复视频1里的情节、不重新开场。'}`,
    '【主体状态】' + (forward
      ? '本段收尾的人物面貌、体型、服装、姿态、手部位置和动作阶段必须能直接接到视频1第一帧；'
      : '沿用视频1结尾的人物面貌、体型、服装、姿态、手部位置和动作阶段；')
      + '同一角色保持音色、口音、语速和当前情绪，不换人、不换装，不改变年龄与外貌特征。',
    '【镜头运动】在接缝处匹配视频1' + (forward ? '开头的' : '结尾的')
      + '机位、景别、焦段、运镜方向与速度；接缝之外按本段脚本自然运镜或切镜。保持曝光、白平衡、光源方向和场景布局连贯，'
      + '避免无剧情依据的亮度跳变或背景重建；'
      // 两次生成是各自曝光的：不写死这条，接缝处常整体偏暗 2-3 级，看起来像换了一段
      + '整段亮度与色调必须与视频1' + (forward ? '开头' : '结尾') + '一致，不要整体压暗或偏色。',
    '【声音延续】' + (forward
      ? '本段声音在结尾自然衔接视频1开头，台词只讲前置剧情。'
      : '本段声音接续视频1结尾，台词只讲后续剧情。')
      + '保持角色音色与环境底噪一致，每句台词完整说完，不复述原台词。'
      + '原视频有配乐时保持曲目与节奏连贯；原视频无配乐时不新增配乐。',
    forward
      ? '【输出边界】仅输出新增前置片段；原视频开头只用于衔接，不复制原视频画面或已出现的台词。'
      : '【输出边界】仅输出新增续拍片段；参考视频末尾只用于理解当前状态，不把末尾几秒再次输出。起始即推进下一动作，不重做拿起、放下、递手机等已完成动作；不重复上一句对白或其尾音。',
    SPEECH_EXECUTION,
    transition,
    '本段明确指定的运镜和切镜优先，上面的衔接建议不得覆盖已确认的镜头安排。',
  ].join('\n');
}

/** 逐段执行契约：连续剧情只带当前段内容，上一段只提供状态。 */
export function buildSegmentExecutionPrompt({ prompt, kind, index, count }) {
  const boundary = kind === 'generate'
    ? '这是首段：只演本段事件，结尾停在本段指定状态，不抢演后段剧情，不做整片结束式收尾。'
    : '这是续拍段：视频1提供上一段结束状态，从其后的新事件继续。不要重演进场、递接物品或已说台词。';
  return [
    `【生成段 ${index + 1}/${count}】生成段编号不是切镜指令；镜头是否切换以脚本为准。`,
    '【执行内容】' + String(prompt).trim(),
    boundary,
    index < count - 1
      ? '在完整句结束、动作完成或自然反应处交接，保留人物位置、视线、持物手和镜头运动状态，不用定格等待填满时长。'
      : '完成本段的故事变化，再用自然反应或画面收束；不重述前情。',
  ].join('\n');
}

export function buildGenerationPrompt({ prompt, seconds, model = '' }) {
  const timing = isOmniExtendModel(model)
    ? '按本段事件顺序推进；如有时间区间，以本段0秒为起点，区间连续，不遗漏停顿与反应时间。'
    : '按本段事件顺序自然推进，以镜头序号或先后阶段组织内容，不依赖精确时间戳，不为追逐秒点压缩动作或对白。';
  return [
    `生成 ${seconds} 秒视频。`,
    String(prompt).trim(),
    timing,
    SPEECH_EXECUTION,
    '人物身份、服装、场景与光线保持连贯；每句台词完整说完。未明确要求时不新增字幕、水印、片头片尾或配乐。',
  ].join('\n');
}

/** 把用户给的剧情描述接成完整句子时补个句号，避免两句粘在一起。 */
export function endWithPunctuation(text) {
  const value = String(text ?? '').trim();
  if (!value) return '';
  return /[。．.!！?？;；~～:：,，]$/.test(value) ? value : `${value}。`;
}
