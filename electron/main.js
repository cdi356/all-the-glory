// ALL THE GLORY desktop app: one window running the game, plus the LAN server and room-code finder for co-op.
const { app, BrowserWindow, ipcMain, Menu, shell } = require('electron');
const path = require('path'), http = require('http'), fs = require('fs'), dgram = require('dgram'), os = require('os');
const { attach, addresses } = require('../tools/lan-core.js');

const DISC = 47788; // UDP port for "who has code ABCD?"
const GAME = path.join(__dirname, '../dist/all-the-glory.html');
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-background-timer-throttling');
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('enable-gpu-rasterization');
let win = null;

function createWindow() {
  Menu.setApplicationMenu(null);
  win = new BrowserWindow({
    width: 1600, height: 900, minWidth: 960, minHeight: 540, backgroundColor: '#06070a', title: 'ALL THE GLORY', autoHideMenuBar: true, show: false,
    icon: path.join(__dirname, 'icon.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.js'), backgroundThrottling: false, contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  win.once('ready-to-show', () => { win.maximize(); win.show(); });
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:/.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('before-input-event', (e, i) => { if (i.type === 'keyDown' && (i.key === 'F11' || (i.alt && i.key === 'Enter'))) { win.setFullScreen(!win.isFullScreen()); e.preventDefault(); } });
  win.loadFile(GAME);
}

// ---------------- LAN host ----------------
let server = null, udp = null, beacon = null, code = null, port = 0;
function broadcasts() { const out = new Set(['255.255.255.255']); const ifs = os.networkInterfaces(); for (const n in ifs) for (const a of ifs[n]) { if (a.internal || !(a.family === 'IPv4' || a.family === 4) || !a.netmask) continue; const ip = a.address.split('.').map(Number), m = a.netmask.split('.').map(Number); out.add(ip.map((b, i) => (b | (~m[i] & 255)) & 255).join('.')); } return [...out]; }
function stopHost() { if (beacon) clearInterval(beacon); beacon = null; if (udp) try { udp.close(); } catch (e) { /* closed */ } udp = null; if (server) try { server.close(); } catch (e) { /* closed */ } server = null; code = null; }
function listen(p) {
  return new Promise(res => {
    const s = http.createServer((req, r) => { // also serves the game, so a friend without the .exe can play in Chrome or Edge
      const u = req.url.split('?')[0]; if (u !== '/' && u !== '/index.html') { r.writeHead(404); return r.end(); }
      fs.readFile(GAME, (e, b) => { if (e) { r.writeHead(500); return r.end(); } r.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }); r.end(b); });
    });
    attach(s, p); s.once('error', () => res(null)); s.listen(p, '0.0.0.0', () => res(s));
  });
}
async function hostLan(c) {
  stopHost(); code = String(c || '').toUpperCase().slice(0, 4);
  for (let p = 5188; p < 5200 && !server; p++) { server = await listen(p); if (server) port = p; }
  if (!server) return { ok: false, why: 'Another program is using the network ports 5188-5199.' };
  const msg = () => Buffer.from('ATG!' + code + ':' + port + ':' + addresses().join(','));
  udp = dgram.createSocket({ type: 'udp4', reuseAddr: true });
  udp.on('message', (m, r) => { if (m.toString() === 'ATG?' + code) udp.send(msg(), r.port, r.address); });
  udp.on('error', () => { /* discovery is a convenience; the address still works */ });
  udp.bind(DISC, () => { try { udp.setBroadcast(true); } catch (x) { /* ok */ } });
  beacon = setInterval(() => { if (!udp) return; for (const b of broadcasts()) try { udp.send(msg(), DISC, b); } catch (x) { /* no route */ } }, 1000);
  return { ok: true, port, ips: addresses() };
}
ipcMain.handle('lan-host', (e, c) => hostLan(c));
ipcMain.handle('lan-stop', () => { stopHost(); return true; });
const findLan = c => new Promise(res => {
  const want = 'ATG!' + String(c || '').toUpperCase() + ':'; let done = false; const socks = [];
  const finish = v => { if (done) return; done = true; clearInterval(iv); clearTimeout(to); for (const s of socks) try { s.close(); } catch (x) { /* closed */ } res(v); };
  const mine = addresses().map(a => a.split('.').slice(0, 3).join('.'));
  const onMsg = (m, r) => { const t = m.toString(); if (!t.startsWith(want)) return; const [p, list] = t.slice(want.length).split(':'); const ips = [r.address, ...String(list || '').split(',').filter(Boolean)]; const ip = ips.find(a => mine.includes(a.split('.').slice(0, 3).join('.')) && !/^172\.(1[6-9]|2\d|3[01])\./.test(a)) || ips.find(a => mine.includes(a.split('.').slice(0, 3).join('.'))) || r.address; finish({ ip, port: +p || 5188 }); };
  const ask = dgram.createSocket({ type: 'udp4', reuseAddr: true }); socks.push(ask); ask.on('message', onMsg); ask.on('error', () => { }); ask.bind(0, () => { try { ask.setBroadcast(true); } catch (x) { /* ok */ } send(); });
  const hear = dgram.createSocket({ type: 'udp4', reuseAddr: true }); socks.push(hear); hear.on('message', onMsg); hear.on('error', () => { }); try { hear.bind(DISC); } catch (x) { /* port busy */ }
  const q = Buffer.from('ATG?' + String(c || '').toUpperCase()); const send = () => { for (const b of broadcasts()) try { ask.send(q, DISC, b); } catch (x) { /* no route */ } };
  const iv = setInterval(send, 350), to = setTimeout(() => finish(null), 7000);
});
ipcMain.handle('lan-find', (e, c) => findLan(c));
ipcMain.handle('quit', () => app.quit());
ipcMain.handle('fullscreen', (e, on) => { if (win) win.setFullScreen(on === undefined ? !win.isFullScreen() : !!on); return win && win.isFullScreen(); });

