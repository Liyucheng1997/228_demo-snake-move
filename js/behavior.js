'use strict';
// ============================================================
//  behavior.js — 行为脚本（生成器协程）
//  每个行为都是一段“剧本”：设置运动驱动器 / 姿态叠加层 / 形变参数，并 yield 等待
// ============================================================
const S = () => App.snake;
const Wd = () => App.world;

const GAIT_NAMES = { serpentine: '蜿蜒', rectilinear: '直线', concertina: '手风琴', sidewind: '侧进', swim: '游泳', idle: '静止' };

const TXT = {
  gait: {
    serpentine: ['蜿蜒运动 · Lateral Undulation', '最常见的运动方式。肌肉自头向尾依次收缩，S 形波沿身体向后传播；身体各点几乎沿同一条“隧道”前进，波的外侧推挤地面的凸起与阻力点获得推力。注意地上的轨迹：整条蛇都走在头部开辟的路径上。'],
    rectilinear: ['直线运动 · Rectilinear', '大型粗壮的蛇（蟒、蚺、蝰）潜行时使用。脊柱几乎笔直匀速前进，腹部皮肤与腹鳞却成组地“前伸—抓地—后拉”，像履带一样一段一段向后传递（可见腹侧的蠕动波）。动作隐蔽，不易惊动猎物。'],
    concertina: ['手风琴式 · Concertina', '在狭窄通道、光滑表面或攀爬时使用。身体一部分弯折成紧密的 S 形“锚定”在原地，另一部分伸直向前；随后前段折叠锚定，把后段拉上来——像手风琴一样伸缩前进，速度慢但抓地力强。'],
    sidewind: ['侧进运动 · Sidewinding', '沙漠蛇在松软流沙上的绝技。水平波与垂直波相差 1/4 周期叠加：身体只有两三段静止地接触沙面，其余部分抬起并向侧前方“抛出”。蛇整体斜向移动，在沙面留下一串互相平行、带钩的 J 形痕迹。'],
    swim: ['游泳 · Swimming', '海蛇用侧扁的桨状尾巴和全身的侧向波动游泳，波幅从头到尾逐渐增大（鳗形游泳）。它们的肺几乎贯穿全身，兼作浮力调节器。'],
    idle: ['静止 · Rest', '蛇静止时仍在不断吐信，采样空气中的化学信息，监视周围环境。'],
  },
  view: {
    skin: ['鳞片与体表 · Scales', '体表覆盖角质鳞片：背鳞斜行排列、覆瓦状交叠（光滑或起棱）；腹面是一排宽大的腹鳞，边缘可勾住地面提供推力；泄殖孔后为成对的尾下鳞。头部是对称排列的大型头盾或细小颗粒鳞，这是分类的重要依据。眼睛上覆盖透明的“眼罩鳞”，蜕皮时一同更换。'],
    skeleton: ['骨骼结构 · Skeleton', '脊柱由 200–400 多节椎骨组成，每节有前后两对关节突互锁，只能左右为主地弯曲、不易扭转。躯干每节椎骨都连着一对可动的肋骨，末端连接腹鳞肌肉——蛇“用肋骨走路”。眼镜蛇颈部的肋骨特别长，展开即为兜帽。头骨各骨块间以韧带松连，下颌左右两半在颏部不愈合，方骨可大幅摆动，使它能吞下比头大得多的猎物。'],
    organs: ['内脏排列 · Viscera', '为适应细长体型，器官前后拉长、依次排列：心脏靠前且能在体内滑动（让大猎物通过）；右肺极长，后部延伸为无呼吸功能的气囊，左肺退化（蟒类保留）；肝脏细长；胃、肠依次排列；成对的肾与性腺前后错开。泄殖腔前是储能的脂肪体。'],
    thermal: ['红外视觉 · Pit Organs', '蝮亚科（响尾蛇、竹叶青）眼鼻之间的“颊窝”和蟒蚺唇上的“唇窝”，是由一层极薄的膜和丰富神经末梢构成的红外感受器，可感知 0.003 °C 的温差。信号在大脑视顶盖与视觉图像叠加——蛇能“看见”温血动物的热像，在黑暗中精确出击。而蛙、鱼等冷血动物在热像中几乎隐形。'],
  },
  tongue: ['吐信子 · 犁鼻器', '分叉的舌头并不“尝味道”，而是像采样棒：伸出后快速上下摆动，两叉张开以扩大扫过的空间，把空气和地面上的气味分子粘附带回口中，送入上颚的一对犁鼻器（Jacobson 器）。左右两叉分别采样，蛇据此比较两侧浓度差，像“立体声”一样判断气味方向，追踪猎物或配偶的踪迹。'],
  feed: {
    constrict: ['捕食 · 绞杀', '伏击或主动搜寻 → 吐信定位 → 颈部收成 S 形蓄力 → 闪电出击咬住 → 瞬间用身体缠绕数圈并随猎物每次呼气收紧 → 猎物循环衰竭而死 → 松开，找到头部 → 从头部开始吞咽。'],
    strike: ['捕食 · 咬了就放', '盘踞伏击 → 颊窝感知热像 → 出击（不到 0.1 秒）→ 管牙刺入注毒并立刻松口 → 猎物逃窜后毒发倒下 → 蛇循气味轨迹追踪（SICS）→ 从头部吞食。'],
    strikehold: ['捕食 · 咬住不放', '伏击 → 出击咬住 → 不松口等待毒液起效（防止小猎物逃走）→ 调整位置 → 从头部吞咽。'],
    bitehold: ['捕食 · 咬住注毒', '主动搜寻 → 出击咬住 → 前沟牙短而固定，靠反复咀嚼把毒液注入 → 神经毒素使猎物瘫痪 → 从头部吞咽。'],
  },
  swallow: ['吞咽 · 下颌“行走”', '蛇从猎物头部开始吞：左右两半下颌可独立前后移动，交替地向前“走”，把自己套在猎物上；上颌的倒钩状牙齿防止猎物滑出。颈部肌肉随后以蠕动把食团推向胃。吞咽期间气管前端（声门）会伸到口腔前方，让它边吞边呼吸。吞完后常“打哈欠”，让下颌复位。'],
  digest: ['消化 · Digestion', '食团被推入胃中，由强酸与消化酶逐渐分解，连骨骼也能溶解，只剩毛发随粪便排出。消化期间代谢率大幅升高，蛇会找温暖处休息并尽量减少活动。一顿饱餐可支撑数周。'],
  defense: ['防御行为', '蛇遇到威胁时通常先“警告”而不是攻击。此时你（镜头）就是它眼中的威胁者。'],
  bask: ['晒太阳 · 体温调节', '蛇是外温动物，体温依赖环境。清晨它们爬到向阳的岩石上，把肋骨向两侧撑开、身体压扁，增大受光面积，快速升温到 28–32 °C 的“最适体温”，此时消化、运动、免疫都最有效率。过热时则躲入阴凉或洞穴。'],
  shed: ['蜕皮 · Ecdysis', '蛇的表皮角质层不随身体生长，需定期整层蜕去（幼蛇约每月一次）。蜕皮前约一周，新旧皮之间分泌液体，眼罩鳞变得浑浊发蓝（“蓝眼期”），蛇视力下降、脾气暴躁、不进食；随后眼睛转清，数天后蛇在粗糙物体上摩擦吻部，让旧皮从唇缘裂开，再像脱袜子一样从头到尾把整张皮翻脱下来——旧皮完整保留了每一枚鳞片的印痕。'],
  hibernate: ['冬眠 · Brumation', '爬行动物的冬眠常称为“蛰伏”（brumation）。秋季气温降到 10 °C 以下时，蛇回到越冬洞穴——石缝、树根下或废弃的鼠洞，深度要在冻土线以下。蛰伏期间体温随土温降到 4–8 °C，心率从每分钟数十次降到个位数，代谢降低九成以上，靠体内的脂肪体维持数月；它们不是完全睡着，温暖的冬日偶尔会出洞晒太阳、喝水。'],
  repro: {
    eggs: ['繁殖 · 卵生', '春季出蛰后雄蛇循雌蛇的信息素追踪、求偶。雌蛇怀孕后选择温暖湿润、隐蔽的地点（腐木、落叶堆、土洞）产下革质软壳卵。卵靠环境温度孵化，幼蛇用吻端临时的“卵齿”划破卵壳而出。'],
    live: ['繁殖 · 胎生（卵胎生）', '许多蝰蛇和海蛇是胎生：卵留在母体输卵管内发育，由母体提供保护和恒定温度——这在寒冷或海洋环境中尤其有利。仔蛇出生时包裹在透明的胎膜中，片刻后破膜而出，一出生就能独立生活（且带有毒液）。'],
  },
};

// ---------------------------------------------------------------- 通用工具
function relaxSnake(dur = 0.9) {
  const s = S(); if (!s) return;
  const def = { hood: 0, flatten: 0, puff: 0, gape: 0, jawWalk: 0, headStretch: 0, fangErect: 0, glottis: 0, sink: 0, rattleOn: 0, shiver: 0, eyeCloud: 0, speedMul: 1, breathRate: 0.22, iridBoost: 0 };
  s.front.tw = 0; s.tail.tw = 0; s.front.aim = null; s.front.reach = 0; s.allowUnder = 0;
  s.look.ty = s.look.tp = s.look.tr = 0;
  s.tg.auto = true; s.tg.rate = 1;
  const from = {}; for (const k in def) from[k] = s[k];
  App.bg(tween(dur, k => { if (S() !== s) return; for (const key in def) s[key] = lerp(from[key], def[key], k); }));
  Sound.rattle(false); Sound.buzz(false);
}

function setGaitMotor(gait, o = {}) {
  const s = S();
  if (Wd().cur.water) gait = 'swim';
  if (gait === 'sidewind') return s.setMotor(Object.assign({ type: 'sidewind' }, o));
  if (gait === 'concertina') return s.setMotor(Object.assign({ type: 'concertina' }, o));
  if (gait === 'swim') return s.setMotor(Object.assign({ type: 'swim' }, o));
  return s.setMotor(Object.assign({ type: 'crawl', gait }, o));
}

function* moveTo(target, o = {}) {
  const gait = o.gait || (App.gait === 'idle' ? S().sp.gait : App.gait);
  const m = setGaitMotor(gait, { target, arrive: o.arrive, speed: o.speed ?? 1 });
  let t = 0;
  while (!m.done && t < (o.timeout || 45)) t += yield;
}

function* goPath(ctrl, o = {}) {
  const s = S();
  const m = s.followPath(ctrl, Object.assign({ speed: 0.11 * s.L }, o));
  while (!m.done) yield;
}

