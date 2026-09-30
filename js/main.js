'use strict';
// ============================================================
//  main.js — 应用状态、相机、主循环
// ============================================================
const App = {
  snake: null, sp: null, gait: 'serpentine', view: 'skin', thermal: false,
  preys: [], babies: [], bgs: [], activity: null, activityName: null,
  timeScale: 1, tsTarget: 1, userSpeed: 1, seasonLabel: null, denTemps: null,
  vitals: { temp: 25, hr: 30, met: 1, digest: null }, vitalsT: { temp: null, hr: null, met: 1 },

  bg(gen) { gen.next(0); this.bgs.push(gen); },

  *fade(to, dur = 0.8) {
    const el = $('fade'), from = +getComputedStyle(el).opacity;
    el.style.pointerEvents = to > 0 ? 'auto' : 'none';
    let e = 0;
    while (e < dur) { e += (yield) / Math.max(0.05, this.timeScale * this.userSpeed); el.style.opacity = lerp(from, to, Math.min(1, e / dur)); }
    el.style.opacity = to;
  },

  setTimeScale(k, label) { this.tsTarget = k; UI.timeBadge(label || null); },

  // ---------------------------------------------------------------- 物种
  async selectSpecies(id, first = false) {
    const sp = SPECIES_BY_ID[id];
    if (!sp) return;
    this._stopActivity();
    if (!_skinCache.has(id) || first) {
      $('busy').classList.add('show');
      $('busyMsg').textContent = `正在生成「${sp.name}」的鳞片与花纹…`;
      await new Promise(r => setTimeout(r, 40));
    }
    getSkin(sp);
    const W = this.world;
    W.getHab(sp.habitat);
    $('busy').classList.remove('show');
    if (this.snake) this.snake.dispose();
    this.clearPrey(); this.clearBabies();
    for (const o of [...W.extras.children]) W.extras.remove(o);
    this.sp = sp;
    W.setHabitat(sp.habitat);
    W.setSeason('summer'); this.seasonLabel = null;
    W.setNight(!!sp.night);
    Sound.ambient(sp.night ? 'night' : sp.habitat);
    const s = this.snake = new Snake(sp, { world: W });
    this.scene.add(s.group);
    s.group.traverse(o => { if (o.isMesh) o.userData.temp = 0.3; });
    W.setShadowSize(clamp(s.L * 0.6, 8, 22));
    this.gait = sp.gait;
    this.placeSnakeHome();
    s.setView(this.view);
    if (this.thermal) this.setThermal(sp.habitat !== 'ocean', true);
    UI.setSpecies(sp);
    UI.info('物种', `${sp.name} · ${sp.en}`, sp.intro);
    const c = s.center(new V3());
    const dir = sp.habitat === 'ocean' ? new V3(0.6, 0.25, 0.75) : new V3(0.55, 0.62, 0.75);
    this.controls.target.copy(c);
    this.camera.position.copy(c).addScaledVector(dir.normalize(), clamp(s.L * 0.95, 9, 34));
    this.cam.set({ target: null, dist: null });
    this.startActivity(null, true);
    UI.syncSettings();
  },

  placeSnakeHome() {
    const s = this.snake, h = this.world.cur;
    const psi = rand(0, TAU);
    if (h.water) {
      s.groundMode = 'free';
      const p = h.center.clone(); p.y = (h.swimMin + h.swimMax) / 2;
      s.placeStraight(p, psi, 0.5);
    } else {
      s.groundMode = 'terrain';
      const p = h.center.clone().add(new V3(Math.sin(psi) * s.L * 0.3, 0, Math.cos(psi) * s.L * 0.3));
      s.placeStraight(p, psi, 0.7);
    }
  },

  // ---------------------------------------------------------------- 活动
  _stopActivity() {
    const it = this.activity;
    this.activity = null; this.activityName = null;
    if (it) {
      try { let r = it.return(); let n = 0; while (!r.done && n++ < 400) r = it.next(0.05); } catch (e) { console.error(e); }
    }
    $('fade').style.opacity = 0; $('fade').style.pointerEvents = 'none';
  },

  startActivity(name, quiet) {
    this._stopActivity();
    if (!this.snake) return;
    relaxSnake(0.8);
    this.clearPrey(); this.clearBabies();
    this.setTimeScale(1);
    UI.caption(null); UI.stages(null); UI.state(null); UI.autoStep(null);
    this.cam.set({ target: null, dist: null });
    this.vitals.digest = null;
    this.activityName = name;
    this.activity = name ? ACTIVITIES[name]() : roam();
    try { this.activity.next(0); } catch (e) { console.error(e); this.activity = null; }
    UI.setActive(name);
    if (!name && !quiet) UI.info('运动', ...TXT.gait[this.world.cur.water ? 'swim' : this.gait]);
  },

  setGait(g) {
    if (!this.sp) return;
    if (g !== 'idle' && !this.sp.gaits.includes(g)) return;
    this.gait = g;
    UI.syncSettings();
    if (!this.activityName) this.startActivity(null);
    else UI.info('运动', ...TXT.gait[g]);
  },

  setView(v) {
    this.view = v;
    this.snake?.setView(v);
    UI.syncSettings();
    UI.info('解剖', ...TXT.view[v]);
  },

  setNight(v) {
    this.world.setNight(v);
    Sound.ambient(v ? 'night' : this.world.cur.id);
    if (this.thermal) this.setThermal(true, true);
    UI.syncSettings();
  },

  // ---------------------------------------------------------------- 红外视图
  _thermCache: new Map(),
  thermMat(temp, side) {
    const key = Math.round(temp * 20) + '|' + side;
    if (!this._thermCache.has(key)) {
      const stops = [[0, 0x05030f], [0.2, 0x2a0a5a], [0.4, 0x8a1a7a], [0.6, 0xe0402a], [0.78, 0xf8a020], [0.9, 0xffe060], [1, 0xfffff0]];
      let c = new THREE.Color(stops[0][1]);
      for (let i = 1; i < stops.length; i++) if (temp <= stops[i][0]) { const [a, ca] = stops[i - 1], [b, cb] = stops[i]; c = new THREE.Color(ca).lerp(new THREE.Color(cb), (temp - a) / (b - a)); break; } else c = new THREE.Color(stops[i][1]);
      this._thermCache.set(key, new THREE.MeshLambertMaterial({ color: c.clone().multiplyScalar(0.35), emissive: c, emissiveIntensity: 0.8, side }));
    }
    return this._thermCache.get(key);
  },
  applyThermal(root) {
    if (!this.thermal) return;
    root.traverse(o => {
      if (!(o.isMesh || o.isInstancedMesh) || o === this.world.sky) return;
      if (!o.userData.origMat) o.userData.origMat = o.material;
      let t = o.userData.temp, p = o.parent;
      while (t === undefined && p) { t = p.userData.temp; p = p.parent; }
      t = t ?? 0.12;
      const orig = o.userData.origMat;
      o.material = Array.isArray(orig) ? orig.map(m => this.thermMat(t, m.side)) : this.thermMat(t, orig.side);
    });
  },
  setThermal(on, force) {
    if (on && this.world.cur.water) on = false;
    if (on === this.thermal && !force) return;
    this.thermal = on;
    const sc = this.scene;
    if (on) {
      this.applyThermal(sc);
      sc.background = new THREE.Color(0x020208); sc.fog = new THREE.FogExp2(0x020208, 0.018);
      this.world.sky.visible = false; this.world.stars.visible = false; this.world.moon.visible = false;
      UI.info('感官', ...TXT.view.thermal);
    } else {
      sc.traverse(o => { if (o.userData.origMat) { o.material = o.userData.origMat; delete o.userData.origMat; } });
      this.world.applyLighting();
    }
    UI.syncSettings();
  },

  // ---------------------------------------------------------------- 猎物/幼蛇
  removePrey(p) { const i = this.preys.indexOf(p); if (i >= 0) this.preys.splice(i, 1); p.dispose(); },
  clearPrey() { for (const p of this.preys) p.dispose(); this.preys = []; },
  clearBabies() { for (const b of this.babies) b.dispose(); this.babies = []; },
  setSeasonLabel(l) { this.seasonLabel = l; },
};

