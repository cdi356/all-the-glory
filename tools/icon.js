// Draws the app icon (a gold coin with three bars for the three idiots) into electron/icon.png. No dependencies.
const fs = require('fs'), path = require('path'), zlib = require('zlib');
const S = 256, px = Buffer.alloc(S * S * 4);
const set = (x, y, r, g, b, a) => { const i = (y * S + x) * 4, A = a / 255, B = px[i + 3] / 255, o = A + B * (1 - A); if (o <= 0) return; px[i] = (r * A + px[i] * B * (1 - A)) / o; px[i + 1] = (g * A + px[i + 1] * B * (1 - A)) / o; px[i + 2] = (b * A + px[i + 2] * B * (1 - A)) / o; px[i + 3] = o * 255; };
const cov = (f, x, y) => { let n = 0; for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) if (f(x + (a + .5) / 4, y + (b + .5) / 4)) n++; return n / 16; };
const fill = (f, col) => { for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const c = cov(f, x, y); if (c > 0) set(x, y, ...col(x, y), 255 * c); } };
const rr = (x, y, x0, y0, x1, y1, r) => { const cx = Math.max(x0 + r, Math.min(x1 - r, x)), cy = Math.max(y0 + r, Math.min(y1 - r, y)); return (x - cx) ** 2 + (y - cy) ** 2 <= r * r; };
fill((x, y) => rr(x, y, 8, 8, 248, 248, 46), (x, y) => { const t = y / S; return [14 + 10 * t, 15 + 8 * t, 20 + 12 * t]; });
fill((x, y) => (x - 128) ** 2 + (y - 128) ** 2 <= 96 * 96, (x, y) => { const t = (x + y) / (2 * S); return [255 - 50 * t, 214 - 70 * t, 74 - 40 * t]; });
fill((x, y) => { const d = Math.hypot(x - 128, y - 128); return d <= 84 && d >= 76; }, () => [150, 104, 20]);
for (const [x, h] of [[96, 70], [128, 96], [160, 58]]) fill((X, Y) => rr(X, Y, x - 11, 128 + 40 - h, x + 11, 168, 5), () => [40, 26, 6]);
fill((x, y) => rr(x, y, 70, 172, 186, 182, 4), () => [40, 26, 6]);
const raw = Buffer.alloc((S * 4 + 1) * S); for (let y = 0; y < S; y++) { raw[y * (S * 4 + 1)] = 0; px.copy(raw, y * (S * 4 + 1) + 1, y * S * 4, (y + 1) * S * 4); }
const crcT = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = b => { let c = 0xffffffff; for (const v of b) c = crcT[(c ^ v) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(S, 0); ihdr.writeUInt32BE(S, 4); ihdr[8] = 8; ihdr[9] = 6;
const png = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
fs.writeFileSync(path.join(__dirname, '../electron/icon.png'), png); console.log('icon written');
