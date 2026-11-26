// Body armor you can see, and a wardrobe for the three idiots (styles, colours, hair, glasses, beards) with a live preview.
import * as THREE from 'three';
import { G } from '../core/g.js';
import { GeoB, M4, el, esc, money } from '../core/util.js';
import { getDetailMat } from '../ent/vehmodels.js';
import { Human, LOOKS } from '../ent/human.js';
import { Showroom } from '../ui/showroom.js';
import { OUTFITS } from './flow.js';
import { shopTier } from './arsenal.js';

export const ARMOR = {
  vest: { name: 'Light vest', ap: 50, price: 600, tier: 1, speed: 1, desc: 'Stops a pistol round. Mostly.' },
  kevlar: { name: 'Kevlar vest', ap: 100, price: 1800, tier: 1, speed: 1, desc: 'The classic. Breathable-ish.' },
  plate: { name: 'Plate carrier', ap: 160, price: 5200, tier: 2, speed: .95, desc: 'Ceramic plates. You walk a bit like a fridge.' },
  jugg: { name: 'Juggernaut suit', ap: 260, price: 24000, tier: 3, speed: .84, desc: 'Military bomb suit with ambitions. Slow. Unkillable-ish.' },
};
const acache = {};
function vestGeo(t) {
  if (acache[t]) return acache[t]; const b = new GeoB({ glow: 1 }); const C = c => b.color(c).set('glow', 0);
  if (t === 'vest') { C('#2a2e34').cbox(0, .02, .03, .38, .34, .05).cbox(0, .02, -.14, .38, .34, .05); C('#3a3e44').cbox(-.19, .1, -.05, .04, .14, .2).cbox(.19, .1, -.05, .04, .14, .2); }
  else if (t === 'kevlar') { C('#1c2228').cbox(0, .02, .04, .42, .4, .07).cbox(0, .02, -.15, .42, .4, .07); C('#2c343c').cbox(-.21, .02, -.05, .05, .36, .22).cbox(.21, .02, -.05, .05, .36, .22); C('#e8e8e8').set('glow', .2).cbox(0, .1, .08, .2, .05, .005); }
  else if (t === 'plate') { C('#3a4030').cbox(0, .02, .05, .44, .42, .09).cbox(0, .02, -.16, .44, .42, .09); C('#4a5238'); for (let k = -1; k <= 1; k++) b.cbox(k * .13, -.12, .1, .1, .12, .05); C('#2a2e24').cbox(-.22, .04, -.05, .05, .38, .24).cbox(.22, .04, -.05, .05, .38, .24); C('#ff5a2a').set('glow', 1.6).cbox(.14, .14, .1, .05, .02, .01); }
  else { C('#2c3226').cbox(0, 0, -.05, .56, .58, .44); C('#3a4232').cbox(0, .28, -.05, .62, .12, .5).cbox(-.33, .2, -.05, .14, .2, .36).cbox(.33, .2, -.05, .14, .2, .36); C('#1a1e18'); for (let k = 0; k < 4; k++) b.cbox(0, -.22 + k * .13, .18, .48, .02, .02); C('#ffb020').set('glow', 2).cbox(0, .1, .18, .3, .03, .01); }
  return acache[t] = b.build();
}
// put the vest on a character model (called whenever the model is rebuilt)
export function dressArmor(c) {
  if (!c || !c.model || !c.model.bones) return; const ch = c.model.bones[2]; if (c._vest && c._vest.parent) c._vest.parent.remove(c._vest); c._vest = null; const S = G.S; const t = S && S.chars && S.chars[c.charId] && S.chars[c.charId].armorType; if (!t || !(c.armor > 0) || !ARMOR[t]) return; const m = new THREE.Mesh(vestGeo(t), getDetailMat()); m.castShadow = true; const s = (c.look && c.look.w) || 1; m.scale.set(s, 1, s); m.position.set(0, .05, .02); ch.add(m); c._vest = m;
}
export function buyArmor(t) {
  const p = G.player, S = G.S, A = ARMOR[t]; S.chars[p.charId].armorType = t; p.armor = A.ap; p.armorMax = A.ap; dressArmor(p); G.audio.play('reload'); G.hud.toast(`${A.name} on. ${A.ap} armor.`);
}
export function styled(id, i) { const S = G.S, C = S.chars[id] || {}, st = C.style || {}, base = Object.assign({}, LOOKS[id], OUTFITS[id] ? OUTFITS[id][i || 0][1] : {}); const l = Object.assign({}, base, st); if (st.hair) l.hair = Object.assign({}, base.hair, st.hair); if (st.glasses) l.glasses = st.glasses.type === 'none' ? null : Object.assign({}, base.glasses || {}, st.glasses); if (st.beard) l.beard = st.beard.type === 'none' ? null : Object.assign({ col: (l.hair && l.hair.col) || '#2a1c14' }, base.beard || {}, st.beard); return l; }
export function armorRows() { const S = G.S, p = G.player, C = S.chars[p.charId], R = []; for (const k in ARMOR) { const A = ARMOR[k]; if (A.tier > shopTier() || (k === 'jugg' && !S.flags.jugg)) continue; R.push({ group: 'Body armor', name: A.name, desc: A.desc, sub: A.ap + ' armor' + (A.speed < 1 ? ', ' + Math.round((1 - A.speed) * 100) + '% slower' : '') + (C.armorType === k ? ' (wearing)' : ''), price: A.price, fn: () => buyArmor(k) }); } const t = C.armorType && ARMOR[C.armorType]; if (t) R.push({ group: 'Body armor', name: 'Armor plates (refill)', desc: 'Back to full ' + t.name.toLowerCase() + '.', price: Math.round(t.ap * 3), dis: p.armor >= t.ap, fn: () => { p.armor = t.ap; dressArmor(p); } }); return R; }
export function initGear() {
  G.bus.on('loot', w => { if (w === 'armory' && !G.S.flags.jugg) { G.S.flags.jugg = 1; G.hud.toast('Juggernaut suit specs stolen. Aunt Bev can build you one now.'); } });
  // keep vests in sync with armor (it gets shot off) and slow the heavy suits down
  G.bus.on('tick', () => { if (G.state !== 'play' || !G.S) return; for (const id in G.crew) { const c = G.crew[id]; const t = G.S.chars[id] && G.S.chars[id].armorType; const show = !!(t && c.armor > 0); if (show !== !!(c._vest && c._vest.parent) || (show && c._vestT !== t) || (c._vest && c._vest.parent && c._vest.parent !== c.model.bones[2])) { c._vestT = t; dressArmor(c); } if (G.isH(c) && t) c.armorSlow = ARMOR[t].speed; else c.armorSlow = 1; } });
}

