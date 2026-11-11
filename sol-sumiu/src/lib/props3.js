// Part 3 sets: frozen-ocean diorama, Earth cutaway, geothermal plant, dome city, deep-sea vents.
import * as THREE from 'three';
import { TEX, canvasTex, rng, lerp, clamp, seg } from '../engine.js';
import { makeGlow, NOISE } from './space.js';
import { std, box, cyl, ball } from './sets.js';
import { makePuffs } from './props.js';

// ---------- ocean diorama (a cut block: ice on top, liquid water, hot sea floor) ----------
export function makeDiorama(c) {
  const g = new THREE.Group(), R = rng(12); const S = 4.2;
  const ice = box(S, .75, S, std(0xb9d2ee, { roughness: .5, envMap: c.env, envMapIntensity: .2 }), 0, 2.1, 0); g.add(ice);
  for (let i = 0; i < 26; i++) { const b = ball(.25 + R() * .4, std(0xd4e2f2, { roughness: 1 }), (R() - .5) * (S - .8), 2.47, (R() - .5) * (S - .8)); b.scale.y = .28; g.add(b); }
  for (let i = 0; i < 9; i++) { const ic = new THREE.Mesh(new THREE.ConeGeometry(.1 + R() * .1, .35 + R() * .5, 6), ice.material); ic.rotation.x = Math.PI; ic.position.set((R() - .5) * (S - .5), 1.6 - R() * .1, S / 2 - .15 - R() * .3); g.add(ic); }
  const water = new THREE.Mesh(new THREE.BoxGeometry(S, 3.5, S), new THREE.MeshStandardMaterial({ color: 0x1250a8, transparent: true, opacity: .5, roughness: .1, metalness: 0, emissive: 0x0a2a66, emissiveIntensity: .55, depthWrite: false })); water.position.y = -.02; water.renderOrder = 3; g.add(water);
  const floor = box(S, .7, S, std(0x2b2f3a, { roughness: 1 }), 0, -2.1, 0); g.add(floor);
  for (let i = 0; i < 14; i++) { const b = ball(.25 + R() * .35, std(0x353a47, { roughness: 1 }), (R() - .5) * (S - .7), -1.76, (R() - .5) * (S - .7)); b.scale.y = .5; g.add(b); }
  const vents = [];
  for (const [x, z, h] of [[-.9, .3, .9], [.7, -.4, 1.2], [1.2, .9, .7]]) { const ch = new THREE.Mesh(new THREE.ConeGeometry(.22, h, 9), std(0x1d2028, { roughness: 1 })); ch.position.set(x, -1.75 + h / 2, z); g.add(ch);
    const gl = makeGlow(.9, 0xffb84a); gl.position.set(x, -1.75 + h, z); g.add(gl); const l = new THREE.PointLight(0xffb84a, 2.2, 3.5, 1.6); l.position.copy(gl.position); g.add(l);
    const sm = makePuffs({ n: 8, rise: 1.5, spread: .25, size: [.15, .7], life: 3, op: .5, color: 0xffd08a, seed: x * 9 + 20, additive: true }); sm.position.copy(gl.position); g.add(sm); vents.push({ gl, sm }); }
  // heat arrows (rise from the floor, stop at the ice)
  const arrows = []; for (let i = 0; i < 6; i++) { const a = new THREE.Group(); a.add(cyl(.018, .018, .34, new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 1.2, .5) }), 0, 0, 0, 6)); const tip = new THREE.Mesh(new THREE.ConeGeometry(.06, .14, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 1.2, .5) })); tip.position.y = .24; a.add(tip); a.userData = { x: (R() - .5) * 3, z: 1.4 + R() * .6, o: R() }; g.add(a); arrows.push(a); }
  const pts = new Float32Array(260 * 3); for (let i = 0; i < 260; i++) pts.set([(R() - .5) * S * .95, (R() - .5) * 3.3, (R() - .5) * S * .95], i * 3);
  const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pts, 3)); const dust = new THREE.Points(pg, new THREE.PointsMaterial({ color: 0x9fc8ff, size: .03, transparent: true, opacity: .6, depthWrite: false })); g.add(dust);
  g.userData = { ice, water, set(t, heat = 1) { vents.forEach((v, i) => { v.sm.userData.set(t); v.gl.scale.setScalar(.85 + Math.sin(t * 5 + i) * .1); }); dust.rotation.y = t * .03;
    arrows.forEach(a => { const p = (t * .22 + a.userData.o) % 1; a.position.set(a.userData.x, -1.3 + p * 2.7, a.userData.z); const k = Math.sin(Math.PI * p) * heat; a.scale.setScalar(Math.max(.001, k)); a.visible = heat > .01; }); } };
  return g;
}