function frontSet(p) { Object.assign(S().front, p); }
function* frontTo(p, dur, ease = easeInOut) {
  const f = S().front, from = {};
  for (const k in p) if (typeof p[k] === 'number') from[k] = f[k];
  for (const k in p) if (typeof p[k] !== 'number') f[k] = p[k];
  yield* tween(dur, k => { for (const key in from) f[key] = lerp(from[key], p[key], k); }, ease);
}
function* propTo(obj, p, dur, ease = easeInOut) {
  const from = {}; for (const k in p) from[k] = obj[k];
  yield* tween(dur, k => { for (const key in p) obj[key] = lerp(from[key], p[key], k); }, ease);
}

function camThreat() { const c = App.camera.position; const s = S(); return new V3(c.x, s.spine[0].y + s.R * 2, c.z); }

// 螺旋盘绕路径：从头部位置切入，向内盘旋
function coilPath(s, o = {}) {
  const spacing = 2 * s.R * (o.spacing ?? 1.12);
  const rMin = o.rMin ?? Math.max(2.4 * s.R, s.hd.hl * 0.8);
  const frac = o.frac ?? 0.88;
  const r0 = Math.sqrt(s.L * frac * spacing / Math.PI + rMin * rMin);
  const h = s.spine[0].clone(), psi = s.heading();
  const f = new V3(Math.sin(psi), 0, Math.cos(psi)), right = new V3(Math.cos(psi), 0, -Math.sin(psi));
  const lead = f.clone().multiplyScalar(o.lead ?? s.L * 0.08);
  const c = h.clone().add(lead).addScaledVector(right, r0);
  const a0 = Math.atan2(-right.z, -right.x);
  const pts = [h.clone()];
  for (let th = 0; ; th += 0.04) {
    const r = r0 - spacing * th / TAU;
    if (r < rMin) break;
    const a = a0 - th;
    pts.push(new V3(c.x + Math.cos(a) * r, h.y, c.z + Math.sin(a) * r));
  }
  return { pts, center: c, r0, rMin };
}

function* coilHere(o = {}) {
  const s = S();
  const cp = coilPath(s, o);
  const m = s.followPath(cp.pts, { dense: false, speed: (o.speed ?? 0.1) * s.L, rect: false });
  while (!m.done) yield;
  s.stop();
  return cp;
}

// 头部搁在盘圈上
function* headRest(on = true, dur = 1) {
  if (on) { frontSet({ len: 0.07, rise: 0.5, r1: 0.3, r2: 0.55, r3: 0.95, sAmp: 0, sway: 0, headPitch: -0.25, aim: null, reach: 0, yawBias: 0 }); S().front.tw = 0.9; }
  else S().front.tw = 0;
  yield* wait(dur);
}

// S 形出击姿态
function* sPosture(aim, o = {}) {
  const s = S();
  frontSet({ len: o.len ?? 0.28, rise: 0, r1: 0.15, r2: 0.45, r3: 0.85, sAmp: 0, sFreq: 1.15, headPitch: 0, sway: 0, aim, reach: 0, yawBias: 0 });
  s.front.tw = 1;
  yield* frontTo({ rise: o.rise ?? 0.45, sAmp: o.sAmp ?? 1.0, headPitch: o.headPitch ?? -0.05 }, o.dur ?? 0.8);
}

function aimPoint(s, target) {
  const d = new V3().subVectors(target, s.spine[0]); d.y = 0; d.normalize();
  return target.clone().addScaledVector(d, -s.hd.hl * 0.8);
}

function* strike(target, o = {}) {
  const s = S();
  App.setTimeScale(0.22, '🐢 慢动作 ×0.2（真实出击 < 0.1 秒）');
  Sound.strike();
  const f = s.front;
  const dist = () => s.snoutWorld(new V3()).distanceTo(target);
  f.aim = aimPoint(s, target);
  yield* all(
    frontTo({ sAmp: 0.04, rise: 0.08, headPitch: -0.12, reach: Math.max(0, dist() - s.hd.hl * 0.2) }, 0.22, easeOut),
    propTo(s, { gape: 1, fangErect: s.fangHinged ? 1 : 0 }, 0.14),
  );
  yield* wait(0.08);
  yield* propTo(s, { gape: 0.38 }, 0.08);
  App.setTimeScale(1);
}

function* withdraw() {
  const s = S();
  yield* all(frontTo({ sAmp: 0.95, rise: 0.4, reach: 0 }, 0.35), propTo(s, { gape: 0, fangErect: 0 }, 0.35));
}

// ---------------------------------------------------------------- 猎物
// 猎物大小与蛇的体粗相匹配（蛇能吞下比头宽得多的猎物）
function preySize(s, type) {
  const R = s.R;
  if (type === 'eel') return R * 0.75 / 0.11;
  if (type === 'frog') return R * 1.05 / 0.28;
  return R * (type === 'rat' ? 1.15 : 0.95) / 0.3;
}
function spawnPrey(type, pos, heading) {
  const s = S();
  const p = new Prey(type, Wd(), preySize(s, type));
  App.scene.add(p.group);
  App.preys.push(p);
  p.place(pos, heading);
  App.applyThermal(p.group);
  return p;
}

// ---------------------------------------------------------------- 吞咽 & 消化
function* swallow(prey) {
  const s = S(), W = Wd();
  UI.info('进食', ...TXT.swallow);
  prey.alive = false; prey.state = 'dead'; prey.stopped = true;
  if (prey.type !== 'eel') prey.roll = Math.PI / 2 * (Math.random() < 0.5 ? 1 : -1);
  prey.air = 0; prey.lift = 0; prey.squash = 0;
  prey.update(0);
  const ax = prey.axis(new V3());
  const nose = prey.nose(new V3());
  const hl = s.hd.hl;
  const approach = nose.clone().addScaledVector(ax, hl * 1.2 + s.L * 0.04);
  const through = prey.pos.clone().addScaledVector(ax, -(prey.length * 0.5 + s.L * 0.12));
  // 沿猎物身体一侧绕到它的头部前方，再掉头对准（真实的蛇会用信子沿猎物身体探到头部）
  const ctrl = [];
  const toHead = new V3().subVectors(s.spine[0], prey.pos);
  const side = new V3(ax.z, 0, -ax.x); if (toHead.dot(side) < 0) side.negate();
  const off = prey.radius + s.R * 3 + s.L * 0.04;
  if (toHead.dot(ax) < prey.length * 0.6) {
    if (toHead.dot(ax) < -prey.length * 0.3) ctrl.push(prey.pos.clone().addScaledVector(ax, -prey.length * 0.6).addScaledVector(side, off));
    ctrl.push(prey.pos.clone().addScaledVector(side, off));
  }
  ctrl.push(nose.clone().addScaledVector(ax, s.L * 0.12).addScaledVector(side, s.L * 0.08));
  ctrl.push(approach);
  App.cam.set({ target: () => s.head.position, dist: Math.max(4, s.L * 0.3) });
  s.tg.rate = 3;
  yield* goPath(ctrl, { speed: 0.08 * s.L, wig: 0.012, lam: 0.3 * s.L });
  s.tg.rate = 0.2;
  // 张口、对准
  yield* propTo(s, { gape: 0.85, fangErect: 0 }, 0.8);
  UI.stage('吞咽');
  App.setTimeScale(2.5, '⏩ 快进 ×150（真实吞咽约 10–40 分钟）');
  const m = s.followPath([approach.clone().lerp(nose, 0.5), nose, prey.pos.clone(), through], { speed: 0.12 * s.hd.hl + 0.05, rect: true });
  const b = { t: 0, w: 0.02, amp: 0, len: prey.length * 0.5 };
  s.bolus.push(b);
  s.jawWalk = 1; s.glottis = 1;
  const pr = prey.radius;
  while (!m.done) {
    yield;
    const snout = s.snoutWorld(_c);
    const passed = new V3().subVectors(snout, nose).dot(ax) * -1;           // 吻端越过鼻尖的距离
    const inHead = passed > -0.05 && passed < prey.length + hl * 0.3;
    s.headStretch = damp(s.headStretch, inHead ? clamp(pr * 2.1 / (s.hd.hw * 2) - 0.6, 0, 1) : 0, 4, 0.016);
    s.gape = 0.55 + 0.25 * Math.sin(s.time * 3) * (inHead ? 1 : 0.2);
    const behind = new V3().subVectors(s.spine[0], prey.pos).dot(ax) * -1;  // 猎物中心在头后多远
    if (behind > 0) {
      b.t = behind / s.L;
      const i = s.indexOfT(b.t);
      b.amp = Math.max(0, pr * 1.08 - s.base[i]) + s.base[i] * 0.08;
      b.w = Math.max(0.02, prey.length / s.L * 0.42);
    }
    if (passed > prey.length + hl * 0.1) prey.group.visible = false;
  }
  prey.group.visible = false;
  App.setTimeScale(1);
  s.jawWalk = 0; s.glottis = 0;
  UI.caption('“打哈欠”：左右下颌复位', 2.5);
  for (let k = 0; k < 2; k++) { yield* propTo(s, { gape: 1, headStretch: 0.3 }, 0.45); yield* propTo(s, { gape: 0.05, headStretch: 0 }, 0.5); }
  s.gape = 0; s.headStretch = 0;
  s.tg.rate = 1;
  s.groundMode = W.cur.water ? 'free' : 'terrain';
  App.removePrey(prey);
  return b;
}

function* digest(b) {
  const s = S(), sp = s.sp;
  UI.stage('消化');
  UI.info('消化', TXT.digest[0], TXT.digest[1] + (sp.notes.digest ? '\n\n' + sp.notes.digest : ''));
  App.cam.set({ target: null, dist: null });
  const tStom = 0.03 + 0.57 * (sp.vent - 0.03);
  yield* propTo(b, { t: tStom }, 4);
  if (!Wd().cur.water) yield* coilHere({ frac: 0.8 });
  yield* headRest(true, 0.5);
  const big = sp.id === 'python';
  App.setTimeScale(1, '⏩ 延时摄影 · 1 秒 ≈ 1 天');
  const days = big ? 6 : 4;
  const amp0 = b.amp;
  for (let d = 1; d <= days; d++) {
    const k = d / days;
    App.vitals.digest = Math.round(k * 100);
    App.vitalsT.met = big ? (d < 3 ? 40 : 40 * (1 - k) + 2) : (d < 2 ? 7 : 7 * (1 - k) + 1.5);
    App.vitalsT.hr = big ? 45 : 35;
    UI.caption(`第 ${d} 天${big && d === 2 ? '：心脏质量增加约 40%，小肠质量翻倍' : ''}`, 1.4);
    yield* all(
      propTo(b, { amp: amp0 * (1 - k * 0.92), t: tStom + k * 0.08 }, 1.5),
      propTo(s, { heartSize: big ? lerp(1.4, 1.0, k * k) : 1.1, gutSize: big ? lerp(1.9, 1.1, k) : 1.3, fatSize: 1 + k * 0.4 }, 1.5),
    );
  }
  s.bolus.splice(s.bolus.indexOf(b), 1);
  App.vitals.digest = null; App.vitalsT.met = 1; App.vitalsT.hr = null;
  yield* propTo(s, { heartSize: 1, gutSize: 1 }, 1);
  App.setTimeScale(1);
  yield* headRest(false, 0.5);
}

