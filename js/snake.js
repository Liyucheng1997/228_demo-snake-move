'use strict';
// ============================================================
//  snake.js — 蛇的几何、运动学与解剖
//  · 身体：沿脊柱放样的可变形管（截面为“上椭圆+扁平腹”的超椭圆，可叠加兜帽/桨尾/食团/呼吸等形变）
//  · 头部：上颌与下颌分别放样，含口腔内壁、眼（虹膜+可缩放瞳孔+透明眼罩鳞）、鼻孔、颊窝/唇窝、牙齿/毒牙、舌
//  · 运动：跟随头部轨迹（蜿蜒/直行/游泳/路径）、侧进与手风琴式为直接生成；姿态混合；颈部与尾部叠加层
// ============================================================
const _a = new V3(), _b = new V3(), _c = new V3(), _d = new V3(), _e = new V3();
const _q1 = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _m4 = new THREE.Matrix4();
const _eul = new THREE.Euler();

const HEAD_TYPES = {
  viper: { w: curve([[0, .9], [.12, 1], [.3, .93], [.6, .7], [.85, .5], [1, .44]]), t: curve([[0, .78], [.3, .95], [.58, 1], [.8, .8], [1, .55]]), b: curve([[0, 1], [.25, .85], [.7, .55], [1, .36]]) },
  python: { w: curve([[0, .88], [.15, 1], [.5, .82], [.85, .6], [1, .52]]), t: curve([[0, .84], [.4, 1], [.65, .95], [.9, .72], [1, .58]]), b: curve([[0, 1], [.4, .8], [1, .42]]) },
  elapid: { w: curve([[0, .95], [.25, 1], [.55, .86], [.85, .64], [1, .52]]), t: curve([[0, .9], [.45, 1], [.8, .86], [1, .62]]), b: curve([[0, 1], [.5, .75], [1, .42]]) },
  colubrid: { w: curve([[0, .92], [.2, 1], [.55, .8], [.85, .6], [1, .5]]), t: curve([[0, .88], [.5, 1], [.85, .78], [1, .56]]), b: curve([[0, 1], [.5, .72], [1, .4]]) },
};

const ORGANS = [
  { n: '气管', f0: 0.0, f1: 0.2, r: 0.15, ox: 0, oy: 0.45, col: 0xe9dccb },
  { n: '食道', f0: 0.0, f1: 0.44, r: 0.2, ox: 0.05, oy: 0.05, col: 0xd49a86, nolabel: 1 },
  { n: '心脏', f0: 0.21, f1: 0.26, r: 0.55, ox: 0, oy: -0.2, col: 0xb3202a, key: 'heart' },
  { n: '右肺', f0: 0.25, f1: 0.5, r: 0.44, ox: -0.14, oy: 0.3, col: 0xeda3b0 },
  { n: '后肺气囊', f0: 0.5, f1: 0.7, r: 0.4, ox: -0.1, oy: 0.32, col: 0xf6dfe4, op: 0.45, key: 'sac' },
  { n: '左肺（退化）', f0: 0.26, f1: 0.3, r: 0.22, ox: 0.3, oy: 0.26, col: 0xe89aa8, key: 'llung' },
  { n: '肝脏', f0: 0.3, f1: 0.52, r: 0.5, ox: 0.14, oy: -0.08, col: 0x6e2a22 },
  { n: '胃', f0: 0.51, f1: 0.64, r: 0.5, ox: -0.02, oy: -0.12, col: 0xc98a5e, key: 'stomach' },
  { n: '胆囊/胰/脾', f0: 0.645, f1: 0.675, r: 0.3, ox: 0.24, oy: 0.0, col: 0x3a8a50 },
  { n: '小肠', f0: 0.67, f1: 0.88, r: 0.28, ox: 0, oy: -0.1, col: 0xe2b474, coil: 1, key: 'gut' },
  { n: '性腺', f0: 0.72, f1: 0.78, r: 0.2, ox: 0.32, oy: 0.22, col: 0xf0e6c8 },
  { n: '右肾', f0: 0.8, f1: 0.88, r: 0.24, ox: -0.34, oy: 0.3, col: 0x7a3a2a },
  { n: '左肾', f0: 0.85, f1: 0.93, r: 0.24, ox: 0.34, oy: 0.3, col: 0x7a3a2a, nolabel: 1 },
  { n: '脂肪体', f0: 0.66, f1: 0.9, r: 0.24, ox: 0, oy: -0.52, col: 0xf2d98a, key: 'fat' },
  { n: '大肠', f0: 0.88, f1: 0.98, r: 0.32, ox: 0, oy: -0.1, col: 0xa87550 },
  { n: '泄殖腔', f0: 0.98, f1: 1.03, r: 0.36, ox: 0, oy: -0.25, col: 0x8a6d3b },
];

// ---------------------------------------------------------------- 头部形状（独立函数，生成头部贴图时也会用到）
function headDims(sp, scale = 1) {
  const H = sp.head;
  const hd = { hl: H.len * scale, hw: H.w * scale, top: H.top * scale, bot: H.bot * scale };
  hd.mouthY = (hd.bot - hd.top) / 2;
  hd.zh = hd.hl * 0.04;
  hd.rn = sp.radius * scale * sp.profile(0);
  hd.lip = hd.hw * 0.035; hd.th = hd.hw * 0.14;
  hd.depth = hd.bot - hd.mouthY;
  return hd;
}
const HZ0 = -0.32; // 头部放样起点（伸入颈部，平滑过渡）
function headSection(sp, hd, z, upper) {
  const T = HEAD_TYPES[sp.head.type];
  const q = smoothstep(HZ0, 0.1, z), zc = clamp(z, 0, 1);
  const zt = upper ? 0.8 : 0.76, zend = upper ? 1 : 0.96;
  let k = 1;
  if (z > zt) k = Math.sqrt(Math.max(0, 1 - Math.pow((z - zt) / (zend - zt), 2)));
  const rn = hd.rn;
  const w = lerp(rn, hd.hw * T.w(zc), q) * k;
  const t = lerp(rn - hd.mouthY, hd.top * T.t(zc), q) * Math.pow(k, 0.6);
  const b = lerp(rn * sp.section.belly + hd.mouthY, hd.bot * T.b(zc), q) * Math.pow(k, 0.8);
  return { w, t, b };
}
function upperPoint(sp, hd, z, phi, out) {
  const H = sp.head;
  const { w, t } = headSection(sp, hd, z, true);
  const nU = 2 / (H.nU || 2.3);
  const c = Math.cos(phi), s = Math.max(0, Math.sin(phi));
  let x = w * sgnPow(c, nU), y = hd.mouthY - hd.lip + (t + hd.lip) * Math.pow(s, nU);
  if (H.brow) {
    const bz = H.brow * Math.exp(-Math.pow((z - H.eyeZ) / 0.14, 2));
    const bump = Math.exp(-Math.pow((phi - 0.72) / 0.24, 2)) + Math.exp(-Math.pow((Math.PI - phi - 0.72) / 0.24, 2));
    x += Math.sign(c) * bz * bump * hd.hw * 0.05;
    y += bz * bump * hd.top * 0.08;
  }
  return out.set(x, y, z * hd.hl);
}
// 以弧长归一化的环向 UV，使鳞片在头部各处大小一致
function ringArcU(pt, M) {
  const P = []; for (let j = 0; j <= M; j++) P.push(pt(j));
  const cum = [0]; for (let j = 1; j <= M; j++) cum.push(cum[j - 1] + P[j].distanceTo(P[j - 1]));
  const L = cum[M] || 1; return cum.map(c => c / L);
}
function eyeHX(sp) {
  const hd = headDims(sp), M = 120, H = sp.head;
  const us = ringArcU(j => upperPoint(sp, hd, H.eyeZ, Math.PI * j / M, new V3()), M);
  const f = H.eyePhi / Math.PI * M, j0 = Math.floor(f);
  const u = lerp(us[j0], us[j0 + 1], f - j0);
  return 1 - 2 * u;
}

class Snake {
  constructor(sp, opt = {}) {
    this.sp = sp;
    this.world = opt.world;
    this.scale = opt.scale || 1;
    this.isBaby = !!opt.baby;
    this.L = sp.length * this.scale;
    this.R = sp.radius * this.scale;
    this.N = opt.N || sp.N || 240;
    this.M = this.isBaby ? 16 : 32;
    this.SEG = this.L / (this.N - 1);
    const N = this.N;
    this.spine = Array.from({ length: N }, () => new V3());
    this.upH = Array.from({ length: N }, () => new V3(0, 1, 0));
    this.T = Array.from({ length: N }, () => new V3());
    this.X = Array.from({ length: N }, () => new V3());
    this.Y = Array.from({ length: N }, () => new V3());
    this.ww = new Float32Array(N); this.hh = new Float32Array(N); this.curl = new Float32Array(N);
    this.hb = new Float32Array(N); this.base = new Float32Array(N); this.lockW = new Float32Array(N);
    for (let i = 0; i < N; i++) this.base[i] = this.R * sp.profile(i / (N - 1));
    this.iVent = Math.round(sp.vent * (N - 1));

    // 可动画状态
    Object.assign(this, {
      time: Math.random() * 100, hood: 0, flatten: 0, puff: 0, breath: 0, breathAmp: 1, breathRate: 0.22, shiver: 0,
      ventralWave: 0, gape: 0, jawWalk: 0, headStretch: 0, fangErect: 0, glottis: 0, sink: 0, dull: 0, eyeCloud: 0,
      pupil: 0.25, rattleOn: 0, allowUnder: 0, iridBoost: 0, heartSize: 1, gutSize: 1, fatSize: 1, vomero: 0, speedMul: 1,
    });
    this.bolus = [];
    this.look = { yaw: 0, pitch: 0, roll: 0, ty: 0, tp: 0, tr: 0 };
    this.front = { w: 0, tw: 0, len: 0.28, rise: 0, r1: 0.2, r2: 0.5, r3: 0.9, sAmp: 0, sFreq: 1.2, headPitch: 0, sway: 0, aim: null, reach: 0, yawBias: 0 };
    this.tail = { w: 0, tw: 0, len: 0.14, rise: 0, wig: 0, wigF: 3, vib: 0, curlYaw: 0 };
    this.groundMode = 'terrain';
    this.clampGround = true;
    this.motor = { type: 'idle' };
    this.trail = [];
    this.headPos = new V3(); this.headUp = new V3(0, 1, 0); this.headAim = null;
    this.tg = { active: false, t: 0, dur: 0.8, cycles: 3, auto: true, next: 1.5, rate: 1, ext: 0, osc: 0, spread: 0 };
    this.group = new THREE.Group();
    this.view = 'skin';
    this.skin = getSkin(sp);
    this._buildBody();
    this._buildHead();
    this._buildExtras();
  }

