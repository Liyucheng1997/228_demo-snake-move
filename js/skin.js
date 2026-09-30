'use strict';
// ============================================================
//  skin.js — 程序化生成蛇皮贴图
//  · 身体：512×4096 覆盖全长（不重复），逐鳞片着色（花纹以鳞片为“像素”，与真蛇一致）
//  · 高度图 → 法线贴图 + 粗糙度贴图（鳞缝粗糙、鳞面光滑、起棱鳞更哑光）
//  · 头部：上/下颌各一张，含头盾/颗粒鳞/唇鳞
// ============================================================
const SKIN_W = 512, SKIN_H = 4096;
const _skinCache = new Map();

function getSkin(sp) {
  if (!_skinCache.has(sp.id)) _skinCache.set(sp.id, buildSkin(sp));
  return _skinCache.get(sp.id);
}

function makeTex(canvas, srgb, wrapT = THREE.ClampToEdgeWrapping) {
  const t = new THREE.CanvasTexture(canvas);
  t.flipY = false;
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = wrapT;
  t.anisotropy = 8;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}

// 鳞片轮廓：局部坐标，前缘在 -h/2（朝头），游离后缘在 +h/2（朝尾）
function scalePath(p, type, w, h) {
  const a = w / 2, b = h / 2;
  if (type === 'granular') {
    p.moveTo(0, -b); p.lineTo(a * 0.92, -b * 0.42); p.lineTo(a * 0.92, b * 0.42);
    p.lineTo(0, b); p.lineTo(-a * 0.92, b * 0.42); p.lineTo(-a * 0.92, -b * 0.42); p.closePath();
  } else if (type === 'round') {
    p.ellipse(0, 0, a, b, 0, 0, TAU);
  } else if (type === 'plate') {
    const r = Math.min(a, b) * 0.35;
    p.moveTo(-a + r, -b); p.lineTo(a - r, -b); p.quadraticCurveTo(a, -b, a, -b + r);
    p.lineTo(a, b - r); p.quadraticCurveTo(a, b, a - r, b); p.lineTo(-a + r, b);
    p.quadraticCurveTo(-a, b, -a, b - r); p.lineTo(-a, -b + r); p.quadraticCurveTo(-a, -b, -a + r, -b); p.closePath();
  } else { // smooth / keeled：菱形-柳叶形，后缘圆钝
    p.moveTo(0, -b);
    p.quadraticCurveTo(a * 1.05, -b * 0.35, a * 0.85, b * 0.2);
    p.quadraticCurveTo(a * 0.5, b * 0.95, 0, b);
    p.quadraticCurveTo(-a * 0.5, b * 0.95, -a * 0.85, b * 0.2);
    p.quadraticCurveTo(-a * 1.05, -b * 0.35, 0, -b);
    p.closePath();
  }
}

/**
 * 预渲染单枚鳞片的 高度精灵 与 明暗精灵（逐鳞 drawImage，比逐鳞渐变快一个数量级）
 * 返回 {h, s, path, w, h, ox, oy}
 */
