// Exports the caption/narration script with timestamps: node tools/script.mjs
import fs from 'node:fs'; import { openPart } from './common.mjs';
const f = s => { const m = Math.floor(s / 60); return `${m}:${(s - m * 60).toFixed(1).padStart(4, '0')}`; };
let md = '# O dia em que o Sol sumiu — roteiro com tempos\n\nCada linha é um bloco de legenda (tempo de entrada → texto). Serve de guia para gravar a narração.\n';
for (const p of [1, 2, 3]) { const { info, close } = await openPart(p, { dsf: .25, pr: 1, quiet: true }); await close();
  md += `\n## Parte ${p} (${f(info.duration)})\n\n`; for (const s of info.shots) for (const c of s.caps) md += `- \`${f(c.t0)}\` ${c.text}\n`; }
fs.writeFileSync('out/roteiro.md', md); console.log('wrote out/roteiro.md');
