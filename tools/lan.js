// LAN server: serves the built game to other computers and relays co-op traffic. Started by "HOST LAN GAME.bat".
const http = require('http'), fs = require('fs'), path = require('path');
const { attach, addresses } = require('./lan-core.js');
const port = +process.env.PORT || 5188, file = path.join(__dirname, '../dist/all-the-glory.html');
const server = http.createServer((req, res) => {
  const url = req.url.split('?')[0]; if (url !== '/' && url !== '/index.html') { res.writeHead(404); return res.end(); }
  fs.readFile(file, (e, b) => { if (e) { res.writeHead(500); return res.end('dist/all-the-glory.html is missing. Run: npm run build'); } res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(b); });
});
attach(server, port);
server.on('error', e => { if (e.code === 'EADDRINUSE') console.log('\n  The LAN server is already running in another window. You can close this one.\n'); else console.error(e.message); });
server.listen(port, '0.0.0.0', () => {
  const ips = addresses(); console.log('\n  ALL THE GLORY - LAN SERVER\n  Leave this window open while you play.\n'); console.log('  This computer: choose LAN co-op > Host in the game window.'); console.log('  The other computer: open this address in Chrome or Edge:\n'); if (!ips.length) console.log('    (no network found - connect to your Wi-Fi or router first)'); ips.forEach((ip, i) => console.log('    http://' + ip + ':' + port + (i === 0 && ips.length > 1 ? '     <- try this one first' : ''))); console.log('\n  If Windows asks about the firewall, allow Node.js on PRIVATE networks.\n');
});