// ---------- Earth cutaway ----------
export function makeCutaway(R = 1) {
  const g = new THREE.Group(); const cut = Math.PI * 1.5;
  const crust = new THREE.Mesh(new THREE.SphereGeometry(R, 96, 64, 0, cut), new THREE.MeshStandardMaterial({ map: TEX.ice, roughness: .9 })); g.add(crust);
  const layers = [[.97, 0x7a2e12, .25], [.55, 0xff7a1e, 1.3], [.22, 0xfff0b0, 2.6]];
  const face = canvasTex(512, 512, (x, w, h) => { const gr = x.createRadialGradient(256, 256, 0, 256, 256, 256);
    gr.addColorStop(0, '#fff6d8'); gr.addColorStop(.2, '#ffe7a6'); gr.addColorStop(.23, '#ffc861'); gr.addColorStop(.54, '#e8a24a'); gr.addColorStop(.56, '#9a6a48'); gr.addColorStop(.8, '#6e5244'); gr.addColorStop(.965, '#4e4038'); gr.addColorStop(.975, '#c9d6e8'); gr.addColorStop(1, '#e9f0fa');
    x.fillStyle = gr; x.fillRect(0, 0, w, h); });
  const fm = new THREE.MeshBasicMaterial({ map: face, side: THREE.DoubleSide, color: new THREE.Color(1.5, 1.5, 1.5) });
  // sphere phi starts at -X and runs towards +Z: the removed wedge spans phi in [1.5pi, 2pi]; its faces are the half-discs at phi = 1.5pi and phi = 0
  const f1 = new THREE.Mesh(new THREE.CircleGeometry(R * .995, 64, -Math.PI / 2, Math.PI), fm); f1.rotation.y = Math.PI / 2; g.add(f1);       // plane x=0
  const f2 = new THREE.Mesh(new THREE.CircleGeometry(R * .995, 64, Math.PI / 2, Math.PI), fm); g.add(f2);                                    // plane z=0
  const core = new THREE.Mesh(new THREE.SphereGeometry(R * .22, 48, 32), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 2.4, 1.2) })); g.add(core);
  const glow = makeGlow(R * 1.5, 0xffc861); glow.material.opacity = .55; g.add(glow);
  const l = new THREE.PointLight(0xffc27a, 6, 8, 1.6); g.add(l);
  g.userData = { core, glow, set(t) { const k = 1 + Math.sin(t * 2.2) * .05; core.scale.setScalar(k); glow.scale.setScalar(R * 1.5 * k); } };
  return g;
}

// ---------- geothermal plant (Iceland) ----------
export function makeGeo(c) {
  const g = new THREE.Group(); const con = std(0xcfd6e0, { roughness: .8 }), pipe = std(0x9aa6b8, { roughness: .5, metalness: .3 }), dark = std(0x3b4250);
  g.add(box(6, 1.8, 3, con, 0, .9, 0), box(6.3, .2, 3.3, dark, 0, 1.9, 0), box(2.6, 2.6, 2.6, con, -4.2, 1.3, .2), box(2.9, .2, 2.9, dark, -4.2, 2.7, .2));
  const steams = [];
  for (const [x, z] of [[-1.6, -1.6], [.6, -1.9], [2.6, -1.5], [-4.2, -1.2]]) { g.add(cyl(.55, .7, 1.6, con, x, 2.6, z, 20));
    const s = makePuffs({ n: 16, rise: 9, spread: 2.2, size: [1.1, 6], life: 6, op: .26, seed: x * 7 + 50, color: 0x9aa6bc }); s.position.set(x, 3.4, z); g.add(s); steams.push(s); }
  for (let i = 0; i < 3; i++) { const p = cyl(.16, .16, 14, pipe, 5 + i * .0, .5 + i * .38, 2.2 - i * .45, 12); p.rotation.z = Math.PI / 2; p.position.x = 8; g.add(p); }
  for (let i = 0; i < 6; i++) { const w = new THREE.Mesh(new THREE.PlaneGeometry(.55, .5), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.3, 1.0, .55) })); w.position.set(-2.4 + i * .95, 1.0, 1.51); g.add(w); }
  const l = new THREE.PointLight(0xffd27a, 8, 14, 1.6); l.position.set(0, 1.4, 4); g.add(l);
  g.userData = { set(t) { steams.forEach(s => s.userData.set(t)); } }; return g;
}

