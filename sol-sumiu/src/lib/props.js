// Props for parts 2 and 3: thermometer, coffee, snow, puffs, snow field, plants, house, power plant, bars, domes, vents.
import * as THREE from 'three';
import { TEX, canvasTex, rng, lerp, clamp, seg, ss } from '../engine.js';
import { makeStars, makeSkyDome, makeGlow, NOISE } from './space.js';
import { std, box, cyl, ball, sunLight } from './sets.js';

// ---------- particles (closed-form in t) ----------
export function makeSnow({ count = 1400, box: B = [14, 9, 14], seed = 3, size = 3.2, pr = 2, speed = .9 } = {}) {
  const r = rng(seed), pos = new Float32Array(count * 3), ph = new Float32Array(count);
  for (let i = 0; i < count; i++) { pos.set([(r() - .5) * B[0], r() * B[1], (r() - .5) * B[2]], i * 3); ph[i] = r() * 100; }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aPh', new THREE.BufferAttribute(ph, 1));
  const m = new THREE.ShaderMaterial({ uniforms: { uT: { value: 0 }, uH: { value: B[1] }, uS: { value: size * pr }, uOp: { value: 1 }, uSp: { value: speed } }, transparent: true, depthWrite: false,
    vertexShader: `attribute float aPh; uniform float uT, uH, uS, uSp; varying float vA; void main(){ vec3 p = position; p.y = mod(p.y - uT * uSp * (.6 + fract(aPh) * .8), uH); p.x += sin(uT * .7 + aPh) * .25; p.z += cos(uT * .5 + aPh * 1.3) * .25;
      vec4 mv = modelViewMatrix * vec4(p, 1.); gl_Position = projectionMatrix * mv; gl_PointSize = uS * (.5 + fract(aPh * 7.) ) * 6. / max(1., -mv.z); vA = smoothstep(0., .6, p.y) * smoothstep(uH, uH - 1., p.y); }`,
    fragmentShader: `uniform float uOp; varying float vA; void main(){ float d = length(gl_PointCoord - .5) * 2.; gl_FragColor = vec4(vec3(.82, .88, 1.), smoothstep(1., .2, d) * vA * uOp * .85); }` });
  const p = new THREE.Points(g, m); p.frustumCulled = false; p.userData.set = (t, op = 1) => { m.uniforms.uT.value = t; m.uniforms.uOp.value = op; }; return p;
}
let _puff; const puffTex = () => _puff || (_puff = canvasTex(128, 128, (x) => { const g = x.createRadialGradient(64, 64, 4, 64, 64, 64); g.addColorStop(0, 'rgba(255,255,255,.9)'); g.addColorStop(.5, 'rgba(255,255,255,.35)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128); }, { srgb: false }));
export function makePuffs({ n = 14, color = 0xffffff, rise = 1.2, spread = .25, size = [.15, .7], life = 3, op = .5, seed = 1, additive = false } = {}) {
  const g = new THREE.Group(), r = rng(seed), items = [];
  for (let i = 0; i < n; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: puffTex(), color, transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending })); g.add(s); items.push({ s, o: r(), a: r() * 6.28, k: .6 + r() * .8 }); }
  g.userData.set = (t, amount = 1) => { for (const it of items) { const p = ((t / life) * it.k + it.o) % 1; it.s.position.set(Math.cos(it.a + p * 2) * spread * p, p * rise, Math.sin(it.a + p * 2) * spread * p); it.s.scale.setScalar(lerp(size[0], size[1], p)); it.s.material.opacity = op * amount * Math.sin(Math.PI * Math.min(1, p * 1.15)) * (1 - p * .4); } };
  return g;
}

// ---------- cold night world ----------
export function makeSnowField(c, { snowfall = true, light = 1 } = {}) {
  const pr = c.renderer.getPixelRatio(); c.scene.background = new THREE.Color(0x010207);
  const stars = makeStars({ pr, count: 5200, size: 1.25 }), dome = makeSkyDome(.6); c.scene.add(stars, dome);
  const gb = TEX.groundBump.clone(); gb.wrapS = gb.wrapT = THREE.RepeatWrapping; gb.repeat.set(40, 40); gb.needsUpdate = true;
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(700, 700, 1, 1), std(0xdfe8f6, { bumpMap: gb, bumpScale: 2.5, roughness: .85 })); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; c.scene.add(ground);
  const R = rng(4); for (let i = 0; i < 10; i++) { const h = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 12), std(0xc9d6ec, { roughness: 1 })); const a = -Math.PI + i / 9 * Math.PI; h.position.set(Math.cos(a) * 150 * (1 + R() * .3), -5, Math.sin(a) * 150 - 30); h.scale.set(50 + R() * 50, 16 + R() * 22, 40); c.scene.add(h); }
  const hemi = new THREE.HemisphereLight(0x6f8fd8, 0x1a2540, .22 * light); const moon = sunLight(c.scene, { color: 0x8fb0ff, intensity: .5 * light, pos: [-8, 12, -6], size: 14 }); c.scene.add(hemi);
  c.scene.fog = new THREE.Fog(0x030611, 25, 260);
  const snow = makeSnow({ pr }); snow.visible = snowfall; c.scene.add(snow);
  c.post.exposure = 1.5; c.post.bloom = .55; c.post.threshold = .8;
  return { ground, hemi, moon, snow, set(t) { stars.userData.set(t, 1); snow.userData.set(t); } };
}

