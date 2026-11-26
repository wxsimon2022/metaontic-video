/** 本地符号草图：仅提示主体类别与画框，不推断人物身份、文物造型或真实场景。 */
export function storyboardSketch(visual: string, camera: string) {
  const text = String(visual || '');
  let kind = 'unknown', label = '主体待细化', shape = '';
  if (/铜奔马|马踏飞燕|骏马|马匹/.test(text)) {
    kind = 'horse'; label = '马形主体';
    shape = '<path d="M110 110 Q150 85 195 104 L212 65 L231 52 L245 66 L230 83 L224 119 L194 130 L211 159 L233 165 M183 126 L160 163 L137 168 M132 123 L109 152 L88 147 M119 104 L95 90 L76 101"/><path d="M215 62 L217 47 L227 55"/>';
  } else if (/佛像|佛面|佛陀|佛首/.test(text)) {
    kind = 'statue'; label = '佛像主体';
    shape = '<ellipse cx="160" cy="83" rx="25" ry="34"/><path d="M139 110 Q113 132 112 161 Q160 181 208 161 Q207 132 181 110 M133 133 L160 153 L188 133 M121 161 L199 161"/>';
  } else if (/鼓手|击鼓|打鼓|鼓面/.test(text)) {
    kind = 'drum'; label = '击鼓动作';
    shape = '<circle cx="144" cy="66" r="17"/><path d="M144 83 L144 133 M144 100 L111 117 L93 94 M144 100 L178 115 L193 92 M144 133 L124 177 M144 133 L161 177 M93 94 L80 70 M193 92 L206 66"/><ellipse cx="233" cy="128" rx="36" ry="12"/><path d="M197 128 L202 169 Q233 181 264 169 L269 128"/>';
  } else if (/面条|面汤|煮面|面碗|碗/.test(text)) {
    kind = 'bowl'; label = '碗与食物';
    shape = '<ellipse cx="160" cy="110" rx="75" ry="21"/><path d="M85 110 Q97 171 160 175 Q223 171 235 110 M137 75 Q123 63 137 49 M160 75 Q146 63 160 49 M183 75 Q169 63 183 49 M116 107 Q137 93 156 109 T202 109"/>';
  } else if (/杯|斟酒|倒酒|倒茶|注入.*茶/.test(text)) {
    kind = 'cup'; label = '杯与倾倒动作';
    shape = '<ellipse cx="160" cy="99" rx="43" ry="12"/><path d="M117 99 L129 157 Q160 175 191 157 L203 99 M126 127 Q160 138 194 127"/>';
    if (/斟|倒|注入|倾/.test(text)) shape += '<path d="M207 45 L170 72 L164 91 M208 44 L231 63 L249 45 L226 25 Z"/>';
  } else if (/文庙|寺庙|城门|宫殿|屋檐|红墙/.test(text)) {
    kind = 'architecture'; label = '建筑主体';
    shape = '<path d="M66 110 L160 61 L254 110 Z M85 110 L85 174 L235 174 L235 110 M139 174 L139 134 Q160 113 181 134 L181 174 M104 120 L104 159 M216 120 L216 159"/>';
  } else if (/天际线|高楼|城市|街道/.test(text)) {
    kind = 'city'; label = '城市空间';
    shape = '<path d="M39 176 L39 121 L85 121 L85 91 L125 91 L125 145 L155 145 L155 67 L197 67 L197 117 L229 117 L229 97 L275 97 L275 176 M31 177 L289 177"/>';
  } else if (/人物|女孩|男孩|男人|女人|接待|行人|游客|青年|老人/.test(text)) {
    kind = 'person'; label = '人物主体';
    shape = '<circle cx="160" cy="73" r="23"/><path d="M160 97 L160 145 M160 110 L126 139 M160 110 L194 139 M160 145 L138 184 M160 145 L182 184"/>';
  } else if (/山|湖|河|海|树林|沙漠|草原/.test(text)) {
    kind = 'landscape'; label = '自然空间';
    if (/山/.test(text)) shape += '<path d="M25 151 L95 66 L159 151 L220 88 L295 151"/>';
    if (/湖|河|海/.test(text)) shape += '<path d="M25 162 Q70 150 115 162 T205 162 T295 162 M25 183 Q70 171 115 183 T205 183 T295 183"/>';
    if (!shape) shape = '<path d="M25 158 Q95 115 160 153 T295 153 M25 181 Q125 153 295 181"/>';
  }
  // 未识别的主体不套用随机风景或人物，保留画框并明确说明。
  if (!shape) shape = '<rect x="115" y="75" width="90" height="85" rx="5" stroke-dasharray="6 6"/>';
  const x = /(?:画面|构图|位于|居)左/.test(text) ? -45 : /(?:画面|构图|位于|居)右/.test(text) ? 45 : 0;
  const close = /特写|近景/.test(camera);
  return { kind, label, markup: `<g fill="none" stroke="#697a83" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" transform="translate(${x} ${close ? -18 : 0})${close ? ' translate(160 110) scale(1.2) translate(-160 -110)' : ''}">${shape}</g>` };
}
