'use strict';
// ============================================================
//  world.js — 场景环境：天空/光照、四种栖息地 + 冬眠洞穴剖面、粒子、沙地足迹
// ============================================================

// ---------------------------------------------------------------- 粒子系统（逐粒子大小/透明度）
class Particles {
  constructor(max, { additive = false, depthWrite = false } = {}) {
    this.max = max;
    this.pos = new Float32Array(max * 3); this.col = new Float32Array(max * 3);
    this.size = new Float32Array(max); this.alpha = new Float32Array(max);
    this.data = Array.from({ length: max }, () => ({ life: 0 }));
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1));
    geo.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1));
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uScale: { value: 600 } },
      vertexShader: `attribute float aSize; attribute float aAlpha; varying float vA; varying vec3 vC; uniform float uScale;
        void main(){ vA=aAlpha; vC=color; vec4 mv=modelViewMatrix*vec4(position,1.0); gl_PointSize=aSize*uScale/max(0.1,-mv.z); gl_Position=projectionMatrix*mv; }`,
      fragmentShader: `varying float vA; varying vec3 vC;
        void main(){ vec2 d=gl_PointCoord-0.5; float r=length(d); if(r>0.5) discard; float a=vA*smoothstep(0.5,0.12,r); gl_FragColor=vec4(vC,a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        }`,
      vertexColors: true, transparent: true, depthWrite, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.points = new THREE.Points(geo, this.mat);
    this.points.frustumCulled = false;
    this.cursor = 0;
    for (let i = 0; i < max; i++) this.alpha[i] = 0;
  }
  emit(o) {
    let k = -1;
    for (let n = 0; n < this.max; n++) { const i = (this.cursor + n) % this.max; if (this.data[i].life <= 0) { k = i; break; } }
    if (k < 0) k = this.cursor;
    this.cursor = (k + 1) % this.max;
    const d = this.data[k];
    d.p = (d.p || new V3()).copy(o.p); d.v = (d.v || new V3()).copy(o.v || _a.set(0, 0, 0));
    d.c = (d.c || new THREE.Color()).set(o.c ?? 0xffffff);
    d.life = d.max = o.life ?? 2; d.s = o.size ?? 0.1; d.grow = o.grow ?? 0; d.drag = o.drag ?? 0; d.grav = o.grav ?? 0;
    d.a = o.alpha ?? 1; d.fn = o.fn || null; d.fade = o.fade ?? 0.3;
    return d;
  }
  update(dt) {
    for (let i = 0; i < this.max; i++) {
      const d = this.data[i];
      if (d.life <= 0) { this.alpha[i] = 0; continue; }
      d.life -= dt;
      if (d.fn) d.fn(d, dt);
      d.v.y -= d.grav * dt;
      d.v.multiplyScalar(Math.max(0, 1 - d.drag * dt));
      d.p.addScaledVector(d.v, dt);
      d.s += d.grow * dt;
      const age = 1 - d.life / d.max;
      this.alpha[i] = d.life > 0 ? d.a * smoothstep(0, 0.08, age) * smoothstep(0, d.fade * d.max, d.life) : 0;
      this.pos[i * 3] = d.p.x; this.pos[i * 3 + 1] = d.p.y; this.pos[i * 3 + 2] = d.p.z;
      this.col[i * 3] = d.c.r; this.col[i * 3 + 1] = d.c.g; this.col[i * 3 + 2] = d.c.b;
      this.size[i] = d.s;
    }
    const a = this.points.geometry.attributes;
    a.position.needsUpdate = a.color.needsUpdate = a.aSize.needsUpdate = a.aAlpha.needsUpdate = true;
  }
  clear() { for (const d of this.data) d.life = 0; }
}

// ---------------------------------------------------------------- 程序化贴图
function tileCanvas(n, draw) { const c = mkCanvas(n, n); draw(c.getContext('2d'), n); return c; }

function heightToNormal(hC, strength) {
  const W = hC.width, H = hC.height;
  const hd = hC.getContext('2d').getImageData(0, 0, W, H).data;
  const c = mkCanvas(W, H), g = c.getContext('2d'), img = g.createImageData(W, H), d = img.data;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const xl = (x - 1 + W) % W, xr = (x + 1) % W, yu = (y - 1 + H) % H, yd = (y + 1) % H;
    const dx = (hd[(y * W + xr) * 4] - hd[(y * W + xl) * 4]) / 255 * strength;
    const dy = (hd[(yd * W + x) * 4] - hd[(yu * W + x) * 4]) / 255 * strength;
    const il = 1 / Math.sqrt(dx * dx + dy * dy + 1), k = (y * W + x) * 4;
    d[k] = (-dx * il * 0.5 + 0.5) * 255; d[k + 1] = (dy * il * 0.5 + 0.5) * 255; d[k + 2] = (il * 0.5 + 0.5) * 255; d[k + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return c;
}

function repTex(c, rep, srgb = true) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep, rep); t.anisotropy = 8;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// 在可平铺画布上绘制（自动处理边界环绕）
function wrapDraw(g, n, x, y, r, fn) {
  for (const ox of [0, -n, n]) for (const oy of [0, -n, n]) {
    if (x + ox < -r || x + ox > n + r || y + oy < -r || y + oy > n + r) continue;
    g.save(); g.translate(x + ox, y + oy); fn(g); g.restore();
  }
}

const _groundCache = {};
function groundTextures(kind) { return _groundCache[kind] || (_groundCache[kind] = _groundTextures(kind)); }
function _groundTextures(kind) {
  const n = 1024, rnd = mulberry32(kind.length * 77 + 5);
  const col = mkCanvas(n, n), hgt = mkCanvas(n, n);
  const gc = col.getContext('2d'), gh = hgt.getContext('2d');
  const img = gc.createImageData(n, n), himg = gh.createImageData(n, n);
  const pal = {
    forest: [[52, 38, 26], [84, 64, 42]], desert: [[214, 190, 148], [196, 168, 124]], bamboo: [[48, 40, 26], [74, 64, 40]],
    sea: [[206, 196, 160], [178, 168, 132]], den: [[92, 78, 54], [120, 104, 70]], snow: [[236, 240, 246], [214, 222, 234]],
  }[kind];
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const u = x / n * 8, v = y / n * 8;
    let f = fbmP(u, v, 8, 5, 3), h = 110 + f * 60;
    if (kind === 'desert' || kind === 'sea') {
      const w = fbmP(u * 0.6, v * 0.6, 4.8, 3, 9);
      const rip = Math.sin((y / n * 64 + w * 10) * TAU * (kind === 'sea' ? 0.5 : 1));
      h = 120 + rip * 45 + f * 30; f = f * 0.6 + (rip * 0.5 + 0.5) * 0.4;
      if (vnoiseP(u * 16, v * 16, 128, 4) > 0.83) f -= 0.5;
    }
    if (kind === 'snow') { h = 150 + f * 40; }
    const c = mixC(pal[0], pal[1], f);
    const k = (y * n + x) * 4;
    img.data[k] = c[0]; img.data[k + 1] = c[1]; img.data[k + 2] = c[2]; img.data[k + 3] = 255;
    himg.data[k] = himg.data[k + 1] = himg.data[k + 2] = h; himg.data[k + 3] = 255;
  }
  gc.putImageData(img, 0, 0); gh.putImageData(himg, 0, 0);

  const leaf = (count, colors, lw, lh, narrow) => {
    for (let i = 0; i < count; i++) {
      const x = rnd() * n, y = rnd() * n, a = rnd() * TAU, s = 0.6 + rnd() * 0.8;
      const c = colors[(rnd() * colors.length) | 0], l = 0.8 + rnd() * 0.4;
      const w = lw * s, h = lh * s;
      const shape = g => {
        g.rotate(a); g.beginPath();
        if (narrow) g.ellipse(0, 0, w * 0.18, h, 0, 0, TAU); else { g.moveTo(0, -h); g.quadraticCurveTo(w, -h * 0.2, 0, h); g.quadraticCurveTo(-w, -h * 0.2, 0, -h); }
      };
      wrapDraw(gc, n, x, y, h + 4, g => {
        shape(g); g.fillStyle = rgb(mulC(c, l)); g.shadowColor = 'rgba(0,0,0,0.5)'; g.shadowBlur = 4; g.fill(); g.shadowBlur = 0;
        g.strokeStyle = rgba(mulC(c, 0.6), 0.8); g.lineWidth = 1; g.beginPath(); g.moveTo(0, -h); g.lineTo(0, h * 1.1); g.stroke();
      });
      wrapDraw(gh, n, x, y, h + 4, g => { shape(g); g.fillStyle = `rgb(${150 + rnd() * 50 | 0},0,0)`; g.fillStyle = `rgb(${165 + (rnd() * 40 | 0)},${165},${165})`; g.fill(); });
    }
  };
  if (kind === 'forest') {
    for (let i = 0; i < 60; i++) { const x = rnd() * n, y = rnd() * n, r = 10 + rnd() * 30; wrapDraw(gc, n, x, y, r, g => { g.fillStyle = 'rgba(70,90,40,0.35)'; g.beginPath(); g.arc(0, 0, r, 0, TAU); g.fill(); }); }
    leaf(1100, [[122, 74, 34], [150, 104, 48], [104, 88, 42], [176, 122, 56], [74, 53, 32], [140, 60, 30]], 16, 24, false);
    for (let i = 0; i < 60; i++) { const x = rnd() * n, y = rnd() * n, a = rnd() * TAU, l = 20 + rnd() * 50; wrapDraw(gc, n, x, y, l, g => { g.rotate(a); g.strokeStyle = 'rgb(60,42,28)'; g.lineWidth = 2 + rnd() * 2; g.beginPath(); g.moveTo(0, 0); g.lineTo(l, 0); g.stroke(); }); wrapDraw(gh, n, x, y, l, g => { g.rotate(a); g.strokeStyle = '#c8c8c8'; g.lineWidth = 3; g.beginPath(); g.moveTo(0, 0); g.lineTo(l, 0); g.stroke(); }); }
  }
  if (kind === 'bamboo') {
    for (let i = 0; i < 80; i++) { const x = rnd() * n, y = rnd() * n, r = 12 + rnd() * 30; wrapDraw(gc, n, x, y, r, g => { g.fillStyle = 'rgba(60,96,40,0.4)'; g.beginPath(); g.arc(0, 0, r, 0, TAU); g.fill(); }); }
    leaf(1300, [[168, 138, 74], [140, 112, 60], [110, 130, 60], [190, 160, 90], [90, 70, 40]], 20, 34, true);
  }
  if (kind === 'desert') {
    for (let i = 0; i < 500; i++) { const x = rnd() * n, y = rnd() * n, r = 1 + rnd() * 3; const c = mixC([150, 120, 90], [90, 80, 70], rnd()); wrapDraw(gc, n, x, y, r, g => { g.fillStyle = rgb(c); g.beginPath(); g.arc(0, 0, r, 0, TAU); g.fill(); }); wrapDraw(gh, n, x, y, r, g => { g.fillStyle = '#e0e0e0'; g.beginPath(); g.arc(0, 0, r, 0, TAU); g.fill(); }); }
  }
  if (kind === 'sea') {
    for (let i = 0; i < 260; i++) { const x = rnd() * n, y = rnd() * n, r = 2 + rnd() * 5; wrapDraw(gc, n, x, y, r, g => { g.fillStyle = `rgba(245,240,225,0.8)`; g.beginPath(); g.ellipse(0, 0, r, r * 0.6, rnd() * 3, 0, TAU); g.fill(); }); }
  }
  if (kind === 'den') {
    for (let i = 0; i < 1600; i++) { const x = rnd() * n, y = rnd() * n, a = rnd() * TAU, l = 10 + rnd() * 25; const c = mixC([150, 130, 80], [110, 96, 60], rnd()); wrapDraw(gc, n, x, y, l, g => { g.rotate(a); g.strokeStyle = rgb(c); g.lineWidth = 1.5; g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(l * 0.5, 3, l, 0); g.stroke(); }); }
  }
  return { map: col, normal: heightToNormal(hgt, 3) };
}