// ---------------------------------------------------------------- 捕食
function* feed() {
  const s = S(), sp = s.sp, W = Wd();
  const strat = sp.feeding;
  const [title, text] = TXT.feed[strat];
  UI.info('捕食', title, text + (sp.notes.feed ? '\n\n' + sp.notes.feed : ''));
  const ambush = strat === 'strike' || strat === 'strikehold';
  UI.stages(ambush ? ['伏击盘踞', '感知猎物', 'S 形蓄势', '出击', strat === 'strike' ? '松口·追踪' : '咬住不放', '吞咽', '消化'] :
    strat === 'constrict' ? ['吐信搜寻', '潜行接近', 'S 形蓄势', '出击咬住', '缠绕绞杀', '吞咽', '消化'] :
      ['吐信搜寻', '接近', 'S 形蓄势', '出击咬住', '注毒等待', '吞咽', '消化']);
  const type = sp.prey;
  const psi = s.heading();
  const fwd = new V3(Math.sin(psi), 0, Math.cos(psi));
  const strikeR = 0.16 * s.L + s.hd.hl;
  let prey;
  try {
    if (ambush) {
      UI.stage(0);
      const cp = yield* coilHere({ frac: 0.95, rMin: Math.max(2.6 * s.R, s.hd.hl * 0.9) });
      const h = s.spine[0].clone();
      const hdir = new V3().subVectors(h, cp.center).setY(0);
      if (hdir.lengthSq() < 1e-4) hdir.copy(s.headDir(new V3())).setY(0);
      hdir.normalize();
      yield* sPosture(h.clone().addScaledVector(hdir, 5), { rise: 0.35, sAmp: 0.9, dur: 1.2 });
      if (sp.id === 'bamboo') { s.tail.len = 0.12; s.tail.rise = 0.25; s.tail.wig = 0.5; s.tail.wigF = 1.4; s.tail.tw = 1; UI.caption('尾部诱捕：轻摆焦红色的尾尖，模仿蠕虫吸引猎物', 3); }
      const side = new V3(hdir.z, 0, -hdir.x);
      const start = h.clone().addScaledVector(hdir, strikeR + 3 * s.hd.hl + 2).addScaledVector(side, rand(-2, 2));
      prey = spawnPrey(type, start, Math.atan2(h.x - start.x, h.z - start.z));
      prey.state = 'wander'; prey.homeR = 0.3;
      prey.home = cp.center.clone().addScaledVector(hdir, cp.r0 + s.R * 1.2 + prey.length * 0.5); prey.target = prey.home.clone();
      UI.stage(1);
      App.cam.set({ target: () => new V3().lerpVectors(s.head.position, prey.pos, 0.5), dist: Math.max(5, s.L * 0.4) });
      if (sp.thermalPits && !App.thermal) UI.caption('颊窝感知到了猎物的体热 —— 试试切换「红外」视图', 3.5);
      s.tg.rate = 2.5;
      let t = 0;
      while (true) {
        const dt = yield; t += dt;
        s.front.aim = aimPoint(s, prey.pos);
        if (prey.pos.distanceTo(s.spine[0]) < strikeR + s.hd.hl || t > 20) break;
      }
    } else {
      UI.stage(0);
      const start = s.spine[0].clone().addScaledVector(fwd, s.L * 0.35 + 5).add(new V3(rand(-4, 4), 0, rand(-4, 4)));
      if (W.cur.water) start.y = W.heightAt(start.x, start.z) + 1;
      prey = spawnPrey(type, start, rand(0, TAU));
      prey.state = 'wander'; prey.home = start.clone(); prey.homeR = 1.2;
      if (type === 'eel') prey.state = 'idle';
      App.cam.set({ target: () => new V3().lerpVectors(s.head.position, prey.pos, 0.4), dist: Math.max(6, s.L * 0.5) });
      s.tg.rate = 2.5;
      yield* wait(1.5);
      UI.stage(1);
      yield* moveTo(() => prey.pos, { arrive: strikeR + s.L * 0.08, speed: sp.id === 'python' ? 1.2 : 0.8 });
      s.stop();
      prey.stopped = true;
      UI.stage(2);
      yield* sPosture(aimPoint(s, prey.pos), { rise: W.cur.water ? 0.1 : 0.45 });
      yield* wait(0.6);
    }
    UI.stage(ambush ? 2 : 2);
    if (ambush) yield* wait(0.3);
    prey.stopped = true;
    // 出击
    UI.stage(3);
    const tgt = prey.pos.clone(); tgt.y += prey.radius * 0.6;
    yield* strike(tgt);
    s.tail.tw = 0;
    for (let i = 0; i < 12; i++) W.fx.emit({ p: tgt.clone(), v: new V3(rand(-1, 1), rand(0, 1.5), rand(-1, 1)), c: 0xd8e840, life: 0.8, size: 0.06, alpha: 0.9 });

    if (strat === 'strike') {
      UI.stage(4);
      yield* withdraw();
      prey.state = 'flee'; prey.stopped = false; prey.heading = Math.atan2(prey.pos.x - s.spine[0].x, prey.pos.z - s.spine[0].z) + rand(-0.6, 0.6);
      prey.pathLog = [tgt.clone()];
      UI.caption('松口！猎物带着毒液逃窜……', 2.5);
      App.cam.set({ target: () => new V3().lerpVectors(s.head.position, prey.pos, 0.45), dist: () => Math.max(6, s.head.position.distanceTo(prey.pos) * 1.2 + 4) });
      prey.fleeMul = 0.6;
      yield* wait(1.3);
      prey.state = 'stagger';
      yield* wait(1.6);
      prey.die(); prey.roll = Math.PI / 2;
      yield* wait(0.6);
      yield* frontTo({ rise: 0, sAmp: 0 }, 0.6); s.front.tw = 0;
      UI.caption('等待毒发后，循气味轨迹追踪（SICS）', 3);
      s.tg.rate = 5;
      // 显示气味轨迹
      for (const p of prey.pathLog) for (let k = 0; k < 3; k++) W.dust.emit({ p: p.clone().add(new V3(rand(-0.2, 0.2), rand(0.05, 0.3), rand(-0.2, 0.2))), v: new V3(0, 0.05, 0), c: 0xff8a1c, life: 7, size: 0.1, alpha: 0.75 });
      yield* wait(1.5);
      const stopD = prey.length * 0.6 + s.L * 0.08;
      const trailPts = prey.pathLog.filter(p => p.distanceTo(prey.pos) > stopD);
      yield* goPath(trailPts.length > 1 ? trailPts : [prey.pos.clone()], { speed: 0.06 * s.L, wig: 0.012, lam: 0.3 * s.L });
    } else if (strat === 'constrict') {
      UI.stage(4);
      prey.state = 'held';
      yield* constrict(prey);
    } else {
      UI.stage(4);
      prey.state = 'held';
      UI.caption(strat === 'bitehold' ? '咬住不放，反复咀嚼注入毒液' : '咬住不放，等待毒液起效', 3);
      const hp = prey.pos.clone();
      yield* tween(3.2, k => {
        s.jawWalk = strat === 'bitehold' ? 0.6 : 0;
        s.gape = 0.35 + 0.12 * Math.sin(k * 40) * (strat === 'bitehold' ? 1 : 0.3);
        prey.pos.copy(hp).add(new V3(Math.sin(k * 60) * 0.05 * (1 - k), 0, Math.cos(k * 47) * 0.05 * (1 - k)));
        if (prey.type === 'eel') prey.swimPhase += 0.3 * (1 - k);
      }, x => x);
      s.jawWalk = 0;
      prey.pos.copy(hp);
      yield* propTo(s, { gape: 0, fangErect: 0 }, 0.3);
      yield* frontTo({ rise: 0, sAmp: 0, reach: 0 }, 0.8); s.front.tw = 0;
      prey.die();
      if (W.cur.water) { prey.state = 'dead'; yield* propTo(prey.pos, { y: W.heightAt(prey.pos.x, prey.pos.z) + prey.radius }, 1.5); }
    }
    s.front.tw = 0; s.front.aim = null;
    UI.stage(5);
    const b = yield* swallow(prey);
    UI.stage(6);
    yield* digest(b);
  } finally {
    App.setTimeScale(1);
    App.clearPrey();
    App.cam.set({ target: null, dist: null });
  }
}

function constrictPose(s, prey, tight) {
  const ax = prey.axis(new V3()), side = new V3(ax.z, 0, -ax.x);
  const pr = prey.radius, R = s.R;
  const rc = (pr + R * 0.95) * (1 - 0.1 * tight);
  const g = Wd().heightAt(prey.pos.x, prey.pos.z);
  const C = prey.pos.clone(); C.y = g + rc + R * 0.85;
  prey.pos.y = C.y - pr * 0.2;
  const pitch = 2.15 * R, turns = 2.3;
  const pts = [], ups = [];
  // 头：咬住猎物头颈部
  const hp = C.clone().addScaledVector(ax, prey.length * 0.28).addScaledVector(UP, pr + s.hd.top * 0.6).addScaledVector(side, pr * 0.6);
  pts.push(hp); ups.push(UP.clone());
  const x0 = prey.length * 0.2;
  for (let th = 0; th <= turns * TAU; th += 0.12) {
    const a = th + 0.3;
    const dir = new V3().addScaledVector(UP, Math.cos(a)).addScaledVector(side, Math.sin(a));
    pts.push(C.clone().addScaledVector(ax, x0 - pitch * th / TAU).addScaledVector(dir, rc));
    ups.push(dir.clone());
  }
  // 出圈后落地向后延伸
  const last = pts[pts.length - 1];
  const tailDir = ax.clone().negate().addScaledVector(side, 0.6).normalize();
  for (let k = 1; k < 60; k++) {
    const p = last.clone().addScaledVector(tailDir, k * s.L * 0.02);
    p.addScaledVector(new V3(tailDir.z, 0, -tailDir.x), Math.sin(k * 0.15) * s.L * 0.03);
    p.y = Math.max(Wd().heightAt(p.x, p.z) + s.hb[s.N - 1], lerp(last.y, g, Math.min(1, k / 8)));
    pts.push(p); ups.push(UP.clone());
  }
  const out = Array.from({ length: s.N }, () => new V3()), outU = Array.from({ length: s.N }, () => new V3());
  resamplePolyline(pts, s.SEG, s.N, out, ups, outU);
  for (let i = 0; i < s.N; i++) { const gy = Wd().heightAt(out[i].x, out[i].z) + s.hb[i]; if (out[i].y < gy) out[i].y = gy; }
  return { pts: out, ups: outU };
}

