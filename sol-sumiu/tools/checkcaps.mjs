// Checks every caption against the manual: max two lines, max one coral expression. node tools/checkcaps.mjs
import { openPart } from './common.mjs';
let bad = 0;
for (const p of [1, 2, 3]) {
  const { page, close } = await openPart(p, { dsf: .25, pr: 1, quiet: true });
  const res = await page.evaluate(() => { const el = document.getElementById('capin'); const out = [];
    for (const s of window.ENGINE.shots) for (const c of s.caps) { el.innerHTML = c.html; el.className = c.cls || ''; const lh = parseFloat(getComputedStyle(el).lineHeight); const pad = 25;
      const lines = Math.round((el.getBoundingClientRect().height - (c.cls ? 0 : pad)) / lh); out.push({ shot: s.name, raw: c.raw, lines, coral: (c.html.match(/<b>/g) || []).length, w: Math.round(el.getBoundingClientRect().width) }); }
    return out; });
  for (const r of res) { const ok = r.lines <= 2 && r.coral <= 1; if (!ok) bad++; console.log(`${ok ? '  ' : '!!'} p${p} ${r.shot.padEnd(11)} ${r.lines}L ${r.coral}c  ${r.raw}`); }
  await close();
}
console.log(bad ? `${bad} caption(s) break the manual` : 'all captions OK');
