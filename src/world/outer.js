// The land beyond Saint Vesper: the north mainland (Fort Fortis military base, the northern scrub and the
// Halfmoon Ridge nature reserve with its canyon and suspension bridge) and the Dry Margin desert to the south-west.
// Heights live in a 5 m grid so physics ground lookups stay cheap; roads are flattened into it.
import * as THREE from 'three';
import { G } from '../core/g.js';
import { GeoB, rng, hash, M4, clamp, V3, TAU } from '../core/util.js';
import { WATER_Y } from './citydata.js';
import { U } from './city.js';

export const WR = 2400, STEP = 5, GN = WR * 2 / STEP;
const sst = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const vn = (x, z) => { const i = Math.floor(x), j = Math.floor(z), f = x - i, g = z - j, u = f * f * (3 - 2 * f), v = g * g * (3 - 2 * g); const a = hash(i, j), b = hash(i + 1, j), c = hash(i, j + 1), d = hash(i + 1, j + 1); return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; };
const fbm = (x, z) => vn(x, z) * .55 + vn(x * 2.1 + 7, z * 2.1 + 3) * .28 + vn(x * 4.3 + 3, z * 4.3 + 11) * .17;
// ---- layout ----
export const coastN = x => -1000 + 45 * Math.sin(x * .0035) + 20 * Math.sin(x * .013 + 1);
const coastDx = z => -1000 + 40 * Math.sin(z * .004), coastDz = x => 200 + 40 * Math.sin(x * .005);
export const canyonX = z => 1560 + 70 * Math.sin(z * .0042);
export const BASE = { x0: -420, x1: 420, z0: -1900, z1: -1430, y: 3, gate: 0 };
export const LAKE = { x: -1650, z: 1350, r: 300 };
export const SPOTS = {
  gate: [0, -1418], hq: [210, -1530], hangar: [0, -1730], heli: [330, -1505], barracks: [-250, -1530], runway: [0, -1845],
  motel: [-1300, 585], bunker: [-1905, 1975], ufo: [-1120, 1905], lake: [LAKE.x, LAKE.z], solar: [-1440, 1080], duck: [-2120, 880],
  ranger: [1965, -2095], lookout: [2210, -1300], camp: [1820, -1980], bigfoot: [2140, -2230], bridge: [canyonX(-1450), -1450], drivein: [-1960, -1450], trailer: [-1450, -1330], quarry: [-760, -1650],
};
const landN = (x, z) => sst(coastN(x) + 30, coastN(x) - 70, z);
const landD = (x, z) => sst(coastDx(z) + 30, coastDx(z) - 70, x) * sst(coastDz(x) - 30, coastDz(x) + 70, z);
export const reserveW = x => sst(450, 1100, x);
function rawH(x, z) {
  const n = landN(x, z), d = landD(x, z); if (n <= 0 && d <= 0) return -7; let h = -7;
  if (n > 0) {
    let hn = 3 + 9 * fbm(x * .004 + 11, z * .004 + 3); const rw = reserveW(x);
    if (rw > 0) { const hills = 24 + 46 * fbm(x * .0028 + 5, z * .0028 + 9) + 12 * Math.abs(Math.sin(x * .006 + z * .004)); hn += (hills - hn) * rw; }
    hn += sst(-1300, -2300, z) * 16 * fbm(x * .002, z * .002) * (1 - rw);
    const qd = Math.hypot(x - SPOTS.quarry[0], z - SPOTS.quarry[1]); hn -= 14 * sst(110, 60, qd); // old quarry pit
    const bx = Math.max(BASE.x0 - x, 0, x - BASE.x1), bz = Math.max(BASE.z0 - z, 0, z - BASE.z1); hn += (BASE.y - hn) * sst(70, 0, Math.hypot(bx, bz));
    if (rw > 0) { const cd = Math.abs(x - canyonX(z)), c = sst(150, 52, cd); if (c > 0) { const fl = -9 + 1.5 * vn(z * .05, 1); hn += (fl - hn) * c * Math.min(1, rw * 1.6); } }
    h = -7 + (hn + 7) * n;
  }
  if (d > 0) {
    let hd = 2 + 3 * fbm(x * .01 + 4, z * .01 + 7); const dune = Math.abs(Math.sin(x * .018 + z * .007 + 4 * fbm(x * .003, z * .003))); hd += dune * dune * 6 * fbm(x * .006 + 2, z * .006);
    const m = fbm(x * .0024 + 31, z * .0024 + 17); hd += 38 * sst(.6, .655, m) + 6 * sst(.655, .75, m);
    hd += (1.2 - hd) * sst(LAKE.r + 120, LAKE.r, Math.hypot(x - LAKE.x, z - LAKE.z));
    for (const k of ['motel', 'bunker', 'solar', 'ufo']) { const q = SPOTS[k], r = k === 'solar' ? 130 : 60; hd += (3 - hd) * sst(r + 50, r, Math.hypot(x - q[0], z - q[1])); }
    h = Math.max(h, -7 + (hd + 7) * d);
  }
  for (const k of ['ranger', 'camp', 'drivein', 'trailer']) { const q = SPOTS[k], dd = Math.hypot(x - q[0], z - q[1]); if (dd < 140) { const t = rawFlat[k] ?? (rawFlat[k] = 0); h += (t - h) * sst(110, 55, dd) * (t ? 1 : 0); } }
  return h;
}
const rawFlat = {};
// biome for colours, grip and dust: 0 sea, 1 scrub, 2 forest, 3 desert, 4 base, 5 rock
export function biome(x, z, h) {
  if (h === undefined) h = height(x, z); if (h < WATER_Y - .3) return 0; const bx = x > BASE.x0 - 10 && x < BASE.x1 + 10 && z > BASE.z0 - 10 && z < BASE.z1 + 10; if (bx) return 4;
  if (landD(x, z) > .5) return h > 14 ? 5 : 3; const rw = reserveW(x); if (rw > .5) return Math.abs(x - canyonX(z)) < 150 && h < 30 ? 5 : 2; return 1;
}
// ---- roads (bridges flagged per segment) ----
export const ROADS = [
  { id: 'north', name: 'Fortis Causeway', pts: [[-55, -736], [-55, -1075], [-55, -1180], [-55, -1300], [-55, -1418]], br: { 0: 4.2 } },
  { id: 'ridge', name: 'Ridge Road', pts: [[-55, -1180], [300, -1185], [700, -1235], [1000, -1330], [1250, -1430], [1403, -1450], [1743, -1450], [1900, -1455], [2080, -1600], [2150, -1850], [2000, -2050]], br: { 5: 'canyon' } },
  { id: 'scrub', name: 'Old Scrub Highway', pts: [[-55, -1180], [-500, -1185], [-1000, -1260], [-1450, -1255], [-1900, -1380]] },
  { id: 'desert', name: 'Dry Margin Causeway', pts: [[-736, 495], [-1075, 495], [-1300, 525], [-1500, 700], [-1640, 950], [-1680, 1250], [-1600, 1650], [-1800, 1905]], br: { 0: 4.2 } },
  { id: 'ufo', name: 'Route 51-ish', pts: [[-1680, 1250], [-1300, 1500], [-1150, 1820]] },
];
export const HW = 6.5;
let grid = null; export let deckY = 40;
export function height(x, z) {
  const fx = (x + WR) / STEP, fz = (z + WR) / STEP; if (!grid || fx < 0 || fz < 0 || fx >= GN || fz >= GN) return -7; const i = fx | 0, j = fz | 0, u = fx - i, v = fz - j, W = GN + 1, a = grid[j * W + i], b = grid[j * W + i + 1], c = grid[(j + 1) * W + i], d = grid[(j + 1) * W + i + 1];
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function buildGrid() {
  const W = GN + 1; grid = new Float32Array(W * W); for (const k of ['ranger', 'camp', 'drivein', 'trailer']) { const q = SPOTS[k]; rawFlat[k] = 0; rawFlat[k] = Math.max(1, rawH(q[0], q[1])); }
  for (let j = 0; j < W; j++) { const z = -WR + j * STEP; for (let i = 0; i < W; i++) grid[j * W + i] = rawH(-WR + i * STEP, z); }
  // canyon bridge deck sits above both rims
  const cz = -1450, cx = canyonX(cz); deckY = Math.max(height(cx - 175, cz), height(cx + 175, cz)) + 2;
  // road height profiles: smooth the terrain under each road, limit the grade, then flatten the terrain to match
  const junc = new Map(), best = new Float32Array(W * W).fill(1e9), tgt = new Float32Array(W * W);
  for (const r of ROADS) {
    const S = []; let s = 0; for (let k = 0; k < r.pts.length - 1; k++) { const [x0, z0] = r.pts[k], [x1, z1] = r.pts[k + 1], L = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.round(L / 5)), b = r.br && r.br[k]; for (let q = 0; q < n; q++) { const t = q / n; S.push({ x: x0 + (x1 - x0) * t, z: z0 + (z1 - z0) * t, s: s + L * t, br: b, k }); } s += L; }
    const last = r.pts[r.pts.length - 1]; S.push({ x: last[0], z: last[1], s, k: r.pts.length - 1 });
    for (const p of S) p.raw = height(p.x, p.z);
    for (let i = 0; i < S.length; i++) { const p = S[i]; if (p.br) { p.y = p.br === 'canyon' ? deckY : p.br; p.fix = true; continue; } let a = 0, n = 0; for (let q = Math.max(0, i - 8); q <= Math.min(S.length - 1, i + 8); q++) if (!S[q].br) { a += S[q].raw; n++; } p.y = Math.max(.6, a / n); }
    for (let i = 0; i < S.length; i++) { const p = S[i]; const key = Math.round(p.x) + ',' + Math.round(p.z); if (r.pts.some(q => q[0] === Math.round(p.x) && q[1] === Math.round(p.z)) && junc.has(key)) { p.y = junc.get(key); p.fix = true; } }
    // bridge ends fix their neighbours
    for (let i = 1; i < S.length; i++) if (S[i - 1].br && !S[i].br) { S[i].y = S[i - 1].y; S[i].fix = true; } else if (!S[i - 1].br && S[i].br) { S[i - 1].y = S[i].y; S[i - 1].fix = true; }
    const g = .1; for (let it = 0; it < 40; it++) { for (let i = 1; i < S.length; i++) if (!S[i].fix) S[i].y = clamp(S[i].y, S[i - 1].y - g * 5, S[i - 1].y + g * 5); for (let i = S.length - 2; i >= 0; i--) if (!S[i].fix) S[i].y = clamp(S[i].y, S[i + 1].y - g * 5, S[i + 1].y + g * 5); }
    for (const p of S) { const key = Math.round(p.x) + ',' + Math.round(p.z); if (r.pts.some(q => q[0] === Math.round(p.x) && q[1] === Math.round(p.z)) && !junc.has(key)) junc.set(key, p.y); }
    r.S = S; r.len = s; S.forEach((p, i) => { const k = rk(Math.floor(p.x / RC), Math.floor(p.z / RC)); if (!RH.has(k)) RH.set(k, []); RH.get(k).push({ r, i }); });
    for (const p of S) { if (p.br) continue; const R = HW + 15, i0 = Math.floor((p.x - R + WR) / STEP), i1 = Math.ceil((p.x + R + WR) / STEP), j0 = Math.floor((p.z - R + WR) / STEP), j1 = Math.ceil((p.z + R + WR) / STEP); for (let j = Math.max(0, j0); j <= Math.min(GN, j1); j++) for (let i = Math.max(0, i0); i <= Math.min(GN, i1); i++) { const d = Math.hypot(-WR + i * STEP - p.x, -WR + j * STEP - p.z); const k = j * W + i; if (d < best[k]) { best[k] = d; tgt[k] = p.y; } } }
  }
  for (let k = 0; k < W * W; k++) if (best[k] < HW + 15) { const t = sst(HW + 1, HW + 15, best[k]); grid[k] = tgt[k] - .04 + (grid[k] - tgt[k] + .04) * t; }
}
// nearest road point (for GPS, traffic and grip)
const RH = new Map(), RC = 40, rk = (i, j) => (i + 200) * 1000 + j + 200;
export function nearRoad(x, z, max = 30) { let b = null, bd = max; const i0 = Math.floor((x - max) / RC), i1 = Math.floor((x + max) / RC), j0 = Math.floor((z - max) / RC), j1 = Math.floor((z + max) / RC); for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) { const L = RH.get(rk(i, j)); if (L) for (const q of L) { const p = q.r.S[q.i], e = Math.hypot(p.x - x, p.z - z); if (e < bd) { bd = e; b = { r: q.r, i: q.i, p, d: e }; } } } return b; }
export const outside = (x, z) => Math.max(Math.abs(x), Math.abs(z)) > 760 && x < 3500;