function* constrict(prey) {
  const s = S();
  UI.caption('瞬间缠绕！每当猎物呼气，就再收紧一圈', 3.5);
  s.groundMode = 'free';
  yield* frontTo({ reach: 0 }, 0.2);
  s.front.tw = 0;
  let tight = 0;
  const pose = constrictPose(s, prey, 0);
  const m = s.setMotor({ type: 'pose', pts: pose.pts, ups: pose.ups, k: 5, gen: mm => { const p = constrictPose(s, prey, tight); mm.pts = p.pts; mm.ups = p.ups; } });
  yield* propTo(s, { gape: 0.3 }, 0.3);
  App.vitalsT.hr = 60;
  yield* tween(6, k => {
    tight = Math.min(1, k * 1.3) + Math.sin(k * 30) * 0.08 * (1 - k);
    prey.squash = tight * 0.8;
    s.shiver = 0.4 * (1 - k);
  }, x => x);
  prey.die();
  UI.caption('猎物心跳停止——蛇能通过缠绕感知猎物的心跳', 3);
  yield* wait(1);
  // 松开
  s.stop(); s.shiver = 0;
  yield* propTo(s, { gape: 0 }, 0.3);
  const ax = prey.axis(new V3());
  const g = Wd().heightAt(prey.pos.x, prey.pos.z);
  prey.state = 'dead';
  yield* propTo(prey.pos, { y: g }, 0.8);
  prey.squash = 0.3;
  // 蛇从线圈中爬出，绕到猎物头部
  s.groundMode = 'terrain';
  const side = new V3(ax.z, 0, -ax.x);
  s.resetTrail();
  yield* goPath([s.spine[0].clone().addScaledVector(UP, s.R * 2.5).addScaledVector(side, prey.radius + s.R * 3), prey.pos.clone().addScaledVector(side, prey.radius + s.L * 0.08)], { speed: 0.07 * s.L });
  App.vitalsT.hr = null;
}

// ---------------------------------------------------------------- 吐信子演示
function* tongueDemo() {
  const s = S(), W = Wd();
  UI.info('感官', ...TXT.tongue);
  UI.stages(['伸出', '上下摆动采样', '两叉张开', '收回', '送入犁鼻器']);
  s.stop();
  s.tg.auto = false;
  // 犁鼻器辉光：透过头部可见
  const gc = mkCanvas(64, 64), gg = gc.getContext('2d'), gr = gg.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(160,230,255,1)'); gr.addColorStop(0.4, 'rgba(80,190,255,0.5)'); gr.addColorStop(1, 'rgba(80,190,255,0)');
  gg.fillStyle = gr; gg.fillRect(0, 0, 64, 64);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(gc), blending: THREE.AdditiveBlending, depthTest: false, transparent: true, opacity: 0 }));
  glow.scale.setScalar(s.hd.hw * 1.2); glow.position.set(0, s.hd.top * 0.15, 0.8 * s.hd.hl - s.hd.zh); glow.renderOrder = 10;
  s.upper.add(glow);
  App.setTimeScale(0.3, '🐢 慢动作 ×0.3');
  App.cam.set({ target: () => s.head.position, dist: Math.max(1.6, s.hd.hl * 3.2), dir: () => { const x = new V3(1, 0, 0).applyQuaternion(s.head.quaternion); const f = s.headDir(new V3()); return x.multiplyScalar(0.8).addScaledVector(f, 0.6).add(new V3(0, 0.45, 0)).normalize(); } });
  try {
    App.bg((function* () { while (glow.parent) { yield; glow.material.opacity = clamp(s.vomero * 1.4, 0, 1); } })());
    yield* wait(1.2);
    const tipL = new V3(), tipR = new V3();
    for (let n = 0; n < 3; n++) {
      s.flick(1.6, 4);
      let t = 0;
      while (s.tg.active) {
        const dt = yield; t += dt;
        const p = s.tg.t / s.tg.dur;
        UI.stage(p < 0.15 ? 0 : p < 0.5 ? 1 : p < 0.8 ? 2 : 3);
        s.tongueTips(tipL, tipR);
        if (s.tg.ext > 0.3 && Math.random() < 0.6) {
          const f = s.headDir(new V3());
          const base = s.snoutWorld(new V3()).addScaledVector(f, s.hd.hl * rand(0.4, 1.4)).add(new V3(rand(-1, 1), rand(-0.4, 0.5), rand(-1, 1)).multiplyScalar(s.hd.hl * 0.7));
          const left = new V3().subVectors(base, s.head.position).dot(new V3(1, 0, 0).applyQuaternion(s.head.quaternion)) > 0;
          W.dust.emit({ p: base, v: new V3(0, 0, 0), c: left ? 0x2e9be8 : 0xf07a18, life: 2.2, size: s.hd.hw * 0.09, alpha: 0.95, fade: 0.2,
            fn: (d, dt) => { const tip = left ? tipL : tipR; if (s.tg.ext > 0.2) { d.v.lerp(_e.subVectors(tip, d.p).multiplyScalar(3), Math.min(1, dt * 4)); } else { d.v.lerp(_e.subVectors(s.head.position, d.p).multiplyScalar(4), Math.min(1, dt * 5)); if (d.p.distanceTo(s.head.position) < s.hd.hl * 0.6) d.life = Math.min(d.life, 0.1); } } });
        }
      }
      UI.stage(4);
      UI.caption('犁鼻器被“点亮”：左右两侧的气味浓度差 → 判断方向', 2.2);
      yield* wait(1.4);
    }
  } finally {
    glow.parent?.remove(glow);
    s.tg.auto = true;
    App.setTimeScale(1);
    App.cam.set({ target: null, dist: null });
  }
}

// ---------------------------------------------------------------- 防御
function* defend() {
  const s = S(), sp = s.sp, W = Wd();
  UI.info('防御', TXT.defense[0], TXT.defense[1] + (sp.notes.defense ? '\n\n' + sp.notes.defense : ''));
  s.stop();
  App.cam.set({ target: () => s.head.position, dist: Math.max(5, s.L * 0.45) });
  try {
    switch (sp.defense) {
      case 'hood': {
        UI.stages(['察觉威胁', '竖起前身', '张开兜帽', '嘶声·摇摆', '虚张声势的扑击', '离开']);
        UI.stage(0); s.tg.rate = 3; yield* wait(1);
        UI.stage(1);
        frontSet({ len: 0.3, rise: 0, r1: 0.28, r2: 0.86, r3: 0.99, sAmp: 0, headPitch: -0.12, sway: 0, aim: camThreat(), reach: 0, yawBias: 0 });
        s.front.tw = 1;
        yield* frontTo({ rise: 1.45 }, 1.4);
        UI.stage(2); Sound.hiss(2.2, 0.5);
        yield* all(propTo(s, { hood: 1 }, 0.9), propTo(s, { puff: 0.6 }, 0.9));
        UI.stage(3);
        let t = 0;
        while (t < 4.5) { t += yield; s.front.sway = Math.sin(t * 1.4) * 0.18; s.front.aim = camThreat(); }
        UI.stage(4);
        for (let k = 0; k < 2; k++) {
          Sound.hiss(0.6, 0.6);
          yield* frontTo({ rise: 0.95, reach: s.L * 0.08 }, 0.18, easeOut);
          yield* frontTo({ rise: 1.45, reach: 0 }, 0.5);
          yield* wait(0.8);
        }
        UI.stage(5);
        yield* all(propTo(s, { hood: 0, puff: 0 }, 1), frontTo({ rise: 0 }, 1.2));
        s.front.tw = 0;
        break;
      }
      case 'rattle': {
        UI.stages(['察觉威胁', '盘成防御圈', '竖尾摇响', 'S 形颈部瞄准', '警告性扑击', '放松']);
        UI.stage(0); yield* wait(0.6);
        UI.stage(1);
        yield* coilHere({ frac: 0.88, speed: 0.2, rMin: Math.max(2.8 * s.R, s.hd.hl * 1.0) });
        UI.stage(2);
        s.tail.len = 0.07; s.tail.rise = 1.2; s.tail.wig = 0; s.tail.vib = 0; s.tail.tw = 1;
        Sound.rattle(true); yield* propTo(s, { rattleOn: 1 }, 0.4);
        UI.caption('响环每秒振动 50–90 次；声音来自空心角质环之间的碰撞', 3.5);
        UI.stage(3);
        yield* sPosture(camThreat(), { rise: 0.6, sAmp: 0.95, len: 0.22 });
        let t = 0; while (t < 4) { t += yield; s.front.aim = aimPoint(s, camThreat()); }
        UI.stage(4);
        Sound.strike();
        yield* frontTo({ sAmp: 0.1, rise: 0.25, reach: s.L * 0.1 }, 0.15, easeOut);
        yield* propTo(s, { gape: 0.9, fangErect: 1 }, 0.1);
        yield* all(frontTo({ sAmp: 0.95, rise: 0.6, reach: 0 }, 0.5), propTo(s, { gape: 0, fangErect: 0 }, 0.4));
        yield* wait(2);
        UI.stage(5);
        yield* propTo(s, { rattleOn: 0 }, 0.5); Sound.rattle(false);
        s.tail.tw = 0; yield* frontTo({ rise: 0, sAmp: 0 }, 1); s.front.tw = 0;
        break;
      }
      case 'hiss': {
        UI.stages(['察觉威胁', '吸气膨胀', 'S 形颈部', '嘶声', '示威扑咬', '放松']);
        UI.stage(0); yield* wait(0.8);
        UI.stage(1); yield* propTo(s, { puff: 1 }, 1.2);
        UI.stage(2); yield* sPosture(camThreat(), { rise: 0.55, sAmp: 0.9, len: 0.2 });
        UI.stage(3); Sound.hiss(2.5, 0.7);
        let t = 0; while (t < 3) { t += yield; s.puff = 0.85 + 0.15 * Math.sin(t * 4); s.front.aim = aimPoint(s, camThreat()); }
        UI.stage(4); Sound.strike();
        yield* all(frontTo({ sAmp: 0.1, rise: 0.2, reach: s.L * 0.07 }, 0.18, easeOut), propTo(s, { gape: 0.9 }, 0.12));
        yield* all(frontTo({ sAmp: 0.9, rise: 0.55, reach: 0 }, 0.5), propTo(s, { gape: 0 }, 0.4));
        yield* wait(1.5);
        UI.stage(5); yield* all(propTo(s, { puff: 0 }, 1), frontTo({ rise: 0, sAmp: 0 }, 1)); s.front.tw = 0;
        break;
      }
      case 'tailvib': {
        UI.stages(['察觉威胁', 'S 形颈部', '振尾拍叶（拟态响尾蛇）', '伺机逃离']);
        UI.stage(0); yield* wait(0.6);
        UI.stage(1); yield* sPosture(camThreat(), { rise: 0.35, sAmp: 0.95, len: 0.22 });
        UI.stage(2);
        s.tail.len = 0.12; s.tail.rise = 0.05; s.tail.vib = 0.25; s.tail.wig = 0; s.tail.tw = 1;
        Sound.buzz(true);
        let t = 0; while (t < 3.5) { t += yield; s.front.aim = aimPoint(s, camThreat()); if (Math.random() < 0.3) W.dust.emit({ p: s.spine[s.N - 1].clone(), v: new V3(rand(-1, 1), rand(0.5, 1.5), rand(-1, 1)), c: 0x6a5a40, life: 0.8, size: 0.05, grav: 3 }); }
        Sound.buzz(false); s.tail.tw = 0; s.tail.vib = 0;
        UI.stage(3);
        yield* frontTo({ rise: 0, sAmp: 0 }, 0.5); s.front.tw = 0;
        const away = new V3().subVectors(s.spine[0], App.camera.position).setY(0).normalize();
        s.speedMul = 1.7;
        yield* forAtMost(4, moveTo(s.spine[0].clone().addScaledVector(away, s.L)));
        s.speedMul = 1;
        break;
      }
      case 'gape': {
        UI.stages(['察觉威胁', 'S 形颈部', '张口示威', '扑击', '放松']);
        UI.stage(0); yield* wait(0.6);
        UI.stage(1); yield* sPosture(camThreat(), { rise: 0.4, sAmp: 1.0, len: 0.3 });
        UI.stage(2); yield* propTo(s, { gape: 1, fangErect: 0.6 }, 0.6);
        UI.caption('张开大口，露出苍白的口腔与毒牙示威', 3);
        let t = 0; while (t < 3) { t += yield; s.front.aim = aimPoint(s, camThreat()); }
        UI.stage(3); Sound.strike();
        yield* frontTo({ sAmp: 0.1, rise: 0.15, reach: s.L * 0.1 }, 0.15, easeOut);
        yield* frontTo({ sAmp: 1, rise: 0.4, reach: 0 }, 0.5);
        yield* wait(1);
        UI.stage(4); yield* all(propTo(s, { gape: 0, fangErect: 0 }, 0.6), frontTo({ rise: 0, sAmp: 0 }, 1)); s.front.tw = 0;
        break;
      }
      case 'headhide': {
        UI.stages(['察觉威胁', '松散盘起', '身体压扁·藏头', '翘尾佯装头部', '放松']);
        UI.stage(0); yield* wait(0.6);
        UI.stage(1); yield* coilHere({ frac: 0.7, speed: 0.14, spacing: 1.4 });
        UI.stage(2);
        frontSet({ len: 0.09, rise: -0.5, r1: 0.2, r2: 0.95, r3: 1, sAmp: 0.6, sFreq: 0.5, headPitch: -0.7, sway: 0, aim: null, reach: 0, yawBias: 1.2 });
        s.allowUnder = s.R * 3;
        s.front.tw = 1;
        yield* propTo(s, { flatten: 1 }, 0.8);
        UI.stage(3);
        s.tail.len = 0.1; s.tail.rise = 0.7; s.tail.wig = 0.35; s.tail.wigF = 0.6; s.tail.vib = 0; s.tail.tw = 1;
        let t = 0; while (t < 5) { const dt = yield; t += dt; if (Math.random() < dt * 0.8) { s.flatten = 0.6; } s.flatten = damp(s.flatten, 1, 4, dt); }
        UI.stage(4);
        s.tail.tw = 0; s.front.tw = 0; yield* propTo(s, { flatten: 0 }, 1);
        s.allowUnder = 0;
        break;
      }
      default: {
        UI.stages(['察觉威胁', '快速游离', '下潜']);
        UI.stage(0); yield* wait(0.5);
        UI.stage(1);
        const away = new V3().subVectors(s.spine[0], App.camera.position).setY(0).normalize();
        s.speedMul = 1.8;
        const tgt = s.spine[0].clone().addScaledVector(away, s.L * 1.2); tgt.y = W.cur.swimMin;
        yield* forAtMost(3, moveTo(tgt));
        UI.stage(2);
        yield* forAtMost(3, moveTo(tgt.clone().addScaledVector(away, s.L)));
        s.speedMul = 1;
      }
    }
  } finally {
    Sound.rattle(false); Sound.buzz(false);
    App.cam.set({ target: null, dist: null });
  }
}

