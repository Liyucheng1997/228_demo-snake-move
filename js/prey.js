'use strict';
// ============================================================
//  prey.js — 猎物：鼠（温血，红外可见）、树蛙、鳗鱼
// ============================================================
let _furTex = null;
function furTexture() {
  if (_furTex) return _furTex;
  const c = mkCanvas(256, 256), g = c.getContext('2d');
  g.fillStyle = '#888'; g.fillRect(0, 0, 256, 256);
  const r = mulberry32(3);
  for (let i = 0; i < 5000; i++) {
    const x = r() * 256, y = r() * 256, l = 90 + r() * 120;
    g.strokeStyle = `rgba(${l},${l},${l},0.5)`; g.lineWidth = 1;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 3, y + 5 + r() * 6); g.stroke();
  }
  _furTex = new THREE.CanvasTexture(c);
  _furTex.wrapS = _furTex.wrapT = THREE.RepeatWrapping;
  _furTex.colorSpace = THREE.SRGBColorSpace;
  return _furTex;
}

class Prey {
  constructor(type, world, size) {
    this.type = type; this.world = world; this.size = size;
    this.group = new THREE.Group();
    this.pos = new V3(); this.heading = 0; this.state = 'idle';
    this.t = Math.random() * 10; this.speed = 0; this.target = null;
    this.squash = 0; this.roll = 0; this.alive = true; this.lift = 0; this.air = 0;
    this.pathLog = [];
    if (type === 'frog') this._frog(); else if (type === 'eel') this._eel(); else this._mouse(type === 'rat');
    this.group.traverse(o => { if (o.isMesh) { o.castShadow = true; o.userData.temp = this.temp; } });
  }