function barkTexture(base = [92, 70, 50]) {
  const c = mkCanvas(256, 512), g = c.getContext('2d');
  g.fillStyle = rgb(base); g.fillRect(0, 0, 256, 512);
  const r = mulberry32(9);
  for (let i = 0; i < 260; i++) {
    const x = r() * 256, w = 2 + r() * 6, l = mixC(base, r() > 0.5 ? [30, 22, 16] : [150, 130, 110], r() * 0.6);
    g.strokeStyle = rgb(l); g.lineWidth = w; g.beginPath(); g.moveTo(x, 0);
    for (let y = 0; y <= 512; y += 32) g.lineTo(x + (r() - 0.5) * 8, y);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; return t;
}

function rockTexture(base) {
  const c = mkCanvas(512, 512), g = c.getContext('2d'), img = g.createImageData(512, 512);
  for (let y = 0; y < 512; y++) for (let x = 0; x < 512; x++) {
    const f = fbmP(x / 64, y / 64, 8, 5, 2), sp = vnoiseP(x / 6, y / 6, 85, 7);
    let cc = mulC(base, 0.7 + f * 0.6);
    if (sp > 0.8) cc = mulC(cc, 0.7);
    if (fbmP(x / 40, y / 40, 12.8, 3, 11) > 0.66) cc = mixC(cc, [150, 150, 110], 0.5);
    const k = (y * 512 + x) * 4; img.data[k] = cc[0]; img.data[k + 1] = cc[1]; img.data[k + 2] = cc[2]; img.data[k + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; return t;
}

function makeRockGeo(seed, flat = 0.65) {
  const g = new THREE.IcosahedronGeometry(1, 4);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const d = 1 + 0.28 * (vnoise(x * 1.3 + seed, y * 1.3 + z, seed) + vnoise(z * 1.3, x * 1.3 + seed * 0.3, seed + 1) - 1)
      + 0.07 * (vnoise(x * 5 + z * 2, y * 5, seed + 2) - 0.5);
    p.setXYZ(i, x * d, y * d * flat, z * d);
  }
  g.computeVertexNormals();
  return g;
}

// 蕨类：程序化羽状复叶
function fernGeometry(count, area, avoidR, rnd) {
  const pos = [], col = [];
  const green = [[46, 92, 30], [70, 120, 40], [96, 140, 52]];
  for (let c = 0; c < count; c++) {
    let cx, cz; do { cx = (rnd() - 0.5) * area; cz = (rnd() - 0.5) * area; } while (Math.hypot(cx, cz) < avoidR);
    const fronds = 6 + (rnd() * 4 | 0), scale = 0.8 + rnd() * 0.9;
    for (let f = 0; f < fronds; f++) {
      const ang = f / fronds * TAU + rnd() * 0.4, lean = 0.5 + rnd() * 0.5, L = (1.4 + rnd() * 0.8) * scale;
      const dir = new V3(Math.sin(ang), 0, Math.cos(ang));
      const side = new V3(dir.z, 0, -dir.x);
      const gc = green[(rnd() * 3) | 0];
      const pt = s => new V3(cx, 0, cz).addScaledVector(dir, s * L * Math.cos(lean * s)).add(new V3(0, L * (Math.sin(lean * 1.4) * s - 0.55 * s * s), 0));
      const P = 16;
      for (let i = 1; i < P; i++) {
        const s = i / P, p0 = pt(s), p1 = pt(s + 0.05);
        const ll = L * 0.22 * Math.sin(Math.PI * Math.min(1, s * 1.2)) * (1 - s * 0.3);
        for (const sd of [1, -1]) {
          const tip = p0.clone().addScaledVector(side, sd * ll).addScaledVector(dir, ll * 0.3); tip.y -= ll * 0.25;
          pos.push(p0.x, p0.y, p0.z, tip.x, tip.y, tip.z, p1.x, p1.y, p1.z);
          const k = 0.7 + s * 0.4;
          for (let v = 0; v < 3; v++) col.push(...mulC(gc, k * (v === 1 ? 1.15 : 1)).map(x => (x / 255) ** 2.2));
        }
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}

function grassGeometry(count, area, avoidR, rnd, hf, colors, hmin = 0.3, hmax = 0.9) {
  const pos = [], col = [];
  for (let i = 0; i < count; i++) {
    const clumpX = (rnd() - 0.5) * area, clumpZ = (rnd() - 0.5) * area;
    if (Math.hypot(clumpX, clumpZ) < avoidR) continue;
    for (let b = 0; b < 8; b++) {
      const x = clumpX + (rnd() - 0.5) * 0.8, z = clumpZ + (rnd() - 0.5) * 0.8, y = hf(x, z);
      const h = hmin + rnd() * (hmax - hmin), a = rnd() * TAU, w = 0.035 + rnd() * 0.03, bend = (rnd() - 0.2) * 0.5;
      const dx = Math.cos(a) * w, dz = Math.sin(a) * w, bx = Math.sin(a) * bend * h, bz = Math.cos(a) * bend * h;
      const c = colors[(rnd() * colors.length) | 0];
      pos.push(x - dx, y, z - dz, x + dx, y, z + dz, x + bx, y + h, z + bz);
      const cb = mulC(c, 0.55), ct = mulC(c, 1.1);
      for (const cc of [cb, cb, ct]) col.push(...cc.map(v => (clamp(v, 0, 255) / 255) ** 2.2));
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}

// ================================================================ World
class World {
  constructor(renderer, scene, camera) {
    this.renderer = renderer; this.scene = scene; this.camera = camera;
    this.night = false; this.season = 'summer'; this.time = 0;
    this.habs = {}; this.cur = null;
    this.sunDir = new V3(0.45, 0.8, 0.35).normalize();
    this._lights(); this._sky();
    this.fx = new Particles(900, { additive: true });
    this.dust = new Particles(700);
    this.weather = new Particles(3000);
    scene.add(this.fx.points, this.dust.points, this.weather.points);
    this.extras = new THREE.Group(); scene.add(this.extras);
    this._leaves();
    this.weatherKind = null;
    this.snowCover = 0;
  }

  _lights() {
    const s = this.scene;
    this.hemi = new THREE.HemisphereLight(0xcfe3ff, 0x4a4030, 0.9); s.add(this.hemi);
    const sun = this.sun = new THREE.DirectionalLight(0xfff1d6, 2.6);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03;
    sun.shadow.camera.near = 1; sun.shadow.camera.far = 120;
    s.add(sun, sun.target);
    this.fill = new THREE.DirectionalLight(0x9ab8ff, 0.4); s.add(this.fill);
    this.setShadowSize(14);
  }
  setShadowSize(h) { const c = this.sun.shadow.camera; c.left = c.bottom = -h; c.right = c.top = h; c.updateProjectionMatrix(); }

  _sky() {
    this.skyU = {
      top: { value: new THREE.Color() }, horizon: { value: new THREE.Color() }, bottom: { value: new THREE.Color() },
      sunDir: { value: this.sunDir }, sunCol: { value: new THREE.Color(1, 0.95, 0.85) }, sunAmt: { value: 1 },
    };
    const m = new THREE.ShaderMaterial({
      uniforms: this.skyU, side: THREE.BackSide, depthWrite: false, fog: false,
      vertexShader: `varying vec3 vD; void main(){ vD=position; vec4 p=projectionMatrix*modelViewMatrix*vec4(position,1.0); gl_Position=p.xyww; }`,
      fragmentShader: `uniform vec3 top,horizon,bottom,sunDir,sunCol; uniform float sunAmt; varying vec3 vD;
        void main(){ vec3 d=normalize(vD); float h=d.y;
          vec3 c = h>0.0 ? mix(horizon, top, pow(h,0.55)) : mix(horizon, bottom, pow(-h,0.35));
          float s=max(dot(d,normalize(sunDir)),0.0);
          c += sunCol*(pow(s,900.0)*6.0 + pow(s,12.0)*0.18)*sunAmt;
          gl_FragColor=vec4(c,1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(400, 32, 16), m);
    this.sky.renderOrder = -10;
    this.scene.add(this.sky);
    const sp = [], r = mulberry32(2);
    for (let i = 0; i < 1500; i++) { const u = r() * TAU, v = r() * 0.9 + 0.05; const y = v, rr = Math.sqrt(1 - y * y); sp.push(Math.cos(u) * rr * 380, y * 380, Math.sin(u) * rr * 380); }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
    this.stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 1.3, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.85 }));
    this.stars.visible = false;
    this.scene.add(this.stars);
    this.moon = new THREE.Mesh(new THREE.SphereGeometry(8, 24, 16), new THREE.MeshBasicMaterial({ color: 0xf0f0e0, fog: false }));
    this.moon.visible = false; this.scene.add(this.moon);
  }

  _leaves() {
    const geo = new THREE.PlaneGeometry(0.28, 0.2);
    const m = new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.8 });
    this.leafIM = new THREE.InstancedMesh(geo, m, 160);
    this.leafData = [];
    const cols = [0xc86a28, 0xd89a38, 0xa04a20, 0xe0b048, 0x8a5a2a];
    for (let i = 0; i < 160; i++) { this.leafIM.setColorAt(i, new THREE.Color(cols[i % 5])); this.leafData.push({ p: new V3(0, -99, 0), r: new V3(), w: new V3(rand(-2, 2), rand(-2, 2), rand(-2, 2)) }); }
    this.leafIM.visible = false; this.leafIM.castShadow = true;
    this.scene.add(this.leafIM);
  }

  heightAt(x, z) { return this.cur ? this.cur.heightAt(x, z) : 0; }

  // ============================================================ 栖息地
  getHab(id) {
    if (!this.habs[id]) {
      const b = { forest: () => this._forest(), desert: () => this._desert(), bamboo: () => this._bamboo(), ocean: () => this._ocean() }[id];
      this.habs[id] = b();
      this.habs[id].group.visible = false;
      this.scene.add(this.habs[id].group);
    }
    return this.habs[id];
  }

  setHabitat(id, habObj) {
    const h = habObj || this.getHab(id);
    for (const k in this.habs) if (this.habs[k] !== h) this.habs[k].group.visible = false;
    if (this.den && this.den !== h) this.den.group.visible = false;
    h.group.visible = true;
    this.cur = h;
    this.clearTracks();
    this.applyLighting();
  }

  _terrain(hf, tex, rep, size = 170, seg = 200, color = 0xffffff) {
    const g = new THREE.PlaneGeometry(size, size, seg, seg); g.rotateX(-Math.PI / 2);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) p.setY(i, hf(p.getX(i), p.getZ(i)));
    g.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({ map: repTex(tex.map, rep), normalMap: repTex(tex.normal, rep, false), roughness: 0.95, color });
    const m = new THREE.Mesh(g, mat); m.receiveShadow = true;
    m.userData.temp = 0.18;
    return m;
  }

  _bumps(list) {
    return (x, z) => {
      let h = 0;
      for (const b of list) { const d = Math.hypot((x - b.x) / b.sx, (z - b.z) / b.sz); if (d < 1) h = Math.max(h, b.h * smoothstep(1, b.flat, d)); }
      return h;
    };
  }

  _rock(parent, x, z, sx, sy, sz, tex, seed, hf, sink = 0.3) {
    const m = new THREE.Mesh(makeRockGeo(seed), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.92 }));
    m.scale.set(sx, sy, sz); m.position.set(x, hf(x, z) - sy * sink, z); m.rotation.y = seed;
    m.castShadow = m.receiveShadow = true; m.userData.temp = 0.25;
    parent.add(m); return m;
  }

  _forest() {
    const g = new THREE.Group(), rnd = mulberry32(11);
    const baskRock = { x: 9, z: -7, sx: 4.2, sz: 3.2, h: 0.9, flat: 0.55 };
    const bump = this._bumps([baskRock]);
    const hf = (x, z) => { const r = Math.hypot(x, z); return (fbm(x * 0.035, z * 0.035, 3, 1) - 0.5) * 3.2 * smoothstep(14, 34, r) + (fbm(x * 0.12, z * 0.12, 2, 2) - 0.5) * 0.4 + bump(x, z); };
    g.add(this._terrain(hf, groundTextures('forest'), 17));
    const rt = rockTexture([118, 112, 100]);
    const br = this._rock(g, baskRock.x, baskRock.z, baskRock.sx * 1.02, 1.3, baskRock.sz * 1.02, rt, 3.3, (x, z) => hf(x, z) - baskRock.h, 0.3);
    br.userData.temp = 0.55;
    const obstacles = [];
    for (let i = 0; i < 16; i++) {
      const a = rnd() * TAU, r = 16 + rnd() * 30, x = Math.cos(a) * r, z = Math.sin(a) * r, s = 0.8 + rnd() * 2.2;
      this._rock(g, x, z, s * 1.3, s, s, rt, i * 1.7, hf); obstacles.push({ x, z, r: s * 1.3 });
    }
    const bark = barkTexture();
    const logMat = new THREE.MeshStandardMaterial({ map: bark, roughness: 0.95 });
    for (const [x, z, a, l, r] of [[-12, 8, 0.6, 9, 0.7], [15, 12, -0.3, 7, 0.55], [-6, -17, 1.4, 10, 0.8]]) {
      const log = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.1, l, 18), logMat);
      log.rotation.set(0, a, Math.PI / 2); log.position.set(x, hf(x, z) + r * 0.7, z);
      log.castShadow = log.receiveShadow = true; g.add(log);
      obstacles.push({ x, z, r: l * 0.45 });
    }
    const trunkMat = new THREE.MeshStandardMaterial({ map: bark, roughness: 0.95 });
    bark.repeat.set(2, 6);
    for (let i = 0; i < 22; i++) {
      const a = rnd() * TAU, r = 24 + rnd() * 45, x = Math.cos(a) * r, z = Math.sin(a) * r, rr = 0.8 + rnd() * 1.2;
      const t = new THREE.Mesh(new THREE.CylinderGeometry(rr * 0.8, rr * 1.3, 40, 16), trunkMat);
      t.position.set(x, hf(x, z) + 19, z); t.castShadow = true; g.add(t);
      obstacles.push({ x, z, r: rr * 1.5 });
    }
    const ferns = new THREE.Mesh(fernGeometry(40, 70, 9, rnd), new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.8 }));
    const fp = ferns.geometry.attributes.position; for (let i = 0; i < fp.count; i++) fp.setY(i, fp.getY(i) + hf(fp.getX(i), fp.getZ(i)));
    ferns.castShadow = true; g.add(ferns);
    const grass = new THREE.Mesh(grassGeometry(420, 90, 7, rnd, hf, [[70, 110, 40], [96, 130, 50], [120, 130, 60]]), new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.9 }));
    g.add(grass);
    const mush = new THREE.MeshStandardMaterial({ color: 0xc8a070, roughness: 0.7 }), stem = new THREE.MeshStandardMaterial({ color: 0xeee0c8 });
    for (let i = 0; i < 14; i++) {
      const x = (rnd() - 0.5) * 40, z = (rnd() - 0.5) * 40; if (Math.hypot(x, z) < 6) continue;
      const s = 0.15 + rnd() * 0.2, y = hf(x, z);
      const st = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.25, s * 0.3, s * 1.4, 8), stem); st.position.set(x, y + s * 0.7, z); g.add(st);
      const cp = new THREE.Mesh(new THREE.SphereGeometry(s, 14, 8, 0, TAU, 0, Math.PI / 2), mush); cp.position.set(x, y + s * 1.3, z); cp.scale.y = 0.6; g.add(cp);
    }
    return {
      id: 'forest', group: g, heightAt: hf, roam: 22, center: new V3(0, 0, 0), obstacles,
      spots: { bask: new V3(baskRock.x, 0, baskRock.z), rub: { x: 16, z: -3 }, nest: new V3(-5, 0, 4) },
      sky: { top: 0x5f93d0, horizon: 0xd6e4e0, bottom: 0x3a4230, fog: 0xbfd0c4, near: 45, far: 150 },
      light: { sun: 2.5, hemi: 0.85, sunCol: 0xfff0d8 },
    };
  }

  _desert() {
    const g = new THREE.Group(), rnd = mulberry32(21);
    const baskRock = { x: -9, z: 6, sx: 3.8, sz: 2.8, h: 0.8, flat: 0.5 };
    const bump = this._bumps([baskRock]);
    const hf = (x, z) => {
      const r = Math.hypot(x, z);
      const dune = (Math.sin(x * 0.075 + fbm(x * 0.02, z * 0.02, 2, 4) * 5) * 0.5 + 0.5) * 3.2 * smoothstep(12, 36, r);
      return dune + (fbm(x * 0.05, z * 0.05, 3, 6) - 0.5) * 0.9 + bump(x, z);
    };
    g.add(this._terrain(hf, groundTextures('desert'), 14));
    const rt = rockTexture([168, 110, 76]);
    const br = this._rock(g, baskRock.x, baskRock.z, baskRock.sx * 1.02, 1.1, baskRock.sz * 1.02, rt, 5.1, (x, z) => hf(x, z) - baskRock.h, 0.3);
    br.userData.temp = 0.7;
    const obstacles = [];
    for (let i = 0; i < 14; i++) {
      const a = rnd() * TAU, r = 15 + rnd() * 30, x = Math.cos(a) * r, z = Math.sin(a) * r, s = 0.7 + rnd() * 2.5;
      this._rock(g, x, z, s * 1.4, s * 0.9, s, rt, i * 2.3, hf); obstacles.push({ x, z, r: s * 1.4 });
    }
    // 仙人掌（萨瓜罗）
    const cactMat = new THREE.MeshStandardMaterial({ color: 0x4f7a48, roughness: 0.7 });
    const ribbed = (r, h) => {
      const geo = new THREE.CylinderGeometry(r, r, h, 36, 8);
      const p = geo.attributes.position;
      for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i), a = Math.atan2(z, x), k = 1 + 0.09 * Math.cos(a * 12); p.setX(i, x * k); p.setZ(i, z * k); }
      geo.computeVertexNormals(); return geo;
    };
    for (let i = 0; i < 6; i++) {
      const a = rnd() * TAU, r = 18 + rnd() * 30, x = Math.cos(a) * r, z = Math.sin(a) * r, h = 5 + rnd() * 5, cr = 0.45 + rnd() * 0.2;
      const c = new THREE.Group(); c.position.set(x, hf(x, z), z);
      const t = new THREE.Mesh(ribbed(cr, h), cactMat); t.position.y = h / 2; c.add(t);
      const cap = new THREE.Mesh(new THREE.SphereGeometry(cr * 1.05, 24, 12, 0, TAU, 0, Math.PI / 2), cactMat); cap.position.y = h; c.add(cap);
      for (let k = 0; k < 2; k++) {
        const sd = k ? -1 : 1, ay = h * (0.35 + rnd() * 0.25), ah = 1.5 + rnd() * 2;
        const curve = new THREE.CatmullRomCurve3([new V3(0, ay, 0), new V3(sd * 1.2, ay - 0.2, 0), new V3(sd * 1.5, ay + 0.6, 0), new V3(sd * 1.5, ay + ah, 0)]);
        c.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 20, cr * 0.65, 16), cactMat));
        const ac = new THREE.Mesh(new THREE.SphereGeometry(cr * 0.66, 16, 8, 0, TAU, 0, Math.PI / 2), cactMat); ac.position.set(sd * 1.5, ay + ah, 0); c.add(ac);
      }
      c.rotation.y = rnd() * TAU; c.traverse(o => { if (o.isMesh) o.castShadow = true; }); g.add(c);
      obstacles.push({ x, z, r: 2 });
    }
    // 灌木（石炭酸灌木）
    const bushMat = new THREE.MeshStandardMaterial({ color: 0x5a6a38, roughness: 0.9, flatShading: true });
    for (let i = 0; i < 16; i++) {
      const a = rnd() * TAU, r = 13 + rnd() * 35, x = Math.cos(a) * r, z = Math.sin(a) * r;
      const b = new THREE.Group(); b.position.set(x, hf(x, z), z);
      for (let k = 0; k < 6; k++) { const s = 0.5 + rnd() * 0.7; const m = new THREE.Mesh(makeRockGeo(k + i, 1), bushMat); m.scale.set(s, s * 0.8, s); m.position.set((rnd() - 0.5) * 1.4, 0.5 + rnd() * 0.8, (rnd() - 0.5) * 1.4); b.add(m); }
      b.traverse(o => { if (o.isMesh) o.castShadow = true; }); g.add(b);
    }
    g.add(new THREE.Mesh(grassGeometry(200, 90, 10, rnd, hf, [[190, 170, 110], [170, 150, 90], [150, 140, 90]], 0.3, 0.7), new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide })));
    // 足迹层
    this._trackLayer(g, hf, 0x8a7550);
    return {
      id: 'desert', group: g, heightAt: hf, roam: 22, center: new V3(0, 0, 0), obstacles, tracks: true,
      spots: { bask: new V3(baskRock.x, 0, baskRock.z), rub: { x: 17, z: 4 }, nest: new V3(5, 0, -4) },
      sky: { top: 0x3a78d0, horizon: 0xf0dcc0, bottom: 0x8a7050, fog: 0xead8b8, near: 55, far: 170 },
      light: { sun: 3.1, hemi: 0.8, sunCol: 0xfff0d0 },
    };
  }

  _bamboo() {
    const g = new THREE.Group(), rnd = mulberry32(31);
    const hf = (x, z) => { const r = Math.hypot(x, z); return (fbm(x * 0.04, z * 0.04, 3, 7) - 0.5) * 2.6 * smoothstep(12, 30, r) + (fbm(x * 0.13, z * 0.13, 2, 8) - 0.5) * 0.35; };
    g.add(this._terrain(hf, groundTextures('bamboo'), 17));
    const c = mkCanvas(64, 256), cg = c.getContext('2d');
    const grd = cg.createLinearGradient(0, 0, 64, 0);
    grd.addColorStop(0, '#4f7a2c'); grd.addColorStop(0.5, '#86a846'); grd.addColorStop(1, '#4a7028');
    cg.fillStyle = grd; cg.fillRect(0, 0, 64, 256);
    cg.fillStyle = 'rgba(230,236,200,0.55)'; cg.fillRect(0, 232, 64, 10);
    cg.fillStyle = '#3c5a20'; cg.fillRect(0, 246, 64, 10);
    for (let i = 0; i < 40; i++) { cg.fillStyle = `rgba(40,70,20,${Math.random() * 0.2})`; cg.fillRect(Math.random() * 64, 0, 2, 256); }
    const btex = new THREE.CanvasTexture(c); btex.wrapS = btex.wrapT = THREE.RepeatWrapping; btex.colorSpace = THREE.SRGBColorSpace;
    const obstacles = [];
    const stalk = (x, z, r, h) => {
      const t = btex.clone(); t.needsUpdate = true; t.repeat.set(1, h / 1.8);
      const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.05, h, 16, 1), new THREE.MeshStandardMaterial({ map: t, roughness: 0.55 }));
      m.position.set(x, hf(x, z) + h / 2 - 0.2, z); m.castShadow = true; m.receiveShadow = true; g.add(m);
      obstacles.push({ x, z, r: r + 0.4 });
      return m;
    };
    const perchStalk = new V3(3, 0, -5);
    stalk(perchStalk.x, perchStalk.z, 0.32, 38);
    for (let i = 0; i < 70; i++) {
      const a = rnd() * TAU, r = 9 + rnd() * 45, x = Math.cos(a) * r, z = Math.sin(a) * r;
      const n = 1 + (rnd() * 4 | 0);
      for (let k = 0; k < n; k++) stalk(x + (rnd() - 0.5) * 2, z + (rnd() - 0.5) * 2, 0.2 + rnd() * 0.2, 30 + rnd() * 15);
    }
    // 叶片
    const lc = mkCanvas(64, 256), lg = lc.getContext('2d');
    lg.fillStyle = '#5a8a30'; lg.beginPath(); lg.moveTo(32, 0); lg.quadraticCurveTo(64, 128, 32, 256); lg.quadraticCurveTo(0, 128, 32, 0); lg.fill();
    lg.strokeStyle = '#3a6a20'; lg.lineWidth = 2; lg.beginPath(); lg.moveTo(32, 4); lg.lineTo(32, 250); lg.stroke();
    const ltex = new THREE.CanvasTexture(lc); ltex.colorSpace = THREE.SRGBColorSpace;
    const leafIM = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.28, 1.1), new THREE.MeshStandardMaterial({ map: ltex, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.6 }), 900);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
    for (let i = 0; i < 900; i++) {
      const a = rnd() * TAU, r = 6 + rnd() * 40;
      const x = Math.cos(a) * r, z = Math.sin(a) * r, y = hf(x, z) + 2.5 + rnd() * 9;
      e.set(rnd() * 1.2 - 0.3, rnd() * TAU, rnd() * 0.8); q.setFromEuler(e);
      m4.compose(new V3(x, y, z), q, new V3(1, 1, 1)); leafIM.setMatrixAt(i, m4);
      leafIM.setColorAt(i, new THREE.Color().setHSL(0.24 + rnd() * 0.06, 0.5, 0.3 + rnd() * 0.2));
    }
    leafIM.castShadow = true; g.add(leafIM);
    // 栖枝：从竹竿横伸出的一根细竹枝
    const by = 2.7, b0 = new V3(perchStalk.x, hf(perchStalk.x, perchStalk.z) + by, perchStalk.z), b1 = b0.clone().add(new V3(11, 0.5, 2));
    const br = 0.17;
    const brMesh = new THREE.Mesh(new THREE.CylinderGeometry(br * 0.8, br, b0.distanceTo(b1), 14), new THREE.MeshStandardMaterial({ map: btex, roughness: 0.6 }));
    brMesh.position.copy(b0).lerp(b1, 0.5);
    brMesh.quaternion.setFromUnitVectors(UP, new V3().subVectors(b1, b0).normalize());
    brMesh.castShadow = brMesh.receiveShadow = true; g.add(brMesh);
    for (let i = 0; i < 26; i++) {
      const f = 0.3 + (i / 26) * 0.7, p = b0.clone().lerp(b1, f);
      const lm = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 1.1), new THREE.MeshStandardMaterial({ map: ltex, alphaTest: 0.4, side: THREE.DoubleSide, color: 0xa8d080 }));
      lm.position.copy(p).add(new V3(0, (i % 2 ? -0.5 : 0.45), (i % 3 - 1) * 0.35)); lm.rotation.set((i % 2 ? 2.6 : 0.4), rnd() * 3, rnd() - 0.5); g.add(lm);
    }
    const ferns = new THREE.Mesh(fernGeometry(45, 70, 7, rnd), new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.8 }));
    const fp = ferns.geometry.attributes.position; for (let i = 0; i < fp.count; i++) fp.setY(i, fp.getY(i) + hf(fp.getX(i), fp.getZ(i)));
    g.add(ferns);
    const rt = rockTexture([110, 118, 100]);
    for (let i = 0; i < 10; i++) { const a = rnd() * TAU, r = 12 + rnd() * 25, s = 0.6 + rnd() * 1.4; this._rock(g, Math.cos(a) * r, Math.sin(a) * r, s * 1.3, s, s, rt, i * 3.1, hf); }
    return {
      id: 'bamboo', group: g, heightAt: hf, roam: 16, center: new V3(2, 0, 3), obstacles,
      perch: { stalk: new V3(perchStalk.x, hf(perchStalk.x, perchStalk.z), perchStalk.z), stalkR: 0.32, b0, b1, r: br },
      spots: { bask: new V3(-6, 0, 6), rub: { x: -9, z: -6 }, nest: new V3(-4, 0, 6) },
      sky: { top: 0x88aec8, horizon: 0xd6e6d4, bottom: 0x405030, fog: 0xbcd0bc, near: 22, far: 95 },
      light: { sun: 1.9, hemi: 1.0, sunCol: 0xfff4e0 },
    };
  }

  _ocean() {
    const g = new THREE.Group(), rnd = mulberry32(41);
    const hf = (x, z) => (fbm(x * 0.04, z * 0.04, 3, 3) - 0.5) * 3 + (fbm(x * 0.2, z * 0.2, 2, 5) - 0.5) * 0.3;
    const tex = groundTextures('sea');
    const floor = this._terrain(hf, tex, 14);
    // 焦散
    const cc = mkCanvas(512, 512), cg = cc.getContext('2d'), img = cg.createImageData(512, 512);
    const P = 8, grid = [];
    for (let i = 0; i < P; i++) { grid.push([]); for (let j = 0; j < P; j++) grid[i].push([rnd(), rnd()]); }
    for (let y = 0; y < 512; y++) for (let x = 0; x < 512; x++) {
      const u = x / 512 * P, v = y / 512 * P, ci = Math.floor(u), cj = Math.floor(v); let d1 = 9, d2 = 9;
      for (let oi = -1; oi <= 1; oi++) for (let oj = -1; oj <= 1; oj++) {
        const gi = ci + oi, gj = cj + oj, q = grid[(gi + P) % P][(gj + P) % P];
        const dx = u - gi - q[0], dy = v - gj - q[1], d = (dx * dx + dy * dy) / (P * P);
        if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d;
      }
      const e = Math.sqrt(d2) - Math.sqrt(d1);
      const l = Math.pow(clamp(1 - e * 14, 0, 1), 3) * 255;
      const k = (y * 512 + x) * 4; img.data[k] = img.data[k + 1] = img.data[k + 2] = l; img.data[k + 3] = 255;
    }
    cg.putImageData(img, 0, 0);
    this.caustic = repTex(cc, 10);
    floor.material.emissiveMap = this.caustic; floor.material.emissive = new THREE.Color(0x6fd8e8); floor.material.emissiveIntensity = 0.55;
    g.add(floor);
    const surfY = 15;
    // 水面
    const wc = mkCanvas(256, 256), wg = wc.getContext('2d'), wi = wg.createImageData(256, 256);
    for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) { const h = fbmP(x / 32, y / 32, 8, 4, 6) * 255; const k = (y * 256 + x) * 4; wi.data[k] = wi.data[k + 1] = wi.data[k + 2] = h; wi.data[k + 3] = 255; }
    wg.putImageData(wi, 0, 0);
    this.waterN = repTex(heightToNormal(wc, 6), 12, false);
    const water = new THREE.Mesh(new THREE.PlaneGeometry(420, 420), new THREE.MeshPhysicalMaterial({ color: 0x7fd0e0, normalMap: this.waterN, normalScale: new THREE.Vector2(0.6, 0.6), roughness: 0.05, transparent: true, opacity: 0.72, side: THREE.DoubleSide, envMapIntensity: 1.5 }));
    water.rotation.x = -Math.PI / 2; water.position.y = surfY; g.add(water);
    // 光束
    const rayMat = new THREE.MeshBasicMaterial({ color: 0x9fe8ff, transparent: true, opacity: 0.06, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
    this.rays = [];
    for (let i = 0; i < 9; i++) {
      const r = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 4, surfY + 4, 16, 1, true), rayMat.clone());
      r.position.set(rand(-25, 25), surfY / 2, rand(-25, 25)); r.rotation.z = 0.25; r.rotation.x = 0.1;
      g.add(r); this.rays.push(r);
    }
    // 珊瑚
    const obstacles = [];
    const coralCols = [0xe06a5a, 0xf0a040, 0xb05ab0, 0xf2d0a0, 0x60b0a0, 0xe87aa0];
    const branch = (parent, p, dir, len, r, depth, mat) => {
      const end = p.clone().addScaledVector(dir, len);
      const m = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.75, r, len, 7), mat);
      m.position.copy(p).lerp(end, 0.5); m.quaternion.setFromUnitVectors(UP, dir); parent.add(m);
      if (depth <= 0) { const tip = new THREE.Mesh(new THREE.SphereGeometry(r * 0.8, 8, 6), mat); tip.position.copy(end); parent.add(tip); return; }
      for (let k = 0; k < 2 + (rnd() * 2 | 0); k++) {
        const nd = dir.clone().add(new V3(rnd() - 0.5, rnd() * 0.3, rnd() - 0.5).multiplyScalar(1.1)).normalize();
        branch(parent, end, nd, len * 0.75, r * 0.72, depth - 1, mat);
      }
    };
    for (let i = 0; i < 26; i++) {
      const a = rnd() * TAU, r = 9 + rnd() * 30, x = Math.cos(a) * r, z = Math.sin(a) * r;
      const grp = new THREE.Group(); grp.position.set(x, hf(x, z) - 0.1, z);
      const mat = new THREE.MeshStandardMaterial({ color: coralCols[i % coralCols.length], roughness: 0.7, emissive: coralCols[i % coralCols.length], emissiveIntensity: 0.08 });
      if (i % 3 === 0) { const b = new THREE.Mesh(makeRockGeo(i, 0.7), mat); b.scale.setScalar(0.8 + rnd()); b.position.y = 0.3; grp.add(b); }
      else branch(grp, new V3(0, 0, 0), UP.clone(), 0.9 + rnd() * 0.6, 0.18, 3, mat);
      grp.traverse(o => { if (o.isMesh) o.castShadow = true; }); g.add(grp);
      obstacles.push({ x, z, r: 1.5 });
    }
    const rt = rockTexture([96, 104, 100]);
    for (let i = 0; i < 12; i++) { const a = rnd() * TAU, r = 14 + rnd() * 30, s = 1 + rnd() * 2.5; const x = Math.cos(a) * r, z = Math.sin(a) * r; this._rock(g, x, z, s * 1.4, s, s * 1.1, rt, i * 1.3, hf); obstacles.push({ x, z, r: s * 1.4 }); }
    // 海藻
    this.kelp = [];
    const kelpMat = new THREE.MeshStandardMaterial({ color: 0x5a7a2a, side: THREE.DoubleSide, roughness: 0.6, transparent: true, opacity: 0.95 });
    for (let i = 0; i < 30; i++) {
      const a = rnd() * TAU, r = 12 + rnd() * 30, x = Math.cos(a) * r, z = Math.sin(a) * r, h = 5 + rnd() * 7;
      const geo = new THREE.PlaneGeometry(0.5, h, 1, 20); geo.translate(0, h / 2, 0);
      const m = new THREE.Mesh(geo, kelpMat); m.position.set(x, hf(x, z), z); m.rotation.y = rnd() * 3;
      m.userData.base = geo.attributes.position.array.slice(); m.userData.ph = rnd() * 6;
      g.add(m); this.kelp.push(m);
    }
    // 鱼群
    const fg = new THREE.ConeGeometry(0.12, 0.55, 6); fg.rotateX(Math.PI / 2);
    this.fish = new THREE.InstancedMesh(fg, new THREE.MeshStandardMaterial({ color: 0xc8d8e0, metalness: 0.4, roughness: 0.3 }), 40);
    this.fishData = Array.from({ length: 40 }, () => ({ o: new V3(rand(-3, 3), rand(-1.5, 1.5), rand(-3, 3)), ph: rnd() * TAU }));
    g.add(this.fish);
    return {
      id: 'ocean', group: g, heightAt: hf, roam: 20, center: new V3(0, 0, 0), obstacles, water: true, surfY,
      swimMin: 2.5, swimMax: 11, spots: { bask: new V3(0, 0, 0), rub: { x: 10, z: -8 }, nest: new V3(0, 0, 0) },
      sky: { top: 0x0e5a78, horizon: 0x1a7890, bottom: 0x06304a, fog: 0x0f5d73, density: 0.028 },
      light: { sun: 1.7, hemi: 0.9, sunCol: 0xd8f4ff },
    };
  }

  // 沙地足迹层
  _trackLayer(g, hf, color) {
    const n = 1024, S = 80;
    this.trackC = mkCanvas(n, n); this.trackG = this.trackC.getContext('2d');
    this.trackTex = new THREE.CanvasTexture(this.trackC);
    const geo = new THREE.PlaneGeometry(S, S, 160, 160); geo.rotateX(-Math.PI / 2);
    const p = geo.attributes.position; for (let i = 0; i < p.count; i++) p.setY(i, hf(p.getX(i), p.getZ(i)) + 0.025);
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, alphaMap: this.trackTex, transparent: true, depthWrite: false, roughness: 1, polygonOffset: true, polygonOffsetFactor: -2 }));
    m.receiveShadow = true;
    g.add(m);
    this.trackS = S; this.trackN = n;
  }
  stampTrack(x, z, r) {
    if (!this.cur?.tracks || !this.trackG) return;
    const n = this.trackN, S = this.trackS;
    const u = (x + S / 2) / S * n, v = (z + S / 2) / S * n, rr = Math.max(2, r / S * n);
    const g = this.trackG;
    const grd = g.createRadialGradient(u, v, 0, u, v, rr);
    grd.addColorStop(0, 'rgba(255,255,255,0.3)'); grd.addColorStop(0.6, 'rgba(255,255,255,0.18)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd; g.beginPath(); g.arc(u, v, rr, 0, TAU); g.fill();
    this.trackDirty = true;
  }
  clearTracks() { if (this.trackG) { this.trackG.clearRect(0, 0, this.trackN, this.trackN); this.trackDirty = true; } }

  // ============================================================ 冬眠洞穴（剖面）
  buildDen(snake) {
    if (this.den) { this.scene.remove(this.den.group); this.den.group.traverse(o => { if (o.isMesh) o.geometry.dispose(); }); this.den.labels?.forEach(d => d.remove()); }
    const L = snake.L, R = snake.R;
    const spacing = 2 * R * 1.1, rMin = Math.max(2.4 * R, 0.4);
    const r0 = Math.sqrt(L * 0.9 * spacing / Math.PI + rMin * rMin);
    const chW = r0 * 1.3 + 0.4, chH = Math.max(R * 5, r0 * 0.6), chD = r0 * 1.2;
    const Wb = Math.max(22, chW * 7), Hb = Math.max(9, chH * 4.2), Db = Math.max(14, chD * 3);
    const z0 = 3, floorY = -Hb * 0.74, frostY = -Hb * 0.3;
    const xE = -Wb * 0.28, xC = Wb * 0.14;
    const tR = R * 1.7;
    const g = new THREE.Group();
    // 隧道路径（前剖面内）
    const tctrl = [new V3(xE, tR * 0.2, z0), new V3(xE + Wb * 0.04, -Hb * 0.16, z0), new V3(xE - Wb * 0.02, -Hb * 0.36, z0), new V3(xE + Wb * 0.1, -Hb * 0.55, z0), new V3(xC - chW * 0.95, floorY + tR * 0.9, z0)];
    const tunnel = new THREE.CatmullRomCurve3(tctrl);
    // 前剖面贴图
    const pxu = 1024 / Wb, cw = 1024, ch = Math.round(Hb * pxu);
    const fc = mkCanvas(cw, ch), fg2 = fc.getContext('2d');
    const X = x => (x + Wb / 2) * pxu, Y = y => -y * pxu;
    const img = fg2.createImageData(cw, ch);
    for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
      const d = y / pxu, f = fbm(x / 60, y / 60, 3, 4);
      let c = d < Hb * 0.12 ? [58, 42, 28] : d < Hb * 0.5 ? mixC([98, 74, 50], [120, 92, 62], f) : mixC([140, 110, 76], [110, 100, 90], smoothstep(Hb * 0.7, Hb, d));
      c = mulC(c, 0.85 + f * 0.3);
      const k = (y * cw + x) * 4; img.data[k] = c[0]; img.data[k + 1] = c[1]; img.data[k + 2] = c[2]; img.data[k + 3] = 255;
    }
    fg2.putImageData(img, 0, 0);
    const r = mulberry32(5);
    for (let i = 0; i < 90; i++) { const x = r() * cw, y = (0.2 + r() * 0.8) * ch, s = 3 + r() * 14; fg2.fillStyle = rgb(mixC([130, 125, 115], [90, 86, 80], r())); fg2.beginPath(); fg2.ellipse(x, y, s * 1.4, s, r() * 3, 0, TAU); fg2.fill(); }
    fg2.strokeStyle = 'rgba(60,40,24,0.8)';
    for (let i = 0; i < 14; i++) { let x = r() * cw, y = 0; fg2.lineWidth = 2 + r() * 3; fg2.beginPath(); fg2.moveTo(x, y); for (let k = 0; k < 10; k++) { x += (r() - 0.5) * 30; y += 10 + r() * 20; fg2.lineTo(x, y); } fg2.stroke(); }
    fg2.setLineDash([14, 10]); fg2.strokeStyle = 'rgba(140,200,255,0.9)'; fg2.lineWidth = 3;
    fg2.beginPath(); fg2.moveTo(0, Y(frostY)); fg2.lineTo(cw, Y(frostY)); fg2.stroke(); fg2.setLineDash([]);
    fg2.fillStyle = 'rgba(200,230,255,0.25)'; fg2.fillRect(0, 0, cw, Y(frostY));
    // 洞穴边缘阴影 + 挖空
    const tpts = tunnel.getSpacedPoints(80);
    const cutShapes = (w, style) => {
      fg2.strokeStyle = style; fg2.fillStyle = style; fg2.lineWidth = w; fg2.lineCap = 'round';
      fg2.beginPath(); tpts.forEach((p, i) => i ? fg2.lineTo(X(p.x), Y(p.y)) : fg2.moveTo(X(p.x), Y(p.y))); fg2.stroke();
      fg2.beginPath(); fg2.ellipse(X(xC), Y(floorY), chW * pxu + w / 2, chH * pxu + w / 2, 0, Math.PI, TAU); fg2.fill();
      fg2.fillRect(X(xC) - chW * pxu - w / 2, Y(floorY) - 1, chW * pxu * 2 + w, w / 2);
    };
    cutShapes(tR * 2 * pxu + 14, 'rgba(30,20,12,0.85)');
    fg2.globalCompositeOperation = 'destination-out';
    cutShapes(tR * 2 * pxu, '#000');
    fg2.globalCompositeOperation = 'source-over';
    const ftex = new THREE.CanvasTexture(fc); ftex.colorSpace = THREE.SRGBColorSpace;
    const front = new THREE.Mesh(new THREE.PlaneGeometry(Wb, Hb), new THREE.MeshStandardMaterial({ map: ftex, alphaTest: 0.5, roughness: 1, side: THREE.DoubleSide }));
    front.position.set(0, -Hb / 2, z0); g.add(front);
    const soilTex = repTex(groundTextures('den').map, 3);
    const soilMat = new THREE.MeshStandardMaterial({ color: 0x6a5238, roughness: 1, side: THREE.BackSide });
    const tube = new THREE.Mesh(new THREE.TubeGeometry(tunnel, 80, tR, 14), soilMat); tube.receiveShadow = true; g.add(tube);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 16, 0, TAU, 0, Math.PI / 2), soilMat);
    dome.scale.set(chW, chH, chD); dome.position.set(xC, floorY, z0); g.add(dome);
    const floor = new THREE.Mesh(new THREE.CircleGeometry(1, 40, 0, Math.PI), new THREE.MeshStandardMaterial({ color: 0x5a4430, roughness: 1 }));
    floor.rotation.x = -Math.PI / 2; floor.scale.set(chW, chD, 1); floor.position.set(xC, floorY + 0.01, z0); floor.receiveShadow = true; g.add(floor);
    // 侧/后壁
    const sideC = mkCanvas(256, 256), sg = sideC.getContext('2d'); sg.drawImage(fc, 0, 0, 256, 256);
    const sideMat = new THREE.MeshStandardMaterial({ color: 0x5a4632, roughness: 1 });
    for (const [w, x, z, ry] of [[Db, -Wb / 2, z0 - Db / 2, -Math.PI / 2], [Db, Wb / 2, z0 - Db / 2, Math.PI / 2], [Wb, 0, z0 - Db, Math.PI]]) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, Hb), sideMat); m.position.set(x, -Hb / 2, z); m.rotation.y = ry; g.add(m);
    }
    // 顶面（入口缺口）
    const tc = mkCanvas(512, 512), tg = tc.getContext('2d');
    tg.drawImage(groundTextures('den').map, 0, 0, 512, 512);
    tg.globalCompositeOperation = 'destination-out';
    tg.beginPath(); tg.arc((xE + Wb / 2) / Wb * 512, 512, tR * 1.05 / Wb * 512, 0, TAU); tg.fill();
    tg.globalCompositeOperation = 'source-over';
    const ttex = new THREE.CanvasTexture(tc); ttex.colorSpace = THREE.SRGBColorSpace;
    const top = new THREE.Mesh(new THREE.PlaneGeometry(Wb, Db), new THREE.MeshStandardMaterial({ map: ttex, alphaTest: 0.5, roughness: 1 }));
    top.rotation.x = -Math.PI / 2; top.position.set(0, 0, z0 - Db / 2); top.receiveShadow = true; g.add(top);
    // 积雪层
    const sc = mkCanvas(512, 512), sgc = sc.getContext('2d');
    sgc.drawImage(groundTextures('snow').map, 0, 0, 512, 512);
    sgc.globalCompositeOperation = 'destination-out';
    sgc.beginPath(); sgc.arc((xE + Wb / 2) / Wb * 512, 512, tR * 1.5 / Wb * 512, 0, TAU); sgc.fill();
    const stex = new THREE.CanvasTexture(sc); stex.colorSpace = THREE.SRGBColorSpace;
    this.snowMat = new THREE.MeshStandardMaterial({ map: stex, transparent: true, opacity: 0, roughness: 0.8, depthWrite: false });
    const snow = new THREE.Mesh(new THREE.PlaneGeometry(Wb, Db), this.snowMat);
    snow.rotation.x = -Math.PI / 2; snow.position.set(0, 0.05, z0 - Db / 2); snow.receiveShadow = true; g.add(snow);
    const snowEdge = new THREE.Mesh(new THREE.BoxGeometry(Wb, 0.25, 0.02), this.snowMat); snowEdge.position.set(0, -0.08, z0 + 0.01); g.add(snowEdge);
    // 入口石块、枯树、草
    const rt = rockTexture([120, 116, 108]);
    const hfTop = () => 0;
    for (let i = 0; i < 5; i++) { const a = Math.PI + i / 4 * Math.PI; this._rock(g, xE + Math.cos(a) * tR * 2.8, z0 + Math.sin(a) * tR * 2.4 - 0.2, 0.6 + (i % 2) * 0.4, 0.5, 0.6, rt, i * 2.2, hfTop, 0.2); }
    this._rock(g, xE - tR * 4, z0 - Db * 0.4, 1.6, 1.0, 1.4, rt, 9, hfTop, 0.3);
    const bark = barkTexture([80, 70, 60]);
    for (const [x, z, h] of [[Wb * 0.3, z0 - Db * 0.6, 12], [-Wb * 0.38, z0 - Db * 0.7, 14], [Wb * 0.05, z0 - Db * 0.85, 11]]) {
      const tr = new THREE.Group(); tr.position.set(x, 0, z);
      const bm = new THREE.MeshStandardMaterial({ map: bark, roughness: 1 });
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.45, h, 10), bm); trunk.position.y = h / 2; tr.add(trunk);
      for (let k = 0; k < 7; k++) { const bl = 2 + r() * 3; const b = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.14, bl, 6), bm); const a = r() * TAU, y = h * (0.45 + r() * 0.5); b.position.set(Math.cos(a) * bl * 0.4, y + bl * 0.3, Math.sin(a) * bl * 0.4); b.rotation.set(Math.sin(a) * 0.9, 0, -Math.cos(a) * 0.9); tr.add(b); }
      tr.traverse(o => { if (o.isMesh) o.castShadow = true; }); g.add(tr);
    }
    g.add(new THREE.Mesh(grassGeometry(260, Wb * 0.95, 0, r, () => 0, [[150, 130, 80], [130, 110, 70]], 0.2, 0.6).translate(0, 0, z0 - Db / 2), new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide })));
    const base = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshStandardMaterial({ color: 0x2a2e30, roughness: 1 }));
    base.rotation.x = -Math.PI / 2; base.position.y = -Hb - 0.02; base.receiveShadow = true; g.add(base);
    // 标签
    const CSS2DObject = ADDONS.CSS2DObject;
    const labels = [];
    const lab = (txt, p, cls = '') => { const d = document.createElement('div'); d.className = 'lbl den ' + cls; d.innerHTML = txt; const o = new CSS2DObject(d); o.position.copy(p); g.add(o); labels.push(d); return d; };
    this.denLabels = {
      surf: lab('地表 <b id="tSurf">—</b>', new V3(Wb * 0.32, 0.6, z0 + 0.3)),
      frost: lab('冻土线 · 其上土壤会冻结', new V3(-Wb * 0.42, frostY + 0.35, z0 + 0.2), 'frost'),
      den: lab('越冬洞穴 <b id="tDen">—</b>', new V3(xC + chW * 0.7, floorY + chH + 0.4, z0 + 0.3)),
    };
    this.scene.add(g);
    g.visible = false;
    const heightAt = (x, z) => (Math.abs(x) < Wb / 2 && z < z0 + 0.01 && z > z0 - Db) ? 0 : -Hb;
    this.den = {
      id: 'den', group: g, heightAt, roam: 8, center: new V3(xE, 0, z0 - 4), obstacles: [], labels,
      tunnel, xE, xC, z0, floorY, chW, chH, chD, r0, rMin, spacing, tR, Wb, Hb, Db, frostY,
      spots: {}, sky: { top: 0x8b9bb0, horizon: 0xcfd8e0, bottom: 0x40464c, fog: 0xc6ced6, near: 60, far: 180 },
      light: { sun: 1.3, hemi: 1.0, sunCol: 0xf0f4ff },
    };
    return this.den;
  }

  // ============================================================ 光照 / 天空
  applyLighting() {
    const h = this.cur; if (!h) return;
    const s = h.sky, nt = this.night && h.id !== 'ocean' && h.id !== 'den';
    const aut = this.season === 'autumn', win = this.season === 'winter';
    const col = c => new THREE.Color(c);
    let top = col(s.top), hor = col(s.horizon), bot = col(s.bottom), fog = col(s.fog);
    if (aut) { hor.lerp(col(0xe8c8a0), 0.5); fog.lerp(col(0xd8c0a0), 0.4); }
    if (win) { top.lerp(col(0x9aa8ba), 0.6); hor.lerp(col(0xdde4ea), 0.6); fog.lerp(col(0xd0d8e0), 0.6); }
    if (nt) { top = col(0x03060f); hor = col(0x16223a); bot = col(0x05070a); fog = col(0x0c1420); }
    this.skyU.top.value.copy(top); this.skyU.horizon.value.copy(hor); this.skyU.bottom.value.copy(bot);
    this.skyU.sunAmt.value = nt || h.water ? 0 : 1;
    this.sky.visible = !h.water;
    this.stars.visible = nt; this.moon.visible = nt;
    if (h.water) { this.scene.fog = new THREE.FogExp2(fog, s.density); this.scene.background = fog; }
    else { this.scene.fog = new THREE.Fog(fog, s.near * (nt ? 0.6 : 1), s.far * (nt ? 0.7 : 1)); this.scene.background = null; }
    const L = h.light;
    this.sun.intensity = nt ? 0.45 : L.sun * (aut ? 0.8 : win ? 0.7 : 1);
    this.sun.color.set(nt ? 0x8aa8ff : aut ? 0xffd8a8 : L.sunCol);
    this.hemi.intensity = nt ? 0.25 : L.hemi;
    this.hemi.color.set(nt ? 0x4a6090 : h.water ? 0x8fdcf0 : 0xcfe3ff);
    this.hemi.groundColor.set(nt ? 0x101418 : h.water ? 0x20405a : 0x4a4030);
    this.fill.intensity = nt ? 0.12 : 0.4;
    this.sunDir.set(aut || win ? 0.6 : 0.45, aut || win ? 0.45 : 0.8, 0.35).normalize();
    if (nt) this.moon.position.copy(this.sunDir).multiplyScalar(350);
    this.renderer.toneMappingExposure = nt ? 0.9 : 1.0;
    this.scene.environmentIntensity = nt ? 0.15 : h.water ? 0.5 : 0.6;
  }
  setNight(v) { this.night = v; this.applyLighting(); }
  setSeason(s) { this.season = s; this.applyLighting(); this.leafIM.visible = s === 'autumn'; if (s !== 'autumn') this.leafData.forEach(d => d.p.y = -99); }
  setWeather(kind) { this.weatherKind = kind; }

  airTemp() {
    const h = this.cur?.id;
    let t = { forest: 27, desert: 33, bamboo: 25, ocean: 27, den: -6 }[h] ?? 25;
    if (this.season === 'autumn') t -= 14; if (this.season === 'winter') t -= 26; if (this.season === 'spring') t -= 10;
    if (this.night && h !== 'ocean') t -= h === 'desert' ? 16 : 7;
    return t;
  }

  update(dt, focus) {
    this.time += dt;
    const c = focus;
    this.sun.position.copy(c).addScaledVector(this.sunDir, 60);
    this.sun.target.position.copy(c);
    this.fill.position.copy(c).add(new V3(-30, 20, -20));
    this.sky.position.copy(this.camera.position); this.stars.position.copy(this.camera.position);
    if (this.moon.visible) this.moon.position.copy(this.camera.position).addScaledVector(this.sunDir, 350);
    this.fx.update(dt); this.dust.update(dt); this.weather.update(dt);
    if (this.trackDirty && (this._tk = (this._tk || 0) + 1) % 3 === 0) { this.trackTex.needsUpdate = true; this.trackDirty = false; }
    const h = this.cur;
    if (h?.water) {
      this.caustic.offset.set(Math.sin(this.time * 0.13) * 0.4, this.time * 0.02);
      this.waterN.offset.set(this.time * 0.01, this.time * 0.007);
      for (const r of this.rays) r.material.opacity = 0.035 + 0.03 * Math.sin(this.time * 0.6 + r.position.x);
      for (const k of this.kelp) {
        const p = k.geometry.attributes.position, b = k.userData.base;
        for (let i = 0; i < p.count; i++) { const y = b[i * 3 + 1]; p.setX(i, b[i * 3] + Math.sin(this.time * 0.8 + k.userData.ph + y * 0.3) * y * 0.08); p.setZ(i, b[i * 3 + 2] + Math.cos(this.time * 0.6 + k.userData.ph + y * 0.25) * y * 0.06); }
        p.needsUpdate = true;
      }
      const m4 = new THREE.Matrix4(), q = new THREE.Quaternion();
      const t = this.time * 0.15;
      for (let i = 0; i < this.fishData.length; i++) {
        const d = this.fishData[i], a = t + d.ph * 0.05;
        const p = new V3(Math.cos(a) * 14, 8 + Math.sin(a * 2) * 1.5, Math.sin(a) * 14).add(d.o).add(new V3(0, Math.sin(this.time * 2 + d.ph) * 0.2, 0));
        const dir = new V3(-Math.sin(a), 0, Math.cos(a));
        q.setFromUnitVectors(new V3(0, 0, 1), dir);
        m4.compose(p, q, new V3(1, 1, 1)); this.fish.setMatrixAt(i, m4);
      }
      this.fish.instanceMatrix.needsUpdate = true;
      if (Math.random() < 0.3) this.weather.emit({ p: new V3(c.x + rand(-15, 15), rand(0, 4), c.z + rand(-15, 15)), v: new V3(0, rand(0.6, 1.4), 0), c: 0xdff6ff, life: 8, size: rand(0.04, 0.1), alpha: 0.5, fn: (d, dt) => { d.v.x = Math.sin(d.p.y * 3) * 0.1; if (d.p.y > h.surfY) d.life = 0; } });
    }
    if (this.weatherKind === 'snow') {
      for (let i = 0; i < 12; i++) this.weather.emit({ p: new V3(c.x + rand(-25, 25), c.y + rand(12, 16), c.z + rand(-20, 18)), v: new V3(rand(-0.3, 0.3), -rand(1.2, 2), rand(-0.3, 0.3)), c: 0xffffff, life: 10, size: rand(0.06, 0.13), alpha: 0.9, fn: (d) => { d.v.x = Math.sin(this.time + d.p.y) * 0.4; if (d.p.y < this.heightAt(d.p.x, d.p.z) + 0.05) d.life = Math.min(d.life, 0.3); } });
    }
    if (this.leafIM.visible) {
      const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
      for (let i = 0; i < this.leafData.length; i++) {
        const d = this.leafData[i];
        const gy = this.heightAt(d.p.x, d.p.z);
        if (d.p.y < gy - 50 || d.p.distanceTo(c) > 40) d.p.set(c.x + rand(-22, 22), c.y + rand(5, 16), c.z + rand(-22, 22));
        if (d.p.y > gy + 0.03) { d.p.y -= dt * 0.9; d.p.x += Math.sin(this.time * 1.3 + i) * dt * 0.6; d.r.addScaledVector(d.w, dt); }
        e.set(d.r.x, d.r.y, d.r.z); q.setFromEuler(e);
        m4.compose(d.p, q, new V3(1, 1, 1)); this.leafIM.setMatrixAt(i, m4);
      }
      this.leafIM.instanceMatrix.needsUpdate = true;
    }
  }
}
