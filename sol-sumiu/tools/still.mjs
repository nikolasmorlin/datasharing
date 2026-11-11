// Usage: node tools/still.mjs <part> <spec> [--dsf 0.5] [--cols 6] [--out sheet.jpg]
//   spec: "shots" (3 frames per shot) | "shot:<name>[:n]" (n frames across one shot) | "1.5,3,10" (seconds) | "range:a:b:n"
import fs from 'node:fs'; import path from 'node:path'; import { execFileSync } from 'node:child_process';
import { openPart } from './common.mjs';
const [part, spec = 'shots', ...rest] = process.argv.slice(2);
const opt = (k, d) => { const i = rest.indexOf('--' + k); return i >= 0 ? rest[i + 1] : d; };
const dsf = Number(opt('dsf', .5)), cols = Number(opt('cols', 6));
const out = opt('out', `/tmp/claude-0/-home-user-datasharing/8e34cf23-8b6d-5950-994d-34cbecd5a73f/scratchpad/still_p${part}.jpg`);
const { page, info, close } = await openPart(part, { dsf, pr: Math.max(dsf, 1) });
let times = [];
if (spec === 'shots') for (const s of info.shots) for (const f of [.12, .5, .9]) times.push(s.start + s.dur * f);
else if (spec === 'list') { for (const s of info.shots) console.log(s.start.toFixed(2).padStart(7), s.dur.toFixed(2).padStart(6), s.name, '|', s.caps.map(c => c.text).join(' / ')); console.log('TOTAL', info.duration.toFixed(2), 's', info.frames, 'frames'); await close(); process.exit(0); }
else if (spec.startsWith('shot:')) { const [, names, n = 6] = spec.split(':'); for (const name of names.split('+')) { const s = info.shots.find(s => s.name === name); if (!s) throw new Error('no shot ' + name); for (let i = 0; i < n; i++) times.push(s.start + s.dur * (i + .5) / n); } }
else if (spec.startsWith('range:')) { const [, a, b, n] = spec.split(':').map(Number); for (let i = 0; i < n; i++) times.push(a + (b - a) * i / (n - 1)); }
else times = spec.split(',').map(Number);
const dir = fs.mkdtempSync(path.join(path.dirname(out), 'st_'));
const t0 = Date.now();
for (let i = 0; i < times.length; i++) {
  const f = Math.round(times[i] * info.fps);
  await page.evaluate(f => window.renderFrame(f), f);
  await page.screenshot({ path: path.join(dir, `f_${String(i).padStart(3, '0')}.jpg`), type: 'jpeg', quality: 88 });
}
console.log(`${times.length} frames in ${((Date.now() - t0) / 1000).toFixed(1)}s; total ${info.duration.toFixed(1)}s`);
await close();
if (times.length === 1) fs.copyFileSync(path.join(dir, 'f_000.jpg'), out);
else { const rows = Math.ceil(times.length / cols); execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', path.join(dir, 'f_%03d.jpg'), '-vf', `tile=${Math.min(cols, times.length)}x${rows}:padding=4:color=0x333333`, '-frames:v', '1', '-q:v', '3', out]); }
fs.rmSync(dir, { recursive: true });
console.log('wrote', out);