function makeScaleSprites(type, w, h, keel, domed = 1) {
  const pad = Math.ceil(Math.max(w, h) * 0.2) + 2;
  const cw = Math.ceil(w + pad * 2), ch = Math.ceil(h + pad * 2);
  const ox = cw / 2, oy = ch / 2;
  const path = new Path2D(); scalePath(path, type, w, h);
  const shift = type === 'granular' || type === 'plate' ? 0 : h * 0.07;

  // --- 高度 ---
  const hc = mkCanvas(cw, ch), hg = hc.getContext('2d');
  hg.translate(ox, oy);
  if (shift) { // 覆瓦投影：游离后缘在下一枚鳞片上投下阴影
    hg.save(); hg.translate(0, shift); hg.fillStyle = 'rgba(0,0,0,0.55)'; hg.fill(path); hg.restore();
  }
  hg.save(); hg.clip(path);
  const gr = hg.createLinearGradient(0, -h / 2, 0, h / 2);
  if (type === 'granular' || type === 'plate') {
    gr.addColorStop(0, '#8a8a8a'); gr.addColorStop(0.5, '#c8c8c8'); gr.addColorStop(1, '#8a8a8a');
  } else {
    gr.addColorStop(0, '#565656'); gr.addColorStop(0.55, '#b4b4b4'); gr.addColorStop(0.9, '#d8d8d8'); gr.addColorStop(1, '#a0a0a0');
  }
  hg.fillStyle = gr; hg.fillRect(-w, -h, w * 2, h * 2);
  if (domed) { // 鳞面微微隆起
    const rg = hg.createRadialGradient(0, h * 0.05, 0, 0, h * 0.05, Math.max(w, h) * 0.6);
    rg.addColorStop(0, `rgba(255,255,255,${0.25 * domed})`); rg.addColorStop(1, 'rgba(255,255,255,0)');
    hg.fillStyle = rg; hg.fillRect(-w, -h, w * 2, h * 2);
  }
  if (keel > 0) { // 起棱：沿中线的纵脊
    hg.strokeStyle = `rgba(255,255,255,${0.75 * keel})`; hg.lineWidth = Math.max(1, w * 0.11);
    hg.beginPath(); hg.moveTo(0, -h * 0.25); hg.lineTo(0, h * 0.45); hg.stroke();
    hg.strokeStyle = `rgba(0,0,0,${0.35 * keel})`; hg.lineWidth = Math.max(1, w * 0.05);
    hg.beginPath(); hg.moveTo(w * 0.1, -h * 0.2); hg.lineTo(w * 0.1, h * 0.42); hg.stroke();
  }
  hg.restore();
  hg.lineWidth = type === 'plate' ? 1 : Math.max(1, w * 0.06); hg.strokeStyle = type === 'plate' ? 'rgba(40,40,40,0.7)' : 'rgba(30,30,30,0.9)'; hg.stroke(path);

  // --- 明暗（叠加在底色上） ---
  const sc = mkCanvas(cw, ch), sg = sc.getContext('2d');
  sg.translate(ox, oy);
  if (shift) { sg.save(); sg.translate(0, shift); sg.fillStyle = 'rgba(0,0,0,0.28)'; sg.fill(path); sg.restore(); }
  sg.save(); sg.clip(path);
  const g2 = sg.createLinearGradient(0, -h / 2, 0, h / 2);
  if (type === 'granular' || type === 'plate') {
    g2.addColorStop(0, 'rgba(0,0,0,0.10)'); g2.addColorStop(0.5, 'rgba(0,0,0,0)'); g2.addColorStop(1, 'rgba(0,0,0,0.2)');
  } else {
    g2.addColorStop(0, 'rgba(0,0,0,0.30)'); g2.addColorStop(0.5, 'rgba(0,0,0,0)'); g2.addColorStop(0.85, 'rgba(255,255,255,0.10)'); g2.addColorStop(1, 'rgba(0,0,0,0.12)');
  }
  sg.fillStyle = g2; sg.fillRect(-w, -h, w * 2, h * 2);
  if (keel > 0) {
    sg.strokeStyle = `rgba(255,255,255,${0.14 * keel})`; sg.lineWidth = Math.max(1, w * 0.1);
    sg.beginPath(); sg.moveTo(0, -h * 0.25); sg.lineTo(0, h * 0.45); sg.stroke();
  }
  sg.restore();
  sg.lineWidth = type === 'plate' ? 1 : Math.max(0.8, w * 0.05); sg.strokeStyle = type === 'plate' ? 'rgba(0,0,0,0.22)' : 'rgba(0,0,0,0.35)'; sg.stroke(path);
  return { hs: hc, ss: sc, path, ox, oy };
}

function stampScale(gc, gh, spr, cx, cy, col) {
  gc.setTransform(1, 0, 0, 1, cx, cy);
  gc.fillStyle = rgb(col);
  gc.fill(spr.path);
  gc.setTransform(1, 0, 0, 1, 0, 0);
  gc.drawImage(spr.ss, cx - spr.ox, cy - spr.oy);
  gh.drawImage(spr.hs, cx - spr.ox, cy - spr.oy);
}