// ---------- thermometer ----------
export function makeThermo(c, { min = -30, max = 20 } = {}) {
  const g = new THREE.Group(); const H = 2.4;
  const plate = canvasTex(256, 1024, (x, w, h) => { x.fillStyle = '#161a26'; x.fillRect(0, 0, w, h); x.fillStyle = '#f4efe6'; x.font = '600 34px Inter'; x.textAlign = 'right'; x.textBaseline = 'middle';
    const st = (max - min) > 60 ? 10 : 5; for (let v = min; v <= max; v += st) { const y = h - 110 - (v - min) / (max - min) * (h - 220); const big = v % (st * 2) === 0; x.fillRect(150, y - 2, big ? 46 : 26, 4); if (big) x.fillText(String(v), 132, y); } });
  const back = new THREE.Mesh(new THREE.BoxGeometry(.75, H + .9, .08), [std(0x161a26), std(0x161a26), std(0x161a26), std(0x161a26), std(0xffffff, { map: plate, roughness: .6 }), std(0x161a26)]); back.position.set(-.18, H / 2 - .1, -.12); back.castShadow = true; g.add(back);
  const glass = new THREE.MeshStandardMaterial({ color: 0xdff0ff, transparent: true, opacity: .13, roughness: .08, metalness: .1, envMap: c.env, envMapIntensity: .45 });
  const tube = new THREE.Mesh(new THREE.CapsuleGeometry(.085, H * .82, 8, 24), glass); tube.position.set(.15, H * .5 + .08, 0); g.add(tube);
  const bulbG = new THREE.Mesh(new THREE.SphereGeometry(.2, 32, 24), glass); bulbG.position.set(.15, -.12, 0); g.add(bulbG);
  const red = new THREE.MeshStandardMaterial({ color: 0xff3d1f, emissive: 0xff2a10, emissiveIntensity: .3, roughness: .3 });
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(.155, 32, 24), red); bulb.position.copy(bulbG.position); g.add(bulb);
  const liq = new THREE.Mesh(new THREE.CylinderGeometry(.06, .06, 1, 20), red); g.add(liq);
  g.userData = { yFor(v) { return -.1955 + 2.591 * (v - min) / (max - min); }, set(v) { const top = g.userData.yFor(clamp(v, min, max)); const h = top + .12; liq.scale.y = Math.max(.01, h); liq.position.set(.15, -.12 + h / 2, 0); const k = seg(v, 15, -25); red.color.setRGB(lerp(1, .35, k), lerp(.24, .6, k), lerp(.12, 1, k)); red.emissive.copy(red.color); } };
  return g;
}

// ---------- coffee ----------
export function makeCoffee(c) {
  const g = new THREE.Group(); const cer = std(0xe9e2d6, { roughness: .35, envMap: c.env, envMapIntensity: .3 });
  const pts = [[0, 0], [.2, 0], [.26, .03], [.3, .12], [.33, .36], [.335, .4], [.31, .4], [.3, .36], [.27, .13], [.2, .05], [0, .05]].map(p => new THREE.Vector2(p[0], p[1]));
  const cup = new THREE.Mesh(new THREE.LatheGeometry(pts, 48), cer); cup.castShadow = cup.receiveShadow = true; g.add(cup);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(.12, .032, 12, 28, Math.PI * 1.25), cer); handle.position.set(.36, .21, 0); handle.rotation.z = -Math.PI * .62; handle.castShadow = true; g.add(handle);
  const coffee = new THREE.Mesh(new THREE.CircleGeometry(.305, 40), std(0x2a1408, { roughness: .12, envMap: c.env, envMapIntensity: 1.2 })); coffee.rotation.x = -Math.PI / 2; coffee.position.y = .355; g.add(coffee);
  const saucer = new THREE.Mesh(new THREE.LatheGeometry([[0, 0], [.42, 0], [.56, .05], [.57, .07], [.4, .03], [0, .03]].map(p => new THREE.Vector2(p[0], p[1])), 48), cer); saucer.position.y = -.035; saucer.receiveShadow = saucer.castShadow = true; g.add(saucer);
  const steam = makePuffs({ n: 12, rise: 1.5, spread: .22, size: [.18, .75], life: 3.2, op: .34, seed: 8 }); steam.position.y = .42; g.add(steam);
  g.userData = { steam, coffee }; return g;
}

