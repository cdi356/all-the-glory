import * as THREE from 'three';
export const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
export const clamp = (v, a = 0, b = 1) => v < a ? a : v > b ? b : v;
export const lerp = (a, b, t) => a + (b - a) * t;
export const damp = (a, b, k, dt) => lerp(a, b, 1 - Math.exp(-k * dt));
export const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
export const TAU = Math.PI * 2;
export const wrapA = a => { a = (a + Math.PI) % TAU; if (a < 0) a += TAU; return a - Math.PI; };
export const dampA = (a, b, k, dt) => a + wrapA(b - a) * (1 - Math.exp(-k * dt));
export const turnTo = (a, b, max) => { const d = wrapA(b - a); return a + clamp(d, -max, max); };
export const rand = (a = 1, b) => b === undefined ? Math.random() * a : a + Math.random() * (b - a);
export const randi = (a, b) => Math.floor(rand(a, b + 1));
export const pick = a => a[Math.floor(Math.random() * a.length)];
export const chance = p => Math.random() < p;
export function rng(seed) { // mulberry32
  let s = seed >>> 0;
  const f = () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  f.range = (a, b) => a + f() * (b - a); f.int = (a, b) => Math.floor(f.range(a, b + 1)); f.pick = a => a[Math.floor(f() * a.length)]; f.chance = p => f() < p;
  return f;
}
export const hash = (x, y = 0) => { let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
export const dist2 = (a, b) => { const dx = a.x - b.x, dz = a.z - b.z; return Math.sqrt(dx * dx + dz * dz); };
export const yawTo = (a, b) => Math.atan2(b.x - a.x, b.z - a.z);
export const fwd = (yaw, o = V3()) => o.set(Math.sin(yaw), 0, Math.cos(yaw));
export const money = n => (n < 0 ? '-$' : '$') + Math.abs(Math.round(n)).toLocaleString('en-US');
export const el = (tag, cls, parent, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; if (parent) parent.appendChild(e); return e; };
export const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export function shuffle(a, r = Math.random) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

// ---- geometry builder: merges primitives into one BufferGeometry with custom float attributes ----
export class GeoB {
  constructor(extra = {}) { this.p = []; this.n = []; this.u = []; this.c = []; this.i = []; this.extra = {}; this.sizes = extra; for (const k in extra) this.extra[k] = []; this.cur = {}; for (const k in extra) this.cur[k] = new Array(extra[k]).fill(0); this.col = [1, 1, 1]; }
  color(c, g, b) { if (g !== undefined) this.col = [c, g, b]; else { const k = _c.set(c); this.col = [k.r, k.g, k.b]; } return this; }
  set(k, ...v) { this.cur[k] = v; return this; }
  vert(x, y, z, nx, ny, nz, u = 0, v = 0) {
    this.p.push(x, y, z); this.n.push(nx, ny, nz); this.u.push(u, v); this.c.push(this.col[0], this.col[1], this.col[2]);
    for (const k in this.extra) for (const q of this.cur[k]) this.extra[k].push(q);
    return this.p.length / 3 - 1;
  }
  // quad a,b,c,d counter-clockwise seen from outside
  quad(a, b, c, d, uv = [0, 0, 1, 0, 1, 1, 0, 1], n) {
    if (!n) { _a.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]); _b.set(c[0] - a[0], c[1] - a[1], c[2] - a[2]); if (_a.lengthSq() < 1e-9) _a.set(d[0] - a[0], d[1] - a[1], d[2] - a[2]); else { _d.copy(_a).cross(_b); if (_d.lengthSq() < 1e-10) _b.set(d[0] - a[0], d[1] - a[1], d[2] - a[2]); } _a.cross(_b).normalize(); n = [_a.x, _a.y, _a.z]; }
    const i0 = this.vert(a[0], a[1], a[2], n[0], n[1], n[2], uv[0], uv[1]);
    this.vert(b[0], b[1], b[2], n[0], n[1], n[2], uv[2], uv[3]);
    this.vert(c[0], c[1], c[2], n[0], n[1], n[2], uv[4], uv[5]);
    this.vert(d[0], d[1], d[2], n[0], n[1], n[2], uv[6], uv[7]);
    this.i.push(i0, i0 + 1, i0 + 2, i0, i0 + 2, i0 + 3);
  }
  // axis-aligned box from min to max, uvs in metres
  box(x0, y0, z0, x1, y1, z1, o = {}) {
    const w = x1 - x0, h = y1 - y0, d = z1 - z0, t = o.top, s = !o.noSides;
    if (s) {
      this.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, w, 0, w, h, 0, h], [0, 0, 1]);
      this.quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [0, 0, w, 0, w, h, 0, h], [0, 0, -1]);
      this.quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [0, 0, d, 0, d, h, 0, h], [1, 0, 0]);
      this.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [0, 0, d, 0, d, h, 0, h], [-1, 0, 0]);
    }
    if (!o.noTop) { const sv = t && this.cur[t.k]; if (t) this.cur[t.k] = t.v; this.quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], [0, 0, w, 0, w, d, 0, d], [0, 1, 0]); if (t) this.cur[t.k] = sv; }
    if (o.bottom) this.quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [0, 0, w, 0, w, d, 0, d], [0, -1, 0]);
    return this;
  }
  cbox(x, y, z, w, h, d, o) { return this.box(x - w / 2, y - h / 2, z - d / 2, x + w / 2, y + h / 2, z + d / 2, Object.assign({ bottom: true }, o)); }
  cyl(x, y0, y1, z, r0, r1 = r0, seg = 10, cap = true) {
    for (let i = 0; i < seg; i++) {
      const a = i / seg * TAU, b = (i + 1) / seg * TAU, ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(b), sb = Math.sin(b);
      const k = this.vert(x + ca * r0, y0, z + sa * r0, ca, 0, sa, i / seg * r0 * 6.28, 0);
      this.vert(x + cb * r0, y0, z + sb * r0, cb, 0, sb, (i + 1) / seg * r0 * 6.28, 0);
      this.vert(x + cb * r1, y1, z + sb * r1, cb, 0, sb, (i + 1) / seg * r0 * 6.28, y1 - y0);
      this.vert(x + ca * r1, y1, z + sa * r1, ca, 0, sa, i / seg * r0 * 6.28, y1 - y0);
      this.i.push(k, k + 2, k + 1, k, k + 3, k + 2);
      if (cap && r1 > 0.001) { const q = this.vert(x, y1, z, 0, 1, 0); this.vert(x + cb * r1, y1, z + sb * r1, 0, 1, 0); this.vert(x + ca * r1, y1, z + sa * r1, 0, 1, 0); this.i.push(q, q + 1, q + 2); }
    }
    return this;
  }
  add(geo, m) {
    const base = this.p.length / 3, P = geo.attributes.position, N = geo.attributes.normal, U = geo.attributes.uv, nm = new THREE.Matrix3(); if (m) nm.getNormalMatrix(m);
    for (let i = 0; i < P.count; i++) { _a.fromBufferAttribute(P, i); _b.fromBufferAttribute(N, i); if (m) { _a.applyMatrix4(m); _b.applyMatrix3(nm).normalize(); } this.vert(_a.x, _a.y, _a.z, _b.x, _b.y, _b.z, U ? U.getX(i) : 0, U ? U.getY(i) : 0); }
    if (geo.index) for (let i = 0; i < geo.index.count; i++) this.i.push(base + geo.index.getX(i)); else for (let i = 0; i < P.count; i++) this.i.push(base + i);
    return this;
  }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.u, 2)); g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    for (const k in this.extra) g.setAttribute(k, new THREE.Float32BufferAttribute(this.extra[k], this.sizes[k]));
    g.setIndex(this.p.length / 3 > 65535 ? new THREE.Uint32BufferAttribute(this.i, 1) : new THREE.Uint16BufferAttribute(this.i, 1));
    return g;
  }
  get empty() { return this.p.length === 0; }
}
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _d = new THREE.Vector3(), _c = new THREE.Color();
export const M4 = (x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));