  // ================================================================ 构建：身体
  _buildBody() {
    const { N, M, sp } = this;
    const sc = sp.scales;
    const geo = new THREE.BufferGeometry();
    const vc = N * (M + 1);
    this.pos = new Float32Array(vc * 3);
    const uv = new Float32Array(vc * 2);
    const idx = [];
    for (let i = 0; i < N - 1; i++) for (let j = 0; j < M; j++) {
      const a = i * (M + 1) + j, b = a + M + 1, c = a + 1, d = b + 1;
      idx.push(a, d, b, a, c, d);
    }
    for (let i = 0; i < N; i++) for (let j = 0; j <= M; j++) {
      const k = (i * (M + 1) + j) * 2;
      uv[k] = j / M; uv[k + 1] = i / (N - 1);
    }
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(vc * 3), 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setIndex(idx);
    this.cj = []; this.sj = [];
    for (let j = 0; j <= M; j++) { const th = -Math.PI / 2 + TAU * j / M; this.cj.push(Math.cos(th)); this.sj.push(Math.sin(th)); }

    this.skinMat = new THREE.MeshPhysicalMaterial({
      map: this.skin.map, normalMap: this.skin.normal, roughnessMap: this.skin.rough, roughness: 1, metalness: 0,
      normalScale: new THREE.Vector2(1, 1),
      clearcoat: sc.clearcoat, clearcoatRoughness: 0.28,
      iridescence: sc.irid, iridescenceIOR: 1.5, iridescenceThicknessRange: [260, 420],
      sheen: 0.15, sheenRoughness: 0.5, sheenColor: new THREE.Color(0xffffff),
      envMapIntensity: 0.9,
    });
    this.bodyGeo = geo;
    this.body = new THREE.Mesh(geo, this.skinMat);
    this.body.castShadow = true; this.body.receiveShadow = true; this.body.frustumCulled = false;
    this.group.add(this.body);
  }

  // ================================================================ 构建：头部
  _headSection(z, upper) { return headSection(this.sp, this.hd, z, upper); }
  _upperPoint(z, phi, out) { return upperPoint(this.sp, this.hd, z, phi, out); }

  _buildJawGeo(upper) {
    const hd = this.hd;
    const NZ = this.isBaby ? 20 : 50, NN = this.isBaby ? 4 : 8, M = this.isBaby ? 14 : 32, K = 10;
    const ZS = -0.03;                  // 此前为“颈部段”：直接使用身体材质与身体 UV，保证与躯干无缝衔接
    const ring = M + 1 + K + 1;
    const nL = 2 / 2.4;
    const zEnd = upper ? 1 : 0.96;
    const pos = [], uv = [], neckFlag = [];
    const p = new V3();
    const zs = [];
    for (let i = 0; i <= NN; i++) zs.push([HZ0 + (ZS - HZ0) * i / NN, true]);
    for (let i = 0; i <= NZ; i++) zs.push([ZS + (zEnd - ZS) * (1 - Math.pow(1 - i / NZ, 1.35)), false]);
    for (const [z, neck] of zs) {
      neckFlag.push(neck);
      const { w, t, b } = this._headSection(z, upper);
      const vv = neck ? Math.max(0, -z * hd.hl / this.L) : (z - HZ0) / (1 - HZ0);
      const pt = upper
        ? (j => this._upperPoint(z, Math.PI * j / M, new V3()).sub(new V3(0, hd.mouthY, hd.zh)))
        : (j => { const phi = Math.PI + Math.PI * j / M, c = Math.cos(phi), s = Math.sin(phi); return new V3(w * 0.9 * sgnPow(c, nL), -b * Math.pow(Math.max(0, -s), nL), z * hd.hl - hd.zh); });
      const us = ringArcU(pt, M);
      for (let j = 0; j <= M; j++) {
        const q = pt(j); pos.push(q.x, q.y, q.z);
        uv.push(neck ? (upper ? 0.75 : 0.25) - 0.5 * us[j] : us[j], vv);
      }
      for (let k = 0; k <= K; k++) {
        if (upper) {
          const fx = -1 + 2 * k / K, wi = Math.max(0, w - hd.th);
          pos.push(fx * wi, t * 0.18 * (1 - fx * fx) + hd.lip * 0.2, z * hd.hl - hd.zh);
        } else {
          const fx = 1 - 2 * k / K, wi = Math.max(0, w * 0.9 - hd.th);
          pos.push(fx * wi, -hd.lip * 0.5 - b * 0.22 * (1 - fx * fx), z * hd.hl - hd.zh);
        }
        uv.push(0, 0);
      }
    }
    const skinIdx = [], mouthIdx = [], neckIdx = [];
    for (let i = 0; i < zs.length - 1; i++) {
      if (neckFlag[i] !== neckFlag[i + 1]) continue;   // 两段在分界处各自独立（重复一圈顶点）
      for (let a = 0; a < ring; a++) {
        const b2 = (a + 1) % ring;
        const v00 = i * ring + a, v01 = i * ring + b2, v10 = (i + 1) * ring + a, v11 = (i + 1) * ring + b2;
        const arr = a < M ? (neckFlag[i] ? neckIdx : skinIdx) : mouthIdx;
        arr.push(v00, v11, v10, v00, v01, v11);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(skinIdx.concat(mouthIdx, neckIdx));
    geo.addGroup(0, skinIdx.length, 0);
    geo.addGroup(skinIdx.length, mouthIdx.length, 1);
    geo.addGroup(skinIdx.length + mouthIdx.length, neckIdx.length, 2);
    geo.computeVertexNormals();
    return geo;
  }

  _buildHead() {
    const sp = this.sp, H = sp.head, s = this.scale, sc = sp.scales;
    const hd = this.hd = headDims(sp, s);

    const head = this.head = new THREE.Group();
    const upper = this.upper = new THREE.Group();
    const lower = this.lower = new THREE.Group();
    upper.position.set(0, hd.mouthY, hd.zh);
    lower.position.set(0, hd.mouthY, hd.zh);
    head.add(upper, lower);
    this.group.add(head);

    const mk = tex => new THREE.MeshPhysicalMaterial({
      map: tex.map, normalMap: tex.normal, roughness: sc.rough * 0.9, metalness: 0,
      clearcoat: sc.clearcoat, clearcoatRoughness: 0.25, iridescence: sc.irid * 0.8, iridescenceIOR: 1.8,
      iridescenceThicknessRange: [180, 520], envMapIntensity: 0.9,
    });
    this.headMat = mk(this.skin.upper);
    this.jawMat = mk(this.skin.lower);
    this.mouthMat = new THREE.MeshPhysicalMaterial({ color: sp.mouth, roughness: 0.38, clearcoat: 0.6, side: THREE.DoubleSide });
    this.upperMesh = new THREE.Mesh(this._buildJawGeo(true), [this.headMat, this.mouthMat, this.skinMat]);
    this.lowerMesh = new THREE.Mesh(this._buildJawGeo(false), [this.jawMat, this.mouthMat, this.skinMat]);
    for (const m of [this.upperMesh, this.lowerMesh]) { m.castShadow = true; m.receiveShadow = true; }
    upper.add(this.upperMesh); lower.add(this.lowerMesh);
    this.skinMats = [this.skinMat, this.headMat, this.jawMat];

    const toU = v => v.set(v.x, v.y - hd.mouthY, v.z - hd.zh); // 头部坐标 → 上颌组坐标
    const dark = new THREE.MeshStandardMaterial({ color: 0x0b0806, roughness: 0.6 });

    // ---- 眼 ----
    const eyeR = H.eyeR * s;
    const irisMat = new THREE.MeshPhysicalMaterial({ map: this.skin.iris, roughness: 0.45, clearcoat: 1, clearcoatRoughness: 0.06, envMapIntensity: 0.45 });
    const pupilMat = new THREE.MeshPhysicalMaterial({ color: 0x020202, roughness: 0.1, clearcoat: 1 });
    this.specMat = new THREE.MeshPhysicalMaterial({ color: 0x000000, roughness: 0.03, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.02, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, envMapIntensity: 0.8 });
    this.cloudMat = new THREE.MeshPhysicalMaterial({ color: 0x9fb6cc, roughness: 0.5, transparent: true, opacity: 0, depthWrite: false });
    const ringCol = mulC(sp.headCol(0.62, H.eyeZ, sp._eye), 0.8);
    const ringMat = new THREE.MeshStandardMaterial({ color: toHex(ringCol), roughness: 0.5 });
    this.pupils = [];
    const eyeGeo = new THREE.SphereGeometry(eyeR, 28, 20);
    for (const side of [1, -1]) {
      const p = this._upperPoint(H.eyeZ, H.eyePhi, new V3());
      p.x *= side;
      const n = new V3(Math.cos(H.eyePhi) * side, Math.sin(H.eyePhi) * 0.7, 0.28).normalize();
      const center = p.clone().addScaledVector(n, -eyeR * 0.5);
      const d = n.clone().add(new V3(0, 0.05, 0.18)).normalize();
      toU(center);
      const ball = new THREE.Mesh(eyeGeo, irisMat);
      ball.position.copy(center);
      ball.quaternion.setFromUnitVectors(new V3(0, 1, 0), d);
      upper.add(ball);
      const yA = new V3(0, 1, 0).addScaledVector(d, -d.y).normalize();
      const xA = new V3().crossVectors(yA, d);
      const pg = new THREE.Group();
      pg.position.copy(center);
      pg.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(xA, yA, d));
      upper.add(pg);
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(eyeR, 20, 14), pupilMat);
      pupil.position.z = eyeR * 0.93;
      pg.add(pupil);
      this.pupils.push(pupil);
      const cloud = new THREE.Mesh(new THREE.SphereGeometry(eyeR * 1.09, 20, 14), this.cloudMat);
      cloud.position.copy(center); upper.add(cloud);
      if (!this.isBaby) {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(eyeR * 1.02, eyeR * 0.17, 8, 28), ringMat);
        ring.position.z = eyeR * 0.3;
        pg.add(ring);
      }
    }

    if (this.isBaby) { this._buildTongue(); return; }

