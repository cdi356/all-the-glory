// Additions to the city: the big central park (3 x 3 blocks, roads inside removed) and enterable skyscrapers.
import * as THREE from 'three';
import { GeoB, rng, M4, V3, TAU } from '../core/util.js';
import { roadC, blockC } from './citydata.js';

export const PARK = { x0: roadC(5) + 10, x1: roadC(8) - 10, z0: roadC(6) + 10, z1: roadC(9) - 10, cx: (roadC(5) + roadC(8)) / 2, cz: (roadC(6) + roadC(9)) / 2, lake: 50 };
export const inPark = (x, z) => x > PARK.x0 && x < PARK.x1 && z > PARK.z0 && z < PARK.z1;
// edges of the road graph that the park swallowed
export const PARK_EDGES = ['v6,6', 'v6,7', 'v6,8', 'v7,6', 'v7,7', 'v7,8', 'h5,7', 'h6,7', 'h7,7', 'h5,8', 'h6,8', 'h7,8'];
export const PARK_NODES = new Set(['6,7', '7,7', '6,8', '7,8']);

function textPlane(text, color, w, h, bg = '#000', add = true) {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 160; const x = c.getContext('2d'); x.fillStyle = bg; x.fillRect(0, 0, 1024, 160); x.font = '900 104px Bahnschrift,Impact,sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.shadowColor = color; x.shadowBlur = add ? 24 : 0; x.fillStyle = color; const k = Math.min(1, 980 / x.measureText(text).width); x.translate(512, 84); x.scale(k, 1); x.fillText(text, 0, 0);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial(add ? { map: t, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, side: THREE.DoubleSide } : { map: t, side: THREE.DoubleSide }));
}

