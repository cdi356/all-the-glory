// Gunsmith: slot-based weapon parts and finishes. A gun's mods map holds part ids (one per slot); tune() bakes them
// into a per-gun copy of the weapon definition so the rest of combat reads plain stats.
import * as THREE from 'three';
import { G } from '../core/g.js';
import { money } from '../core/util.js';
import { WEAPONS } from './weapondata.js';
const ALL = ['pistol', 'smg', 'rifle', 'shotgun', 'sniper', 'lmg'];
const P = (slot, name, price, forC, desc, fx) => ({ slot, name, price, for: forC, desc, fx });
// The six original attachments keep their ids (old saves, and code that checks mods.suppressor etc.)
export const PARTS = {
  suppressor: P('Muzzle', 'Suppressor', 900, ['pistol', 'smg', 'rifle', 'sniper', 'signature'], 'Shots barely alert anyone.'),
  comp: P('Muzzle', 'Compensator', 700, ['pistol', 'smg', 'rifle', 'lmg'], '-25% recoil.', d => { d.recoil *= .75; }),
  brake: P('Muzzle', 'Muzzle brake', 1100, ['rifle', 'sniper', 'lmg', 'shotgun'], '-40% recoil, but louder.', d => { d.recoil *= .6; d.vol = (d.vol || 45) * 1.3; }),
  choke: P('Muzzle', 'Tight choke', 800, ['shotgun'], '-35% pellet spread, +25% range.', d => { d.spread *= .65; d.ads *= .65; d.range *= 1.25; }),
  longb: P('Barrel', 'Long barrel', 1200, ALL, '+30% range, +8% damage, -5% fire rate.', d => { d.range *= 1.3; d.dmg *= 1.08; d.rpm *= .95; }),
  shortb: P('Barrel', 'Short barrel', 900, ALL, '+12% fire rate, -20% range.', d => { d.rpm *= 1.12; d.range *= .8; d.spread *= 1.1; }),
  heavyb: P('Barrel', 'Heavy barrel', 1800, ALL, '+16% damage, +20% recoil.', d => { d.dmg *= 1.16; d.recoil *= 1.2; }),
  matchb: P('Barrel', 'Match barrel', 2200, ['pistol', 'rifle', 'sniper'], '-40% aimed spread.', d => { d.ads *= .6; d.spread *= .85; }),
  scope: P('Optic', 'Reflex sight', 600, ['pistol', 'smg', 'rifle', 'lmg'], '+35% zoom, tighter aim.'),
  holo: P('Optic', 'Holo sight', 750, ['pistol', 'smg', 'rifle', 'lmg', 'shotgun'], '-25% aimed spread.', d => { d.ads *= .75; }),
  acog: P('Optic', '4x scope', 1300, ['rifle', 'lmg', 'smg'], '+70% zoom.', d => { d.zoom = (d.zoom || 1.25) * 1.7; d.ads *= .8; }),
  hiscope: P('Optic', '12x scope', 2600, ['sniper'], 'Much more zoom, steadier.', d => { d.zoom = (d.zoom || 3) * 1.6; d.spread *= .8; }),
  extmag: P('Magazine', 'Extended mag', 750, ['pistol', 'smg', 'rifle', 'shotgun', 'lmg', 'sniper', 'signature', 'special'], '+50% magazine.', d => { d.mag = Math.ceil(d.mag * 1.5); }),
  drum: P('Magazine', 'Drum mag', 1600, ['smg', 'rifle', 'lmg', 'shotgun'], '+120% magazine, +35% reload time.', d => { d.mag = Math.ceil(d.mag * 2.2); d.reload *= 1.35; }),
  quick: P('Magazine', 'Quick-draw mag', 900, ['pistol', 'smg', 'rifle', 'shotgun', 'sniper', 'lmg', 'launcher'], '-35% reload time.', d => { d.reload *= .65; }),
  grip: P('Underbarrel', 'Angled grip', 500, ['smg', 'rifle', 'lmg', 'shotgun', 'sniper', 'signature'], '-40% recoil.'),
  laser: P('Underbarrel', 'Laser sight', 650, ['pistol', 'smg', 'rifle', 'shotgun'], '-30% hip-fire spread.', d => { d.spread *= .7; }),
  bipod: P('Underbarrel', 'Bipod', 800, ['lmg', 'sniper', 'rifle'], '-30% spread and recoil.', d => { d.spread *= .7; d.ads *= .7; d.recoil *= .7; }),
  lightstock: P('Stock', 'Skeleton stock', 700, ['smg', 'rifle', 'shotgun', 'lmg', 'sniper'], '-15% reload time, +10% recoil.', d => { d.reload *= .85; d.recoil *= 1.1; }),
  heavystock: P('Stock', 'Padded stock', 900, ['smg', 'rifle', 'shotgun', 'lmg', 'sniper'], '-25% recoil.', d => { d.recoil *= .75; }),
  incendiary: P('Ammo', 'Incendiary rounds', 2400, ['pistol', 'smg', 'rifle', 'lmg', 'sniper', 'shotgun'], 'Sets targets on fire.'),
  shock: P('Ammo', 'Shock rounds', 2400, ['pistol', 'smg', 'rifle', 'lmg', 'sniper'], 'Bonus damage and stun versus chrome.'),
  hollow: P('Ammo', 'Hollow points', 1800, ALL, '+18% damage, no piercing.', d => { d.dmg *= 1.18; d.pierce = 0; }),
  ap: P('Ammo', 'Armor piercing', 2600, ['pistol', 'smg', 'rifle', 'lmg', 'sniper'], 'Rounds pass through one more target; +50% versus cars.', d => { d.pierce = (d.pierce || 0) + 1; d.vehDmg = (d.vehDmg || 1) * 1.5; }),
  explosive: P('Ammo', 'Explosive tips', 6500, ['rifle', 'sniper', 'lmg', 'shotgun'], 'Small blast on every hit. Loud. Expensive. Worth it.', d => { d.boomHit = Math.max(d.boomHit || 0, d.pellets > 1 ? 1.1 : 1.8); d.dmg *= .9; }),
  dragon: P('Ammo', "Dragon's breath", 2900, ['shotgun'], 'Shells spit fire.', d => { d.burn = Math.max(d.burn || 0, 3); }),
};
// finishes (cosmetic): material tint, metalness, roughness, glow boost
export const SKINS = {
  skin_gold: { name: 'Solid gold', price: 25000, col: '#ffd24a', m: .95, r: .22 }, skin_chrome: { name: 'Mirror chrome', price: 9000, col: '#e8eef4', m: 1, r: .08 },
  skin_carbon: { name: 'Carbon fibre', price: 4000, col: '#4a4e56', m: .3, r: .5 }, skin_ruby: { name: 'Ruby anodized', price: 6000, col: '#ff4a6a', m: .7, r: .25 },
  skin_neon: { name: 'Neon Row', price: 7500, col: '#4affe0', m: .4, r: .3, glow: 1.6 }, skin_camo: { name: 'Woodland camo', price: 2500, col: '#7a8a5a', m: .1, r: .7 },
  skin_arctic: { name: 'Arctic', price: 2500, col: '#e0ecf4', m: .1, r: .6 }, skin_glory: { name: 'All the Glory', price: 15000, col: '#c080ff', m: .6, r: .2, glow: 1.3 },
  skin_rust: { name: 'Rust Harbor patina', price: 1500, col: '#b07a50', m: .5, r: .65 }, skin_bev: { name: "Bev's floral", price: 3200, col: '#ff9ac0', m: .2, r: .5 },
};
for (const k in SKINS) PARTS[k] = Object.assign({ slot: 'Finish', for: [...ALL, 'melee', 'launcher', 'special', 'signature'], desc: 'Cosmetic finish.' }, SKINS[k]);
export const SLOTS = ['Muzzle', 'Barrel', 'Optic', 'Magazine', 'Underbarrel', 'Stock', 'Ammo', 'Finish'];
const tcache = new Map();
export function tune(base, mods) {
  if (!base) return base; const ids = Object.keys(mods || {}).filter(k => mods[k] && PARTS[k] && PARTS[k].fx).sort(); if (!ids.length) return base;
  const key = base.id + '|' + ids.join(','); let d = tcache.get(key); if (d) return d; d = Object.assign({}, base); for (const k of ids) PARTS[k].fx(d); d.rpm = Math.round(d.rpm); tcache.set(key, d); return d;
}
export const fits = (id, k) => { const w = WEAPONS[id], p = PARTS[k]; return !!(w && p && p.for.includes(w.cls) && !(w.melee && p.slot !== 'Finish')); };
// apply a finish to a weapon mesh in place
const mcache = {};
export function skinMesh(mesh, mods) {
  if (!mesh || !mods) return mesh; const k = Object.keys(mods).find(q => mods[q] && SKINS[q]); if (!k) return mesh; let m = mcache[k];
  if (!m) { const s = SKINS[k]; m = mesh.material.clone(); m.color = new THREE.Color(s.col); m.metalness = s.m; m.roughness = s.r; if (s.glow) m.emissive = new THREE.Color(s.col).multiplyScalar(.08 * s.glow); m.onBeforeCompile = mesh.material.onBeforeCompile; m.customProgramCacheKey = () => 'skin' + k; mcache[k] = m; }
  mesh.material = m; return mesh;
}
// ---------------- UI ----------------
export function gunsmithMenu(title = 'Gunsmith') {
  const S = G.S, list = () => G.ctl.owned().filter(id => WEAPONS[id] && Object.keys(PARTS).some(k => fits(id, k)));
  G.menus.shop(title, 'Pick a weapon to customize. Parts swap in a slot; finishes are cosmetic.', () => list().map(id => { const w = WEAPONS[id], o = S.weapons[id], n = Object.keys(o.mods || {}).filter(k => PARTS[k]).length; return { group: w.legend ? 'One of a kind' : w.cls[0].toUpperCase() + w.cls.slice(1), name: w.name + (o.lvl > 1 ? ' +' + (o.lvl - 1) : ''), desc: n ? Object.keys(o.mods).filter(k => PARTS[k]).map(k => `<span class="pill">${PARTS[k].name}</span>`).join('') : 'Stock.', sub: statLine(id, o), label: 'Customize', fn: () => setTimeout(() => partsMenu(id, title), 0) }; }));
}
function statLine(id, o) { const d = tune(WEAPONS[id], o.mods || {}); if (d.melee) return `${Math.round(d.dmg)} dmg`; return `${Math.round(d.dmg)}${d.pellets > 1 ? 'x' + d.pellets : ''} dmg, ${d.rpm} rpm, ${d.mag} mag, ${Math.round(d.range)} m`; }
function partsMenu(id, title) {
  const S = G.S, o = S.weapons[id], w = WEAPONS[id]; o.mods = o.mods || {};
  const sync = () => { for (const h of G.humans()) if (h.gun && h.gun.id === id) { const mag = h.gun.mag; h.setGun(id, o.mods, o.lvl); h.gun.mag = Math.min(mag, h.gun.magSize()); } };
  G.menus.shop(title + ': ' + w.name, statLine(id, o), () => { const R = [{ group: 'Weapon', name: 'Back to weapons', desc: '', label: 'Back', alt: true, fn: () => setTimeout(() => gunsmithMenu(title), 0) }]; for (const slot of SLOTS) for (const k in PARTS) { const p = PARTS[k]; if (p.slot !== slot || !fits(id, k)) continue; const on = !!o.mods[k], had = S.parts && S.parts[k + '@' + id]; R.push({ group: slot, name: p.name, desc: p.desc, own: on, label: on ? 'Remove' : had ? 'Fit (owned)' : undefined, price: on || had ? undefined : p.price, fn: () => { S.parts = S.parts || {}; if (on) { delete o.mods[k]; } else { for (const q in o.mods) if (PARTS[q] && PARTS[q].slot === slot) delete o.mods[q]; o.mods[k] = 1; S.parts[k + '@' + id] = 1; G.audio.play('servo'); } o.mods = Object.assign({}, o.mods); sync(); } }); } return R; });
}
export { money };