// ---------- dome city ----------
const winTex = () => canvasTex(128, 256, (x, w, h) => { x.fillStyle = '#1a2030'; x.fillRect(0, 0, w, h); const R = rng(7); for (let j = 0; j < 12; j++) for (let i = 0; i < 5; i++) { x.fillStyle = R() > .35 ? '#ffd27a' : '#2a3246'; x.fillRect(8 + i * 24, 8 + j * 20, 14, 11); } });
export function makeDome(c, { r = 3, seed = 1, glass = true, inside = false } = {}) {
  const g = new THREE.Group(), R = rng(seed); const wt = winTex();
  const base = cyl(r * 1.02, r * 1.06, .3, std(0x4a5262, { roughness: .6, metalness: .4 }), 0, .15, 0, 64); g.add(base);
  const floor = cyl(r * .98, r * .98, .05, std(0x3d6a45, { roughness: 1 }), 0, .32, 0, 64); g.add(floor);
  for (let i = 0; i < 11; i++) { const a = R() * 6.28, d = R() * r * .62, h = .6 + R() * r * .55, w = .35 + R() * .35;
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), new THREE.MeshStandardMaterial({ color: 0x8892a6, roughness: .7, emissiveMap: wt, emissive: new THREE.Color(1.0, .75, .38), map: wt })); b.position.set(Math.cos(a) * d, .34 + h / 2, Math.sin(a) * d); b.castShadow = true; g.add(b); }
  for (let i = 0; i < 9; i++) { const a = R() * 6.28, d = r * (.55 + R() * .35); g.add(cyl(.03, .04, .3, std(0x5b4030), Math.cos(a) * d, .47, Math.sin(a) * d, 6), Object.assign(ball(.17, std(0x4c9a52, { roughness: .9 }), Math.cos(a) * d, .7, Math.sin(a) * d))); }
  const gh = box(r * .5, .22, r * .22, new THREE.MeshBasicMaterial({ color: new THREE.Color(1.5, .35, 1.3) }), -r * .45, .46, r * .5); g.add(gh);
  const l = new THREE.PointLight(0xffc27a, (inside ? 1.2 : 2.2) * r, r * 5, 1.5); l.position.y = r * .5; g.add(l);
  if (glass) { const dome = new THREE.Mesh(new THREE.SphereGeometry(r, 64, 32, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xbfe0ff, transparent: true, opacity: inside ? .05 : .1, roughness: .06, metalness: .2, envMap: c.env, envMapIntensity: inside ? .15 : .45, depthWrite: false, side: THREE.DoubleSide })); dome.position.y = .3; dome.renderOrder = 4; g.add(dome);
    const ribs = new THREE.Group(); for (let i = 0; i < 8; i++) { const rib = new THREE.Mesh(new THREE.TorusGeometry(r, .018, 6, 48, Math.PI), std(0xdfe8f5, { metalness: .6, roughness: .3 })); rib.rotation.y = i * Math.PI / 8; ribs.add(rib); } for (const k of [.38, .72]) { const ring = new THREE.Mesh(new THREE.TorusGeometry(r * Math.cos(Math.asin(k)), .016, 6, 64), std(0xdfe8f5, { metalness: .6, roughness: .3 })); ring.rotation.x = Math.PI / 2; ring.position.y = r * k; ribs.add(ring); } ribs.position.y = .3; g.add(ribs); }
  const gl = makeGlow(r * 3.2, 0xffd27a); gl.material.opacity = .1; gl.position.y = r * .5; if (!inside) g.add(gl);
  return g;
}

