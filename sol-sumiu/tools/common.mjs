import { createRequire } from 'node:module';
import { startServer } from './serve.mjs';
export const { chromium } = createRequire(import.meta.url)('playwright');
export const GL_ARGS = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-vsync', '--hide-scrollbars', '--force-color-profile=srgb'];
export async function openPart(part, { dsf = 2, pr = null, quiet = false } = {}) {
  const { srv, port } = await startServer(0);
  const browser = await chromium.launch({ args: GL_ARGS });
  const page = await browser.newPage({ viewport: { width: 540, height: 960 }, deviceScaleFactor: dsf });
  page.on('console', m => { const t = m.text(); if (!quiet || m.type() === 'error') { if (!/GPU stall|GL Driver Message/.test(t)) console.log('  [page]', t); } });
  page.on('pageerror', e => console.log('  [pageerror]', e.message));
  await page.goto(`http://127.0.0.1:${port}/src/index.html?part=${part}&pr=${pr ?? dsf}`);
  await page.waitForFunction('window.READY || window.BOOT_ERROR', null, { timeout: 120000 });
  const err = await page.evaluate('window.BOOT_ERROR');
  if (err) { await browser.close(); srv.close(); throw new Error('boot: ' + err); }
  const info = await page.evaluate('window.INFO');
  return { page, browser, info, close: async () => { await browser.close(); srv.close(); } };
}
