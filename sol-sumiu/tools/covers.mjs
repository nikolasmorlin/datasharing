// Video covers per brand manual (08 · capas): node tools/covers.mjs
import { createRequire } from 'node:module'; import { startServer } from './serve.mjs';
const { chromium } = createRequire(import.meta.url)('playwright');
const C = [['1', 'e se o sol sumisse agora?'], ['2', 'quanto tempo até o frio chegar?'], ['3', 'onde ainda existe calor?']];
const { srv, port } = await startServer(0); const b = await chromium.launch(); const page = await b.newPage({ viewport: { width: 540, height: 960 }, deviceScaleFactor: 2 });
for (const [n, t] of C) { await page.goto(`http://127.0.0.1:${port}/src/cover.html?rot=${encodeURIComponent('Ficção · parte ' + n)}&t=${encodeURIComponent(t)}`); await page.waitForFunction('window.READY');
  await page.locator('#c').screenshot({ path: `videos/capa-parte-${n}.png` }); console.log('capa', n); }
await b.close(); srv.close();