// ---------------------------------------------------------------- 晒太阳
function* bask() {
  const s = S(), W = Wd();
  if (W.cur.water) { yield* breathe(); return; }
  UI.info('体温调节', ...TXT.bask);
  UI.stages(['清晨体温低', '爬向向阳处', '展平身体吸热', '达到最适体温']);
  UI.stage(0);
  App.vitalsT.temp = W.airTemp() - 8;
  yield* wait(1.2);
  UI.stage(1);
  const spot = W.cur.spots.bask.clone(); spot.y = W.heightAt(spot.x, spot.z);
  yield* moveTo(spot, { arrive: s.L * 0.12 });
  // 在石上铺开成松散的 S 形
  const psi = s.heading(), f = new V3(Math.sin(psi), 0, Math.cos(psi)), r = new V3(f.z, 0, -f.x);
  const ctrl = [];
  for (let k = 1; k <= 6; k++) ctrl.push(s.spine[0].clone().addScaledVector(f, k * s.L * 0.07).addScaledVector(r, Math.sin(k * 1.2) * s.L * 0.08));
  yield* goPath(ctrl, { speed: 0.06 * s.L });
  s.stop();
  UI.stage(2);
  UI.caption('肋骨向两侧撑开，身体压扁，增大受光面积', 3);
  yield* headRest(false, 0);
  yield* propTo(s, { flatten: 1, iridBoost: 0.3 }, 2);
  App.setTimeScale(1, '⏩ 延时 · 约 30 分钟');
  const t0 = App.vitals.temp;
  yield* tween(6, k => { App.vitalsT.temp = lerp(t0, 31, k); App.vitals.temp = App.vitalsT.temp; });
  UI.stage(3);
  UI.caption('体温 31 °C：消化、运动、免疫都处于最佳状态', 3);
  App.setTimeScale(1);
  yield* wait(2);
  yield* propTo(s, { flatten: 0, iridBoost: 0 }, 1.5);
  App.vitalsT.temp = null;
}

// ---------------------------------------------------------------- 蜕皮
function* shed() {
  const s = S(), W = Wd(), sp = s.sp;
  UI.info('生长', TXT.shed[0], TXT.shed[1] + (sp.notes.shed ? '\n\n' + sp.notes.shed : ''));
  UI.stages(['蓝眼期（约 1 周）', '眼睛转清', '摩擦吻部', '从头至尾翻脱', '焕然一新']);
  let shell = null;
  try {
    UI.stage(0);
    s.stop();
    App.setTimeScale(1, '⏩ 延时 · 1 秒 ≈ 1 天');
    App.cam.set({ target: () => s.head.position, dist: Math.max(3, s.hd.hl * 8) });
    yield* all(propTo(s, { eyeCloud: 1, dull: 0.9 }, 2.5));
    UI.caption('眼罩鳞下积液，眼睛浑浊发蓝，皮肤暗淡——此时蛇视力差、易怒、不进食', 4);
    yield* wait(3.5);
    UI.stage(1);
    yield* propTo(s, { eyeCloud: 0 }, 2);
    UI.caption('眼睛转清，数天内即将蜕皮', 2.5);
    yield* wait(1.5);
    App.setTimeScale(1);
    App.cam.set({ target: null, dist: null });
    UI.stage(2);
    const rb = W.cur.spots.rub;
    const rubP = new V3(rb.x, 0, rb.z);
    if (!W.cur.water) {
      yield* forAtMost(18, moveTo(rubP, { arrive: s.L * 0.1 }));
    }
    s.stop();
    UI.caption('在粗糙处摩擦吻部，旧皮从唇缘开始裂开', 2.5);
    yield* tween(2.4, k => { s.look.ty = Math.sin(k * 30) * 0.35; s.gape = 0.08 + 0.05 * Math.sin(k * 40); });
    s.look.ty = 0; s.gape = 0;
    UI.stage(3);
    shell = s.makeShedSkin();
    W.extras.add(shell);
    App.applyThermal(shell);
    s.dull = 0;
    UI.caption('旧皮外翻、像脱袜子一样整张蜕下', 3);
    App.cam.set({ target: () => s.center(new V3()), dist: Math.max(8, s.L * 0.7) });
    const psi = s.heading(), f = new V3(Math.sin(psi), 0, Math.cos(psi));
    const pts = [];
    for (let k = 1; k <= 12; k++) pts.push(s.spine[0].clone().addScaledVector(f, k * s.L * 0.1).add(new V3(Math.sin(k * 0.5) * s.L * 0.03, 0, 0)));
    s.iridBoost = 0.5;
    yield* goPath(pts, { speed: 0.06 * s.L, rect: true });
    s.stop();
    UI.stage(4);
    UI.caption('新皮色泽鲜艳、光泽如新；旧皮完整保留了每一枚鳞片的印痕', 3.5);
    // 旧皮干瘪、压扁
    const geo = shell.userData.bodyGeo, base = shell.userData.basePos, pa = geo.attributes.position;
    yield* tween(2.5, k => {
      for (let i = 0; i < pa.count; i++) {
        const x = base[i * 3], y = base[i * 3 + 1], z = base[i * 3 + 2];
        const g = W.heightAt(x, z);
        pa.setY(i, lerp(y, g + (y - g) * 0.35 + (vnoise(x * 3, z * 3) - 0.5) * s.R * 0.2, k));
      }
      pa.needsUpdate = true;
    });
    geo.computeVertexNormals();
    yield* wait(2.5);
    yield* propTo(s, { iridBoost: 0 }, 2);
  } finally {
    s.dull = 0; s.eyeCloud = 0;
    App.setTimeScale(1);
    App.cam.set({ target: null, dist: null });
  }
}

