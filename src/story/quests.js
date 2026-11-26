// Side questlines with real loot, and the last few easter eggs.
//  - Ranger Dale (Halfmoon Ridge): Big Feet -> Night Shift -> Poachers on the Bridge
//  - Roxy (Velvet Ledger): Pink Tie -> Armory Run
//  - Nova's Legends (Torque Temple): find three legendary cars hidden around the world
import { G } from '../core/g.js';
import { V3, rand, pick, chance, dist2, TAU } from '../core/util.js';
import { POI } from '../world/citydata.js';
import { SPOTS, BASE, height, canyonX } from '../world/outer.js';
import { LOOKS } from '../ent/human.js';
import { Driver } from '../ent/vehicle.js';
import { applyCarMods } from '../ent/carmods.js';
import { dropAtt } from '../sys/arsenal.js';

const at = (x, z, dy = .2) => V3(x, height(x, z) + dy, z);
const BIGFOOT = { skin: '#4a3020', h: 1.55, w: 1.45, mus: .6, hair: { type: 'afro', col: '#3a2414' }, topType: 'tee', top: '#4a3020', top2: '#3a2414', pants: '#4a3020', shoes: '#2a1a0a', beard: { type: 'full', col: '#3a2414' } };
const give = (S, id) => { S.weapons[id] = S.weapons[id] || { lvl: 1, mods: {}, mag: null }; };
export class Quests {
  constructor() {
    G.bus.on('ranger', () => this.ranger()); G.bus.on('roxy', () => this.roxy());
    this.legendT = 0; this.eggT = 0;
    G.interactables.push({ pos: V3(POI.garage.door.x - 4, .2, POI.garage.door.z), r: 2.4, label: "Nova's Legends (legendary car hunt)", cond: () => !G.interior && !G.player.vehicle && !G.mission && G.S.done && G.S.done.m10, fn: () => this.legends() });
  }
  q() { const S = G.S; return S.quests || (S.quests = {}); }
  // ---------- Ranger Dale ----------
  async ranger() {
    const Q = this.q(), n = Q.dale || 0;
    if (n === 0) { await G.hud.sub('Ranger Dale', 'Thirty years I have been up here. Thirty years of footprints the size of a car door. Find me three fresh tracks and I will pay. Real money. Park money.', 6); if (await G.hud.choice(['Start "Big Feet"', 'Not now']) === 0) this.bigFeet(); }
    else if (n === 1) { await G.hud.sub('Ranger Dale', 'The tracks lead to the north ridge. He only comes out after dark. Bring a camera. Bring two. One will break. They always break.', 6); if (await G.hud.choice(['Start "Night Shift"', 'Not now']) === 0) this.nightShift(); }
    else if (n === 2) { await G.hud.sub('Ranger Dale', 'Poachers. On MY bridge. They want him stuffed and mounted in Goldman Tower. Over my dead body. Preferably over theirs.', 6); if (await G.hud.choice(['Start "Poachers on the Bridge"', 'Not now']) === 0) this.poachers(); }
    else G.hud.sub('Ranger Dale', pick(['He came by last night. Left a fish on the porch. We are friends now.', 'If anyone asks, Bigfoot is a hoax. That is what he wants.', 'You ever want to just live in the woods? He does. He also has a Velvet Ledger membership.']), 5);
  }
  bigFeet() { const Q = this.q(); const tracks = [at(1760, -1700), at(2050, -1450), at(1880, -2250)]; return G.side.runSide({ id: 'q_dale1', name: 'Big Feet', desc: 'Find three fresh tracks for Ranger Dale.', cash: 6000, start: { pos: V3(POI.ranger.door.x, 0, POI.ranger.door.z + 3) }, stages: [{ at: () => V3(POI.ranger.door.x, height(POI.ranger.door.x, POI.ranger.door.z + 3) + .2, POI.ranger.door.z + 3), fn: async m => {
    for (let i = 0; i < 3; i++) { const t = tracks[i]; for (let k = 0; k < 5; k++) G.fx.decal && G.fx.decal(t.x + k * 1.4, t.y - .15, t.z + k * .7, 0, 1, 0, .5); await m.goto(t, { obj: 'Find the tracks', sub: `Track ${i + 1} of 3`, label: 'Tracks', r: 6 }); await m.say(pick(['Jakob', 'Donald', 'Jeremiah']), pick(['That is a big foot.', 'Size forty-nine. Wide fit.', 'He needs a pedicure. Badly.'])); }
    await m.goto(V3(POI.ranger.door.x, height(POI.ranger.door.x, POI.ranger.door.z + 3) + .2, POI.ranger.door.z + 3), { obj: 'Report back to Ranger Dale', label: 'Ranger station', r: 8 }); await m.say('Ranger Dale', 'Three! THREE! Here. Take the good tires. You will need them up here.'); Q.dale = 1; G.S.flags.freeTires = 1; } }] }); }
  nightShift() { const Q = this.q(); const sp = SPOTS.bigfoot; return G.side.runSide({ id: 'q_dale2', name: 'Night Shift', desc: 'Photograph Bigfoot. He is fast.', cash: 9000, start: { pos: at(sp[0] - 60, sp[1] + 40) }, stages: [{ at: () => at(sp[0] - 60, sp[1] + 40), fn: async m => {
    if (!(G.S.hour >= 21 || G.S.hour < 4)) { await G.menus.fade(true, 'Later', 'You wait for dark. Donald tells ghost stories. They are all about the IRS.', .5); G.S.hour = 22.5; await m.wait(1.2); await G.menus.fade(false); }
    const bf = m.npc(BIGFOOT, at(sp[0], sp[1]), { name: '???', faction: 'neutral', hp: 9999 }); bf.invuln = true; bf.model.group.scale.setScalar(1.25); bf.brain = 'script'; bf.runSp = 7.2; let t = 0, dir = rand(0, TAU); bf.script = dt => { const p = G.nearH(bf.pos), d = dist2(bf.pos, p.vehicle ? p.vehicle.pos : p.pos); t -= dt; if (t <= 0) { t = rand(1.5, 3); dir = Math.atan2(bf.pos.x - p.pos.x, bf.pos.z - p.pos.z) + rand(-.9, .9); } const s = d < 45 ? bf.runSp : 2; bf.physics(dt, Math.sin(dir) * s, Math.cos(dir) * s); bf.yaw = dir; bf.faceYaw = dir; bf.speedXZ = s; bf.animate(dt); };
    await m.goto(bf.pos, { obj: 'Find him', label: '???', r: 40 }); await m.say('Jakob', 'THERE! Big! Hairy! Not Donald!'); let ok = false; const fail = m.timer(45, 'He is getting away', () => { if (!ok) m.fail('He got away. He always gets away.'); });
    await m.until(() => { const p = G.nearH(bf.pos); return dist2(bf.pos, p.vehicle ? p.vehicle.pos : p.pos) < 9; }, () => { G.player.pos.set(bf.pos.x + 4, bf.pos.y, bf.pos.z); }); ok = true; fail.stop && fail.stop(); G.hud.timer(null);
    m.obj('Take the photo', 'Get close and press the button'); G.audio.play('hackdone'); G.gfx.fx.flash = .9; await m.scene([['Donald', 'Smile!'], ['???', '...'], ['Jeremiah', 'He waved. He WAVED at us.'], ['Jakob', 'Best night of my life. Again.']]); bf.remove(); Q.dale = 2; G.places.egg('bigfoot', 'Bigfoot is real. He waved. The photo is blurry anyway. They are always blurry.', null); give(G.S, 'ghost'); G.hud.toast('Ranger Dale sends a "thank you" crate: Ghost-9 suppressed SMG.'); } }] }); }
  poachers() { const Q = this.q(); const bx = canyonX(-1450), y = G.city.world.deck.y; return G.side.runSide({ id: 'q_dale3', name: 'Poachers on the Bridge', desc: 'Defend The Long Goodbye.', cash: 16000, start: { pos: at(1380, -1452) }, stages: [{ at: () => at(1380, -1452), fn: async m => {
    await m.scene([['Ranger Dale', 'They parked trucks across the bridge. They have nets. And a cage. And a gift shop?'], ['Donald', 'Let us return their merchandise.']]);
    const mid = V3(bx, y + .2, -1450); const L = m.group(['rat', 'liq', 'rat'], mid, 7, 30, { sight: 30 }).concat(m.group('liq', V3(bx + 90, y + .2, -1450), 3, 6, { sight: 30 })); m.car('mtruck', V3(bx - 20, y + .3, -1450), Math.PI / 2); m.car('mtruck', V3(bx + 40, y + .3, -1449), -Math.PI / 2);
    await m.kill(L, { obj: 'Clear the bridge' }); await m.say('Jeremiah', 'Helicopter! No, wait, it is a Fortis drone swarm. Of course it is.');
    await m.waves([() => [0, 1, 2, 3].map(k => m.drone(V3(bx + rand(-60, 60), y + 18, -1450 + rand(-30, 30)), { hp: 60 })), () => m.group('soldier', V3(bx + 120, y + .2, -1450), 5, 8, { sight: 40 })], { obj: 'Hold the bridge' });
    await m.scene([['Ranger Dale', 'The forest thanks you. He thanks you. He left something for you on the north tower.']]); Q.dale = 3; dropAtt(mid, 3); give(G.S, 'thunder'); G.hud.toast('Thunderclap .50 added to your guns. Bigfoot has very good taste.'); } }] }); }
  // ---------- Roxy ----------
  async roxy() {
    const Q = this.q(), n = Q.roxy || 0; if (n === 0) { await G.hud.sub('Roxy', 'The colonel with the pink tie runs Fort Fortis for Larry. He leaves at closing. Follow him and see where the keycard goes. Do not let him see you.', 7); if (await G.hud.choice(['Start "Pink Tie"', 'Not now']) === 0) this.pinkTie(); }
    else if (n === 1) { await G.hud.sub('Roxy', 'You have his keycard. The Fortis armory is full of things Larry bought with your money. Go get a refund.', 6); if (await G.hud.choice(['Start "Armory Run"', 'Not now']) === 0) this.armoryRun(); }
    else G.hud.sub('Roxy', pick(['The colonel has not been back. He owes me a tab. You can pay it if you want. You do not want to.', 'Drinks are on the house. Not ON the house. Do not climb the house.']), 4);
  }
  pinkTie() { const Q = this.q(); const d = POI.velvet.door; return G.side.runSide({ id: 'q_roxy1', name: 'Pink Tie', desc: 'Tail the colonel without being seen.', cash: 8000, start: { pos: V3(d.x, .2, d.z + 4) }, stages: [{ at: () => V3(d.x, .2, d.z + 4), fn: async m => {
    if (!G.player.vehicle) { const c = m.car('chargin', V3(d.x + 8, 0, d.z + 10), 0); await m.enter(c, { obj: 'Get in a car' }); }
    const { v, L } = (() => { const v = m.car('escalate', V3(d.x - 10, 0, d.z + 12), Math.PI / 2); const col = m.npc(Object.assign({}, LOOKS.exec || LOOKS.guard, { top: '#3a4a2a', top2: '#ff8ad0' }), V3(v.pos.x, 0, v.pos.z), { name: 'Colonel Pink Tie', faction: 'neutral' }); col.enterVehicle(v, 0); return { v, L: [col] }; })();
    const pts = [[d.x - 10, d.z + 60], [-55, -700], [-55, -1080], [-55, -1180], [-55, -1400]].map(([x, z]) => ({ x, z })); new Driver(v, 'goto', { points: pts, cruise: 17, polite: true, corner: 10 });
    m.obj('Tail the colonel', 'Stay within 90 m. Closer than 15 m and he spots you'); let warn = 0;
    await m.until(() => { const me = G.player.vehicle || G.player, dd = dist2(me.pos, v.pos); if (dd < 15) m.fail('He spotted you. Pink ties notice everything.'); if (dd > 90) { warn += G.dt; if (warn > 6) m.fail('You lost him.'); } else warn = 0; return dist2(v.pos, V3(-55, 0, -1400)) < 25; }, () => { v.pos.set(-55, 3.2, -1395); });
    await m.scene([['Jeremiah', 'He swiped a card at the gate. I cloned it from here. I am very good.'], ['Donald', 'Roxy is going to be SO impressed.']]); Q.roxy = 1; G.S.flags.keycard = 1; } }] }); }
  armoryRun() { const Q = this.q(); return G.side.runSide({ id: 'q_roxy2', name: 'Armory Run', desc: 'Walk into Fort Fortis with a stolen keycard.', cash: 20000, start: { pos: V3(-20, 3.2, -1395) }, stages: [{ at: () => V3(-20, 3.2, -1395), fn: async m => {
    m.baseOk = true; await m.scene([['Jakob', 'The card works. The barrier is going up. Act natural.'], ['Donald', 'I was born natural.']]); await m.goto(V3(POI.fortis.door.x, 3.2, POI.fortis.door.z + 3), { obj: 'Get to Fortis Command', label: 'Armory', r: 4 });
    await m.door(POI.fortis.door, 'Enter the armory', 'armory', { obj: 'Go in' }); } }, { int: 'armory', fn: async m => { const it = G.interior; G.baseAlert = true; const L = m.fill(it, ['soldier', 'soldier', 'guardh'], { sight: 26 }); await m.kill(L, { obj: 'Clear the armory', leave: 1 }); await m.interact(it.mark('1'), 'Crack the locker', { obj: 'Loot the armory', mark: 'Locker' }); G.bus.emit('loot', 'armory', it.mark('1')); give(G.S, 'mk7'); give(G.S, 'reaper'); G.S.flags.jugg = 1; await m.say('Roxy', 'Heard the alarms from here. Proud of you. Bring me a helmet.'); Q.roxy = 2; await m.exitInt(V3(POI.fortis.door.x, 3.1, POI.fortis.door.z + 2)); G.police.min(3); await m.lose({ obj: 'Get out of Fort Fortis' }); } }] }); }
  // ---------- Nova's Legends ----------
  legends() {
    const S = G.S, Q = this.q(); Q.leg = Q.leg || {}; const L = [['counthatch', 'In Hangar B at Fort Fortis', V3(0, 3.2, -1748), 0], ['fforty', 'On the dry lake in the Dry Margin', at(-1650, 1180), 0], ['shyron', 'In the Goldman Tower motor court', V3(POI.goldtower.x + 34, .2, POI.goldtower.z + 34), 0]]; const left = L.filter(l => !Q.leg[l[0]]);
    if (!left.length) { G.hud.sub('Nova', 'All three legends, in MY shop. I am going to cry. Here, every mod at half price, forever.', 6); S.flags.halfMods = 1; return; }
    G.hud.sub('Nova', 'Three legends are hiding in this town. ' + left.map(l => l[1]).join('. ') + '. Bring them to me without a scratch. Okay, a few scratches.', 8); S.flags.legends = 1; this.spawnLegends();
  }
  spawnLegends() { const S = G.S, Q = this.q(); Q.leg = Q.leg || {}; this.legCars = this.legCars || {}; const L = [['counthatch', V3(0, 3.2, -1748), 0], ['fforty', at(-1650, 1180), 0], ['shyron', V3(POI.goldtower.x + 34, .2, POI.goldtower.z + 34), Math.PI]]; for (const [t, p, yaw] of L) { if (Q.leg[t] || (this.legCars[t] && !this.legCars[t].gone)) continue; const v = new G.Vehicle(t, p.x, p.z, yaw, p.y > 2 ? { y: p.y } : {}); v.keep = true; v.legend = t; this.legCars[t] = v; } }
  update(dt) {
    if (!G.S || G.state !== 'play') return; const S = G.S, Q = this.q(), p = G.player;
    // legend deliveries
    this.legendT -= dt; if (this.legendT <= 0) { this.legendT = 1; if (S.flags.legends && !G.interior) { if (!this.legCars) this.spawnLegends(); const v = p.vehicle; if (v && v.legend && !Q.leg[v.legend] && dist2(v.pos, V3(POI.garage.door.x, 0, POI.garage.door.z + 6)) < 12 && v.speed < 3) { Q.leg[v.legend] = 1; S.garage.push({ t: v.type, paint: v.paint, mods: v.mods }); G.prog.cash(25000); G.audio.play('cash'); G.hud.banner('<span style="color:#ffb020">LEGEND DELIVERED</span>', v.def.name + ' is in your garage', '', 2600); G.exitAll(); v.remove(); } } }
    // easter egg: the DeLorry-Ann at 88 mph
    const v = p.vehicle; if (v && v.def.flux && v.driver === p && v.speed > 39.3 && !this.fluxing) { this.fluxing = true; G.gfx.fx.flash = 1; G.audio.play('emp', v.pos); for (let k = 0; k < 30; k++) G.fx.shock && G.fx.shock(v.pos.x + rand(-2, 2), v.pos.y + rand(0, 2), v.pos.z + rand(-2, 2)); S.hour = (S.hour + 12) % 24; const f = V3(Math.sin(v.yaw), 0, Math.cos(v.yaw)); v.pos.addScaledVector(f, 30); G.places.egg('flux', 'Great Scott. It is twelve hours later and you are thirty metres down the road. The flux capacitor is a toaster.', null); setTimeout(() => { this.fluxing = false; }, 4000); }
    // easter egg: the Duck King of the park lake, 1-3 am on the gazebo island
    this.eggT -= dt; if (this.eggT <= 0) { this.eggT = 1; const pk = G.city.parkRect; if (pk && !G.interior && S.hour >= 1 && S.hour < 3 && dist2(p.pos, V3(pk.cx, 0, pk.cz)) < 9 && !(S.eggs && S.eggs.gazebo)) { G.places.egg('gazebo', 'A duck in a tiny crown waddles out of the gazebo, inspects you, and leaves you a rubber chicken. You have been knighted.', null); S.weapons.chicken = S.weapons.chicken || { lvl: 5, mods: {}, mag: null }; S.weapons.chicken.lvl = 8; } }
  }
}