// ---- materials ----
function terrainMat() {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .95, metalness: 0 });
  m.onBeforeCompile = s => {
    Object.assign(s.uniforms, { uWet: U.uWet });
    s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP; varying vec3 vWN;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvWP=(modelMatrix*vec4(position,1.)).xyz; vWN=normal;');
    s.fragmentShader = s.fragmentShader.replace('#include <common>', `#include <common>\nvarying vec3 vWP; varying vec3 vWN; uniform float uWet;
      float h21(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
      float vn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h21(i),h21(i+vec2(1,0)),f.x),mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x),f.y);}
      float fbm(vec2 p){return vn(p)*.55+vn(p*2.1+7.)*.28+vn(p*4.3+3.)*.17;}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
      { vec3 c=diffuseColor.rgb; float sl=1.-clamp(vWN.y,0.,1.); float n=fbm(vWP.xz*.08), n2=vn(vWP.xz*1.3);
        c*=.8+.35*n; c*=.9+.18*n2; vec3 rock=vec3(.34,.27,.21)*(.75+.4*fbm(vWP.xz*.05+vWP.y*.08)); float strata=.5+.5*sin(vWP.y*1.3+n*3.); rock*=.85+.25*strata;
        c=mix(c,rock,smoothstep(.28,.5,sl)); float wl=smoothstep(.4,-1.6,vWP.y); c=mix(c,vec3(.36,.32,.24),wl*.7);
        c*=1.-uWet*.25; diffuseColor.rgb=c; }`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor=mix(.96,.5,uWet*.6);');
  };
  return m;
}
function roadMat() {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .9, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  m.onBeforeCompile = s => {
    Object.assign(s.uniforms, { uWet: U.uWet });
    s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vR; varying vec3 vWP;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvR=uv; vWP=(modelMatrix*vec4(position,1.)).xyz;');
    s.fragmentShader = s.fragmentShader.replace('#include <common>', `#include <common>\nvarying vec2 vR; varying vec3 vWP; uniform float uWet;
      float h21(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
      float vn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h21(i),h21(i+vec2(1,0)),f.x),mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x),f.y);}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
      { float u=vR.x, v=vR.y; vec3 c=vec3(.085,.087,.092)*(.8+.4*vn(vWP.xz*.5))*(.9+.2*vn(vWP.xz*6.)); float fw=fwidth(u)*1.5;
        float ctr=step(.5,fract(v/8.))*(1.-smoothstep(.012-fw,.012+fw,abs(u-.5))); float ed=1.-smoothstep(.015-fw,.015+fw,abs(abs(u-.5)-.44));
        float sh=smoothstep(.47,.5,abs(u-.5)); c=mix(c,vec3(.62,.44,.08),ctr*.85); c=mix(c,vec3(.6),ed*.7); c=mix(c,vec3(.25,.22,.18),sh);
        c*=1.-uWet*.35; diffuseColor.rgb=c; }`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor=mix(.88,.15,uWet);');
  };
  return m;
}
function textPlane(text, color, w, h, bg = '#000', add = true) {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 160; const x = c.getContext('2d'); x.fillStyle = bg; x.fillRect(0, 0, 1024, 160); x.font = '900 104px Bahnschrift,Impact,sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.shadowColor = color; x.shadowBlur = add ? 26 : 0; x.fillStyle = color; const k = Math.min(1, 980 / x.measureText(text).width); x.translate(512, 84); x.scale(k, 1); x.fillText(text, 0, 0);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial(add ? { map: t, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, side: THREE.DoubleSide } : { map: t, side: THREE.DoubleSide })); return m;
}

// ---- the world ----
export class Outer {
  constructor(city) { this.city = city; this.ph = city.phys; this.group = new THREE.Group(); city.group.add(this.group); this.spawns = { soldier: [], guard: [] }; this.parked = []; this.props = { pine: [], cactus: [], rock: [], bush: [], tent: [] }; }
  build() {
    const t0 = performance.now(); buildGrid(); this.tGrid = performance.now() - t0;
    this.terrain(); this.roads(); this.bridges(); this.base(); this.desert(); this.reserve(); this.scrub(); this.scatter(); this.instances();
    this.tAll = performance.now() - t0; return this;
  }
  gb() { return new GeoB({ aB: 4 }); }
  mesh(g, shadow = true) { if (g.empty) return null; const m = new THREE.Mesh(g.build(), this.city.mat); m.castShadow = shadow; m.receiveShadow = true; m.matrixAutoUpdate = false; this.group.add(m); return m; }
  box(g, x0, y0, z0, x1, y1, z1, col, st = 0, o) { g.color(col).set('aB', st, 3, 0, 0).box(x0, y0, z0, x1, y1, z1, o); this.ph.addBox(x0, y0, z0, x1, y1, z1); }
  terrain() {
    const BIO = { 1: [.36, .34, .2], 2: [.16, .24, .1], 3: [.72, .58, .38], 4: [.38, .37, .32], 5: [.46, .36, .27] }; const step = 10, mat = this.tmat = terrainMat();
    const chunk = (x0, z0, x1, z1) => {
      const nx = Math.round((x1 - x0) / step), nz = Math.round((z1 - z0) / step), P = [], C = [], I = [], idx = new Int32Array((nx + 1) * (nz + 1)).fill(-1); let any = false;
      for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) { const x = x0 + i * step, z = z0 + j * step, h = height(x, z); if (h > -6.95) any = true; }
      if (!any) return;
      for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) { const x = x0 + i * step, z = z0 + j * step, h = height(x, z), b = biome(x, z, h), c = BIO[b] || [.3, .28, .22]; const tint = .85 + .3 * fbm(x * .01, z * .01); const sand = sst(2.5, .5, h); const rd = nearRoad(x, z, 14); const dirt = rd ? sst(14, 7, rd.d) * .5 : 0; idx[j * (nx + 1) + i] = P.length / 3; P.push(x, h, z); C.push(...[(c[0] * (1 - sand) + .62 * sand) * tint * (1 - dirt) + .3 * dirt, (c[1] * (1 - sand) + .54 * sand) * tint * (1 - dirt) + .27 * dirt, (c[2] * (1 - sand) + .38 * sand) * tint * (1 - dirt) + .22 * dirt].map(v => Math.pow(clamp(v), 2.2))); }
      for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { const a = idx[j * (nx + 1) + i], b = idx[j * (nx + 1) + i + 1], c = idx[(j + 1) * (nx + 1) + i], d = idx[(j + 1) * (nx + 1) + i + 1]; if (P[a * 3 + 1] < -6.9 && P[b * 3 + 1] < -6.9 && P[c * 3 + 1] < -6.9 && P[d * 3 + 1] < -6.9) continue; I.push(a, c, b, b, c, d); }
      if (!I.length) return; const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(C, 3)); geo.setIndex(I); geo.computeVertexNormals(); geo.computeBoundingSphere();
      const m = new THREE.Mesh(geo, mat); m.receiveShadow = true; m.matrixAutoUpdate = false; this.group.add(m);
    };
    for (let z = -WR; z < WR; z += 400) for (let x = -WR; x < WR; x += 400) { if (Math.max(Math.abs(x + 200), Math.abs(z + 200)) < 700) continue; chunk(x, z, x + 400, z + 400); }
  }
  roads() {
    const P = [], N = [], UV = [], I = [];
    for (const r of ROADS) { const S = r.S; for (let i = 0; i < S.length; i++) { const p = S[i], q = S[Math.min(S.length - 1, i + 1)], o = S[Math.max(0, i - 1)]; let dx = q.x - o.x, dz = q.z - o.z; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l; const nx = -dz, nz = dx, y = p.y + (p.br ? .02 : .08), k = P.length / 3; P.push(p.x + nx * HW, y, p.z + nz * HW, p.x - nx * HW, y, p.z - nz * HW); N.push(0, 1, 0, 0, 1, 0); UV.push(0, p.s, 1, p.s); if (i) I.push(k - 2, k, k - 1, k - 1, k, k + 1); } }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); geo.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2)); geo.setIndex(I); geo.computeBoundingSphere();
    const m = new THREE.Mesh(geo, roadMat()); m.receiveShadow = true; this.group.add(m);
    // road signs at the entrances
    const sg = [[-55, -1090, 'FORT FORTIS 5 KM  /  HALFMOON RIDGE  /  OLD SCRUB HWY', '#e8e8e8', 0], [-1090, 495, 'THE DRY MARGIN  -  NO SERVICES FOR A WHILE', '#ffd890', Math.PI / 2], [1300, -1440, 'HALFMOON RIDGE RESERVE  -  THE LONG GOODBYE BRIDGE', '#d0ffd0', Math.PI / 2]];
    const g = this.gb(); for (const [x, z, t, c, ry] of sg) { const ax = Math.abs(ry) > .1; const sx = ax ? 0 : 1, sz = ax ? 1 : 0; const px = x + (ax ? 0 : 9), pz = z + (ax ? 9 : 0), y = height(px, pz); g.color('#3a3d42').set('aB', 0, 0, 0, 0); g.box(px - .15, y, pz - .15, px + .15, y + 7, pz + .15); g.color('#1a5a32').set('aB', 0, 0, 0, 0).cbox(px, y + 6, pz, sx * 14 + .2, 2.4, sz * 14 + .2); const s = textPlane(t, c, 13.4, 2.1, '#1a5a32', false); s.position.set(px + sz * .12, y + 6, pz + sx * .12); s.rotation.y = ry; this.group.add(s); const s2 = s.clone(); s2.position.set(px - sz * .12, y + 6, pz - sx * .12); s2.rotation.y = ry + Math.PI; this.group.add(s2); } this.mesh(g);
  }
  bridges() {
    const g = this.gb(), ph = this.ph;
    const rail = (x0, z0, x1, z1, y) => { g.color('#8a8e94').set('aB', 0, 2, 0, 0).box(x0, y, z0, x1, y + 1, z1); ph.addBox(x0, y - .5, z0, x1, y + 1, z1, { noSight: true }); };
    const deck = (x0, z0, x1, z1, y, col = '#55595f') => { g.color(col).set('aB', 0, 1, 0, 0).box(x0, y - 1.1, z0, x1, y, z1, { bottom: true }); ph.addBox(x0, y - 1.1, z0, x1, y, z1); };
    // causeways (axis aligned, low): north along z at x=-55, desert along x at z=495
    const cause = (axis, c, a, b, y) => { // a..b along axis, deck, ramp at the city end (b for north = -736, a for desert...)
      const hw = HW + .8; for (let p = a; p < b; p += 20) { const q = Math.min(b, p + 20); if (axis === 'z') { deck(c - hw, p, c + hw, q, y); rail(c - hw, p, c - hw + .3, q, y); rail(c + hw - .3, p, c + hw, q, y); } else { deck(p, c - hw, q, c + hw, y); rail(p, c - hw, q, c - hw + .3, y); rail(p, c + hw - .3, q, c + hw, y); } const m = p + 10; g.color('#4a4e54').set('aB', 0, 3, 0, 0); if (axis === 'z') g.box(c - 1, -9, m - 1, c + 1, y - 1.1, m + 1); else g.box(m - 1, -9, c - 1, m + 1, y - 1.1, c + 1); if ((p / 20) % 3 === 0) { g.color('#2a2d31').set('aB', 0, 0, 0, 0); const lx = axis === 'z' ? c + hw - .5 : m, lz = axis === 'z' ? m : c + hw - .5; g.box(lx - .1, y + 1, lz - .1, lx + .1, y + 7, lz + .1); g.color('#fff0c0').set('aB', 6, 0, 2.2, 0).cbox(axis === 'z' ? lx - 1 : lx, y + 7, axis === 'z' ? lz : lz - 1, axis === 'z' ? 2 : .4, .2, axis === 'z' ? .4 : 2); } }
    };
    cause('z', -55, -1075, -776, 4.2); cause('x', 495, -1075, -776, 4.2);
    // city-side ramps
    const ramp = (x0, z0, x1, z1, axis, h0, h1) => { ph.addRamp(x0, z0, x1, z1, axis, h0, h1); g.color('#55595f').set('aB', 14, 1, 0, 0); if (axis === 'z') { g.quad([x0, h1, z1], [x1, h1, z1], [x1, h0, z0], [x0, h0, z0]); g.color('#5a5e66').set('aB', 0, 1, 0, 0); g.quad([x1, 0, z1], [x1, 0, z0], [x1, h0, z0], [x1, h1, z1]); g.quad([x0, 0, z0], [x0, 0, z1], [x0, h1, z1], [x0, h0, z0]); } else { g.quad([x0, h0, z1], [x1, h1, z1], [x1, h1, z0], [x0, h0, z0]); g.color('#5a5e66').set('aB', 0, 1, 0, 0); g.quad([x0, 0, z1], [x1, 0, z1], [x1, h1, z1], [x0, h0, z1]); g.quad([x1, 0, z0], [x0, 0, z0], [x0, h0, z0], [x1, h1, z0]); } const n = 8, L = axis === 'z' ? z1 - z0 : x1 - x0; for (let k = 0; k < n; k++) { const hh = Math.min(h0 + (h1 - h0) * k / n, h0 + (h1 - h0) * (k + 1) / n) - .25; if (hh > .3) { if (axis === 'z') ph.addBox(x0, 0, z0 + k * L / n, x1, hh, z0 + (k + 1) * L / n); else ph.addBox(x0 + k * L / n, 0, z0, x0 + (k + 1) * L / n, hh, z1); } } };
    ramp(-55 - HW - .8, -776, -55 + HW + .8, -736, 'z', 4.2, 0); ramp(-776, 495 - HW - .8, -736, 495 + HW + .8, 'x', 4.2, 0);
    for (const [x0, z0, x1, z1, ax] of [[-55 - HW - .8, -776, -55 - HW - .5, -736, 'z'], [-55 + HW + .5, -776, -55 + HW + .8, -736, 'z'], [-776, 495 - HW - .8, -736, 495 - HW - .5, 'x'], [-776, 495 + HW + .5, -736, 495 + HW + .8, 'x']]) { ph.addBox(x0, 0, z0, x1, ax === 'z' ? 3 : 3, z1, { noSight: true }); g.color('#8a8e94').set('aB', 0, 2, 0, 0).box(x0, 0, z0, x1, 1, z1); }
    // ---- The Long Goodbye: suspension bridge over the canyon (along x) ----
    const cz = -1450, cx = canyonX(cz), y = deckY, x0 = 1403, x1 = 1743, hw = HW + 1.4, red = '#b8442a';
    for (let p = x0; p < x1; p += 20) { const q = Math.min(x1, p + 20); deck(p, cz - hw, q, cz + hw, y, '#4a4d52'); rail(p, cz - hw, q, cz - hw + .3, y); rail(p, cz + hw - .3, q, cz + hw, y); g.color(red).set('aB', 0, 5, 0, 0).box(p, y - 3.4, cz - hw, q, y - 1.1, cz - hw + .5).box(p, y - 3.4, cz + hw - .5, q, y - 1.1, cz + hw); for (let k = 0; k < 2; k++) { const a = p + k * 10; g.box(a, y - 3.4, cz - hw, a + .4, y - 1.1, cz + hw); } }
    const T = [cx - 100, cx + 100], top = y + 88; for (const tx of T) { const fl = Math.min(height(tx, cz), y - 5); for (const s of [-1, 1]) { const lz = cz + s * (hw + 1.6); g.color(red).set('aB', 0, 7, 0, 0).box(tx - 2.2, fl - 2, lz - 1.6, tx + 2.2, top, lz + 1.6); ph.addBox(tx - 2.2, fl - 2, lz - 1.6, tx + 2.2, top, lz + 1.6); g.color('#ff3020').set('aB', 12, 0, 4, 0).cbox(tx, top + .4, lz, .6, .6, .6); } for (const hy of [y - 4, y + 30, y + 62, top - 4]) g.color(red).set('aB', 0, 7, 0, 0).box(tx - 1.8, hy, cz - hw - 1.6, tx + 1.8, hy + 3, cz + hw + 1.6); }
    // main cables and hangers
    const cy = X => { const m = (T[0] + T[1]) / 2, half = (T[1] - T[0]) / 2; if (X >= T[0] && X <= T[1]) { const t = (X - m) / half; return y + 6 + (top - 1 - y - 6) * t * t; } const out = X < T[0] ? T[0] - X : X - T[1], span = X < T[0] ? T[0] - x0 : x1 - T[1]; return top - 1 - (top - 1 - y - 1) * (out / span); };
    for (const s of [-1, 1]) { const lz = cz + s * (hw + 1.6); g.color('#d8d0c0').set('aB', 0, 2, 0, 0); for (let X = x0; X < x1; X += 4) { const a = cy(X), b = cy(X + 4); g.quad([X, a - .3, lz - .35], [X + 4, b - .3, lz - .35], [X + 4, b + .3, lz - .35], [X, a + .3, lz - .35]); g.quad([X + 4, b - .3, lz + .35], [X, a - .3, lz + .35], [X, a + .3, lz + .35], [X + 4, b + .3, lz + .35]); g.quad([X, a + .3, lz - .35], [X + 4, b + .3, lz - .35], [X + 4, b + .3, lz + .35], [X, a + .3, lz + .35]); if ((X - x0) % 8 === 0 && cy(X) > y + 2) g.box(X - .07, y, lz - .07, X + .07, cy(X), lz + .07); } }
    this.bridgeName = textPlane('THE LONG GOODBYE', '#ffd0a0', 30, 4.6); this.bridgeName.position.set(T[0] - 2.4, y + 33, cz); this.bridgeName.rotation.y = -Math.PI / 2; this.group.add(this.bridgeName);
    this.mesh(g); this.deck = { x0, x1, z: cz, y };
  }
  // ---- Fort Fortis ----
  base() {
    const g = this.gb(), ph = this.ph, B = BASE, y = B.y, wall = '#7c7a70', olive = '#4a5236', tan = '#9a8e70';
    g.color('#5a5a54').set('aB', 14, 0, 0, 0).box(B.x0, y - .3, B.z0, B.x1, y + .02, B.z1); // apron
    // perimeter wall with gate gap at x -12..12 on the south side
    const H = 5.2; for (const [a, b, c, d] of [[B.x0, B.z0, B.x1, B.z0 + 1], [B.x0, B.z0, B.x0 + 1, B.z1], [B.x1 - 1, B.z0, B.x1, B.z1], [B.x0, B.z1 - 1, -12, B.z1], [12, B.z1 - 1, B.x1, B.z1]]) { this.box(g, a, y - 1, b, c, y + H, d, wall); g.color('#3a3a36').set('aB', 0, 0, 0, 0).box(a, y + H, b, c, y + H + .5, d); }
    for (let x = B.x0; x < B.x1; x += 3) for (const z of [B.z0 + .5, B.z1 - .5]) { if (Math.abs(x) < 13 && z > -1500) continue; g.color('#8a8a8a').set('aB', 0, 0, 0, 0).box(x, y + H + .5, z - .05, x + .1, y + H + 1.6, z + .05); }
    // gate: booth + barrier arm
    this.box(g, 16, y, B.z1 - 6, 22, y + 3.2, B.z1 - 1, '#c8c4b0'); g.color('#202428').set('aB', 0, 0, 0, 0).box(15.9, y + 1.4, B.z1 - 5, 22.1, y + 2.6, B.z1 - 2); g.color('#d02020').set('aB', 6, 0, 1, 0).box(-12, y + 1, B.z1 - .8, 12, y + 1.25, B.z1 - .4); this.gateArm = ph.addBox(-12, y, B.z1 - 1, 12, y + 1.3, B.z1 - .3, { noSight: true });
    const sign = textPlane('FORT FORTIS  -  RESTRICTED  -  DEADLY FORCE AUTHORIZED', '#ff4a3a', 26, 2.4); sign.position.set(0, y + 7.6, B.z1 + .2); this.group.add(sign); g.color('#2a2a2a').set('aB', 0, 0, 0, 0).box(-13.5, y, B.z1 - .6, -12, y + 9, B.z1 + .4).box(12, y, B.z1 - .6, 13.5, y + 9, B.z1 + .4).box(-13.5, y + 6.2, B.z1 - .2, 13.5, y + 9, B.z1 + .1);
    // watchtowers
    for (const [tx, tz] of [[B.x0 + 4, B.z0 + 4], [B.x1 - 4, B.z0 + 4], [B.x0 + 4, B.z1 - 4], [B.x1 - 4, B.z1 - 4], [-30, B.z1 - 4], [30, B.z1 - 4], [B.x0 + 4, -1660], [B.x1 - 4, -1660]]) { g.color('#5a5448').set('aB', 0, 0, 0, 0); for (const [a, b] of [[-2, -2], [2, -2], [-2, 2], [2, 2]]) g.box(tx + a - .2, y, tz + b - .2, tx + a + .2, y + 11, tz + b + .2); this.box(g, tx - 2.6, y + 11, tz - 2.6, tx + 2.6, y + 11.4, tz + 2.6, '#5a5448'); g.color('#6a6250').set('aB', 0, 0, 0, 0).box(tx - 2.6, y + 11.4, tz - 2.6, tx + 2.6, y + 12.6, tz + 2.6).box(tx - 2.9, y + 14.6, tz - 2.9, tx + 2.9, y + 15, tz + 2.9, { bottom: true }); g.color('#fff6d0').set('aB', 6, 0, 2.4, 0).cbox(tx, y + 14.2, tz, .5, .4, .5); this.spawns.soldier.push(V3(tx, y + 11.4, tz)); }
    // hangars (open to the south)
    for (const hx of [-250, 0, 250]) { const z0 = -1790, z1 = -1730, x0 = hx - 32, x1 = hx + 32, hh = 16; this.box(g, x0, y, z0, x1, y + hh, z0 + 1, olive, 5); this.box(g, x0, y, z0, x0 + 1, y + hh, z1, olive, 5); this.box(g, x1 - 1, y, z0, x1, y + hh, z1, olive, 5); for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI, b = (k + 1) / 8 * Math.PI, ax = hx - Math.cos(a) * 32, bx = hx - Math.cos(b) * 32, ay = y + hh + Math.sin(a) * 7, by = y + hh + Math.sin(b) * 7; g.color(olive).set('aB', 5, 7, 0, 0); g.quad([ax, ay, z1], [bx, by, z1], [bx, by, z0], [ax, ay, z0]); g.quad([bx, by, z0], [bx, by, z1], [ax, ay, z1], [ax, ay, z0]); } g.color('#1a1c1e').set('aB', 0, 0, 0, 0); for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI, b = (k + 1) / 8 * Math.PI; g.quad([hx - Math.cos(a) * 32, y + hh + Math.sin(a) * 7, z0 + .1], [hx - Math.cos(b) * 32, y + hh + Math.sin(b) * 7, z0 + .1], [hx - Math.cos(b) * 32, y + hh, z0 + .1], [hx - Math.cos(a) * 32, y + hh, z0 + .1]); } ph.addBox(x0, y + hh, z0, x1, y + hh + 7, z1, { noShot: false }); g.color('#ffd24a').set('aB', 6, 0, 1.2, 0).box(x0 + 2, y + hh - 1.4, z1 - .2, x1 - 2, y + hh - 1, z1); const hs = textPlane('HANGAR ' + (hx < 0 ? 'A' : hx ? 'C' : 'B'), '#ffd24a', 14, 2.2); hs.position.set(hx, y + hh + 3.5, z1 + .3); this.group.add(hs); }
    // barracks
    for (let k = 0; k < 4; k++) { const bx = -360 + k * 50, z0 = -1560, z1 = -1505; this.box(g, bx, y, z0, bx + 34, y + 7, z1, tan, 10); g.color('#4a4436').set('aB', 0, 0, 0, 0).box(bx - .5, y + 7, z0 - .5, bx + 34.5, y + 7.6, z1 + .5, { bottom: true }); for (let w = 0; w < 5; w++) g.color('#202428').set('aB', 6, 0, .3, 0).box(bx + 3 + w * 6.4, y + 2.6, z1, bx + 5.2 + w * 6.4, y + 4.2, z1 + .05); this.spawns.soldier.push(V3(bx + 17, y, z1 + 4)); }
    // command building (interior: armory)
    const hq = SPOTS.hq; this.box(g, hq[0] - 30, y, hq[1] - 20, hq[0] + 30, y + 14, hq[1] + 14, '#6a6a5e', 2); g.color('#3a3a34').set('aB', 0, 0, 0, 0).box(hq[0] - 31, y + 14, hq[1] - 21, hq[0] + 31, y + 15, hq[1] + 15, { bottom: true }); g.color('#0c0d10').set('aB', 0, 0, 0, 0).box(hq[0] - 2, y, hq[1] + 14, hq[0] + 2, y + 3.4, hq[1] + 14.1); const hs = textPlane('FORTIS COMMAND', '#e8e0c0', 18, 2.6); hs.position.set(hq[0], y + 10, hq[1] + 14.2); this.group.add(hs);
    // dish, fuel tanks, flag, crates, helipad, runway
    g.color('#c8c8c0').set('aB', 0, 0, 0, 0).cyl(hq[0] + 18, y + 15, y + 22, hq[1] - 8, .6, .6, 8); g.add(new THREE.SphereGeometry(5, 14, 8, 0, TAU, 0, 1.1), M4(hq[0] + 18, y + 25, hq[1] - 8, -2.2, 0, 0));
    for (const [fx, fz] of [[360, -1620], [360, -1660], [360, -1700]]) { g.color('#9a9a90').set('aB', 0, 0, 0, 0).cyl(fx, y, y + 9, fz, 7, 7, 18); ph.addBox(fx - 6, y, fz - 6, fx + 6, y + 9, fz + 6); g.color('#d03020').set('aB', 0, 0, 0, 0).cyl(fx, y + 4, y + 4.6, fz, 7.05, 7.05, 18, false); }
    for (let k = 0; k < 26; k++) { const R = rng(k + 400), cx2 = R.range(-380, 380), cz2 = R.range(-1680, -1600); if (Math.abs(cx2) < 40) continue; this.box(g, cx2 - 1.2, y, cz2 - 1.2, cx2 + 1.2, y + 2.2, cz2 + 1.2, R.pick(['#5a6a3a', '#6a5a3a', '#4a5a4a']), 7); }
    const hp = SPOTS.heli; g.color('#3a3c40').set('aB', 14, 0, 0, 0).cyl(hp[0], y, y + .1, hp[1], 14, 14, 24); g.color('#ffffff').set('aB', 6, 0, .9, 0).cyl(hp[0], y + .1, y + .12, hp[1], 11.5, 11.5, 24, false); g.box(hp[0] - 4, y + .1, hp[1] - .6, hp[0] + 4, y + .13, hp[1] + .6).box(hp[0] - 4, y + .1, hp[1] - 5, hp[0] - 2.8, y + .13, hp[1] + 5).box(hp[0] + 2.8, y + .1, hp[1] - 5, hp[0] + 4, y + .13, hp[1] + 5);
    g.color('#2a2c30').set('aB', 14, 0, 0, 0).box(-400, y + .02, -1865, 400, y + .06, -1825); g.color('#e8e8e8').set('aB', 6, 0, .7, 0); for (let x = -390; x < 390; x += 30) g.box(x, y + .06, -1846, x + 16, y + .08, -1844); for (const ex of [-398, 392]) for (let k = 0; k < 8; k++) g.box(ex, y + .06, -1862 + k * 4.5, ex + 6, y + .08, -1860.5 + k * 4.5);
    g.color('#c0c0c0').set('aB', 0, 0, 0, 0).cyl(-10, y, y + 16, -1600, .12, .1, 6); g.color('#3a4a2a').set('aB', 0, 0, 0, 0).box(-9.9, y + 13, -1600, -5, y + 15.6, -1599.9);
    this.mesh(g);
    this.parked.push(['tank', -250, -1750, 0], ['tank', 0, -1752, 0], ['apc', 250, -1750, 0], ['apc', -120, -1620, Math.PI / 2], ['mtruck', 80, -1625, -Math.PI / 2], ['mtruck', 120, -1625, -Math.PI / 2], ['vtol', hp[0], hp[1], Math.PI], ['jeep', 30, -1460, 0], ['jeep', -40, -1470, Math.PI]);
  }
  // ---- The Dry Margin ----
  desert() {
    const g = this.gb(), ph = this.ph;
    const m = SPOTS.motel, my = height(m[0], m[1]); // L-shaped motel + gas station
    this.box(g, m[0] - 40, my, m[1] + 8, m[0] + 10, my + 5, m[1] + 22, '#c8a07a', 10); this.box(g, m[0] + 10, my, m[1] - 20, m[0] + 24, my + 5, m[1] + 22, '#c8a07a', 10); g.color('#6a4a30').set('aB', 0, 0, 0, 0).box(m[0] - 41, my + 5, m[1] + 5, m[0] + 10, my + 5.4, m[1] + 23, { bottom: true });
    for (let k = 0; k < 7; k++) { const dx = m[0] - 37 + k * 7; g.color(['#5a8ab0', '#b05a5a', '#5ab08a'][k % 3]).set('aB', 0, 0, 0, 0).box(dx, my, m[1] + 7.9, dx + 1.6, my + 2.6, m[1] + 8); g.color('#ffd080').set('aB', 6, 0, 1.4, 0).box(dx + 2.2, my + 1.4, m[1] + 7.95, dx + 4, my + 2.4, m[1] + 8); }
    const sgn = textPlane('LAST CHANCE MOTEL', '#ff5a8a', 18, 2.8); sgn.position.set(m[0] - 40, my + 12, m[1] + 4); this.group.add(sgn); g.color('#3a3a3a').set('aB', 0, 0, 0, 0).box(m[0] - 40.3, my, m[1] + 3.7, m[0] - 39.7, my + 10.5, m[1] + 4.3); const vac = textPlane('VACANCY (EMOTIONALLY)', '#40ffd0', 12, 1.6); vac.position.set(m[0] - 40, my + 9.4, m[1] + 4.05); this.group.add(vac);
    g.color('#e8e4da').set('aB', 0, 0, 0, 0).box(m[0] + 40, my + 5.4, m[1] - 10, m[0] + 66, my + 6, m[1] + 6, { bottom: true }); for (const [a, b] of [[42, -8], [64, -8], [42, 4], [64, 4]]) g.color('#c8c4bc').box(m[0] + a - .3, my, m[1] + b - .3, m[0] + a + .3, my + 5.4, m[1] + b + .3); for (const a of [48, 58]) this.box(g, m[0] + a - .6, my, m[1] - 2.6, m[0] + a + .6, my + 1.8, m[1] - 1.4, '#d03020'); this.box(g, m[0] + 70, my, m[1] - 14, m[0] + 84, my + 4.4, m[1] - 2, '#d8d0b8', 4); const gs = textPlane('GAS  FOOD  REGRET', '#ffe04a', 12, 1.8); gs.position.set(m[0] + 53, my + 6.6, m[1] + 6.05); this.group.add(gs);
    this.water = [m[0] - 70, m[1] - 20]; g.color('#8a8a80').set('aB', 0, 0, 0, 0); for (const [a, b] of [[-3, -3], [3, -3], [-3, 3], [3, 3]]) g.box(m[0] - 70 + a - .2, my, m[1] - 20 + b - .2, m[0] - 70 + a + .2, my + 16, m[1] - 20 + b + .2); g.cyl(m[0] - 70, my + 16, my + 22, m[1] - 20, 5, 5, 16); const wt = textPlane('DRY MARGIN', '#202020', 9, 1.4, '#c0bcb0', false); wt.position.set(m[0] - 70, my + 19, m[1] - 14.9); this.group.add(wt);
    // bunker in a mesa (interior: deep storage)
    const b = SPOTS.bunker, by = height(b[0], b[1]); this.box(g, b[0] - 14, by, b[1] - 18, b[0] + 14, by + 9, b[1] - 2, '#6a6458', 0); g.color('#3a3a3c').set('aB', 0, 0, 0, 0).box(b[0] - 4, by, b[1] - 2, b[0] + 4, by + 5, b[1] - 1.8); g.color('#ffd24a').set('aB', 6, 0, 1.6, 0).box(b[0] - 4.4, by + 5, b[1] - 2, b[0] + 4.4, by + 5.3, b[1] - 1.6); const bs = textPlane('AURELIAN DEEP STORAGE  -  NO SAND PAST THIS POINT', '#ffd24a', 16, 1.4); bs.position.set(b[0], by + 7, b[1] - 1.7); this.group.add(bs);
    // solar farm
    const s = SPOTS.solar, sy = height(s[0], s[1]); for (let r = 0; r < 12; r++) for (let c = 0; c < 18; c++) { const px = s[0] - 100 + c * 11.5, pz = s[1] - 60 + r * 10; g.color('#1a2a4a').set('aB', 6, 0, .15, 0); g.add(new THREE.BoxGeometry(9, .15, 4.2), M4(px, sy + 1.6, pz, -.45, 0, 0)); g.color('#8a8a8a').set('aB', 0, 0, 0, 0).box(px - .1, sy, pz - .1, px + .1, sy + 1.5, pz + .1); } ph.addBox(s[0] - 106, sy, s[1] - 63, s[0] + 102, sy + 2.4, s[1] + 53, { noSight: true });
    // crashed saucer (easter egg)
    const u = SPOTS.ufo, uy = height(u[0], u[1]); g.color('#8a8e96').set('aB', 0, 4, 0, 0); g.add(new THREE.SphereGeometry(11, 24, 10), M4(u[0], uy + 1.2, u[1], .35, .4, .2, 1, .22, 1)); g.color('#b0ffd0').set('aB', 6, 0, 2.6, 0); g.add(new THREE.SphereGeometry(4, 16, 10, 0, TAU, 0, 1.5), M4(u[0] + 1, uy + 3.2, u[1] - .4, .35, .4, .2)); for (let k = 0; k < 10; k++) { const a = k / 10 * TAU; g.color('#60ff90').set('aB', 12, k, 3, 0).cbox(u[0] + Math.cos(a) * 9.6, uy + 1.2 + Math.sin(a) * 1.9 * .35, u[1] + Math.sin(a) * 9.6, .7, .3, .7); } ph.addBox(u[0] - 9, uy - 1, u[1] - 9, u[0] + 9, uy + 3.5, u[1] + 9); g.color('#3a2a1a').set('aB', 0, 0, 0, 0); for (let k = 0; k < 6; k++) g.box(u[0] - 30 - k * 9, uy - .2, u[1] - 3 - k * 2, u[0] - 22 - k * 9, uy + .15, u[1] + 3 - k * 2);
    // the Golden Duck of the Dry Margin (easter egg)
    const d = SPOTS.duck, dy = height(d[0], d[1]); g.color('#ffcf30').set('aB', 6, 0, .35, 0); g.add(new THREE.SphereGeometry(6, 18, 12), M4(d[0], dy + 5, d[1], 0, 0, 0, 1.3, .9, 1)); g.add(new THREE.SphereGeometry(3.6, 16, 10), M4(d[0] + 5.5, dy + 11, d[1])); g.color('#ff8a20').set('aB', 6, 0, .4, 0); g.add(new THREE.BoxGeometry(3.4, .9, 2.2), M4(d[0] + 9.2, dy + 10.6, d[1])); g.color('#101010').set('aB', 0, 0, 0, 0); g.add(new THREE.SphereGeometry(.6, 8, 6), M4(d[0] + 7.6, dy + 12, d[1] + 2.4)).add(new THREE.SphereGeometry(.6, 8, 6), M4(d[0] + 7.6, dy + 12, d[1] - 2.4)); ph.addBox(d[0] - 8, dy, d[1] - 6, d[0] + 9, dy + 14, d[1] + 6);
    // dry lake airstrip
    const L = LAKE; g.color('#c8bca0').set('aB', 14, 0, 0, 0).box(L.x - 30, 1.21, L.z - 220, L.x + 30, 1.26, L.z + 220); g.color('#f0f0f0').set('aB', 6, 0, .5, 0); for (let z = -210; z < 210; z += 26) g.box(L.x - .6, 1.26, L.z + z, L.x + .6, 1.28, L.z + z + 14);
    // billboard
    const bb = [-1210, 520], byy = height(bb[0], bb[1]); g.color('#4a4a4a').set('aB', 0, 0, 0, 0).box(bb[0] - .3, byy, bb[1] - 6, bb[0] + .3, byy + 8, bb[1] - 5.4).box(bb[0] - .3, byy, bb[1] + 5.4, bb[0] + .3, byy + 8, bb[1] + 6); const bt = textPlane('AURELIAN TRUST: NOW BUYING SAND', '#ffd24a', 14, 3.4, '#14100a', false); bt.position.set(bb[0] - .35, byy + 9.6, bb[1]); bt.rotation.y = -Math.PI / 2; this.group.add(bt);
    this.mesh(g); this.parked.push(['buggy', m[0] + 30, m[1] + 14, 0], ['pickup', m[0] + 52, m[1] + 12, Math.PI / 2], ['plane', L.x, L.z - 160, 0], ['buggy', u[0] - 40, u[1] + 20, 1]);
  }
  // ---- Halfmoon Ridge ----
  reserve() {
    const g = this.gb(); const wood = '#6a4a30', dark = '#3a2a1c';
    const r = SPOTS.ranger, ry = height(r[0], r[1]); this.box(g, r[0] - 12, ry, r[1] - 9, r[0] + 12, ry + 6, r[1] + 9, wood, 10); g.color(dark).set('aB', 0, 0, 0, 0); for (let k = 0; k < 6; k++) g.box(r[0] - 13 + k * .2, ry + 6 + k * 1.1, r[1] - 10 + k * 1.6, r[0] + 13 - k * .2, ry + 6.4 + k * 1.1, r[1] + 10 - k * 1.6); const rs = textPlane('HALFMOON RIDGE RANGER STATION', '#e8ffd0', 14, 1.6, '#2a3a1c', false); rs.position.set(r[0], ry + 4.6, r[1] + 9.1); this.group.add(rs);
    const l = SPOTS.lookout, ly = height(l[0], l[1]); for (const [a, b] of [[-3, -3], [3, -3], [-3, 3], [3, 3]]) g.color(wood).set('aB', 0, 0, 0, 0).box(l[0] + a - .25, ly, l[1] + b - .25, l[0] + a + .25, ly + 24, l[1] + b + .25); this.box(g, l[0] - 4, ly + 24, l[1] - 4, l[0] + 4, ly + 24.4, l[1] + 4, wood); g.color(dark).box(l[0] - 4, ly + 24.4, l[1] - 4, l[0] + 4, ly + 25.4, l[1] - 3.7).box(l[0] - 4, ly + 24.4, l[1] + 3.7, l[0] + 4, ly + 25.4, l[1] + 4).box(l[0] - 4.6, ly + 28, l[1] - 4.6, l[0] + 4.6, ly + 28.4, l[1] + 4.6, { bottom: true }); // stairs as a ramp
    this.ph.addRamp(l[0] + 4, l[1] - 1, l[0] + 30, l[1] + 1, 'x', ly + 24.4, ly); g.color(wood).set('aB', 0, 0, 0, 0).quad([l[0] + 4, ly + 24.4, l[1] + 1], [l[0] + 30, ly, l[1] + 1], [l[0] + 30, ly, l[1] - 1], [l[0] + 4, ly + 24.4, l[1] - 1]);
    const c = SPOTS.camp, cy = height(c[0], c[1]); for (let k = 0; k < 5; k++) { const a = k / 5 * TAU, tx = c[0] + Math.cos(a) * 14, tz = c[1] + Math.sin(a) * 14; g.color(['#c05030', '#3a70b0', '#d0a020', '#50a050', '#a050a0'][k]).set('aB', 0, 0, 0, 0); g.add(new THREE.ConeGeometry(2.6, 2.6, 4), M4(tx, cy + 1.3, tz, 0, a, 0)); this.ph.addBox(tx - 1.8, cy, tz - 1.8, tx + 1.8, cy + 2, tz + 1.8, { noSight: true }); } g.color('#5a5a5a').cyl(c[0], cy, cy + .3, c[1], 1.2, 1.2, 10); g.color('#ff7a20').set('aB', 6, 0, 3, 0); g.add(new THREE.ConeGeometry(.6, 1.2, 6), M4(c[0], cy + .8, c[1])); this.campfire = V3(c[0], cy, c[1]);
    for (const [x, z, t] of [[1300, -1405, 'HALFMOON RIDGE RESERVE'], [1900, -1430, 'NO BIGFOOT HUNTING (HE KNOWS)'], [2060, -2020, 'RANGER STATION']]) { const y = height(x, z); g.color(wood).set('aB', 0, 0, 0, 0).box(x - .2, y, z - .2, x + .2, y + 3, z + .2).box(x + 4.8, y, z - .2, x + 5.2, y + 3, z + .2); g.color('#3a5a2a').box(x - .3, y + 3, z - .15, x + 5.3, y + 4.8, z + .15); const s = textPlane(t, '#f0f0d0', 5.4, 1.4, '#3a5a2a', false); s.position.set(x + 2.5, y + 3.9, z + .2); this.group.add(s); }
    this.mesh(g); this.parked.push(['ranger', r[0] + 18, r[1] + 4, 0], ['dirtbike', c[0] + 22, c[1] + 6, 1]);
  }
  scrub() {
    const g = this.gb(); const d = SPOTS.drivein, dy = height(d[0], d[1]); g.color('#d8d8d0').set('aB', 0, 0, 0, 0).box(d[0] - 22, dy + 4, d[1] - 60, d[0] + 22, dy + 22, d[1] - 59); this.ph.addBox(d[0] - 22, dy, d[1] - 60, d[0] + 22, dy + 22, d[1] - 59); g.color('#3a3a3a').box(d[0] - 20, dy, d[1] - 59.5, d[0] - 19, dy + 4, d[1] - 58.5).box(d[0] + 19, dy, d[1] - 59.5, d[0] + 20, dy + 4, d[1] - 58.5);
    const scr = textPlane('NOW SHOWING: LARRY GOLDMAN, A HUMAN MAN (2: THE HUMANING)', '#ffe0b0', 42, 15, '#101826', false); scr.position.set(d[0], dy + 13, d[1] - 58.9); this.group.add(scr); this.screen = scr;
    for (let k = 0; k < 9; k++) { const x = d[0] - 20 + (k % 3) * 20, z = d[1] - 30 + Math.floor(k / 3) * 14; g.color('#2a2a2a').box(x - .1, dy, z - .1, x + .1, dy + 1.4, z + .1); }
    const t = SPOTS.trailer, ty = height(t[0], t[1]); for (let k = 0; k < 6; k++) { const R = rng(k + 77), x = t[0] - 50 + k * 20, z = t[1] + R.range(-20, 20); this.box(g, x - 3, ty, z - 9, x + 3, ty + 3.4, z + 9, R.pick(['#c8c0a8', '#a8b8c0', '#c0a8a8', '#d8d0b0']), 0); g.color('#8a8a8a').set('aB', 0, 0, 0, 0).box(x - 3.1, ty + 1.4, z - 9.1, x + 3.1, ty + 1.6, z + 9.1); }
    const q = SPOTS.quarry, qy = height(q[0], q[1]); this.box(g, q[0] + 20, qy, q[1] - 6, q[0] + 32, qy + 8, q[1] + 6, '#a07a30', 5);
    this.mesh(g); this.parked.push(['pickup', t[0] - 30, t[1] + 12, .4], ['dozer', q[0] - 10, q[1] + 8, 0]);
  }
  // vegetation and rocks
  scatter() {
    const R = rng(4242); const P = this.props; const ok = (x, z, clear = 14) => { const h = height(x, z); if (h < .8) return null; const rd = nearRoad(x, z, clear); if (rd) return null; if (x > BASE.x0 - 30 && x < BASE.x1 + 30 && z > BASE.z0 - 30 && z < BASE.z1 + 30) return null; for (const k in SPOTS) { const s = SPOTS[k]; if (Math.hypot(x - s[0], z - s[1]) < 70) return null; } const sx = (height(x + 3, z) - height(x - 3, z)) / 6, sz = (height(x, z + 3) - height(x, z - 3)) / 6; if (Math.hypot(sx, sz) > .7) return null; return h; };
    for (let k = 0; k < 9000; k++) { const x = R.range(500, WR - 20), z = R.range(-WR + 20, -980); const rw = reserveW(x); if (rw < .4 || Math.abs(x - canyonX(z)) < 160) continue; if (fbm(x * .006, z * .006) < .42) continue; const h = ok(x, z); if (h === null) continue; P.pine.push([x, h, z, R.range(.8, 1.6), R()]); if (P.pine.length > 3400) break; }
    for (let k = 0; k < 1400; k++) { const x = R.range(-WR + 20, 600), z = R.range(-WR + 20, -980); const h = ok(x, z); if (h === null) continue; if (R() < .55) P.bush.push([x, h, z, R.range(.7, 1.6), R()]); else if (R() < .5) P.pine.push([x, h, z, R.range(.6, 1.1), R()]); else P.rock.push([x, h, z, R.range(.6, 2.2), R()]); }
    for (let k = 0; k < 3000; k++) { const x = R.range(-WR + 20, -960), z = R.range(200, WR - 20); if (landD(x, z) < .9) continue; const h = ok(x, z, 10); if (h === null) continue; if (Math.hypot(x - LAKE.x, z - LAKE.z) < LAKE.r + 40) continue; if (R() < .45) P.cactus.push([x, h, z, R.range(.7, 1.5), R()]); else if (R() < .55) P.rock.push([x, h, z, R.range(.8, 3.5), R()]); else P.bush.push([x, h, z, R.range(.5, 1), R()]); }
    for (const [x, h, z, s] of P.pine) this.ph.addBox(x - .3, h, z - .3, x + .3, h + 6 * s, z + .3, { noSight: true }); for (const [x, h, z, s] of P.cactus) this.ph.addBox(x - .25, h, z - .25, x + .25, h + 3 * s, z + .25, { noSight: true }); for (const [x, h, z, s] of P.rock) if (s > 1.4) this.ph.addBox(x - s * .8, h - 1, z - s * .8, x + s * .8, h + s * .9, z + s * .8);
  }
  instances() {
    const geo = {}; let b = new GeoB(); b.color('#4a3424').cyl(0, 0, 2.2, 0, .26, .18, 6); for (let k = 0; k < 4; k++) { b.color(k % 2 ? '#2c4a26' : '#24401f'); b.add(new THREE.ConeGeometry(2.4 - k * .48, 2.8, 7), M4(0, 2.4 + k * 1.55, 0, 0, k, 0)); } geo.pine = b.build();
    b = new GeoB(); b.color('#3d6a32').cyl(0, 0, 3, 0, .32, .28, 8); b.add(new THREE.SphereGeometry(.28, 8, 6), M4(0, 3, 0)); b.cyl(.3, 1.3, 1.5, 0, .14, .14, 6); b.cyl(.85, 1.4, 2.4, 0, .16, .14, 6).add(new THREE.SphereGeometry(.14, 6, 4), M4(.85, 2.4, 0)); b.add(new THREE.CylinderGeometry(.14, .14, .6, 6), M4(-.6, 1.8, 0, 0, 0, Math.PI / 2)); b.cyl(-.9, 1.8, 2.6, 0, .14, .12, 6); geo.cactus = b.build();
    b = new GeoB(); b.color('#7a6a58'); b.add(new THREE.IcosahedronGeometry(1, 0), M4(0, .3, 0, 0, 0, 0, 1.2, .8, 1)); geo.rock = b.build();
    b = new GeoB(); b.color('#5a6a34'); b.add(new THREE.IcosahedronGeometry(.8, 0), M4(0, .4, 0, 0, 0, 0, 1, .6, 1)).add(new THREE.IcosahedronGeometry(.6, 0), M4(.5, .35, .2, 0, 0, 0, 1, .6, 1)); geo.bush = b.build();
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .95, metalness: 0, flatShading: true }); const m4 = new THREE.Matrix4(), col = new THREE.Color();
    for (const t in geo) { const L = this.props[t]; if (!L.length) continue; const cells = new Map(); for (const it of L) { const k = Math.floor((it[0] + WR) / 500) * 100 + Math.floor((it[2] + WR) / 500); if (!cells.has(k)) cells.set(k, []); cells.get(k).push(it); }
      for (const C of cells.values()) { const im = new THREE.InstancedMesh(geo[t], mat, C.length); C.forEach(([x, h, z, s, r], i) => { m4.compose(V3(x, h - .1, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(t === 'rock' ? r : 0, r * TAU, 0)), V3(s, t === 'rock' ? s * .7 : s, s)); im.setMatrixAt(i, m4); col.setHSL(t === 'pine' ? .28 + r * .06 : t === 'cactus' ? .3 : t === 'rock' ? .07 : .2 + r * .08, t === 'rock' ? .2 : .35, t === 'rock' ? .42 + r * .12 : .5 + r * .2); im.setColorAt(i, col); }); im.castShadow = t !== 'bush'; im.receiveShadow = true; im.computeBoundingSphere(); this.group.add(im); } }
  }
  // drawn into the HUD map (x, z world -> canvas)
  bake(x, X, k) {
    const res = 8, n = WR * 2 / res, c = document.createElement('canvas'); c.width = c.height = n; const cx = c.getContext('2d'), img = cx.createImageData(n, n), D = img.data;
    const COL = { 0: [12, 36, 48], 1: [74, 72, 46], 2: [38, 62, 34], 3: [150, 124, 84], 4: [72, 72, 66], 5: [112, 88, 66] };
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const wx = -WR + i * res, wz = -WR + j * res, o = (j * n + i) * 4; if (Math.max(Math.abs(wx), Math.abs(wz)) < 900) { D[o + 3] = 0; continue; } const h = height(wx, wz), b = biome(wx, wz, h), C = COL[b]; const sh = b === 0 ? 1 : .8 + clamp(h / 90, 0, .4); D[o] = C[0] * sh; D[o + 1] = C[1] * sh; D[o + 2] = C[2] * sh; D[o + 3] = 255; }
    cx.putImageData(img, 0, 0); x.imageSmoothingEnabled = true; x.drawImage(c, X(-WR), X(-WR), WR * 2 * k, WR * 2 * k);
    x.strokeStyle = '#2a2c30'; x.lineCap = 'round'; x.lineJoin = 'round'; for (const pass of [0, 1]) { x.lineWidth = (pass ? 9 : 15) * k; x.strokeStyle = pass ? '#8a8270' : '#24262a'; for (const r of ROADS) { x.beginPath(); r.pts.forEach((p, i) => i ? x.lineTo(X(p[0]), X(p[1])) : x.moveTo(X(p[0]), X(p[1]))); x.stroke(); } }
    x.strokeStyle = '#ff5040'; x.lineWidth = 6 * k; x.strokeRect(X(BASE.x0), X(BASE.z0), (BASE.x1 - BASE.x0) * k, (BASE.z1 - BASE.z0) * k); x.fillStyle = 'rgba(255,60,40,.08)'; x.fillRect(X(BASE.x0), X(BASE.z0), (BASE.x1 - BASE.x0) * k, (BASE.z1 - BASE.z0) * k);
    x.strokeStyle = '#c84a2a'; x.lineWidth = 14 * k; x.beginPath(); x.moveTo(X(this.deck.x0), X(this.deck.z)); x.lineTo(X(this.deck.x1), X(this.deck.z)); x.stroke();
    x.fillStyle = 'rgba(255,255,255,.75)'; x.textAlign = 'center'; x.font = `700 ${Math.round(60 * k)}px Bahnschrift,sans-serif`; for (const [t, px, pz] of [['FORT FORTIS', 0, -1960], ['HALFMOON RIDGE', 1750, -2250], ['THE DRY MARGIN', -1700, 2250], ['NORTHERN SCRUB', -1300, -1600]]) x.fillText(t, X(px), X(pz));
  }
}
// gameplay queries
export const world = {
  // dirt, sand and grass: less grip, dusty
  offroad(x, z) { if (x > 3500) return false; const d = Math.max(Math.abs(x), Math.abs(z)); if (d <= 725) return false; if (d <= 905) return true; if (x > BASE.x0 && x < BASE.x1 && z > BASE.z0 && z < BASE.z1) return false; const r = nearRoad(x, z, 9); return !(r && r.d < HW + 1.5); },
  sea(x, z) { return x < 3500 && G.phys.baseGround(x, z) < WATER_Y - .4; },
  district(x, z) { if (Math.max(Math.abs(x), Math.abs(z)) < 760 || x > 3500) return null; const h = height(x, z); if (h < WATER_Y) return null; if (x > BASE.x0 - 20 && x < BASE.x1 + 20 && z > BASE.z0 - 20 && z < BASE.z1 + 20) return 'F'; if (landD(x, z) > .5) return 'Y'; if (reserveW(x) > .5) return 'X'; return 'W'; },
  inBase(x, z) { return x > BASE.x0 && x < BASE.x1 && z > BASE.z0 && z < BASE.z1; },
};
