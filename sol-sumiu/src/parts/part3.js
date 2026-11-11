// PARTE 3 — Um ano depois
import * as THREE from 'three';
import { clamp, lerp, seg, ss, eio, eo, ei, eback, pulse, wob, V } from '../engine.js';
import { TEXDEFS } from '../lib/textures.js';
import { makeEarth, makeGlow, makeSun, NOISE } from '../lib/space.js';
import { makeHelena } from '../lib/helena.js';
import { std, box, cyl, ball } from '../lib/sets.js';
import { spaceBase, brandOutro } from '../lib/common.js';
import { makeSnow, makeSnowField, makeThermo, addHotspots, makePuffs, ll } from '../lib/props.js';
import { makeDiorama, makeCutaway, makeGeo, makeDome, makeVents } from '../lib/props3.js';
export const textures = TEXDEFS;
const ct = (c, i) => (c.shot.caps[i] ? c.shot.caps[i].t0 : 1e9);
const iceEarth = (e, t, o = {}) => e.userData.set({ rot: 5.2 + t * .03, sunDir: V(.4, .6, 1).normalize(), sun: .2, ice: 1, clouds: 0, city: .25, rim: 2.4, amb: .05, atm: .2, ...o });
function studio(c, col = 0x0b0e17) { c.scene.background = new THREE.Color(col); const key = new THREE.DirectionalLight(0xdfe8ff, .85); key.position.set(4, 6, 6); c.scene.add(key, new THREE.HemisphereLight(0x8fa8ff, 0x1a1d28, .7)); const sp = spaceBase(c, { dome: .25, count: 2500 }); c.scene.background = new THREE.Color(col); return sp; }

