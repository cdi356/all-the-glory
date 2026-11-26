import { clamp } from './util.js';
// Static world: AABBs + axis-aligned ramps in a spatial hash, capsule mover and raycasts.
const CELL = 20, K = 4096;
export const STEP = 0.45;
export class Phys {
  constructor() { this.cells = new Map(); this.rcells = new Map(); this.stamp = 1; this.baseGround = () => 0; this.count = 0; }
  key(cx, cz) { return (cx + 2048) * K + (cz + 2048); }
  each(x0, z0, x1, z1, map, f) { const a = Math.floor(x0 / CELL), b = Math.floor(x1 / CELL), c = Math.floor(z0 / CELL), d = Math.floor(z1 / CELL); for (let i = a; i <= b; i++) for (let j = c; j <= d; j++) f(map, this.key(i, j)); }
  addBox(x0, y0, z0, x1, y1, z1, o) {
    const b = Object.assign({ x0, y0, z0, x1, y1, z1, s: 0 }, o); this.count++;
    this.each(x0, z0, x1, z1, this.cells, (m, k) => { let l = m.get(k); if (!l) m.set(k, l = []); l.push(b); });
    return b;
  }
  removeBox(b) { if (!b || b.dead) return; b.dead = true; this.count--; this.each(b.x0, b.z0, b.x1, b.z1, this.cells, (m, k) => { const l = m.get(k); if (l) { const i = l.indexOf(b); if (i >= 0) l.splice(i, 1); } }); }
  // ramp rises from h0 at min side to h1 at max side along axis
  addRamp(x0, z0, x1, z1, axis, h0, h1, o) { const r = Object.assign({ x0, z0, x1, z1, axis, h0, h1, ramp: true }, o); this.each(x0, z0, x1, z1, this.rcells, (m, k) => { let l = m.get(k); if (!l) m.set(k, l = []); l.push(r); }); return r; }
  rampH(r, x, z) { const t = r.axis === 'x' ? (x - r.x0) / (r.x1 - r.x0) : (z - r.z0) / (r.z1 - r.z0); return r.h0 + (r.h1 - r.h0) * clamp(t); }
  ground(x, z, y, step = STEP) {
    let h = this.baseGround(x, z, y), hit = null;
    const k = this.key(Math.floor(x / CELL), Math.floor(z / CELL)), l = this.cells.get(k), max = y + step;
    if (l) for (let i = 0; i < l.length; i++) { const b = l[i]; if (b.y1 > h && b.y1 <= max && x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1 && !b.noWalk) { h = b.y1; hit = b; } }
    const rl = this.rcells.get(k);
    if (rl) for (const r of rl) if (x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1) { const q = this.rampH(r, x, z); if (q > h && q <= max + .35) { h = q; hit = r; } }
    this.gHit = hit; return h;
  }
  near(x0, z0, x1, z1, f) {
    const st = ++this.stamp, a = Math.floor(x0 / CELL), b = Math.floor(x1 / CELL), c = Math.floor(z0 / CELL), d = Math.floor(z1 / CELL);
    for (let i = a; i <= b; i++) for (let j = c; j <= d; j++) { const l = this.cells.get(this.key(i, j)); if (l) for (let n = 0; n < l.length; n++) { const q = l[n]; if (q.s !== st) { q.s = st; f(q); } } }
  }
  // push a vertical cylinder out of boxes. returns true when touched; normal left in hx/hz
  pushOut(pos, r, y0, y1) {
    let touched = false; this.hx = this.hz = 0; this.hBox = null;
    this.near(pos.x - r, pos.z - r, pos.x + r, pos.z + r, b => {
      if (b.y1 <= y0 || b.y0 >= y1 || b.ghost) return;
      const cx = clamp(pos.x, b.x0, b.x1), cz = clamp(pos.z, b.z0, b.z1); const dx = pos.x - cx, dz = pos.z - cz; const d2 = dx * dx + dz * dz;
      if (d2 >= r * r) return;
      if (d2 > 1e-8) { const d = Math.sqrt(d2), k = (r - d) / d; pos.x += dx * k; pos.z += dz * k; this.hx = dx / d; this.hz = dz / d; }
      else { const l = pos.x - b.x0, rr = b.x1 - pos.x, n = pos.z - b.z0, s = b.z1 - pos.z, m = Math.min(l, rr, n, s); if (m === l) { pos.x = b.x0 - r; this.hx = -1; this.hz = 0; } else if (m === rr) { pos.x = b.x1 + r; this.hx = 1; this.hz = 0; } else if (m === n) { pos.z = b.z0 - r; this.hz = -1; this.hx = 0; } else { pos.z = b.z1 + r; this.hz = 1; this.hx = 0; } }
      touched = true; this.hBox = b;
    });
    return touched;
  }
  // moves a capsule. e: {pos, vel, radius, height, onGround}
  move(e, dt) {
    const p = e.pos, v = e.vel, dx = v.x * dt, dz = v.z * dt, len = Math.hypot(dx, dz), n = Math.min(8, Math.max(1, Math.ceil(len / (e.radius * .8))));
    e.wall = false;
    for (let i = 0; i < n; i++) {
      p.x += dx / n; p.z += dz / n;
      if (this.pushOut(p, e.radius, p.y + STEP, p.y + e.height)) { e.wall = true; e.wallNx = this.hx; e.wallNz = this.hz; this.pushOut(p, e.radius, p.y + STEP, p.y + e.height); }
    }
    const wasG = e.onGround; const py = p.y; p.y += v.y * dt;
    if (v.y > 0) { const top = p.y + e.height; this.near(p.x - .1, p.z - .1, p.x + .1, p.z + .1, b => { if (b.ghost) return; if (p.x > b.x0 && p.x < b.x1 && p.z > b.z0 && p.z < b.z1 && b.y0 < top && b.y0 > p.y + e.height * .5) { p.y = Math.max(py, b.y0 - e.height - .01); v.y = 0; } }); }
    const g = this.ground(p.x, p.z, py, wasG ? STEP : .25); e.groundH = g; e.gHit = this.gHit;
    if (p.y <= g + .001 || (wasG && v.y <= 0 && p.y - g < .5)) { if (!wasG && v.y < -3) e.landV = -v.y; p.y = g; v.y = 0; e.onGround = true; } else e.onGround = false;
  }
  // segment ray. returns {t, box, nx,ny,nz} or null
  ray(ox, oy, oz, dx, dy, dz, max, filter) {
    let best = max, hit = null, axis = 0, sgn = 0; const st = ++this.stamp;
    const ix = dx === 0 ? 1e9 : 1 / dx, iy = dy === 0 ? 1e9 : 1 / dy, iz = dz === 0 ? 1e9 : 1 / dz;
    let cx = Math.floor(ox / CELL), cz = Math.floor(oz / CELL); const sx = dx > 0 ? 1 : -1, sz = dz > 0 ? 1 : -1;
    let tx = dx === 0 ? 1e9 : ((cx + (dx > 0 ? 1 : 0)) * CELL - ox) * ix, tz = dz === 0 ? 1e9 : ((cz + (dz > 0 ? 1 : 0)) * CELL - oz) * iz; const dtx = Math.abs(CELL * ix), dtz = Math.abs(CELL * iz);
    for (let n = 0; n < 200; n++) {
      const l = this.cells.get(this.key(cx, cz));
      if (l) for (let i = 0; i < l.length; i++) {
        const b = l[i]; if (b.s === st) continue; b.s = st; if (filter ? !filter(b) : b.noShot) continue;
        let t0 = (b.x0 - ox) * ix, t1 = (b.x1 - ox) * ix, ax = 0; if (t0 > t1) { const q = t0; t0 = t1; t1 = q; }
        let u0 = (b.y0 - oy) * iy, u1 = (b.y1 - oy) * iy; if (u0 > u1) { const q = u0; u0 = u1; u1 = q; } if (u0 > t0) { t0 = u0; ax = 1; } if (u1 < t1) t1 = u1; if (t0 > t1) continue;
        let w0 = (b.z0 - oz) * iz, w1 = (b.z1 - oz) * iz; if (w0 > w1) { const q = w0; w0 = w1; w1 = q; } if (w0 > t0) { t0 = w0; ax = 2; } if (w1 < t1) t1 = w1; if (t0 > t1 || t1 < 0 || t0 < 0) continue;
        if (t0 < best) { best = t0; hit = b; axis = ax; sgn = ax === 0 ? -Math.sign(dx) : ax === 1 ? -Math.sign(dy) : -Math.sign(dz); }
      }
      if (Math.min(tx, tz) > best) break;
      if (tx < tz) { cx += sx; tx += dtx; } else { cz += sz; tz += dtz; }
    }
    let gt = null;
    if (dy < 0) { const t = this.groundRay(ox, oy, oz, dx, dy, dz, best); if (t !== null && t < best) { best = t; gt = true; hit = null; } }
    if (gt) return { t: best, box: null, nx: 0, ny: 1, nz: 0, ground: true };
    return hit ? { t: best, box: hit, nx: axis === 0 ? sgn : 0, ny: axis === 1 ? sgn : 0, nz: axis === 2 ? sgn : 0 } : null;
  }
  groundRay(ox, oy, oz, dx, dy, dz, max) {
    let t = (0.0 - oy) / dy; for (let i = 0; i < 3; i++) { if (t < 0 || t > max + 60) return null; const h = this.baseGround(ox + dx * t, oz + dz * t, 0); t = (h - oy) / dy; }
    return t >= 0 && t < max ? t : null;
  }
  // line of sight between two feet positions
  clear(a, b, ya = 1.4, yb = 1.4) { const dx = b.x - a.x, dy = (b.y + yb) - (a.y + ya), dz = b.z - a.z, d = Math.sqrt(dx * dx + dy * dy + dz * dz); if (d < .01) return true; const h = this.ray(a.x, a.y + ya, a.z, dx / d, dy / d, dz / d, d, c => !c.noSight && !c.noShot); return !h; }
}
