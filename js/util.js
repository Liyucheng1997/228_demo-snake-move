'use strict';
// ============================================================
//  util.js — 数学工具、噪声、颜色、折线重采样、协程辅助
// ============================================================
const V3 = THREE.Vector3;
const TAU = Math.PI * 2;
const UP = new V3(0, 1, 0);

const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const lerp = (a, b, t) => a + (b - a) * t;
const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const easeInOut = t => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const easeOut = t => 1 - Math.pow(1 - t, 3);
const easeIn = t => t * t * t;
const damp = (cur, target, lambda, dt) => lerp(cur, target, 1 - Math.exp(-lambda * dt));
const rand = (a, b) => a + Math.random() * (b - a);
const sgnPow = (x, p) => (x < 0 ? -Math.pow(-x, p) : Math.pow(x, p));

function angleDelta(a, b) {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- 噪声 ----------
function hash2(x, y, s = 0) {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
function vnoise(x, y, s = 0) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi, s), b = hash2(xi + 1, yi, s), c = hash2(xi, yi + 1, s), d = hash2(xi + 1, yi + 1, s);
  return lerp(lerp(a, b, u), lerp(c, d, u), v);
}
function fbm(x, y, oct = 4, s = 0) {
  let f = 0, a = 0.5, n = 0;
  for (let i = 0; i < oct; i++) { f += a * vnoise(x, y, s + i * 17); n += a; x = x * 2.03 + 1.7; y = y * 2.03 + 9.2; a *= 0.5; }
  return f / n;
}
// 可平铺（周期）噪声，用于地面贴图
function vnoiseP(x, y, p, s = 0) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const m = k => ((k % p) + p) % p;
  const a = hash2(m(xi), m(yi), s), b = hash2(m(xi + 1), m(yi), s), c = hash2(m(xi), m(yi + 1), s), d = hash2(m(xi + 1), m(yi + 1), s);
  return lerp(lerp(a, b, u), lerp(c, d, u), v);
}
function fbmP(x, y, p, oct = 4, s = 0) {
  let f = 0, a = 0.5, n = 0;
  for (let i = 0; i < oct; i++) { f += a * vnoiseP(x, y, p, s + i * 31); n += a; x *= 2; y *= 2; p *= 2; a *= 0.5; }
  return f / n;
}

// ---------- 颜色 ----------
const C = h => [(h >> 16) & 255, (h >> 8) & 255, h & 255];
const mixC = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const mulC = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const rgb = c => `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;
const rgba = (c, a) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
const toHex = c => ((clamp(c[0] | 0, 0, 255) << 16) | (clamp(c[1] | 0, 0, 255) << 8) | clamp(c[2] | 0, 0, 255));

// 分段平滑插值曲线 [[x,y],...]
function curve(pts) {
  return x => {
    if (x <= pts[0][0]) return pts[0][1];
    for (let i = 1; i < pts.length; i++) {
      if (x <= pts[i][0]) {
        const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
        const k = (x - x0) / (x1 - x0);
        return y0 + (y1 - y0) * k * k * (3 - 2 * k);
      }
    }
    return pts[pts.length - 1][1];
  };
}

function mkCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

// ---------- 折线 ----------
function polyLength(pts) { let l = 0; for (let i = 1; i < pts.length; i++) l += pts[i].distanceTo(pts[i - 1]); return l; }

/**
 * 从 pts[0] 起按固定弧长 step 重采样 count 个点（不足部分沿末端方向外推）。
 * ups（可选）为每个折线点的“背侧朝向”提示，一并插值到 outU。
 */
function resamplePolyline(pts, step, count, outP, ups, outU) {
  const cur = new V3().copy(pts[0]);
  const dir = new V3();
  let idx = 1, lastU = ups ? ups[0] : null;
  outP[0].copy(cur);
  if (outU) outU[0].copy(ups ? ups[0] : UP);
  for (let i = 1; i < count; i++) {
    let need = step;
    while (need > 1e-9) {
      if (idx >= pts.length) {
        if (pts.length > 1) dir.subVectors(pts[pts.length - 1], pts[pts.length - 2]).normalize(); else dir.set(0, 0, -1);
        cur.addScaledVector(dir, need); need = 0; break;
      }
      const d = cur.distanceTo(pts[idx]);
      if (d >= need) { cur.lerp(pts[idx], need / d); need = 0; }
      else { need -= d; cur.copy(pts[idx]); if (ups) lastU = ups[idx]; idx++; }
    }
    outP[i].copy(cur);
    if (outU) outU[i].copy(ups ? (ups[Math.min(idx, pts.length - 1)] || lastU) : UP);
  }
}

// 用 Catmull-Rom 把稀疏控制点加密成平滑折线
function smoothPath(ctrl, spacing = 0.1) {
  if (ctrl.length < 2) return ctrl.map(p => p.clone());
  const c = new THREE.CatmullRomCurve3(ctrl, false, 'centripetal', 0.5);
  const len = c.getLength();
  const n = Math.max(2, Math.ceil(len / spacing));
  return c.getSpacedPoints(n);
}

// 带累计弧长的路径，便于按距离取点
class Path {
  constructor(pts, ups) {
    this.pts = pts; this.ups = ups || null;
    this.cum = [0];
    for (let i = 1; i < pts.length; i++) this.cum.push(this.cum[i - 1] + pts[i].distanceTo(pts[i - 1]));
    this.length = this.cum[this.cum.length - 1];
  }
  at(d, out, outUp) {
    const { pts, cum } = this;
    d = clamp(d, 0, this.length);
    let lo = 0, hi = cum.length - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (cum[m] < d) lo = m; else hi = m; }
    const seg = cum[hi] - cum[lo] || 1;
    const k = (d - cum[lo]) / seg;
    out.lerpVectors(pts[lo], pts[hi], k);
    if (outUp) { if (this.ups) outUp.lerpVectors(this.ups[lo], this.ups[hi], k).normalize(); else outUp.copy(UP); }
    return out;
  }
  dirAt(d, out) {
    const a = this.at(d - 0.05, new V3()), b = this.at(d + 0.05, new V3());
    return out.subVectors(b, a).normalize();
  }
}

// ---------- 协程（生成器）辅助 ----------
// 行为脚本以生成器编写：每帧 it.next(dt)，脚本内 `const dt = yield;`
function* wait(t) { while (t > 0) { t -= yield; } }
function* waitUntil(fn, timeout = Infinity) { let e = 0; while (!fn() && e < timeout) { e += yield; } }
function* tween(dur, fn, ease = easeInOut) {
  let e = 0; fn(0);
  while (e < dur) { e += yield; fn(ease(Math.min(1, e / dur))); }
}
// 并行执行多个生成器，全部结束后返回
function* all(...its) {
  let alive = its.slice();
  while (alive.length) {
    const dt = yield;
    alive = alive.filter(it => !it.next(dt).done);
  }
}
// 执行生成器，但最多持续 t 秒
function* forAtMost(t, it) { let e = 0; while (e < t) { const dt = yield; e += dt; if (it.next(dt).done) return; } it.return(); }
