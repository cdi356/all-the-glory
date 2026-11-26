// Bundles src/ into a single self-contained dist/all-the-glory.html (playable by double-click).
const esbuild = require('esbuild'), fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
// same source -> same id, so two computers can tell whether they run the same game
function srcHash() { const h = require('crypto').createHash('sha1'); const walk = d => fs.readdirSync(d).sort().forEach(f => { const q = path.join(d, f); fs.statSync(q).isDirectory() ? walk(q) : h.update(fs.readFileSync(q)); }); walk(path.join(root, 'src')); return h.digest('hex').slice(0, 10); }
function build() {
  const r = esbuild.buildSync({
    entryPoints: [path.join(root, 'src/main.js')], bundle: true, write: false, format: 'iife',
    target: ['chrome100', 'firefox100', 'safari15'], minify: !process.argv.includes('--debug'), legalComments: 'none',
    define: { __BUILD__: JSON.stringify(srcHash()) },
  });
  const js = r.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
  const css = fs.readFileSync(path.join(root, 'src/ui/style.css'), 'utf8');
  const tpl = fs.readFileSync(path.join(root, 'src/index.html'), 'utf8');
  const out = tpl.replace('/*__CSS__*/', () => css).replace('/*__JS__*/', () => js);
  fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
  fs.writeFileSync(path.join(root, 'dist/all-the-glory.html'), out);
  return out.length;
}
module.exports = { build };
if (require.main === module) console.log('built dist/all-the-glory.html', (build() / 1024).toFixed(0) + ' KB');