// ---------------- wardrobe ----------------
const TOPS = { hoodie: 'Hoodie', jacket: 'Jacket', suit: 'Suit', tee: 'T-shirt', hawaii: 'Hawaiian shirt', coat: 'Long coat', vest: 'Vest', tank: 'Tank top', crop: 'Crop top', armor: 'Tactical' };
const HAIRS = { messy: 'Messy', short: 'Short', slick: 'Slicked', afro: 'Afro', mohawk: 'Mohawk', long: 'Long', pony: 'Ponytail', bun: 'Bun', bob: 'Bob', half: 'Half-shaved', beanie: 'Beanie', cap: 'Cap', bucket: 'Bucket hat', hood: 'Hood up', visor: 'Visor' };
const GLASSES = { none: 'None', specs: 'Specs', shades: 'Shades', goggles: 'Goggles' }, BEARDS = { none: 'None', stubble: 'Stubble', stache: 'Moustache', goatee: 'Goatee', full: 'Full beard' };
const COLS = ['#101014', '#f0f0f0', '#7a8088', '#2a2f3a', '#12646a', '#3affe0', '#1a4ad0', '#6a20c0', '#ff3a9a', '#d01a14', '#ff6a10', '#f0b010', '#3a6a2a', '#8a5a3a', '#c8b080', '#5a1a2a'];
const HAIRCOL = ['#1a1210', '#2a1a12', '#5a3a22', '#8a5a2a', '#d8b060', '#e8e0d0', '#8a2a2a', '#ff3a9a', '#3a8aff', '#3affe0', '#a0ff40', '#7a7a7a'];
export function openWardrobe(free) {
  const M = G.menus; if (M.cur) M.close(); M.openUI(); const S = G.S, p = G.player, id = p.charId, C = S.chars[id]; C.style = C.style || {}; let st = { ...C.style }, cat = 'top';
  const look = () => { const base = Object.assign({}, LOOKS[id], OUTFITS[id] ? OUTFITS[id][C.outfit || 0][1] : {}); const l = Object.assign({}, base, st); if (st.hair) l.hair = Object.assign({}, base.hair, st.hair); if (st.glasses) l.glasses = st.glasses.type === 'none' ? null : Object.assign({}, base.glasses || {}, st.glasses); if (st.beard) l.beard = st.beard.type === 'none' ? null : Object.assign({ col: (l.hair && l.hair.col) || '#2a1c14' }, base.beard || {}, st.beard); return l; };
  const w = el('div', 'scr garage wardrobe', document.getElementById('ui'), `<div class="gview"></div><div class="ghead"><div><span class="rar" style="--r:#ff8ae0">Fabric Crimes</span><h1>${esc(p.name)}'s wardrobe</h1><p>Changes are free. Looking this good is not.</p></div></div><div class="gside"><div class="gslots"></div><div class="gopts"></div><div class="gfoot"><button class="btn alt" data-p>Outfit presets</button><button class="btn alt" data-r>Reset</button><button class="btn" data-x>Done</button></div></div><div class="ghint">Drag to turn &middot; scroll to zoom &middot; hover to preview</div>`);
  M.cur = { el: w, kind: 'bench', done: () => { sr.dispose(); } };
  const sr = new Showroom(w.querySelector('.gview'), 'car'); sr.focus({ dist: 3.4, pitch: .12, yaw: 0, target: new THREE.Vector3(0, 1.0, 0) }); sr.auto = false; let h = null;
  const build = l => { if (h) { sr.scene.remove(h.group); h.dispose && h.dispose(); } h = new Human(l); h.group.position.set(0, .09, 0); h.group.traverse(q => { q.castShadow = true; }); sr.scene.add(h.group); };
  sr.onFrame = dt => { if (h) { h.update(dt, { speed: 0 }); h.group.rotation.y = 0; } };
  const CATS = { top: ['Top style', TOPS], topc: ['Top colour', 'col'], top2: ['Accent colour', 'col'], pants: ['Pants colour', 'col'], shorts: ['Shorts', { no: 'Long pants', yes: 'Shorts' }], shoes: ['Shoes colour', 'col'], hair: ['Hair / hat', HAIRS], hairc: ['Hair colour', 'hcol'], glasses: ['Glasses', GLASSES], beard: ['Facial hair', BEARDS] };
  const cur = () => { const l = look(); return { top: l.topType, topc: l.top, top2: l.top2, pants: l.pants, shorts: l.shorts ? 'yes' : 'no', shoes: l.shoes, hair: l.hair && l.hair.type, hairc: l.hair && l.hair.col, glasses: (l.glasses && l.glasses.type) || 'none', beard: (l.beard && l.beard.type) || 'none' }; };
  const set = (o, k, v) => { if (k === 'top') o.topType = v; else if (k === 'topc') o.top = v; else if (k === 'top2') o.top2 = v; else if (k === 'pants') o.pants = v; else if (k === 'shorts') o.shorts = v === 'yes'; else if (k === 'shoes') o.shoes = v; else if (k === 'hair') o.hair = Object.assign({}, o.hair || {}, { type: v }); else if (k === 'hairc') o.hair = Object.assign({}, o.hair || {}, { col: v }); else if (k === 'glasses') o.glasses = { type: v, col: v === 'goggles' ? '#40e0ff' : '#101014' }; else if (k === 'beard') o.beard = { type: v }; return o; };
  const slots = () => { const c = cur(); w.querySelector('.gslots').innerHTML = Object.entries(CATS).map(([k, [n, o]]) => `<button class="${k === cat ? 'on' : ''}" data-s="${k}"><b>${n}</b><span>${typeof o === 'string' ? `<i class="sw" style="background:${c[k]}"></i>` : esc((o[c[k]] || c[k] || '-'))}</span></button>`).join(''); w.querySelectorAll('[data-s]').forEach(b => b.onclick = () => { cat = b.dataset.s; slots(); opts(); G.audio.play('ui'); sr.focus({ dist: ['hair', 'hairc', 'glasses', 'beard'].includes(cat) ? 1.6 : ['shoes', 'pants', 'shorts'].includes(cat) ? 2.4 : 3.4, target: new THREE.Vector3(0, ['hair', 'hairc', 'glasses', 'beard'].includes(cat) ? 1.62 : ['shoes', 'pants', 'shorts'].includes(cat) ? .6 : 1.0, 0) }); }); };
  const opts = () => { const [n, o] = CATS[cat], c = cur(), box = w.querySelector('.gopts'); if (typeof o === 'string') { const L = o === 'hcol' ? HAIRCOL : COLS; box.innerHTML = `<h3>${n}</h3><div class="gcols">${L.map(x => `<button data-v="${x}" style="background:${x}" class="${c[cat] === x ? 'on' : ''}"></button>`).join('')}</div>`; } else box.innerHTML = `<h3>${n}</h3>` + Object.entries(o).map(([k, v]) => `<button class="gopt ${c[cat] === k ? 'on' : ''}" data-v="${k}"><b>${esc(v)}</b><span>${c[cat] === k ? 'Wearing' : 'Free'}</span></button>`).join('');
    box.querySelectorAll('[data-v]').forEach(b => { b.onmouseenter = () => { const s0 = st; st = set(JSON.parse(JSON.stringify(st)), cat, b.dataset.v); const l = look(); st = s0; build(l); }; b.onmouseleave = () => build(look()); b.onclick = () => { st = set(JSON.parse(JSON.stringify(st)), cat, b.dataset.v); C.style = st; build(look()); G.flow.setOutfit(p); G.audio.play('ui'); slots(); opts(); }; }); };
  w.querySelector('[data-p]').onclick = () => { M.close(); G.flow.tailorOld(free); }; w.querySelector('[data-x]').onclick = () => M.close(); w.querySelector('[data-r]').onclick = () => { st = {}; C.style = {}; build(look()); G.flow.setOutfit(p); slots(); opts(); };
  build(look()); slots(); opts();
}