// ---------- deep-sea hydrothermal vents ----------
export function makeVents(c) {
  const g = new THREE.Group(), R = rng(33); c.scene.background = new THREE.Color(0x01060f); c.scene.fog = new THREE.FogExp2(0x01060f, .075);
  const gb = TEX.groundBump.clone(); gb.wrapS = gb.wrapT = THREE.RepeatWrapping; gb.repeat.set(8, 8); gb.needsUpdate = true;
  const fl = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), std(0x2a3040, { roughness: 1 })); fl.rotation.x = -Math.PI / 2; fl.receiveShadow = true; g.add(fl);
  for (let i = 0; i < 40; i++) { const b = ball(.3 + R() * .8, std(0x2a2f3b, { roughness: 1 }), (R() - .5) * 26, 0, (R() - .5) * 20 - 3); b.scale.y = .45; g.add(b); }
  const rock = std(0x1a1c22, { roughness: 1 }); const items = [];
  for (const [x, z, h, w] of [[0, 0, 4.2, .75], [-1.5, .9, 2.6, .55], [1.7, -.6, 3.3, .6], [-2.9, -1.6, 1.9, .5], [3.2, 1.2, 1.6, .45]]) {
    const ch = new THREE.Group(); let y = 0; const n = 5; for (let k = 0; k < n; k++) { const hh = h / n, r0 = w * (1 - k / n * .62), r1 = w * (1 - (k + 1) / n * .62); const s = cyl(r1 * (1 + R() * .2), r0 * (1.1 + R() * .25), hh * 1.08, rock, (R() - .5) * .12, y + hh / 2, (R() - .5) * .12, 9); s.rotation.y = R() * 3; ch.add(s); y += hh; }
    ch.position.set(x, 0, z); g.add(ch);
    const gl = makeGlow(w * 4.5, 0xffb84a); gl.position.set(x, h + .05, z); g.add(gl); const lip = cyl(w * .36, w * .4, .12, new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 1.6, .7) }), x, h, z, 12); g.add(lip);
    const l = new THREE.PointLight(0xffb84a, 9 * w, 9, 1.5); l.position.set(x, h + .5, z); g.add(l);
    const sm = makePuffs({ n: 16, rise: 6.5, spread: 1.0, size: [w * .9, w * 6], life: 5, op: .75, color: 0x0c0d12, seed: x * 5 + 70 }); sm.position.set(x, h + .1, z); g.add(sm);
    const em = makePuffs({ n: 8, rise: 1.6, spread: .2, size: [w * .7, w * 1.8], life: 1.6, op: .6, color: 0xffc861, seed: x * 3 + 90, additive: true }); em.position.set(x, h + .05, z); g.add(em);
    items.push({ gl, sm, em, w }); }
  // tube worms
  const tubeG = new THREE.CylinderGeometry(.035, .045, 1, 7); tubeG.translate(0, .5, 0); const n = 90; const tubes = new THREE.InstancedMesh(tubeG, std(0xe9e4d8, { roughness: .6 }), n), tips = new THREE.InstancedMesh(new THREE.SphereGeometry(.04, 8, 6), new THREE.MeshStandardMaterial({ color: 0xb84a7a, emissive: 0x6a2448, emissiveIntensity: .6 }), n);
  const d = new THREE.Object3D(); const wb = []; for (let i = 0; i < n; i++) { const a = R() * 6.28, rr = 1.1 + R() * 3.2, cx = [0, -1.5, 1.7][i % 3] * .8; wb.push({ x: cx + Math.cos(a) * rr * .8, z: Math.sin(a) * rr * .7 + .8, h: .35 + R() * .7, a: R() * 6.28, l: R() * .35 }); }
  g.add(tubes, tips);
  const pts = new Float32Array(700 * 3); for (let i = 0; i < 700; i++) pts.set([(R() - .5) * 22, R() * 10, (R() - .5) * 18], i * 3); const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pts, 3));
  const snow = new THREE.Points(pg, new THREE.PointsMaterial({ color: 0x8fb4e8, size: .045, transparent: true, opacity: .55, depthWrite: false })); g.add(snow);
  c.scene.add(g, new THREE.HemisphereLight(0x2a4a88, 0x05070c, .55));
  c.post.bloom = .75; c.post.threshold = .7; c.post.exposure = 1.25;
  return { g, set(t) { items.forEach((it, i) => { it.sm.userData.set(t); it.em.userData.set(t); it.gl.scale.setScalar(it.w * 4.5 * (1 + Math.sin(t * 6 + i * 2) * .08)); });
    wb.forEach((w, i) => { const sway = Math.sin(t * 1.3 + w.a) * .12; d.position.set(w.x, 0, w.z); d.rotation.set(w.l * Math.cos(w.a) + sway, 0, w.l * Math.sin(w.a)); d.scale.set(1, w.h, 1); d.updateMatrix(); tubes.setMatrixAt(i, d.matrix); d.position.set(w.x + Math.sin(w.l * Math.sin(w.a)) * -w.h, Math.cos(w.l) * w.h, w.z + Math.sin(w.l * Math.cos(w.a) + sway) * w.h); d.rotation.set(0, 0, 0); d.scale.setScalar(1); d.updateMatrix(); tips.setMatrixAt(i, d.matrix); });
    tubes.instanceMatrix.needsUpdate = tips.instanceMatrix.needsUpdate = true; snow.position.y = -((t * .12) % 1); snow.rotation.y = t * .01; } };
}