// 高度图 → 法线贴图 / 粗糙度贴图，并对颜色做鳞缝暗化 + 微噪声
function finishMaps(colC, hgtC, bump, roughScale, roughGap, wrapX) {
  const W = colC.width, H = colC.height;
  const gc = colC.getContext('2d'), gh = hgtC.getContext('2d');
  const cimg = gc.getImageData(0, 0, W, H), cd = cimg.data;
  const hd = gh.getImageData(0, 0, W, H).data;
  const nC = mkCanvas(W, H), rC = mkCanvas(W, H);
  const nimg = nC.getContext('2d').createImageData(W, H), nd = nimg.data;
  const rimg = rC.getContext('2d').createImageData(W, H), rd = rimg.data;
  const rnd = mulberry32(7);
  for (let y = 0; y < H; y++) {
    const yu = y > 0 ? y - 1 : 0, yd = y < H - 1 ? y + 1 : H - 1;
    for (let x = 0; x < W; x++) {
      const xl = x > 0 ? x - 1 : (wrapX ? W - 1 : 0), xr = x < W - 1 ? x + 1 : (wrapX ? 0 : W - 1);
      const k = (y * W + x) * 4;
      const h0 = hd[k];
      const dx = (hd[(y * W + xr) * 4] - hd[(y * W + xl) * 4]) / 255;
      const dy = (hd[(yd * W + x) * 4] - hd[(yu * W + x) * 4]) / 255;
      let nx = -dx * bump, ny = -dy * bump, nz = 1;
      const il = 1 / Math.sqrt(nx * nx + ny * ny + 1);
      nd[k] = (nx * il * 0.5 + 0.5) * 255; nd[k + 1] = (ny * il * 0.5 + 0.5) * 255; nd[k + 2] = (nz * il * 0.5 + 0.5) * 255; nd[k + 3] = 255;
      const hn = smoothstep(55, 150, h0);
      const r = lerp(roughGap, roughScale, hn) * 255;
      rd[k] = r; rd[k + 1] = r; rd[k + 2] = r; rd[k + 3] = 255;
      const ao = lerp(0.55, 1.0, smoothstep(25, 110, h0)) * (0.965 + rnd() * 0.07);
      cd[k] *= ao; cd[k + 1] *= ao; cd[k + 2] *= ao;
    }
  }
  gc.putImageData(cimg, 0, 0);
  nC.getContext('2d').putImageData(nimg, 0, 0);
  rC.getContext('2d').putImageData(rimg, 0, 0);
  return { nC, rC };
}

