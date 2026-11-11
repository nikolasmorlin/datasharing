// Sets and props: solar farm, break room, tablet/phone, thermometer, etc.
import * as THREE from 'three';
import { TEX, canvasTex, rng, lerp, clamp } from '../engine.js';
import { makeStars, makeSkyDome, NOISE } from './space.js';

export const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: .8, metalness: 0, ...o });
export const box = (w, h, d, m, x = 0, y = 0, z = 0) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); b.castShadow = b.receiveShadow = true; return b; };
export const cyl = (r1, r2, h, m, x = 0, y = 0, z = 0, seg = 24) => { const b = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, seg), m); b.position.set(x, y, z); b.castShadow = b.receiveShadow = true; return b; };
export const ball = (r, m, x = 0, y = 0, z = 0) => { const b = new THREE.Mesh(new THREE.SphereGeometry(r, 32, 24), m); b.position.set(x, y, z); b.castShadow = b.receiveShadow = true; return b; };

export function sunLight(scene, { color = 0xfff1dc, intensity = 3.2, pos = [6, 10, 5], size = 12, map = 2048, target = [0, 0, 0] } = {}) {
  const l = new THREE.DirectionalLight(color, intensity); l.position.set(...pos); l.target.position.set(...target); l.castShadow = true;
  l.shadow.mapSize.set(map, map); const c = l.shadow.camera; c.left = -size; c.right = size; c.top = size; c.bottom = -size; c.near = .5; c.far = 80; l.shadow.bias = -.0004; l.shadow.normalBias = .03; l.shadow.radius = 4;
  scene.add(l, l.target); return l;
}