// ---------------------------------------------------------------- 冬眠
function* hibernate() {
  const s = S(), sp = s.sp;
  if (sp.hibernate === 'none') { yield* seaRest(); return; }
  const W = Wd();
  const home = W.cur;
  UI.info('冬眠', TXT.hibernate[0], TXT.hibernate[1] + (sp.notes.hibernate ? '\n\n' + sp.notes.hibernate : ''));
  UI.stages(['秋季降温', '回到越冬洞穴', '入洞', '盘绕蛰伏', '深冬', '春季苏醒', '出洞晒太阳']);
  const companions = [];
  let den = null;
  try {
    UI.stage(0);
    W.setSeason('autumn');
    App.setSeasonLabel('秋');
    UI.caption('秋季：气温降到 10 °C 以下，蛇变得迟缓，开始向越冬地迁移', 3.5);
    App.vitalsT.temp = 12;
    s.speedMul = 0.6;
    setGaitMotor(App.gait === 'idle' ? sp.gait : App.gait, {});
    yield* wait(4);
    yield* App.fade(1, 0.8);
    s.speedMul = 1;
    // —— 洞穴剖面 ——
    den = W.buildDen(s);
    W.setHabitat('den', den);
    W.setSeason('autumn');
    const z0 = den.z0, tR = den.tR;
    // 在顶面摆放：头朝入口
    const pts = [];
    const hx = den.xE - s.L * 0.12, hz = z0 - Math.min(den.Db * 0.3, 4);
    for (let k = 0; k < 200; k++) {
      const d = k * s.L / 150;
      pts.push(new V3(hx - d * 0.55, 0, hz - d * 0.45 + Math.sin(d * 0.8) * s.L * 0.05));
    }
    s.groundMode = 'terrain';
    s.placeOnPolyline(pts);
    s.resetTrail();
    App.cam.set({ target: new V3(den.xE * 0.4, -den.Hb * 0.35, z0), dist: Math.max(den.Wb * 0.62, den.Hb * 1.6), dir: new V3(0.12, 0.22, 1).normalize(), snap: true });
    if (sp.hibernate === 'communal') {
      for (let k = 0; k < 3; k++) {
        const c = new Snake(sp, { world: W, N: 140 });
        c.groundMode = 'free'; c.clampGround = false;
        const cc = new V3(den.xC + rand(-0.4, 0.4) * den.r0, den.floorY, z0 - den.chD * 0.35 + rand(-0.3, 0.3) * den.r0);
        const cp = [];
        const sp2 = 2 * c.R * 1.05, rm = den.rMin * 0.8, r0 = Math.sqrt(c.L * 1.25 * sp2 / Math.PI + rm * rm);
        for (let th = 0; ; th += 0.05) { const r = r0 - sp2 * th / TAU; if (r < rm) break; const a = k * 2 + th * (k % 2 ? 1 : -1); cp.push(new V3(cc.x + Math.cos(a) * r, den.floorY + c.R * 0.9 + (k + 1) * c.R * 1.6 + Math.sin(th * 3) * c.R * 0.3, cc.z + Math.sin(a) * r * 0.75)); }
        c.placeOnPolyline(cp.reverse());
        c.group.visible = true;
        App.scene.add(c.group);
        c.breathRate = 0.02;
        companions.push(c);
      }
    }
    yield* App.fade(0, 0.8);
    UI.stage(1);
    UI.caption(sp.hibernate === 'communal' ? '回到代代相传的越冬洞穴——洞里已有同伴' : '回到越冬洞穴：入口隐蔽在石缝下，洞室深达冻土线以下', 3.5);
    // 入洞路径
    s.groundMode = 'free';
    s.clampGround = false;
    const path = [];
    const entry = new V3(den.xE, s.hb[0], z0 - tR * 0.4);
    path.push(new V3(den.xE - tR * 3, s.hb[0], z0 - tR * 1.2), entry);
    for (const p of den.tunnel.getSpacedPoints(60)) path.push(new V3(p.x, p.y - tR + s.hb[5] + tR * 0.12, z0 - tR * 0.35));
    const floorY = den.floorY + s.hb[20];
    const cc = new V3(den.xC, floorY, z0 - den.chD * 0.32);
    path.push(new V3(den.xC - den.r0 * 1.05, floorY, z0 - tR * 0.4));
    // 螺旋
    const spacing = den.spacing;
    const a0 = Math.atan2(z0 - tR * 0.4 - cc.z, den.xC - den.r0 * 1.05 - cc.x);
    for (let th = 0; ; th += 0.05) { const r = den.r0 - spacing * th / TAU; if (r < den.rMin) break; const a = a0 - th; path.push(new V3(cc.x + Math.cos(a) * r, floorY, cc.z + Math.sin(a) * r * 0.8)); }
    const dense = smoothPath([s.spine[0].clone(), ...path], s.SEG * 0.5);
    UI.stage(2);
    App.cam.set({ target: () => s.head.position.clone().lerp(new V3(0, -den.Hb * 0.45, z0), 0.6), dist: Math.max(den.Wb * 0.55, den.Hb * 1.5) });
    const m = s.followPath(dense, { dense: true, speed: 0.1 * s.L });
    let tt = 0;
    while (!m.done) { const dt = yield; tt += dt; App.vitalsT.temp = lerp(12, 7, clamp(tt / 20, 0, 1)); }
    s.stop();
    UI.stage(3);
    yield* headRest(true, 0.5);
    UI.caption('盘成一团，减少散热；以体内脂肪维持数月', 3);
    s.breathRate = 0.04;
    App.vitalsT.hr = 3; App.vitalsT.met = 0.08; App.vitalsT.temp = 5;
    yield* wait(2.5);
    UI.stage(4);
    W.setSeason('winter'); App.setSeasonLabel('冬');
    W.setWeather('snow');
    App.setTimeScale(1, '⏩ 延时 · 1 秒 ≈ 10 天');
    App.denTemps = { surf: -10, den: 5 };
    Sound.heart(true);
    for (const mon of ['12 月', '1 月', '2 月']) {
      UI.caption(`${mon}：地表 −10 °C，洞穴内 +4~6 °C。心跳每分钟仅 3–5 次`, 3);
      yield* all(propTo(W.snowMat, { opacity: Math.min(1, W.snowMat.opacity + 0.4) }, 2.5), propTo(s, { fatSize: Math.max(0.35, s.fatSize - 0.25) }, 2.5));
      yield* wait(1);
    }
    Sound.heart(false);
    UI.stage(5);
    W.setWeather(null);
    W.setSeason('spring'); App.setSeasonLabel('春');
    App.denTemps = { surf: 12, den: 9 };
    UI.caption('春季：土温回升，蛇苏醒——出洞后第一件事是晒太阳', 3.5);
    yield* propTo(W.snowMat, { opacity: 0 }, 3);
    App.vitalsT.hr = 18; App.vitalsT.met = 0.6; App.vitalsT.temp = 10;
    s.breathRate = 0.22;
    yield* headRest(false, 0.6);
    App.setTimeScale(1);
    // 出洞：越过盘圈 → 隧道 → 地表
    s.resetTrail();
    const out = [s.spine[0].clone().add(new V3(0, s.R * 2.4, 0)), new V3(den.xC - den.r0 * 1.1, floorY + s.R * 2, z0 - tR * 0.4), new V3(den.xC - den.chW * 0.95, floorY, z0 - tR * 0.4)];
    for (const p of den.tunnel.getSpacedPoints(60).reverse()) out.push(new V3(p.x, p.y - tR + s.hb[5] + tR * 0.12, z0 - tR * 0.35));
    out.push(new V3(den.xE + tR * 2, s.hb[0], z0 - tR * 2.5), new V3(den.xE + s.L * 0.35, s.hb[0], z0 - den.Db * 0.4));
    const d2 = smoothPath([s.spine[0].clone(), ...out], s.SEG * 0.5);
    const m2 = s.followPath(d2, { dense: true, speed: 0.1 * s.L });
    let t2 = 0;
    while (!m2.done) { const dt = yield; t2 += dt; if (s.spine[0].y > -0.5) { s.groundMode = 'terrain'; s.clampGround = true; } }
    s.groundMode = 'terrain'; s.clampGround = true; s.resetTrail();
    s.stop();
    UI.stage(6);
    yield* propTo(s, { flatten: 1 }, 1.5);
    App.vitalsT.temp = 24; App.vitalsT.hr = null; App.vitalsT.met = 1;
    yield* wait(3);
    yield* propTo(s, { flatten: 0 }, 1);
    yield* App.fade(1, 0.8);
  } finally {
    for (const c of companions) c.dispose();
    W.setWeather(null);
    W.setSeason('summer'); App.setSeasonLabel(null);
    App.denTemps = null;
    s.fatSize = 1; s.breathRate = 0.22; s.flatten = 0; s.front.tw = 0; s.front.w = 0;
    s.groundMode = home.water ? 'free' : 'terrain'; s.clampGround = true;
    W.setHabitat(home.id);
    App.placeSnakeHome();
    App.setTimeScale(1);
    App.vitalsT.temp = null; App.vitalsT.hr = null; App.vitalsT.met = 1;
    Sound.heart(false);
    App.cam.set({ target: null, dist: null, snap: true });
    yield* App.fade(0, 0.8);
  }
}

function* seaRest() {
  const s = S(), W = Wd();
  UI.info('休憩', '海蛇不冬眠', s.sp.notes.hibernate);
  UI.stages(['下潜', '伏于海底', '缓慢代谢', '上浮换气']);
  UI.stage(0);
  const tgt = s.spine[0].clone(); tgt.y = W.cur.swimMin * 0.6;
  yield* forAtMost(6, moveTo(tgt, { arrive: 1.5 }));
  UI.stage(1);
  s.groundMode = 'terrain';
  s.stop(); s.resetTrail();
  yield* coilHere({ frac: 0.6, speed: 0.08 });
  UI.stage(2);
  s.breathRate = 0.05;
  App.setTimeScale(1, '⏩ 延时 · 约 1 小时');
  App.vitalsT.hr = 8;
  UI.caption('海蛇可在海底静伏 1–2 小时：长长的肺储存空气，皮肤也能吸收约 20% 的氧气', 4);
  yield* wait(5);
  App.setTimeScale(1);
  s.groundMode = 'free'; s.breathRate = 0.22; App.vitalsT.hr = null;
  UI.stage(3);
  yield* breathe(true);
}

// ---------------------------------------------------------------- 海蛇：上浮换气
function* breathe(sub = false) {
  const s = S(), W = Wd();
  if (!sub) { UI.info('呼吸', '上浮换气', s.sp.notes.special); UI.stages(['上浮', '鼻孔出水换气', '关闭鼻瓣', '下潜']); }
  if (!W.cur.water) return;
  s.groundMode = 'free';
  if (!sub) UI.stage(0);
  const surf = W.cur.surfY;
  const tgt = s.spine[0].clone(); tgt.y = surf - s.R * 1.5;
  yield* forAtMost(12, moveTo(tgt, { arrive: s.L * 0.1 }));
  s.stop();
  if (!sub) UI.stage(1);
  frontSet({ len: 0.12, rise: 0.8, r1: 0.3, r2: 0.7, r3: 0.95, sAmp: 0, headPitch: 0.1, aim: null, reach: 0, yawBias: 0, sway: 0 });
  s.front.tw = 1;
  App.cam.set({ target: () => s.head.position, dist: Math.max(3, s.hd.hl * 9) });
  yield* wait(1.2);
  for (let k = 0; k < 20; k++) W.fx.emit({ p: s.snoutWorld(new V3()), v: new V3(rand(-0.4, 0.4), rand(0.2, 0.8), rand(-0.4, 0.4)), c: 0xe8ffff, life: 1, size: 0.05 });
  UI.caption('鼻孔位于吻背，露出水面快速吸气', 2.5);
  yield* wait(2.2);
  if (!sub) UI.stage(2);
  UI.caption('鼻孔瓣膜关闭，重新下潜', 2);
  s.front.tw = 0;
  yield* wait(0.8);
  if (!sub) UI.stage(3);
  const down = s.spine[0].clone().add(new V3(rand(-6, 6), 0, rand(-6, 6))); down.y = (W.cur.swimMin + W.cur.swimMax) / 2;
  yield* forAtMost(6, moveTo(down));
  App.cam.set({ target: null, dist: null });
}

