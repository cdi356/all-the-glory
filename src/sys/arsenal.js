// Gun tiers (street / pro / black-ops), attachments (sight, grip, magazine, stock) with real effects and real models,
// weapon finishes, the late-game guns, and loot that scales with how far into the story you are.
import * as THREE from 'three';
import { G } from '../core/g.js';
import { GeoB, M4, TAU, pick, chance, rand } from '../core/util.js';
import { WEAPONS, MODS, AMMO } from './weapondata.js';
import { Gun, weaponMesh } from './combat.js';
import { getDetailMat } from '../ent/vehmodels.js';
import { Actor } from '../ent/actor.js';

export const TIER = { 1: { name: 'Street', col: '#a8b0ba' }, 2: { name: 'Pro', col: '#4a9aff' }, 3: { name: 'Black-Ops', col: '#ffb020' } };
const W = (id, name, cls, o) => { WEAPONS[id] = Object.assign({ id, name, cls, dmg: 20, rpm: 400, mag: 12, ammo: 'light', spread: .02, ads: .006, recoil: 1, range: 120, pellets: 1, auto: false, reload: 1.4, snd: 'pistol', hold: 'pistol', price: 0, zoom: 1.25, vol: 45, desc: '' }, o); };
W('mk7', 'Fortis MK7', 'rifle', { tier: 3, dmg: 36, rpm: 700, mag: 30, auto: true, ammo: 'medium', snd: 'rifle', hold: 'rifle', spread: .02, ads: .0035, range: 240, zoom: 1.6, reload: 1.7, recoil: .9, loot: true, desc: 'Military battle rifle. Left a hangar without asking.' });
W('ghost', 'Ghost-9', 'smg', { tier: 3, dmg: 22, rpm: 950, mag: 40, auto: true, snd: 'silenced', hold: 'rifle', spread: .028, ads: .01, range: 95, reload: 1.5, vol: 6, quietGun: true, loot: true, desc: 'Integrally suppressed. Whispers. Expensive whispers.' });
W('thunder', 'Thunderclap .50', 'sniper', { tier: 3, dmg: 430, rpm: 34, mag: 5, ammo: 'sniper', snd: 'sniper', hold: 'rifle', spread: .06, ads: 0, range: 700, zoom: 6, scope: true, reload: 3, recoil: 4.5, pierce: 5, knock: 10, loot: true, desc: 'Anti-materiel rifle. Stops cars. Stops arguments. Stops time, briefly.' });
W('hydra', 'Hydra MRL', 'launcher', { tier: 3, dmg: 170, rpm: 45, mag: 3, pellets: 3, ammo: 'rockets', snd: 'rocket', hold: 'heavy', proj: 'rocket', spread: .05, ads: .03, reload: 3.2, recoil: 4, radius: 6, loot: true, desc: 'Three rockets at once. For when one problem is three problems.' });
W('reaper', 'Reaper LMG', 'lmg', { tier: 3, dmg: 33, rpm: 820, mag: 150, auto: true, ammo: 'medium', snd: 'lmg', hold: 'heavy', spread: .04, ads: .016, range: 190, reload: 4.2, recoil: 1.1, slow: .8, loot: true, desc: 'Belt-fed. The belt is also fed. Everything is fed.' });
W('raygun', 'Zorp-9', 'special', { tier: 3, dmg: 75, rpm: 300, mag: 12, ammo: 'none', snd: 'laser', hold: 'pistol', beam: 0x60ff90, chain: 2, stun: 1, range: 160, spread: .004, ads: 0, reload: 1.2, recoil: .3, loot: true, desc: 'Found in a crashed saucer. Warranty void on Earth.' });
const T2 = ['hungjury', 'needle', 'chatter', 'kessler', 'triplet', 'vulture', 'evict', 'longcall', 'bouncer', 'static', 'machete', 'baton', 'golf'], T3 = ['overruled', 'audit', 'refund', 'sunburn', 'toastgun', 'katana'];
for (const id in WEAPONS) { const w = WEAPONS[id]; if (!w.tier) w.tier = w.owner ? 0 : T3.includes(id) ? 3 : T2.includes(id) ? 2 : 1; }
export const shopTier = () => { const m = G.S ? G.S.mission || 0 : 0; return m >= 16 ? 3 : m >= 7 ? 2 : 1; };
// ---- attachments ----
export const ATT = {
  sight: { reddot: { name: 'Red dot', tier: 1, price: 700, acc: .86, zoom: 1.08 }, holo: { name: 'Holographic', tier: 2, price: 1900, acc: .76, zoom: 1.22 }, acog: { name: '4x scope', tier: 2, price: 2800, acc: .64, zoom: 1.9 }, thermal: { name: 'Thermal optic', tier: 3, price: 7500, acc: .6, zoom: 2.2, tags: true } },
  grip: { angled: { name: 'Angled grip', tier: 1, price: 600, rec: .84, acc: .96 }, vertical: { name: 'Vertical grip', tier: 2, price: 1400, rec: .72 }, stabilizer: { name: 'Gyro stabilizer', tier: 3, price: 5200, rec: .52, acc: .9 } },
  mag: { ext: { name: 'Extended mag', tier: 1, price: 800, mag: 1.4 }, quick: { name: 'Quick-pull mag', tier: 2, price: 1600, mag: 1.15, reload: .62 }, drum: { name: 'Drum mag', tier: 3, price: 4800, mag: 2.2, reload: 1.2 } },
  stock: { light: { name: 'Skeleton stock', tier: 1, price: 500, move: 1.15, rec: .95 }, heavy: { name: 'Heavy stock', tier: 2, price: 1300, acc: .86, rec: .88 }, tactical: { name: 'Tactical stock', tier: 3, price: 4400, acc: .8, rec: .82, move: 1.08 } },
};
export const SLOT_NAMES = { sight: 'Sight', grip: 'Grip', mag: 'Magazine', stock: 'Stock' };
const SLOTS_FOR = { pistol: ['sight', 'grip', 'mag'], smg: ['sight', 'grip', 'mag', 'stock'], rifle: ['sight', 'grip', 'mag', 'stock'], shotgun: ['sight', 'grip', 'mag', 'stock'], sniper: ['sight', 'grip', 'mag', 'stock'], lmg: ['sight', 'grip', 'mag', 'stock'], special: ['sight', 'grip', 'mag', 'stock'], launcher: ['sight'], signature: ['sight', 'grip', 'mag'] };
export const slotsFor = id => { const w = WEAPONS[id]; if (!w || w.melee) return []; let s = SLOTS_FOR[w.cls] || []; if (w.ammo === 'none' && w.cls !== 'signature') s = s.filter(k => k !== 'mag'); if (id === 'coinop') s = ['sight', 'grip']; if (w.flame) s = s.filter(k => k !== 'sight'); return s; };
export const FINISH = { factory: { name: 'Factory', price: 0 }, gunmetal: { name: 'Gunmetal', price: 600, col: '#8a96a8', m: .7, r: .35 }, desert: { name: 'Desert tan', price: 900, col: '#d8c090', m: .2, r: .6 }, crimson: { name: 'Crimson', price: 1500, col: '#ff5a50', m: .5, r: .35 }, arctic: { name: 'Arctic white', price: 1500, col: '#ffffff', m: .2, r: .45, lift: .5 }, carbon: { name: 'Carbon', price: 3500, col: '#606468', m: .4, r: .25 }, chrome: { name: 'Chrome', price: 9000, col: '#ffffff', m: 1, r: .06, lift: .6 }, gold: { name: 'Solid gold', price: 25000, col: '#ffd070', m: 1, r: .18, lift: .55 } };
const fmats = {}; export function finishMat(f) { if (!f || f === 'factory' || !FINISH[f]) return getDetailMat(); if (fmats[f]) return fmats[f]; const b = getDetailMat(), F = FINISH[f], m = b.clone(); m.onBeforeCompile = (sh, r) => { b.onBeforeCompile(sh, r); sh.fragmentShader = sh.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\n#ifdef USE_COLOR\ndiffuseColor.rgb = diffuse * mix(vColor, vec3(.85), .78);\n#endif'); }; m.customProgramCacheKey = () => 'wf'; m.color.set(F.col); m.metalness = F.m; m.roughness = F.r; if (F.lift) { m.emissive = new THREE.Color(F.col).multiplyScalar(.04); } m._shared = true; return fmats[f] = m; }
// stats with attachments
const att = g => { const own = g.owner; if (own && G.isH(own) && G.S && G.S.weapons[g.id]) return G.S.weapons[g.id].att || {}; return {}; };
const mul = (g, k) => { const a = att(g); let v = 1; for (const s in a) { const q = ATT[s] && ATT[s][a[s]]; if (q && q[k]) v *= q[k]; } return v; };
Gun.prototype.accMul = function () { return mul(this, 'acc'); }; Gun.prototype.recMul = function () { return mul(this, 'rec'); }; Gun.prototype.reloadMul = function () { return mul(this, 'reload'); };
Gun.prototype.zoomV = function () { const z = (this.def.zoom || 1.25) * mul(this, 'zoom'); return z; }; Gun.prototype.moveMul = function () { return mul(this, 'move'); };
Gun.prototype.magSize = function () { const m = this.def.mag || 1; return Math.ceil(m * (this.mods && this.mods.extmag ? 1.5 : 1) * mul(this, 'mag')); };
export const tagsOptic = g => !!(g && ATT.sight[att(g).sight] && ATT.sight[att(g).sight].tags);
// ---- models: where each part goes on each kind of gun ----
const MOUNT = {
  pistol: { sight: [0, .062, .08], grip: [0, -.01, .17], mag: [0, -.11, .0], muzzle: .23 }, smg: { sight: [0, .066, .06], grip: [0, -.03, .2], mag: [0, -.19, .12], stock: [0, .02, -.25], muzzle: .38 },
  rifle: { sight: [0, .11, .1], grip: [0, -.03, .32], mag: [0, -.2, .16], stock: [0, .01, -.33], muzzle: .65 }, shotgun: { sight: [0, .08, .05], grip: [0, -.03, .38], mag: [0, -.07, .12], stock: [0, -.02, -.33], muzzle: .66 },
  sniper: { sight: [0, .155, .1], grip: [0, -.03, .45], mag: [0, -.06, .12], stock: [0, -.01, -.4], muzzle: 1.15 }, lmg: { sight: [0, .1, .05], grip: [0, -.05, .42], mag: [.02, -.21, .12], stock: [0, 0, -.38], muzzle: .8 },
  special: { sight: [0, .09, .05], grip: [0, -.04, .32], mag: [0, -.14, .06], stock: [0, .02, -.25], muzzle: .6 }, launcher: { sight: [.09, .1, .1], muzzle: .7 }, signature: { sight: [0, .1, .1], grip: [0, -.05, .2], mag: [0, -.12, 0], muzzle: .3 },
};
export const mountOf = id => { const w = WEAPONS[id]; const m = MOUNT[w.cls] || MOUNT.rifle; if (id === 'sudo') return MOUNT.pistol; if (id === 'muffler') return Object.assign({}, MOUNT.shotgun, { sight: [0, .1, .1] }); return m; };
const pcache = {};
export function partGeo(slot, kind) {
  const k = slot + kind; if (pcache[k]) return pcache[k]; const b = new GeoB({ glow: 1 }); const dk = () => b.color('#17181b').set('glow', 0), md = () => b.color('#3c4046').set('glow', 0), gl = (c, v = 2.6) => b.color(c).set('glow', v); const cyl = (x, y, z, r, l, r2 = r) => b.add(new THREE.CylinderGeometry(r, r2, l, 10), M4(x, y, z, Math.PI / 2, 0, 0));
  if (slot === 'sight') { md().cbox(0, -.012, 0, .03, .012, .06); if (kind === 'reddot') { dk().cbox(0, .012, 0, .028, .034, .05); gl('#ff2a2a', 3).cbox(0, .016, .026, .016, .016, .002); } else if (kind === 'holo') { dk().cbox(0, .02, -.02, .044, .03, .03).cbox(-.02, .03, .015, .005, .05, .045).cbox(.02, .03, .015, .005, .05, .045).cbox(0, .055, .015, .045, .006, .045); gl('#30e0ff', 2.2).cbox(0, .03, .015, .03, .03, .002); } else if (kind === 'acog') { dk(); cyl(0, .03, 0, .022, .16, .026); cyl(0, .03, .09, .03, .03); gl('#ff6a20', 1.4); cyl(0, .03, .106, .024, .002); } else { dk().cbox(0, .03, 0, .05, .05, .13); gl('#ff7a20', 2.4).cbox(0, .03, -.066, .036, .03, .002); md(); cyl(0, .03, .075, .026, .03); } }
  else if (slot === 'grip') { if (kind === 'angled') { dk(); b.add(new THREE.BoxGeometry(.026, .055, .07), M4(0, -.025, 0, -.6, 0, 0)); } else if (kind === 'vertical') { md().cbox(0, -.005, 0, .03, .012, .04); dk(); b.add(new THREE.CylinderGeometry(.015, .013, .1, 8), M4(0, -.06, 0)); } else { md().cbox(0, -.01, 0, .04, .02, .05); dk(); for (const s of [-1, 1]) b.add(new THREE.CylinderGeometry(.007, .007, .15, 6), M4(s * .02, -.02, .07, Math.PI / 2 - .25, 0, s * .2)); gl('#40ffb0', 2).cbox(0, -.024, -.01, .02, .006, .02); } }
  else if (slot === 'mag') { if (kind === 'ext') { md().cbox(0, -.07, 0, .032, .15, .055); dk().cbox(0, -.15, 0, .036, .015, .06); } else if (kind === 'quick') { md().cbox(-.02, -.06, 0, .03, .13, .05).cbox(.02, -.06, .01, .03, .13, .05); gl('#ff5a2a', 1.6).cbox(0, -.13, 0, .06, .012, .02); } else { dk(); b.add(new THREE.CylinderGeometry(.07, .07, .06, 18), M4(0, -.09, 0, 0, 0, Math.PI / 2)); md(); b.add(new THREE.CylinderGeometry(.03, .03, .066, 10), M4(0, -.09, 0, 0, 0, Math.PI / 2)); } }
  else if (slot === 'stock') { if (kind === 'light') { dk(); for (const y of [.03, -.04]) b.cbox(0, y, -.1, .014, .014, .2); b.cbox(0, -.005, -.2, .02, .09, .014); b.add(new THREE.BoxGeometry(.012, .085, .012), M4(0, -.005, -.1, .7, 0, 0)); } else if (kind === 'heavy') { md().cbox(0, -.01, -.11, .042, .085, .22); dk().cbox(0, -.01, -.225, .046, .095, .02); } else { dk().cbox(0, .015, -.08, .03, .03, .16); md().cbox(0, -.015, -.17, .04, .09, .12); dk().cbox(0, .04, -.16, .03, .025, .1).cbox(0, -.015, -.235, .046, .1, .018); gl('#ffb020', 1.2).cbox(.021, -.015, -.17, .002, .05, .06); } }
  else if (slot === 'muzzle') { dk(); cyl(0, 0, .09, .028, .18); md(); cyl(0, 0, .18, .03, .01); }
  return pcache[k] = b.build();
}
// gun + attachments + finish as one object (hand, workbench, pickups)
export function weaponModel(id, a = {}, finish, mods = {}) {
  const base = weaponMesh(id); if (!base) return null; const grp = new THREE.Group(); base.material = finishMat(finish); grp.add(base); const M = mountOf(id), mat = finishMat(finish); grp.userData.parts = {};
  for (const s of slotsFor(id)) if (a[s] && ATT[s][a[s]] && M[s]) { const p = new THREE.Mesh(partGeo(s, a[s]), mat); p.position.set(...M[s]); p.castShadow = true; grp.add(p); grp.userData.parts[s] = p; }
  if (mods.suppressor && M.muzzle) { const p = new THREE.Mesh(partGeo('muzzle', 'sup'), mat); const y = WEAPONS[id].cls === 'pistol' ? .03 : .03; p.position.set(0, y, M.muzzle); grp.add(p); grp.userData.parts.muzzle = p; }
  return grp;
}
// the gun in a player's hands shows their attachments and finish
const setGun0 = Actor.prototype.setGun; Actor.prototype.setGun = function (id, mods, lvl) { setGun0.call(this, id, mods, lvl); if (!id || id === 'fists' || !G.S || !G.S.weapons || !G.isH(this)) return; const o = G.S.weapons[id]; if (!o) return; if ((o.att && Object.keys(o.att).length) || (o.finish && o.finish !== 'factory') || (o.mods && o.mods.suppressor)) { const m = weaponModel(id, o.att || {}, o.finish, o.mods || {}); if (m) this.model.attach(m); } };
export function refreshHeld() { for (const h of G.humans()) if (h.gun && h.gun.id !== 'fists') { const g = h.gun, id = g.id, mag = g.mag; G.as(h, () => { h.setGun(id, G.S.weapons[id] ? G.S.weapons[id].mods : g.mods, g.lvl); h.gun.mag = Math.min(mag, h.gun.magSize()); }); } }
// ---- loot that matches the story's progress ----
export function lootTier() { const m = G.S ? G.S.mission || 0 : 0, r = Math.random(); if (m >= 18 && r < .22) return 3; if (m >= 24 && r < .4) return 3; if (m >= 7 && r < .55) return 2; if (m >= 14 && r < .8) return 2; return 1; }
export function lootGun(tier) { const L = Object.values(WEAPONS).filter(w => w.tier === tier && !w.melee && !w.owner && w.id !== 'raygun'); return pick(L).id; }
export function initLoot() {
  G.bus.on('tick', () => { if (G.state !== 'play' || G.net && G.net.client) return; for (const h of G.humans()) { if (!h.aiming || !tagsOptic(h.gun)) continue; const s = Math.sin(h.faceYaw), c = Math.cos(h.faceYaw); for (const a of G.actors) { if (!a.alive || !h.hostileTo(a)) continue; const dx = a.pos.x - h.pos.x, dz = a.pos.z - h.pos.z, d = Math.hypot(dx, dz); if (d < 140 && (dx * s + dz * c) / Math.max(d, .1) > .9) G.hack.tags.set(a, G.time + 1.5); } } });
  G.bus.on('death', (a, info) => { if (!a || a.isCrew || G.isH(a) || !a.gun || a.gun.def.melee || a.faction === 'ped' || a.faction === 'cop' && !chance(.3)) return; if (!info || !info.from || !G.isH(info.from)) return; if (!chance(a.boss ? 1 : a.kind === 'soldier' ? .45 : .22)) return; const t = a.kind === 'soldier' ? Math.max(2, lootTier()) : a.boss ? 3 : lootTier(); G.pick.drop(a.pos, 'weapon', lootGun(t)); if (chance(.25)) dropAtt(a.pos, t); });
  G.bus.on('loot', (where, pos) => { const S = G.S; const n = where === 'armory' ? 2 : 1; for (let k = 0; k < n; k++) G.pick.drop(pos, 'weapon', where === 'bunker' && k === 0 ? 'thunder' : lootGun(3)); dropAtt(pos, 3); for (const a of ['medium', 'sniper', 'rockets']) S.ammo[a] = Math.min(AMMO[a].max, (S.ammo[a] || 0) + AMMO[a].n * 2); G.hud.toast(where === 'armory' ? 'Military-grade loot. Fort Fortis will want that back.' : 'Crate 3 was humming because of what was inside it.'); G.audio.play('unlock'); });
}
export function dropAtt(pos, tier) { const S = G.S; S.atts = S.atts || {}; const L = []; for (const s in ATT) for (const k in ATT[s]) if (ATT[s][k].tier <= tier && !S.atts[k]) L.push(k); if (!L.length) return; const k = pick(L); S.atts[k] = 1; const nm = Object.values(ATT).map(o => o[k]).find(Boolean).name; G.hud.toast('Found attachment: ' + nm + '. Fit it at a workbench.'); }
