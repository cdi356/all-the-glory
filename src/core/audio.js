import { G } from './g.js';
import { clamp, rand, pick, rng } from './util.js';
// Fully procedural audio: SFX synthesis, engines, sirens, ambience and a generative multi-station radio.
export const STATIONS = [
  { id: 'off', name: 'RADIO OFF', sub: '' },
  { id: 'neon', name: 'NEON LIABILITY 88.8', sub: 'outrun & regret', bpm: 104, style: 'synth', seed: 11 },
  { id: 'sub', name: 'SUBPRIME FM', sub: 'warehouse techno', bpm: 132, style: 'techno', seed: 23 },
  { id: 'nap', name: 'POWER NAP RADIO', sub: 'lo-fi beats to dodge calls to', bpm: 78, style: 'lofi', seed: 37 },
  { id: 'gutter', name: 'GUTTER GOSPEL', sub: 'phonk for the faithful', bpm: 118, style: 'phonk', seed: 51 },
  { id: 'echo', name: 'ECHO PIRATE RADIO', sub: 'the truth, badly amplified', bpm: 92, style: 'dub', seed: 64, talk: true },
];
const SCALES = { minor: [0, 2, 3, 5, 7, 8, 10], phryg: [0, 1, 3, 5, 7, 8, 10], dorian: [0, 2, 3, 5, 7, 9, 10] };
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);