export const shots = [
  { name: 'year', pre: .5, caps: [{ t: 'UM ANO|*DEPOIS.*', cls: 'mid', d: 1.9 }], post: .8, build(c) {
    const sp = spaceBase(c, { dome: .5 }); const e = makeEarth(1); c.scene.add(e); c.post.bloom = .5; c.post.threshold = .8; c.post.exposure = 1.3;
    return t => { c.path(t, [[0, [.4, .5, 7.2], [0, -.3, 0], 35], [c.dur, [0, .3, 4.4], [0, -.3, 0], 35]], eo); sp.set(t); iceEarth(e, t); c.fade = 1 - seg(t, 0, .4); }; } },

  { name: 'minus73', caps: ['A TEMPERATURA MÉDIA|DA SUPERFÍCIE:', '*MENOS 73 GRAUS.*'], post: .9, build(c) {
    c.scene.background = new THREE.Color(0x0b0e17); const th = makeThermo(c, { min: -100, max: 20 }); th.position.set(-.05, .2, 0); th.rotation.y = -.22; c.scene.add(th);
    const fl = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), std(0x12151f, { roughness: .35, metalness: .3, envMap: c.env, envMapIntensity: .3 })); fl.rotation.x = -Math.PI / 2; fl.position.y = -.5; c.scene.add(fl);
    const key = new THREE.SpotLight(0xffffff, 22, 20, .5, .6, 1.5); key.position.set(3, 5, 5); key.target.position.set(0, 1.2, 0); c.scene.add(key, key.target, new THREE.HemisphereLight(0x8fa8ff, 0x20242f, .5));
    const rim = new THREE.PointLight(0x5a9bff, 14, 9, 1.6); rim.position.set(-2.2, 1.2, -1.6); c.scene.add(rim); const snow = makeSnow({ pr: c.renderer.getPixelRatio(), box: [8, 6, 6], count: 500 }); snow.position.y = -.5; c.scene.add(snow);
    const val = c.hud('', 'num', 'font-size:54px;color:#8fc4ff'); const sub = c.hud('MÉDIA DA SUPERFÍCIE', 'lbl'); c.post.bloom = .5; c.post.threshold = .9; c.capY = 700;
    return t => { const k = eo(seg(t, .4, c.dur - 1.2)), v = lerp(-18, -73, k); th.userData.set(v); snow.userData.set(t);
      c.path(t, [[0, [1.9, 1.5, 7.4], [.75, 1.0, 0], 30], [c.dur, [1.3, 1.25, 6.4], [.75, .9, 0], 30]], eo);
      val.textContent = '−' + Math.abs(Math.round(v)) + ' °C'; c.place(val, V(.55, th.userData.yFor(v) + .2, 0), 78, 0); c.place(sub, V(.55, th.userData.yFor(v) + .2, 0), 78, 36); }; } },

  { name: 'oceanTop', caps: ['OS OCEANOS|CONGELARAM POR CIMA.', 'EMBAIXO, A ÁGUA', 'SEGUE *LÍQUIDA.*'], post: .7, build(c) {
    const sp = studio(c, 0x070a12); const d = makeDiorama(c); c.scene.add(d); c.post.bloom = .5; c.post.threshold = .95; const l1 = c.hud('GELO', 'tag cream'), l2 = c.hud('ÁGUA LÍQUIDA', 'tag');
    return t => { sp.set(t); d.userData.set(t, 0); d.rotation.y = -.55 + t * .05; c.path(t, [[0, [0, 6.5, 9.5], [0, 2.0, 0], 36], [c.dur, [0, 1.6, 11.5], [0, .15, 0], 36]], eio);
      c.place(l1, V(0, 2.1, 0).applyAxisAngle(V(0, 1, 0), d.rotation.y), -92, -30); l1.style.opacity = seg(t, .5, .8); c.place(l2, V(0, .2, 2.2).applyAxisAngle(V(0, 1, 0), d.rotation.y), 60, 0); l2.style.opacity = seg(t, ct(c, 1), ct(c, 1) + .25); }; } },

  { name: 'blanket', caps: ['O GELO VIRA|*COBERTOR:*', 'O FUNDO PODE|FICAR LÍQUIDO', 'POR *CENTENAS DE|MILHARES DE ANOS.*'], post: .8, build(c) {
    const sp = studio(c, 0x070a12); const d = makeDiorama(c); c.scene.add(d); c.post.bloom = .5; c.post.threshold = .95; const l1 = c.hud('ISOLANTE', 'tag cream'), l2 = c.hud('CALOR DO FUNDO', 'lbl o');
    return t => { sp.set(t); d.userData.set(t, seg(t, .3, 1)); d.rotation.y = -.3 + t * .04; c.path(t, [[0, [1.5, .4, 9.2], [0, .1, 0], 34], [c.dur, [.6, -.6, 7.2], [0, -.3, 0], 34]], eo);
      c.place(l1, V(0, 2.1, 2.1).applyAxisAngle(V(0, 1, 0), d.rotation.y), 0, 0); l1.style.opacity = seg(t, .3, .6); c.place(l2, V(0, -1.2, 2.2).applyAxisAngle(V(0, 1, 0), d.rotation.y), 0, 46); l2.style.opacity = seg(t, 1, 1.4); }; } },

  { name: 'core', caps: ['O CALOR QUE SOBRA', 'VEM DE *DENTRO|DA TERRA.*', 'O NÚCLEO É|TÃO QUENTE', 'QUANTO A|*SUPERFÍCIE DO SOL.*'], post: .9, build(c) {
    const sp = spaceBase(c, { dome: .4 }); const g = makeCutaway(1.25); c.scene.add(g); const kl = new THREE.DirectionalLight(0xdfe8ff, 2.2); kl.position.set(-3, 3, 5); c.scene.add(kl, new THREE.AmbientLight(0x8899cc, .5));
    c.post.bloom = .7; c.post.threshold = .85; const tag = c.hud('≈ 5.500 °C', 'tag', 'font-size:24px'), l1 = c.hud('NÚCLEO', 'lbl');
    return t => { sp.set(t); g.userData.set(t); g.rotation.y = lerp(Math.PI - 1.7, Math.PI - .2, eio(seg(t, 0, 2.2))) + t * .02; g.rotation.x = .18;
      c.path(t, [[0, [0, .9, 6.6], [0, -.1, 0], 35], [c.dur, [0, .6, 4.9], [0, -.15, 0], 35]], eo);
      c.place(tag, V(0, 0, 0), 0, -66); tag.style.opacity = seg(t, ct(c, 2), ct(c, 2) + .25); c.place(l1, V(0, 0, 0), 0, 50); l1.style.opacity = seg(t, ct(c, 1), ct(c, 1) + .3); }; } },

  { name: 'iceland', caps: ['POR ISSO HELENA', 'FOI PRA *ISLÂNDIA,*'], post: .6, build(c) {
    const sp = spaceBase(c, { dome: .45 }); const e = makeEarth(1); c.scene.add(e); const hs = addHotspots(e.userData.body, 1); c.post.bloom = .8; c.post.threshold = .7; c.post.exposure = 1.3; const tag = c.hud('ISLÂNDIA', 'tag');
    return t => { sp.set(t); const k = eio(seg(t, 0, c.dur - .5)); c.look([0, lerp(.8, 2.0, k), lerp(5.2, 2.6, k)], [0, lerp(0, .78, k), 0], 35);
      iceEarth(e, t, { rot: lerp(4.2, 5.03, k), sun: .25 }); hs.set(t, 1); e.updateMatrixWorld(true); const p = ll(64.9, -18.5, 1.02).applyMatrix4(e.userData.body.matrixWorld); c.place(tag, p, 0, -34); tag.style.opacity = seg(t, 1.2, 1.5); }; } },

  { name: 'geo', caps: ['ONDE QUASE 9|EM CADA 10 CASAS', 'JÁ ERAM AQUECIDAS', '*PELA TERRA.*'], post: .7, build(c) {
    const s = makeSnowField(c, { light: 3.5 }); const p = makeGeo(c); p.position.set(-1, 0, -9); p.rotation.y = .2; c.scene.add(p); const h = makeHelena({ env: c.env, outfit: 'parka' }); h.position.set(1.2, 0, 2.2); h.rotation.y = Math.PI - .5; c.scene.add(h);
    return t => { s.set(t); p.userData.set(t); h.userData.pose({ t, pitch: .2, armL: [.1, .12, .2], armR: [.1, .12, .2] }); c.path(t, [[0, [3.2, 1.7, 7.6], [0, 3.0, -6], 40], [c.dur, [2.4, 1.5, 6.4], [-.2, 3.4, -6], 40]], eo); }; } },

  { name: 'domes', caps: ['LÁ NASCEM AS|*CIDADES-BOLHA:*', 'TUDO FECHADO,|AQUECIDO', 'E MOVIDO A|*CALOR DA TERRA.*'], post: .8, build(c) {
    const s = makeSnowField(c, { light: 2.5 }); [[0, 0, 3.2, 1], [-6.5, -6, 2.3, 2], [6.2, -7.5, 2.6, 3], [1, -15, 2, 4]].forEach(([x, z, r, sd]) => { const d = makeDome(c, { r, seed: sd }); d.position.set(x, 0, z); c.scene.add(d); });
    const tube = cyl(.35, .35, 7, std(0x9aa6b8, { metalness: .5, roughness: .4 }), -3.2, .4, -3, 12); tube.rotation.set(Math.PI / 2, 0, .82); const tube2 = cyl(.35, .35, 7.5, std(0x9aa6b8, { metalness: .5, roughness: .4 }), 3.1, .4, -3.7, 12); tube2.rotation.set(Math.PI / 2, 0, -.7); c.scene.add(tube, tube2);
    const st = makePuffs({ n: 12, rise: 7, spread: 1.6, size: [.8, 4], life: 6, op: .2, color: 0x9aa6bc, seed: 3 }); st.position.set(4.5, .2, 1.5); c.scene.add(st);
    return t => { s.set(t); st.userData.set(t); c.path(t, [[0, [7, 2.2, 15], [0, 2.2, -2], 38], [c.dur, [-2.5, 4.2, 12.5], [0, 1.6, -2], 38]], eio); }; } },

  { name: 'few', caps: ['SÓ ALGUNS LUGARES|TÊM CALOR ASSIM.', 'CABE *POUCA GENTE.*'], post: .7, build(c) {
    const sp = spaceBase(c, { dome: .45 }); const e = makeEarth(1); c.scene.add(e); const hs = addHotspots(e.userData.body, 1); c.post.bloom = .8; c.post.threshold = .7; c.post.exposure = 1.3;
    return t => { sp.set(t); c.path(t, [[0, [0, .8, 3.6], [0, .2, 0], 35], [c.dur, [0, .4, 6.4], [0, -.3, 0], 35]], eio); iceEarth(e, t, { rot: 5.0 + t * .22, sun: .2 }); hs.set(t, 1); }; } },

  { name: 'airsnow', caps: ['LÁ FORA,|COM O TEMPO,', 'ATÉ O AR *CONGELA*', 'E CAI COMO *NEVE.*'], post: .7, build(c) {
    const s = makeSnowField(c, { light: 3 }); const d = makeDome(c, { r: 3, seed: 1 }); d.position.set(-1, 0, -9); c.scene.add(d); const sn2 = makeSnow({ pr: c.renderer.getPixelRatio(), count: 2600, box: [12, 9, 12], seed: 9, size: 4.5 }); sn2.position.set(0, 0, 3); c.scene.add(sn2);
    const h = makeHelena({ env: c.env, outfit: 'parka' }); h.position.set(.9, 0, 2.4); c.scene.add(h);
    return t => { s.set(t); sn2.userData.set(t); const k = eio(seg(t, .6, 1.8)); h.userData.pose({ t, pitch: lerp(0, .5, k), armL: [lerp(.1, 1.2, k), .3, lerp(.2, .9, k)], mood: -.3, browUp: k });
      c.path(t, [[0, [2.6, 1.3, 7.6], [.6, 1.25, 0], 36], [c.dur, [2.1, 1.2, 6.6], [.7, 1.3, 0], 36]], eo); }; } },

  { name: 'vents', caps: ['NO FUNDO DO MAR,', 'FONTES QUENTES|ALIMENTAM', 'UMA VIDA QUE', '*NUNCA PRECISOU|DO SOL.*'], post: .7, build(c) {
    const v = makeVents(c); return t => { v.set(t); c.path(t, [[0, [4.5, 6.5, 12], [0, 3.6, 0], 40], [c.dur, [2.2, 2.2, 8.2], [0, 2.6, 0], 40]], eio); }; } },

  { name: 'vents2', caps: ['ELA VAI|CONTINUAR LÁ', 'MUITO DEPOIS DE|A SUPERFÍCIE', '*CONGELAR DE VEZ.*'], post: .8, build(c) {
    const v = makeVents(c); return t => { v.set(t + 9); c.path(t, [[0, [-3.4, 1.0, 6.2], [-.6, 1.0, .6], 38], [c.dur, [-2.0, 1.3, 5.4], [.2, 2.0, 0], 38]], eio); }; } },

  { name: 'drift', caps: ['E A TERRA?', 'SEGUE A *30 KM|POR SEGUNDO,*', '*SEM DESTINO.*'], post: .8, build(c) {
    const sp = spaceBase(c, { dome: .65, count: 6000, size: 1.2 }); const e = makeEarth(.8); c.scene.add(e); c.post.bloom = .5; c.post.threshold = .8; c.post.exposure = 1.3;
    return t => { sp.set(t); sp.stars.rotation.y = t * .012; sp.sky.rotation.y = t * .012; e.position.set(lerp(-.6, .5, t / c.dur), -.2, 0); iceEarth(e, t); c.path(t, [[0, [0, .4, 4.2], [0, -.3, 0], 35], [c.dur, [.8, .6, 7.5], [0, -.5, 0], 35]], eio); }; } },

  { name: 'proxima', caps: ['MESMO SE APONTASSE', 'PRA ESTRELA|MAIS PRÓXIMA,', 'LEVARIA UNS|*40 MIL ANOS.*'], post: 1.0, build(c) {
    const sp = spaceBase(c, { dome: .55 }); const e = makeEarth(.32, { seg: 48 }); e.position.set(0, -1.25, 3); c.scene.add(e);
    const star = makeSun(.5); star.position.set(0, 2.6, -14); c.scene.add(star); const line = new THREE.Mesh(new THREE.CylinderGeometry(.012, .012, 1, 6), new THREE.MeshBasicMaterial({ color: 0xf4efe6, transparent: true, opacity: .6 })); c.scene.add(line);
    c.post.bloom = .6; c.post.threshold = .85; const l1 = c.hud('PRÓXIMA CENTAURI', 'lbl o'), l2 = c.hud('4,2 ANOS-LUZ', 'tag dark'), yr = c.hud('0 ANOS', 'num', 'left:50%;top:150px;font-size:46px');
    return t => { sp.set(t); const k = seg(t, .5, c.dur - 1.0), kk = k * k * (3 - 2 * k); star.userData.set(t, .8, c.cam); iceEarth(e, t, { rim: 3 });
      c.path(t, [[0, [1.2, -.8, 8.6], [0, .4, -4], 38], [c.dur, [.8, -.6, 8.0], [0, .5, -4], 38]], eo);
      const A = e.position.clone(), B = star.position.clone(), dv = B.clone().sub(A), len = dv.length() * lerp(.02, .93, kk); line.scale.set(1, len, 1); line.position.copy(A).addScaledVector(dv.clone().normalize(), len / 2 + .4); line.quaternion.setFromUnitVectors(V(0, 1, 0), dv.clone().normalize());
      c.place(l1, B, 0, 62); c.place(l2, A.clone().lerp(B, .45), 70, 0); l2.style.opacity = seg(t, .6, .9); yr.textContent = Math.round(kk * 40000).toLocaleString('pt-BR') + ' ANOS'; }; } },

  { name: 'galaxy', caps: ['A GALÁXIA|ESTÁ CHEIA', 'DE MUNDOS ASSIM:', '*SEM ESTRELA,*', 'VAGANDO NO ESCURO.'], post: .8, build(c) {
    const sp = spaceBase(c, { dome: 1.25, count: 9000, size: 1.25 }); c.post.bloom = .6; c.post.threshold = .7; c.post.exposure = 1.25; const R = [[-1.6, 1.2, -6, .1], [1.9, -.4, -9, .14], [.3, 2.6, -14, .2], [-2.6, -1.8, -12, .16], [.9, .2, -3.5, .07]];
    const worlds = R.map(([x, y, z, r]) => { const m = ball(r * 2.2, std(0x6f7c9a, { roughness: .9 }), x, y, z); m.castShadow = false; c.scene.add(m); return m; }); const l = new THREE.DirectionalLight(0x9fbcff, 3); l.position.set(-4, 3, 1); c.scene.add(l, new THREE.AmbientLight(0x8899cc, .08));
    const band = new THREE.Mesh(new THREE.PlaneGeometry(140, 70), new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
      fragmentShader: NOISE + `varying vec2 vUv; void main(){ vec2 p = (vUv - .5) * vec2(2., 1.); float n = fbm(vec3(p * 5., 1.)) * .5 + .5; float n2 = fbm(vec3(p * 14., 4.)) * .5 + .5; float b = exp(-pow((p.y + p.x * .28 + (n - .5) * .16) / .13, 2.)); float dust = smoothstep(.45, .7, n2) * exp(-pow((p.y + p.x * .28) / .05, 2.));
        vec3 col = mix(vec3(.25, .33, .6), vec3(.95, .8, .6), n) * b * (.35 + n2 * .5) * (1. - dust * .8) * smoothstep(1., .5, abs(p.x)); gl_FragColor = vec4(col * .55, 1.); }` })); band.position.set(0, 2, -60); band.rotation.z = .5; c.scene.add(band);
    return t => { sp.set(t); sp.sky.rotation.set(.5, 1.2 + t * .01, .3); worlds.forEach((m, i) => { m.position.x += 0; m.rotation.y = t * .2; }); c.path(t, [[0, [0, 0, 5], [0, .3, -6], 46], [c.dur, [.6, .3, 2.5], [0, .6, -8], 46]], eio); }; } },

  { name: 'final', caps: ['QUANTO TEMPO', 'UMA CIVILIZAÇÃO|SOBREVIVE', '*SEM UMA ESTRELA?*'], post: 1.6, build(c) {
    const s = makeSnowField(c, { light: 1.5, snowfall: false }); const d = makeDome(c, { r: 5, seed: 6, inside: true }); c.scene.add(d); const h = makeHelena({ env: c.env }); h.position.set(.3, .34, 2.6); h.rotation.y = Math.PI + .25; c.scene.add(h);
    const warm = new THREE.PointLight(0xffc27a, 2.2, 9, 1.6); warm.position.set(1.5, 2.2, 4.2); c.scene.add(warm); c.post.exposure = 1.5;
    return t => { s.set(t); h.userData.pose({ t, pitch: lerp(.1, .55, eio(seg(t, .3, 2))), armL: [.05, .1, .1], armR: [.05, .1, .1] });
      c.path(t, [[0, [1.3, 1.6, 6.6], [.2, 2.3, 0], 40], [c.dur, [1.0, 1.45, 5.9], [.1, 2.9, -1], 40]], eo); c.fade = seg(t, c.dur - .5, c.dur); }; } },

  { name: 'brand', dur: 3.4, build(c) { const u = brandOutro(c); return t => u(t); } },
];
