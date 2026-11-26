import { G } from './g.js';
// Keyboard / mouse / gamepads. Systems read `down(action)` and `hit(action)`; in co-op each player reads
// through its own device (`input.dev`). dev === null is solo mode: keyboard, mouse and first pad together.
export const BINDS = {
  fwd: ['KeyW', 'ArrowUp'], back: ['KeyS', 'ArrowDown'], left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'],
  sprint: ['ShiftLeft', 'ShiftRight'], jump: ['Space'], crouch: ['KeyC', 'ControlLeft'], reload: ['KeyR'], interact: ['KeyE'], vehicle: ['KeyF'],
  scan: ['KeyQ'], throw: ['KeyG'], ability: ['KeyT'], heal: ['KeyH'], wheel: ['Tab'], swap: ['KeyZ'], phone: ['KeyP'], map: ['KeyM'], inventory: ['KeyI'],
  camera: ['KeyV'], radio: ['KeyX'], horn: ['KeyB'], melee: ['KeyN'], pause: ['Escape'], journal: ['KeyJ'], skip: ['Enter'], nextw: [],
  photo: ['KeyO'], n1: ['Digit1'], n2: ['Digit2'], n3: ['Digit3'], n4: ['Digit4'], n5: ['Digit5'], n6: ['Digit6'], n7: ['Digit7'], n8: ['Digit8'], n9: ['Digit9'],
};
// In co-op the main keyboard player gives up the arrows and right-hand keys to the second keyboard player.
const KB1 = Object.assign({}, BINDS, { fwd: ['KeyW'], back: ['KeyS'], left: ['KeyA'], right: ['KeyD'], sprint: ['ShiftLeft'] });
const KB2 = { fwd: ['ArrowUp'], back: ['ArrowDown'], left: ['ArrowLeft'], right: ['ArrowRight'], sprint: ['ShiftRight'], jump: ['ControlRight'], interact: ['NumpadEnter'], fire: ['Numpad0'], aim: ['NumpadDecimal'], vehicle: ['Numpad7'], reload: ['Numpad9'], crouch: ['Numpad1'], ability: ['Numpad3'], nextw: ['NumpadAdd'], heal: ['NumpadSubtract'], throw: ['NumpadMultiply'], scan: ['NumpadDivide'], swap: ['PageUp'], radio: ['PageDown'], camera: ['Home'], horn: ['End'], melee: ['Delete'], lookL: ['Numpad4'], lookR: ['Numpad6'], lookU: ['Numpad8'], lookD: ['Numpad5', 'Numpad2'], skip: ['NumpadEnter'] };
// standard mapping: A0 B1 X2 Y3 LB4 RB5 LT6 RT7 back8 start9 L3-10 R3-11 up12 down13 left14 right15
const PAD = { jump: 0, crouch: 1, interact: 2, reload: 2, vehicle: 3, wheel: 4, throw: 5, swap: 8, pause: 9, sprint: 10, melee: 11, scan: 12, heal: 13, ability: 14, nextw: 15, skip: 0, radio: 13, horn: 10, camera: 11 };
const PAD_CAR_ONLY = new Set(['radio', 'horn', 'camera']);
export const KB2_HELP = [['Move / drive', 'Arrow keys'], ['Look', 'Numpad 4 6 8 5'], ['Shoot', 'Numpad 0'], ['Aim', 'Numpad .'], ['Sprint / nitro', 'Right Shift'], ['Jump / handbrake', 'Right Ctrl'], ['Interact', 'Numpad Enter'], ['Vehicle', 'Numpad 7'], ['Reload', 'Numpad 9'], ['Crouch', 'Numpad 1'], ['Ability', 'Numpad 3'], ['Next weapon', 'Numpad +'], ['Heal', 'Numpad -'], ['Throw', 'Numpad *'], ['Scan', 'Numpad /'], ['Switch character', 'Page Up']];
export const PAD_HELP = [['Move', 'Left stick'], ['Look', 'Right stick'], ['Aim / shoot', 'LT / RT'], ['In a car: gas / brake', 'RT / LT'], ['In a car: shoot', 'RB'], ['Jump, handbrake, climb', 'A'], ['Crouch, nitro, descend', 'B'], ['Interact, reload', 'X'], ['Enter or exit vehicle', 'Y'], ['Weapon wheel', 'LB (hold) + right stick'], ['Throw', 'RB'], ['Sprint', 'L3'], ['Quick melee', 'R3'], ['Scan', 'D-pad up'], ['Heal (radio in a car)', 'D-pad down'], ['Ability', 'D-pad left'], ['Next weapon', 'D-pad right'], ['Switch character', 'Back'], ['Pause / join', 'Start']];
const EDITABLE = e => e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName);
class Input {
  constructor() { this.k = {}; this.h = {}; this.mouse = { dx: 0, dy: 0, l: false, r: false, lh: false, rh: false, wheel: 0 }; this.locked = false; this.sens = 1; this.invert = false; this.uiMode = false; this.pads = []; this.prev = {}; this.vk = {}; this.dev = null; this.inCar = false; this.rep = {}; }
  init(canvas) {
    this.canvas = canvas;
    addEventListener('keydown', e => {
      if (EDITABLE(e)) return;
      if (['Tab', 'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'F1', 'PageUp', 'PageDown', 'Home', 'End'].includes(e.code) || (G.state === 'play' && e.code.startsWith('Numpad'))) e.preventDefault();
      if (this.locked && e.ctrlKey && !e.code.startsWith('Control')) e.preventDefault();
      if (!this.k[e.code]) this.h[e.code] = true; this.k[e.code] = true;
      G.bus.emit('key', e.code, e);
    });
    addEventListener('keyup', e => { this.k[e.code] = false; });
    addEventListener('blur', () => { this.k = {}; this.mouse.l = this.mouse.r = false; });
    document.addEventListener('mousemove', e => { if (this.locked) { if (Math.abs(e.movementX) < 400 && Math.abs(e.movementY) < 400) { this.mouse.dx += e.movementX; this.mouse.dy += e.movementY; } } });
    document.addEventListener('mousedown', e => { if (!this.locked) return; if (e.button === 0) { this.mouse.l = true; this.mouse.lh = true; } if (e.button === 2) { this.mouse.r = true; this.mouse.rh = true; } });
    document.addEventListener('mouseup', e => { if (e.button === 0) this.mouse.l = false; if (e.button === 2) this.mouse.r = false; });
    document.addEventListener('contextmenu', e => e.preventDefault());
    document.addEventListener('wheel', e => { if (this.locked) this.mouse.wheel += Math.sign(e.deltaY); }, { passive: true });
    document.addEventListener('pointerlockchange', () => {
      const was = this.locked; this.locked = document.pointerLockElement === canvas;
      if (was && !this.locked) { this.mouse.l = this.mouse.r = false; if (!this.uiMode) G.bus.emit('lockLost'); }
    });
    canvas.addEventListener('click', () => { if (!this.uiMode && G.state === 'play') this.lock(); });
  }
  lock() { if (this.locked || G.debug.auto || (G.coop && G.coop.on && !G.coop.hasKbm())) return; try { const p = this.canvas.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (e) { /* not allowed yet */ } }
  unlock() { if (document.exitPointerLock) document.exitPointerLock(); }
  // ---- device plumbing ----
  get kind() { return this.dev ? this.dev.kind : 'solo'; }
  get usesKb() { const k = this.kind; return k === 'solo' || k === 'kbm'; }
  binds(a) { const k = this.kind; return (k === 'kb2' ? KB2[a] : k === 'kbm' ? KB1[a] : k === 'pad' ? null : BINDS[a]) || []; }
  get pad() { const k = this.kind; if (k === 'solo') return this.pads.find(Boolean) || null; return k === 'pad' ? this.pads[this.dev.index] || null : null; }
  // automated tests can drive one device without touching the others
  get v() { return this.dev && this.dev.vk ? this.dev.vk : this.usesKb ? this.vk : EMPTY; }
  padBtn(a) { if (this.inCar) { if (a === 'sprint') return 1; if (a === 'throw' || a === 'heal' || a === 'melee') return -1; } else if (PAD_CAR_ONLY.has(a)) return -1; return PAD[a] === undefined ? -1 : PAD[a]; }
  axis(i) { const p = this.pad; if (!p) return 0; const v = p.axes[i] || 0; return Math.abs(v) < .16 ? 0 : (v - Math.sign(v) * .16) / .84; }
  btn(i) { const p = this.pad; return !!(p && i >= 0 && p.buttons[i] && (p.buttons[i].pressed || p.buttons[i].value > .35)); }
  padHit(i) { const p = this.pad; return !!(p && i >= 0 && this.btn(i) && !(this.prev[p.index] || [])[i]); }
  down(a) { if (this.v[a]) return true; for (const c of this.binds(a)) if (this.k[c]) return true; return this.btn(this.padBtn(a)); }
  hit(a) { if (this.v[a] === 'hit') return true; for (const c of this.binds(a)) if (this.h[c]) return true; return this.padHit(this.padBtn(a)) && !this.eaten(a); }
  eaten(a) { const p = this.pad; return !!(p && this.ate && this.ate[p.index + ':' + PAD[a]]); }
  consume(a) { for (const c of this.binds(a)) this.h[c] = false; if (this.v[a] === 'hit') delete this.v[a]; const p = this.pad; if (p && PAD[a] !== undefined) (this.ate = this.ate || {})[p.index + ':' + PAD[a]] = 1; }
  anyHit(a) { const d = this.dev, c = this.inCar; this.inCar = false; let r = false; const L = G.coop && G.coop.on ? G.coop.ctxs.map(x => x.dev) : [null]; for (const x of L) { this.dev = x; if (this.hit(a)) { r = true; this.consume(a); } } this.dev = d; this.inCar = c; return r; }
  get fire() { return (this.usesKb && this.mouse.l && this.locked) || !!this.v.fire || (this.kind === 'kb2' && this.down('fire')) || this.btn(this.inCar ? 5 : 7); }
  get aim() { return (this.usesKb && this.mouse.r && this.locked) || !!this.v.aim || (this.kind === 'kb2' && this.down('aim')) || (!this.inCar && this.btn(6)); }
  get fireHit() { return (this.usesKb && this.mouse.lh && this.locked) || this.v.fire === 'hit' || (this.kind === 'kb2' && this.hit('fire')) || this.padHit(this.inCar ? 5 : 7); }
  get wheel() { if (this.kind === 'net') return this.dev.wheel; return this.usesKb ? this.mouse.wheel : 0; }
  eatWheel() { if (this.kind === 'net') this.dev.wheel = 0; if (this.usesKb) this.mouse.wheel = 0; }
  get assisted() { return this.kind === 'kb2' || (this.kind === 'pad') || (this.kind === 'solo' && !this.locked && !!this.pad); }
  poll() { const ps = navigator.getGamepads ? navigator.getGamepads() : []; this.pads = []; for (const p of ps) if (p && p.connected && p.buttons.length > 8) this.pads[p.index] = p; for (const f of this.fakePads || []) this.pads[f.index] = f; }
  moveX() { if (this.kind === 'net') return this.dev.mx; return (this.down('right') ? 1 : 0) - (this.down('left') ? 1 : 0) || this.axis(0); }
  moveY() { if (this.kind === 'net') return this.dev.my; return (this.down('fwd') ? 1 : 0) - (this.down('back') ? 1 : 0) || -this.axis(1); }
  // throttle: pads use the triggers, everything else forward/back
  throttle() { if (this.kind === 'net') return this.dev.thr; const p = this.pad; const kb = (this.down('fwd') ? 1 : 0) - (this.down('back') ? 1 : 0); if (kb || !p) return kb; const g = p.buttons[7] ? p.buttons[7].value || (p.buttons[7].pressed ? 1 : 0) : 0, b = p.buttons[6] ? p.buttons[6].value || (p.buttons[6].pressed ? 1 : 0) : 0; return g - b; }
  look(dt) {
    if (this.kind === 'net') return [0, 0];
    if (this.kind === 'kb2') { const s = 2.1 * dt; return [((this.down('lookR') ? 1 : 0) - (this.down('lookL') ? 1 : 0)) * s, ((this.down('lookD') ? 1 : 0) - (this.down('lookU') ? 1 : 0)) * s * .7]; }
    const s = .0022 * this.sens, m = this.mouse, kb = this.usesKb, x = this.axis(2), y = this.axis(3); return [(kb ? m.dx * s : 0) + x * Math.abs(x) * 3.1 * dt, ((kb ? m.dy * s : 0) + y * Math.abs(y) * 2.1 * dt) * (this.invert ? -1 : 1)];
  }
  wheelVec() { if (this.usesKb && (this.mouse.dx || this.mouse.dy)) { const r = [this.mouse.dx, this.mouse.dy, false]; this.mouse.dx = this.mouse.dy = 0; return r; } if (this.kind === 'kb2') { const x = (this.down('lookR') ? 1 : 0) - (this.down('lookL') ? 1 : 0), y = (this.down('lookD') ? 1 : 0) - (this.down('lookU') ? 1 : 0); return x || y ? [x * 60, y * 60, true] : [0, 0, false]; } const x = this.axis(2), y = this.axis(3); return Math.hypot(x, y) > .3 ? [x * 90, y * 90, true] : [0, 0, false]; }
  // controller navigation for menus, dialogue choices and minigames
  uiPads(dt) {
    for (const p of this.pads) { if (!p) continue; const prev = this.prev[p.index] || []; const on = i => p.buttons[i] && p.buttons[i].pressed, edge = i => on(i) && !prev[i]; const ax = p.axes[0] || 0, ay = p.axes[1] || 0; const dir = on(12) || ay < -.6 ? 'U' : on(13) || ay > .6 ? 'D' : on(14) || ax < -.6 ? 'L' : on(15) || ax > .6 ? 'R' : ''; const r = this.rep[p.index] = this.rep[p.index] || { d: '', t: 0 }; let fire = ''; if (dir && dir !== r.d) { fire = dir; r.t = .38; } else if (dir) { r.t -= dt; if (r.t <= 0) { fire = dir; r.t = .11; } } r.d = dir; if (fire) G.bus.emit('uipad', fire, p.index); if (edge(0)) G.bus.emit('uipad', 'A', p.index); if (edge(1)) G.bus.emit('uipad', 'B', p.index); if (edge(2)) G.bus.emit('uipad', 'X', p.index); if (edge(4)) G.bus.emit('uipad', 'LB', p.index); if (edge(5)) G.bus.emit('uipad', 'RB', p.index); if (edge(9)) G.bus.emit('uipad', 'START', p.index); if (edge(8)) G.bus.emit('uipad', 'BACK', p.index); }
  }
  end() { this.h = {}; this.ate = null; const m = this.mouse; m.dx = m.dy = m.wheel = 0; m.lh = m.rh = false; for (const p of this.pads) if (p) this.prev[p.index] = p.buttons.map(b => b.pressed || b.value > .35); const clr = v => { for (const k in v) if (v[k] === 'hit') delete v[k]; }; clr(this.vk); if (G.coop) for (const c of G.coop.ctxs) if (c.dev && c.dev.vk) clr(c.dev.vk); }
}
const EMPTY = {};
export const input = new Input(); G.input = input;