export function installCityPlus(City) {
  const P = City.prototype;
  P.bigPark = function () {
    this.parkRect = PARK; const g = new GeoB({ aB: 4 }), ph = this.phys, R = rng(9090), K = PARK, cx = K.cx, cz = K.cz, LR = K.lake;
    g.color('#77756a').set('aB', 14, 0, 0, 0).box(K.x0 - 10, -.4, K.z0 - 10, K.x1 + 10, .18, K.z1 + 10);
    g.color('#fff').set('aB', 9, 0, 0, 0).box(K.x0, .18, K.z0, K.x1, .24, K.z1);
    const pave = '#8a8474', path = (x0, z0, x1, z1) => g.color(pave).set('aB', 14, 0, 0, 0).box(x0, .24, z0, x1, .27, z1);
    path(K.x0, K.z0, K.x1, K.z0 + 5); path(K.x0, K.z1 - 5, K.x1, K.z1); path(K.x0, K.z0, K.x0 + 5, K.z1); path(K.x1 - 5, K.z0, K.x1, K.z1); // perimeter promenade
    path(cx - 3, K.z0, cx + 3, cz - LR - 22); path(cx - 3, cz + LR + 22, cx + 3, K.z1); path(K.x0, cz - 3, cx - LR - 22, cz + 3); path(cx + LR + 22, cz - 3, K.x1, cz + 3);
    // ring path around the lake
    const ring = (r0, r1, y0, y1, col, st = 14, n = 48) => { g.color(col).set('aB', st, 0, 0, 0); for (let k = 0; k < n; k++) { const a = k / n * TAU, b = (k + 1) / n * TAU; g.quad([cx + Math.cos(a) * r1, y1, cz + Math.sin(a) * r1], [cx + Math.cos(b) * r1, y1, cz + Math.sin(b) * r1], [cx + Math.cos(b) * r0, y0, cz + Math.sin(b) * r0], [cx + Math.cos(a) * r0, y0, cz + Math.sin(a) * r0], undefined, [0, 1, 0]); } };
    ring(LR + 16, LR + 22, .27, .27, pave);
    // the lake: water, stone rim with colliders, an island gazebo and a footbridge from the east
    g.color('#ffffff').set('aB', 13, 0, 0, 0); for (let k = 0; k < 48; k++) { const a = k / 48 * TAU, b = (k + 1) / 48 * TAU; g.quad([cx, .262, cz], [cx + Math.cos(b) * LR, .262, cz + Math.sin(b) * LR], [cx + Math.cos(a) * LR, .262, cz + Math.sin(a) * LR], [cx, .262, cz], undefined, [0, 1, 0]); }
    g.color('#9a9484').set('aB', 0, 0, 0, 0); for (let k = 0; k < 40; k++) { const a = (k + .5) / 40 * TAU, x = cx + Math.cos(a) * (LR + .6), z = cz + Math.sin(a) * (LR + .6); g.add(new THREE.BoxGeometry(8.4, .7, 1.2), M4(x, .45, z, 0, -a + Math.PI / 2, 0)); if (Math.abs(Math.sin(a)) < .12 && Math.cos(a) > 0) continue; ph.addBox(x - 2.6, 0, z - 2.6, x + 2.6, .9, z + 2.6, { noSight: true }); }
    g.color('#6a8a4a').set('aB', 9, 0, 0, 0).cyl(cx, 0, .5, cz, 15, 14, 24); ph.addBox(cx - 10, 0, cz - 10, cx + 10, .5, cz + 10); g.color('#e8e0d0').set('aB', 0, 0, 0, 0); for (let k = 0; k < 8; k++) { const a = k / 8 * TAU; g.cyl(cx + Math.cos(a) * 6, .5, 4.6, cz + Math.sin(a) * 6, .22, .22, 8); ph.addBox(cx + Math.cos(a) * 6 - .25, 0, cz + Math.sin(a) * 6 - .25, cx + Math.cos(a) * 6 + .25, 4.6, cz + Math.sin(a) * 6 + .25, { noSight: true }); } g.color('#8a3a2a'); g.add(new THREE.ConeGeometry(8.2, 3.2, 8), M4(cx, 6.2, cz, 0, Math.PI / 8, 0)); g.color('#ffd24a').set('aB', 6, 0, 1.2, 0).cbox(cx, 7.9, cz, .5, .5, .5);
    g.color('#7a5a3a').set('aB', 0, 0, 0, 0).box(cx + 14, .45, cz - 2, cx + LR + 2, .6, cz + 2); ph.addBox(cx + 14, 0, cz - 2, cx + LR + 2, .6, cz + 2); for (const s of [-1, 1]) { g.box(cx + 14, .6, cz + s * 2 - .08, cx + LR + 2, 1.5, cz + s * 2 + .08); ph.addBox(cx + 14, 0, cz + s * 2 - .1, cx + LR + 2, 1.5, cz + s * 2 + .1, { noSight: true }); }
    for (let k = 0; k < 6; k++) { const a = k / 6 * TAU + .3; this.duckSpots.push([cx + Math.cos(a) * LR * .7, .4, cz + Math.sin(a) * LR * .7]); }
    // north plaza fountain
    const fz = K.z0 + 26; g.color('#9a9484').set('aB', 0, 0, 0, 0).cyl(cx, .24, .95, fz, 10, 10, 28); g.color('#fff').set('aB', 13, 0, 0, 0).cyl(cx, .95, 1, fz, 9.4, 9.4, 28); g.color('#b0a894').set('aB', 0, 0, 0, 0).cyl(cx, .95, 3.6, fz, 1, .7, 12).cyl(cx, 3.6, 3.9, fz, 3, 3, 16); ph.addBox(cx - 8, 0, fz - 8, cx + 8, 1, fz + 8); g.color('#ffd24a').set('aB', 6, 0, .5, 0); g.cbox(cx, 4.8, fz, .9, 2.2, .7); g.add(new THREE.SphereGeometry(.5, 12, 8), M4(cx, 6.4, fz)); this.duckSpots.push([cx, 7, fz]);
    const ps = textPlane('SAINT VESPER CENTRAL PARK', '#f0e8c8', 22, 2.2, '#2a3a24', false); ps.position.set(cx, 3.2, K.z0 - .3); this.group.add(ps); g.color('#3a3a34').set('aB', 0, 0, 0, 0).box(cx - 12, .2, K.z0 - .6, cx - 11, 4.6, K.z0).box(cx + 11, .2, K.z0 - .6, cx + 12, 4.6, K.z0);
    // east bandstand
    const bx = K.x1 - 45, bz = cz; g.color('#d8d0c0').set('aB', 0, 0, 0, 0).cyl(bx, .24, 1.4, bz, 12, 12, 20); ph.addBox(bx - 9, 0, bz - 9, bx + 9, 1.4, bz + 9); for (let k = 0; k < 10; k++) { const a = Math.PI / 2 + (k / 9 - .5) * Math.PI; g.color('#e8e0d0').cyl(bx + Math.cos(a) * 11, 1.4, 7.4, bz + Math.sin(a) * 11, .3, .3, 8); } g.color('#7a3030'); g.add(new THREE.SphereGeometry(12.5, 20, 8, 0, TAU, 0, Math.PI / 2), M4(bx, 7.2, bz, 0, 0, 0, 1, .4, 1)); for (let r = 0; r < 4; r++) for (let k = -3; k <= 3; k++) this.queue('bench', M4(bx - 22 - r * 4, .24, bz + k * 4, 0, -Math.PI / 2, 0));
    // south-west playground
    const qx = K.x0 + 45, qz = K.z1 - 45; g.color('#c86a3a').set('aB', 0, 0, 0, 0).box(qx - 18, .24, qz - 14, qx + 18, .3, qz + 14); for (const [c, x0] of [['#3a6ac8', -12], ['#c8c03a', 0], ['#3ac86a', 12]]) { g.color(c).box(qx + x0 - 3, .3, qz - 6, qx + x0 - 2.7, 3.6, qz - 5.7).box(qx + x0 + 2.7, .3, qz - 6, qx + x0 + 3, 3.6, qz - 5.7).box(qx + x0 - 3, 3.5, qz - 6, qx + x0 + 3, 3.7, qz - 5.7); } g.color('#e84a4a').box(qx - 4, .3, qz + 3, qx + 4, 3, qz + 8); g.color('#f0c030'); g.quad([qx + 4, 3, qz + 3], [qx + 4, 3, qz + 8], [qx + 14, .3, qz + 8], [qx + 14, .3, qz + 3]); ph.addBox(qx - 4, 0, qz + 3, qx + 4, 3, qz + 8);
    // south statue of the founder (it's Larry, obviously)
    const sx = cx, sz = K.z1 - 22; this.statue = V3(sx, 0, sz + 4); g.color('#6a6458').set('aB', 0, 0, 0, 0).box(sx - 3, .24, sz - 3, sx + 3, 4, sz + 3); ph.addBox(sx - 3, 0, sz - 3, sx + 3, 4, sz + 3); g.color('#c9a24a').set('aB', 6, 0, .25, 0).cyl(sx, 4, 7.4, sz, .9, .7, 10).cyl(sx - .45, 4, 5.6, sz, .32, .3, 8).add(new THREE.SphereGeometry(.75, 12, 10), M4(sx, 8.2, sz)); g.add(new THREE.BoxGeometry(2.6, .3, .3), M4(sx, 6.8, sz, 0, 0, .5)); g.color('#ff2020').set('aB', 6, 0, 3, 0).cbox(sx + .3, 8.35, sz + .68, .12, .08, .05);
    // west dog park
    const dx = K.x0 + 40, dz = cz - 60; g.color('#5a5a5a').set('aB', 0, 0, 0, 0); for (const [a, b, c, d] of [[dx - 25, dz - 20, dx + 25, dz - 19.8], [dx - 25, dz + 19.8, dx - 5, dz + 20], [dx + 5, dz + 19.8, dx + 25, dz + 20], [dx - 25, dz - 20, dx - 24.8, dz + 20], [dx + 24.8, dz - 20, dx + 25, dz + 20]]) { g.box(a, .24, b, c, 1.4, d); ph.addBox(a, 0, b, c, 1.4, d, { noSight: true }); }
    // trees, benches, lamps
    const clear = (x, z) => { const r = Math.hypot(x - cx, z - cz); if (r < LR + 26) return false; if (Math.abs(x - cx) < 7 || Math.abs(z - cz) < 7) return false; if (x < K.x0 + 8 || x > K.x1 - 8 || z < K.z0 + 8 || z > K.z1 - 8) return false; for (const [ax, az, rr] of [[cx, fz, 16], [bx, bz, 38], [qx, qz, 24], [sx, sz, 12], [dx, dz, 30]]) if (Math.hypot(x - ax, z - az) < rr) return false; return true; };
    let n = 0; for (let k = 0; k < 2000 && n < 240; k++) { const x = R.range(K.x0, K.x1), z = R.range(K.z0, K.z1); if (!clear(x, z)) continue; this.tree(x, z, R, R.range(1.1, 1.6)); n++; }
    for (let k = 0; k < 24; k++) { const a = k / 24 * TAU, r = LR + 24, x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r; if (k % 2) this.queue('bench', M4(x, .24, z, 0, -a - Math.PI / 2, 0)); else { const i = this.queue('lamp', M4(x, .24, z, 0, -a + Math.PI / 2, 0)); ph.addBox(x - .16, 0, z - .16, x + .16, 6, z + .16, { noSight: true, smash: { type: 'lamp', i, x, z } }); this.lampSpots.push([x, z]); } }
    for (let t = K.x0 + 10; t < K.x1; t += 30) for (const z of [K.z0 + 2.5, K.z1 - 2.5]) { const i = this.queue('lamp', M4(t, .24, z, 0, z < cz ? 0 : Math.PI, 0)); ph.addBox(t - .16, 0, z - .16, t + .16, 6, z + .16, { noSight: true, smash: { type: 'lamp', i, x: t, z } }); }
    const m = new THREE.Mesh(g.build(), this.mat); m.receiveShadow = true; m.castShadow = true; m.matrixAutoUpdate = false; this.group.add(m);
  };
  // glass skyscraper with podium, setbacks, crown and a roof you can reach by elevator
  P.skyBuild = function (p, g, L, R) {
    const cx = p.x, cz = p.z, H = p.h, ph = this.phys, tone = p.tone, trim = p.trim; g.color('#7a786e').set('aB', 14, 0, 0, 0).box(L.x0, .18, L.z0, L.x1, .3, L.z1);
    this.tier(g, cx - 28, .18, cz - 28, cx + 28, 14, cz + 28, 2, 31, .7, 4.6, '#3a3c42'); g.color(trim).set('aB', 6, 0, 1.6, 0).box(cx - 28.2, 13.4, cz - 28.2, cx + 28.2, 14, cz + 28.2, { noTop: true });
    const T = [[24, 14, H * .42], [20, H * .42, H * .74], [16, H * .74, H]]; for (const [h, a, b] of T) { this.tier(g, cx - h, a, cz - h, cx + h, b, cz + h, 1, Math.floor(R() * 99), .55, 4, tone); g.color(trim).set('aB', 6, 0, 1.8, 0); for (const sx of [-1, 0, 1]) for (const sz of [-1, 1]) { if (sx === 0) { g.cbox(cx, (a + b) / 2, cz + sz * h, .5, b - a, .5); g.cbox(cx + sz * h, (a + b) / 2, cz, .5, b - a, .5); continue; } g.cbox(cx + sx * h, (a + b) / 2, cz + sz * h, .9, b - a, .9); } g.box(cx - h - .3, b - 1.2, cz - h - .3, cx + h + .3, b - .7, cz + h + .3); this.buildings.push([cx - h, cz - h, cx + h, cz + h, b]); }
    // roof: parapet, helipad, crown mast
    const y = H; g.color('#4a4c52').set('aB', 0, 0, 0, 0); for (const [a, b, c, e] of [[-16, -16, 16, -15.4], [-16, 15.4, 16, 16], [-16, -16, -15.4, 16], [15.4, -16, 16, 16]]) { g.box(cx + a, y, cz + b, cx + c, y + 1.3, cz + e); ph.addBox(cx + a, y - 1, cz + b, cx + c, y + 1.3, cz + e); }
    g.color('#2c2e32').set('aB', 14, 0, 0, 0).cyl(cx - 5, y, y + .1, cz - 5, 8, 8, 20); g.color('#ffffff').set('aB', 6, 0, .9, 0).cyl(cx - 5, y + .1, y + .12, cz - 5, 6.6, 6.6, 20, false); g.box(cx - 7, y + .1, cz - 5.4, cx - 3, y + .13, cz - 4.6).box(cx - 7, y + .1, cz - 7.6, cx - 6.2, y + .13, cz - 2.4).box(cx - 3.8, y + .1, cz - 7.6, cx - 3, y + .13, cz - 2.4);
    g.color('#3a3c42').set('aB', 0, 0, 0, 0).box(cx + 6, y, cz + 6, cx + 12, y + 3.2, cz + 12); ph.addBox(cx + 6, y, cz + 6, cx + 12, y + 3.2, cz + 12); g.color(trim).set('aB', 6, 0, 2, 0).box(cx + 6, y + 2.6, cz + 11.9, cx + 12, y + 2.8, cz + 12.05);
    g.color('#c8ccd0').set('aB', 0, 0, 0, 0).cyl(cx + 10, y, y + 40, cz - 10, .6, .2, 8); g.color('#ff2020').set('aB', 12, 0, 5, 0).cbox(cx + 10, y + 40.4, cz - 10, .6, .6, .6);
    p.roof = V3(cx + 9, y + .2, cz + 14); // where the elevator lets you out
    // lobby entrance, canopy and name
    const z1 = cz + 28; g.color('#0c0d10').set('aB', 0, 0, 0, 0).box(cx - 4, .18, z1, cx + 4, 4.4, z1 + .12); g.color(trim).set('aB', 6, 0, 1.8, 0).box(cx - 4.3, .18, z1, cx - 4, 4.7, z1 + .3).box(cx + 4, .18, z1, cx + 4.3, 4.7, z1 + .3).box(cx - 4.3, 4.4, z1, cx + 4.3, 4.7, z1 + .3); g.color('#2a2c30').set('aB', 0, 0, 0, 0).box(cx - 8, 5.2, z1, cx + 8, 5.5, z1 + 5, { bottom: true });
    const s = textPlane(p.sign, trim, 22, 3.4); s.position.set(cx, 9.4, z1 + .4); this.group.add(s); const s2 = textPlane(p.sign, trim, 26, 4); s2.position.set(cx, H * .74 - 6, cz + 20.4); this.group.add(s2); const s3 = s2.clone(); s3.position.set(cx, H * .74 - 6, cz - 20.4); s3.rotation.y = Math.PI; this.group.add(s3);
  };
}
