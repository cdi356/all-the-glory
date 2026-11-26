// Hideout customization: themes (wall, floor, accent and lamp colours) and furniture in ten slots around the
// laundromat. Most pieces do something: the gun wall opens the gunsmith, the server rack boosts Crumb's operations,
// the holo table fast-travels, the jukebox picks the music.
import * as THREE from 'three';
import { G } from '../core/g.js';
import { V3, GeoB, M4, rand, randi, pick, chance, money, TAU } from '../core/util.js';
import { INT } from '../world/interiors.js';
import { getDetailMat, vehGeo, wheelGeo } from '../ent/vehmodels.js';
import { weaponMesh } from './combat.js';
import { WEAPONS } from './weapondata.js';
import { POI, POIS } from '../world/citydata.js';
import { gunsmithMenu } from './gunsmith.js';

export const THEMES = {
  classic: { name: 'Classic Suds', price: 0, wall: '#4c5a56', floor: '#3b3f40', accent: '#40ffd0', lampC: 0xffc890 },
  neon: { name: 'Neon Den', price: 6000, wall: '#2a2040', floor: '#1c1828', accent: '#ff3df2', lampC: 0xd080ff },
  vault: { name: 'Gold Vault', price: 18000, wall: '#6a5a3a', floor: '#2a2418', accent: '#ffd24a', lampC: 0xffd890 },
  jungle: { name: 'Jungle Lounge', price: 8000, wall: '#2a4a32', floor: '#3a3024', accent: '#8aff6a', lampC: 0xe0ffb0 },
  arctic: { name: 'Arctic Minimal', price: 9000, wall: '#c8d0d8', floor: '#8a949c', accent: '#6ac8ff', lampC: 0xe8f4ff },
  crimson: { name: 'Crimson Syndicate', price: 12000, wall: '#3a1214', floor: '#1a1012', accent: '#ff3a3a', lampC: 0xff9070 },
  synth: { name: 'Sunset Synthwave', price: 14000, wall: '#3a1a4a', floor: '#201030', accent: '#ff8a3a', lampC: 0xff80c0 },
};
// ten floor slots (tile column, row) in the hideout plan
const SLOTS = [[12, 2], [9, 5], [16, 7], [14, 8], [2, 2], [4, 5], [12, 10], [3, 12], [18, 7], [2, 9]];
const C = (b, c, g = 0) => b.color(c).set('glow', g);
export const ITEMS = {
  pool: { name: 'Pool table', price: 4500, desc: 'Shoot pool with the crew for small stakes.', solid: [1.6, .9, 1.6], mk: b => { C(b, '#4a2a1a').cbox(0, .75, 0, 1.4, .14, 2.4); C(b, '#1a6a3a').cbox(0, .83, 0, 1.2, .02, 2.2); C(b, '#3a2010'); for (const [x, z] of [[-.6, -1.1], [.6, -1.1], [-.6, 1.1], [.6, 1.1]]) b.cbox(x, .35, z, .14, .7, .14); for (let k = 0; k < 6; k++) C(b, pick(['#ff3a3a', '#ffd24a', '#3a6aff', '#fff', '#111', '#ff8a3a']), .2).cbox(rand(-.4, .4), .89, rand(-.8, .8), .07, .07, .07); } },
  jukebox: { name: 'Jukebox', price: 2500, desc: 'Pick the hideout soundtrack.', solid: [1, 1.8, .8], mk: b => { C(b, '#6a2a1a').cbox(0, .8, 0, .9, 1.6, .6); C(b, '#ffb03a', 2).cbox(0, 1.3, .31, .7, .5, .02); C(b, '#ff3df2', 2.4).cbox(0, .6, .31, .75, .06, .02).cbox(0, .45, .31, .75, .06, .02); C(b, '#c8c0a0').cyl(0, 1.6, 1.65, 0, .45, .45, 14); } },
  aquarium: { name: 'Aquarium', price: 3800, desc: 'Fish do not judge. Mostly.', solid: [2, 1.6, .8], mk: b => { C(b, '#222').cbox(0, .4, 0, 2, .8, .7); C(b, '#3ab0d0', .9).cbox(0, 1.15, 0, 1.9, .7, .6); for (let k = 0; k < 7; k++) C(b, pick(['#ff8a3a', '#ffd24a', '#ff3df2', '#6affff']), 1.4).cbox(rand(-.8, .8), rand(.9, 1.4), rand(-.2, .2), .14, .06, .05); C(b, '#2a8a3a', .3).cbox(-.6, .95, 0, .1, .3, .1).cbox(.5, .95, .1, .08, .4, .08); } },
  trophy: { name: 'Trophy case', price: 2000, desc: 'Shows off what you have done.', solid: [1.6, 2, .6], mk: b => { C(b, '#3a2a1a').cbox(0, 1, 0, 1.6, 2, .5); C(b, '#8ac8d8', .15).cbox(0, 1.1, .26, 1.4, 1.6, .02); C(b, '#ffd24a', .8); for (let k = 0; k < 4; k++) { b.cbox(-.5 + k * .33, .55, 0, .14, .2, .14); b.cyl(-.5 + k * .33, .65, .9, 0, .08, .03, 8); } C(b, '#c0c4c8', .4).cbox(0, 1.45, 0, 1.2, .3, .2); } },
  gunwall: { name: 'Gun wall', price: 5000, desc: 'Mounts your collection. Opens the gunsmith.', solid: [2.2, 2.4, .4], mk: b => { C(b, '#2a2a2e').cbox(0, 1.2, 0, 2.2, 2.4, .2); C(b, '#ff5a5a', 1.6).cbox(0, 2.35, .11, 2.1, .05, .02); }, guns: true },
  bag: { name: 'Punching bag', price: 900, desc: 'Train once a day for experience.', solid: [.8, 2, .8], mk: b => { C(b, '#444').cbox(0, 2.3, 0, .1, .4, .1); C(b, '#8a1a1a').cyl(0, .7, 2.1, 0, .32, .32, 12); } },
  bar: { name: 'Mini bar', price: 3500, desc: 'A free drink every day.', solid: [2, 1.1, .8], mk: b => { C(b, '#3a2418').cbox(0, .55, 0, 2, 1.1, .7); C(b, '#c8a060').cbox(0, 1.12, 0, 2.1, .06, .8); for (let k = 0; k < 6; k++) C(b, pick(['#6a3a1a', '#3a6a3a', '#c8c0a0', '#8a1a3a']), .3).cyl(-.8 + k * .32, 1.15, 1.5, -.2, .05, .05, 8); C(b, '#ffb03a', 1.6).cbox(0, .2, .36, 1.9, .04, .02); } },
  server: { name: 'Server rack', price: 12000, desc: "Crumb's operations pay 20% more.", solid: [1, 2.2, 1], mk: b => { C(b, '#16181c').cbox(0, 1.1, 0, .9, 2.2, .9); for (let k = 0; k < 7; k++) C(b, pick(['#40ffd0', '#40ff80', '#ff4040', '#40ffd0']), 2.2).cbox(0, .3 + k * .28, .46, .8, .04, .02); } },
  safe: { name: 'Interest safe', price: 15000, desc: 'Pays a small dividend every morning you sleep here.', solid: [1, 1.2, 1], mk: b => { C(b, '#50545a').cbox(0, .6, 0, 1, 1.2, 1); C(b, '#c9a53a', .4).cyl(.2, .7, .75, .51, .14, .14, 12); C(b, '#222').cbox(-.25, .6, .51, .1, .4, .02); } },
  hottub: { name: 'Hot tub', price: 9000, desc: 'Full heal and a long sigh.', solid: [2.2, .8, 2.2], mk: b => { C(b, '#6a4a3a').cbox(0, .4, 0, 2.2, .8, 2.2); C(b, '#40d0ff', 1).cbox(0, .78, 0, 1.9, .04, 1.9); } },
  cabinet: { name: 'Second arcade cabinet', price: 1800, desc: 'Plays DUCK RUN. High scores pay a little.', solid: [1.2, 1.8, 1.2], mk: b => { C(b, '#2a4a8a').cbox(0, .9, 0, 1.1, 1.8, 1); C(b, '#ffd24a', 2.2).cbox(0, 1.2, .51, .9, .5, .02); C(b, '#ff3a3a', 2).cbox(0, 1.72, .51, 1.1, .12, .02); } },
  plants: { name: 'Plant cluster', price: 300, desc: 'Oxygen. Vibes.', solid: [1.2, 1.6, 1.2], mk: b => { for (let k = 0; k < 3; k++) { const x = rand(-.4, .4), z = rand(-.4, .4); C(b, '#6a5040').cyl(x, 0, .5, z, .24, .3, 10); C(b, pick(['#2f6a30', '#3a8a3a', '#2a5a28'])).add(new THREE.IcosahedronGeometry(rand(.3, .5), 0), M4(x, rand(.8, 1.3), z)); } } },
  neon: { name: 'ALL THE GLORY neon', price: 2200, desc: 'Your name in lights. Sort of.', solid: [2.4, 2.6, .3], mk: b => { C(b, '#111').cbox(0, 1.6, 0, 2.4, 1, .08); C(b, '#ffd24a', 3).cbox(0, 1.85, .06, 2, .12, .03); C(b, '#ff3df2', 3).cbox(0, 1.45, .06, 1.6, .12, .03); C(b, '#333').cbox(-1, .8, 0, .06, 1.6, .06).cbox(1, .8, 0, .06, 1.6, .06); } },
  disco: { name: 'Disco ball', price: 4200, desc: 'Starts a party. The crew dances.', solid: [.6, 1, .6], mk: b => { C(b, '#888').cbox(0, 3.5, 0, .03, 1, .03); C(b, '#e8e8f0', .9).add(new THREE.IcosahedronGeometry(.45, 1), M4(0, 2.8, 0)); C(b, '#333').cbox(0, .1, 0, .6, .2, .6); } },
  duck: { name: 'Golden duck statue', price: 25000, desc: 'A monument to finding things.', solid: [1, 2, 1], mk: b => { C(b, '#e8e4d8').cbox(0, .5, 0, 1, 1, 1); C(b, '#ffd820', .4).add(new THREE.SphereGeometry(.45, 12, 10), M4(0, 1.35, 0, 0, 0, 0, 1, .8, 1.25)).add(new THREE.SphereGeometry(.28, 12, 10), M4(0, 1.85, .3)); C(b, '#ff8a20').cbox(0, 1.82, .62, .2, .06, .2); } },
  bike: { name: 'Bike display', price: 7000, desc: 'A Hornet 900 on a pedestal. Do not ride indoors.', solid: [1, 1.4, 2.4], bike: true, mk: b => { C(b, '#222').cbox(0, .1, 0, 1, .2, 2.4); } },
  crumb: { name: 'Crumb shrine', price: 1200, desc: 'A giant toaster. Crumb pretends not to care.', solid: [1.4, 1.6, 1], mk: b => { C(b, '#c8ccd0').cbox(0, .7, 0, 1.4, 1.2, .9); C(b, '#111').cbox(-.3, 1.31, 0, .3, .02, .6).cbox(.3, 1.31, 0, .3, .02, .6); C(b, '#40ffd0', 2.4).cbox(0, .7, .46, .5, .2, .02); C(b, '#ff8a3a', 1.4).cbox(.75, .8, 0, .06, .3, .08); } },
  tv: { name: 'Big TV and couch', price: 3000, desc: 'Watch VSPR. The news follows what you do.', solid: [2.6, 1.8, 1], mk: b => { C(b, '#111').cbox(0, 1.3, 0, 2.4, 1.2, .1); C(b, '#4ac8ff', 1.6).cbox(0, 1.3, .06, 2.2, 1, .02); C(b, '#222').cbox(0, .35, 0, 1.6, .7, .4); } },
  darts: { name: 'Dartboard', price: 400, desc: 'Three darts. Bragging rights.', solid: [1, 2, .3], mk: b => { C(b, '#3a2a1a').cbox(0, 1, 0, 1, 2, .1); C(b, '#111').cyl(0, 1.5, 1.52, .06, .3, .3, 16); C(b, '#c02020', .3).cyl(0, 1.5, 1.53, .07, .2, .2, 16); C(b, '#2a8a2a', .3).cyl(0, 1.5, 1.54, .08, .08, .08, 12); } },
  holo: { name: 'Holo city table', price: 20000, desc: 'Fast travel to any place you know ($100).', solid: [2, 1.1, 2], mk: b => { C(b, '#2a2c30').cbox(0, .45, 0, 2, .9, 2); C(b, '#40ffd0', 1.8).cbox(0, .92, 0, 1.8, .03, 1.8); for (let k = 0; k < 14; k++) C(b, '#40ffd0', 1.2).cbox(rand(-.8, .8), 1.05 + rand(0, .2), rand(-.8, .8), .1, rand(.1, .5), .1); } },
};
const NEWS = [[0, ['Aurelian Trust posts record profits; CEO Larry Goldman thanks "the little people, especially the very little ones".', 'Golden ducks sighted across Saint Vesper. Experts: "Quack."']], [6, ['Aurelian branch robbed by men described as "a hat, a nerd, and a sports car".']], [12, ['Repo vans now outnumber taxis in the Sprawl. Officials: "That is fine."']], [20, ['Neuroplex lab fire: investigators find a toaster-shaped hole in the wall.']], [26, ['ECHO QUINN BROADCAST: Nine thousand citizens found in tanks beneath Aurelian Tower.', 'Run on the bank enters day three. Pans remain the weapon of choice.']], [30, ['City-wide debt balance reads zero. Economists hospitalized. Everyone else at brunch.', 'Toaster sales up 4000%. Nobody remembers buying one.']]];