// ---------------------------------------------------------------- 相机控制
class CamCtl {
  constructor(camera, controls) { this.camera = camera; this.controls = controls; this.target = null; this.dist = null; this.dir = null; this.snap = false; }
  set(o) { this.target = o.target ?? null; this.dist = o.dist ?? null; this.dir = o.dir ?? null; if (o.snap) this.snap = true; }
  update(dt) {
    const s = App.snake; if (!s) return;
    const c = this.controls, cam = this.camera;
    let want;
    if (this.target) want = typeof this.target === 'function' ? this.target() : this.target;
    else want = s.center(_d).lerp(s.head.position, 0.5);
    want = _e.copy(want);
    const k = this.snap ? 1 : 1 - Math.exp(-dt * 2.6);
    const delta = _a.subVectors(want, c.target).multiplyScalar(k);
    c.target.add(delta); cam.position.add(delta);
    const off = _b.subVectors(cam.position, c.target);
    let len = off.length();
    const dd = typeof this.dist === 'function' ? this.dist() : this.dist;
    if (dd) { len = this.snap ? dd : lerp(len, dd, 1 - Math.exp(-dt * 1.6)); }
    if (this.dir) {
      const d = typeof this.dir === 'function' ? this.dir() : this.dir;
      off.normalize().lerp(d, this.snap ? 1 : 1 - Math.exp(-dt * 1.4));
    }
    off.setLength(len);
    // 不钻入地下
    const gy = App.world.heightAt(c.target.x + off.x, c.target.z + off.z);
    if (c.target.y + off.y < gy + 0.4) off.y = gy + 0.4 - c.target.y;
    cam.position.copy(c.target).add(off);
    this.snap = false;
  }
}