function buildSkin(sp) {
  const W = SKIN_W, H = SKIN_H, L = sp.length, R = sp.radius, sc = sp.scales;
  const sV = sc.sV;
  const colC = mkCanvas(W, H), hgtC = mkCanvas(W, H);
  const gc = colC.getContext('2d'), gh = hgtC.getContext('2d');
  const rLocal = v => Math.max(0.05, sp.profile(v)) * R;
  const bodyAt = (s, v) => { const r = rLocal(v); return sp.body(s * Math.PI * r, v * L, s, v, r, R, L); };
  const bellyS = s => Math.sign(s) * (1 - Math.abs(s)) / (1 - sV);
  const nV = sc.ventrals, lenV = H / nV;
  const gap = sc.gap, gapMix = sc.gapMix;

  // 1) 底色（鳞缝中露出的皮肤）：低分辨率逐像素花纹后放大
  const lw = 128, lh = 1024, low = mkCanvas(lw, lh), lg = low.getContext('2d');
  const limg = lg.createImageData(lw, lh);
  for (let y = 0; y < lh; y++) for (let x = 0; x < lw; x++) {
    const u = (x + 0.5) / lw, v = (y + 0.5) / lh, s = (u - 0.5) * 2;
    let c = Math.abs(s) > sV ? sp.belly(v, Math.floor(v * nV), bellyS(s)) : bodyAt(s, v);
    c = mixC(c, gap, gapMix);
    const k = (y * lw + x) * 4;
    limg.data[k] = c[0]; limg.data[k + 1] = c[1]; limg.data[k + 2] = c[2]; limg.data[k + 3] = 255;
  }
  lg.putImageData(limg, 0, 0);
  gc.imageSmoothingEnabled = true; gc.drawImage(low, 0, 0, W, H);
  gh.fillStyle = 'rgb(34,34,34)'; gh.fillRect(0, 0, W, H);

  // 2) 腹鳞（横跨腹面的宽大鳞板；泄殖孔后为成对的尾下鳞）
  const ventW = W * (1 - sV), x0 = W * (0.5 + sV / 2);
  const plateH = lenV * 1.3;
  const plate = makeScaleSprites('smooth', ventW * 0.96, plateH, 0, 0.4);
  const plateHalf = makeScaleSprites('smooth', ventW * 0.48, plateH, 0, 0.4);
  const COLS = 6;
  const drawPlate = (xs, width, cy, k, v, spr, bs0, bs1) => {
    for (const off of [0, -W]) {
      const cx = xs + width / 2 + off;
      gc.save(); gc.translate(cx, cy); gc.clip(spr.path);
      for (let c = 0; c < COLS; c++) {
        const f = (c + 0.5) / COLS;
        gc.fillStyle = rgb(mulC(sp.belly(v, k, lerp(bs0, bs1, f)), 0.95 + 0.1 * hash2(k, c, 5)));
        gc.fillRect(-width / 2 + width * c / COLS - 1, -plateH, width / COLS + 2, plateH * 2);
      }
      gc.restore();
      gc.drawImage(spr.ss, cx - spr.ox, cy - spr.oy);
      gh.drawImage(spr.hs, cx - spr.ox, cy - spr.oy);
    }
  };
  for (let k = nV - 1; k >= 0; k--) {
    const v = (k + 0.5) / nV, cy = (k + 0.5) * lenV + plateH * 0.12;
    if (v < sp.vent) drawPlate(x0, ventW, cy, k, v, plate, 1, -1);
    else {
      drawPlate(x0, ventW / 2, cy, k, v, plateHalf, 1, 0);
      drawPlate(x0 + ventW / 2, ventW / 2, cy + lenV / 2, k, v, plateHalf, 0, -1);
    }
  }

  // 3) 背鳞：斜行排列、覆瓦状，从尾往头绘制使前一枚压住后一枚
  const rows = sc.rows;
  const rowW = (sV * W) / rows;
  const pxU = W / (TAU * R * 0.95), pxV = H / L;
  const lenD = (rowW / pxU) * sc.aspect * pxV;
  const shape = sc.shape;
  const spr = makeScaleSprites(shape, rowW * (shape === 'granular' ? 1.0 : 1.3), lenD * (shape === 'granular' ? 1.0 : 1.55), sc.keel);
  const vert = sc.vertebral ? makeScaleSprites('granular', rowW * 1.9, lenD * 1.05, 0) : null;
  const nAlong = Math.ceil(H / lenD) + 1;
  const xStart = W * (0.5 - sV / 2);
  const mid = (rows - 1) / 2;
  for (let k = nAlong; k >= -1; k--) {
    for (let r = 0; r < rows; r++) {
      const isVert = vert && r === Math.round(mid);
      const cx = xStart + (r + 0.5) * rowW;
      const cy = (k + ((r & 1) ? 0.5 : 0)) * lenD;
      const v = clamp(cy / H, 0, 1), s = (cx / W - 0.5) * 2;
      let c = bodyAt(s, v);
      c = mulC(c, 0.93 + 0.14 * hash2(k, r, 17));
      if (!isVert) stampScale(gc, gh, spr, cx, cy, c);
    }
    if (vert) {
      const r = Math.round(mid), cx = xStart + (r + 0.5) * rowW, cy = (k + ((r & 1) ? 0.5 : 0)) * lenD;
      stampScale(gc, gh, vert, cx, cy, mulC(bodyAt(0, clamp(cy / H, 0, 1)), 0.95 + 0.1 * hash2(k, 99, 3)));
    }
  }

  // 眼镜蛇颈部：鳞片行数更多、更细小（展开兜帽时被横向拉伸后仍显得自然）
  if (sp.hood) {
    const vA = 0.02, vB = 0.17, rowsF = Math.round(rows * 2.3), rowF = (sV * W) / rowsF, lenF = lenD * 0.8;
    const sprF = makeScaleSprites(shape, rowF * 1.3, lenF * 1.55, sc.keel);
    for (let k = Math.ceil(vB * H / lenF) + 1; k >= Math.floor(vA * H / lenF) - 1; k--) {
      for (let r = 0; r < rowsF; r++) {
        const cx = xStart + (r + 0.5) * rowF, cy = (k + ((r & 1) ? 0.5 : 0)) * lenF;
        const v = cy / H, a = smoothstep(vA, vA + 0.03, v) * (1 - smoothstep(vB - 0.04, vB, v));
        if (a < 0.02) continue;
        gc.globalAlpha = gh.globalAlpha = a;
        const s = (cx / W - 0.5) * 2;
        stampScale(gc, gh, sprF, cx, cy, mulC(bodyAt(s, clamp(v, 0, 1)), 0.93 + 0.14 * hash2(k, r, 71)));
      }
    }
    gc.globalAlpha = gh.globalAlpha = 1;
  }

  const { nC, rC } = finishMaps(colC, hgtC, sc.bump * 2.2, sc.rough, Math.min(1, sc.rough + 0.4), true);
  const skin = {
    colC,
    map: makeTex(colC, true),
    normal: makeTex(nC, false),
    rough: makeTex(rC, false),
  };
  skin.upper = buildHeadTex(sp, 'upper');
  skin.lower = buildHeadTex(sp, 'lower');
  skin.iris = buildIrisTex(sp);
  return skin;
}

