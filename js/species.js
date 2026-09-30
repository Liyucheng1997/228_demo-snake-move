'use strict';
// ============================================================
//  species.js — 8 种常见蛇类的形态、鳞片、花纹与生活史数据
//  花纹函数坐标约定：
//    body(x, y, s, v, r, R, L)
//      s ∈ [-1,1] 绕身体一周（0 = 背中线，±1 = 腹中线）
//      v ∈ [0,1]  头 → 尾
//      x = 背中线起算的周向物理距离，y = 沿体长物理距离，r = 该处半径
//    belly(v, k, bs)   第 k 枚腹鳞，bs ∈ [-1,1] 横跨腹面（0 = 腹中线）
//    head(hx, hz, eye) 头背面：hx ∈ [-1,1]（0 = 头顶，±1 = 上唇），hz 0 = 后枕 → 1 = 吻端
//    chin(hx, hz)      下颌腹面：hx 0 = 颏中线，±1 = 下唇
// ============================================================

function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const t = clamp(((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy), 0, 1);
  return Math.hypot(px - ax - dx * t, py - ay - dy * t);
}
const lineAt = (x, ax, ay, bx, by) => lerp(ay, by, clamp((x - ax) / (bx - ax), 0, 1));

const SPECIES = [
  // ------------------------------------------------------------------ 缅甸蟒
  {
    id: 'python', name: '缅甸蟒', en: 'Burmese Python', latin: 'Python bivittatus',
    family: '蟒科 Pythonidae', venom: 0, venomText: '无毒 · 绞杀',
    habitat: 'forest', length: 26, radius: 0.78, N: 260, vent: 0.88, babyScale: 0.16,
    profile: curve([[0, .55], [.04, .6], [.14, .86], [.3, 1], [.66, 1], [.82, .8], [.88, .62], [.95, .3], [1, .05]]),
    section: { up: 2.25, lo: 3.8, ridge: 0.08, belly: 0.8 },
    head: { type: 'python', len: 1.65, w: 0.5, top: 0.33, bot: 0.27, eyeZ: 0.62, eyePhi: 0.62, eyeR: 0.075, brow: 0.2, nostrilPhi: 0.9, scales: 'mixed', labialPits: true },
    scales: { rows: 55, ventrals: 260, aspect: 1.0, shape: 'round', keel: 0, rough: 0.4, clearcoat: 0.55, irid: 0.3, sV: 0.74, gap: [48, 36, 22], gapMix: 0.5, bump: 1.7 },
    eye: { iris: 0xa47a42, iris2: 0x5c3e1e, pupil: 'slit' },
    tongue: 0x3a2230, mouth: 0xe7a3a0, fangs: 'aglyph', spurs: true, thermalPits: true,
    gaits: ['rectilinear', 'serpentine', 'concertina'], gait: 'rectilinear',
    feeding: 'constrict', prey: 'rat', defense: 'hiss', repro: 'brood', clutch: 10, hibernate: 'den',
    swatch: ['#cdb07a', '#7c5230', '#2b1d12'],
    body(x, y, s, v, r, R) {
      const as = Math.abs(s);
      const n1 = fbm(x / R * 1.2, y / R * 1.2, 3, 11);
      let base = mixC(C(0xcfb07a), C(0xa9875a), smoothstep(0.35, 0.75, n1));
      base = mixC(base, C(0xe6d6ae), smoothstep(0.5, 0.74, as));
      const wx = x + (fbm(x / R * 1.5, y / R * 1.5, 3, 5) - 0.5) * 1.2 * R;
      const wy = y + (fbm(x / R * 1.5 + 7, y / R * 1.5, 3, 9) - 0.5) * 1.2 * R;
      const P = 2.6 * R;
      let dmin = 9;
      const k0 = Math.round(wy / P);
      for (let k = k0 - 1; k <= k0 + 1; k++) {
        const cy = k * P + (hash2(k, 1, 3) - 0.5) * 0.7 * R, cx = (hash2(k, 2, 3) - 0.5) * 0.6 * R;
        const a = R * (1.0 + 0.35 * hash2(k, 3, 3)), b = R * (0.8 + 0.3 * hash2(k, 4, 3));
        dmin = Math.min(dmin, Math.hypot((wx - cx) / a, (wy - cy) / b));
      }
      if (dmin < 0.8) return mixC(C(0x7c5230), C(0x5a381f), clamp(smoothstep(0.2, 0.8, dmin) * 0.6 + (n1 - 0.5) * 0.5, 0, 1));
      if (dmin < 1.0) return C(0x2b1d12);
      const lx = Math.abs(wx) - 0.56 * Math.PI * r;
      const kl = Math.round((wy - P / 2) / P);
      let lmin = 9;
      for (let k = kl - 1; k <= kl + 1; k++) {
        const cy = k * P + P / 2 + (hash2(k, 7, 3) - 0.5) * 0.6 * R;
        lmin = Math.min(lmin, Math.hypot(lx / (0.55 * R), (wy - cy) / (0.5 * R)));
      }
      if (lmin < 0.35) return C(0xd9c797);
      if (lmin < 0.82) return C(0x6a4527);
      if (lmin < 0.98) return C(0x2e2014);
      return base;
    },
    belly(v, k, bs) {
      let c = C(0xefe6c6);
      if (Math.abs(bs) > 0.7 && hash2(k, bs > 0 ? 1 : 2, 21) < 0.35) c = mixC(c, C(0x8a6a44), 0.6);
      return c;
    },
    headCol(hx, hz, eye) {
      const ax = Math.abs(hx);
      let c = mixC(C(0xcaa978), C(0xb08e5e), fbm(hx * 5, hz * 5, 2, 4));
      const wS = 0.06 + 0.42 * smoothstep(0.95, 0.2, hz);
      if (hz > 0.04 && hz < 0.94) {
        if (ax < wS - 0.07) c = C(0x77512f);
        else if (ax < wS) c = C(0x3a2616);
      }
      const d = Math.min(segDist(ax, hz, 0.6, 0.92, eye.hx, eye.hz), segDist(ax, hz, eye.hx, eye.hz, 0.92, 0.06));
      if (d < 0.07) c = C(0x5a3a20);
      if (ax > 0.9) c = C(0xe8dab2);
      return c;
    },
    chin(hx) { return mixC(C(0xf0e6c8), C(0xe0cfa2), smoothstep(0.7, 1, Math.abs(hx))); },
    facts: [['分布', '东南亚至中国南部（云南、广西、海南等）'], ['体长', '3.5–5.5 m，世界最大蛇类之一'], ['食性', '鼠类、鸟类、中小型哺乳动物'], ['毒性', '无毒，靠缠绕令猎物窒息与循环衰竭'], ['繁殖', '卵生，雌蟒盘卵并“颤抖产热”孵化'], ['保护', '国家一级保护野生动物']],
    intro: '缅甸蟒是体型最大的蛇类之一。体表鳞片细小光滑，在阳光下泛出彩虹般的结构色。上下唇鳞上的一排“唇窝”能感知红外线，夜间也能“看见”温血猎物。它行动缓慢，最常用直线蠕动潜行，靠伏击和强大的缠绕力捕食。',
    notes: {
      feed: '蟒是典型的绞杀者：咬住猎物后瞬间用身体缠绕数圈，每当猎物呼气就再收紧一点。现代研究表明，致死主要原因是循环系统被压迫、血液无法回流心脏，而非单纯窒息。',
      digest: '蟒一次可吞下相当于自身体重一半的猎物。进食后 2 天内心脏质量增加约 40%，小肠质量翻倍，代谢率飙升到静息时的 40 倍——这是脊椎动物中最剧烈的生理变化之一。',
      defense: '受威胁时蟒会深吸气使身体膨胀，发出响亮的嘶嘶声，把颈部收成 S 形准备还击。它的牙齿向后弯曲，咬伤虽无毒但会造成撕裂伤。',
      repro: '雌蟒产下约 12–40 枚卵后盘绕在卵堆上，通过肌肉有节律的“颤抖”产生热量，把卵的温度维持在 31 °C 左右，直到约 60 天后孵化。这在蛇类中极为罕见。'
    }
  },

  // ------------------------------------------------------------------ 眼镜蛇
  {
    id: 'cobra', name: '眼镜蛇', en: 'Indian Cobra', latin: 'Naja naja',
    family: '眼镜蛇科 Elapidae', venom: 3, venomText: '剧毒 · 神经毒素',
    habitat: 'forest', length: 20, radius: 0.34, N: 240, vent: 0.82, babyScale: 0.2,
    profile: curve([[0, .78], [.05, .82], [.2, .95], [.5, 1], [.7, .9], [.82, .66], [.92, .3], [1, .04]]),
    section: { up: 2.1, lo: 3.2, ridge: 0.0, belly: 0.82 },
    head: { type: 'elapid', len: 0.82, w: 0.28, top: 0.2, bot: 0.16, eyeZ: 0.65, eyePhi: 0.6, eyeR: 0.07, brow: 0.1, nostrilPhi: 0.95, scales: 'plates' },
    scales: { rows: 21, ventrals: 190, aspect: 1.25, shape: 'smooth', keel: 0, rough: 0.34, clearcoat: 0.75, irid: 0.15, sV: 0.7, gap: [40, 30, 20], gapMix: 0.5, bump: 1.4 },
    eye: { iris: 0x3a2a1a, iris2: 0x1a120a, pupil: 'round' },
    tongue: 0x161616, mouth: 0xdb8d8d, fangs: 'proteroglyph', hood: true,
    gaits: ['serpentine', 'concertina'], gait: 'serpentine',
    feeding: 'bitehold', prey: 'rat', defense: 'hood', repro: 'guard', clutch: 8, hibernate: 'den',
    swatch: ['#8e6d40', '#f2ead4', '#16110c'],
    body(x, y, s, v, r, R) {
      const as = Math.abs(s);
      const n = fbm(x / R * 2, y / R * 2, 3, 4);
      let c = mixC(C(0x8e6d40), C(0x6e5230), smoothstep(0.3, 0.8, n));
      c = mixC(c, C(0xb8975e), smoothstep(0.5, 0.72, as));
      const P = 3.4 * R;
      if (v > 0.22 && Math.abs(((y / P) % 1) - 0.5) < 0.08) c = mixC(c, C(0x3e2c1a), 0.4 * smoothstep(0.22, 0.6, v));
      const hA = 0.035, hB = 0.15;
      if (v > hA && v < hB) {
        const vh = (v - hA) / (hB - hA);
        const d = Math.hypot((as - 0.17) / 0.075, (vh - 0.42) / 0.15);
        if (d < 0.5) return C(0x16110c);
        if (d < 1.0) return C(0xf2ead4);
        if (vh > 0.42) {
          const e = Math.hypot(s / 0.17, (vh - 0.42) / 0.3);
          if (Math.abs(e - 1) < 0.1) return C(0x16110c);
          if (Math.abs(e - 1) < 0.24) return C(0xf2ead4);
        }
        if (d < 1.3) return C(0x2a1e14);
      }
      return c;
    },
    belly(v) {
      if (v > 0.075 && v < 0.1) return C(0x33241a);
      if (v > 0.118 && v < 0.132) return C(0x5a4028);
      return C(0xe2d2a0);
    },
    headCol(hx, hz) {
      const ax = Math.abs(hx);
      let c = mixC(C(0x6e5030), C(0x5a4026), fbm(hx * 4, hz * 4, 2, 2));
      if (ax > 0.86) c = C(0xd8c490);
      return c;
    },
    chin() { return C(0xe2d2a0); },
    facts: [['分布', '南亚（印度、巴基斯坦、斯里兰卡等）'], ['体长', '1.0–1.8 m'], ['食性', '鼠类、蛙、蟾蜍、鸟及其他蛇'], ['毒性', '剧毒，以神经毒素为主，可致呼吸麻痹'], ['繁殖', '卵生，雌蛇守护卵窝'], ['特征', '颈部可扩张成“兜帽”，背面有眼镜状斑纹']],
    intro: '眼镜蛇的颈部肋骨特别长，受惊时肋骨向两侧撑开、皮肤绷紧，形成标志性的“兜帽”。印度眼镜蛇兜帽背面有一对由弧线相连的眼斑，形似一副眼镜，“眼镜蛇”因此得名。它属于前沟牙类毒蛇：上颌前端有一对固定的短毒牙。',
    notes: {
      feed: '前沟牙类毒蛇毒牙短而固定，无法像蝰蛇那样“咬一口就放”，因此常咬住猎物不放、反复咀嚼注毒，待神经毒素使猎物麻痹后再吞食。',
      defense: '眼镜蛇的威吓展示：前 1/3 身体垂直竖起，颈肋外展撑开兜帽，发出低沉嘶声，并随对方移动左右摇摆。必要时会“虚张声势”地向前扑击，用吻端撞击而不张口。',
      repro: '雌蛇在落叶堆或鼠洞中产下 10–30 枚卵，并留在附近守护，直至约 2 个月后孵化。幼蛇出壳即有毒，并能竖起兜帽。'
    }
  },

  // ------------------------------------------------------------------ 西部菱斑响尾蛇
  {
    id: 'rattlesnake', name: '菱斑响尾蛇', en: 'Western Diamondback', latin: 'Crotalus atrox',
    family: '蝰科·蝮亚科 Crotalinae', venom: 3, venomText: '剧毒 · 血循毒素',
    habitat: 'desert', length: 16, radius: 0.46, N: 230, vent: 0.9, babyScale: 0.24,
    profile: curve([[0, .5], [.04, .54], [.15, .85], [.45, 1], [.7, .92], [.88, .6], [.93, .46], [.985, .38], [1, .34]]),
    section: { up: 2.3, lo: 3.6, ridge: 0.05, belly: 0.78 },
    head: { type: 'viper', len: 1.15, w: 0.5, top: 0.32, bot: 0.26, eyeZ: 0.62, eyePhi: 0.62, eyeR: 0.064, brow: 1.0, nostrilPhi: 0.72, scales: 'granular', lorealPit: true, nU: 2.8 },
    scales: { rows: 27, ventrals: 180, aspect: 1.35, shape: 'keeled', keel: 0.9, rough: 0.6, clearcoat: 0.25, irid: 0, sV: 0.68, gap: [60, 50, 40], gapMix: 0.45, bump: 2.2 },
    eye: { iris: 0xb8a078, iris2: 0x6a5838, pupil: 'slit' },
    tongue: 0x1e1e1e, mouth: 0xe4a4a4, fangs: 'solenoglyph', rattle: true, thermalPits: true,
    gaits: ['serpentine', 'rectilinear', 'sidewind'], gait: 'serpentine',
    feeding: 'strike', prey: 'mouse', defense: 'rattle', repro: 'live', clutch: 5, hibernate: 'communal',
    swatch: ['#a69679', '#5a4834', '#ece2c6'],
    body(x, y, s, v, r, R, L) {
      const as = Math.abs(s);
      const n = fbm(x / R * 3, y / R * 3, 3, 8);
      let base = mixC(C(0xa69679), C(0x857660), n);
      base = mixC(base, C(0xc9bc9c), smoothstep(0.5, 0.68, as));
      if (v > 0.865) return Math.floor((y - 0.865 * L) / (0.75 * R)) % 2 === 0 ? C(0x1c1a18) : C(0xe6e0d0);
      const P = 2.35 * R;
      const yl = ((y % P) + P) % P - P / 2;
      const a = 1.25 * R * (1 - 0.3 * smoothstep(0.55, 0.85, v)), b = P * 0.52;
      const q = Math.abs(x) / a + Math.abs(yl) / b;
      const fade = smoothstep(0.7, 0.86, v);
      if (q < 0.74) return mixC(mixC(C(0x57452f), C(0x6f5c44), smoothstep(0.1, 0.5, q) * 0.8), base, fade * 0.5);
      if (q < 1.0) return mixC(C(0xece2c6), base, fade * 0.6);
      const yl2 = (((y + P / 2) % P) + P) % P - P / 2;
      const q2 = Math.abs(Math.abs(x) - 0.62 * Math.PI * r) / (0.5 * R) + Math.abs(yl2) / (0.35 * P);
      if (q2 < 1) return mixC(base, C(0x5f5140), 0.55);
      return base;
    },
    belly(v, k, bs) {
      let c = C(0xe3dcc6);
      if (Math.abs(bs) > 0.6 && hash2(k, bs > 0 ? 3 : 4, 9) < 0.3) c = mixC(c, C(0x8a8070), 0.5);
      return c;
    },
    headCol(hx, hz, eye) {
      const ax = Math.abs(hx);
      let c = mixC(C(0x9a8b70), C(0x7f7058), fbm(hx * 7, hz * 7, 2, 3));
      const x1 = eye.hx - 0.06, x2 = eye.hx - 0.16;
      const h1 = lineAt(ax, x1, eye.hz + 0.1, 1, eye.hz + 0.17);
      const h2 = lineAt(ax, x2, eye.hz - 0.04, 1, 0.1);
      if (ax > x2 && hz < h1 && hz > h2) c = C(0x5a4a38);
      if (segDist(ax, hz, x1, eye.hz + 0.1, 1, eye.hz + 0.17) < 0.035) c = C(0xefe6cc);
      if (segDist(ax, hz, x2, eye.hz - 0.04, 1, 0.1) < 0.035) c = C(0xefe6cc);
      if (ax > 0.8) c = mixC(c, C(0xdcd0b4), 0.7);
      return c;
    },
    chin(hx) { return mixC(C(0xe8e0c8), C(0xcfc2a2), smoothstep(0.75, 1, Math.abs(hx))); },
    facts: [['分布', '美国西南部至墨西哥北部的荒漠与半荒漠'], ['体长', '1.2–1.8 m'], ['食性', '啮齿类、兔、鸟'], ['毒性', '剧毒，以血循毒素（出血、组织坏死）为主'], ['繁殖', '胎生（卵胎生），一次产 10–20 条仔蛇'], ['冬眠', '常与数十至上百条同类群聚冬眠']],
    intro: '响尾蛇是蝮亚科（颊窝毒蛇）的代表。宽大的三角形头部内藏大型毒腺；眼与鼻孔之间的“颊窝”是灵敏的红外感受器，可分辨 0.003 °C 的温差。尾端的响环由未脱落的角质蜕皮环套叠而成，每次蜕皮增加一节，高速振动时发出“嘶嘶”警告声。',
    notes: {
      feed: '蝮蛇采取“咬了就放”的策略：闪电般出击（全程不到 0.1 秒），管牙刺入注毒后立即松口，以免被垂死的猎物反击。随后它循着猎物留下的气味追踪——研究者称之为“咬击诱发的化学感觉搜索”（SICS）——找到已死的猎物，从头部开始吞食。',
      defense: '响尾蛇盘成防御圈，颈部拉成 S 形高举，尾部竖起以每秒约 50–90 次的频率振动响环。这是“警戒信号”：它更愿意警告而非攻击，毒液对它来说十分昂贵。',
      hibernate: '菱斑响尾蛇在秋季回到固定的越冬洞穴（常年使用、代代相传），与数十条同类甚至其他蛇种挤在一起，靠群聚减少热量和水分散失。',
      repro: '响尾蛇是胎生（卵胎生）：胚胎在母体内发育，出生时包裹在薄膜中，仔蛇很快破膜而出。母蛇会与仔蛇一起停留约 10 天，直到仔蛇完成第一次蜕皮——这在蛇类中是少见的“亲代陪伴”。'
    }
  },

  // ------------------------------------------------------------------ 角响尾蛇
  {
    id: 'sidewinder', name: '角响尾蛇', en: 'Sidewinder', latin: 'Crotalus cerastes',
    family: '蝰科·蝮亚科 Crotalinae', venom: 2, venomText: '有毒 · 血循毒素',
    habitat: 'desert', length: 10, radius: 0.26, N: 200, vent: 0.9, babyScale: 0.3,
    profile: curve([[0, .5], [.04, .55], [.15, .86], [.45, 1], [.7, .9], [.88, .58], [.93, .45], [.985, .38], [1, .34]]),
    section: { up: 2.3, lo: 3.4, ridge: 0.04, belly: 0.8 },
    head: { type: 'viper', len: 0.72, w: 0.34, top: 0.21, bot: 0.17, eyeZ: 0.62, eyePhi: 0.66, eyeR: 0.05, brow: 1.1, nostrilPhi: 0.75, scales: 'granular', lorealPit: true, horns: true, nU: 2.7 },
    scales: { rows: 23, ventrals: 145, aspect: 1.3, shape: 'keeled', keel: 0.9, rough: 0.62, clearcoat: 0.2, irid: 0, sV: 0.68, gap: [90, 75, 55], gapMix: 0.4, bump: 2.2 },
    eye: { iris: 0xd6bf94, iris2: 0x8c7650, pupil: 'slit' },
    tongue: 0x3a2a2a, mouth: 0xe8b0aa, fangs: 'solenoglyph', rattle: true, thermalPits: true,
    gaits: ['sidewind', 'serpentine'], gait: 'sidewind',
    feeding: 'strike', prey: 'mouse', defense: 'rattle', repro: 'live', clutch: 5, hibernate: 'den', special: 'burrow',
    swatch: ['#dcc8a2', '#b8946a', '#2a2018'],
    body(x, y, s, v, r, R, L) {
      const as = Math.abs(s);
      let c = mixC(C(0xdcc8a2), C(0xc8b18a), fbm(x / R * 2.5, y / R * 2.5, 3, 2));
      c = mixC(c, C(0xeadcc0), smoothstep(0.5, 0.68, as));
      if (fbm(x / R * 9, y / R * 9, 2, 5) > 0.72) c = mixC(c, C(0x8a7050), 0.6);
      if (v > 0.87) {
        if (v > 0.955) return C(0x2a2018);
        return Math.floor((y - 0.87 * L) / (0.7 * R)) % 2 === 0 ? C(0x6b5238) : c;
      }
      const P = 2.1 * R;
      const k = Math.round(y / P), yl = y - k * P;
      const d = Math.hypot(x / (0.7 * R), yl / (0.5 * R));
      if (d < 0.8) return mixC(C(0xb8946a), C(0xa88256), fbm(x, y, 1, 3));
      if (d < 1.0) return C(0x9a7650);
      const yl2 = y - (Math.round((y - P / 2) / P) * P + P / 2);
      const d2 = Math.hypot((Math.abs(x) - 0.5 * Math.PI * r) / (0.32 * R), yl2 / (0.3 * R));
      if (d2 < 1) return C(0xc7a57a);
      return c;
    },
    belly() { return C(0xf0e8d6); },
    headCol(hx, hz, eye) {
      const ax = Math.abs(hx);
      let c = mixC(C(0xd8c49c), C(0xc2ab82), fbm(hx * 6, hz * 6, 2, 8));
      if (segDist(ax, hz, eye.hx, eye.hz, 0.96, 0.12) < 0.07) c = C(0x9a7a56);
      return c;
    },
    chin() { return C(0xf2eadc); },
    facts: [['分布', '美国西南部、墨西哥西北部沙漠'], ['体长', '45–80 cm'], ['食性', '更格卢鼠、蜥蜴'], ['毒性', '有毒，毒性较弱于大型响尾蛇'], ['繁殖', '胎生，一次 5–18 条'], ['特征', '眼上方一对角状鳞；侧进运动']],
    intro: '角响尾蛇是“侧进运动”的代名词：身体只有两三处短暂接触滚烫的流沙，其余部分腾空并向侧前方抛出，在沙面留下一串互相平行、呈 J 形的痕迹。眼上方的角状眶上鳞可在它埋入沙中时像“遮阳板”一样保护眼睛。',
    notes: {
      feed: '角响尾蛇常把身体埋在沙中，只露出眼睛和头顶，伏击路过的更格卢鼠和蜥蜴。有研究记录到幼体会摆动深色尾尖引诱蜥蜴。',
      special: '埋沙伏击：蛇盘成一团，左右扭动身体把沙子推到背上，几秒钟内就在沙面形成一个浅坑，只露出头顶和一对“角”。这既能躲避烈日，也能隐蔽伏击。',
      defense: '受威胁时迅速盘起并摇响尾环；它也会用侧进快速“斜着”逃离。'
    }
  },

  // ------------------------------------------------------------------ 玉米蛇
  {
    id: 'corn', name: '玉米蛇', en: 'Corn Snake', latin: 'Pantherophis guttatus',
    family: '游蛇科 Colubridae', venom: 0, venomText: '无毒 · 绞杀',
    habitat: 'forest', length: 16, radius: 0.25, N: 230, vent: 0.83, babyScale: 0.24,
    profile: curve([[0, .85], [.06, .9], [.3, 1], [.6, .98], [.83, .72], [.93, .35], [1, .04]]),
    section: { up: 2.2, lo: 4.2, ridge: 0.0, belly: 0.82 },
    head: { type: 'colubrid', len: 0.66, w: 0.2, top: 0.15, bot: 0.12, eyeZ: 0.65, eyePhi: 0.62, eyeR: 0.066, brow: 0.1, nostrilPhi: 0.95, scales: 'plates' },
    scales: { rows: 27, ventrals: 220, aspect: 1.25, shape: 'smooth', keel: 0.2, rough: 0.32, clearcoat: 0.8, irid: 0.1, sV: 0.66, gap: [60, 30, 20], gapMix: 0.45, bump: 1.4 },
    eye: { iris: 0xc86a3a, iris2: 0x7a3218, pupil: 'round' },
    tongue: 0xc8323a, mouth: 0xf0b0b0, fangs: 'aglyph',
    gaits: ['serpentine', 'concertina', 'rectilinear'], gait: 'serpentine',
    feeding: 'constrict', prey: 'mouse', defense: 'tailvib', repro: 'eggs', clutch: 8, hibernate: 'den',
    swatch: ['#e0753c', '#c43a2a', '#1c0f0c'],
    body(x, y, s, v, r, R) {
      const as = Math.abs(s);
      let base = mixC(C(0xe0753c), C(0xc9652f), fbm(x / R * 2, y / R * 2, 2, 6));
      base = mixC(base, C(0xe8a070), smoothstep(0.5, 0.66, as) * 0.6);
      const P = 2.3 * R;
      const wy = y + (fbm(x / R, y / R, 2, 3) - 0.5) * 0.5 * R;
      const k = Math.round(wy / P), yl = wy - k * P;
      const a = 1.3 * R * (1 - 0.25 * smoothstep(0.6, 0.9, v)), b = 0.72 * R;
      const d = Math.pow(Math.pow(Math.abs(x) / a, 3) + Math.pow(Math.abs(yl) / b, 3), 1 / 3);
      if (d < 0.82) return mixC(C(0xc43a2a), C(0xa62a22), fbm(x / R * 3, y / R * 3, 2, 9));
      if (d < 1.0) return C(0x1c0f0c);
      const wy2 = wy - P / 2, yl2 = wy2 - Math.round(wy2 / P) * P;
      const d2 = Math.hypot((Math.abs(x) - 0.5 * Math.PI * r) / (0.42 * R), yl2 / (0.45 * R));
      if (d2 < 0.75) return C(0xc2412c);
      if (d2 < 0.95) return C(0x2a140e);
      return base;
    },
    belly(v, k, bs) {
      const col = Math.floor((bs + 1) * 2.5);
      if (v < 0.83) return ((k + col) % 2 === 0 && hash2(k, col, 44) < 0.8) ? C(0x1a1616) : C(0xf2efe6);
      return Math.abs(bs) < 0.35 ? C(0x2a2020) : C(0xe9d7c0);
    },
    headCol(hx, hz, eye) {
      const ax = Math.abs(hx);
      let c = C(0xe07a40);
      const dv = segDist(ax, hz, 0, 0.84, 0.48, 0.36);
      if (dv < 0.06) c = C(0xc0392b); else if (dv < 0.09) c = C(0x1c0f0c);
      const de = segDist(ax, hz, eye.hx, eye.hz, 0.95, 0.12);
      if (de < 0.06) c = C(0xc0392b); else if (de < 0.085) c = C(0x1c0f0c);
      if (ax < 0.42 && Math.abs(hz - 0.74) < 0.03) c = C(0xc0392b);
      if (ax > 0.9) c = C(0xf0c090);
      return c;
    },
    chin() { return C(0xf4f0e8); },
    facts: [['分布', '美国东南部的松林、农田与废弃建筑'], ['体长', '1.0–1.5 m'], ['食性', '鼠类、小鸟、蜥蜴'], ['毒性', '无毒，性情温顺，常见宠物蛇'], ['繁殖', '卵生，一窝 10–30 枚，不护卵'], ['特征', '腹部黑白格纹如玉米粒']],
    intro: '玉米蛇因腹部黑白相间、形似玉米粒的格纹而得名。它是游蛇科的代表：头部覆盖对称排列的大型鳞片（头盾），瞳孔圆形，全身鳞片光滑。它是攀爬能手，也常出没于谷仓捕鼠。',
    notes: {
      feed: '玉米蛇也是绞杀者。它会主动搜寻鼠洞，咬住猎物后迅速用身体绕成数个线圈，收紧直到猎物心跳停止。',
      defense: '玉米蛇会快速振动尾尖拍打落叶，发出类似响尾蛇的沙沙声（行为拟态），同时把颈部收成 S 形，做出攻击姿态。',
      repro: '雌蛇在腐木或落叶堆等温湿处产卵后即离开，不护卵。约 60 天后幼蛇用吻端的“卵齿”划开卵壳，常把头探出壳外停留一天左右再爬出。'
    }
  },

  // ------------------------------------------------------------------ 竹叶青
  {
    id: 'bamboo', name: '竹叶青', en: 'Chinese Green Tree Viper', latin: 'Trimeresurus stejnegeri',
    family: '蝰科·蝮亚科 Crotalinae', venom: 2, venomText: '有毒 · 血循毒素',
    habitat: 'bamboo', length: 12, radius: 0.2, N: 220, vent: 0.82, babyScale: 0.28,
    profile: curve([[0, .45], [.05, .55], [.2, .86], [.5, 1], [.72, .85], [.82, .6], [.93, .28], [1, .04]]),
    section: { up: 2.1, lo: 3.0, ridge: 0.06, belly: 0.88 },
    head: { type: 'viper', len: 0.78, w: 0.32, top: 0.2, bot: 0.16, eyeZ: 0.63, eyePhi: 0.6, eyeR: 0.07, brow: 0.6, nostrilPhi: 0.75, scales: 'granular', lorealPit: true, nU: 2.6 },
    scales: { rows: 21, ventrals: 165, aspect: 1.4, shape: 'keeled', keel: 0.35, rough: 0.4, clearcoat: 0.6, irid: 0.05, sV: 0.7, gap: [30, 70, 25], gapMix: 0.4, bump: 1.6 },
    eye: { iris: 0xe04a1c, iris2: 0x9a2a10, pupil: 'slit' },
    tongue: 0xc43a2a, mouth: 0xeaa8a0, fangs: 'solenoglyph', thermalPits: true,
    gaits: ['serpentine', 'concertina'], gait: 'serpentine',
    feeding: 'strikehold', prey: 'frog', defense: 'gape', repro: 'live', clutch: 5, hibernate: 'den', special: 'perch',
    swatch: ['#4caa3a', '#f1f4e0', '#c9432d'],
    body(x, y, s, v, r, R) {
      const as = Math.abs(s), sV = 0.7;
      let c = mixC(C(0x3c9632), C(0x62c046), smoothstep(0.05, 0.6, as));
      c = mulC(c, 0.92 + 0.16 * fbm(x / R * 4, y / R * 4, 2, 7));
      if (as > sV - 0.075 && as < sV - 0.04) c = C(0xf1f4e0);
      else if (as >= sV - 0.04) c = C(0xc9432d);
      if (v > 0.86) c = mixC(c, C(0x9c4a2e), smoothstep(0.86, 0.96, v));
      return c;
    },
    belly(v) { return mixC(C(0xcfe49a), C(0xa45a38), smoothstep(0.87, 0.97, v)); },
    headCol(hx) {
      const ax = Math.abs(hx);
      let c = mixC(C(0x46a338), C(0x58b842), smoothstep(0.2, 0.8, ax));
      if (Math.abs(ax - 0.85) < 0.03) c = C(0xeef4d0);
      if (ax > 0.88) c = C(0xd9ee9e);
      return c;
    },
    chin() { return C(0xd8eca0); },
    facts: [['分布', '中国南方、台湾及东南亚山区竹林'], ['体长', '60–90 cm'], ['食性', '蛙类、蜥蜴、鸟、鼠'], ['毒性', '有毒，血循毒素，咬伤剧痛肿胀'], ['繁殖', '卵胎生，一次 3–15 条'], ['特征', '通体翠绿，体侧有白（雄性另有红）色纵纹，尾尖焦红']],
    intro: '竹叶青是中国南方最常见的树栖毒蛇。翠绿的体色与竹叶融为一体，雄性体侧有一条红白双色纵纹。它的尾巴具有缠绕性，能牢牢钩住枝条；昼伏夜出，常“挂”在低矮枝头伏击蛙类。',
    notes: {
      feed: '竹叶青主要捕食蛙类。蛙是冷血动物，颊窝难以感知，因此它更多依靠视觉与化学感觉。对小型猎物，蝮蛇常“咬住不放”直到毒液起效，以免猎物逃到树下。它还会轻摆焦红色的尾尖作为“诱饵”（尾部诱捕）。',
      defense: '受惊时竹叶青将颈部收成 S 形，张开大口露出白色口腔与毒牙示威，并随时发起攻击。',
      special: '树栖：竹叶青用具缠绕性的尾巴勾住枝条，身体呈环状搭在枝上，前半身收成 S 形悬在空中，一动不动地伏击。攀爬时它交替用身体的一部分抓紧、另一部分前伸（类手风琴式）。'
    }
  },

  // ------------------------------------------------------------------ 银环蛇
  {
    id: 'krait', name: '银环蛇', en: 'Many-banded Krait', latin: 'Bungarus multicinctus',
    family: '眼镜蛇科 Elapidae', venom: 3, venomText: '剧毒 · 神经毒素',
    habitat: 'forest', night: true, length: 17, radius: 0.21, N: 240, vent: 0.87, babyScale: 0.24,
    profile: curve([[0, .9], [.08, .95], [.4, 1], [.8, .95], [.87, .75], [.95, .35], [1, .05]]),
    section: { up: 2.0, lo: 3.2, ridge: 0.35, belly: 0.85 },
    head: { type: 'elapid', len: 0.52, w: 0.17, top: 0.13, bot: 0.1, eyeZ: 0.68, eyePhi: 0.64, eyeR: 0.031, brow: 0, nostrilPhi: 0.95, scales: 'plates' },
    scales: { rows: 15, ventrals: 215, aspect: 1.1, shape: 'smooth', keel: 0, rough: 0.22, clearcoat: 1.0, irid: 0.3, sV: 0.74, gap: [8, 8, 10], gapMix: 0.5, bump: 1.2, vertebral: true },
    eye: { iris: 0x141414, iris2: 0x0a0a0a, pupil: 'round' },
    tongue: 0xd6cfc8, mouth: 0xe8b0b0, fangs: 'proteroglyph',
    gaits: ['serpentine', 'concertina'], gait: 'serpentine',
    feeding: 'bitehold', prey: 'eel', defense: 'headhide', repro: 'guard', clutch: 6, hibernate: 'den',
    swatch: ['#0f1013', '#f0efe8', '#0f1013'],
    body(x, y, s, v, r, R) {
      const as = Math.abs(s);
      const P = 2.9 * R, bw = 0.5 * R;
      const wy = y + (vnoise(x / R * 1.5, y / R * 0.2, 3) - 0.5) * 0.25 * R;
      const m = ((wy % P) + P) % P;
      if (v > 0.03 && m < bw * (1 + 0.4 * smoothstep(0.3, 0.7, as))) return mixC(C(0xf0efe8), C(0xdedbd0), fbm(x, y, 1, 3));
      return mixC(C(0x0f1013), C(0x1d1e22), fbm(x / R * 3, y / R * 3, 2, 2));
    },
    belly() { return C(0xece8dc); },
    headCol() { return C(0x121316); },
    chin(hx) { return Math.abs(hx) < 0.72 ? C(0xe8e4d8) : C(0x16171a); },
    facts: [['分布', '中国长江以南、台湾及东南亚'], ['体长', '1.0–1.5 m'], ['食性', '主要捕食其他蛇、鳝鱼、泥鳅、蛙'], ['毒性', '剧毒，α-银环蛇毒素阻断神经肌肉接头'], ['繁殖', '卵生，雌蛇有护卵行为'], ['习性', '典型夜行性，白天多藏于洞穴']],
    intro: '银环蛇黑白相间的环纹极具辨识度。它的背脊隆起、横截面呈三角形，背中线一行鳞片特别扩大呈六角形。它是中国毒性最强的陆生蛇之一，但性情胆怯，白天几乎不主动攻击。咬伤时疼痛轻微，常被忽视而延误救治。',
    notes: {
      feed: '银环蛇是“食蛇者”，也大量捕食鳝鱼和泥鳅。它在夜间沿水沟、田埂搜索，咬住猎物后不松口，依靠强效神经毒素使猎物迅速瘫痪。',
      defense: '银环蛇受惊时很少攻击：它会把头藏在盘起的身体下方，身体压扁，并不规则地抽动，有时还把尾巴翘起摆动，好像另一个“头”，把捕食者的注意力引向不致命的部位。'
    }
  },

  // ------------------------------------------------------------------ 青环海蛇
  {
    id: 'seasnake', name: '青环海蛇', en: 'Blue-banded Sea Snake', latin: 'Hydrophis cyanocinctus',
    family: '眼镜蛇科·海蛇亚科 Hydrophiinae', venom: 3, venomText: '剧毒 · 神经/肌肉毒素',
    habitat: 'ocean', length: 15, radius: 0.24, N: 220, vent: 0.88, babyScale: 0.28, paddle: true,
    profile: curve([[0, .62], [.1, .62], [.35, .8], [.65, 1], [.85, .95], [.9, .88], [.96, .72], [.99, .4], [1, .06]]),
    section: { up: 2.0, lo: 2.2, ridge: 0.1, belly: 1.0 },
    head: { type: 'elapid', len: 0.45, w: 0.15, top: 0.12, bot: 0.09, eyeZ: 0.64, eyePhi: 0.74, eyeR: 0.028, brow: 0, nostrilPhi: 1.3, scales: 'plates' },
    scales: { rows: 41, ventrals: 280, aspect: 1.0, shape: 'granular', keel: 0.2, rough: 0.5, clearcoat: 0.5, irid: 0.05, sV: 0.92, gap: [60, 60, 50], gapMix: 0.4, bump: 1.2 },
    eye: { iris: 0x6a6a50, iris2: 0x303024, pupil: 'round' },
    tongue: 0x2a2a2a, mouth: 0xe6b0b0, fangs: 'proteroglyph',
    gaits: ['swim'], gait: 'swim',
    feeding: 'bitehold', prey: 'eel', defense: 'flee', repro: 'live', clutch: 5, hibernate: 'none', special: 'breathe',
    swatch: ['#b9b48c', '#1c2636', '#d9d2a4'],
    body(x, y, s, v, r, R) {
      const as = Math.abs(s);
      const base = mixC(C(0xa9a57e), C(0xd2caa0), smoothstep(0.3, 0.8, as));
      const P = 2.3 * R;
      const m = ((y % P) + P) % P;
      if (m < P * (0.5 - 0.3 * as)) return mixC(C(0x1c2636), C(0x2a3446), fbm(x, y, 1, 1) * 0.5);
      return base;
    },
    belly() { return C(0xd9d2a4); },
    headCol(hx) { return mixC(C(0x3a4236), C(0x9c9a74), smoothstep(0.55, 0.95, Math.abs(hx))); },
    chin() { return C(0xd6cf9f); },
    facts: [['分布', '印度洋—西太平洋热带沿海，含中国南海、东海'], ['体长', '1.2–1.9 m'], ['食性', '鳗鱼等细长鱼类'], ['毒性', '剧毒，但性情温和、极少咬人'], ['繁殖', '胎生，终生不上岸'], ['特征', '桨状侧扁的尾巴，鼻孔位于吻背且可闭合']],
    intro: '海蛇是完全适应海洋生活的眼镜蛇科成员。尾巴侧扁如桨，推动身体在水中游动；鼻孔长在吻端背面，并有瓣膜可以关闭；舌下有盐腺排出多余盐分。它们用肺呼吸，但长长的肺几乎贯穿全身，并能通过皮肤吸收部分氧气，可潜水 1–2 小时。',
    notes: {
      feed: '青环海蛇专吃鳗鱼一类细长的鱼。它把头探进珊瑚和岩缝中搜寻，咬住后等待毒液起效，再从头部开始吞下。',
      defense: '海蛇在水中遇到威胁通常选择迅速游开或下潜。',
      hibernate: '热带海蛇不冬眠：海水温度常年稳定。它们在需要休息时会潜到海底、躲在岩缝里静止不动，仅偶尔浮上水面换气。',
      shed: '海蛇蜕皮非常频繁（约每 2–6 周一次），以清除附着在体表的藤壶和藻类。它们甚至会把身体打成结，借结圈摩擦蜕去旧皮。',
      special: '换气：海蛇浮到水面，只把鼻孔露出水面快速吸气，随即关闭鼻瓣重新下潜。它的肺向后延伸成一个大“气囊”，也起到调节浮力的作用。'
    }
  }
];

const SPECIES_BY_ID = Object.fromEntries(SPECIES.map(s => [s.id, s]));

// 头部眼睛在头部贴图坐标中的位置（供花纹函数对齐）
for (const sp of SPECIES) sp._eye = { hx: 0.6, hz: sp.head.eyeZ }; // 精确值在生成头部贴图时按弧长计算