// ---------- plants ----------
export function makeTree(scale = 1) {
  const g = new THREE.Group(), R = rng(21); const bark = std(0x5b4030, { roughness: 1 }), leaf = std(0x3f8a45, { roughness: .9 });
  const trunk = cyl(.22, .34, 3.2, bark, 0, 1.6, 0, 14); g.add(trunk);
  for (let i = 0; i < 4; i++) { const b = cyl(.06, .12, 1.4, bark, 0, 0, 0, 8); b.position.set(Math.cos(i * 1.7) * .45, 3.1, Math.sin(i * 1.7) * .45); b.rotation.set(Math.sin(i * 1.7) * .6, 0, -Math.cos(i * 1.7) * .6); g.add(b); }
  const leaves = []; for (let i = 0; i < 13; i++) { const s = ball(.75 + R() * .55, leaf, (R() - .5) * 2.4, 3.7 + R() * 1.7, (R() - .5) * 2.4); s.scale.y = .82; g.add(s); leaves.push(s); }
  g.scale.setScalar(scale); g.userData = { leaf, set(frost) { leaf.color.setRGB(lerp(.25, .62, frost), lerp(.54, .7, frost), lerp(.27, .78, frost)); } }; return g;
}
export function makeCrops({ rows = 7, per = 16, gap = .95, len = 12, seed = 5 } = {}) {
  const g = new THREE.Group(), R = rng(seed); const mat = std(0x58a83c, { roughness: .8, side: THREE.DoubleSide });
  const blade = new THREE.ConeGeometry(.055, .62, 5); blade.translate(0, .31, 0);
  const n = rows * per * 3; const im = new THREE.InstancedMesh(blade, mat, n); im.castShadow = true; const base = [];
  for (let r = 0; r < rows; r++) for (let i = 0; i < per; i++) for (let k = 0; k < 3; k++) base.push({ x: (r - (rows - 1) / 2) * gap + (R() - .5) * .08, z: -i * (len / per) + (R() - .5) * .1, a: k * 2.1 + R(), lean: .25 + R() * .3, h: .8 + R() * .5 });
  const ridge = []; for (let r = 0; r < rows; r++) { const m = box(.4, .12, len + .6, std(0x6a4a32, { roughness: 1 }), (r - (rows - 1) / 2) * gap, .03, -len / 2 + .3); g.add(m); ridge.push(m); }
  g.add(im); const d = new THREE.Object3D();
  g.userData = { mat, set(wilt, frost = 0) { base.forEach((b, i) => { d.position.set(b.x, .08, b.z); const l = b.lean + wilt * 1.15; d.rotation.set(Math.cos(b.a) * l, b.a, Math.sin(b.a) * l); d.scale.set(1, b.h * (1 - wilt * .35), 1); d.updateMatrix(); im.setMatrixAt(i, d.matrix); }); im.instanceMatrix.needsUpdate = true;
    mat.color.setRGB(lerp(.33, .42, wilt) + frost * .3, lerp(.66, .36, wilt) + frost * .3, lerp(.22, .16, wilt) + frost * .55); } };
  g.userData.set(0); return g;
}

// ---------- small house ----------
export function makeHouse(c) {
  const g = new THREE.Group(); const wall = std(0xe9e1d2, { roughness: .9 }), roof = std(0xd24a2c, { roughness: .7 });
  g.add(box(3.2, 2.1, 2.6, wall, 0, 1.05, 0));
  const rg = new THREE.Mesh(new THREE.CylinderGeometry(.01, 2.05, 1.5, 4, 1), roof); rg.rotation.y = Math.PI / 4; rg.scale.set(1.25, 1, 1.02); rg.position.y = 2.85; rg.castShadow = true; g.add(rg);
  const snowCap = new THREE.Mesh(new THREE.CylinderGeometry(.01, 1.5, 1.05, 4, 1), std(0xf2f6ff, { roughness: 1 })); snowCap.rotation.y = Math.PI / 4; snowCap.scale.set(1.25, 1, 1.02); snowCap.position.y = 3.12; g.add(snowCap);
  g.add(box(.5, .9, .5, std(0x7a6f66), .85, 3.1, -.3));
  const winM = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.5, .8, .28) }); const win = new THREE.Mesh(new THREE.PlaneGeometry(.8, .8), winM); win.position.set(.65, 1.2, 1.305); g.add(win);
  g.add(box(.84, .06, .04, wall, .65, 1.2, 1.32), box(.06, .84, .04, wall, .65, 1.2, 1.32), box(.75, 1.45, .06, std(0x6b4a34), -.75, .73, 1.31));
  const l = new THREE.PointLight(0xffb060, 3.5, 9, 1.7); l.position.set(.65, 1.2, 2.3); g.add(l);
  const smoke = makePuffs({ n: 10, rise: 2.6, spread: .5, size: [.3, 1.3], life: 4, op: .28, seed: 4, color: 0xcfd6e6 }); smoke.position.set(.85, 3.6, -.3); g.add(smoke);
  g.userData = { smoke, l, winM }; return g;
}

