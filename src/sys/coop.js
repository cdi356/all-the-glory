// Local split-screen co-op. Solo code talks to G.player / G.cam / G.ctl / G.hud; in co-op each player owns a
// context holding those objects, and run(ctx, fn) swaps them in while that player's code executes.
import * as THREE from 'three';
import { G } from '../core/g.js';
import { input } from '../core/input.js';
import { V3, clamp, rand, el, esc, dist2, TAU } from '../core/util.js';
import { Cam, PlayerCtl } from '../ent/player.js';
import { Hack } from './hack.js';
import { PlayerHUD, CHAR } from '../ui/hud.js';
import { POIS } from '../world/citydata.js';

const KEYS = ['player', 'cam', 'ctl', 'hack', 'scan', 'mods', 'camera', 'droneCtl', 'focus', 'hud'];
const newFx = () => ({ damage: 0, scan: 0, slow: 0, glitch: 0, fade: 0, flash: 0, cyber: 0, drunk: 0, gray: 0, letter: 0 });
export const devName = d => !d ? 'Nothing' : d.kind === 'net' ? 'LAN' + (d.name ? ': ' + d.name : '') : d.kind === 'kbm' ? 'Keyboard + mouse' : d.kind === 'kb2' ? 'Keyboard, right side' : 'Controller ' + (d.index + 1);
export class Coop {
  constructor() { this.on = false; this.ctxs = []; this.cur = null; this.stack = []; this.base = {}; this.layout = 'stack'; G.bus.on('uipad', (b, i) => this.padEvent(b, i)); }
  // ---- contexts ----
  save(c) { if (c === null) { for (const k of KEYS) this.base[k] = G[k]; const z = this.ctxs[0]; if (z) for (const k of KEYS) if (k !== 'hud') z[k] = G[k]; return; } for (const k of KEYS) c[k] = G[k]; if (c === this.ctxs[0]) for (const k of KEYS) if (k !== 'hud') this.base[k] = G[k]; }
  load(c) { const z = c || this.base; for (const k of KEYS) G[k] = z[k]; G.gfx.fx = c ? c.fx : G.gfx.mainFx; const d = c || this.ctxs[0]; input.dev = this.on && d ? d.dev : null; const p = G.player; input.inCar = !!(p && p.vehicle && p.vehicle.driver === p); }
  run(c, fn) { if (!this.on || !c || c === this.cur || !this.ctxs.includes(c)) return fn(); const prev = this.cur; this.save(prev); this.load(c); this.cur = c; try { return fn(); } finally { this.save(c); this.cur = prev; this.load(prev); } }
  // used around DOM event handlers, where a closure cannot wrap the work
  push(c) { this.stack.push(this.cur); if (this.on && c && c !== this.cur && this.ctxs.includes(c)) { this.save(this.cur); this.load(c); this.cur = c; } }
  pop() { if (!this.stack.length) return; const prev = this.stack.pop(); if (prev === this.cur) return; if (this.cur) this.save(this.cur); this.cur = prev; if (prev !== null && !this.ctxs.includes(prev)) this.cur = null; this.load(this.cur); }
  pl(c) { return c === this.cur || (this.cur === null && c === this.ctxs[0]) ? G.player : c.player; }
  actors() { return this.ctxs.map(c => this.pl(c)); }
  ctxOf(a) { for (const c of this.ctxs) if (this.pl(c) === a) return c; return null; }
  get primary() { return this.pl(this.ctxs[0]); }
  hasKbm() { return this.ctxs.some(c => c.dev && c.dev.kind === 'kbm'); }
  padTaken(i) { return this.ctxs.some(c => c.dev && c.dev.kind === 'pad' && c.dev.index === i); }
  freeChars() { return Object.keys(G.crew).filter(id => G.crew[id].alive && !this.ctxOf(G.crew[id]) && G.S.dead !== id); }
  freeDevs(forCtx) { const L = []; const used = d => this.ctxs.some(c => c !== forCtx && c.dev && c.dev.kind === d.kind && (d.kind !== 'pad' || c.dev.index === d.index)); const add = d => { if (!used(d)) L.push(d); }; add({ kind: 'kbm' }); add({ kind: 'kb2' }); for (const p of input.pads) if (p) add({ kind: 'pad', index: p.index }); return L; }
  // ---- lifecycle ----
  start(dev) {
    if (this.on) return; this.layout = G.settings.split || 'stack'; this.on = true; this.cur = null; const c = { i: 0, dev: dev || { kind: 'kbm' }, fx: newFx(), sm: {}, selfVis: true }; this.ctxs = [c]; for (const k of KEYS) { c[k] = G[k]; this.base[k] = G[k]; } c.hud = new PlayerHUD(G.hud, c); G.hud.root.classList.add('coop'); input.dev = c.dev; this.layoutNow(); if (!this.hasKbm()) input.unlock();
  }
  stop() { if (!this.on) return; while (this.ctxs.length > 1) this.leave(this.ctxs[this.ctxs.length - 1], true); this.ctxs[0].hud.destroy(); this.on = false; this.ctxs = []; this.cur = null; input.dev = null; input.inCar = false; G.gfx.fx = G.gfx.mainFx; G.hud.root.classList.remove('coop'); this.quad && this.quad.remove(); this.quad = null; G.gfx.resize(); G.prog.recalc(); }
  locals() { return this.ctxs.filter(c => !c.remote); }
  join(dev, id, o = {}) {
    const free = this.freeChars(); if (!free.length || this.ctxs.length >= 3) { G.hud.toast(this.ctxs.length >= 3 ? 'Three players is the limit. There are only three idiots.' : 'No free character to play.'); return null; } if (!this.on) this.start(); id = free.includes(id) ? id : free[0]; const a = G.crew[id]; const camera = new THREE.PerspectiveCamera(65, 1, .08, 3200); const c = { i: this.ctxs.length, dev, fx: newFx(), sm: {}, selfVis: true, player: a, cam: null, camera, ctl: new PlayerCtl(), remote: !!o.remote, out: [], busy: 0, mods: G.mods, droneCtl: null, focus: a.pos, hud: null, hack: G.hack, scan: G.scan };
    this.ctxs.push(c); const sc = G.scan; c.hack = new Hack(); c.hack.tags = this.ctxs[0].hack.tags; c.scan = c.hack; G.scan = sc; c.cam = o.Cam ? new o.Cam(c) : new Cam(); c.hud = new (o.HUD || PlayerHUD)(G.hud.M, c); this.take(c, id); this.layoutNow(); G.audio.play('levelup'); G.hud.toast(`<b>${a.name}</b> joined on ${devName(dev).toLowerCase()}.`); return c;
  }
  // give a player a character, bringing it next to the others when it is in another space
  take(c, id) {
    const a = G.crew[id], lead = this.pl(this.ctxs[0]); a.following = false; a.anchored = false; a.pose = null; a.talk = null; a.ghost = false; a.hidden = false; a.down = 0; a.aiming = false; a.stun = 0; a.alive = true; a.hp = Math.max(a.hp, a.maxHp * .5); a.model.reset(); if (a !== lead && ((a.pos.x > 3500) !== (lead.pos.x > 3500) || dist2(a.pos, lead.pos) > 60)) { if (a.vehicle) a.exitVehicle(); a.interiorId = null; const q = rand(0, TAU); a.pos.set(lead.pos.x + Math.sin(q) * 1.4, lead.pos.y + .1, lead.pos.z + Math.cos(q) * 1.4); a.vel.set(0, 0, 0); } a.interiorId = null;
    c.player = a; this.run(c, () => { G.player = a; const g = G.S.chars[id].gun; a.gun = null; if (g && g !== 'fists' && G.S.weapons[g]) G.ctl.equip(g, true); else { const sig = { jeremiah: 'sudo', jakob: 'muffler', donald: 'coinop' }[id]; if (G.S.weapons[sig]) G.ctl.equip(sig, true); else if (G.S.weapons.sparrow) G.ctl.equip('sparrow', true); else a.setGun('fists'); } G.cam.yaw = a.yaw; G.cam.pitch = -.05; G.cam.snap = true; }); this.mods();
  }
  leave(c, quiet) { const i = this.ctxs.indexOf(c); if (i <= 0) return; const a = this.pl(c); if (c.droneCtl) this.run(c, () => G.hack.endDrone()); if (c.remote && G.net) G.net.left(c); this.ctxs.splice(i, 1); this.ctxs.forEach((x, k) => x.i = k); c.hud.destroy(); if (a && !a.gone) { a.down = 0; a.ghost = false; a.pose = null; a.aiming = false; a.model.group.visible = true; if (G.mission) { a.following = true; a.anchored = false; } else { a.following = true; a.anchored = false; } } if (!quiet) G.hud.toast(`${a.name} dropped out.`); this.layoutNow(); if (this.ctxs.length === 1 && !quiet) this.stop(); }
  // a character is leaving the story for good: whoever was playing them moves on
  retire(id) { if (!this.on) return; const a = G.crew[id], c = this.ctxOf(a); if (!c) return; const free = this.freeChars().filter(k => k !== id); if (c !== this.ctxs[0]) { if (free.length) this.take(c, free[0]); else { if (c.remote) G.net.kicked(c); this.leave(c); } return; } if (free.length) { this.setP1(free[0]); } else { const last = this.ctxs[this.ctxs.length - 1], lid = this.pl(last).charId; this.leave(last, true); this.setP1(lid); if (this.ctxs.length === 1) this.stop(); } }
  setP1(id) { const a = G.crew[id]; a.following = false; a.anchored = false; a.pose = null; a.ghost = false; a.down = 0; G.player = a; G.S.active = id; const g = G.S.chars[id].gun; a.gun = null; if (g && g !== 'fists' && G.S.weapons[g]) G.ctl.equip(g, true); else a.setGun('fists'); G.cam.snap = true; if (this.on && this.ctxs[0]) { this.ctxs[0].player = a; this.base.player = a; } G.prog.recalc(); }
  mods() { if (this.on) G.prog.recalc(); }
  // ---- layout ----
  rects() { const W = innerWidth || 1280, H = innerHeight || 720, n = this.locals().length; if (n <= 1) return [[0, 0, W, H]]; if (n === 2) return this.layout === 'side' ? [[0, 0, W >> 1, H], [W >> 1, 0, W - (W >> 1), H]] : [[0, 0, W, H >> 1], [0, H >> 1, W, H - (H >> 1)]]; const w = W >> 1, h = H >> 1; return [[0, 0, w, h], [w, 0, w, h], [0, h, w, h]]; }
  layoutNow() { if (!this.on) return; const R = this.rects(), L = this.locals(); L.forEach((c, i) => { c.rect = R[i]; c.hud.place(R[i], L.length); }); G.hud.M.root.classList.toggle('three', L.length === 3); G.hud.M.root.classList.toggle('lone', L.length === 1); if (L.length === 3) { if (!this.quad) { this.quad = el('div', 'quad', document.getElementById('ui'), '<canvas width="640" height="400"></canvas>'); } } else if (this.quad) { this.quad.remove(); this.quad = null; } G.gfx.resize(); }
  split() { return this.on && this.locals().length > 1 && !G.cam.cine; }
  drawQuad() { // fourth pane in three-player games: shared map
    if (!this.quad) return; const cv = this.quad.firstChild, r = this.quad.getBoundingClientRect(); if (cv.width !== Math.round(r.width) || cv.height !== Math.round(r.height)) { cv.width = Math.max(2, r.width); cv.height = Math.max(2, r.height); } const x = cv.getContext('2d'), W = cv.width, H = cv.height, M = G.hud; x.fillStyle = '#0c2430'; x.fillRect(0, 0, W, H); const A = this.actors(); const inn = !!G.interior; const pos = a => { const p = inn && G.interiors.ret ? G.interiors.ret : a.vehicle ? a.vehicle.pos : a.pos; return p; }; let cx = 0, cz = 0; for (const a of A) { const p = pos(a); cx += p.x / A.length; cz += p.z / A.length; } let far = 120; for (const a of A) far = Math.max(far, Math.hypot(pos(a).x - cx, pos(a).z - cz) + 60); const k = Math.min(W, H) / 2 / far; const S = M.mapS / (M.mapR * 2); x.save(); x.translate(W / 2, H / 2); x.scale(k, k); x.translate(-cx, -cz); x.drawImage(M.map, -M.mapR, -M.mapR, M.mapR * 2, M.mapR * 2); x.restore(); const ic = (p, t, c, r) => { const X = clamp((p.x - cx) * k + W / 2, 14, W - 14), Y = clamp((p.z - cz) * k + H / 2, 14, H - 14); x.fillStyle = c; x.beginPath(); x.arc(X, Y, r, 0, TAU); x.fill(); x.fillStyle = '#111'; x.font = `700 ${r + 2}px Bahnschrift,sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(t, X, Y + 1); }; for (const o of POIS) if (Math.abs(o.x - cx) < far && Math.abs(o.z - cz) < far) ic(o, o.icon, o.col, 7); for (const m of M.markers) if (!m.hide && m.pos.x < 3500) ic(m.pos, m.icon || '!', m.col || '#ffd24a', 11); if (M.waypoint) ic(M.waypoint, 'x', '#ff5ad0', 10); for (const a of A) ic(pos(a), a.name[0], CHAR[a.charId].col, 12);
  }
  // ---- controllers joining / pausing ----
  padEvent(b, i) {
    if (G.state !== 'play' || G.uiOpen || b !== 'START' || !G.settings.splitOn) return; if (!this.on) return; const c = this.ctxs.find(q => q.dev && q.dev.kind === 'pad' && q.dev.index === i); if (c) { this.run(c, () => G.menus.pause()); return; } if (this.ctxs.length < 3) this.join({ kind: 'pad', index: i });
  }
  // dead-man timers for downed players; nobody is lost for good
  update(dt) {
    if (!this.on) return; for (const c of this.ctxs) { const a = this.pl(c); if (!a || !a.alive || !(a.down > 0)) continue; a.down -= dt; a.vel.x = a.vel.z = 0; if (a.down <= 0) { a.revive(.5); const m = G.humans().find(h => h !== a && h.alive && !(h.down > 0)); if (m && dist2(m.pos, a.pos) > 30) { a.pos.set(m.pos.x + rand(-1.5, 1.5), m.pos.y + .1, m.pos.z + rand(-1.5, 1.5)); a.vel.set(0, 0, 0); } G.hud.toast(`${a.name} is back up.`); } }
    for (const c of this.ctxs) { if (!c.dev.vk && c.dev.kind === 'pad' && !input.pads[c.dev.index]) { if (!c.lost) { c.lost = true; G.hud.toast(`Player ${c.i + 1}: controller disconnected. Open the Co-op tab to change device.`); } } else c.lost = false; }
  }
}