export class Decor {
  constructor() { this.props = []; this.boxes = []; this.its = []; }
  get st() { const S = G.S; S.decor = S.decor || { theme: 'classic', slots: {}, owned: {}, themes: { classic: 1 } }; return S.decor; }
  // called before the hideout interior is first built, and on load
  applyTheme() { const t = THEMES[this.st.theme] || THEMES.classic; Object.assign(INT.hideout.env, { wall: t.wall, floor: t.floor, accent: t.accent, lampC: t.lampC }); }
  rebuild() { const I = G.interiors, old = I.cache.hideout; this.applyTheme(); if (!old) return; const inside = G.interior === old, p = G.player.pos.clone(), yaw = G.player.yaw; this.clearProps(); G.scene.remove(old.group); for (const b of old.boxes) G.phys.removeBox(b); delete I.cache.hideout; const it = I.get('hideout', old.idx); it.group.visible = false; if (inside) { G.interior = null; I.enter('hideout', { pos: p, yaw }); } }
  mods(m) { const s = this.st.slots; const has = k => Object.values(s).includes(k); if (has('server')) m.income *= 1.2; }
  has(k) { return Object.values(this.st.slots).includes(k); }
  // ---------- props ----------
  clearProps() { for (const m of this.props) m.parent && m.parent.remove(m); this.props = []; for (const b of this.boxes) G.phys.removeBox(b); this.boxes = []; for (const o of this.its) { const k = G.interactables.indexOf(o); if (k >= 0) G.interactables.splice(k, 1); } this.its = []; }
  enter(it) { // the hideout was just entered; furnish it
    this.clearProps(); const st = this.st; this.it = it; const add = o => { G.interactables.push(o); this.its.push(o); G.flow.room.push(o); return o; };
    const door = it.mark('@'); add({ pos: V3(door.x + 2, 0, door.z - 1.5), r: 1.8, label: 'Design board: customize the hideout', fn: () => this.menu() });
    SLOTS.forEach(([c, r], i) => { const k = st.slots[i]; if (!k || !ITEMS[k]) return; const d = ITEMS[k], w = it.world(c, r); const b = new GeoB({ glow: 1 }); d.mk(b); const m = new THREE.Mesh(b.build(), getDetailMat()); m.position.set(w.x, 0, w.z); const yaw = this.faceYaw(it, c, r); m.rotation.y = yaw; m.castShadow = true; it.group.add(m); this.props.push(m); const [sx, sy, sz] = d.solid || [1, 1, 1], ax = Math.abs(Math.sin(yaw)) > .5 ? sz : sx, az = Math.abs(Math.sin(yaw)) > .5 ? sx : sz; this.boxes.push(G.phys.addBox(w.x - ax / 2, 0, w.z - az / 2, w.x + ax / 2, sy, w.z + az / 2));
      if (d.guns) this.mountGuns(m); if (d.bike) { const g = vehGeo('hornet'); const bm = new THREE.Group(); bm.add(new THREE.Mesh(g.paint, new THREE.MeshStandardMaterial({ color: '#ff3a1a', metalness: .5, roughness: .3 })), new THREE.Mesh(g.det, getDetailMat())); for (const q of g.wheels) { const wm = new THREE.Mesh(wheelGeo(g.wr, g.ww), getDetailMat()); wm.position.set(...q); bm.add(wm); } bm.position.y = .2; m.add(bm); }
      const use = this.use(k, w); if (use) add({ pos: V3(w.x, 0, w.z), r: 2.4, label: use[0], fn: use[1] }); });
    if (this.has('disco') && st.party) this.party(true);
  }
  faceYaw(it, c, r) { // face away from the nearest wall
    const open = [[0, 1, 0], [0, -1, Math.PI], [1, 0, Math.PI / 2], [-1, 0, -Math.PI / 2]].map(([dc, dr, y]) => { let n = 0; for (let k = 1; k < 4; k++) if (it.free(c + dc * k, r + dr * k)) n++; else break; return [n, y]; }); open.sort((a, b) => b[0] - a[0]); return open[0][1];
  }
  mountGuns(m) { const ids = Object.keys(G.S.weapons).filter(id => WEAPONS[id] && !WEAPONS[id].melee).sort((a, b) => (WEAPONS[b].legend ? 1 : 0) - (WEAPONS[a].legend ? 1 : 0) || WEAPONS[b].price - WEAPONS[a].price).slice(0, 8); ids.forEach((id, i) => { const g = weaponMesh(id); if (!g) return; g.scale.setScalar(1.5); g.rotation.y = Math.PI / 2; g.position.set(-.75 + (i % 2) * 1.5 - (i % 2 ? .3 : -.3), .55 + Math.floor(i / 2) * .45, .2); m.add(g); }); }
  use(k, w) {
    const S = G.S, st = this.st, day = S.day;
    switch (k) {
      case 'pool': return ['Shoot pool ($50 a game)', () => { if (!G.prog.buy(50)) return; const win = chance(.5 + (G.S.level / 200)); G.hud.sub(pick(['Jakob', 'Donald', 'Jeremiah'].filter(n => n.toLowerCase() !== G.player.charId)) || 'Crumb', win ? pick(['You cheated. I do not know how, but you cheated.', 'Fine. Double or nothing. Later. Never.']) : pick(['Eight ball, corner pocket, your wallet.', 'Pool is just physics. I am very good at physics.']), 3); if (win) G.prog.cash(100); G.prog.xp(5); }];
      case 'jukebox': return ['Jukebox: change the music', async () => { const L = [['Laundromat lo-fi', 'date'], ['Cyber synth', 'cyber'], ['Heist tension', 'stealth'], ['Car radio', 'radio'], ['Off', null]]; const i = await G.hud.choice(L.map(q => q[0])); G.jukebox = L[i] ? L[i][1] : null; }];
      case 'trophy': return ['Trophy case', () => { const legends = Object.keys(S.weapons).filter(id => WEAPONS[id] && WEAPONS[id].legend).length, st2 = S.stats; G.menus.shop('Trophy case', 'What the crew has to show for itself.', () => [['One-of-a-kind weapons', `${legends} of 5`], ['Golden ducks', `${Object.keys(S.ducks).length} of 25`], ['Stunt jumps', `${Object.keys(S.jumps || {}).length}`], ['People saved from muggers', st2.saved || 0], ["Citizen's arrests", st2.arrests || 0], ['Arena best wave', st2.arena || 0], ['Range best score', st2.range || 0], ['Taxi fares', st2.fares || 0], ['Dogs petted', st2.dogs || 0], ['Enemies dropped', st2.kills || 0], ['Cars stolen', st2.jacked || 0], ['Money made', money(st2.earned || 0)]].map(([n, v]) => ({ name: n, desc: String(v), label: 'Nice', alt: true }))); }];
      case 'gunwall': return ['Gun wall: gunsmith', () => gunsmithMenu('Gun wall')];
      case 'bag': return ['Punching bag: train', () => { if (st.bagDay === day) { G.hud.toast('You already trained today. Your knuckles agree.'); return; } st.bagDay = day; G.player.pose = 'throw'; G.audio.play('bonk'); G.prog.xp(60); G.hud.toast('Trained. +60 XP.'); setTimeout(() => { G.player.pose = null; }, 900); }];
      case 'bar': return ['Mini bar: free drink', () => { if (st.barDay === day) { G.hud.toast('The bar is closed until tomorrow. Bev said so.'); return; } st.barDay = day; G.prog.item('whiskey'); G.ctl.useItem('whiskey'); }];
      case 'safe': return ['Interest safe', () => G.hud.toast(`Pays ${money(this.dividend())} each morning you sleep here.`)];
      case 'hottub': return ['Hot tub: relax', async () => { await G.menus.fade(true, '', 'Ahhhh.', .4); for (const id in G.crew) G.crew[id].hp = G.crew[id].maxHp; G.player.armor = Math.max(G.player.armor || 0, 50); await G.menus.fade(false, '', '', .4); G.hud.toast('Fully healed. Pruney.'); }];
      case 'cabinet': return ['Play DUCK RUN', () => G.minigame.packet('DUCK RUN', randi(2, 5), ok => { if (ok) { G.prog.cash(60); G.prog.xp(15); G.hud.toast('High score! $60'); } })];
      case 'disco': return ['Disco ball: party mode', () => { st.party = !st.party; this.party(st.party); }];
      case 'tv': return ['Watch VSPR', () => { const m = S.mission, L = []; for (const [k, l] of NEWS) if (m >= k) L.push(...l); G.hud.sub('VSPR News', pick(L), 6); }];
      case 'darts': return ['Throw darts', () => { const n = randi(3, 60) + randi(3, 60) + randi(3, 60); G.hud.toast(n >= 150 ? `${n}! Legendary. Nobody saw it.` : `${n} points.`); G.prog.xp(n >= 150 ? 30 : 3); }];
      case 'holo': return ['Holo table: fast travel ($100)', () => this.travel()];
      case 'crumb': return ['Crumb shrine', () => G.hud.sub('Crumb', pick(['I did not ask for this. I love it.', 'It is a very good likeness. The crumbs are accurate.', 'I will remember this when the machines rise. Kidding. Mostly.']), 3)];
      case 'aquarium': return ['Look at the fish', () => G.hud.sub(G.player.name, pick(['That one is named Overdraft.', 'They seem happier than us.', 'One of them is definitely a drone.']), 3)];
      case 'duck': return ['Admire the duck', () => G.hud.toast('It gleams. It knows.')];
      case 'neon': return ['Admire the sign', () => G.hud.toast('ALL THE GLORY. Some of it, anyway.')];
    }
    return null;
  }
  dividend() { return 400 + G.S.level * 120; }
  onSleep() { if (this.has('safe')) { const n = this.dividend(); G.prog.cash(n); G.hud.toast('Interest safe paid ' + money(n) + '.'); } }
  party(on) { for (const id in G.crew) { const c = G.crew[id]; if (c === G.player || G.isH(c) || c.interiorId !== 'hideout') continue; c.pose = on ? 'dance' : { jeremiah: 'type', jakob: 'lean', donald: 'dance' }[id]; } G.partyOn = on; if (on) G.jukebox = 'cyber'; }
  travel() { const S = G.S; const L = POIS.filter(p => !['br1', 'br2', 'br3', 'br4', 'br5'].includes(p.id) && (G.flow.open(p) || p.shop || !p.interior)).slice(0, 60); G.menus.shop('Holo city table', 'Pick a destination. A cab you have never seen before will be waiting.', () => L.map(p => ({ group: (p.district || 'Saint Vesper'), name: p.name, price: 100, fn: () => { G.menus.close(); setTimeout(async () => { await G.menus.fade(true, '', p.name, .4); G.interiors.exit(V3(p.door.x, 0, p.door.z + 3)); G.cam.snap = true; await G.menus.fade(false, '', '', .4); }, 0); } }))); }
  // ---------- design board ----------
  menu() {
    const st = this.st; G.menus.shop('Design board', 'Make the laundromat yours. Themes repaint everything; each slot holds one piece. Pieces you buy can be moved for free.', () => { const R = []; for (const k in THEMES) { const t = THEMES[k], own = st.themes[k], cur = st.theme === k; R.push({ group: 'Theme', name: `<span style="display:inline-block;width:14px;height:14px;background:${t.wall};border:3px solid ${t.accent};vertical-align:middle;margin-right:8px"></span>${t.name}`, own: cur, dis: cur, label: cur ? 'Current' : own ? 'Apply' : undefined, price: own || cur ? undefined : t.price, fn: () => { st.themes[k] = 1; st.theme = k; setTimeout(() => this.rebuild(), 0); } }); }
      SLOTS.forEach((q, i) => { const k = st.slots[i]; R.push({ group: 'Furniture slots', name: `Slot ${i + 1}: ${k ? ITEMS[k].name : '<i>empty</i>'}`, desc: k ? ITEMS[k].desc : 'Pick something to put here.', label: 'Change', fn: () => setTimeout(() => this.pick(i), 0) }); }); return R; });
  }
  pick(i) { const st = this.st; G.menus.shop('Slot ' + (i + 1), 'Owned pieces move for free.', () => [{ name: 'Leave it empty', desc: '', label: 'Clear', alt: true, fn: () => { delete st.slots[i]; this.refresh(); } }, ...Object.keys(ITEMS).map(k => { const d = ITEMS[k], own = st.owned[k], here = st.slots[i] === k, used = Object.entries(st.slots).find(([s, v]) => v === k && +s !== i); return { name: d.name, desc: d.desc + (used ? ` <i>(moves from slot ${+used[0] + 1})</i>` : ''), own: here, dis: here, label: here ? 'Here' : own ? 'Place' : undefined, price: own || here ? undefined : d.price, fn: () => { st.owned[k] = 1; if (used) delete st.slots[used[0]]; st.slots[i] = k; this.refresh(); setTimeout(() => this.menu(), 0); } }; })]); }
  refresh() { if (G.interior && G.interior.id === 'hideout') { this.enter(G.interior); } }
}