    // ---- 鼻孔 ----
    const nosR = hd.hw * 0.05;
    const sunk = (z, phi, r, sx, sy, depth = 0.55) => {
      for (const side of [1, -1]) {
        const p = this._upperPoint(z, phi, new V3()); p.x *= side;
        const n = new V3(Math.cos(phi) * side, Math.sin(phi), 0.15).normalize();
        p.addScaledVector(n, -r * depth); toU(p);
        const m = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 8), dark);
        m.scale.set(sx, sy, 1); m.position.copy(p); m.quaternion.setFromUnitVectors(new V3(0, 0, 1), n); upper.add(m);
      }
    };
    sunk(0.91, H.nostrilPhi, nosR, 0.8, 1.1);
    // ---- 颊窝（蝮亚科） ----
    if (H.lorealPit) sunk(0.79, H.eyePhi * 0.5, hd.hw * 0.07, 0.8, 1.0, 0.6);
    // ---- 唇窝（蟒） ----
    if (H.labialPits) for (const z of [0.5, 0.6, 0.7, 0.8, 0.88]) sunk(z, 0.1, hd.hw * 0.045, 0.55, 1.3, 0.6);
    // ---- 角（角响尾蛇的眶上鳞角） ----
    if (H.horns) {
      const hornMat = this.headMat.clone(); hornMat.map = null; hornMat.normalMap = null; hornMat.color = new THREE.Color(0xc9b28a);
      for (const side of [1, -1]) {
        const p = this._upperPoint(H.eyeZ - 0.02, 1.05, new V3()); p.x *= side; toU(p);
        const horn = new THREE.Mesh(new THREE.ConeGeometry(eyeR * 0.75, eyeR * 2.6, 12), hornMat);
        horn.position.copy(p); horn.position.y += eyeR * 0.9;
        horn.rotation.set(-0.45, 0, -side * 0.35);
        horn.castShadow = true;
        upper.add(horn);
      }
    }

    this._buildTeeth();
    this._buildTongue();
    this._buildHeadAnatomy();
  }

  _buildTeeth() {
    const sp = this.sp, hd = this.hd;
    const toothMat = new THREE.MeshStandardMaterial({ color: 0xf4eee0, roughness: 0.35 });
    const teeth = (z0, z1, n, inset, len, upper, rake) => {
      const g = new THREE.ConeGeometry(len * 0.22, len, 6);
      g.rotateX(Math.PI); g.translate(0, -len / 2, 0);
      const im = new THREE.InstancedMesh(g, toothMat, n * 2);
      const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
      let k = 0;
      for (const side of [1, -1]) for (let i = 0; i < n; i++) {
        const z = lerp(z0, z1, i / (n - 1));
        const { w } = this._headSection(z, upper);
        const x = side * Math.max(0, (upper ? w : w * 0.9) - hd.th * inset);
        const y = upper ? hd.lip * 0.1 : -hd.lip * 0.3;
        e.set(upper ? rake : Math.PI - rake, 0, 0);
        q.setFromEuler(e);
        m.compose(new V3(x, y, z * hd.hl - hd.zh), q, new V3(1, 1, 1));
        im.setMatrixAt(k++, m);
      }
      (upper ? this.upper : this.lower).add(im);
    };
    const tl = hd.hw * 0.12;
    if (sp.fangs === 'aglyph') {
      teeth(0.3, 0.93, 14, 1.2, tl, true, 0.5);
      teeth(0.35, 0.85, 10, 3.2, tl * 0.8, true, 0.5);
      teeth(0.25, 0.9, 14, 1.4, tl, false, 0.5);
    } else {
      teeth(0.3, 0.7, 6, 1.4, tl * 0.6, true, 0.4);
      teeth(0.25, 0.85, 10, 1.4, tl * 0.7, false, 0.4);
    }
    // 毒牙
    this.fangPivots = [];
    if (sp.fangs === 'solenoglyph' || sp.fangs === 'proteroglyph') {
      const hinged = sp.fangs === 'solenoglyph';
      const len = hinged ? hd.bot * 1.05 : hd.bot * 0.42;
      const g = new THREE.ConeGeometry(len * 0.12, len, 10, 4);
      g.rotateX(Math.PI);
      // 略向后弯曲
      const pa = g.attributes.position;
      for (let i = 0; i < pa.count; i++) { const y = pa.getY(i); pa.setZ(i, pa.getZ(i) - Math.pow((len / 2 - y) / len, 2) * len * 0.25); }
      g.translate(0, -len / 2, 0); g.computeVertexNormals();
      const fangMat = new THREE.MeshPhysicalMaterial({ color: 0xfbf8ee, roughness: 0.15, clearcoat: 1 });
      for (const side of [1, -1]) {
        const z = 0.84, { w } = this._headSection(z, true);
        const piv = new THREE.Group();
        piv.position.set(side * (w - hd.th * 1.3), hd.lip * 0.5, z * hd.hl - hd.zh);
        const f = new THREE.Mesh(g, fangMat);
        piv.add(f);
        this.upper.add(piv);
        this.fangPivots.push(piv);
      }
      this.fangHinged = hinged;
    }
    // 声门（吞咽时伸出以保持呼吸）
    const gl = new THREE.Mesh(new THREE.CylinderGeometry(hd.hw * 0.07, hd.hw * 0.09, hd.hl * 0.18, 10, 1, true), new THREE.MeshStandardMaterial({ color: 0xd07f7f, roughness: 0.5, side: THREE.DoubleSide }));
    gl.rotation.x = Math.PI / 2;
    gl.position.set(0, -hd.lip * 0.2, 0.62 * hd.hl - hd.zh);
    this.glottisMesh = gl;
    this.lower.add(gl);
  }

  _buildTongue() {
    const hd = this.hd;
    this.tongue = new TongueMesh(hd.hl * 0.95, hd.hw * 0.055, this.sp.tongue);
    this.tongue.exit.set(0, -hd.lip * 0.6, hd.hl * 0.985 - hd.zh);
    this.upper.add(this.tongue.mesh);
  }

  // 头骨、毒腺、犁鼻器（透视视图可见）
  _buildHeadAnatomy() {
    const hd = this.hd, sp = this.sp, H = sp.head;
    const bone = new THREE.MeshStandardMaterial({ color: 0xeee6d4, roughness: 0.55 });
    const skull = this.skull = new THREE.Group();
    const box = (sx, sy, sz, x, y, z, rx = 0, ry = 0, parent = skull) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), bone);
      m.position.set(x, y, z); m.rotation.set(rx, ry, 0); parent.add(m); return m;
    };
    const Z = z => z * hd.hl - hd.zh;
    const brain = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), bone);
    brain.scale.set(hd.hw * 0.45, hd.top * 0.5, hd.hl * 0.26); brain.position.set(0, hd.top * 0.42, Z(0.3));
    skull.add(brain);
    box(hd.hw * 0.3, hd.top * 0.12, hd.hl * 0.34, 0, hd.top * 0.62, Z(0.7));      // 鼻骨/额骨
    for (const s of [1, -1]) {
      const { w } = this._headSection(0.6, true);
      box(hd.hw * 0.08, hd.top * 0.1, hd.hl * 0.6, s * (w - hd.th), hd.lip, Z(0.6));  // 上颌骨
      box(hd.hw * 0.07, hd.top * 0.08, hd.hl * 0.5, s * w * 0.35, hd.top * 0.1, Z(0.45)); // 腭骨/翼骨
      box(hd.hw * 0.08, hd.top * 0.7, hd.hw * 0.08, s * hd.hw * 0.8, hd.top * 0.05, Z(0.02), 0.5, 0); // 方骨
    }
    this.upper.add(skull);
    const mand = this.mandible = new THREE.Group();
    for (const s of [1, -1]) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(hd.hw * 0.09, hd.bot * 0.3, hd.hl * 0.95), bone);
      m.position.set(s * hd.hw * 0.6, -hd.bot * 0.3, Z(0.46)); m.rotation.y = -s * 0.28;
      mand.add(m);
    }
    this.lower.add(mand);
    skull.visible = mand.visible = false;

    const glands = this.glands = new THREE.Group();
    if (sp.venom > 0) {
      const gm = new THREE.MeshStandardMaterial({ color: 0xe0d060, roughness: 0.4, emissive: 0x403800, emissiveIntensity: 0.4 });
      for (const s of [1, -1]) {
        const g = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), gm);
        const big = H.type === 'viper' ? 1.25 : 0.9;
        g.scale.set(hd.hw * 0.16 * big, hd.top * 0.28 * big, hd.hl * 0.14 * big);
        g.position.set(s * hd.hw * 0.5, hd.top * 0.22, Z(H.type === 'viper' ? 0.3 : 0.4));
        glands.add(g);
      }
    }
    const brainM = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), new THREE.MeshStandardMaterial({ color: 0xe8a8b0, roughness: 0.5 }));
    brainM.scale.set(hd.hw * 0.2, hd.top * 0.25, hd.hl * 0.16); brainM.position.set(0, hd.top * 0.45, Z(0.3));
    glands.add(brainM);
    this.vomeroMat = new THREE.MeshStandardMaterial({ color: 0x7fd8ff, roughness: 0.3, emissive: 0x39c6ff, emissiveIntensity: 0 });
    for (const s of [1, -1]) {
      const v = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), this.vomeroMat);
      v.scale.set(hd.hw * 0.08, hd.top * 0.08, hd.hl * 0.07);
      v.position.set(s * hd.hw * 0.14, hd.top * 0.14, Z(0.82));
      glands.add(v);
    }
    glands.visible = false;
    this.upper.add(glands);
  }

  // ================================================================ 构建：附属结构
  _buildExtras() {
    const sp = this.sp;
    if (sp.rattle) {
      const g = this.rattle = new THREE.Group();
      const mat = new THREE.MeshPhysicalMaterial({ color: 0xcdb690, roughness: 0.42, clearcoat: 0.5, clearcoatRoughness: 0.4, sheen: 0.4, sheenColor: new THREE.Color(0xfff0d0) });
      const r0 = this.base[this.N - 1] * 1.08;
      const len = r0 * 1.45;
      const prof = [[0.5, 0], [1.0, 0.16], [0.9, 0.34], [1.02, 0.52], [0.84, 0.74], [0.45, 1.0]].map(([r, y]) => new THREE.Vector2(r * r0, y * len));
      const geo = new THREE.LatheGeometry(prof, 22);
      const nSeg = this.isBaby ? 1 : 8;
      this.rattleSegs = [];
      for (let i = 0; i < nSeg; i++) {
        const m = new THREE.Mesh(geo, i === nSeg - 1 && !this.isBaby ? mat.clone() : mat);
        if (i === nSeg - 1 && !this.isBaby) m.material.color.set(0x8a7658);
        const k = Math.pow(0.965, i);
        m.scale.set(0.62 * k, k, 1.12 * k);
        m.position.y = i * len * 0.6;
        m.castShadow = true;
        g.add(m); this.rattleSegs.push(m);
      }
      // 运动模糊残影
      this.rattleGhosts = [];
      const gm = mat.clone(); gm.transparent = true; gm.opacity = 0.28; gm.depthWrite = false;
      for (const sgn of [1, -1]) {
        const gg = new THREE.Group();
        for (const s of this.rattleSegs) { const m = new THREE.Mesh(geo, gm); m.scale.copy(s.scale); m.position.copy(s.position); gg.add(m); }
        gg.visible = false; g.add(gg); this.rattleGhosts.push({ g: gg, sgn });
      }
      this.group.add(g);
    }
    if (sp.spurs && !this.isBaby) {
      this.spurs = [];
      const mat = new THREE.MeshStandardMaterial({ color: 0x3a2e24, roughness: 0.4 });
      for (const s of [1, -1]) {
        const m = new THREE.Mesh(new THREE.ConeGeometry(this.R * 0.07, this.R * 0.3, 8), mat);
        this.group.add(m); this.spurs.push({ m, s });
      }
    }
  }

  // ================================================================ 骨骼视图
  _buildSkeleton() {
    const BGU = ADDONS.BufferGeometryUtils;
    const g = this.skel = new THREE.Group();
    const boneMat = new THREE.MeshStandardMaterial({ color: 0xefe7d4, roughness: 0.5 });
    const c = new THREE.CylinderGeometry(0.2, 0.2, 0.92, 10); c.rotateX(Math.PI / 2);
    const ns = new THREE.BoxGeometry(0.07, 0.32, 0.55); ns.translate(0, 0.34, 0.05);
    const tp = new THREE.BoxGeometry(0.72, 0.07, 0.28); tp.translate(0, 0.06, -0.1);
    const parts = [c, ns, tp];
    if (this.sp.head.type === 'viper') { const hy = new THREE.BoxGeometry(0.05, 0.22, 0.3); hy.translate(0, -0.26, 0); parts.push(hy); }
    const vgeo = BGU.mergeGeometries(parts.map(p => p.toNonIndexed()));
    const nv = this.N - 2;
    this.vertIM = new THREE.InstancedMesh(vgeo, boneMat, nv);
    g.add(this.vertIM);
    const curvePts = [[0.18, 0.1, 0], [0.62, 0.3, 0.08], [0.93, 0.02, 0.16], [0.86, -0.45, 0.22], [0.48, -0.74, 0.26]].map(p => new V3(...p));
    const rgeo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(curvePts), 16, 0.032, 5);
    const ribMat = new THREE.MeshStandardMaterial({ color: 0xe6ddc6, roughness: 0.55, side: THREE.DoubleSide });
    this.ribIdx = [];
    for (let i = 3; i < this.iVent - 1; i++) this.ribIdx.push(i);
    this.ribIM = new THREE.InstancedMesh(rgeo, ribMat, this.ribIdx.length * 2);
    g.add(this.ribIM);
    if (this.sp.spurs) {
      const pel = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1, 6), boneMat);
      this.pelvis = pel; g.add(pel);
    }
    g.visible = false;
    this.group.add(g);
  }

  _updateSkeleton() {
    const { N, spine, X, Y, T } = this;
    const m = _m4;
    for (let i = 1; i < N - 1; i++) {
      m.makeBasis(X[i], Y[i], T[i]);
      const w = this.ww[i], h = this.hh[i];
      m.scale(_a.set(w, h, this.SEG / 0.92 * 1.05));
      m.setPosition(spine[i]);
      this.vertIM.setMatrixAt(i - 1, m);
    }
    this.vertIM.instanceMatrix.needsUpdate = true;
    let k = 0;
    for (const i of this.ribIdx) {
      const w = this.ww[i] * 0.95, h = this.hh[i] * 0.95, d = this.base[i];
      for (const s of [1, -1]) {
        m.makeBasis(X[i], Y[i], T[i]);
        m.scale(_a.set(w * s, h, d));
        m.setPosition(spine[i]);
        this.ribIM.setMatrixAt(k++, m);
      }
    }
    this.ribIM.instanceMatrix.needsUpdate = true;
    if (this.pelvis) {
      const i = this.iVent - 2;
      this.pelvis.position.copy(spine[i]).addScaledVector(Y[i], -this.hh[i] * 0.3);
      this.pelvis.quaternion.setFromUnitVectors(UP, T[i]);
      this.pelvis.scale.set(this.R * 0.5, this.R * 1.4, this.R * 0.5);
    }
  }

  // ================================================================ 内脏视图
  _buildOrgans() {
    const g = this.organs = new THREE.Group();
    this.organTubes = [];
    const sp = this.sp;
    for (const d0 of ORGANS) {
      const d = Object.assign({}, d0);
      if (d.key === 'llung' && sp.id === 'python') { d.n = '左肺（蟒类保留）'; d.r = 0.34; d.f1 = 0.42; }
      if (d.key === 'sac' && sp.id === 'seasnake') { d.f1 = 0.97; d.n = '后肺气囊（贯穿全身，调节浮力）'; }
      const tube = new SpineTube(this, d);
      g.add(tube.mesh);
      this.organTubes.push(tube);
    }
    this.foodMesh = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), new THREE.MeshStandardMaterial({ color: 0x7a5a48, roughness: 0.8 }));
    this.foodMesh.visible = false;
    g.add(this.foodMesh);
    // 标签
    this.labels = [];
    const CSS2DObject = ADDONS.CSS2DObject;
    for (const t of this.organTubes) {
      if (t.def.nolabel) continue;
      const div = document.createElement('div'); div.className = 'lbl';
      div.innerHTML = `<i style="background:#${t.def.col.toString(16).padStart(6, '0')}"></i>${t.def.n}`;
      const o = new CSS2DObject(div); g.add(o); this.labels.push({ o, tube: t });
    }
    g.visible = false;
    this.group.add(g);
  }

  _updateOrgans() {
    for (const t of this.organTubes) t.update();
    for (const l of this.labels) l.o.position.copy(l.tube.mid);
    const b = this.bolus.find(b => b.amp > 0.02);
    if (b) {
      const i = Math.min(this.N - 1, Math.round(b.t * (this.N - 1)));
      this.foodMesh.visible = true;
      this.foodMesh.position.copy(this.spine[i]);
      this.foodMesh.quaternion.setFromUnitVectors(new V3(0, 0, 1), this.T[i]);
      const r = b.amp * 0.9 + this.base[i] * 0.2;
      this.foodMesh.scale.set(r, r * 0.9, b.len || r * 2);
    } else this.foodMesh.visible = false;
  }

  setView(v) {
    this.view = v;
    const see = v !== 'skin';
    if (v === 'skeleton' && !this.skel) this._buildSkeleton();
    if (v === 'organs' && !this.organs) this._buildOrgans();
    for (const m of this.skinMats) {
      m.transparent = see; m.opacity = see ? (v === 'skeleton' ? 0.14 : 0.13) : 1; m.depthWrite = !see; m.needsUpdate = true;
    }
    this.mouthMat.transparent = see; this.mouthMat.opacity = see ? 0.25 : 1; this.mouthMat.depthWrite = !see; this.mouthMat.needsUpdate = true;
    for (const o of [this.body, this.upperMesh, this.lowerMesh]) o.renderOrder = see ? 2 : 0;
    if (this.skel) this.skel.visible = v === 'skeleton';
    if (this.skull) { this.skull.visible = this.mandible.visible = v === 'skeleton'; }
    if (this.organs) { this.organs.visible = v === 'organs'; for (const l of this.labels) l.o.element.style.display = v === 'organs' ? '' : 'none'; }
    if (this.glands) this.glands.visible = v === 'organs' || !!this.showVomero;
  }

  // ================================================================ 姿态与运动接口
  placeStraight(pos, heading, curvy = 0.0) {
    const { N, SEG, spine } = this;
    let psi = heading + Math.PI;
    const p = pos.clone();
    for (let i = 0; i < N; i++) {
      spine[i].copy(p);
      psi += curvy * Math.sin(i / N * TAU * 1.5) * SEG;
      p.x += Math.sin(psi) * SEG; p.z += Math.cos(psi) * SEG;
      this.upH[i].set(0, 1, 0);
    }
    this._modifiers(0);
    if (this.world && this.groundMode === 'terrain') this._ground();
    this.resetTrail();
    this.headPos.copy(spine[0]);
    this.update(0);
  }

  placeOnPolyline(pts, ups) {
    resamplePolyline(pts, this.SEG, this.N, this.spine, ups, this.upH);
    this.resetTrail();
    this._modifiers(0);
    this.update(0);
  }

  resetTrail() {
    const { N, spine, upH } = this;
    this.trail.length = 0;
    for (let i = 1; i < N; i++) this.trail.push({ p: spine[i].clone(), u: upH[i].clone() });
    this.headPos.copy(spine[0]); this.headUp.copy(upH[0]);
  }

  heading() { _a.subVectors(this.spine[0], this.spine[3]); return Math.atan2(_a.x, _a.z); }
  headDir(out) { return out.set(0, 0, 1).applyQuaternion(this.head.quaternion); }
  snoutWorld(out) { return this.upper.localToWorld(out.set(0, 0, this.hd.hl * 0.96 - this.hd.zh)); }
  center(out) { out.set(0, 0, 0); for (let i = 0; i < this.N; i += 8) out.add(this.spine[i]); return out.divideScalar(Math.ceil(this.N / 8)); }
  indexOfT(t) { return clamp(Math.round(t * (this.N - 1)), 0, this.N - 1); }

  setMotor(m) {
    const trailBased = ['crawl', 'path', 'swim'];
    if (trailBased.includes(m.type) && !trailBased.includes(this.motor.type)) this.resetTrail();
    if (m.type === 'sidewind' || m.type === 'concertina' || m.type === 'pose') {
      m.start = this.spine.map(p => p.clone()); m.el = 0;
    }
    this.motor = m;
    this.headAim = null;
    return m;
  }
  stop() { this.setMotor({ type: 'idle' }); }
  crawl(opts) { return this.setMotor(Object.assign({ type: 'crawl', gait: this.sp.gait, speed: 1 }, opts)); }
  followPath(ctrl, opts = {}) {
    const pts = opts.dense ? ctrl : smoothPath([this.spine[0].clone(), ...ctrl], this.SEG * 0.5);
    const path = new Path(pts, opts.ups);
    return this.setMotor(Object.assign({ type: 'path', path, d: 0, speed: 0.12 * this.L, wig: 0, lam: 0.3 * this.L }, opts, { dense: undefined }));
  }
  flick(dur = 0.8, cycles = 3) { const tg = this.tg; tg.active = true; tg.t = 0; tg.dur = dur; tg.cycles = cycles; }

  _moveHeadTo(p, up) {
    this.headPos.copy(p);
    if (up) this.headUp.copy(up);
    const tr = this.trail;
    if (!tr.length || tr[0].p.distanceTo(p) > this.SEG * 0.35) tr.unshift({ p: p.clone(), u: this.headUp.clone() });
    this._resampleFromTrail();
  }

  _resampleFromTrail() {
    const { spine, upH, trail, N, SEG } = this;
    spine[0].copy(this.headPos); upH[0].copy(this.headUp);
    const cur = _a.copy(this.headPos);
    let idx = 0;
    // 若 trail[0] 与头部重合，跳过
    while (idx < trail.length && trail[idx].p.distanceToSquared(cur) < 1e-10) idx++;
    for (let i = 1; i < N; i++) {
      let need = SEG;
      while (need > 1e-9) {
        if (idx >= trail.length) {
          const n = trail.length;
          if (n >= 2) _b.subVectors(trail[n - 1].p, trail[n - 2].p).normalize(); else _b.set(0, 0, -1);
          cur.addScaledVector(_b, need); need = 0; break;
        }
        const tp = trail[idx].p, d = cur.distanceTo(tp);
        if (d >= need) { cur.lerp(tp, need / d); need = 0; } else { need -= d; cur.copy(tp); idx++; }
      }
      spine[i].copy(cur);
      if (trail.length) upH[i].copy(trail[Math.min(idx, trail.length - 1)].u);
    }
    if (trail.length > idx + 16) trail.length = idx + 16;
  }

  // ================================================================ 每帧更新
  update(dt) {
    this.time += dt;
    this._modifiers(dt);
    this._motor(dt);
    if (this.groundMode === 'terrain' && this.world) this._ground();
    this._overlays(dt);
    if (this.clampGround && this.world) this._clampGround();
    this._frames();
    this._mesh();
    this._headUpdate(dt);
    this._tongueUpdate(dt);
    this._extrasUpdate(dt);
    if (this.view === 'skeleton' && this.skel) this._updateSkeleton();
    if (this.view === 'organs' && this.organs) this._updateOrgans();
  }

  _modifiers(dt) {
    const { N, sp } = this;
    const sec = sp.section;
    this.breath += dt * this.breathRate;
    const br = Math.sin(this.breath * TAU) * 0.025 * this.breathAmp;
    const vent = sp.vent;
    for (let i = 0; i < N; i++) {
      const t = i / (N - 1);
      let r = this.base[i], wm = 1, hm = 1, curl = 0;
      if (this.hood > 0) {
        const hs = smoothstep(0.022, 0.058, t) * (1 - smoothstep(0.075, 0.16, t));
        wm *= 1 + this.hood * 2.4 * hs; hm *= 1 - this.hood * 0.55 * hs; curl = this.hood * 0.55 * hs;
      }
      if (sp.paddle) {
        wm *= lerp(1, 0.78, smoothstep(0.45, 0.8, t)) * lerp(1, 0.5, smoothstep(0.84, 0.93, t));
        hm *= lerp(1, 1.22, smoothstep(0.45, 0.8, t)) * lerp(1, 2.0, smoothstep(0.84, 0.95, t));
      }
      const trunk = smoothstep(0.06, 0.15, t) * (1 - smoothstep(vent - 0.06, vent + 0.03, t));
      if (this.flatten) { wm *= 1 + 0.42 * this.flatten * trunk; hm *= 1 - 0.36 * this.flatten * trunk; }
      if (this.puff) { const m = smoothstep(0.05, 0.15, t) * (1 - smoothstep(0.45, 0.7, t)); wm *= 1 + 0.15 * this.puff * m; hm *= 1 + 0.15 * this.puff * m; }
      const bm = smoothstep(0.2, 0.3, t) * (1 - smoothstep(0.55, 0.7, t));
      wm *= 1 + br * bm; hm *= 1 + br * bm;
      if (this.ventralWave) hm *= 1 + 0.06 * this.ventralWave * trunk * Math.sin(TAU * t * this.L / (3.2 * this.R) - this.time * 5);
      if (this.shiver) { const s = 1 + this.shiver * 0.03 * Math.sin(this.time * 55 + i * 0.9) * trunk; wm *= s; hm *= s; }
      let g = 0;
      for (const b of this.bolus) { const d = (t - b.t) / b.w; g += b.amp * Math.exp(-d * d); }
      let w = r * wm + g, h = r * hm + g * 0.92;
      if (i < 3) { const cap = [0.3, 0.72, 0.93][i]; w *= cap; h *= cap; } // 颈端收拢（藏在头骨后部内）
      this.ww[i] = w; this.hh[i] = h; this.curl[i] = curl;
      this.hb[i] = h * sec.belly;
    }
    // 头部离地间隙：颈部前段逐渐抬到头的高度
    const kH = Math.max(2, Math.ceil(this.hd.hl * 0.75 / this.SEG));
    const dep = this.hd.depth * (1 + this.gape * 0.8);
    for (let i = 0; i < Math.min(kH, N); i++) {
      const f = Math.pow(1 - i / kH, 1.5);
      this.hb[i] = Math.max(this.hb[i], lerp(this.hb[i], dep, f));
    }
    // 叠加层权重平滑
    const k = 1 - Math.exp(-dt * 4);
    this.front.w += (this.front.tw - this.front.w) * k;
    this.tail.w += (this.tail.tw - this.tail.w) * k;
  }

  groundAt(i) { const p = this.spine[i]; return this.world.heightAt(p.x, p.z); }

  _ground() {
    const { N, spine } = this;
    for (let i = 0; i < N; i++) {
      const p = spine[i];
      const t = i / (N - 1);
      const sk = this.sink * smoothstep(0.02, 0.1, t);
      p.y = this.world.heightAt(p.x, p.z) + this.hb[i] - sk;
    }
  }

  _clampGround() {
    const { N, spine } = this;
    for (let i = 0; i < N; i++) {
      const p = spine[i];
      const t = i / (N - 1);
      const sk = this.sink * smoothstep(0.02, 0.1, t);
      const g = this.world.heightAt(p.x, p.z) + this.hb[i] - sk - this.allowUnder * this.lockW[i];
      if (p.y < g) p.y = g;
    }
  }

  // ---------------------------------------------------------------- 驱动器
  _motor(dt) {
    const m = this.motor;
    switch (m.type) {
      case 'crawl': this._crawl(dt, m); break;
      case 'swim': this._crawl(dt, m, true); break;
      case 'path': this._path(dt, m); break;
      case 'sidewind': this._sidewind(dt, m); break;
      case 'concertina': this._concertina(dt, m); break;
      case 'pose': this._pose(dt, m); break;
      default: break;
    }
  }

  _gaitParams(g) {
    const L = this.L;
    switch (g) {
      case 'rectilinear': return { v: 0.045 * L, A: 0.004 * L, lam: 0.5 * L };
      case 'swim': return { v: 0.16 * L, A: 0.07 * L, lam: 0.28 * L };
      default: return { v: 0.13 * L, A: 0.055 * L, lam: 0.32 * L };
    }
  }

  _crawl(dt, m, swim = false) {
    const gp = this._gaitParams(swim ? 'swim' : m.gait);
    if (!m.init) {
      m.init = true;
      m.mean = this.spine[0].clone();
      m.psi = this.heading();
      _a.subVectors(this.spine[0], this.spine[4]).normalize();
      m.pitch = swim ? Math.asin(clamp(_a.y, -0.9, 0.9)) : 0;
      m.dist = 0; m.wander = m.psi; m.cur = 0;
    }
    const spd = gp.v * (m.speed ?? 1) * this.speedMul;
    const target = typeof m.target === 'function' ? m.target() : m.target;
    let desired = m.psi, desiredPitch = 0;
    if (target) {
      desired = Math.atan2(target.x - m.mean.x, target.z - m.mean.z);
      if (swim) desiredPitch = Math.atan2(target.y - m.mean.y, Math.hypot(target.x - m.mean.x, target.z - m.mean.z));
      if (m.mean.distanceTo(target) < (m.arrive ?? this.L * 0.1)) m.done = true;
    } else {
      m.wander += (vnoise(this.time * 0.25, 3.7, 9) - 0.5) * dt * 2.2;
      desired = m.wander;
      const W = this.world, br = W ? W.cur.roam : 20;
      const c = W ? W.cur.center : new V3();
      const dx = m.mean.x - c.x, dz = m.mean.z - c.z;
      const dc = Math.hypot(dx, dz);
      if (dc > br * 0.7) {
        const toC = Math.atan2(-dx, -dz);
        const w = smoothstep(br * 0.7, br, dc);
        desired = desired + angleDelta(desired, toC) * w;
        m.wander += angleDelta(m.wander, toC) * w * dt * 0.8;
      }
      if (W) for (const o of W.cur.obstacles) {
        const ox = o.x - m.mean.x, oz = o.z - m.mean.z, d = Math.hypot(ox, oz);
        if (d < o.r + this.L * 0.25) {
          const away = Math.atan2(-ox, -oz);
          desired += angleDelta(desired, away) * (1 - d / (o.r + this.L * 0.25)) * 1.2;
        }
      }
      if (swim) {
        m.cur += (vnoise(this.time * 0.2, 8.1, 4) - 0.5) * dt * 1.5;
        const yMid = (W.cur.swimMin + W.cur.swimMax) / 2;
        desiredPitch = clamp(m.cur, -0.4, 0.4) + clamp((yMid - m.mean.y) * 0.08, -0.4, 0.4);
        if (m.mean.y > W.cur.swimMax) desiredPitch = -0.4;
        if (m.mean.y < W.cur.swimMin) desiredPitch = 0.4;
      }
    }
    const turn = spd / (0.11 * this.L) * (m.turn ?? 1);
    m.psi += clamp(angleDelta(m.psi, desired), -turn * dt, turn * dt);
    m.pitch = damp(m.pitch, desiredPitch, 1.5, dt);
    const stopF = m.done && m.stopOnArrive !== false ? 0 : 1;
    const step = spd * dt * stopF;
    const cp = Math.cos(m.pitch);
    m.mean.x += Math.sin(m.psi) * cp * step; m.mean.z += Math.cos(m.psi) * cp * step;
    if (swim) m.mean.y += Math.sin(m.pitch) * step;
    m.dist += step;
    const A = gp.A * (m.amp ?? 1) * smoothstep(0, gp.lam * 0.5, m.dist);
    const lat = A * Math.sin(TAU * m.dist / gp.lam);
    _b.set(Math.cos(m.psi), 0, -Math.sin(m.psi));
    _c.copy(m.mean).addScaledVector(_b, lat);
    if (step > 0) this._moveHeadTo(_c, UP);
    this.headAim = (this.headAim || new V3()).set(Math.sin(m.psi) * cp, Math.sin(m.pitch), Math.cos(m.psi) * cp);
    this.ventralWave = damp(this.ventralWave, m.gait === 'rectilinear' && step > 0 ? 1 : 0, 3, dt);
    if (swim) { // 游泳：在轨迹上叠加向尾部增强的行波
      const { N, spine } = this;
      for (let i = 4; i < N; i++) {
        const t = i / (N - 1);
        _d.subVectors(spine[i - 2], spine[Math.min(N - 1, i + 2)]).setY(0).normalize();
        _e.set(_d.z, 0, -_d.x);
        const a = 0.035 * this.L * Math.pow(t, 1.3) * Math.sin(TAU * t * 2.2 - this.time * 5.5);
        spine[i].addScaledVector(_e, a);
      }
    }
  }

  _path(dt, m) {
    const spd = m.speed * this.speedMul;
    if (!m.done) {
      m.d += spd * dt;
      if (m.d >= m.path.length) { m.d = m.path.length; m.done = true; }
    }
    const p = m.path.at(m.d, _c, _d);
    if (m.wig) {
      const dir = m.path.dirAt(m.d, _e);
      const side = _b.set(dir.z, 0, -dir.x).normalize();
      const fade = smoothstep(0, m.lam * 0.5, m.d) * smoothstep(0, m.lam * 0.5, m.path.length - m.d);
      p.addScaledVector(side, m.wig * this.L * Math.sin(TAU * m.d / m.lam) * fade);
    }
    if (!m.done || !m._settled) { this._moveHeadTo(p, _d); if (m.done) m._settled = true; }
    this.headAim = m.path.dirAt(Math.min(m.d, m.path.length - 0.06), this.headAim || new V3());
    this.ventralWave = damp(this.ventralWave, m.rect && !m.done ? 1 : 0, 3, dt);
  }

  _sidewind(dt, m) {
    const { N, SEG, spine, L, R } = this;
    if (!m.init) {
      m.init = true;
      _a.subVectors(spine[0], spine[N - 1]).setY(0);
      if (_a.lengthSq() < 1e-6) _a.set(0, 0, 1);
      m.axis = Math.atan2(_a.x, _a.z);
      m.O = this.center(new V3());
      m.phi = 0;
      m.lifted = new Uint8Array(N);
    }
    m.el += dt;
    const w = smoothstep(0, 1.4, m.el);
    const omega = TAU * 0.95 * (m.speed ?? 1) * this.speedMul;
    const Ah = 0.075 * L, k = TAU / (0.55 * L), Av = 1.7 * R;
    m.phi += omega * dt;
    const b = _a.set(Math.sin(m.axis), 0, Math.cos(m.axis));
    const side = _b.set(b.z, 0, -b.x);
    const mv = _c.copy(side).multiplyScalar(-1).addScaledVector(b, 0.22).normalize();
    // 转向目标
    const target = typeof m.target === 'function' ? m.target() : m.target;
    let want;
    if (target) {
      want = Math.atan2(target.x - m.O.x, target.z - m.O.z);
      if (Math.hypot(target.x - m.O.x, target.z - m.O.z) < (m.arrive ?? L * 0.3)) m.done = true;
    } else {
      const c = this.world.cur.center, br = this.world.cur.roam;
      const dx = m.O.x - c.x, dz = m.O.z - c.z;
      want = Math.atan2(mv.x, mv.z) + (vnoise(this.time * 0.15, 1, 2) - 0.5) * 0.8;
      if (Math.hypot(dx, dz) > br * 0.65) want = Math.atan2(-dx, -dz);
    }
    const cur = Math.atan2(mv.x, mv.z);
    m.axis += clamp(angleDelta(cur, want), -0.35 * dt, 0.35 * dt);
    const v = Ah * omega * 0.6 * (m.done ? 0 : 1);
    m.O.addScaledVector(mv, v * dt);
    const W = this.world;
    for (let i = 0; i < N; i++) {
      const s = i * SEG, u = L / 2 - s;
      const ph = k * s - m.phi;
      const lat = Ah * Math.sin(ph);
      const lift = Av * Math.max(0, Math.sin(ph + Math.PI / 2)) * smoothstep(0.02, 0.12, i / N);
      _d.copy(m.O).addScaledVector(b, u).addScaledVector(side, lat);
      _d.y = W.heightAt(_d.x, _d.z) + this.hb[i] + lift;
      spine[i].lerpVectors(m.start[i], _d, w);
      // 足迹：只在身体某段“落地”的瞬间盖印——一串落地点连成侧进特有的平行 J 形痕迹
      const contact = lift < 0.04 * R;
      if (contact && m.lifted[i] && W.stampTrack && v > 0 && w > 0.9) W.stampTrack(_d.x, _d.z, this.ww[i] * 1.2);
      m.lifted[i] = contact ? 0 : 1;
      this.upH[i].set(0, 1, 0);
    }
    this.headAim = (this.headAim || new V3()).copy(b);
  }

  _concertina(dt, m) {
    const { N, SEG, spine, L } = this;
    if (!m.init) {
      m.init = true;
      _a.subVectors(spine[0], spine[N - 1]).setY(0);
      m.psi = Math.atan2(_a.x, _a.z);
      m.phase = 1; m.pt = 1; // 以“全身折叠”开始
      m.anchor = spine[N - 1].clone(); m.anchorHead = spine[0].clone();
      m.cur = spine.map(p => p.clone());
    }
    m.el += dt;
    const dur = 1.25 / ((m.speed ?? 1) * this.speedMul);
    m.pt += dt / dur;
    if (m.pt >= 1) {
      m.pt = 0; m.phase = 1 - m.phase;
      if (m.phase === 0) m.anchor.copy(m.cur[N - 1]); else m.anchorHead.copy(m.cur[0]);
      const target = typeof m.target === 'function' ? m.target() : m.target;
      let want = m.psi;
      if (target) { want = Math.atan2(target.x - m.cur[0].x, target.z - m.cur[0].z); if (m.cur[0].distanceTo(target) < (m.arrive ?? L * 0.1)) m.done = true; }
      else {
        const c = this.world.cur.center, br = this.world.cur.roam;
        const dx = m.cur[0].x - c.x, dz = m.cur[0].z - c.z;
        want = m.psi + (Math.random() - 0.5) * 0.6;
        if (Math.hypot(dx, dz) > br * 0.6) want = Math.atan2(-dx, -dz);
      }
      if (m.phase === 0) m.psi += clamp(angleDelta(m.psi, want), -0.35, 0.35);
    }
    const e = easeInOut(m.pt);
    const Tmax = 1.05, lam = 0.16 * L;
    const theta = s => {
      const tf = m.done ? Tmax : (m.phase === 0 ? Tmax * (1 - e) : Tmax * e);
      return lerp(tf, Tmax, smoothstep(0.38 * L, 0.62 * L, s));
    };
    const hd = s => m.psi + theta(s) * Math.sin(TAU * s / lam) * smoothstep(0, 0.06 * L, s);
    const P = m.cur;
    if (m.phase === 0) {
      P[N - 1].copy(m.anchor);
      for (let i = N - 2; i >= 0; i--) { const h = hd(i * SEG); P[i].set(P[i + 1].x + Math.sin(h) * SEG, 0, P[i + 1].z + Math.cos(h) * SEG); }
    } else {
      P[0].copy(m.anchorHead);
      for (let i = 1; i < N; i++) { const h = hd(i * SEG); P[i].set(P[i - 1].x - Math.sin(h) * SEG, 0, P[i - 1].z - Math.cos(h) * SEG); }
    }
    const w = smoothstep(0, 1.2, m.el);
    for (let i = 0; i < N; i++) { spine[i].x = lerp(m.start[i].x, P[i].x, w); spine[i].z = lerp(m.start[i].z, P[i].z, w); this.upH[i].set(0, 1, 0); }
    this.headAim = (this.headAim || new V3()).set(Math.sin(m.psi), 0, Math.cos(m.psi));
  }

  _pose(dt, m) {
    const { N, spine } = this;
    m.el += dt;
    if (m.gen) m.gen(m);            // 可每帧重新生成目标（如绞杀时逐渐收紧）
    const k = m.dur ? easeInOut(clamp(m.el / m.dur, 0, 1)) : 1 - Math.exp(-dt * (m.k || 4));
    for (let i = 0; i < N; i++) {
      if (m.dur) spine[i].lerpVectors(m.start[i], m.pts[i], k);
      else spine[i].lerp(m.pts[i], k);
      if (m.ups) this.upH[i].lerp(m.ups[i], m.dur ? k : 0.2).normalize();
    }
    if (m.dur && m.el >= m.dur) m.done = true;
  }

  // ---------------------------------------------------------------- 颈部/尾部叠加层
  _overlays(dt) {
    const f = this.front, { N, SEG, spine } = this;
    if (f.w > 0.002) {
      const a = Math.max(4, Math.min(N - 3, Math.round(f.len * (N - 1))));
      _a.subVectors(spine[a - 1], spine[a + 1]).normalize();
      const yaw0 = Math.atan2(_a.x, _a.z), pitch0 = Math.asin(clamp(_a.y, -1, 1));
      const pts = this._fpts || (this._fpts = Array.from({ length: N }, () => new V3()));
      let corr = f.yawBias;
      for (let pass = 0; pass < (f.aim ? 2 : 1); pass++) {
        const p = _b.copy(spine[a]);
        for (let k = a - 1; k >= 0; k--) {
          const u = (a - k) / a;
          const bump = smoothstep(0, f.r1, u) * (1 - smoothstep(f.r2, f.r3, u));
          const pitch = lerp(pitch0, f.rise * bump + f.headPitch * smoothstep(0.75, 1, u), smoothstep(0, 0.25, u));
          const yaw = yaw0 + f.sAmp * Math.sin(TAU * f.sFreq * u) * smoothstep(0, 0.15, u)
            + f.sway * u + corr * smoothstep(0.1, 1, u);
          p.x += Math.sin(yaw) * Math.cos(pitch) * SEG; p.y += Math.sin(pitch) * SEG; p.z += Math.cos(yaw) * Math.cos(pitch) * SEG;
          pts[k].copy(p);
        }
        if (f.aim && pass === 0) {
          const h = pts[0], h2 = pts[Math.min(a, 3)];
          const cy = Math.atan2(h.x - h2.x, h.z - h2.z), ty = Math.atan2(f.aim.x - h.x, f.aim.z - h.z);
          corr += angleDelta(cy, ty) * 0.9;
        }
      }
      if (f.reach) { // 额外前冲（突袭时补足距离）
        _c.subVectors(f.aim || pts[0], pts[0]); const dl = _c.length();
        if (dl > 1e-4) { _c.multiplyScalar(Math.min(dl, f.reach) / dl); for (let k = 0; k < a; k++) pts[k].addScaledVector(_c, Math.pow(1 - k / a, 1.5)); }
      }
      for (let k = 0; k < a; k++) {
        const u = (a - k) / a;
        const w = f.w * smoothstep(0, 0.2, u);
        spine[k].lerp(pts[k], w);
        this.lockW[k] = w;
      }
      for (let k = a; k < N; k++) this.lockW[k] = 0;
    } else this.lockW.fill(0);

    const tl = this.tail;
    if (tl.w > 0.002) {
      const a = Math.max(2, Math.round((1 - tl.len) * (N - 1)));
      _a.subVectors(spine[a + 1], spine[a - 1]).normalize();
      const yaw0 = Math.atan2(_a.x, _a.z), pitch0 = Math.asin(clamp(_a.y, -1, 1));
      const p = _b.copy(spine[a]);
      const pts = this._tpts || (this._tpts = Array.from({ length: N }, () => new V3()));
      for (let k = a + 1; k < N; k++) {
        const u = (k - a) / (N - 1 - a);
        const pitch = lerp(pitch0, tl.rise * smoothstep(0, 0.6, u), smoothstep(0, 0.3, u));
        const yaw = yaw0 + tl.curlYaw * u + tl.wig * Math.sin(this.time * tl.wigF * TAU - u * 5) * u
          + tl.vib * Math.sin(this.time * 330) * Math.pow(u, 2);
        p.x += Math.sin(yaw) * Math.cos(pitch) * SEG; p.y += Math.sin(pitch) * SEG; p.z += Math.cos(yaw) * Math.cos(pitch) * SEG;
        pts[k].copy(p);
      }
      for (let k = a + 1; k < N; k++) {
        const u = (k - a) / (N - 1 - a);
        const w = tl.w * smoothstep(0, 0.25, u);
        spine[k].lerp(pts[k], w);
        this.lockW[k] = Math.max(this.lockW[k], w);
      }
    }
  }

  // ---------------------------------------------------------------- 标架
  _frames() {
    const { N, spine, T, X, Y, upH } = this;
    for (let i = 0; i < N; i++) {
      const i0 = Math.max(0, i - 1), i1 = Math.min(N - 1, i + 1);
      T[i].subVectors(spine[i1], spine[i0]);
      if (T[i].lengthSq() < 1e-12) T[i].copy(i ? T[i - 1] : _a.set(0, 0, -1));
      T[i].normalize();
    }
    for (let i = 0; i < N; i++) {
      const hint = upH[i];
      _a.copy(hint).addScaledVector(T[i], -hint.dot(T[i]));
      const hl2 = _a.lengthSq();
      if (i === 0) {
        if (hl2 > 1e-4) Y[0].copy(_a).normalize();
        else Y[0].set(1, 0, 0).addScaledVector(T[0], -T[0].x).normalize();
      } else {
        _q1.setFromUnitVectors(T[i - 1], T[i]);
        Y[i].copy(Y[i - 1]).applyQuaternion(_q1);
        if (hl2 > 1e-6) {
          const w = clamp(hl2 * 1.2, 0, 1) * 0.35;
          Y[i].lerp(_a.normalize(), w);
        }
        Y[i].addScaledVector(T[i], -Y[i].dot(T[i])).normalize();
      }
      X[i].crossVectors(Y[i], T[i]).normalize();
    }
  }

  _mesh() {
    const { N, M, spine, X, Y, pos, cj, sj, sp } = this;
    const sec = sp.section;
    const nUp = 2 / sec.up, nLo = 2 / sec.lo, ridge = sec.ridge;
    for (let i = 0; i < N; i++) {
      const w = this.ww[i], ht = this.hh[i], hb = ht * sec.belly, cl = this.curl[i];
      const P = spine[i], Xi = X[i], Yi = Y[i];
      let k = i * (M + 1) * 3;
      for (let j = 0; j <= M; j++, k += 3) {
        const c = cj[j], s = sj[j];
        const x = w * sgnPow(c, s >= 0 ? nUp : nLo);
        let y = s >= 0 ? ht * Math.pow(s, nUp) : -hb * Math.pow(-s, nLo);
        if (ridge && s > 0) y += ridge * ht * Math.pow(Math.max(0, 1 - Math.abs(c) * 2.2), 2);
        if (cl) y -= cl * (x / w) * (x / w) * ht * 1.4;
        pos[k] = P.x + Xi.x * x + Yi.x * y;
        pos[k + 1] = P.y + Xi.y * x + Yi.y * y;
        pos[k + 2] = P.z + Xi.z * x + Yi.z * y;
      }
    }
    const geo = this.bodyGeo;
    geo.attributes.position.needsUpdate = true;
    geo.computeVertexNormals();
    const n = geo.attributes.normal.array;
    for (let i = 0; i < N; i++) { // 接缝处法线平均
      const a = i * (M + 1) * 3, b = (i * (M + 1) + M) * 3;
      for (let c = 0; c < 3; c++) { const v = (n[a + c] + n[b + c]) * 0.5; n[a + c] = v; n[b + c] = v; }
    }
  }

  _headUpdate(dt) {
    const { spine, hd } = this;
    const F = _a.subVectors(spine[0], spine[2]).normalize();
    if (this.headAim && this.front.w < 0.3) {
      // 头部比颈部更平稳地指向前进方向，但偏转不超过约 25°
      const k = 0.5 * (1 - this.front.w * 3);
      _d.copy(F).lerp(this.headAim, k).normalize();
      if (_d.dot(F) > 0.9) F.copy(_d); else F.lerp(_d, 0.3).normalize();
    }
    if (this.groundMode === 'terrain' && this.front.w < 0.5) { F.y *= lerp(0.3, 1, this.front.w * 2); F.normalize(); }
    const Yh = _b.copy(this.Y[0]).addScaledVector(F, -this.Y[0].dot(F)).normalize();
    const xh = _c.crossVectors(Yh, F);
    _m4.makeBasis(xh, Yh, F);
    this.head.quaternion.setFromRotationMatrix(_m4);
    const L = this.look;
    L.yaw = damp(L.yaw, L.ty, 3, dt); L.pitch = damp(L.pitch, L.tp, 3, dt); L.roll = damp(L.roll, L.tr, 3, dt);
    _eul.set(-L.pitch, L.yaw, L.roll, 'YXZ');
    this.head.quaternion.multiply(_q2.setFromEuler(_eul));
    this.head.position.copy(spine[0]);
    const st = this.headStretch;
    this.head.scale.set(1 + st * 0.4, 1 + st * 0.12, 1 + st * 0.05);
    const walk = this.jawWalk * Math.sin(this.time * 5.5);
    this.lower.rotation.set(this.gape * 0.95 + Math.abs(walk) * 0.08, walk * 0.12, walk * 0.06);
    this.lower.scale.x = 1 + st * 0.35;
    this.upper.rotation.x = -this.gape * 0.25;
    if (this.fangPivots) for (const p of this.fangPivots) p.rotation.x = this.fangHinged ? lerp(1.45, -0.12, this.fangErect) : 0;
    if (this.glottisMesh) { this.glottisMesh.scale.set(1, 1 + this.glottis * 1.6, 1); this.glottisMesh.position.z = (0.62 + this.glottis * 0.2) * hd.hl - hd.zh; }
    // 瞳孔
    const slit = this.sp.eye.pupil === 'slit';
    const pd = this.pupil;
    for (const p of this.pupils) p.scale.set(slit ? lerp(0.1, 0.52, pd) : lerp(0.3, 0.62, pd), slit ? lerp(0.62, 0.72, pd) : lerp(0.3, 0.62, pd), 0.16);
    this.cloudMat.opacity = this.eyeCloud * 0.85;
    const d = this.dull;
    for (const m of this.skinMats) {
      m.color.setRGB(lerp(1, 1.1, d), lerp(1, 1.12, d), lerp(1, 1.18, d));
      m.clearcoat = lerp(this.sp.scales.clearcoat, 0.05, d);
      m.iridescence = clamp(lerp(this.sp.scales.irid, 0, d) + this.iridBoost, 0, 1);
    }
    this.skinMat.roughness = lerp(1, 1.6, d);
    if (this.vomeroMat) { this.vomero = damp(this.vomero, 0, 1.2, dt); this.vomeroMat.emissiveIntensity = this.vomero * 3; }
  }

  _tongueUpdate(dt) {
    const tg = this.tg;
    if (tg.active) {
      tg.t += dt;
      const p = tg.t / tg.dur;
      if (p >= 1) { tg.active = false; this.vomero = 1; }
      tg.ext = smoothstep(0, 0.14, p) * (1 - smoothstep(0.84, 1, p));
      tg.osc = Math.sin(TAU * tg.cycles * p) * smoothstep(0.08, 0.22, p) * (1 - smoothstep(0.72, 0.9, p));
      tg.spread = 0.3 + 0.7 * Math.abs(tg.osc);
    } else {
      tg.ext = 0;
      if (tg.auto && this.gape < 0.05) { tg.next -= dt * tg.rate; if (tg.next <= 0) { this.flick(rand(0.6, 0.9), 2 + (Math.random() * 2 | 0)); tg.next = rand(1.6, 4.2); } }
    }
    if (this.tongue) this.tongue.update(tg.ext, tg.osc, tg.spread);
  }

  tongueTips(outL, outR) {
    this.tongue.tipLocal(1, outL); this.upper.localToWorld(outL);
    this.tongue.tipLocal(-1, outR); this.upper.localToWorld(outR);
  }

  _extrasUpdate() {
    const { N, spine, X, Y, T } = this;
    if (this.rattle) {
      const i = N - 1;
      _m4.makeBasis(X[i], T[i], _a.copy(Y[i]).negate());
      this.rattle.quaternion.setFromRotationMatrix(_m4);
      this.rattle.position.copy(spine[i]).addScaledVector(T[i], -this.base[i] * 0.3);
      const on = this.rattleOn;
      const amp = 0.22 * on;
      this.rattle.rotateZ(Math.sin(this.time * 377) * amp);
      for (const gh of this.rattleGhosts) { gh.g.visible = on > 0.3; gh.g.rotation.z = gh.sgn * amp * 1.6; }
    }
    if (this.spurs) {
      const i = this.iVent - 1;
      for (const { m, s } of this.spurs) {
        m.position.copy(spine[i]).addScaledVector(X[i], s * this.ww[i] * 0.72).addScaledVector(Y[i], -this.hh[i] * 0.55);
        m.quaternion.setFromUnitVectors(UP, _a.copy(T[i]).addScaledVector(X[i], s * 0.4).normalize());
      }
    }
  }

  // ================================================================ 蜕皮：生成静态的旧皮外壳
  makeShedSkin() {
    const g = new THREE.Group();
    const geo = new THREE.BufferGeometry();
    const n = this.bodyGeo.attributes.normal.array;
    const p = new Float32Array(this.pos.length);
    const off = this.R * 0.04;
    for (let i = 0; i < p.length; i++) p[i] = this.pos[i] + n[i] * off;
    geo.setAttribute('position', new THREE.BufferAttribute(p, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(n.slice(), 3));
    geo.setAttribute('uv', this.bodyGeo.attributes.uv.clone());
    geo.setIndex(this.bodyGeo.index.clone());
    const mat = new THREE.MeshPhysicalMaterial({
      map: getShedTex(this.sp), normalMap: this.skin.normal, transparent: true, opacity: 0.6, roughness: 0.55,
      side: THREE.DoubleSide, depthWrite: false, clearcoat: 0.35, clearcoatRoughness: 0.4,
    });
    const body = new THREE.Mesh(geo, mat); body.renderOrder = 3;
    g.add(body);
    const hmat = new THREE.MeshPhysicalMaterial({ color: 0xf0ebdc, normalMap: this.skin.upper.normal, transparent: true, opacity: 0.6, roughness: 0.55, side: THREE.DoubleSide, depthWrite: false });
    this.group.updateMatrixWorld(true);
    for (const m of [this.upperMesh, this.lowerMesh]) {
      const hm = new THREE.Mesh(m.geometry, hmat);
      hm.applyMatrix4(m.matrixWorld);
      hm.scale.multiplyScalar(1.04);
      hm.renderOrder = 3;
      g.add(hm);
    }
    g.userData.basePos = p.slice();
    g.userData.bodyGeo = geo;
    return g;
  }

  dispose() {
    this.group.traverse(o => {
      if (o.isMesh || o.isInstancedMesh) {
        o.geometry?.dispose?.();
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of mats) m?.dispose?.();
      }
      if (o.isCSS2DObject && o.element?.parentNode) o.element.parentNode.removeChild(o.element);
    });
    this.group.parent?.remove(this.group);
  }
}