// ---------------------------------------------------------------- 启动
window.startApp = async function () {
  const msg = $('loadMsg');
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  $('app').appendChild(renderer.domElement);
  const labelRenderer = new ADDONS.CSS2DRenderer();
  labelRenderer.setSize(innerWidth, innerHeight);
  labelRenderer.domElement.className = 'labels';
  $('app').appendChild(labelRenderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.05, 900);
  camera.position.set(14, 10, 18);
  const controls = new ADDONS.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.dampingFactor = 0.08;
  controls.minDistance = 1.2; controls.maxDistance = 90;
  controls.maxPolarAngle = Math.PI * 0.94;
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new ADDONS.RoomEnvironment(), 0.04).texture;

  Object.assign(App, { renderer, scene, camera, controls, labelRenderer });
  App.cam = new CamCtl(camera, controls);
  msg.textContent = '正在构建环境…';
  await new Promise(r => setTimeout(r, 30));
  App.world = new World(renderer, scene, camera);
  UI.init();
  msg.textContent = '正在生成蛇皮纹理…';
  await new Promise(r => setTimeout(r, 30));
  const start = new URLSearchParams(location.search).get('sp') || 'rattlesnake';
  await App.selectSpecies(SPECIES_BY_ID[start] ? start : 'rattlesnake', true);
  $('loader').classList.add('hide');

  const onResize = () => {
    camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight); labelRenderer.setSize(innerWidth, innerHeight);
    const sc = innerHeight * renderer.getPixelRatio() / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
    for (const p of [App.world.fx, App.world.dust, App.world.weather]) p.mat.uniforms.uScale.value = sc;
  };
  addEventListener('resize', onResize); onResize();

  const clock = new THREE.Clock();
  let hudT = 0, frame = 0;
  App.tick = (raw, draw = true) => {
    frame++;
    App.timeScale = damp(App.timeScale, App.tsTarget, 12, raw);
    const dt = raw * App.timeScale * App.userSpeed;
    const s = App.snake;
    App.bgs = App.bgs.filter(g => { try { return !g.next(dt).done; } catch (e) { console.error(e); return false; } });
    if (App.activity) {
      try { const r = App.activity.next(dt); if (r.done) App.startActivity(null); }
      catch (e) { console.error(e); App.activity = null; App.startActivity(null); }
    }
    if (s) {
      s.pupil = damp(s.pupil, App.world.night || App.world.cur?.id === 'den' ? 0.95 : App.thermal ? 0.6 : 0.2, 2, raw);
      s.update(dt);
      for (const p of App.preys) p.update(dt);
      for (const b of App.babies) b.update(dt);
      if (App.world.cur?.tracks && frame % 3 === 0 && s.motor.type !== 'sidewind') {
        for (let i = 2; i < s.N; i += 6) {
          const p = s.spine[i];
          if (p.y - App.world.heightAt(p.x, p.z) - s.hb[i] < 0.04 * s.R + 0.01) App.world.stampTrack(p.x, p.z, s.ww[i] * 0.9);
        }
      }
      // 生命体征：变温动物体温随环境
      const V = App.vitals, T = App.vitalsT;
      const air = App.world.airTemp();
      const tT = T.temp ?? clamp(air + (App.world.cur?.id === 'desert' ? -2 : 1), 4, 33);
      V.temp = damp(V.temp, tT, 0.8, dt);
      V.hr = damp(V.hr, T.hr ?? (6 + V.temp * 1.15) * (T.met > 2 ? 1.6 : 1), 1, dt);
      V.met = damp(V.met, T.met ?? 1, 1, dt);
      App.world.update(dt, App.controls.target);
    }
    App.cam.update(raw);
    controls.update();
    if (draw) { renderer.render(scene, camera); labelRenderer.render(scene, camera); }
    hudT -= raw; if (hudT <= 0) { hudT = 0.15; UI.hud(); }
  };
  // 调试：App.run(秒) 以固定步长推进模拟（页面不可见时 rAF 不触发）
  App.run = (sec, step = 1 / 30) => { for (let t = 0; t < sec; t += step) App.tick(step, t + step >= sec); };
  const loop = () => { requestAnimationFrame(loop); App.tick(Math.min(clock.getDelta(), 0.05)); };
  loop();
};

window.addEventListener('error', e => { const m = $('loadMsg'); if (m && !$('loader').classList.contains('hide')) m.textContent = '出错：' + e.message; });