class Audio {
  constructor() { this.ctx = null; this.vol = { master: .8, sfx: .9, music: .55, voice: .8 }; this.loops = {}; this.station = 1; this.score = null; this.lastS = {}; }
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
    const c = this.ctx; this.master = c.createGain(); this.comp = c.createDynamicsCompressor(); this.comp.threshold.value = -14; this.comp.ratio.value = 5; this.master.connect(this.comp); this.comp.connect(c.destination);
    this.sfxBus = c.createGain(); this.musBus = c.createGain(); this.voxBus = c.createGain(); this.muf = c.createBiquadFilter(); this.muf.type = 'lowpass'; this.muf.frequency.value = 20000;
    this.sfxBus.connect(this.muf); this.muf.connect(this.master); this.musBus.connect(this.master); this.voxBus.connect(this.master);
    // short reverb
    const len = c.sampleRate * 1.6, ir = c.createBuffer(2, len, c.sampleRate); for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3); }
    this.rev = c.createConvolver(); this.rev.buffer = ir; this.revG = c.createGain(); this.revG.gain.value = .22; this.rev.connect(this.revG); this.revG.connect(this.master);
    this.noise = c.createBuffer(1, c.sampleRate * 2, c.sampleRate); const nd = this.noise.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    this.applyVol(); this.mkLoops();
  }
  applyVol() { if (!this.ctx) return; const v = this.vol; this.master.gain.value = v.master; this.sfxBus.gain.value = v.sfx; this.musBus.gain.value = v.music; this.voxBus.gain.value = v.voice; }
  // distance attenuation + pan relative to camera. returns a destination node or null when inaudible
  dest(pos, range = 60, rev = 0) {
    const c = this.ctx, g = c.createGain();
    if (pos && G.camera) {
      let e = G.camera.matrixWorld.elements, dx = pos.x - e[12], dy = pos.y - e[13], dz = pos.z - e[14], d = Math.sqrt(dx * dx + dy * dy + dz * dz); if (G.coop && G.coop.on) for (const c of G.coop.locals()) { const q = c.camera.matrixWorld.elements, x = pos.x - q[12], y = pos.y - q[13], z = pos.z - q[14], dd = Math.sqrt(x * x + y * y + z * z); if (dd < d) { e = q; dx = x; dy = y; dz = z; d = dd; } } if (d > range * 2.2) return null;
      g.gain.value = 1 / (1 + Math.pow(d / (range * .28), 2)); const p = c.createStereoPanner(); p.pan.value = clamp((dx * e[0] + dy * e[1] + dz * e[2]) / Math.max(d, 1), -1, 1) * .8; g.connect(p); p.connect(this.sfxBus); if (rev) { const r = c.createGain(); r.gain.value = rev; p.connect(r); r.connect(this.rev); }
    } else { g.connect(this.sfxBus); if (rev) { const r = c.createGain(); r.gain.value = rev; g.connect(r); r.connect(this.rev); } }
    return g;
  }
  nz(d, t, dur, f, type = 'lowpass', vol = 1, f2, q = 1) { const c = this.ctx, s = c.createBufferSource(), fl = c.createBiquadFilter(), g = c.createGain(); s.buffer = this.noise; fl.type = type; fl.frequency.setValueAtTime(f, t); if (f2) fl.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + dur); fl.Q.value = q; g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.001, t + dur); s.connect(fl); fl.connect(g); g.connect(d); s.start(t, Math.random()); s.stop(t + dur + .02); }
  tone(d, t, dur, f, type = 'sine', vol = .5, f2, at = .003) { const c = this.ctx, o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(10, f2), t + dur); g.gain.setValueAtTime(.0001, t); g.gain.linearRampToValueAtTime(vol, t + at); g.gain.exponentialRampToValueAtTime(.001, t + dur); o.connect(g); g.connect(d); o.start(t); o.stop(t + dur + .02); }
  play(name, pos, v = 1) {
    if (!this.ctx || this.ctx.state !== 'running') return; const now = this.ctx.currentTime; const k = name + (pos ? '' : '!'); if (this.lastS[k] && now - this.lastS[k] < .022) return; this.lastS[k] = now;
    const f = SFX[name]; if (!f) return; const range = f.range || 60, d0 = this.dest(pos, range, f.rev || 0); if (!d0) return; const d = this.ctx.createGain(); d.gain.value = v; d.connect(d0); f.fn(this, d, now);
  }
  mkLoops() {
    const c = this.ctx;
    const eng = { o1: c.createOscillator(), o2: c.createOscillator(), g: c.createGain(), f: c.createBiquadFilter(), n: c.createBufferSource(), ng: c.createGain() }; eng.o1.type = 'sawtooth'; eng.o2.type = 'square'; eng.f.type = 'lowpass'; eng.f.frequency.value = 400; eng.g.gain.value = 0; eng.n.buffer = this.noise; eng.n.loop = true; eng.ng.gain.value = .05; eng.o1.connect(eng.f); eng.o2.connect(eng.f); eng.n.connect(eng.ng); eng.ng.connect(eng.f); eng.f.connect(eng.g); eng.g.connect(this.sfxBus); eng.o1.start(); eng.o2.start(); eng.n.start(); this.eng = eng;
    const mk = (type, freq, q) => { const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(); s.buffer = this.noise; s.loop = true; f.type = type; f.frequency.value = freq; f.Q.value = q; g.gain.value = 0; s.connect(f); f.connect(g); g.connect(this.sfxBus); s.start(); return { f, g }; };
    this.loops.skid = mk('bandpass', 1500, 4); this.loops.wind = mk('lowpass', 500, .5); this.loops.rain = mk('highpass', 2600, .4); this.loops.city = mk('lowpass', 180, .7); this.loops.flame = mk('bandpass', 700, .8);
    const s = { o: c.createOscillator(), l: c.createOscillator(), lg: c.createGain(), g: c.createGain() }; s.o.type = 'triangle'; s.o.frequency.value = 900; s.l.frequency.value = .4; s.lg.gain.value = 350; s.l.connect(s.lg); s.lg.connect(s.o.frequency); s.g.gain.value = 0; s.o.connect(s.g); s.g.connect(this.sfxBus); s.o.start(); s.l.start(); this.siren = s;
  }
  setLoop(n, v, f) { const l = this.loops[n]; if (!l) return; const t = this.ctx.currentTime; l.g.gain.setTargetAtTime(v, t, .08); if (f) l.f.frequency.setTargetAtTime(f, t, .1); }
  engine(on, rpm, throttle, kind = 1) { if (!this.eng) return; const t = this.ctx.currentTime, e = this.eng; if (!on) { e.g.gain.setTargetAtTime(0, t, .12); return; } const base = (kind === 2 ? 52 : kind === 3 ? 95 : 36) + rpm * (kind === 3 ? 210 : 115); e.o1.frequency.setTargetAtTime(base, t, .04); e.o2.frequency.setTargetAtTime(base * .502, t, .04); e.f.frequency.setTargetAtTime(220 + rpm * 1400 + throttle * 500, t, .05); e.g.gain.setTargetAtTime(.05 + throttle * .075 + rpm * .03, t, .06); }
  sirenVol(v) { if (this.siren) this.siren.g.gain.setTargetAtTime(v, this.ctx.currentTime, .2); }
  // cartoon babble voice, one blip per syllable
  babble(pitch, text) { if (!this.ctx || this.ctx.state !== 'running') return; const n = clamp(Math.floor(text.length / 4), 2, 22); let t = this.ctx.currentTime + .02; for (let i = 0; i < n; i++) { const f = pitch * (1 + rand(-.16, .2)), dur = rand(.05, .09); const o = this.ctx.createOscillator(), fl = this.ctx.createBiquadFilter(), g = this.ctx.createGain(); o.type = 'sawtooth'; o.frequency.setValueAtTime(f, t); o.frequency.linearRampToValueAtTime(f * rand(.85, 1.2), t + dur); fl.type = 'bandpass'; fl.frequency.value = rand(500, 1700); fl.Q.value = 3; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.3, t + .012); g.gain.linearRampToValueAtTime(0, t + dur); o.connect(fl); fl.connect(g); g.connect(this.voxBus); o.start(t); o.stop(t + dur + .02); t += dur + rand(.005, .05); } }
  // ---- music ----
  setMusic(mode, inten = 1) { this.want = mode; this.inten = inten; } // null | 'radio' | 'combat' | 'stealth' | 'boss' | 'menu' | 'date' | 'cyber'
  cycle(dir = 1) { this.station = (this.station + dir + STATIONS.length) % STATIONS.length; this.song = null; return STATIONS[this.station]; }
  update(dt) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    this.muf.frequency.setTargetAtTime(G.timeScale < .7 ? 900 : 20000, this.ctx.currentTime, .1);
    let key = null, spec = null; const w = this.want;
    if (w === 'radio') { const s = STATIONS[this.station]; if (s.bpm) { key = s.id; spec = s; } }
    else if (w && SCORES[w]) { key = w; spec = SCORES[w]; }
    if (key !== this.curKey) { this.curKey = key; this.song = key ? new Song(this, spec) : null; }
    if (this.song) this.song.tick(this.inten || 1);
  }
}
const SCORES = {
  menu: { bpm: 84, style: 'menu', seed: 5 }, combat: { bpm: 140, style: 'combat', seed: 9 }, stealth: { bpm: 80, style: 'stealth', seed: 14 }, boss: { bpm: 152, style: 'boss', seed: 77 }, date: { bpm: 76, style: 'lofi', seed: 41 }, cyber: { bpm: 110, style: 'synth', seed: 99 }, sad: { bpm: 60, style: 'sad', seed: 3 },
};
class Song {
  constructor(a, spec) { this.a = a; this.spec = spec; this.step = 0; this.next = a.ctx.currentTime + .1; this.out = a.ctx.createGain(); this.out.gain.value = .5; this.out.connect(a.musBus); this.rv = a.ctx.createGain(); this.rv.gain.value = .25; this.out.connect(this.rv); this.rv.connect(a.rev); this.newSection(spec.seed + Math.floor(Math.random() * 40)); }
  newSection(seed) {
    const r = this.r = rng(seed * 7919); this.root = 33 + r.int(0, 7); this.scale = SCALES[r.pick(['minor', 'minor', 'dorian', 'phryg'])]; this.prog = r.pick([[0, 5, 2, 6], [0, 3, 5, 4], [0, 6, 5, 4], [0, 2, 5, 6], [0, 0, 5, 3]]);
    this.lead = Array.from({ length: 32 }, () => r.chance(.42) ? r.int(0, 9) : -1); this.bassP = Array.from({ length: 16 }, (_, i) => i % 4 === 0 || r.chance(.4) ? r.pick([0, 0, 0, 7, 12, -12 + 12]) : null); this.hat = r.int(0, 2); this.bar = 0; this.leadOn = r.chance(.6);
  }
  n(deg, oct = 0) { const s = this.scale, d = ((deg % 7) + 7) % 7; return mtof(this.root + s[d] + 12 * (Math.floor(deg / 7) + oct)); }
  kick(t, v = 1) { this.a.tone(this.out, t, .22, 140, 'sine', v, 38); }
  snare(t, v = .6) { this.a.nz(this.out, t, .16, 1800, 'highpass', v * .6); this.a.tone(this.out, t, .1, 210, 'triangle', v * .5, 120); }
  hh(t, v = .2, d = .04) { this.a.nz(this.out, t, d, 8000, 'highpass', v); }
  pad(t, dur, deg, v = .08, type = 'sawtooth') { const c = this.a.ctx; for (const k of [0, 2, 4]) { const o = c.createOscillator(), f = c.createBiquadFilter(), g = c.createGain(); o.type = type; o.frequency.value = this.n(deg + k, 2); o.detune.value = rand(-9, 9); f.type = 'lowpass'; f.frequency.setValueAtTime(400, t); f.frequency.linearRampToValueAtTime(1400, t + dur * .5); f.frequency.linearRampToValueAtTime(400, t + dur); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + dur * .3); g.gain.linearRampToValueAtTime(0, t + dur); o.connect(f); f.connect(g); g.connect(this.out); o.start(t); o.stop(t + dur + .05); } }
  bass(t, dur, f, v = .35, type = 'sawtooth', cut = 500) { const c = this.a.ctx, o = c.createOscillator(), fl = c.createBiquadFilter(), g = c.createGain(); o.type = type; o.frequency.value = f; fl.type = 'lowpass'; fl.Q.value = 6; fl.frequency.setValueAtTime(cut * 2.4, t); fl.frequency.exponentialRampToValueAtTime(cut * .5, t + dur); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.001, t + dur); o.connect(fl); fl.connect(g); g.connect(this.out); o.start(t); o.stop(t + dur + .02); }
  tick(inten) {
    const c = this.a.ctx, sp = this.spec, d16 = 60 / sp.bpm / 4; if (this.next < c.currentTime - 1) this.next = c.currentTime + .05;
    while (this.next < c.currentTime + .25) {
      const s = this.step % 16, t = this.next, bar = Math.floor(this.step / 16), ch = this.prog[bar % 4]; const L = this.lead[this.step % 32]; const st = sp.style; const drop = bar % 8 === 7;
      if (st === 'synth') { if (s % 4 === 0 && !drop) this.kick(t, .8); if (s % 8 === 4) this.snare(t); if (s % 2 === 1 - this.hat % 2) this.hh(t, .12); if (s % 2 === 0) this.bass(t, d16 * 1.8, this.n(ch, 0) * (s % 4 === 2 ? 2 : 1), .3); if (s === 0) this.pad(t, d16 * 16, ch); if (L >= 0 && this.leadOn) this.a.tone(this.out, t, d16 * 2, this.n(ch + L, 3), 'square', .06); }
      else if (st === 'techno') { if (s % 4 === 0) this.kick(t, 1); if (s % 4 === 2) this.hh(t, .25, .09); if (s % 2) this.hh(t, .08); if (s % 8 === 4) this.snare(t, .35); const b = this.bassP[s]; if (b !== null && s % 4) this.bass(t, d16, this.n(0, 0) * (b === 12 ? 2 : 1), .3, 'square', 300 + 500 * (bar % 8) / 8); if (L >= 5) this.a.tone(this.out, t, d16 * .9, this.n(L, 3), 'sawtooth', .05); }
      else if (st === 'lofi') { if (s === 0 || s === 7 || s === 10) this.kick(t, .6); if (s % 8 === 4) this.snare(t + .012, .35); if (s % 2 === 0) this.hh(t + (s % 4 === 2 ? .02 : 0), .07); if (s === 0) this.pad(t, d16 * 15, ch, .06, 'triangle'); if (s % 8 === 0) this.bass(t, d16 * 5, this.n(ch, 0), .25, 'triangle', 300); if (L >= 0 && s % 2 === 0) this.a.tone(this.out, t, d16 * 4, this.n(ch + L, 2), 'sine', .1); }
      else if (st === 'phonk') { if (s === 0 || s === 6 || s === 10) { this.kick(t, 1); this.bass(t, d16 * 4, this.n(ch, -0), .45, 'sine', 900); } if (s % 8 === 4) this.snare(t, .7); this.hh(t, s % 3 === 0 ? .14 : .06); if (L >= 0 && s % 2 === 0) { this.a.tone(this.out, t, .18, this.n(L, 3), 'square', .07, this.n(L, 3) * .97); } }
      else if (st === 'dub') { if (s === 8) this.kick(t, .9); if (s % 8 === 4) { this.pad(t, d16 * 1.5, ch, .12, 'square'); } if (s === 8) this.snare(t, .4); if (s % 2 === 0) this.hh(t, .06); const b = this.bassP[s]; if (b !== null) this.bass(t, d16 * 2.2, this.n(ch + (b === 7 ? 4 : 0), 0), .4, 'sine', 700); }
      else if (st === 'menu') { if (s === 0) { this.pad(t, d16 * 16, ch, .1); this.bass(t, d16 * 14, this.n(ch, 0), .25, 'triangle', 300); } if (s % 4 === 2) this.a.tone(this.out, t, .5, this.n(ch + [0, 2, 4, 6][(s >> 2) % 4], 3), 'sine', .08); if (bar % 8 > 3 && s % 8 === 0) this.kick(t, .5); }
      else if (st === 'combat' || st === 'boss') { const hot = inten > .5; if (s % 4 === 0) this.kick(t, .85); if (s % 8 === 4) this.snare(t, .55); if (hot || s % 2 === 0) this.hh(t, .1); if (s % 2 === 0 || this.bassP[s] !== null) this.bass(t, d16 * 1.2, this.n(ch, 0), .32, 'sawtooth', 420 + (bar % 4) * 130); if (st === 'boss' && s === 0) this.pad(t, d16 * 16, ch, .09); if (L >= 4 && hot) this.a.tone(this.out, t, d16 * 1.5, this.n(L, 3), st === 'boss' ? 'sawtooth' : 'square', .05); }
      else if (st === 'stealth') { if (s === 0) this.bass(t, d16 * 10, this.n(ch, 0), .3, 'sine', 300); if (s % 4 === 0) this.hh(t, .05); if (L >= 6) this.a.tone(this.out, t, .5, this.n(L, 2), 'triangle', .06); if (s === 12 && bar % 2) this.kick(t, .4); }
      else if (st === 'sad') { if (s === 0) this.pad(t, d16 * 16, ch, .09, 'triangle'); if (s % 4 === 0 && L >= 0) this.a.tone(this.out, t, 1.2, this.n(ch + L, 2), 'sine', .14); }
      this.step++; this.next += d16; if (this.step % 256 === 0) this.newSection(sp.seed + this.step + Math.floor(Math.random() * 99));
    }
  }
}
const S = (fn, range = 60, rev = 0) => ({ fn, range, rev });
const gun = (f, dur, vol, low, rev = .35) => S((a, d, t) => { a.nz(d, t, dur, f, 'lowpass', vol, 200); a.nz(d, t, .03, 5000, 'highpass', vol * .5); a.tone(d, t, dur * .7, low, 'square', vol * .4, 40); }, 110, rev);
const SFX = {
  pistol: gun(3200, .16, .7, 220), smg: gun(3800, .1, .5, 260), rifle: gun(2600, .2, .75, 180), shotgun: gun(1700, .34, 1, 120), sniper: gun(2200, .5, 1.1, 130, .7), lmg: gun(2000, .18, .8, 150), revolver: gun(2000, .32, .95, 140), silenced: S((a, d, t) => { a.nz(d, t, .09, 1200, 'bandpass', .35, 400); }, 25),
  coin: S((a, d, t) => { a.nz(d, t, .08, 2600, 'lowpass', .5, 300); a.tone(d, t, .12, rand(2600, 3800), 'triangle', .22); a.tone(d, t + .01, .2, rand(4200, 5200), 'sine', .1); }, 90, .2),
  smart: S((a, d, t) => { a.tone(d, t, .16, 900, 'sawtooth', .25, 180); a.tone(d, t, .08, 2400, 'square', .12, 900); a.nz(d, t, .06, 4000, 'highpass', .2); }, 80, .3),
  laser: S((a, d, t) => { a.tone(d, t, .14, 1800, 'sawtooth', .25, 260); a.tone(d, t, .1, 2700, 'square', .08, 400); }, 80, .3),
  rail: S((a, d, t) => { a.tone(d, t, .5, 3000, 'sawtooth', .35, 60); a.nz(d, t, .3, 3000, 'lowpass', .8, 100); a.tone(d, t, .3, 80, 'sine', .8, 30); }, 140, .8),
  charge: S((a, d, t) => a.tone(d, t, .7, 200, 'sawtooth', .12, 2400, .2), 30),
  rocket: S((a, d, t) => { a.nz(d, t, .7, 900, 'bandpass', .9, 3000); a.tone(d, t, .3, 160, 'square', .4, 50); }, 110, .4),
  thump: S((a, d, t) => { a.tone(d, t, .16, 220, 'sine', .9, 60); a.nz(d, t, .08, 900, 'lowpass', .4); }, 60, .2),
  explode: S((a, d, t) => { a.nz(d, t, 1.5, 1600, 'lowpass', 1.4, 50); a.tone(d, t, .9, 90, 'sine', 1.3, 24); a.nz(d, t, .15, 4000, 'highpass', .5); a.nz(d, t + .1, 2, 300, 'lowpass', .5, 60); }, 190, .8),
  emp: S((a, d, t) => { a.tone(d, t, .8, 2000, 'sawtooth', .4, 40); a.tone(d, t, .6, 70, 'square', .4, 600); a.nz(d, t, .5, 6000, 'bandpass', .5, 300, 6); }, 120, .7),
  hit: S((a, d, t) => { a.nz(d, t, .07, 900, 'lowpass', .5, 200); }, 40), hitmark: S((a, d, t) => a.tone(d, t, .05, 1500, 'square', .13, 1100)), headshot: S((a, d, t) => { a.tone(d, t, .09, 2100, 'square', .2, 1500); a.tone(d, t + .03, .1, 2800, 'sine', .2); }), kill: S((a, d, t) => { a.tone(d, t, .1, 700, 'square', .16, 400); a.tone(d, t + .05, .16, 350, 'square', .16, 200); }),
  punch: S((a, d, t) => { a.nz(d, t, .1, 500, 'lowpass', 1, 80); a.tone(d, t, .1, 130, 'sine', .7, 50); }, 35), swing: S((a, d, t) => a.nz(d, t, .18, 900, 'bandpass', .3, 2400, 2), 25), slash: S((a, d, t) => { a.nz(d, t, .14, 5200, 'bandpass', .5, 2200, 3); a.tone(d, t, .2, 3000, 'triangle', .07); }, 35), bonk: S((a, d, t) => { a.tone(d, t, .22, 620, 'triangle', .7, 340); a.nz(d, t, .05, 1500, 'lowpass', .5); }, 40, .2), squeak: S((a, d, t) => { a.tone(d, t, .12, 800, 'sine', .5, 1700); a.tone(d, t + .12, .1, 1500, 'sine', .4, 700); }, 50),
  reload: S((a, d, t) => { a.nz(d, t, .05, 2600, 'bandpass', .4, 0, 5); a.nz(d, t + .25, .05, 1800, 'bandpass', .5, 0, 5); a.nz(d, t + .5, .04, 3200, 'bandpass', .5, 0, 5); }), empty: S((a, d, t) => a.nz(d, t, .03, 3000, 'bandpass', .35, 0, 6)), pickup: S((a, d, t) => { a.tone(d, t, .09, 660, 'triangle', .3); a.tone(d, t + .07, .14, 990, 'triangle', .3); }), cash: S((a, d, t) => { for (let i = 0; i < 4; i++) a.tone(d, t + i * .05, .16, 1300 + i * 330, 'triangle', .2); a.nz(d, t, .06, 6000, 'highpass', .2); }), duck: S((a, d, t) => { for (let i = 0; i < 2; i++) { a.tone(d, t + i * .17, .13, 520, 'sawtooth', .4, 300); a.nz(d, t + i * .17, .1, 1200, 'bandpass', .3, 0, 6); } }),
  heal: S((a, d, t) => { a.nz(d, t, .25, 3000, 'bandpass', .2, 600); a.tone(d, t, .4, 400, 'sine', .25, 800); }), eat: S((a, d, t) => { for (let i = 0; i < 3; i++) a.nz(d, t + i * .16, .08, 1800, 'bandpass', .3, 900, 2); }), hurt: S((a, d, t) => { a.tone(d, t, .12, 190, 'sawtooth', .3, 90); a.nz(d, t, .08, 700, 'lowpass', .4); }),
  step: S((a, d, t) => a.nz(d, t, .05, rand(500, 800), 'lowpass', .13), 16), jump: S((a, d, t) => a.nz(d, t, .1, 600, 'lowpass', .2), 20), land: S((a, d, t) => a.nz(d, t, .14, 400, 'lowpass', .5), 25), splash: S((a, d, t) => { a.nz(d, t, .6, 2400, 'bandpass', .7, 500); }, 50),
  crash: S((a, d, t) => { a.nz(d, t, .4, 2400, 'lowpass', .9, 120); a.tone(d, t, .2, 100, 'square', .5, 35); a.nz(d, t + .05, .4, 5500, 'highpass', .25); }, 90, .3), bump: S((a, d, t) => { a.nz(d, t, .14, 700, 'lowpass', .6, 100); }, 50), door: S((a, d, t) => { a.nz(d, t, .1, 500, 'lowpass', .7, 100); a.nz(d, t + .02, .05, 1800, 'bandpass', .3); }, 30), glass: S((a, d, t) => { for (let i = 0; i < 6; i++) a.tone(d, t + rand(0, .16), .16, rand(2500, 6000), 'triangle', .12); a.nz(d, t, .2, 6000, 'highpass', .4); }, 60, .2), horn: S((a, d, t) => { a.tone(d, t, .4, 392, 'sawtooth', .22); a.tone(d, t, .4, 494, 'sawtooth', .2); }, 80),
  ignite: S((a, d, t) => { for (let i = 0; i < 4; i++) a.nz(d, t + i * .11, .08, 400, 'lowpass', .5); a.tone(d, t + .45, .5, 60, 'sawtooth', .35, 110); }, 30),
  scan: S((a, d, t) => { a.tone(d, t, .22, 500, 'sine', .22, 1400); a.tone(d, t + .05, .2, 1200, 'sine', .1, 2400); }), scanoff: S((a, d, t) => a.tone(d, t, .16, 1200, 'sine', .16, 400)), hack: S((a, d, t) => { for (let i = 0; i < 6; i++) a.tone(d, t + i * .035, .04, pick([880, 1320, 1760, 2093, 660]), 'square', .09); }), hackdone: S((a, d, t) => { [660, 880, 1320].forEach((f, i) => a.tone(d, t + i * .08, .2, f, 'triangle', .22)); }), deny: S((a, d, t) => { a.tone(d, t, .14, 190, 'square', .22); a.tone(d, t + .15, .18, 150, 'square', .22); }), zap: S((a, d, t) => { for (let i = 0; i < 5; i++) a.nz(d, t + i * .04, .04, rand(2000, 6000), 'bandpass', .5, 0, 8); a.tone(d, t, .25, 120, 'sawtooth', .3, 60); }, 60),
  ui: S((a, d, t) => a.tone(d, t, .05, 880, 'triangle', .13)), uiback: S((a, d, t) => a.tone(d, t, .07, 520, 'triangle', .13)), msg: S((a, d, t) => { a.tone(d, t, .12, 1046, 'sine', .25); a.tone(d, t + .12, .2, 1396, 'sine', .25); }), ring: S((a, d, t) => { for (let i = 0; i < 2; i++) { a.tone(d, t + i * .3, .2, 1200, 'square', .08); a.tone(d, t + i * .3, .2, 1500, 'square', .08); } }), levelup: S((a, d, t) => { [523, 659, 784, 1046].forEach((f, i) => a.tone(d, t + i * .1, .4, f, 'triangle', .25)); }), mission: S((a, d, t) => { [196, 262, 330, 392, 523].forEach((f, i) => a.tone(d, t + i * .07, 1.4, f, 'sawtooth', .1)); a.tone(d, t, 1, 65, 'sine', .7, 50); }, 60, .5), passed: S((a, d, t) => { [[392, 0], [523, .14], [659, .28], [784, .42], [1046, .7]].forEach(([f, o]) => { a.tone(d, t + o, .8, f, 'sawtooth', .12); a.tone(d, t + o, .8, f * 1.5, 'triangle', .12); }); }, 60, .5), fail: S((a, d, t) => { [330, 311, 294, 220].forEach((f, i) => a.tone(d, t + i * .25, .6, f, 'sawtooth', .16)); }, 60, .4), print: S((a, d, t) => { a.nz(d, t, .045, 3400, 'bandpass', .22, 0, 5); }), star: S((a, d, t) => { a.tone(d, t, .16, 740, 'square', .13); a.tone(d, t + .16, .16, 622, 'square', .13); }),
  beep: S((a, d, t) => a.tone(d, t, .07, 1500, 'sine', .25), 30), alarm: S((a, d, t) => { a.tone(d, t, .3, 880, 'square', .22, 660); a.tone(d, t + .35, .3, 880, 'square', .22, 660); }, 120, .4), servo: S((a, d, t) => a.tone(d, t, .3, 180, 'sawtooth', .12, 420), 40), thud: S((a, d, t) => { a.tone(d, t, .5, 70, 'sine', 1.2, 25); a.nz(d, t, .3, 500, 'lowpass', .8, 60); }, 110, .5), thunder: S((a, d, t) => { a.nz(d, t, 3, 400, 'lowpass', .8, 40); }, 60, .8), click: S((a, d, t) => a.nz(d, t, .02, 3000, 'bandpass', .4, 0, 5)), kiss: S((a, d, t) => { a.nz(d, t, .06, 2400, 'bandpass', .3, 4200, 5); a.tone(d, t + .04, .07, 900, 'sine', .12, 1900); }), scream: S((a, d, t) => { a.tone(d, t, .5, rand(600, 900), 'sawtooth', .12, rand(400, 1100)); }, 45), whoosh: S((a, d, t) => a.nz(d, t, .6, 300, 'bandpass', .5, 2600, 1.2)), ability: S((a, d, t) => { a.tone(d, t, .7, 80, 'sawtooth', .4, 500); a.nz(d, t, .5, 400, 'bandpass', .4, 4000, 2); }, 60, .5), shield: S((a, d, t) => { a.tone(d, t, .25, 400, 'triangle', .3, 900); }, 50), flame: S((a, d, t) => a.nz(d, t, .2, 900, 'bandpass', .4, 300), 50),
};
export const audio = new Audio(); G.audio = audio;