// 蜕下的旧皮：去饱和、提亮的半透明“幽灵”贴图
function getShedTex(sp) {
  const skin = getSkin(sp);
  if (skin.shed) return skin.shed;
  const W = 256, H = 2048, c = mkCanvas(W, H), g = c.getContext('2d');
  g.drawImage(skin.colC, 0, 0, W, H);
  const img = g.getImageData(0, 0, W, H), d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const l = (d[i] * 0.3 + d[i + 1] * 0.55 + d[i + 2] * 0.15) / 255;
    const v = 200 + 50 * l;
    d[i] = v * 0.98; d[i + 1] = v * 0.96; d[i + 2] = v * 0.88;
  }
  g.putImageData(img, 0, 0);
  skin.shed = makeTex(c, true);
  return skin.shed;
}

// ------------------------------------------------------------------ 头部贴图
function headPlates(sp, part) {
  const e = sp._eye, type = sp.head.scales;
  const P = []; // [hx0, hx1, hz0, hz1, mirror]
  if (part === 'upper') {
    P.push([-0.5, 0.5, 0.93, 1.02, 0]);                                   // 吻鳞
    const nl = type === 'granular' ? 13 : 9;
    for (let i = 0; i < nl; i++) {                                       // 上唇鳞
      const z0 = lerp(0.12, 0.93, i / nl), z1 = lerp(0.12, 0.93, (i + 1) / nl);
      P.push([0.86 + 0.03 * Math.sin(i), 1.02, z0, z1, 1]);
    }
    if (type === 'plates') {
      P.push([0.0, 0.28, 0.84, 0.93, 1]);                                // 鼻间鳞
      P.push([0.0, 0.33, 0.72, 0.84, 1]);                                // 前额鳞
      P.push([-0.14, 0.14, e.hz - 0.14, 0.72, 0]);                       // 额鳞
      P.push([0.15, e.hx - 0.19, e.hz - 0.1, e.hz + 0.09, 1]);           // 眶上鳞
      P.push([0.0, 0.4, 0.14, e.hz - 0.14, 1]);                          // 顶鳞
      P.push([0.3, 0.62, 0.84, 0.94, 1]);                                // 鼻鳞
      P.push([0.36, 0.64, 0.74, 0.84, 1]);                               // 颊鳞
      P.push([e.hx - 0.16, e.hx + 0.1, e.hz + 0.09, e.hz + 0.16, 1]);    // 眶前鳞
      P.push([e.hx - 0.17, e.hx + 0.12, e.hz - 0.15, e.hz - 0.09, 1]);   // 眶后鳞
      P.push([0.42, 0.62, 0.14, e.hz - 0.16, 1]);                        // 颞鳞
      P.push([0.62, 0.82, 0.14, e.hz - 0.16, 1]);
    } else if (type === 'mixed') {
      P.push([0.0, 0.3, 0.84, 0.93, 1]);
      P.push([0.0, 0.36, 0.7, 0.84, 1]);
      P.push([-0.12, 0.12, e.hz - 0.08, 0.7, 0]);
      P.push([e.hx - 0.3, e.hx - 0.12, e.hz - 0.08, e.hz + 0.08, 1]);
      P.push([0.3, 0.6, 0.84, 0.94, 1]);
    } else { // granular（蝰蛇：头背为细小颗粒鳞，仅眶上鳞较大）
      P.push([0.0, 0.2, 0.86, 0.93, 1]);
      P.push([e.hx - 0.3, e.hx - 0.1, e.hz - 0.11, e.hz + 0.1, 1]);
      P.push([0.3, 0.58, 0.85, 0.94, 1]);
      P.push([0.12, 0.34, 0.78, 0.86, 1]);
    }
  } else {
    P.push([-0.22, 0.22, 0.93, 1.02, 0]);                                // 颏鳞
    for (let i = 0; i < 11; i++) {
      const z0 = lerp(0.14, 0.93, i / 11), z1 = lerp(0.14, 0.93, (i + 1) / 11);
      P.push([0.82, 1.02, z0, z1, 1]);                                    // 下唇鳞
    }
    P.push([0.0, 0.28, 0.72, 0.92, 1]);                                  // 颏片
    P.push([0.0, 0.26, 0.5, 0.72, 1]);
  }
  return P;
}

