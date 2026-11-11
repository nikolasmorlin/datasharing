import { Engine, loadTextures, FPS } from './engine.js';
const q = new URLSearchParams(location.search);
const part = q.get('part') || '1';
const pr = Number(q.get('pr') || 2);
try {
  const mod = await import(`./parts/part${part}.js`);
  await loadTextures(mod.textures || {});
  await Promise.all(['500 20px "Inter Tight"', '600 20px "Inter Tight"', '400 12px Inter', '500 12px Inter', '600 12px Inter'].map(f => document.fonts.load(f, 'Aáçã0')));
  await document.fonts.ready;
  const engine = new Engine({ shots: mod.shots, pr });
  window.ENGINE = engine;
  window.INFO = { frames: engine.frames, duration: engine.duration, fps: FPS, shots: engine.shots.map(s => ({ name: s.name, start: s.start, dur: s.dur, caps: s.caps.map(c => ({ t0: s.start + c.t0, t1: s.start + c.t1, text: c.raw })) })) };
  window.renderFrame = f => engine.render(f);
  window.READY = true;
} catch (e) { console.error('BOOT ERROR', e && e.stack || e); window.BOOT_ERROR = String(e && e.stack || e); }
