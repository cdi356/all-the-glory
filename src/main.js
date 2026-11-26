import * as THREE from 'three';
import { G } from './core/g.js';
import { input } from './core/input.js';
import { audio } from './core/audio.js';
import { Phys } from './core/physics.js';
import { V3, clamp, damp, dist2, el } from './core/util.js';
import { City } from './world/city.js';
import { Gfx } from './world/gfx.js';
import { Interiors } from './world/interiors.js';
import { FX } from './sys/fx.js';
import { updateProjectiles } from './sys/combat.js';
import { Vehicle } from './ent/vehicle.js';
import { Cam, PlayerCtl } from './ent/player.js';
import { Traffic, Peds, Police, Pickups } from './sys/sim.js';
import { Hack, Minigames } from './sys/hack.js';
import { Prog, Saves, newSave } from './sys/progress.js';
import { Flow } from './sys/flow.js';
import { HUD, bark } from './ui/hud.js';
import { Menus } from './ui/menus.js';
import { Story } from './story/story.js';
import { Dates } from './story/dates.js';
import { Side } from './story/side.js';
import { POI } from './world/citydata.js';
import { Coop } from './sys/coop.js';
import { Net } from './sys/net.js';
import { Places } from './sys/places.js';
import { initLoot, tagsOptic } from './sys/arsenal.js';
import { initGear } from './sys/gear.js';
import { Quests } from './story/quests.js';
import { applyCarMods } from './ent/carmods.js';
import { VEH } from './ent/vehmodels.js';
import { PERKS, BIZ, OPS } from './sys/progress.js';
import { NPC, spawnEnemy } from './ent/actor.js';
import { LOOKS } from './ent/human.js';

