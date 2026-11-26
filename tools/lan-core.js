// Tiny dependency-free WebSocket relay for LAN co-op. One host (this computer), up to four joiners.
// Host -> server: {to: id|'*', m: {...}}    joiner -> server: {...}    server -> host: {from: id, m: {...}}
const crypto = require('crypto'), os = require('os');
const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
function addresses() { const out = []; const ifs = os.networkInterfaces(); for (const n in ifs) for (const a of ifs[n]) if ((a.family === 'IPv4' || a.family === 4) && !a.internal) out.push({ name: n, ip: a.address }); const score = a => (/^192\.168\./.test(a.ip) ? 0 : /^10\./.test(a.ip) ? 1 : /^172\.(1[6-9]|2\d|3[01])\./.test(a.ip) ? 2 : 5) + (/vEthernet|VMware|VirtualBox|Hyper-V|WSL|Loopback|Tailscale|ZeroTier/i.test(a.name) ? 10 : 0); return out.sort((a, b) => score(a) - score(b)).map(a => a.ip); }
const loop = ip => /^(::1|127\.|::ffff:127\.)/.test(ip || '');
function frame(str, op = 1) { const b = Buffer.isBuffer(str) ? str : Buffer.from(str), n = b.length; let h; if (n < 126) { h = Buffer.alloc(2); h[1] = n; } else if (n < 65536) { h = Buffer.alloc(4); h[1] = 126; h.writeUInt16BE(n, 2); } else { h = Buffer.alloc(10); h[1] = 127; h.writeUInt32BE(0, 2); h.writeUInt32BE(n, 6); } h[0] = 0x80 | op; return Buffer.concat([h, b]); }
class Conn {
  constructor(sock, onMsg, onClose) { this.s = sock; this.buf = Buffer.alloc(0); this.parts = []; this.open = true; sock.setNoDelay(true); sock.on('data', d => { this.buf = this.buf.length ? Buffer.concat([this.buf, d]) : d; if (this.buf.length > 8e6) return this.close(); this.parse(onMsg); }); const end = () => { if (this.open) { this.open = false; onClose(); } }; sock.on('close', end); sock.on('error', end); }
  parse(cb) { for (; ;) { const b = this.buf; if (b.length < 2) return; const fin = b[0] & 128, op = b[0] & 15, mask = b[1] & 128; let n = b[1] & 127, o = 2; if (n === 126) { if (b.length < 4) return; n = b.readUInt16BE(2); o = 4; } else if (n === 127) { if (b.length < 10) return; n = b.readUInt32BE(6); o = 10; if (b.readUInt32BE(2) || n > 8e6) return this.close(); } if (!mask) return this.close(); if (b.length < o + 4 + n) return; const k = b.slice(o, o + 4), p = Buffer.from(b.slice(o + 4, o + 4 + n)); for (let i = 0; i < n; i++) p[i] ^= k[i & 3]; this.buf = b.slice(o + 4 + n); if (op === 8) return this.close(); if (op === 9) { this.raw(frame(p, 10)); continue; } if (op === 10) continue; this.parts.push(p); if (fin) { const t = Buffer.concat(this.parts).toString(); this.parts = []; try { cb(t); } catch (e) { console.error('lan:', e.message); } } } }
  raw(f) { if (this.open) try { this.s.write(f); } catch (e) { /* closing */ } }
  send(str) { this.raw(frame(str)); }
  get lag() { return this.s.writableLength || 0; }
  close() { try { this.s.end(frame('', 8)); this.s.destroy(); } catch (e) { /* gone */ } }
}
function attach(server, port) {
  let host = null, next = 1; const joins = new Map(); const tell = (c, m) => c && c.send(JSON.stringify(m));
  server.on('upgrade', (req, sock) => {
    const url = req.url.split('?')[0], key = req.headers['sec-websocket-key'], org = req.headers.origin || ''; let ok = url === '/lan' && key; // only our own page (or the double-clicked file) may connect
    if (ok && org && org !== 'null' && !org.startsWith('file:')) { try { const oh = new URL(org); ok = oh.host === req.headers.host || (loop(sock.remoteAddress) && /^(localhost|127\.0\.0\.1)$/.test(oh.hostname)); } catch (e) { ok = false; } }
    if (!ok) { sock.end('HTTP/1.1 403 Forbidden\r\n\r\n'); return; }
    sock.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' + crypto.createHash('sha1').update(key + GUID).digest('base64') + '\r\n\r\n');
    let role = null, id = 0; const local = loop(sock.remoteAddress);
    const c = new Conn(sock, t => {
      if (!role) { const m = JSON.parse(t); if (m.t === 'host') { if (!local) return tell(c, { t: 'no', why: 'Only the computer running the server can host.' }); if (host && host.open) return tell(c, { t: 'no', why: 'A game is already being hosted.' }); role = 'host'; host = c; tell(c, { t: 'hosting', ips: addresses(), port }); for (const [i] of joins) tell(c, { from: i, m: { t: 'hello' } }); console.log('Game hosted.'); } else if (m.t === 'join') { if (joins.size >= 4) return tell(c, { t: 'no', why: 'The server is full.' }); role = 'join'; id = next++; joins.set(id, c); if (host && host.open) tell(host, { from: id, m: { t: 'hello' } }); else tell(c, { t: 'nohost' }); console.log('Player connected from ' + sock.remoteAddress); } return; }
      if (role === 'host') { // {to, m}: peel the small header without re-encoding the payload
        const i = t.indexOf('|'), to = t.slice(0, i), body = t.slice(i + 1), soft = body.startsWith('{"t":"s"'); if (to === '*') { for (const q of joins.values()) if (!(soft && q.lag > 400000)) q.send(body); } else { const q = joins.get(+to); if (q && !(soft && q.lag > 400000)) q.send(body); } } else if (host && host.open) host.send('{"from":' + id + ',"m":' + t + '}');
    }, () => { if (role === 'host') { host = null; for (const q of joins.values()) tell(q, { t: 'nohost' }); console.log('Host left.'); } else if (role === 'join') { joins.delete(id); tell(host, { from: id, m: { t: 'bye' } }); console.log('Player left.'); } });
  });
}
module.exports = { attach, addresses };