// ============================================================ 分叉舌
class TongueMesh {
  constructor(len, r0, color) {
    this.len = len; this.r0 = r0;
    this.S = 14; this.F = 10; this.RS = 8;
    this.sf = 0.62;
    this.exit = new V3();
    const rings = this.S + 2 * this.F;
    this.pos = new Float32Array(rings * this.RS * 3);
    const idx = [];
    const link = (r0i, r1i) => {
      for (let j = 0; j < this.RS; j++) {
        const j2 = (j + 1) % this.RS;
        const a = r0i * this.RS + j, b = r0i * this.RS + j2, c = r1i * this.RS + j, d = r1i * this.RS + j2;
        idx.push(a, c, d, a, d, b);
      }
    };
    for (let k = 0; k < this.S - 1; k++) link(k, k + 1);
    for (const base of [this.S, this.S + this.F]) for (let k = 0; k < this.F - 1; k++) link(base + k, base + k + 1);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    geo.setIndex(idx);
    this.geo = geo;
    this.mesh = new THREE.Mesh(geo, new THREE.MeshPhysicalMaterial({ color, roughness: 0.3, clearcoat: 0.9, clearcoatRoughness: 0.2, side: THREE.DoubleSide }));
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
    this.ext = 0; this.osc = 0; this.spread = 0;
  }
  center(u, side, out) {
    const L = this.len, e = this.ext;
    if (u < 0) return out.set(0, this.exit.y - this.r0 * 0.5, this.exit.z + u * L * 0.6);
    const free = u * L * e;
    const y = this.exit.y - 0.08 * L * Math.pow(u * e, 2) + this.osc * L * 0.3 * e * Math.pow(u, 1.7);
    let x = 0;
    if (side && u > this.sf) x = side * this.spread * L * 0.24 * e * Math.pow((u - this.sf) / (1 - this.sf), 1.1);
    return out.set(x, y, this.exit.z + free);
  }
  tipLocal(side, out) { return this.center(1, side, out); }
  update(ext, osc, spread) {
    this.ext = ext; this.osc = osc; this.spread = spread;
    this.mesh.visible = ext > 0.01;
    if (!this.mesh.visible) return;
    const { S, F, RS, sf, pos } = this;
    const p = new V3(), p2 = new V3(), t = new V3(), xa = new V3(), n = new V3();
    const ring = (ri, u, side, r) => {
      this.center(u, side, p); this.center(u + 0.02, side, p2);
      t.subVectors(p2, p); if (t.lengthSq() < 1e-12) t.set(0, 0, 1); t.normalize();
      xa.set(1, 0, 0).addScaledVector(t, -t.x).normalize();
      n.crossVectors(t, xa);
      for (let j = 0; j < RS; j++) {
        const a = j / RS * TAU, ca = Math.cos(a) * r, sa = Math.sin(a) * r * 0.8;
        const k = (ri * RS + j) * 3;
        pos[k] = p.x + xa.x * ca + n.x * sa; pos[k + 1] = p.y + xa.y * ca + n.y * sa; pos[k + 2] = p.z + xa.z * ca + n.z * sa;
      }
    };
    for (let k = 0; k < S; k++) { const u = lerp(-0.3, sf, k / (S - 1)); ring(k, u, 0, this.r0 * (u < 0 ? 1 : 1 - 0.32 * u / sf)); }
    for (let s = 0; s < 2; s++) {
      const side = s ? -1 : 1, base = S + s * F;
      for (let k = 0; k < F; k++) {
        const f = k / (F - 1), u = lerp(sf, 1, f);
        ring(base + k, u, side, this.r0 * 0.64 * (1 - 0.88 * f));
      }
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.computeVertexNormals();
    this.geo.computeBoundingSphere();
  }
}

// ============================================================ 沿脊柱放样的器官管
class SpineTube {
  constructor(snake, def) {
    this.s = snake; this.def = def;
    const v = snake.sp.vent;
    this.t0 = 0.03 + def.f0 * (v - 0.03); this.t1 = 0.03 + def.f1 * (v - 0.03);
    this.K = clamp(Math.round((this.t1 - this.t0) * snake.N * 0.7), 6, 80);
    this.RS = 12;
    this.pos = new Float32Array(this.K * (this.RS + 1) * 3);
    const idx = [];
    for (let k = 0; k < this.K - 1; k++) for (let j = 0; j < this.RS; j++) {
      const a = k * (this.RS + 1) + j, b = a + this.RS + 1;
      idx.push(a, b + 1, b, a, a + 1, b + 1);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    geo.setIndex(idx);
    this.geo = geo;
    const mat = new THREE.MeshStandardMaterial({ color: def.col, roughness: 0.4, emissive: def.col, emissiveIntensity: 0.25, transparent: !!def.op, opacity: def.op || 1, side: THREE.DoubleSide });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.frustumCulled = false;
    this.mid = new V3();
  }
  update() {
    const s = this.s, { N, spine, X, Y } = s, d = this.def;
    const P = _a, Xi = _b, Yi = _c;
    let scale = 1;
    if (d.key === 'heart') scale = s.heartSize;
    if (d.key === 'gut') scale = s.gutSize;
    if (d.key === 'fat') scale = s.fatSize;
    for (let k = 0; k < this.K; k++) {
      const f = k / (this.K - 1), t = lerp(this.t0, this.t1, f);
      const fi = t * (N - 1), i0 = Math.min(N - 2, Math.floor(fi)), fr = fi - i0;
      P.lerpVectors(spine[i0], spine[i0 + 1], fr);
      Xi.lerpVectors(X[i0], X[i0 + 1], fr); Yi.lerpVectors(Y[i0], Y[i0 + 1], fr);
      const rb = s.base[i0] * s.flatW(i0);
      let r = rb * d.r * scale * Math.pow(Math.sin(Math.PI * clamp(f, 0.02, 0.98)), 0.45);
      if (d.key === 'stomach') for (const b of s.bolus) { const q = (t - b.t) / b.w; r += b.amp * 0.85 * Math.exp(-q * q); }
      const ox = (d.ox + (d.coil ? 0.3 * Math.sin(f * TAU * 7) : 0)) * rb * s.ww[i0] / (s.base[i0] || 1);
      const oy = d.oy * s.hh[i0];
      for (let j = 0; j <= this.RS; j++) {
        const a = j / this.RS * TAU, ca = Math.cos(a) * r * (s.ww[i0] / (s.base[i0] || 1)), sa = Math.sin(a) * r;
        const kk = (k * (this.RS + 1) + j) * 3;
        this.pos[kk] = P.x + Xi.x * (ox + ca) + Yi.x * (oy + sa);
        this.pos[kk + 1] = P.y + Xi.y * (ox + ca) + Yi.y * (oy + sa);
        this.pos[kk + 2] = P.z + Xi.z * (ox + ca) + Yi.z * (oy + sa);
      }
      if (k === (this.K >> 1)) this.mid.copy(P).addScaledVector(Xi, ox).addScaledVector(Yi, oy);
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.computeVertexNormals();
  }
}
Snake.prototype.flatW = function (i) { return 1; };