// ---------------------------------------------------------------- 树栖（竹叶青）
function drapePose(s, P, o = {}) {
  const a = new V3().subVectors(P.b1, P.b0), Lb = a.length(); a.normalize();
  const side = new V3().crossVectors(a, UP).normalize(), up = new V3().crossVectors(side, a).normalize();
  const rr = P.r + s.R * 0.85;
  const pts = [], ups = [];
  let xa = Lb * 0.86, s0 = 0;
  const ds = s.SEG * 0.5;
  for (let sArc = 0; sArc <= s.L * 1.02; sArc += ds) {
    const t = sArc / s.L;
    let phi, adv;
    if (t < 0.24) { phi = 0.25 * Math.sin(t * 20); adv = 0.95; }
    else if (t < 0.8) { phi = 1.25 * Math.sin((t - 0.24) / 0.56 * TAU * 1.5); adv = 0.42; }
    else { phi = (t - 0.8) / 0.2 * TAU * 1.7; adv = 0.18; }
    xa -= ds * adv;
    const dir = up.clone().multiplyScalar(Math.cos(phi)).addScaledVector(side, Math.sin(phi));
    pts.push(P.b0.clone().addScaledVector(a, clamp(xa, 0.1, Lb)).addScaledVector(dir, rr));
    ups.push(dir);
  }
  const out = Array.from({ length: s.N }, () => new V3()), outU = Array.from({ length: s.N }, () => new V3());
  resamplePolyline(pts, s.SEG, s.N, out, ups, outU);
  return { pts: out, ups: outU, dir: a };
}

function* perch() {
  const s = S(), W = Wd(), P = W.cur.perch;
  if (!P) return;
  UI.info('树栖', '攀援与栖枝伏击', s.sp.notes.special);
  UI.stages(['来到竹竿下', '螺旋攀爬', '爬上横枝', '环绕搭挂', 'S 形伏击姿态', '下树']);
  try {
    UI.stage(0);
    const toS = new V3().subVectors(s.spine[0], P.stalk).setY(0).normalize();
    const base = P.stalk.clone().addScaledVector(toS, P.stalkR + s.R + 0.6);
    yield* forAtMost(25, moveTo(base, { arrive: s.L * 0.05 }));
    UI.stage(1);
    UI.caption('腹鳞的边缘勾住竹节，身体交替抓紧、伸展（类手风琴式攀爬）', 3.5);
    App.cam.set({ target: () => s.head.position, dist: Math.max(6, s.L * 0.6) });
    s.groundMode = 'free';
    const rc = P.stalkR + s.R * 0.95;
    const a0 = Math.atan2(s.spine[0].z - P.stalk.z, s.spine[0].x - P.stalk.x);
    const topY = P.b0.y + P.r + s.R * 0.9;
    const pts = [], ups = [];
    const ctrl = smoothPath([s.spine[0].clone(), P.stalk.clone().add(new V3(Math.cos(a0) * rc, s.hb[0], Math.sin(a0) * rc))], s.SEG * 0.5);
    for (const p of ctrl) { pts.push(p); ups.push(UP.clone()); }
    const pitch = 1.3, turns = (topY - P.stalk.y) / pitch;
    for (let th = 0.05; th <= turns * TAU; th += 0.05) {
      const a = a0 + th, y = P.stalk.y + s.hb[0] + th / TAU * pitch;
      const dir = new V3(Math.cos(a), 0, Math.sin(a));
      pts.push(P.stalk.clone().addScaledVector(dir, rc).setY(y)); ups.push(dir);
    }
    const ba = new V3().subVectors(P.b1, P.b0).normalize();
    for (let k = 0; k <= 30; k++) { const p = P.b0.clone().addScaledVector(ba, 0.4 + k / 30 * P.b0.distanceTo(P.b1) * 0.82); p.y += P.r + s.R * 0.9; pts.push(p); ups.push(UP.clone()); }
    const m = s.followPath(pts, { dense: true, ups, speed: 0.07 * s.L });
    let t = 0;
    while (!m.done) { t += yield; if (s.spine[0].y > topY - 0.3) UI.stage(2); }
    UI.stage(3);
    const dp = drapePose(s, P);
    const pm = s.setMotor({ type: 'pose', pts: dp.pts, ups: dp.ups, dur: 3 });
    while (!pm.done) yield;
    UI.caption('具缠绕性的尾巴牢牢勾住枝条，身体环绕搭挂在两侧', 3);
    UI.stage(4);
    const fwd = s.headDir(new V3());
    yield* sPosture(s.spine[0].clone().addScaledVector(fwd, 4).add(new V3(0, -1.5, 0)), { rise: 0.05, sAmp: 0.8, len: 0.22, headPitch: -0.3 });
    s.tail.len = 0.06; s.tail.rise = 0; s.tail.wig = 0.4; s.tail.wigF = 1.2; s.tail.tw = 0.6;
    yield* wait(6);
    s.tail.tw = 0;
    yield* frontTo({ sAmp: 0, rise: 0, headPitch: 0 }, 1); s.front.tw = 0;
    UI.stage(5);
    s.resetTrail();
    const back = [];
    for (let k = 30; k >= 0; k--) { const p = P.b0.clone().addScaledVector(ba, 0.4 + k / 30 * P.b0.distanceTo(P.b1) * 0.7); p.y += P.r + s.R * 0.9; back.push(p); }
    const aStart = Math.atan2(back[back.length - 1].z - P.stalk.z, back[back.length - 1].x - P.stalk.x);
    const bu = back.map(() => UP.clone());
    for (let th = 0.05; th <= turns * TAU; th += 0.05) { const a = aStart - th, dir = new V3(Math.cos(a), 0, Math.sin(a)); back.push(P.stalk.clone().addScaledVector(dir, rc).setY(topY - th / TAU * pitch)); bu.push(dir); }
    const away = back[back.length - 1].clone().add(new V3(-3, 0, 3)); away.y = W.heightAt(away.x, away.z) + s.hb[0];
    back.push(away); bu.push(UP.clone());
    const dense = smoothPath([s.spine[0].clone(), ...back], s.SEG * 0.5);
    const m2 = s.followPath(dense, { dense: true, speed: 0.08 * s.L });
    while (!m2.done) yield;
  } finally {
    s.groundMode = 'terrain'; s.tail.tw = 0;
    App.cam.set({ target: null, dist: null });
  }
}

// ---------------------------------------------------------------- 埋沙（角响尾蛇）
function* burrow() {
  const s = S(), W = Wd();
  UI.info('伏击', '埋沙伏击', s.sp.notes.special);
  UI.stages(['盘成浅圈', '左右扭动推沙', '只露出头顶与角', '伏击等待', '破沙而出']);
  UI.stage(0);
  yield* coilHere({ frac: 0.75 });
  yield* headRest(false, 0);
  UI.stage(1);
  const dust = () => { const i = (Math.random() * s.N) | 0; const p = s.spine[i]; W.dust.emit({ p: p.clone(), v: new V3(rand(-1.2, 1.2), rand(0.8, 2), rand(-1.2, 1.2)), c: 0xcdb58c, life: 1.2, size: rand(0.06, 0.14), grav: 4, alpha: 0.9 }); };
  yield* tween(3, k => { s.sink = k * (s.hb[s.N >> 1] * 2 + s.R * 0.3); s.shiver = 1; for (let n = 0; n < 3; n++) dust(); }, x => x);
  s.shiver = 0;
  UI.stage(2);
  UI.caption('几秒钟内便没入沙中，角状眶上鳞像遮阳板一样护住眼睛', 3.5);
  App.cam.set({ target: () => s.head.position, dist: Math.max(3, s.hd.hl * 7) });
  UI.stage(3);
  yield* wait(5);
  UI.stage(4);
  yield* tween(1.2, k => { s.sink = (1 - k) * (s.hb[s.N >> 1] * 2 + s.R * 0.3); for (let n = 0; n < 4; n++) dust(); });
  s.sink = 0;
  App.cam.set({ target: null, dist: null });
}

// ---------------------------------------------------------------- 繁殖
function makeEgg(r) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 18), new THREE.MeshPhysicalMaterial({ color: 0xf2ecde, roughness: 0.65, sheen: 0.6, sheenColor: new THREE.Color(0xffffff), clearcoat: 0.2 }));
  m.scale.set(0.8, 0.8, 1.15); m.castShadow = true; m.receiveShadow = true;
  m.userData.temp = 0.55;
  return m;
}