function buildHeadTex(sp, part) {
  sp._eye = { hx: eyeHX(sp), hz: sp.head.eyeZ };
  const W = 512, H = 512;
  const col = mkCanvas(W, H), hgt = mkCanvas(W, H);
  const gc = col.getContext('2d'), gh = hgt.getContext('2d');
  const R = sp.radius, L = sp.length, e = sp._eye;
  const toXY = (hx, hz) => [(hx + 1) / 2 * W, (hz - HZ0) / (1 - HZ0) * H];
  const colorAt = (hx, hz) => {
    // 头后部（伸入颈部的部分）直接采样其下方身体的花纹，保证无缝
    const vb = clamp(-hz * sp.head.len / L, 0, 1), rb = R * sp.profile(vb);
    const sb = part === 'upper' ? hx * 0.55 : Math.sign(hx || 1) * (1 - Math.abs(hx) * 0.45);
    const neck = Math.abs(sb) > sp.scales.sV ? sp.belly(vb, Math.floor(vb * sp.scales.ventrals), Math.sign(sb) * (1 - Math.abs(sb)) / (1 - sp.scales.sV))
      : sp.body(sb * Math.PI * rb, vb * L, sb, vb, rb, R, L);
    const hc = part === 'upper' ? sp.headCol(hx, clamp(hz, 0, 1), e) : sp.chin(hx, clamp(hz, 0, 1));
    return mixC(neck, hc, smoothstep(-0.18, 0.06, hz));
  };
  // 底色
  const lw = 128, low = mkCanvas(lw, lw), lg = low.getContext('2d'), img = lg.createImageData(lw, lw);
  for (let y = 0; y < lw; y++) for (let x = 0; x < lw; x++) {
    const hx = (x + 0.5) / lw * 2 - 1, hz = (y + 0.5) / lw * (1 - HZ0) + HZ0;
    const c = mixC(colorAt(hx, hz), sp.scales.gap, 0.35);
    const k = (y * lw + x) * 4;
    img.data[k] = c[0]; img.data[k + 1] = c[1]; img.data[k + 2] = c[2]; img.data[k + 3] = 255;
  }
  lg.putImageData(img, 0, 0);
  gc.drawImage(low, 0, 0, W, H);
  gh.fillStyle = 'rgb(70,70,70)'; gh.fillRect(0, 0, W, H);

  // 小鳞片铺底
  const type = sp.head.scales;
  const small = type === 'granular' ? 8 : type === 'mixed' ? 8 : 11;
  const keel = type === 'granular' ? sp.scales.keel * 0.7 : 0;
  const spr = makeScaleSprites(type === 'granular' ? 'keeled' : 'round', small * 1.2, small * 1.3, keel, 0.8);
  for (let y = H + small; y > -small; y -= small * 0.85) {
    const row = Math.round(y / small);
    for (let x = -small; x < W + small; x += small) {
      const cx = x + ((row & 1) ? small / 2 : 0), cy = y;
      const hx = cx / W * 2 - 1, hz = cy / H * (1 - HZ0) + HZ0;
      stampScale(gc, gh, spr, cx, cy, mulC(colorAt(hx, hz), 0.93 + 0.14 * hash2(row, x | 0, 4)));
    }
  }
  // 大型头盾
  for (const [a0, a1, z0, z1, mir] of headPlates(sp, part)) {
    for (const sgn of mir ? [1, -1] : [1]) {
      const hx0 = sgn > 0 ? a0 : -a1, hx1 = sgn > 0 ? a1 : -a0;
      const [x0, y0] = toXY(hx0, z0), [x1, y1] = toXY(hx1, z1);
      const w = Math.abs(x1 - x0), h = Math.abs(y1 - y0);
      if (w < 3 || h < 3) continue;
      const ps = makeScaleSprites('plate', w, h, 0, 0.35);
      const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
      const hx = (hx0 + hx1) / 2, hz = (z0 + z1) / 2;
      stampScale(gc, gh, ps, cx, cy, mulC(colorAt(hx, hz), 0.95 + 0.1 * hash2(cx | 0, cy | 0, 2)));
    }
  }
  const { nC } = finishMaps(col, hgt, 2.2, sp.scales.rough, Math.min(1, sp.scales.rough + 0.35), true);
  return { map: makeTex(col, true), normal: makeTex(nC, false) };
}

