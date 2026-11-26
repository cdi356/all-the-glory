// Dev server: rebuilds on every page load. `npm run dev` then open http://localhost:5199
const http = require('http'), fs = require('fs'), path = require('path');
const { build } = require('./build.js');
const port = +process.env.PORT || 5199;
const server = http.createServer((req, res) => {
  const url = req.url.split('?')[0];
  if (url === '/bot.js' || url === '/lantest.js') { res.writeHead(200, { 'Content-Type': 'text/javascript' }); return res.end(fs.readFileSync(path.join(__dirname, url.slice(1)))); }
  if (url !== '/' && url !== '/index.html') { res.writeHead(404); return res.end(); }
  try {
    build();
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(fs.readFileSync(path.join(__dirname, '../dist/all-the-glory.html')));
  } catch (e) { res.writeHead(500, { 'Content-Type': 'text/html' }); res.end('<pre>' + String(e.message || e).replace(/</g, '&lt;') + '</pre>'); console.error(e.message); }
});
require('./lan-core.js').attach(server, port);
server.listen(port, () => console.log('ALL THE GLORY dev server on http://localhost:' + port));