function* reproduce() {
  const s = S(), W = Wd(), sp = s.sp;
  const live = sp.repro === 'live';
  const [ti, tx] = live ? TXT.repro.live : TXT.repro.eggs;
  UI.info('繁殖', ti, tx + (sp.notes.repro ? '\n\n' + sp.notes.repro : ''));
  UI.stages(live ? ['求偶交配', '怀孕', '寻找隐蔽处', '产仔', '破膜而出', '母蛇陪伴', '幼蛇分散']
    : ['求偶交配', '怀孕', '寻找产卵地', '产卵', sp.repro === 'brood' ? '盘卵孵化' : sp.repro === 'guard' ? '守护卵窝' : '离开', '破壳孵化', '幼蛇分散']);
  const eggs = [];
  try {
    UI.stage(0);
    UI.caption('春季：雄蛇循着雌蛇留下的信息素踪迹找到她，用下颌摩擦其背部求偶，随后尾部缠绕交配', 4);
    s.tg.rate = 2.5;
    yield* wait(4);
    UI.stage(1);
    App.setTimeScale(1, '⏩ 延时 · 1 秒 ≈ 10 天');
    const g = { t: 0.62, w: 0.12, amp: 0 };
    s.bolus.push(g);
    UI.caption(live ? '胚胎在母体内发育，孕蛇常晒太阳为胚胎提供热量' : '卵在体内发育，腹部后段明显膨大', 3);
    yield* propTo(g, { amp: s.R * 0.35 }, 3);
    App.setTimeScale(1);
    UI.stage(2);
    if (!W.cur.water) {
      const nest = W.cur.spots.nest.clone();
      yield* forAtMost(20, moveTo(nest, { arrive: s.L * 0.1 }));
    }
    const cp = W.cur.water ? null : yield* coilHere({ frac: 0.72, rMin: Math.max(3.4 * s.R, 0.9) });
    yield* headRest(true, 0.3);
    UI.stage(3);
    const nBaby = live ? 5 : 4;
    const clutch = live ? nBaby : Math.max(nBaby, sp.clutch);
    const bs = sp.babyScale;
    const eggR = Math.max(0.16, s.L * bs * 0.075);
    const ventP = () => s.spine[s.iVent].clone();
    const pile = cp ? cp.center.clone() : s.center(new V3());
    pile.y = W.heightAt(pile.x, pile.z);
    const babies = [];
    for (let k = 0; k < clutch; k++) {
      const vp = ventP();
      const a = k * 2.4, rr = Math.sqrt(k / clutch) * (cp ? cp.rMin * 0.55 : 1);
      const dst = pile.clone().add(new V3(Math.cos(a) * rr, eggR * 0.8 + (k > clutch * 0.6 ? eggR * 1.2 : 0), Math.sin(a) * rr));
      g.amp = s.R * 0.35 * (1 - k / clutch);
      if (!live) {
        const e = makeEgg(eggR); e.position.copy(vp); e.rotation.y = rand(0, 3);
        W.extras.add(e); App.applyThermal(e); eggs.push(e);
        yield* tween(0.7, t => e.position.lerpVectors(vp, dst, t));
      } else if (k < nBaby) {
        const b = new Snake(sp, { world: W, scale: bs, baby: true, N: 72 });
        App.scene.add(b.group); App.applyThermal(b.group); App.babies.push(b); babies.push(b);
        const sp2 = 2 * b.R * 1.15, r0 = Math.sqrt(b.L * 0.85 * sp2 / Math.PI + (2.4 * b.R) ** 2);
        const outw = new V3().subVectors(vp, pile).setY(0); if (outw.lengthSq() < 1e-4) outw.set(1, 0, 0);
        outw.normalize().applyAxisAngle(UP, (k - 2) * 0.45);
        const c = W.cur.water ? vp.clone() : vp.clone().addScaledVector(outw, r0 * 1.6 + s.R * 2 + k * b.R);
        if (!W.cur.water) c.y = W.heightAt(c.x, c.z);
        const pts = [];
        for (let th = 0; ; th += 0.05) { const r = r0 - sp2 * th / TAU; if (r < 2.4 * b.R) break; pts.push(new V3(c.x + Math.cos(k + th) * r, c.y + b.hb[30], c.z + Math.sin(k + th) * r)); }
        b.groundMode = W.cur.water ? 'free' : 'terrain';
        b.placeOnPolyline(pts.reverse());
        b.tg.auto = false;
        const sac = new THREE.Mesh(new THREE.SphereGeometry(r0 + b.R * 1.5, 24, 16), new THREE.MeshPhysicalMaterial({ color: 0xf8e8e0, transparent: true, opacity: 0.45, roughness: 0.15, clearcoat: 1, depthWrite: false }));
        sac.scale.y = 0.45; sac.position.copy(c).setY(c.y + b.R); W.extras.add(sac); eggs.push(sac);
        b.sac = sac;
        yield* wait(1.2);
      }
    }
    s.bolus.splice(s.bolus.indexOf(g), 1);
    UI.stage(4);
    if (!live) {
      if (sp.repro === 'brood') {
        UI.caption('雌蟒盘绕卵堆，肌肉有节律地“颤抖”产热，使卵温维持在约 31 °C', 4);
        s.shiver = 1; App.vitalsT.met = 6; App.vitalsT.temp = 31;
        App.setTimeScale(1, '⏩ 延时 · 1 秒 ≈ 6 天');
        for (let d = 10; d <= 60; d += 10) { UI.caption(`第 ${d} 天 · 颤抖产热中（此期间雌蟒不进食）`, 1.4); yield* wait(1.6); }
        s.shiver = 0; App.vitalsT.met = 1; App.vitalsT.temp = null;
      } else if (sp.repro === 'guard') {
        UI.caption('雌蛇留在卵窝附近守护，驱赶靠近的动物', 3);
        App.setTimeScale(1, '⏩ 延时 · 1 秒 ≈ 6 天');
        frontSet({ len: 0.18, rise: 0.4, r1: 0.2, r2: 0.6, r3: 0.95, sAmp: 0.6, headPitch: -0.1, aim: camThreat(), reach: 0, yawBias: 0 }); s.front.tw = 1;
        if (sp.hood) yield* propTo(s, { hood: 0.6 }, 1);
        yield* wait(6);
        yield* propTo(s, { hood: 0 }, 0.8); s.front.tw = 0;
      } else {
        UI.caption('产卵后雌蛇离开，卵依靠环境温度孵化', 3);
        yield* headRest(false, 0);
        s.resetTrail();
        const psi = s.heading();
        yield* forAtMost(8, moveTo(s.spine[0].clone().add(new V3(Math.sin(psi) * s.L, 0, Math.cos(psi) * s.L))));
        s.stop();
        App.setTimeScale(1, '⏩ 延时 · 1 秒 ≈ 10 天');
        yield* wait(5);
      }
      App.setTimeScale(1);
      UI.stage(5);
      App.cam.set({ target: pile.clone(), dist: Math.max(3, eggR * 22) });
      UI.caption('幼蛇用吻端的“卵齿”划开卵壳，常先探出头停留许久才爬出', 4);
      for (let k = 0; k < eggs.length; k++) {
        const e = eggs[k];
        e.material = e.material.clone(); e.material.color.set(0xe0d6c0);
        e.scale.y *= 0.82;
        if (k >= nBaby) continue;
        const b = new Snake(sp, { world: W, scale: bs, baby: true, N: 72 });
        App.scene.add(b.group); App.applyThermal(b.group); App.babies.push(b); babies.push(b);
        // 体内“缠成一团”的初始轨迹：在卵内随机游走，爬出时身体随头部从卵中拉出
        const c = e.position.clone(), pts = [];
        const a = rand(0, TAU), outDir = new V3(Math.cos(a), 0, Math.sin(a));
        let p = c.clone().addScaledVector(outDir, eggR * 0.85);
        const dir = outDir.clone().negate();
        const rin = Math.max(0.02, eggR * 0.9 - b.R);
        for (let n = 0; n < 400; n++) {
          pts.push(p.clone());
          dir.add(new V3(rand(-0.9, 0.9), rand(-0.5, 0.5), rand(-0.9, 0.9))).normalize();
          const np = p.clone().addScaledVector(dir, b.SEG * 0.8);
          if (np.distanceTo(c) > rin) { dir.subVectors(c, p).normalize(); np.copy(p).addScaledVector(dir, b.SEG * 0.8); }
          p = np;
        }
        b.groundMode = 'free'; b.clampGround = false;
        b.placeOnPolyline(pts);
        b.tg.auto = false;
        b.egg = e; b.outDir = outDir;
      }
    } else {
      UI.caption('仔蛇出生时包裹在透明胎膜中，片刻后破膜而出', 3);
      yield* wait(1);
    }
    // 幼蛇爬出/破膜
    for (const b of babies) {
      if (b.sac) { yield* propTo(b.sac.material, { opacity: 0 }, 0.6); }
      else {
        const tgt = b.egg.position.clone().addScaledVector(b.outDir, eggR * 2 + b.hd.hl);
        tgt.y = W.heightAt(tgt.x, tgt.z) + b.hb[0];
        b.followPath([tgt], { speed: 0.03 * b.L });
      }
      yield* wait(0.8);
    }
    yield* wait(1.5);
    UI.stage(5);
    if (live) {
      UI.caption(sp.id === 'rattlesnake' ? '母蛇与仔蛇一起停留约 10 天，直到它们第一次蜕皮' : '仔蛇一出生就能独立生活', 3.5);
      yield* wait(2.5);
    }
    UI.stage(6);
    for (const b of babies) {
      b.groundMode = W.cur.water ? 'free' : 'terrain'; b.clampGround = true;
      const a = rand(0, TAU);
      const far = b.spine[0].clone().add(new V3(Math.cos(a) * 30, W.cur.water ? rand(-2, 3) : 0, Math.sin(a) * 30));
      if (W.cur.water) b.setMotor({ type: 'swim', target: far, speed: 1 });
      else b.setMotor({ type: 'crawl', gait: 'serpentine', target: far, speed: 0.8 + Math.random() * 0.4 });
      b.tg.auto = true;
    }
    App.cam.set({ target: null, dist: Math.max(10, s.L * 0.9) });
    UI.caption('幼蛇各自分散，独立开始生活', 3);
    yield* wait(6);
    yield* headRest(false, 0.5);
  } finally {
    App.clearBabies();
    for (const e of eggs) { e.parent?.remove(e); e.geometry.dispose(); }
    s.bolus.length = 0;
    s.shiver = 0; s.hood = 0; s.front.tw = 0;
    App.setTimeScale(1);
    App.vitalsT.met = 1; App.vitalsT.temp = null;
    App.cam.set({ target: null, dist: null });
  }
}

// ---------------------------------------------------------------- 游走 & 自动生活
function* roam(dur = Infinity) {
  const s = S();
  UI.stages(null);
  const g = App.gait;
  if (g === 'idle') { s.stop(); } else setGaitMotor(g, {});
  let t = 0, next = rand(8, 14);
  while (t < dur) {
    const dt = yield; t += dt; next -= dt;
    if (next <= 0 && g !== 'idle' && !Wd().cur.water && g !== 'sidewind') {
      next = rand(10, 18);
      s.stop();
      UI.state('停下吐信、观察');
      s.tg.rate = 2.5;
      s.look.ty = rand(-0.5, 0.5); s.look.tp = rand(0, 0.2);
      yield* wait(1.4);
      s.look.ty = -s.look.ty;
      yield* wait(1.2);
      s.look.ty = s.look.tp = 0; s.tg.rate = 1;
      setGaitMotor(g, {});
      UI.state(null);
    }
  }
}

function* autoLife() {
  const sp = S().sp;
  const seq = [
    ['游走', () => roam(12)], ['捕食', feed], ['游走', () => roam(10)], ['晒太阳', bask], ['防御', defend], ['游走', () => roam(8)],
    ['蜕皮', shed], ['游走', () => roam(8)],
  ];
  if (sp.special === 'perch') seq.push(['树栖', perch]);
  if (sp.special === 'burrow') seq.push(['埋沙', burrow]);
  if (sp.special === 'breathe') seq.push(['换气', breathe]);
  seq.push(['繁殖', reproduce], ['游走', () => roam(8)], ['冬眠', hibernate]);
  while (true) {
    for (const [name, fn] of seq) {
      UI.autoStep(name);
      relaxSnake();
      yield* fn();
      relaxSnake();
    }
  }
}

const ACTIVITIES = { tongue: tongueDemo, feed, defend, bask, shed, hibernate, reproduce, perch, burrow, breathe, auto: autoLife };