// end-to-end test: two copies of the app, one hosts and one joins by code (ATG_E2E=host|join, ATG_E2E_FILE=code file)
if (process.env.ATG_E2E) app.whenReady().then(async () => {
  createWindow(); win.once('ready-to-show', () => { win.unmaximize(); win.setBounds({ x: -3000, y: 0, width: 900, height: 600 }); });
  const role = process.env.ATG_E2E, file = process.env.ATG_E2E_FILE, ex = js => win.webContents.executeJavaScript(js, true), sleep = t => new Promise(r => setTimeout(r, t));
  const until = async (js, ms = 30000) => { const t0 = Date.now(); for (;;) { let v; try { v = await ex(js); } catch (e) { v = null; } if (v) return v; if (Date.now() - t0 > ms) throw new Error('timeout: ' + js); await sleep(250); } };
  const log = (...a) => console.log('E2E', role, ...a);
  try {
    const t0 = Date.now(); await new Promise(r => win.webContents.once('did-finish-load', r)); await until("window.G && G.state === 'menu'"); log('menu after', Date.now() - t0, 'ms'); await ex("window.ERRS = []; addEventListener('error', e => ERRS.push(e.message)); addEventListener('unhandledrejection', e => ERRS.push(String(e.reason))); 1");
    if (role === 'host') {
      await ex("G.menus.sub('LAN co-op', p => G.menus.lanTitle(p, false)); document.querySelector('[data-h]').click(); 1");
      const code = await until('G.net.host && G.net.code'); fs.writeFileSync(file, code); log('code', code);
      for (let k = 0; k < 8; k++) { await sleep(3000); log('peers', await ex('JSON.stringify([...G.net.peers.values()].map(p => ({ id: p.id, want: p.want })))')); if (await ex('[...G.net.peers.values()].some(p => p.want)')) break; } await until('[...G.net.peers.values()].some(p => p.want)', 60000); log('joiner picked', await ex('[...G.net.peers.values()].map(p => p.name + ":" + p.want).join()'));
      await ex("document.querySelector('[data-g=new]').click(); 1"); await until('[...G.net.peers.values()].some(p => p.ctx)', 30000); log('joiner is in the game');
      await sleep(8000); log('result', await ex("JSON.stringify({ state: G.state, players: G.coop.ctxs.length, remote: G.coop.ctxs.filter(c => c.remote).map(c => c.player.charId), errs: ERRS })"));
    } else {
      let code = null; for (let k = 0; k < 120 && !code; k++) { try { code = fs.readFileSync(file, 'utf8').trim(); } catch (e) { /* not yet */ } if (!code) await sleep(500); }
      await ex(`G.menus.sub('LAN co-op', p => G.menus.lanTitle(p, false)); document.querySelector('[data-code]').value = '${code}'; document.querySelector('[data-name]').value = 'Laptop'; document.querySelector('[data-j]').click(); 1`);
      const tj = Date.now(); await until('G.net.ws && G.net.ws.readyState === 1', 30000); log('ws open after', Date.now() - tj, 'ms'); await until("!!document.querySelector('[data-c]:not([disabled])')", 30000); log('lobby after', Date.now() - tj, 'ms'); const pickd = await ex("(() => { const b = document.querySelector('[data-c]:not([disabled])'); const id = b.dataset.c; b.click(); return id; })()"); log('picked', pickd);
      await until('!!(G.net.client && G.player)', 60000); log('in game as', await ex('G.player.charId'));
      await sleep(8000); log('result', await ex("JSON.stringify({ state: G.state, me: G.player.charId, actors: G.net.E.size, rtt: Math.round(G.net.rtt || 0), errs: ERRS })"));
    }
  } catch (e) { log('FAIL', String(e)); try { log('dom', await ex("(() => { const l = document.querySelector('[data-l]'); return document.querySelectorAll('.scr').length + ' scr; data-l: ' + (l ? l.outerHTML.slice(0, 600) : 'none'); })()")); log('lead', await ex("(document.querySelector('[data-e]') || {}).textContent")); log('screen', await ex("(document.querySelector('.scr .pane') || document.body).innerText.slice(0, 400)")); log('net', await ex('JSON.stringify({ role: G.net.role, code: G.net.code, ws: !!G.net.ws, errs: window.ERRS })')); } catch (x) { /* window gone */ } }
  await sleep(500); app.quit();
});
else if (process.env.ATG_SELFTEST) app.whenReady().then(async () => { const h = await hostLan('T3ST'); const f = await findLan('T3ST'); const miss = await findLan('ZZZZ'); console.log('SELFTEST', JSON.stringify({ h, f, miss })); stopHost(); app.quit(); });
else app.whenReady().then(createWindow);
app.on('window-all-closed', () => { stopHost(); app.quit(); });
