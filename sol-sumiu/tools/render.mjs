// Usage: node tools/render.mjs <part> [--workers 3] [--dsf 2] [--out file.mp4] [--from s] [--to s] [--crf 16]
import fs from 'node:fs'; import path from 'node:path'; import { spawn } from 'node:child_process'; import { fileURLToPath } from 'node:url';
import { openPart } from './common.mjs';
const args = process.argv.slice(2); const part = args[0];
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const dsf = Number(opt('dsf', 2)), workers = Number(opt('workers', 3)), crf = opt('crf', '16');
const SCR = '/tmp/claude-0/-home-user-datasharing/8e34cf23-8b6d-5950-994d-34cbecd5a73f/scratchpad';
const out = opt('out', path.join(SCR, `parte${part}.mp4`));
const ff = (file, fps) => spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'image2pipe', '-c:v', 'mjpeg', '-framerate', String(fps), '-i', '-', '-vf', 'scale=out_color_matrix=bt709:out_range=tv,format=yuv420p', '-c:v', 'libx264', '-preset', 'medium', '-crf', crf, '-g', '60', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-movflags', '+faststart', file], { stdio: ['pipe', 'inherit', 'inherit'] });
if (opt('worker')) {
  const [a, b] = opt('worker').split('-').map(Number); const seg = opt('seg');
  const { page, info, close } = await openPart(part, { dsf, quiet: true });
  const enc = ff(seg, info.fps); const t0 = Date.now();
  for (let f = a; f < b; f++) {
    await page.evaluate(f => window.renderFrame(f), f);
    const buf = await page.screenshot({ type: 'jpeg', quality: 96 });
    if (!enc.stdin.write(buf)) await new Promise(r => enc.stdin.once('drain', r));
    if ((f - a) % 60 === 0) console.log(`[w ${a}-${b}] ${f - a}/${b - a} ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  }
  enc.stdin.end(); await new Promise(r => enc.on('close', r)); await close(); process.exit(0);
}
const { info, close } = await openPart(part, { dsf: .25, pr: 1, quiet: true }); await close();
const f0 = Math.round(Number(opt('from', 0)) * info.fps), f1 = Math.min(info.frames, Math.round(Number(opt('to', 1e9)) * info.fps));
const n = f1 - f0, per = Math.ceil(n / workers); const segs = []; const t0 = Date.now();
await Promise.all(Array.from({ length: workers }, (_, i) => new Promise((res, rej) => {
  const a = f0 + i * per, b = Math.min(f1, a + per); if (a >= b) return res(); const seg = `${out}.seg${i}.mp4`; segs[i] = seg;
  const p = spawn(process.execPath, [fileURLToPath(import.meta.url), part, '--dsf', String(dsf), '--crf', crf, '--worker', `${a}-${b}`, '--seg', seg], { stdio: 'inherit' });
  p.on('close', c => c === 0 ? res() : rej(new Error('worker ' + i + ' exit ' + c)));
})));
const list = out + '.txt'; fs.writeFileSync(list, segs.filter(Boolean).map(s => `file '${s}'`).join('\n'));
await new Promise(r => spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', '-movflags', '+faststart', out], { stdio: 'inherit' }).on('close', r));
segs.filter(Boolean).forEach(s => fs.rmSync(s)); fs.rmSync(list);
console.log(`DONE ${out} frames=${n} in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
