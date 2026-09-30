'use strict';
// ============================================================
//  ui.js — 面板、HUD、阶段条、字幕、信息卡
// ============================================================
const $ = id => document.getElementById(id);

const ACT_DEFS = [
  { id: 'tongue', icon: '👅', name: '吐信子' },
  { id: 'feed', icon: '🍖', name: '捕食进食' },
  { id: 'defend', icon: '🛡️', name: '防御' },
  { id: 'bask', icon: '☀️', name: '晒太阳', hide: sp => sp.habitat === 'ocean' },
  { id: 'shed', icon: '🦎', name: '蜕皮' },
  { id: 'hibernate', icon: '❄️', name: sp => sp.hibernate === 'none' ? '海底静伏' : '冬眠' },
  { id: 'reproduce', icon: '🥚', name: sp => sp.repro === 'live' ? '繁殖·胎生' : '繁殖·产卵' },
  { id: 'perch', icon: '🎋', name: '上树栖枝', hide: sp => sp.special !== 'perch' },
  { id: 'burrow', icon: '🏜️', name: '埋沙伏击', hide: sp => sp.special !== 'burrow' },
  { id: 'breathe', icon: '🌬️', name: '上浮换气', hide: sp => sp.special !== 'breathe' },
];
const VIEW_DEFS = [['skin', '外观'], ['skeleton', '骨骼'], ['organs', '内脏']];

