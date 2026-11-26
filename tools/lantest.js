// Dev helper: run a LAN host and a joiner side by side in one page. Load on the dev server, then:
//   await lanSetup(10, 'jakob');  await both(2);   // W is the joiner's window
window.LOG = [];
addEventListener('error', e => LOG.push('H ERR ' + e.message + ' ' + ((e.error && e.error.stack) || '').slice(0, 300)));
addEventListener('unhandledrejection', e => LOG.push('H REJ ' + (e.reason && e.reason.stack || e.reason)));
window.both = async s => { const t0 = performance.now(); while (performance.now() - t0 < s * 1000) { G.frame(1 / 30); W.G.frame(1 / 30); await new Promise(r => setTimeout(r, 14)); } };
window.lanSetup = async (mission, char) => {
  await G.test.fresh(mission); G.debug.auto = false; G.debug.norender = true; G.story.clear(); G.side.enc = 9999; G.player.pos.set(-262, .2, -120);
  const ok = await new Promise(r => G.net.startHost((o, w) => r(o + ' ' + (w || '')))); const f = window.F = document.createElement('iframe'); f.src = location.origin + '/'; f.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;border:0;z-index:99'; document.body.appendChild(f); await new Promise(r => f.onload = r); await new Promise(r => setTimeout(r, 2500)); const W = window.W = f.contentWindow;
  W.addEventListener('error', e => LOG.push('C ERR ' + e.message + ' ' + ((e.error && e.error.stack) || '').slice(0, 400))); W.addEventListener('unhandledrejection', e => LOG.push('C REJ ' + (e.reason && e.reason.stack || e.reason))); W.G.debug.manual = true; W.G.frame(1 / 60);
  W.G.menus.sub('LAN co-op', p => W.G.menus.lanJoin(p)); await both(1.6); const b = W.document.querySelector(`[data-c=${char}]`); window.joinText = W.document.querySelector('.scr .pane').textContent; if (b) b.click(); await both(1.8); window.c2 = G.coop.ctxs[1]; return ok + ' | ' + joinText + ' | ' + W.G.net.role;
};
