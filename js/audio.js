'use strict';
// ============================================================
//  audio.js — WebAudio 合成音效：响尾、嘶声、振尾、出击、心跳、环境声
// ============================================================
const Sound = {
  ctx: null, master: null, on: true, noiseBuf: null,
  rt: null, bz: null, amb: null, hb: null, timers: [],

  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
    const c = this.ctx;
    this.master = c.createGain(); this.master.gain.value = this.on ? 0.55 : 0; this.master.connect(c.destination);
    const len = c.sampleRate * 2, buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noiseBuf = buf;
    if (this._pendingAmb) this.ambient(this._pendingAmb);
  },
  setOn(v) { this.on = v; if (this.master) this.master.gain.setTargetAtTime(v ? 0.55 : 0, this.ctx.currentTime, 0.05); },
  noise() { const s = this.ctx.createBufferSource(); s.buffer = this.noiseBuf; s.loop = true; return s; },
  filt(type, f, q = 1) { const b = this.ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; return b; },
  chain(...n) { for (let i = 0; i < n.length - 1; i++) n[i].connect(n[i + 1]); return n[n.length - 1]; },

  rattle(on) {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime;
    if (on && !this.rt) {
      const n = this.noise(), g = c.createGain(), out = c.createGain();
      g.gain.value = 0.35; out.gain.value = 0;
      const lfo = c.createOscillator(); lfo.type = 'square'; lfo.frequency.value = 58;
      const lg = c.createGain(); lg.gain.value = 0.35; lfo.connect(lg); lg.connect(g.gain);
      this.chain(n, this.filt('bandpass', 5200, 0.6), this.filt('highpass', 1800), g, out, this.master);
      out.gain.linearRampToValueAtTime(0.9, t + 0.15);
      n.start(); lfo.start();
      this.rt = { n, lfo, out };
    } else if (!on && this.rt) {
      const r = this.rt; this.rt = null;
      r.out.gain.setTargetAtTime(0, t, 0.08);
      setTimeout(() => { try { r.n.stop(); r.lfo.stop(); } catch (e) { } }, 500);
    }
  },
  buzz(on) {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime;
    if (on && !this.bz) {
      const n = this.noise(), g = c.createGain(), out = c.createGain(); out.gain.value = 0;
      const lfo = c.createOscillator(); lfo.frequency.value = 32; const lg = c.createGain(); lg.gain.value = 0.5; lfo.connect(lg); lg.connect(g.gain);
      this.chain(n, this.filt('bandpass', 1400, 1.2), g, out, this.master);
      out.gain.linearRampToValueAtTime(0.5, t + 0.1); n.start(); lfo.start();
      this.bz = { n, lfo, out };
    } else if (!on && this.bz) {
      const r = this.bz; this.bz = null; r.out.gain.setTargetAtTime(0, t, 0.06);
      setTimeout(() => { try { r.n.stop(); r.lfo.stop(); } catch (e) { } }, 400);
    }
  },
  hiss(dur = 1.5, vol = 0.5) {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime, n = this.noise(), g = c.createGain();
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.08);
    g.gain.setValueAtTime(vol, t + dur * 0.7); g.gain.linearRampToValueAtTime(0, t + dur);
    this.chain(n, this.filt('highpass', 2600), this.filt('peaking', 5500, 0.8), g, this.master);
    n.start(t); n.stop(t + dur + 0.05);
  },
  strike() {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime, n = this.noise(), g = c.createGain(), f = this.filt('bandpass', 600, 1.5);
    f.frequency.setValueAtTime(500, t); f.frequency.exponentialRampToValueAtTime(3200, t + 0.12);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.6, t + 0.03); g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
    this.chain(n, f, g, this.master); n.start(t); n.stop(t + 0.3);
  },
  thump(t, f = 55, v = 0.7) {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain();
    o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * 0.6, t + 0.15);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + 0.02); g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + 0.35);
  },
  heart(on) {
    if (!this.ctx) return;
    clearInterval(this.hb); this.hb = null;
    if (on) { const beat = () => { const t = this.ctx.currentTime; this.thump(t, 50, 0.6); this.thump(t + 0.22, 44, 0.4); }; beat(); this.hb = setInterval(beat, 2600); }
  },
  ambient(kind) {
    this._pendingAmb = kind;
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime;
    for (const id of this.timers) clearTimeout(id); this.timers = [];
    if (this.amb) { const a = this.amb; a.out.gain.setTargetAtTime(0, t, 0.3); setTimeout(() => a.nodes.forEach(n => { try { n.stop(); } catch (e) { } }), 1500); this.amb = null; }
    if (!kind) return;
    const out = c.createGain(); out.gain.value = 0; out.connect(this.master);
    const nodes = [];
    const n = this.noise(); nodes.push(n);
    const lfo = c.createOscillator(); lfo.frequency.value = 0.12; const lg = c.createGain(); lfo.connect(lg); nodes.push(lfo);
    const g = c.createGain(); lg.connect(g.gain);
    if (kind === 'ocean') { g.gain.value = 0.5; lg.gain.value = 0.2; this.chain(n, this.filt('lowpass', 260), g, out); }
    else if (kind === 'desert' || kind === 'den') { g.gain.value = 0.25; lg.gain.value = 0.2; this.chain(n, this.filt('bandpass', 480, 0.7), g, out); }
    else { g.gain.value = 0.08; lg.gain.value = 0.04; this.chain(n, this.filt('lowpass', 900), g, out); }
    n.start(); lfo.start();
    out.gain.setTargetAtTime(kind === 'ocean' ? 0.5 : 0.35, t, 0.8);
    this.amb = { out, nodes };
    const sched = (fn, a, b) => { const id = setTimeout(() => { fn(); sched(fn, a, b); }, rand(a, b)); this.timers.push(id); };
    if (kind === 'forest' || kind === 'bamboo') sched(() => this.chirp(), 1500, 5000);
    if (kind === 'night') sched(() => this.cricket(), 300, 900);
  },
  chirp() {
    if (!this.ctx || !this.amb) return;
    const c = this.ctx, t = c.currentTime, n = 2 + (Math.random() * 4 | 0), base = rand(2400, 4200);
    for (let i = 0; i < n; i++) {
      const o = c.createOscillator(), g = c.createGain(), s = t + i * 0.13;
      o.frequency.setValueAtTime(base, s); o.frequency.exponentialRampToValueAtTime(base * rand(1.2, 1.6), s + 0.08);
      g.gain.setValueAtTime(0, s); g.gain.linearRampToValueAtTime(0.05, s + 0.02); g.gain.exponentialRampToValueAtTime(0.001, s + 0.1);
      o.connect(g); g.connect(this.amb.out); o.start(s); o.stop(s + 0.12);
    }
  },
  cricket() {
    if (!this.ctx || !this.amb) return;
    const c = this.ctx, t = c.currentTime;
    for (let i = 0; i < 3; i++) {
      const o = c.createOscillator(), g = c.createGain(), s = t + i * 0.05;
      o.frequency.value = 4300; g.gain.setValueAtTime(0, s); g.gain.linearRampToValueAtTime(0.03, s + 0.01); g.gain.linearRampToValueAtTime(0, s + 0.035);
      o.connect(g); g.connect(this.amb.out); o.start(s); o.stop(s + 0.05);
    }
  },
};