const UI = {
  _cap: 0, _stages: null, _stageI: -1,

  init() {
    const grid = $('species');
    for (const sp of SPECIES) {
      const b = document.createElement('button');
      b.className = 'card'; b.dataset.id = sp.id;
      const sw = sp.swatch;
      b.innerHTML = `<span class="sw" style="--a:${sw[0]};--b:${sw[1]};--c:${sw[2]}"></span>
        <span class="nm">${sp.name}</span><span class="lt">${sp.latin}</span>
        <span class="vn" title="${sp.venomText}">${sp.venom ? '<i class="v"></i>'.repeat(sp.venom) : '<i class="nv">无毒</i>'}</span>`;
      b.onclick = () => App.selectSpecies(sp.id);
      grid.appendChild(b);
    }
    const acts = $('acts');
    for (const a of ACT_DEFS) {
      const b = document.createElement('button');
      b.dataset.act = a.id; b.className = 'act';
      b.onclick = () => { Sound.init(); if (App.activityName === a.id) App.startActivity(null); else App.startActivity(a.id); };
      acts.appendChild(b);
    }
    const gaits = $('gaits');
    for (const g of ['serpentine', 'rectilinear', 'concertina', 'sidewind', 'swim', 'idle']) {
      const b = document.createElement('button'); b.dataset.gait = g; b.textContent = GAIT_NAMES[g];
      b.onclick = () => App.setGait(g);
      gaits.appendChild(b);
    }
    const views = $('views');
    for (const [v, n] of VIEW_DEFS) {
      const b = document.createElement('button'); b.dataset.view = v; b.textContent = n;
      b.onclick = () => App.setView(v); views.appendChild(b);
    }
    const th = document.createElement('button'); th.id = 'thermalBtn'; th.textContent = '🔥 红外';
    th.onclick = () => App.setThermal(!App.thermal); views.appendChild(th);

    $('auto').onchange = e => { Sound.init(); App.startActivity(e.target.checked ? 'auto' : null); };
    $('nightBtn').onclick = () => App.setNight(!App.world.night);
    $('soundBtn').onclick = () => { Sound.init(); Sound.setOn(!Sound.on); this.syncSettings(); };
    const sp = $('speed');
    sp.oninput = () => { App.userSpeed = +sp.value; $('speedV').textContent = (+sp.value).toFixed(2) + '×'; };
    $('collapse').onclick = () => document.body.classList.toggle('collapsed');
    $('infoMin').onclick = () => $('info').classList.toggle('min');
    for (const t of document.querySelectorAll('#info .tabs button')) t.onclick = () => this.tab(t.dataset.tab);
    document.addEventListener('pointerdown', () => Sound.init(), { once: true });
  },

  setSpecies(sp) {
    for (const c of document.querySelectorAll('#species .card')) c.classList.toggle('on', c.dataset.id === sp.id);
    for (const b of document.querySelectorAll('#acts button')) {
      const a = ACT_DEFS.find(x => x.id === b.dataset.act);
      b.hidden = a.hide ? a.hide(sp) : false;
      b.innerHTML = `<span>${a.icon}</span>${typeof a.name === 'function' ? a.name(sp) : a.name}`;
    }
    for (const b of document.querySelectorAll('#gaits button')) b.disabled = !(b.dataset.gait === 'idle' || sp.gaits.includes(b.dataset.gait));
    $('thermalBtn').disabled = sp.habitat === 'ocean';
    $('hName').textContent = sp.name; $('hLatin').textContent = sp.latin; $('hFam').textContent = `${sp.family} · ${sp.venomText}`;
    const facts = sp.facts.map(([k, v]) => `<tr><th>${k}</th><td>${v}</td></tr>`).join('');
    $('infoProfile').innerHTML = `<div class="ph"><span class="sw big" style="--a:${sp.swatch[0]};--b:${sp.swatch[1]};--c:${sp.swatch[2]}"></span>
      <div><h2>${sp.name} <small>${sp.en}</small></h2><div class="lat">${sp.latin} · ${sp.family}</div></div></div>
      <p>${sp.intro}</p><table>${facts}</table>`;
  },

  syncSettings() {
    $('nightBtn').textContent = App.world.night ? '🌙 夜晚' : '☀️ 白天';
    $('nightBtn').classList.toggle('on', App.world.night);
    $('soundBtn').textContent = Sound.on ? '🔊 声音' : '🔇 静音';
    $('thermalBtn').classList.toggle('on', App.thermal);
    for (const b of document.querySelectorAll('#views button[data-view]')) b.classList.toggle('on', b.dataset.view === App.view);
    for (const b of document.querySelectorAll('#gaits button')) b.classList.toggle('on', b.dataset.gait === App.gait);
  },

  setActive(name) {
    for (const b of document.querySelectorAll('#acts button')) b.classList.toggle('on', b.dataset.act === name);
    $('auto').checked = name === 'auto';
  },

  tab(t) {
    for (const b of document.querySelectorAll('#info .tabs button')) b.classList.toggle('on', b.dataset.tab === t);
    $('infoNow').hidden = t !== 'now'; $('infoProfile').hidden = t !== 'profile';
    $('info').classList.remove('min');
  },

  info(tag, title, text) {
    $('iTag').textContent = tag; $('iTitle').textContent = title;
    $('iText').innerHTML = (text || '').split('\n\n').map(p => `<p>${p}</p>`).join('');
    this.tab('now');
  },

  stages(list) {
    const el = $('stages');
    this._stages = list; this._stageI = -1; this._state = null;
    if (!list) { el.classList.remove('show'); return; }
    el.innerHTML = list.map((s, i) => `<span class="chip" data-i="${i}"><b>${i + 1}</b>${s}</span>`).join('<i class="arr">›</i>');
    el.classList.add('show');
  },
  stage(i) {
    if (!this._stages) return;
    if (typeof i === 'string') { i = this._stages.indexOf(i); if (i < 0) return; }
    this._stageI = i;
    for (const c of document.querySelectorAll('#stages .chip')) {
      const k = +c.dataset.i;
      c.classList.toggle('now', k === i); c.classList.toggle('done', k < i);
    }
    const s = this._stages[i];
    if (s) this.state(s);
  },

  caption(text, dur = 3) {
    const el = $('caption');
    clearTimeout(this._cap);
    if (!text) { el.classList.remove('show'); return; }
    el.textContent = text; el.classList.add('show');
    this._cap = setTimeout(() => el.classList.remove('show'), dur * 1000);
  },

  timeBadge(text) {
    const el = $('tbadge');
    if (!text) { el.classList.remove('show'); return; }
    el.textContent = text; el.classList.add('show');
  },

  state(t) { this._state = t; },
  autoStep(n) { this._auto = n; },

  hud() {
    const v = App.vitals;
    const act = App.activityName;
    let st = this._state || (act ? '' : (App.gait === 'idle' ? '静止 · 吐信观察' : (App.world.cur?.water ? '巡游' : '游走') + ' · ' + GAIT_NAMES[App.gait]));
    if (act === 'auto' && this._auto) st = `自动生活 · ${this._auto}${this._state ? ' · ' + this._state : ''}`;
    $('hState').textContent = st || '…';
    $('vTemp').textContent = v.temp.toFixed(1) + ' °C';
    $('vHr').textContent = Math.round(v.hr) + ' 次/分';
    $('vMet').textContent = v.met >= 1.5 ? `×${v.met.toFixed(0)}` : v.met < 0.95 ? `${Math.round(v.met * 100)}%` : '静息';
    $('vAir').textContent = App.world.airTemp().toFixed(0) + ' °C';
    const dg = $('vDig');
    dg.parentElement.hidden = v.digest == null;
    if (v.digest != null) dg.textContent = v.digest + '%';
    $('vSeason').textContent = App.seasonLabel ? App.seasonLabel + '季' : (App.world.night ? '夜晚' : '白天');
    if (App.denTemps) { const a = $('tSurf'), b = $('tDen'); if (a) a.textContent = App.denTemps.surf + ' °C'; if (b) b.textContent = '+' + App.denTemps.den + ' °C'; }
  },
};