// ---------- thermal power plant ----------
export function makePlant(c) {
  const g = new THREE.Group(); const con = std(0x8b929c, { roughness: .9 }), dark = std(0x3b4250, { roughness: .8 });
  g.add(box(7, 2.6, 3.4, con, 0, 1.3, 0), box(3.2, 4.2, 3, dark, -3.2, 2.1, -.4), box(2.4, 1.4, 2.4, con, 3.6, .7, 1));
  const fires = [], smokes = [];
  for (const [x, h] of [[-1.2, 8.5], [1.3, 7.2], [3.2, 6.2]]) {
    g.add(cyl(.42, .62, h, con, x, h / 2, -1.2, 20));
    for (const yy of [h - .5, h - 1.3]) g.add(cyl(.47, .47, .25, std(0xd24a2c), x, yy, -1.2, 20));
    const f = makeGlow(2.2, 0xff7a2a); f.position.set(x, h + .15, -1.2); g.add(f); fires.push(f);
    const l = new THREE.PointLight(0xff7a30, 14, 14, 1.6); l.position.set(x, h + .6, -1.2); g.add(l);
    const s = makePuffs({ n: 14, rise: 6.5, spread: 1.5, size: [.9, 4.2], life: 5.5, op: .5, seed: x * 10 + 30, color: 0x9aa0ad }); s.position.set(x, h + .2, -1.2); g.add(s); smokes.push(s);
  }
  for (let i = 0; i < 7; i++) { const w = new THREE.Mesh(new THREE.PlaneGeometry(.5, .35), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.3, .75, .28) })); w.position.set(-2.8 + i * .95, 1.5, 1.71); g.add(w); }
  const l2 = new THREE.PointLight(0xffa860, 10, 12, 1.6); l2.position.set(0, 1.6, 4); g.add(l2);
  g.userData = { set(t) { smokes.forEach(s => s.userData.set(t)); fires.forEach((f, i) => f.scale.setScalar(2.1 + Math.sin(t * 9 + i * 2) * .25 + Math.sin(t * 23 + i) * .12)); } };
  return g;
}

// ---------- hotspots on a globe ----------
export const ll = (lat, lon, R = 1) => { const a = lat * Math.PI / 180, o = lon * Math.PI / 180; return new THREE.Vector3(Math.cos(o) * Math.cos(a) * R, Math.sin(a) * R, -Math.sin(o) * Math.cos(a) * R); };
export const HOT = [[64.9, -18.5], [44.4, -110.6], [-23, -68], [35.4, 138.7], [-7.5, 110.4], [-38.6, 176], [40.8, 14.4], [-3, 36], [56, 160.6], [19.5, -155.5], [14.6, -90.9], [61.3, -152.2], [-0.4, -78.4], [38.7, -28.2]];
export function addHotspots(body, R = 1) {
  const list = HOT.map(([la, lo], i) => { const s = makeGlow(.16, i === 0 ? 0xff5a36 : 0xff8a3a); s.position.copy(ll(la, lo, R * 1.012)); body.add(s); const core = new THREE.Mesh(new THREE.SphereGeometry(.011, 10, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 1.3, .5) })); core.position.copy(s.position); body.add(core); return { s, core }; });
  return { list, set(t, k = 1) { list.forEach((h, i) => { const p = clamp(k * 1.6 - i * .04); h.s.scale.setScalar((i === 0 ? .26 : .15) * p * (1 + .25 * Math.sin(t * 3 + i * 1.7))); h.core.visible = p > .05; }); } };
}

// ---------- wind turbine ----------
export function makeTurbine() {
  const g = new THREE.Group(); const w = std(0xe8edf5, { roughness: .5 });
  g.add(cyl(.12, .22, 9, w, 0, 4.5, 0, 16)); const nac = box(.5, .45, 1.1, w, 0, 9.1, .1); g.add(nac);
  const rot = new THREE.Group(); rot.position.set(0, 9.1, .72); g.add(rot); rot.add(ball(.22, w));
  for (let i = 0; i < 3; i++) { const b = new THREE.Mesh(new THREE.ConeGeometry(.2, 4.2, 8), w); b.scale.z = .25; b.position.y = 2.1; const p = new THREE.Group(); p.rotation.z = i * Math.PI * 2 / 3; p.add(b); b.castShadow = true; rot.add(p); }
  g.userData = { rot }; return g;
}