// ---------- day/night sky ----------
export function makeDaySky(scene, { elevation = 62, azimuth = 200, pr = 2 } = {}) {
  const dir = new THREE.Vector3().setFromSphericalCoords(1, THREE.MathUtils.degToRad(90 - elevation), THREE.MathUtils.degToRad(azimuth));
  const u = { uSun: { value: dir }, uDay: { value: 1 } };
  const sky = new THREE.Mesh(new THREE.SphereGeometry(2500, 48, 32), new THREE.ShaderMaterial({ uniforms: u, side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: `varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
    fragmentShader: NOISE + `uniform vec3 uSun; uniform float uDay; varying vec3 vD;
      void main(){ vec3 d = normalize(vD); float h = max(d.y, 0.);
        vec3 col = mix(vec3(.36, .62, .98), vec3(.03, .19, .62), pow(h, .34));
        col = mix(col, vec3(.70, .84, .98), exp(-h * 16.) * .55);
        float s = max(dot(d, normalize(uSun)), 0.); col += vec3(1., .93, .78) * (pow(s, 40.) * .25 + smoothstep(.9994, .9996, s) * 1.2);
        float cl = smoothstep(.64, .67, fbm(vec3(d.xz / (h + .25) * 1.1, 1.7)) * .5 + .5) * smoothstep(.03, .3, h) * .92;
        col = mix(col, vec3(.957, .941, .91), cl);
        gl_FragColor = vec4(col * uDay, 1.); }` }));
  sky.renderOrder = -30;
  const stars = makeStars({ pr, count: 5200, size: 1.25 }); const dome = makeSkyDome(.55);
  scene.add(sky, stars, dome);
  return { sky, stars, dome, dir, set(day, t = 0) { sky.visible = day > .001; u.uDay.value = day; stars.visible = dome.visible = day < .999; stars.userData.set(t, 1 - day); dome.userData.set(.55 * (1 - day)); } };
}

// ---------- solar farm ----------
const panelTex = () => canvasTex(512, 256, (x, w, h) => {
  x.fillStyle = '#0b1a3a'; x.fillRect(0, 0, w, h);
  const g = x.createLinearGradient(0, 0, w, h); g.addColorStop(0, '#16356e'); g.addColorStop(1, '#0a1836'); x.fillStyle = g; x.fillRect(0, 0, w, h);
  x.strokeStyle = 'rgba(190,210,240,.55)'; x.lineWidth = 2; for (let i = 0; i <= 12; i++) { x.beginPath(); x.moveTo(i * w / 12, 0); x.lineTo(i * w / 12, h); x.stroke(); } for (let j = 0; j <= 6; j++) { x.beginPath(); x.moveTo(0, j * h / 6); x.lineTo(w, j * h / 6); x.stroke(); }
  x.strokeStyle = 'rgba(210,220,235,.95)'; x.lineWidth = 6; x.strokeRect(3, 3, w - 6, h - 6);
});
export function makeSolarFarm(c, { rows = 9, cols = 7, azimuth = 35, elevation = 58 } = {}) {
  const g = new THREE.Group(); const pr = c.renderer.getPixelRatio();
  const gt = TEX.ground.clone(); gt.wrapS = gt.wrapT = THREE.RepeatWrapping; gt.repeat.set(70, 70); gt.needsUpdate = true;
  const gb = TEX.groundBump.clone(); gb.wrapS = gb.wrapT = THREE.RepeatWrapping; gb.repeat.set(70, 70); gb.needsUpdate = true;
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(900, 900), std(0xdcc9a3, { roughness: .95 })); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; g.add(ground);
  // panels (instanced): tables of 2.2 x 1.25, tilted towards the sun
  const pm = std(0xffffff, { map: panelTex(), roughness: .18, metalness: .55, envMap: c.env, envMapIntensity: 1.1 });
  const n = rows * cols; const panel = new THREE.InstancedMesh(new THREE.BoxGeometry(2.3, .05, 1.3), pm, n); panel.castShadow = panel.receiveShadow = true;
  const legG = new THREE.CylinderGeometry(.035, .035, 1, 8); const legs = new THREE.InstancedMesh(legG, std(0x9aa3ad, { metalness: .7, roughness: .4 }), n * 2); legs.castShadow = true;
  const d = new THREE.Object3D(); let k = 0, kl = 0; const tilt = -.48; const spots = [];
  for (let r = 0; r < rows; r++) for (let q = 0; q < cols; q++) {
    const x = (q - (cols - 1) / 2) * 2.55 + (q >= cols / 2 ? 1.6 : -1.6), z = -r * 3.1 + 4;      // central aisle
    d.position.set(x, 1.05, z); d.rotation.set(tilt, 0, 0); d.scale.set(1, 1, 1); d.updateMatrix(); panel.setMatrixAt(k++, d.matrix); spots.push([x, z]);
    for (const s of [-.75, .75]) { d.position.set(x + s, .5, z - .1); d.rotation.set(0, 0, 0); d.scale.set(1, 1.05, 1); d.updateMatrix(); legs.setMatrixAt(kl++, d.matrix); }
  }
  g.add(panel, legs);
  // distant hills + pylons + control hut
  const hillM = std(0xb9a688, { roughness: 1 }); const R = rng(9);
  for (let i = 0; i < 9; i++) { const h = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 12), hillM); const a = -Math.PI * .95 + i / 8 * Math.PI * .9; h.position.set(Math.cos(a) * 170 * (1 + R() * .3), -4, Math.sin(a) * 170 - 40); h.scale.set(60 + R() * 50, 14 + R() * 16, 40); g.add(h); }
  const hut = new THREE.Group(); hut.add(box(3.4, 2.4, 2.6, std(0xe9e3d6), 0, 1.2, 0), box(3.7, .18, 2.9, std(0x3a4252), 0, 2.48, 0), box(.9, 1.7, .06, std(0x2a3352), -.6, .85, 1.31));
  const win = box(1.1, .7, .06, std(0x0b1220, { emissive: 0xffd27a, emissiveIntensity: 0, roughness: .2 }), .9, 1.45, 1.31); hut.add(win);
  hut.position.set(-12.5, 0, -7); hut.rotation.y = .5; g.add(hut);
  const poleM = std(0x555c66, { metalness: .5, roughness: .5 }); const beacons = [];
  for (let i = 0; i < 4; i++) { const p = new THREE.Group(); p.add(cyl(.12, .2, 13, poleM, 0, 6.5, 0, 10), box(3.2, .14, .14, poleM, 0, 12.2, 0), box(2.2, .12, .12, poleM, 0, 10.8, 0));
    const b = new THREE.Mesh(new THREE.SphereGeometry(.16, 12, 8), new THREE.MeshBasicMaterial({ color: 0xf4f0e8 })); b.position.y = 13.2; p.add(b); beacons.push(b);
    p.position.set(16 + i * 15, 0, -22 - i * 24); g.add(p); }
  c.scene.add(g);
  const sky = makeDaySky(c.scene, { pr, azimuth, elevation });
  const sun = sunLight(c.scene, { pos: sky.dir.clone().multiplyScalar(40).add(new THREE.Vector3(1.3, 0, 0)).toArray(), target: [1.3, 0, 0], size: 18, intensity: 3.4 });
  const hemi = new THREE.HemisphereLight(0x9cc4ff, 0xb59a70, 1.0); c.scene.add(hemi);
  const rim = new THREE.DirectionalLight(0x86a6ff, 0); rim.position.set(-4, 5, -9); c.scene.add(rim);
  const fog = new THREE.Fog(0xa9c8ee, 90, 900); c.scene.fog = fog;
  // sun disc glow in the sky
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: flareTex(), color: 0xfff2d0, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); glow.position.copy(sky.dir).multiplyScalar(900); glow.scale.setScalar(250); c.scene.add(glow);
  return {
    g, sky, sun, hemi, panel, pm, win, spots, glow, beacons, ground,
    frost(k) { pm.color.setRGB(lerp(1, 1.5, k), lerp(1, 1.7, k), lerp(1, 2.1, k)); pm.roughness = lerp(.18, .7, k); ground.material.color.setRGB(lerp(.85, .78, k), lerp(.78, .86, k), lerp(.65, 1.0, k)); },
    // day: 1 = noon sunlight, 0 = Sun gone (starlight only)
    set(day, t = 0) {
      if (day > .5) c.post.exposure = .78; sky.set(day, t); sun.intensity = 3.4 * day; sun.castShadow = day > .02; hemi.intensity = lerp(.1, 1.0, day); rim.intensity = .5 * (1 - day); hemi.color.set(day > .5 ? 0x9cc4ff : 0x6f86c8); hemi.groundColor.set(day > .5 ? 0xb59a70 : 0x20283c);
      fog.color.set(day > .5 ? 0xa9c8ee : 0x04060c); fog.near = day > .5 ? 90 : 30; fog.far = day > .5 ? 900 : 260;
      glow.material.opacity = day; glow.visible = day > .01; pm.envMapIntensity = lerp(.06, 1.1, day);
      c.scene.background = new THREE.Color(day > .5 ? 0x8fb8e8 : 0x010206);
      win.material.emissiveIntensity = day > .5 ? 0 : 2.2;
      const bl = (Math.sin(t * 4.2) > .2 ? 1 : .15) * (day > .5 ? .0 : 1); beacons.forEach(b => b.material.color.setRGB(1.6 * bl + .1, 1.55 * bl + .1, 1.45 * bl + .1));
    },
  };
}
let _flare; function flareTex() {
  if (_flare) return _flare; const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d');
  const g = x.createRadialGradient(128, 128, 0, 128, 128, 128); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.06, 'rgba(255,250,235,1)'); g.addColorStop(.12, 'rgba(255,240,210,.5)'); g.addColorStop(.35, 'rgba(255,225,180,.14)'); g.addColorStop(1, 'rgba(255,220,170,0)');
  x.fillStyle = g; x.fillRect(0, 0, 256, 256); _flare = new THREE.CanvasTexture(c); return _flare;
}

// ---------- hand props ----------
export function makeTablet(glow = 0x8fd0ff) {
  const g = new THREE.Group();
  g.add(box(.26, .18, .014, std(0x1a1d26, { roughness: .4, metalness: .3 })));
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(.235, .155), new THREE.MeshBasicMaterial({ color: glow })); scr.position.z = .0085; g.add(scr);
  const l = new THREE.PointLight(glow, 0, 3, 1.6); l.position.z = .12; g.add(l);
  g.userData = { scr, l, set(k, col) { if (col != null) { scr.material.color.set(col); l.color.set(col); } scr.material.color.multiplyScalar(1); l.intensity = k; } };
  return g;
}
export function makePhone(glow = 0xcfe4ff) {
  const g = new THREE.Group(); g.add(box(.075, .15, .01, std(0x15171d, { roughness: .35, metalness: .4 })));
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(.066, .138), new THREE.MeshBasicMaterial({ color: glow })); scr.position.z = .006; g.add(scr);
  const l = new THREE.PointLight(glow, 0, 2.5, 1.8); l.position.z = .1; g.add(l); g.userData = { scr, l }; return g;
}

// ---------- break room (lunch) ----------
export function makeRoom(c) {
  const g = new THREE.Group(); const pr = c.renderer.getPixelRatio();
  const wallM = std(0xe6dcc8, { roughness: .95 }), floorM = std(0x8a6a4c, { roughness: .7 }), woodM = std(0xb98a5a, { roughness: .6 }), frameM = std(0xf4efe6, { roughness: .5 });
  const floorT = canvasTex(512, 512, (x, w, h) => { x.fillStyle = '#8c6a4a'; x.fillRect(0, 0, w, h); for (let i = 0; i < 8; i++) { x.fillStyle = `rgba(${40 + (i * 37) % 30},${22},${10},${.08 + (i % 3) * .05})`; x.fillRect(0, i * 64, w, 62); x.fillStyle = 'rgba(30,16,8,.55)'; x.fillRect(0, i * 64 + 62, w, 2); x.fillRect((i * 173) % w, i * 64, 2, 62); } }, { repeat: [3, 3] });
  floorM.map = floorT;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(14, 10), floorM); floor.rotation.x = -Math.PI / 2; floor.position.z = 2; floor.receiveShadow = true; g.add(floor);
  // back wall with a window opening (x:-1.1..1.1, y:1.25..2.75)
  const wz = -2.2; g.add(box(14, 1.25, .2, wallM, 0, .625, wz), box(14, 1.6, .2, wallM, 0, 3.55, wz), box(5.9, 1.5, .2, wallM, -4.05, 2, wz), box(5.9, 1.5, .2, wallM, 4.05, 2, wz));
  g.add(box(14, .9, .05, std(0xd6c7ab, { roughness: .9 }), 0, .45, wz + .12)); g.add(box(14, .05, .08, frameM, 0, .92, wz + .14));
  for (const [w, h, x, y] of [[2.36, .1, 0, 1.25], [2.36, .1, 0, 2.75], [.1, 1.6, -1.13, 2], [.1, 1.6, 1.13, 2], [.06, 1.5, 0, 2], [2.2, .06, 0, 2]]) g.add(box(w, h, .14, frameM, x, y, wz + .06));
  g.add(box(2.6, .07, .34, frameM, 0, 1.2, wz + .2));
  const side = box(.2, 5, 10, wallM, -5.2, 2.5, 2); g.add(side); const ceil = box(14, .2, 10, std(0xefe9dc), 0, 4.4, 2); g.add(ceil);
  // table + chair + lunch
  const table = new THREE.Group(); table.add(box(2.1, .07, 1.0, woodM, 0, .78, 0)); for (const [x, z] of [[-.95, -.4], [.95, -.4], [-.95, .4], [.95, .4]]) table.add(box(.07, .76, .07, woodM, x, .38, z));
  const plate = cyl(.17, .14, .025, std(0xf7f3ec, { roughness: .3 }), -.05, .83, .12, 40); const food = ball(.09, std(0xc4975a, { roughness: .9 }), -.08, .86, .12); food.scale.set(1.2, .4, 1); const salad = ball(.06, std(0x4f9a4a, { roughness: .9 }), .03, .86, .08); salad.scale.set(1, .5, 1);
  const glass = cyl(.04, .034, .13, new THREE.MeshStandardMaterial({ color: 0xcfe8ff, transparent: true, opacity: .38, roughness: .05, metalness: .1, envMap: c.env, envMapIntensity: 1.5 }), .42, .88, -.1); glass.castShadow = false; const juice = cyl(.035, .03, .08, std(0xe3c25a, { roughness: .3 }), .42, .86, -.1);
  table.add(plate, food, salad, glass, juice); table.position.set(0, 0, .55); g.add(table);
  c.scene.add(g);
  // outside: sky seen through the window
  const sky = makeDaySky(c.scene, { pr, elevation: 50, azimuth: 205 });
  const sun = sunLight(c.scene, { pos: [2.2, 7.5, -8.5], target: [0, .6, 1.2], size: 7, intensity: 5.5 }); sun.shadow.radius = 5;
  const hemi = new THREE.HemisphereLight(0xfff4e2, 0x8a6a4c, .75); c.scene.add(hemi);
  const fill = new THREE.PointLight(0xffe9c8, 6, 12, 1.6); fill.position.set(0, 2.4, 3.5); c.scene.add(fill);
  return { g, sky, sun, hemi, fill, table,
    set(day, t = 0) { if (day > .5) c.post.exposure = .8; sky.set(day, t); sun.intensity = 5.5 * day; sun.castShadow = day > .02; hemi.intensity = lerp(.035, .75, day); fill.intensity = lerp(.0, 6, day); c.scene.background = new THREE.Color(day > .5 ? 0x8fb8e8 : 0x010206); } };
}
