// Deterministic, frame-addressable film engine: every frame is a pure function of time,
// so frames can be rendered in any order and in parallel workers.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

export const W = 540, H = 960, FPS = 30;
export const ORANGE = 0xff5a36, CREAM = 0xf4efe6, INK = 0x12151f, NAVY = 0x2a3350;

// ---------- math helpers ----------
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const seg = (t, a, b) => clamp((t - a) / (b - a));
export const ss = (a, b, x) => { const t = seg(x, a, b); return t * t * (3 - 2 * t); };
export const eio = x => (x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
export const eo = x => 1 - Math.pow(1 - x, 3);
export const ei = x => x * x * x;
export const eback = x => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
export const pulse = (t, a, b, f = .2) => ss(a, a + f, t) * (1 - ss(b - f, b, t));
export const wob = (t, s = 0) => Math.sin(t * 1.3 + s * 7.1) * .5 + Math.sin(t * 2.17 + s * 3.3) * .3 + Math.sin(t * .61 + s * 1.7) * .2;
export function rng(seed) {
  let a = seed >>> 0;
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export const V = (x, y, z) => new THREE.Vector3(x, y, z);

// ---------- textures ----------
export const TEX = {};
export async function loadTextures(defs) {
  const loader = new THREE.TextureLoader();
  await Promise.all(Object.entries(defs).map(async ([k, d]) => {
    if (TEX[k]) return;
    const t = await loader.loadAsync(d.url);
    if (d.srgb !== false) t.colorSpace = THREE.SRGBColorSpace;
    if (d.repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(d.repeat[0], d.repeat[1]); }
    if (d.wrapS) t.wrapS = THREE.RepeatWrapping;
    t.anisotropy = d.aniso || 8;
    TEX[k] = t;
  }));
}
export function canvasTex(w, h, draw, opts = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (opts.srgb !== false) t.colorSpace = THREE.SRGBColorSpace;
  if (opts.repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(opts.repeat[0], opts.repeat[1]); }
  t.anisotropy = 8;
  return t;
}

// ---------- captions ----------
const NUMSYL = { '8': 2, '20': 2, '150': 6, '300': 3, '30': 2, '73': 5, '40': 3, '9': 2, '10': 1, '1': 1, '7': 2, '18': 3, '21': 4, '0': 2, '12': 2, '15': 2, '90': 3, '5': 2, '2': 2, '3': 1 };
function estimate(txt) {
  const plain = txt.replace(/[*_|]/g, ' ');
  let syl = 0;
  for (const w of plain.split(/\s+/)) {
    if (!w) continue;
    const digits = w.replace(/[^\d]/g, '');
    if (digits) { syl += NUMSYL[digits] ?? digits.length * 2.5; continue; }
    const m = w.toLowerCase().match(/[aeiouáàâãéêíóôõúü]+/g);
    syl += m ? m.length : 0;
  }
  const end = plain.trim().slice(-1);
  const pause = '.?!:'.includes(end) ? .34 : end === ',' ? .16 : 0;
  return Math.max(.7, .22 + syl * .155 + pause);
}
function parseCap(c) {
  if (typeof c === 'string') c = { t: c };
  if (c.wait != null) return { wait: c.wait };
  const html = c.t.replace(/&/g, '&amp;').replace(/\*(.+?)\*/g, '<b>$1</b>').replace(/_(.+?)_/g, '<u>$1</u>').replace(/\|/g, '<br>');
  return { html, d: c.d ?? estimate(c.t), cls: c.cls || '', y: c.y, raw: c.t.replace(/[*_]/g, '').replace(/\|/g, ' ') };
}

// ---------- engine ----------
const FinishShader = {
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uVig: { value: .9 }, uGrain: { value: .045 }, uCA: { value: .004 }, uTint: { value: new THREE.Vector3(1, 1, 1) }, uRes: { value: new THREE.Vector2(1080, 1920) } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float uTime, uVig, uGrain, uCA; uniform vec3 uTint; uniform vec2 uRes; varying vec2 vUv;
    float hash(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
    void main(){
      vec2 c = vUv - .5; float r2 = dot(c, c);
      vec3 col = vec3(texture2D(tDiffuse, vUv + c * uCA * r2 * 4.).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv - c * uCA * r2 * 4.).b);
      float v = smoothstep(.98, .22, length(c * vec2(1.25, .8)));
      col *= mix(1., v, uVig);
      col *= uTint;
      vec2 px = floor(vUv * uRes / 2.);
      float g = hash(px + fract(uTime * .37) * 517.) - .5;
      col += g * uGrain * (1. - .5 * dot(col, vec3(.333)));
      gl_FragColor = vec4(col, 1.);
    }`,
};

export class Engine {
  constructor({ shots, pr = 2 }) {
    this.pr = pr;
    const canvas = document.getElementById('gl');
    const renderer = this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(pr); renderer.setSize(W, H, false);
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    const rt = new THREE.WebGLRenderTarget(W * pr, H * pr, { type: THREE.HalfFloatType, samples: 4 });
    const composer = this.composer = new EffectComposer(renderer, rt);
    composer.setPixelRatio(pr); composer.setSize(W, H);
    this.renderPass = new RenderPass(new THREE.Scene(), new THREE.PerspectiveCamera());
    this.bloom = new UnrealBloomPass(new THREE.Vector2(W * pr, H * pr), .5, .5, .9);
    this.finish = new ShaderPass(FinishShader);
    this.finish.uniforms.uRes.value.set(W * pr, H * pr);
    composer.addPass(this.renderPass); composer.addPass(this.bloom); composer.addPass(new OutputPass()); composer.addPass(this.finish);
    const pmrem = new THREE.PMREMGenerator(renderer);
    this.envRoom = pmrem.fromScene(new RoomEnvironment(), .04).texture;
    this.hudRoot = document.getElementById('hud');
    this.capEl = document.getElementById('capin'); this.capWrap = document.getElementById('cap');
    this.fadeEl = document.getElementById('fade'); this.brandEl = document.getElementById('brand');
    this.shared = new Map();
    // timeline
    let acc = 0;
    this.shots = shots.map((s, i) => {
      const caps = (s.caps || []).map(parseCap);
      let t = s.pre ?? .3; const list = [];
      for (const c of caps) { if (c.wait != null) { t += c.wait; continue; } c.t0 = t; t += c.d; c.t1 = t; list.push(c); }
      const dur = s.dur ?? (t + (s.post ?? .4));
      const o = { ...s, i, caps: list, dur, start: acc, built: null };
      acc += dur; return o;
    });
    this.duration = acc; this.frames = Math.round(acc * FPS);
    this.capKey = null; this.activeHud = null;
  }
  shotAt(t) { for (const s of this.shots) if (t < s.start + s.dur) return s; return this.shots[this.shots.length - 1]; }
  build(shot) {
    const hudEl = document.createElement('div'); this.hudRoot.appendChild(hudEl);
    const cam = new THREE.PerspectiveCamera(35, W / H, .05, 4000);
    const scene = new THREE.Scene(); scene.background = new THREE.Color(INK);
    const eng = this;
    const ctx = {
      shot, scene, cam, env: this.envRoom, renderer: this.renderer,
      post: { bloom: .45, radius: .55, threshold: .92, exposure: 1, vig: .85, grain: .045, ca: .004, tint: [1, 1, 1] },
      fade: 0, fadeColor: '#000', capY: null, brand: 1,
      hud(html, cls = '', style = '') { const el = document.createElement('div'); el.className = cls; el.innerHTML = html; if (style) el.style.cssText = style; hudEl.appendChild(el); return el; },
      proj(v) { const p = v.clone().project(cam); return { x: (p.x * .5 + .5) * W, y: (-p.y * .5 + .5) * H, z: p.z }; },
      place(el, v, dx = 0, dy = 0) { const p = this.proj(v); el.style.left = (p.x + dx).toFixed(1) + 'px'; el.style.top = (p.y + dy).toFixed(1) + 'px'; el.style.visibility = p.z < 1 ? 'visible' : 'hidden'; return p; },
      share(key, fn) { if (!eng.shared.has(key)) eng.shared.set(key, fn()); return eng.shared.get(key); },
      look(pos, target, fov, roll = 0) { cam.position.set(pos[0], pos[1], pos[2]); cam.up.set(Math.sin(roll), Math.cos(roll), 0); cam.lookAt(target[0], target[1], target[2]); if (fov && cam.fov !== fov) { cam.fov = fov; } cam.updateProjectionMatrix(); cam.updateMatrixWorld(true); },
      // camera path: keys = [[t, [px,py,pz], [lx,ly,lz], fov], ...] eased between consecutive keys
      path(t, keys, ease = eio) {
        let a = keys[0], b = keys[keys.length - 1];
        for (let k = 0; k < keys.length - 1; k++) if (t >= keys[k][0]) { a = keys[k]; b = keys[k + 1]; }
        const u = ease(seg(t, a[0], b[0]));
        const p = a[1].map((v, j) => lerp(v, b[1][j], u)), l = a[2].map((v, j) => lerp(v, b[2][j], u));
        this.look(p, l, lerp(a[3] ?? 35, b[3] ?? a[3] ?? 35, u));
      },
    };
    const update = shot.build(ctx);
    shot.built = { ctx, update, hudEl };
    return shot.built;
  }
  render(frame) {
    const t = Math.min(frame / FPS, this.duration - 1e-4);
    const shot = this.shotAt(t), tl = t - shot.start;
    const b = shot.built || this.build(shot);
    const { ctx } = b;
    if (this.activeHud !== b.hudEl) { if (this.activeHud) this.activeHud.classList.remove('on'); b.hudEl.classList.add('on'); this.activeHud = b.hudEl; }
    ctx.fade = 0; ctx.fadeColor = '#000'; ctx.t = tl; ctx.T = t; ctx.dur = shot.dur; ctx.frame = frame;
    b.update && b.update(tl, ctx);
    ctx.cam.updateMatrixWorld(true);
    const p = ctx.post;
    this.bloom.strength = p.bloom; this.bloom.radius = p.radius; this.bloom.threshold = p.threshold; this.bloom.enabled = p.bloom > 0.001;
    this.renderer.toneMappingExposure = p.exposure;
    const u = this.finish.uniforms; u.uTime.value = frame; u.uVig.value = p.vig; u.uGrain.value = p.grain; u.uCA.value = p.ca; u.uTint.value.set(p.tint[0], p.tint[1], p.tint[2]);
    this.renderPass.scene = ctx.scene; this.renderPass.camera = ctx.cam;
    this.composer.render();
    // overlays
    this.fadeEl.style.background = ctx.fadeColor; this.fadeEl.style.opacity = clamp(ctx.fade).toFixed(3);
    this.brandEl.style.opacity = ctx.brand;
    this.drawCaption(shot, tl, ctx);
    return { shot: shot.name, tl };
  }
  drawCaption(shot, tl, ctx) {
    let cur = null, idx = -1;
    for (let i = 0; i < shot.caps.length; i++) { const c = shot.caps[i]; const nx = shot.caps[i + 1]; const end = nx && nx.t0 - c.t1 < .02 ? nx.t0 : c.t1; if (tl >= c.t0 && tl < end) { cur = c; idx = i; } }
    const el = this.capEl;
    if (!cur) { if (this.capKey !== null) { el.innerHTML = ''; this.capKey = null; } el.style.opacity = 0; return; }
    const key = shot.i + ':' + idx;
    if (this.capKey !== key) { el.innerHTML = cur.html; el.className = cur.cls; this.capKey = key; }
    const k = tl - cur.t0, nx = shot.caps[idx + 1];
    const gapAfter = !nx || nx.t0 - cur.t1 > .02;
    let op = seg(k, 0, .06); if (gapAfter) op *= 1 - seg(tl, cur.t1 - .1, cur.t1);
    const sc = lerp(.8, 1, eback(seg(k, 0, .17)));
    el.style.opacity = op.toFixed(3);
    el.style.transform = `scale(${sc.toFixed(4)})`;
    this.capWrap.style.top = (cur.y ?? ctx.capY ?? shot.capY ?? 598) + 'px';
  }
}