// ------------------------------------------------------------------ 虹膜贴图（球面极点朝外）
function buildIrisTex(sp) {
  const W = 256, H = 128, c = mkCanvas(W, H), g = c.getContext('2d');
  const img = g.createImageData(W, H), d = img.data;
  const i1 = C(sp.eye.iris), i2 = C(sp.eye.iris2);
  for (let y = 0; y < H; y++) {
    const lat = y / H * Math.PI;
    for (let x = 0; x < W; x++) {
      const k = (y * W + x) * 4;
      let col;
      if (lat < 1.05) {
        const q = lat / 1.05;
        const fib = vnoiseP(x / W * 48, q * 3, 48, 4) * 0.6 + vnoiseP(x / W * 96, q * 7, 96, 9) * 0.4;
        col = mixC(i1, i2, clamp(fib * 0.9 + q * 0.35 - 0.2, 0, 1));
        if (q < 0.3) col = mixC(col, i2, (0.3 - q) * 1.2);           // 瞳孔周围深色环
        col = mixC(col, [10, 10, 10], smoothstep(0.78, 1.0, q));     // 角膜缘
        if (vnoiseP(x / W * 40, q * 10, 40, 21) > 0.78) col = mulC(col, 0.6);
      } else col = [12, 12, 12];
      d[k] = col[0]; d[k + 1] = col[1]; d[k + 2] = col[2]; d[k + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  return t;
}