window.G = G; window.THREE = THREE; G.input = input; G.POI = POI; G.applyCarMods = applyCarMods; G.V3 = V3; G.NPC = NPC; G.LOOKS = LOOKS; G.spawnEnemy = spawnEnemy;
const load = el('div', 'load', document.getElementById('ui'), 'Building Saint Vesper');
function boot() {
  G.Vehicle = Vehicle; G.bark = bark; G.saves = new Saves(); G.settings = Object.assign({ sens: 1, invert: 0, master: .8, sfx: .9, music: .5, voice: .8, quality: 'high', traffic: 26, peds: 42, splitOn: 0 }, G.saves.settings());
  G.gfx = new Gfx(document.getElementById('c')); G.phys = new Phys(); G.city = new City(G.phys).build(); G.scene.add(G.city.group); G.interiors = new Interiors(); G.fx = new FX(); G.cam = new Cam(); G.ctl = new PlayerCtl(); G.prog = new Prog(); G.hack = new Hack(); G.minigame = new Minigames(); G.traffic = new Traffic(); G.peds = new Peds(); G.police = new Police(); G.pick = new Pickups(); G.hud = new HUD(); G.flow = new Flow(); G.story = new Story(); G.dates = new Dates(); G.side = new Side(); G.menus = new Menus(); G.coop = new Coop(); G.net = new Net(); G.places = new Places(); initLoot(); initGear(); G.quests = new Quests(); G.VEH = VEH; Object.assign(G.menus, { PERKS, BIZ, OPS }); G.hackables = [];
  input.init(document.getElementById('c')); if (G.settings.quality !== 'high') G.gfx.setQuality(G.settings.quality); G.titleS = { hour: 20.5 }; G.S = null; load.remove(); let n = null; try { n = sessionStorage.getItem('atg_load'); sessionStorage.removeItem('atg_load'); } catch (e) { /* storage blocked */ } const d = n && G.saves.read(n); if (d) { G.menus.begin(d); } else { G.menus.title(); if (location.protocol.startsWith('http') && !/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) G.menus.sub('LAN co-op', p => G.menus.lanJoin(p)); } requestAnimationFrame(loop);
}
let last = 0, fpsT = 0, fpsN = 0;
// a hosting window that is minimized or covered gets no animation frames, so keep the world running on a timer
let bgLast = 0; setInterval(() => { const now = performance.now(); if (!(document.hidden && G.state === 'play' && G.net && G.net.host && G.net.peers.size && !G.debug.manual)) { bgLast = now; return; } const dt = Math.min(.05, (now - bgLast) / 1000 || .033); bgLast = now; last = now; const nr = G.debug.norender; G.debug.norender = true; try { frame(dt); } finally { G.debug.norender = nr; } }, 33);
function loop(t) { requestAnimationFrame(loop); const dt = Math.min(.05, (t - last) / 1000 || .016); last = t; if (G.state === 'play' && !G.debug.manual) G.gfx.adaptive(dt); fpsT += dt; if (++fpsN >= 60) { G.fps = fpsN / fpsT; fpsN = 0; fpsT = 0; } if (!G.debug.manual) frame(dt); }
function titleFrame(dt) { const t = G.time * .035; const c = G.camera; const r = 330; c.position.set(110 + Math.sin(t) * r, 92 + Math.sin(t * 1.7) * 26, -110 + Math.cos(t) * r); c.lookAt(110, 104, -110); G.focus = c.position; G.S = G.titleS; G.S.hour = 20.6; G.gfx.update(dt, dt); G.gfx.view(null, dt); G.city.update(dt, G.gfx.night); G.S = null; audio.setMusic('menu'); audio.update(dt); G.gfx.render(); }
export function frame(dt) {
  G.rdt = dt; input.poll(); input.uiPads(dt); G.net.tick(dt); if (G.state === 'menu') { G.time += dt; titleFrame(dt); input.end(); return; } const C = G.coop; if (G.state !== 'play') return; if (G.net.client) return clientFrame(dt);
  const ui = !(G.net.host && G.net.peers.size) && (G.paused || (G.menus.cur && ['shop', 'garage', 'bench'].includes(G.menus.cur.kind)) || G.minigame.active); G.net.hostPre(); G.timeScale = damp(G.timeScale, G.wantScale || 1, 12, dt); const sdt = ui ? 0 : dt * G.timeScale; G.dt = sdt;
  if (!ui) {
    // sub-step so fast cars stay solid at low frame rates
    const steps = sdt > .024 ? 2 : 1, h = sdt / steps; G.time += sdt; G.bus.emit('tick', dt); const turn = () => { G.hud.wheelToggle(input.down('wheel') && !G.busy() && !G.inputLock && !G.droneCtl && G.player.alive && !(G.player.down > 0)); G.hud.wheelTick(); G.hack.update(sdt, dt); G.ctl.update(sdt); }; if (C.on) { G.coopScale = 1; for (const c of C.ctxs.slice()) if (C.ctxs.includes(c)) C.run(c, () => { turn(); if (c.i > 0 && input.hit('swap') && !G.busy() && !G.inputLock) G.flow.swapMenu(); }); G.wantScale = G.coopScale; C.update(sdt); } else turn(); const p = G.player;
    for (let s = 0; s < steps; s++) { G.dt = h; for (const v of G.vehicles.slice()) v.update(h); } G.dt = sdt; for (const a of G.actors.slice()) { if (a === p || G.isH(a)) { if (!a.gone && a !== p && !a.alive) a.animate(sdt); if (!p.alive && a === p) { p.deadT += sdt; p.physics(sdt, 0, 0, 3); p.animate(sdt); } } else if (!a.gone) a.update(sdt); } for (const d of G.drones.slice()) d.update(sdt); updateProjectiles(sdt); G.traffic.update(sdt); G.peds.update(sdt); G.police.update(sdt); G.pick.update(sdt); if (G.mission) G.mission.update(sdt); G.side.update(sdt); G.flow.update(sdt); G.places.update(sdt); G.quests.update(sdt); G.fx.update(sdt); if (C.on) for (const c of C.ctxs) C.run(c, () => { G.cam.update(dt); c.selfVis = G.player.model.group.visible; }); else G.cam.update(dt);
  }
  const huds = () => { if (C.on) for (const c of C.ctxs.slice()) C.run(c, () => G.hud.update(dt)); G.hud.update(dt); G.net.hostPost(dt); }; if (G.debug.norender) { huds(); input.end(); return; } sound(dt); G.gfx.update(ui ? 0 : dt, dt); G.city.update(dt, G.interior ? 1 : G.gfx.night); huds();
  if (C.split()) { G.gfx.renderer.info.reset(); for (const c of C.locals()) { for (const o of C.ctxs) { const a = C.pl(o); a.model.group.visible = o === c ? c.selfVis : !a.hidden && Math.hypot(a.pos.x - c.camera.position.x, a.pos.z - c.camera.position.z) > .95; } C.run(c, () => { G.gfx.view(c, dt); if (G.interior) G.interior.lightUpdate(); headlight(); G.gfx.renderRect(c.rect); }); } G.gfx.fadeMain(dt); G.gfx.renderer.setScissorTest(false); C.drawQuad(); }
  else { const z = C.on && !G.cam.cine ? C.ctxs[0] : null; if (C.on && C.ctxs.length > 1) for (const o of C.ctxs) C.pl(o).model.group.visible = o === z ? o.selfVis : !C.pl(o).hidden; G.gfx.view(z, dt); if (z) G.gfx.fadeMain(dt); if (G.interior) G.interior.lightUpdate(); headlight(); G.gfx.render(); }
  input.end();
}
function clientFrame(dt) { if (G.net.clientFrame(dt)) { if (!G.debug.norender) { sound(dt); G.gfx.update(dt, dt); G.city.update(dt, G.interior ? 1 : G.gfx.night); } G.hud.update(dt); if (!G.debug.norender) { G.gfx.view(null, dt); if (G.interior) G.interior.lightUpdate(); headlight(); G.gfx.render(); } } input.end(); }
function headlight() { const p = G.player, s = G.gfx.spot; if (p && p.vehicle && !G.interior && G.gfx.night > .4 && p.vehicle.alive) { const v = p.vehicle, f = V3(Math.sin(v.yaw), 0, Math.cos(v.yaw)); s.position.set(v.pos.x + f.x * v.def.L * .5, v.pos.y + .9, v.pos.z + f.z * v.def.L * .5); s.target.position.set(v.pos.x + f.x * 22, v.pos.y - .5, v.pos.z + f.z * 22); s.intensity = 60; } else s.intensity = 0; }
function sound(dt) {
  if (!audio.ctx) return; const p = G.player, v = p && p.vehicle; audio.engine(!!(v && v.driver === p && v.alive && !G.paused), v ? v.rpm : 0, v ? Math.abs(v.throttle) : 0, v ? (v.def.fly ? 2 : v.def.bike ? 3 : 1) : 1); audio.setLoop('skid', v && v.onGround && v.slip > 4 && v.speed > 6 ? clamp((v.slip - 4) / 14) * .28 : 0, 900 + (v ? v.slip * 60 : 0)); audio.setLoop('wind', v ? clamp(v.speed / 60) * .22 : 0, 300 + (v ? v.speed * 12 : 0)); audio.setLoop('rain', G.interior ? 0 : G.gfx.weather.rain * .1); audio.setLoop('city', G.interior ? .012 : .07); let sv = 0; for (const u of G.vehicles) if (u.sirenOn && u.alive) { const d = u.pos.distanceTo(G.camera.position); sv = Math.max(sv, .055 / (1 + (d / 32) ** 2)); } audio.sirenVol(sv);
  let mode = null, inten = .4; const hot = p && G.actors.some(a => a.alive && a.state === 'combat' && p.hostileTo(a) && a.far < 60); if (hot) { G.hotT = G.time; } const m = G.mission; if (audio.want === 'sad' && G.inputLock) mode = 'sad'; else if (G.boss && G.boss.alive) { mode = 'boss'; inten = 1; } else if (G.time - (G.hotT || -99) < 7 || G.police.stars >= 2 && !(v && STATION())) { mode = 'combat'; inten = G.police.stars > 2 || hot ? 1 : .4; } else if (m && m.def.date || G.net.client && G.net.isDate) mode = v ? 'radio' : 'date'; else if (v && !v.def.fly) mode = 'radio'; else if (G.interior && G.interior.def.cyber) mode = 'cyber'; else if (G.interior && (G.interior.id === 'club' || G.interior.id === 'arcade')) mode = 'cyber'; else if (G.stealth) mode = 'stealth'; audio.setMusic(mode, inten); audio.update(dt);
}
const STATION = () => audio.station > 0;
G.frame = frame; G.newSave = newSave;
// ---- automated playtest hooks (used by tools/autotest notes in README; inert in normal play) ----
G.test = {
  async fresh(mission = 0) { G.debug.auto = true; G.debug.manual = true; G.debug.norender = true; const s = newSave(); s.mission = mission; s.level = 20; s.cash = 500000; for (let i = 0; i < mission; i++) s.done[G.story.MISSIONS[i].id] = 1; Object.assign(s.flags, { hideout: 1, crumb: 1, sigs: 1, bev: 1, doc: 1 }); for (const k in s.rel) s.rel[k].met = true; s.weapons.kessler = { lvl: 3, mods: {}, mag: null }; s.ammo.medium = 300; G.menus.begin(s, false); },
  async run(i, max = 9000, kill = false, def = null) { const killed = {}; G.lastMissionError = null; const id = def ? 'side' : G.story.MISSIONS[i].id; const st = []; const t0 = performance.now(); if (def) def(); else G.story.start(i); await new Promise(r => setTimeout(r, 30)); for (let n = 0; n < max; n++) { if (n % 2 === 0) await new Promise(r => setTimeout(r, 0)); G.player.hp = Math.max(G.player.hp, G.player.maxHp); for (const k in G.crew) G.crew[k].hp = G.crew[k].maxHp; if (G.police.stars && n % 60 === 0) G.police.clear(true); frame(1 / 30); if (G.mission && st[st.length - 1] !== G.mission.stage + ':' + G.hud.cache.ob) st.push(G.mission.stage + ':' + G.hud.cache.ob); if (kill && G.mission && !killed[G.mission.stage] && (G.mission.kt = (G.mission.ks === G.mission.stage ? G.mission.kt || 0 : 0) + 1, G.mission.ks = G.mission.stage, G.mission.kt === 25) && G.player.alive) { killed[G.mission.stage] = 1; G.player.secondT = G.time; G.player.hp = -1; G.player.die({}); } if (G.lastMissionError) return { id, error: G.lastMissionError.stack, st }; if (kill ? false : 0) return; if ((def ? n > 30 : G.S.done[id]) && !G.mission && !G.flow.dying) return { id, ok: true, kills: Object.keys(killed).length, frames: n, ms: Math.round(performance.now() - t0) }; } return { id, stuck: true, stage: G.mission && G.mission.stage, st: st.slice(-8), pos: G.player.pos.toArray() }; },
};
// damage routing for the controlled character
import { Actor } from './ent/actor.js';
const base = Actor.prototype.damage;
Actor.prototype.damage = function (n, info = {}) { if (G.isH(this)) { const me = this; n = G.as(me, () => G.flow.filter(n, info)); if (G.phonyInvuln) return; if (me.down > 0) return; } else if (this.isCrew) n *= .35; return base.call(this, n, info); };
setTimeout(boot, 30);
