// Behaviour for the new places: skyscraper elevators, the Velvet Ledger, Fort Fortis (restricted zone, armory),
// the motel, the desert bunker, the ranger station, outer-world traffic and parked rides, plus the easter eggs out there.
import * as THREE from 'three';
import { G } from '../core/g.js';
import { V3, rand, randi, pick, chance, clamp, dist2, TAU } from '../core/util.js';
import { LOOKS, randomLook } from '../ent/human.js';
import { spawnEnemy, NPC } from '../ent/actor.js';
import { Vehicle, Driver } from '../ent/vehicle.js';
import { INT } from '../world/interiors.js';
import { LIFTS } from '../world/interiors2.js';
import { POI, POIS } from '../world/citydata.js';
import { BASE, SPOTS, ROADS, HW, height, outside } from '../world/outer.js';

export class Places {
  constructor() {
    this.alertT = 0; this.warned = 0; this.soldiers = []; this.traffic = []; this.tt = 0; this.parkedDone = false;
    G.bus.on('enterInterior', id => this.enter(id));
    // rooftop elevators (outside, on each skyscraper roof)
    for (const p of POIS) if (p.type === 'sky' && p.roof) G.interactables.push({ pos: p.roof, r: 2.6, label: 'Elevator down', cond: () => !G.interior && !G.player.vehicle && Math.abs(G.player.pos.y - p.roof.y) < 3, fn: () => this.ride(LIFTS[p.id === 'spire' ? 'spire' : 'gold'].slice(-1)[0], p) });
    // easter eggs in the world
    const eggs = [
      [SPOTS.ufo, 'Inspect the saucer', () => this.egg('ufo', 'Inside: a single probe, a coupon for 10% off Earth, and a note: "BACK IN 5 MIN".', 'raygun')],
      [SPOTS.duck, 'Bow before the Golden Duck', () => this.egg('gduck', 'The Golden Duck accepts your offering. Somewhere, every duck in Saint Vesper quacks at once.', 'duckpower')],
      [V3(SPOTS.drivein[0], 0, SPOTS.drivein[1] - 30), 'Watch the movie', () => this.egg('movie', 'Larry Goldman, A Human Man 2. Larry eats a sandwich by unhinging his jaw. Critics call it "very normal".', null)],
      [V3(SPOTS.lookout[0], 0, SPOTS.lookout[1]), 'Read the carved initials', () => this.egg('carve', '"J + J + D WUZ HERE". Nobody remembers carving it. The wood is forty years old.', null)],
    ];
    for (const [s, label, fn] of eggs) { const x = s.x ?? s[0], z = s.z ?? s[1]; G.interactables.push({ pos: V3(x, height(x, z), z), r: 9, label, cond: () => !G.interior && !G.player.vehicle, fn }); }
    G.interactables.push({ pos: G.city.statue || V3(0, 0, 0), r: 4, label: 'Read the plaque', cond: () => !G.interior && !G.player.vehicle, fn: () => { G.S.flags.plaque = (G.S.flags.plaque || 0) + 1; if (G.S.flags.plaque === 3) this.egg('plaque', 'Third time reading it, you notice tiny engraving under the plaque: MODEL L.G. 01 - DO NOT REMOVE FROM BASE. The statue blinks.', null); else G.hud.sub('Plaque', 'THE FOUNDER. Donated by Larry Goldman, in honour of Larry Goldman, who is a human man and not a statue of one. Eyes may glow. This is normal.', 6); } });
    G.bus.on('tick', () => { });
  }
  egg(id, text, reward) {
    const S = G.S; S.eggs = S.eggs || {}; const first = !S.eggs[id]; S.eggs[id] = 1; G.hud.sub('???', text, 7); G.audio.play(first ? 'unlock' : 'ui');
    if (first) { G.prog.xp(250); G.prog.cash(2500); if (reward === 'raygun') { S.weapons.raygun = S.weapons.raygun || { lvl: 1, mods: {}, mag: null }; G.hud.toast('Found: the Zorp-9 ray gun.'); } if (reward === 'duckpower') { S.flags.duckLuck = 1; G.prog.recalc && G.prog.recalc(); G.hud.toast('Duck Luck: crits happen more often. Quack.'); } const n = Object.keys(S.eggs).length; G.hud.toast(`Secret ${n} of 8 found.`); }
  }
  // ---- elevators ----
  async ride(cur, poi) {
    const L = LIFTS[INT[cur] ? INT[cur].lift : 'spire'].filter(id => id !== 'gold66' || (G.S.flags && G.S.flags.floor66)), q = poi || (INT[cur].lift === 'spire' ? POI.spire : POI.goldtower); const opts = L.map(id => INT[id].floor + (id === cur && G.interior ? '  (you are here)' : '')); const top = INT[L[L.length - 1]]; opts.push('Roof'); opts.push('Cancel');
    if (G.mission && G.mission.lockLift) { G.hud.toast('The elevator is locked down.'); return; }
    const i = await G.hud.choice(opts); if (i >= opts.length - 1) return; G.audio.play('door');
    await G.menus.fade(true, '', i === L.length ? 'Roof' : INT[L[i]].floor, .3);
    if (i === L.length) { G.interiors.exit(q.roof.clone(), Math.PI); }
    else { const id = L[i]; G.interiors.enter(id, { mark: 'E', noExit: i > 0, door: G.interior ? undefined : q.door, yaw: 0 }); const it = G.interior; if (!G.interiors.ret) G.interiors.ret = V3(q.door.x, 0, q.door.z); }
    G.menus.fade(false, '', '', .3);
  }
  enter(id) {
    const it = G.interior, def = INT[id], S = G.S, m = k => it.mark(k), F = G.flow; if (!def) return;
    if (def.lift) for (const p of it.marks.E || []) F.add({ pos: p, r: 1.6, label: 'Elevator', pri: .5, fn: () => this.ride(id) });
    if (G.mission && !G.mission.roomsOpen || G.date) return;
    if (id === 'spire0' || id === 'gold0') { for (const p of (it.marks.n || [])) F.npc(id === 'spire0' ? LOOKS.prog || randomLook('C') : LOOKS.guard, p, { name: id === 'spire0' ? 'Neuroplex reception' : 'Goldman concierge', yaw: 0, talk: () => G.hud.sub(id === 'spire0' ? 'Reception' : 'Concierge', pick(id === 'spire0' ? ['Welcome to Neuroplex. Please think only approved thoughts.', 'The upper floors are for employees and GLORIA. Mostly GLORIA.', 'Visitors may ride to the roof. The view is complimentary. Your data is not.'] : ['Mr. Goldman is not available. He is never available. He is always watching.', 'The trading floor is on 52. Please do not touch the money. It bites.', 'Tours of the penthouse are by appointment, and appointments are by miracle.']), 4) }); }
    if (id === 'guns' && it.marks.L) F.add({ pos: it.mark('L', 1), r: 2.2, label: 'Workbench: attachments and finishes', fn: () => G.flow.workbench() });
    if (id === 'velvet') this.velvet(it);
    if (id === 'armory') this.armory(it);
    if (id === 'motel') { F.add({ pos: m('1'), r: 2.4, label: 'Sleep (save)', fn: () => F.sleep() }); F.add({ pos: m('2'), r: 2, label: 'Read the guestbook', fn: () => G.hud.sub('Guestbook', pick(['"Room 7 is haunted by a man who keeps asking for his deposit back." - Room 8', '"Saw lights over the dry lake. Also saw a duck the size of a house. Will not elaborate." - a trucker', '"Bunker people came by again. Paid in gold bars. Gold bars! For ice!" - the manager']), 6) }); }
    if (id === 'bunker') this.bunker(it);
    if (id === 'ranger') this.ranger(it);
  }
  velvet(it) {
    const F = G.flow, S = G.S, m = k => it.mark(k);
    for (const q of it.marks.Q || []) { const a = F.npc(Object.assign(randomLook('N'), { top: pick(['#ff3a8a', '#c040ff', '#ffd24a', '#40e0ff']), topType: 'crop', hair: { type: pick(['long', 'bun', 'pony']), col: pick(['#1a1210', '#d8b060', '#8a2a4a']) } }), V3(q.x + .7, .35, q.z), { name: 'Dancer', yaw: -Math.PI / 2 }); a.pose = 'dance'; }
    const ns = it.marks.n || []; if (ns[0]) F.npc(Object.assign(randomLook('N'), { top: '#1a1a1a', top2: '#ff3a8a' }), ns[0], { name: 'Roxy (bartender)', yaw: 0, talkLabel: 'Talk to Roxy', talk: () => { this.roxy(); if (G.S.flags.roxy >= 2) setTimeout(() => G.bus.emit('roxy'), 5200); } });
    for (const p of ns.slice(1)) { const a = F.npc(randomLook('D'), p, { name: 'Patron', yaw: rand(0, TAU) }); a.pose = pick(['talk', 'cross', 'dance']); }
    F.add({ pos: m('1'), r: 2.6, label: 'Make it rain ($250)', fn: () => { if (!G.prog.buy(250)) return; const q = (it.marks.Q || [m('1')])[0]; for (let k = 0; k < 4; k++) G.fx.coins(q.x + rand(-1, 1), 2.2, q.z + rand(-1, 1), 12); G.audio.play('cash'); G.hud.toast(pick(['The crowd goes wild. Your accountant weeps.', 'Money: thrown. Dignity: also thrown.', 'Someone yells "BOTTLE SERVICE" for no reason.'])); S.stats.rain = (S.stats.rain || 0) + 1; if (S.stats.rain === 10) { G.hud.toast('Unlocked: Velvet VIP card. Drinks on the house.'); S.flags.vipCard = 1; } } });
    F.add({ pos: m('2'), r: 2.6, label: 'VIP booth ($1,500): heal, armor, and gossip', fn: async () => { if (!G.prog.buy(S.flags.vipCard ? 0 : 1500)) return; G.inputLock = true; await G.menus.fade(true, 'VIP', pick(['An hour of terrible karaoke and expensive water later...', 'You leave with a sore throat, a full heart and a stolen napkin with a phone number on it.', 'Nobody saw anything. That is the whole point of the VIP booth.']), .5); await new Promise(r => setTimeout(r, 1800)); const p = G.player; p.hp = p.maxHp; p.armor = Math.max(p.armor || 0, 100); G.inputLock = false; await G.menus.fade(false); G.hud.sub('Gossip', pick(['A Fortis colonel drinks here on Fridays. He says the base keeps "the prototype" in Hangar B.', 'Goldman Tower\'s penthouse elevator skips floor 66. Nobody knows what is on 66.', 'Somebody paid in sand-crusted gold bars. Deep Storage is out in the Dry Margin.', 'The rangers up on Halfmoon Ridge will pay for proof of Bigfoot. Real proof. Not your cousin in a coat.']), 7); } });
  }
  roxy() { const S = G.S; S.flags.roxy = (S.flags.roxy || 0) + 1; const lines = ['Welcome to the Velvet Ledger. We count everything. Twice.', 'Larry used to own a piece of this place. He sold it to himself and then foreclosed on himself. Accounting.', 'You look like trouble. The good kind. Tip accordingly.', 'If you see a colonel in a pink tie, buy him a drink. He talks.']; G.hud.sub('Roxy', lines[(S.flags.roxy - 1) % lines.length], 5); if (S.flags.roxy === 3 && !S.flags.roxyGift) { S.flags.roxyGift = 1; G.prog.item && G.prog.item('medkit', 2); G.hud.toast('Roxy slides you two medkits. "On the house. Do not ask which house."'); } }
  armory(it) {
    const F = G.flow, S = G.S, m = k => it.mark(k); if (!G.mission) { G.baseAlert = true; G.police.crime && G.police.crime('trespass', G.player.pos); for (const p of (it.marks.e || [])) { const a = spawnEnemy('soldier', p.x, p.z); a.roomNpc = true; F.roomNpcs.push(a); } }
    const loot = k => () => { const day = S.day || 1; S.flags.armoryDay = S.flags.armoryDay || {}; if (S.flags.armoryDay[k] === day) { G.hud.toast('Already cleaned out. Come back tomorrow (if you live).'); return; } S.flags.armoryDay[k] = day; G.bus.emit('loot', 'armory', it.mark(k)); };
    F.add({ pos: m('1'), r: 2.2, label: 'Crack the weapons locker', fn: loot('1') }); F.add({ pos: m('2'), r: 2.2, label: 'Open the prototype crate', fn: loot('2') }); for (const p of it.marks.x || []) F.add({ pos: p, r: 1.6, label: 'Grab the payroll', once: true, fn: () => { G.prog.cash(randi(3000, 6000)); G.audio.play('cash'); } });
  }
  bunker(it) {
    const F = G.flow, m = k => it.mark(k); if (!G.mission) for (const p of (it.marks.e || [])) { const a = spawnEnemy(chance(.3) ? 'guardh' : 'guard', p.x, p.z); a.roomNpc = true; F.roomNpcs.push(a); }
    for (const p of it.marks.x || []) F.add({ pos: p, r: 1.6, label: 'Take the sandy gold bars', fn: () => { if (G.S.flags['bunkerGold' + Math.round(p.x)]) return; G.S.flags['bunkerGold' + Math.round(p.x)] = 1; G.prog.cash(12000); G.audio.play('cash'); G.hud.toast('Gold bars. They are warm. Do not think about why.'); } });
    F.add({ pos: m('T'), r: 2.4, label: 'Read the terminal', fn: () => G.hud.sub('DEEP STORAGE TERMINAL', 'BACKUP 7 OF 9: GLORIA_CORE_WEIGHTS.bin  (sealed)  //  SHIPMENT: "ASSET L.G." spare parts x12 to Goldman Tower fl. 66  //  NOTE: do NOT open crate 3, it hums', 8) });
    F.add({ pos: m('1'), r: 2.2, label: 'Open crate 3', fn: () => G.bus.emit('loot', 'bunker', m('1')) });
  }
  ranger(it) {
    const F = G.flow, S = G.S, m = k => it.mark(k);
    F.npc(Object.assign(randomLook('S'), { top: '#5a6a3a', top2: '#3a4a2a', hair: { type: 'short', col: '#6a6a6a' } }), m('n'), { name: 'Ranger Dale', yaw: Math.PI, talkLabel: 'Talk to Ranger Dale', talk: () => G.bus.emit('ranger') });
    F.add({ pos: m('1'), r: 2, label: 'Evidence board', fn: () => G.hud.sub('Evidence board', 'Blurry photo. Blurrier photo. A footprint the size of a car door. A receipt from the Velvet Ledger signed "B.F."', 6) });
    F.add({ pos: m('2'), r: 2, label: 'Sleep in the bunk (save)', fn: () => F.sleep() });
  }
  // ---- per frame: base security, outer traffic, parked rides ----
  update(dt) {
    if (!G.S || G.state !== 'play') return; const p = G.player; if (!p) return;
    if (!this.parkedDone && G.VEH) { this.parkedDone = true; this.spawnParked(); }
    // Fort Fortis: inside the fence without a reason means trouble
    const inside = !G.interior && G.humans().some(h => h.alive && G.world.inBase((h.vehicle || h).pos.x, (h.vehicle || h).pos.z)); const allowed = G.mission && G.mission.baseOk;
    if (inside && !allowed) { this.alertT += dt; if (this.alertT > .2 && !this.warned) { this.warned = 1; G.hud.banner('<span style="color:#ff5040">RESTRICTED AREA</span>', 'Leave Fort Fortis immediately', '', 2600); G.audio.play('alarm', p.pos); } if (this.alertT > 4 && !G.baseAlert) { G.baseAlert = true; G.hud.toast('Fort Fortis is on alert. Soldiers are coming.'); G.police.crime && G.police.crime('trespass', p.pos); } }
    else if (!inside) { this.alertT = Math.max(0, this.alertT - dt * .5); if (this.alertT === 0) this.warned = 0; if (G.baseAlert && !G.interior && !G.mission && G.hdist(V3((BASE.x0 + BASE.x1) / 2, 0, (BASE.z0 + BASE.z1) / 2)) > 700) { G.baseAlert = false; for (const a of this.soldiers) if (a.alive && !a.gone) a.remove(); this.soldiers = []; } }
    if (G.baseAlert && !G.interior) { this.sT = (this.sT || 0) - dt; this.soldiers = this.soldiers.filter(a => a.alive && !a.gone); if (this.sT <= 0 && this.soldiers.length < 10) { this.sT = 3.5; const near = G.city.world.spawns.soldier.filter(q => G.hdist(q) < 240 && G.hdist(q) > 14); if (!near.length) return this.outerTraffic(dt); const sp = pick(near); if (G.hdist(sp) < 260 && G.hdist(sp) > 12) { const a = spawnEnemy('soldier', sp.x + rand(-2, 2), sp.z + rand(-2, 2), { y: sp.y }); a.state = 'combat'; a.target = G.nearH(sp); a.aware = 1; this.soldiers.push(a); } } }
    this.outerTraffic(dt);
  }
  spawnParked() { for (const [t, x, z, yaw] of G.city.world.parked) { if (!G.VEH[t]) continue; const v = new Vehicle(t, x, z, yaw); v.civ = true; v.locked = chance(.4); v.parkedOuter = true; } }
  // a few cars cruising the outer roads near the players
  outerTraffic(dt) {
    this.tt -= dt; this.traffic = this.traffic.filter(v => !v.gone && v.alive); for (const v of this.traffic) if (G.hdist(v.pos) > 520 && !G.anyVeh(v)) { v.remove(); }
    if (this.tt > 0) return; this.tt = 2.5; if (G.interior || this.traffic.length >= 7) return; const h = G.player.vehicle ? G.player.vehicle.pos : G.player.pos; if (!outside(h.x, h.z)) return;
    const r = pick(ROADS), S = r.S; const i = randi(2, S.length - 3), q = S[i]; const d = Math.hypot(q.x - h.x, q.z - h.z); if (d < 120 || d > 380 || q.br) return; const dir = chance(.5) ? 1 : -1, nx = S[i + dir]; const yaw = Math.atan2(nx.x - q.x, nx.z - q.z); const L = 3.2, ox = Math.cos(yaw) * L, oz = -Math.sin(yaw) * L; // keep right
    for (const v of G.vehicles) if (Math.abs(v.pos.x - q.x) < 12 && Math.abs(v.pos.z - q.z) < 12) return;
    const t = pick(['corona', 'calmly', 'ultima', 'effort', 'silverhaze', 'explainer', 'rav', 'wrangled', 'bronko', 'pickup', 'pickup', 'civil', 'oddyssey', 'truck', 'haul', 'mustank', 'gwaggin', 'cybertrack', 'dirtbike']); if (!G.VEH[t]) return; const v = new Vehicle(t, q.x - ox, q.z - oz, yaw, { y: q.y + .1 }); v.civ = true;
    const pts = []; for (let k = i + dir; k >= 0 && k < S.length; k += dir * 3) { const a = S[k], b = S[clamp(k + dir, 0, S.length - 1)]; const yw = Math.atan2(b.x - a.x, b.z - a.z); pts.push({ x: a.x - Math.cos(yw) * L, z: a.z + Math.sin(yw) * L }); }
    new Driver(v, 'goto', { points: pts, cruise: rand(16, 24), corner: 12, polite: true, onArrive: () => { if (!G.anyVeh(v)) v.remove(); } }); this.traffic.push(v);
  }
}
