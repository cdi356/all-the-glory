// Global game context. Every system hangs off G so modules never import each other in circles.
export const G = {
  state: 'boot',          // boot | menu | play | paused
  time: 0, dt: 0, rdt: 0, timeScale: 1,
  actors: [], vehicles: [], drones: [], projectiles: [], pickups: [], interactables: [],
  player: null, crew: {}, S: null, mission: null, interior: null, debug: {}, locks: 0,
};
const L = {};
export const bus = {
  on(e, f) { (L[e] = L[e] || []).push(f); return () => { const i = L[e].indexOf(f); if (i >= 0) L[e].splice(i, 1); }; },
  emit(e, ...a) { const l = L[e]; if (l) for (const f of l.slice()) f(...a); },
};
G.bus = bus;
// ---- who is human? (solo: just G.player; co-op: every split-screen player) ----
G.humans = () => G.coop && G.coop.on ? G.coop.actors() : G.player ? [G.player] : [];
G.isH = a => !!a && (a === G.player || !!(G.coop && G.coop.on && a.isCrew && G.coop.ctxOf(a)));
const vp = a => a.vehicle ? a.vehicle.pos : a.pos;
G.hdist = pos => { let b = 1e9; for (const a of G.humans()) { const q = vp(a), d = Math.hypot(q.x - pos.x, q.z - pos.z); if (d < b) b = d; } return b; };
G.nearH = pos => { let b = null, bd = 1e9; for (const a of G.humans()) { if (!a.alive || a.down > 0) continue; const q = vp(a), d = Math.hypot(q.x - pos.x, q.z - pos.z); if (d < bd) { bd = d; b = a; } } return b || G.player; };
G.anyVeh = v => G.humans().some(a => a.vehicle === v);
G.exitAll = () => { for (const a of G.humans()) if (a.vehicle) a.exitVehicle(); };
const own = (a, k) => { const c = G.coop && G.coop.on && G.coop.ctxOf(a); return (c && c[k]) || G[k]; };
G.modsOf = a => own(a, 'mods'); G.hudOf = a => own(a, 'hud'); G.camOf = a => own(a, 'cam');
// run fn as the player who owns actor; bind() captures the current player for callbacks that fire later
G.as = (a, fn) => G.coop && G.coop.on ? G.coop.run(G.coop.ctxOf(a), fn) : fn();
// is this player busy in a menu? (a joiner's menus live on their own computer)
G.busy = () => { const c = G.coop && G.coop.on && G.coop.cur; return c && c.remote ? c.busy : G.uiOpen; };
G.bind = fn => { const c = G.coop && G.coop.on ? G.coop.cur : null; return c ? (...a) => G.coop.run(c, () => fn(...a)) : fn; };