  _mouse(rat) {
    const s = this.size, g = this.group;
    this.temp = 1; this.radius = 0.3 * s; this.length = 1.15 * s;
    const col = rat ? 0x6d5d4b : 0x8e8272;
    const fur = new THREE.MeshPhysicalMaterial({ color: col, map: furTexture(), roughness: 0.95, sheen: 1, sheenColor: new THREE.Color(0xd8cbb8), sheenRoughness: 0.55 });
    const belly = new THREE.MeshPhysicalMaterial({ color: 0xd8cfc0, map: furTexture(), roughness: 0.95, sheen: 1, sheenColor: new THREE.Color(0xffffff) });
    const pink = new THREE.MeshStandardMaterial({ color: 0xd9a0a0, roughness: 0.6 });
    const black = new THREE.MeshPhysicalMaterial({ color: 0x050505, roughness: 0.05, clearcoat: 1 });
    const body = this.bodyG = new THREE.Group(); g.add(body);
    const b = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 20), fur); b.scale.set(0.31 * s, 0.29 * s, 0.56 * s); b.position.y = 0.3 * s; body.add(b);
    const bb = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), belly); bb.scale.set(0.26 * s, 0.2 * s, 0.48 * s); bb.position.set(0, 0.2 * s, 0.02 * s); body.add(bb);
    const head = this.headG = new THREE.Group(); head.position.set(0, 0.36 * s, 0.5 * s); body.add(head);
    const h = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), fur); h.scale.set(0.19 * s, 0.18 * s, 0.26 * s); h.position.z = 0.06 * s; head.add(h);
    const sn = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), fur); sn.scale.set(0.1 * s, 0.1 * s, 0.16 * s); sn.position.set(0, -0.03 * s, 0.25 * s); head.add(sn);
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.035 * s, 10, 8), pink); nose.position.set(0, -0.02 * s, 0.4 * s); head.add(nose);
    for (const sd of [1, -1]) {
      const e = new THREE.Mesh(new THREE.SphereGeometry(0.045 * s, 12, 10), black); e.position.set(sd * 0.12 * s, 0.06 * s, 0.17 * s); head.add(e);
      const ear = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), pink); ear.scale.set(0.11 * s, 0.12 * s, 0.025 * s);
      ear.position.set(sd * 0.13 * s, 0.17 * s, -0.02 * s); ear.rotation.set(-0.2, sd * 0.5, 0); head.add(ear);
      const foot = new THREE.Mesh(new THREE.SphereGeometry(0.05 * s, 8, 6), pink); foot.scale.set(1, 0.5, 1.6); foot.position.set(sd * 0.18 * s, 0.03 * s, 0.3 * s); body.add(foot);
      const foot2 = foot.clone(); foot2.position.set(sd * 0.2 * s, 0.03 * s, -0.3 * s); body.add(foot2);
    }
    const wp = [];
    for (const sd of [1, -1]) for (let i = 0; i < 4; i++) wp.push(sd * 0.06 * s, -0.03 * s, 0.33 * s, sd * 0.32 * s, (i - 1.5) * 0.05 * s, (0.3 + i * 0.02) * s);
    const wg = new THREE.BufferGeometry(); wg.setAttribute('position', new THREE.Float32BufferAttribute(wp, 3));
    head.add(new THREE.LineSegments(wg, new THREE.LineBasicMaterial({ color: 0xeeeeee, transparent: true, opacity: 0.6 })));
    const tc = new THREE.CatmullRomCurve3([new V3(0, 0.22 * s, -0.5 * s), new V3(0.1 * s, 0.1 * s, -0.9 * s), new V3(-0.1 * s, 0.05 * s, -1.3 * s), new V3(0.05 * s, 0.04 * s, -1.65 * s)]);
    const tail = this.tailM = new THREE.Mesh(new THREE.TubeGeometry(tc, 24, 0.035 * s, 6), pink); body.add(tail);
  }

  _frog() {
    const s = this.size, g = this.group;
    this.temp = 0.32; this.radius = 0.28 * s; this.length = 0.8 * s;
    const skin = new THREE.MeshPhysicalMaterial({ color: 0x6fb03a, roughness: 0.35, clearcoat: 0.8, clearcoatRoughness: 0.25 });
    const pale = new THREE.MeshPhysicalMaterial({ color: 0xe8e8c0, roughness: 0.5 });
    const eyeM = new THREE.MeshPhysicalMaterial({ color: 0xc89020, roughness: 0.1, clearcoat: 1 });
    const body = this.bodyG = new THREE.Group(); g.add(body);
    const b = new THREE.Mesh(new THREE.SphereGeometry(1, 26, 18), skin); b.scale.set(0.3 * s, 0.22 * s, 0.4 * s); b.position.y = 0.26 * s; b.rotation.x = -0.3; body.add(b);
    const bl = new THREE.Mesh(new THREE.SphereGeometry(1, 18, 12), pale); bl.scale.set(0.26 * s, 0.14 * s, 0.34 * s); bl.position.set(0, 0.2 * s, 0.03 * s); bl.rotation.x = -0.3; body.add(bl);
    const hd = this.headG = new THREE.Group(); hd.position.set(0, 0.34 * s, 0.3 * s); body.add(hd);
    const h = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), skin); h.scale.set(0.24 * s, 0.14 * s, 0.22 * s); hd.add(h);
    for (const sd of [1, -1]) {
      const e = new THREE.Mesh(new THREE.SphereGeometry(0.075 * s, 14, 10), eyeM); e.position.set(sd * 0.15 * s, 0.08 * s, 0.05 * s); hd.add(e);
      const p = new THREE.Mesh(new THREE.SphereGeometry(0.04 * s, 10, 8), new THREE.MeshBasicMaterial({ color: 0x050505 })); p.scale.set(1.4, 0.7, 0.5); p.position.set(sd * 0.21 * s, 0.09 * s, 0.07 * s); hd.add(p);
      const th = new THREE.Mesh(new THREE.CapsuleGeometry(0.06 * s, 0.25 * s, 4, 8), skin); th.position.set(sd * 0.26 * s, 0.14 * s, -0.2 * s); th.rotation.set(0.9, 0, sd * 0.8); body.add(th);
      const sh = new THREE.Mesh(new THREE.CapsuleGeometry(0.045 * s, 0.25 * s, 4, 8), skin); sh.position.set(sd * 0.3 * s, 0.08 * s, -0.05 * s); sh.rotation.set(-1.2, 0, sd * 0.4); body.add(sh);
      const fa = new THREE.Mesh(new THREE.CapsuleGeometry(0.035 * s, 0.15 * s, 4, 8), skin); fa.position.set(sd * 0.2 * s, 0.09 * s, 0.28 * s); fa.rotation.set(0.5, 0, sd * 0.3); body.add(fa);
      for (const z of [0.36, -0.1]) { const pad = new THREE.Mesh(new THREE.SphereGeometry(0.035 * s, 8, 6), pale); pad.position.set(sd * (z > 0 ? 0.24 : 0.36) * s, 0.02 * s, z * s); body.add(pad); }
    }
    for (let i = 0; i < 7; i++) { const sp = new THREE.Mesh(new THREE.SphereGeometry(0.03 * s, 8, 6), new THREE.MeshStandardMaterial({ color: 0x3a6a20 })); sp.position.set((Math.random() - 0.5) * 0.35 * s, 0.4 * s, (Math.random() - 0.4) * 0.5 * s); sp.scale.y = 0.3; body.add(sp); }
  }

  _eel() {
    const s = this.size, g = this.group;
    this.temp = 0.35; this.radius = 0.11 * s; this.length = 2.4 * s;
    this.NE = 40; this.RE = 10;
    this.eSpine = Array.from({ length: this.NE }, () => new V3());
    const pos = new Float32Array(this.NE * (this.RE + 1) * 3), col = new Float32Array(this.NE * (this.RE + 1) * 3);
    const idx = [];
    for (let i = 0; i < this.NE - 1; i++) for (let j = 0; j < this.RE; j++) { const a = i * (this.RE + 1) + j, b = a + this.RE + 1; idx.push(a, b, b + 1, a, b + 1, a + 1); }
    for (let i = 0; i < this.NE; i++) for (let j = 0; j <= this.RE; j++) {
      const a = j / this.RE * TAU, up = Math.sin(a);
      const c = up > 0 ? mixC([140, 120, 80], [70, 60, 40], up) : [215, 200, 160];
      const k = (i * (this.RE + 1) + j) * 3; col[k] = (c[0] / 255) ** 2.2; col[k + 1] = (c[1] / 255) ** 2.2; col[k + 2] = (c[2] / 255) ** 2.2;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setIndex(idx);
    this.eGeo = geo; this.ePos = pos;
    const m = new THREE.Mesh(geo, new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.3, clearcoat: 0.9, side: THREE.DoubleSide }));
    m.frustumCulled = false;
    g.add(m);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.03 * s, 8, 6), new THREE.MeshPhysicalMaterial({ color: 0x111111, clearcoat: 1 }));
    this.eyeL = eye; this.eyeR = eye.clone(); g.add(this.eyeL, this.eyeR);
    this.swimPhase = 0;
  }

  _updateEel(dt) {
    const s = this.size, N = this.NE, L = this.length, seg = L / (N - 1);
    const moving = this.state === 'flee' || this.state === 'wander' || this.state === 'stagger';
    this.swimPhase += dt * (this.state === 'flee' ? 12 : moving ? 6 : this.alive ? 2 : 0);
    const amp = this.alive ? (moving ? 0.12 : 0.05) * L : 0.04 * L;
    const f = new V3(Math.sin(this.heading), 0, Math.cos(this.heading)), side = new V3(f.z, 0, -f.x);
    for (let i = 0; i < N; i++) {
      const t = i / (N - 1);
      const p = this.eSpine[i].copy(this.pos).addScaledVector(f, (0.5 - t) * L).addScaledVector(side, amp * Math.pow(t + 0.15, 1.2) * Math.sin(t * 7 - this.swimPhase));
      if (!this.alive) p.addScaledVector(side, 0.12 * L * Math.sin(t * 3.2 + 1));
    }
    const T = new V3(), X = new V3(), Y = new V3();
    for (let i = 0; i < N; i++) {
      T.subVectors(this.eSpine[Math.min(N - 1, i + 1)], this.eSpine[Math.max(0, i - 1)]).normalize();
      X.crossVectors(UP, T).normalize(); Y.crossVectors(T, X);
      const t = i / (N - 1);
      const r = this.radius * (t < 0.08 ? 0.55 + t / 0.08 * 0.45 : 1 - 0.8 * smoothstep(0.55, 1, t));
      const fin = smoothstep(0.35, 0.6, t) * 0.8;
      for (let j = 0; j <= this.RE; j++) {
        const a = j / this.RE * TAU, ca = Math.cos(a), sa = Math.sin(a);
        const rr = r * (1 + fin * Math.pow(Math.abs(sa), 6));
        const k = (i * (this.RE + 1) + j) * 3;
        this.ePos[k] = this.eSpine[i].x + X.x * ca * rr * 0.8 + Y.x * sa * rr;
        this.ePos[k + 1] = this.eSpine[i].y + X.y * ca * rr * 0.8 + Y.y * sa * rr;
        this.ePos[k + 2] = this.eSpine[i].z + X.z * ca * rr * 0.8 + Y.z * sa * rr;
      }
    }
    this.eGeo.attributes.position.needsUpdate = true;
    this.eGeo.computeVertexNormals();
    const h = this.eSpine[1];
    T.subVectors(this.eSpine[0], this.eSpine[2]).normalize(); X.crossVectors(UP, T).normalize();
    this.eyeL.position.copy(h).addScaledVector(X, this.radius * 0.6).addScaledVector(UP, this.radius * 0.4);
    this.eyeR.position.copy(h).addScaledVector(X, -this.radius * 0.6).addScaledVector(UP, this.radius * 0.4);
  }

  nose(out) {
    const f = _a.set(Math.sin(this.heading), 0, Math.cos(this.heading));
    return out.copy(this.pos).addScaledVector(f, this.length * 0.5);
  }
  axis(out) { return out.set(Math.sin(this.heading), 0, Math.cos(this.heading)); }

  place(p, heading) { this.pos.copy(p); this.heading = heading; this._ground(); this.update(0); }

  _ground() {
    const W = this.world;
    const g = W.heightAt(this.pos.x, this.pos.z);
    if (this.state === 'held' || this.state === 'swallow') return;
    if (this.type === 'eel' && W.cur.water && this.alive && this.state !== 'idle') { this.pos.y = Math.max(this.pos.y, g + this.radius); return; }
    this.pos.y = g + (this.type === 'eel' ? this.radius : 0) + this.air;
  }

  update(dt) {
    this.t += dt;
    const W = this.world;
    if (this.state === 'wander' || this.state === 'flee' || this.state === 'stagger') {
      if (!this.target || this.pos.distanceTo(this.target) < 0.5 * this.size) {
        if (this.state === 'wander') {
          const c = this.home || W.cur.center, r = this.homeR || 6;
          this.target = new V3(c.x + rand(-r, r), 0, c.z + rand(-r, r));
        } else this.target = this.pos.clone().add(new V3(Math.sin(this.heading), 0, Math.cos(this.heading)).multiplyScalar(5));
      }
      const want = Math.atan2(this.target.x - this.pos.x, this.target.z - this.pos.z);
      const turn = this.state === 'flee' ? 6 : 3;
      this.heading += clamp(angleDelta(this.heading, want), -turn * dt, turn * dt);
      let v = this.state === 'flee' ? 4.5 * this.size * (this.fleeMul || 1) : this.state === 'stagger' ? 0.9 * this.size : 1.0 * this.size;
      if (this.type === 'mouse' || this.type === 'rat') { if (this.state === 'wander' && Math.sin(this.t * 0.8) > 0.3) v = 0; }
      if (this.type === 'frog') {
        // 蛙：间歇跳跃
        this.hop = (this.hop || 0) - dt;
        if (this.hop <= 0 && this.air <= 0) { this.hop = this.state === 'flee' ? 0.35 : rand(1.2, 3); this.vy = 3.2 * this.size; this.air = 0.001; }
        if (this.air > 0) { this.vy -= 12 * this.size * dt; this.air += this.vy * dt; if (this.air <= 0) { this.air = 0; } v = 2.4 * this.size; } else v = 0;
      }
      if (this.stopped) v = 0;
      this.pos.x += Math.sin(this.heading) * v * dt; this.pos.z += Math.cos(this.heading) * v * dt;
      if (v > 0 && (!this.pathLog.length || this.pathLog[this.pathLog.length - 1].distanceTo(this.pos) > 0.25)) this.pathLog.push(this.pos.clone());
    }
    if (this.state !== 'held' && this.state !== 'swallow') this._ground();

    // 姿态
    const g = this.group;
    g.position.copy(this.pos);
    g.rotation.set(0, this.heading, 0);
    if (this.type !== 'eel') {
      const b = this.bodyG;
      const moving = this.state === 'flee' || (this.state === 'wander' && Math.sin(this.t * 0.8) <= 0.3);
      b.position.y = (moving && this.type !== 'frog') ? Math.abs(Math.sin(this.t * (this.state === 'flee' ? 22 : 12))) * 0.06 * this.size : 0;
      if (this.headG && this.alive) { this.headG.rotation.x = Math.sin(this.t * 7) * 0.12 * (moving ? 0.3 : 1); this.headG.rotation.y = Math.sin(this.t * 1.7) * 0.3; }
      if (this.state === 'stagger') g.rotation.z = Math.sin(this.t * 6) * 0.25;
      g.rotateZ(this.roll);
      if (this.roll) g.position.y += this.radius * 0.05;
      g.scale.set(1 - this.squash * 0.18, 1 - this.squash * 0.25, 1 + this.squash * 0.1);
      if (this.tailM && this.alive) this.tailM.rotation.y = Math.sin(this.t * 3) * 0.2;
    } else {
      g.position.set(0, 0, 0); g.rotation.set(0, 0, 0);
      this._updateEel(dt);
    }
  }

  die() { this.alive = false; this.state = 'dead'; this.temp = this.type === 'eel' || this.type === 'frog' ? this.temp : 0.8; }

  dispose() {
    this.group.parent?.remove(this.group);
    this.group.traverse(o => { if (o.isMesh) { o.geometry.dispose(); } });
  }
}
