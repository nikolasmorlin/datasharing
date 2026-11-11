// PARTE 2 — Sete dias
import * as THREE from 'three';
import { clamp, lerp, seg, ss, eio, eo, ei, eback, pulse, wob, V } from '../engine.js';
import { TEXDEFS } from '../lib/textures.js';
import { makeEarth, makeGlow } from '../lib/space.js';
import { makeHelena } from '../lib/helena.js';
import { makeSolarFarm, makeRoom, makeTablet, std, box, cyl, ball } from '../lib/sets.js';
import { spaceBase, brandOpen, brandClose } from '../lib/common.js';
import { makeSnow, makeSnowField, makeThermo, makeCoffee, makeTree, makeCrops, makeHouse, makePlant, addHotspots, makePuffs, makeTurbine } from '../lib/props.js';
export const textures = TEXDEFS;
const ct = (c, i) => (c.shot.caps[i] ? c.shot.caps[i].t0 : 1e9);
const darkEarth = (e, t, o = {}) => e.userData.set({ rot: 5.05 + t * .03, sunDir: V(.5, .35, 1).normalize(), sun: 0, city: 2.4, rim: 2.2, amb: .03, ...o });
function nightFarm(c, frost = 0) { const f = makeSolarFarm(c); const h = makeHelena({ env: c.env, outfit: frost > .3 ? 'parka' : 'vest' }); h.position.set(1.3, 0, 2.4); c.scene.add(h); const tb = makeTablet(); h.userData.arms[1].grip.add(tb); tb.rotation.set(-1.15, 0, 0); tb.position.set(-.05, -.02, .06);
  const snow = makeSnow({ pr: c.renderer.getPixelRatio(), box: [16, 9, 16] }); snow.position.set(1.3, 0, 2); c.scene.add(snow); c.post.exposure = 2.0; c.post.bloom = .5; c.post.threshold = .8;
  return { f, h, tb, set(t, sn = 1) { f.set(0, t); f.frost(frost); f.hemi.intensity = .3 + frost * .45; tb.userData.l.intensity = .16; snow.userData.set(t, sn); } }; }
const bigNum = (c, top = 150) => c.hud('', '', `position:absolute;left:0;right:0;top:${top}px;text-align:center;font:600 76px/1 \'Inter Tight\';letter-spacing:-.03em;color:#F4F0E8;text-shadow:0 6px 30px rgba(20,23,31,.8)`);
const gauge = (c, label, top = 210) => { const el = c.hud(`<svg width="190" height="190" viewBox="0 0 190 190"><circle cx="95" cy="95" r="78" fill="rgba(20,23,31,.8)" stroke="rgba(244,240,232,.16)" stroke-width="13"/><circle class="a" cx="95" cy="95" r="78" fill="none" stroke="#F4F0E8" stroke-width="13" stroke-linecap="round" stroke-dasharray="490" stroke-dashoffset="490" transform="rotate(-90 95 95)"/></svg><div class="v" style="position:absolute;left:0;right:0;top:56px;text-align:center;font:600 50px 'Inter Tight';letter-spacing:-.03em;color:#F4F0E8">21%</div><div style="position:absolute;left:0;right:0;top:118px;text-align:center;font:600 8.5px Inter;letter-spacing:.28em;color:rgba(244,240,232,.75)">${label}</div>`, '', `position:absolute;left:175px;top:${top}px;width:190px;height:190px`);
  const a = el.querySelector('.a'), v = el.querySelector('.v'); return { el, set(k, txt, op = 1) { a.setAttribute('stroke-dashoffset', (490 * (1 - k)).toFixed(1)); v.textContent = txt; el.style.opacity = op; } }; };

export const shots = [
  { name: 'open', dur: 1.0, build(c) { return brandOpen(c); } },
  { name: 'recap', pre: .4, caps: ['O Sol *sumiu.*'], post: .5, build(c) {
    const sp = spaceBase(c, { dome: .5 }); const e = makeEarth(1); c.scene.add(e); c.post.bloom = .7; c.post.threshold = .6; c.post.exposure = 1.25;
    return t => { c.path(t, [[0, [.3, .4, 6.6], [0, -.3, 0], 35], [c.dur, [0, .3, 4.5], [0, -.3, 0], 35]], eo); sp.set(t); darkEarth(e, t); c.fade = 1 - seg(t, 0, .3); }; } },

  { name: 'seven', caps: ['Helena tem *sete dias.*'], post: .7, build(c) {
    const n = nightFarm(c); const num = bigNum(c, 176);
    return t => { n.set(t, seg(t, 0, 1)); n.h.position.set(1.3, 0, .2); n.h.userData.pose({ t, armR: [.55, .12, 1.25], pitch: lerp(.5, -.2, eio(seg(t, .3, 1.2))), mood: -.7, browUp: .6 });
      c.path(t, [[0, [2.5, 1.2, 3.2], [1.3, 1.45, .2], 34], [c.dur, [2.1, 1.3, 2.7], [1.3, 1.45, .2], 34]], eo);
      num.textContent = 'sete dias'; num.style.opacity = seg(t, ct(c, 0) + .5, ct(c, 0) + .8); num.style.transform = `translateY(${lerp(14, 0, eo(seg(t, ct(c, 0) + .5, ct(c, 0) + .9)))}px)`; }; } },

  { name: 'thermo', caps: ['É o tempo pra temperatura média da Terra', 'cair *abaixo de zero.*'], post: 1.0, build(c) {
    c.scene.background = new THREE.Color(0x0b0e17); const th = makeThermo(c); th.position.set(-.05, .2, 0); th.rotation.y = -.22; c.scene.add(th);
    const fl = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), std(0x12151f, { roughness: .35, metalness: .3, envMap: c.env, envMapIntensity: .3 })); fl.rotation.x = -Math.PI / 2; fl.position.y = -.5; fl.receiveShadow = true; c.scene.add(fl);
    const key = new THREE.SpotLight(0xffffff, 22, 20, .5, .6, 1.5); key.position.set(3, 5, 5); key.target.position.set(0, 1.2, 0); key.castShadow = true; key.shadow.mapSize.set(1024, 1024); c.scene.add(key, key.target, new THREE.HemisphereLight(0x8fa8ff, 0x20242f, .5));
    const rim = new THREE.PointLight(0x8fb3e8, 10, 9, 1.6); rim.position.set(-2.2, 1.2, -1.6); c.scene.add(rim);
    const day = c.hud('Dia 1', 'tag', 'left:50%;top:176px;font-size:12px'); const val = c.hud('15 °C', 'num', 'font-size:54px'); const sub = c.hud('MÉDIA DA TERRA', 'lbl');
    c.post.bloom = .5; c.post.threshold = .9; c.capY = 700;
    return t => { const k = seg(t, .6, c.dur - 1.0), v = 15 - 33 * (1 - Math.exp(-k * 2.6)) / (1 - Math.exp(-2.6)); th.userData.set(v);
      c.path(t, [[0, [1.9, 1.5, 7.4], [.75, 1.0, 0], 30], [c.dur, [1.3, 1.25, 6.4], [.75, .9, 0], 30]], eo);
      day.textContent = 'Dia ' + Math.min(7, 1 + Math.floor(k * 6.99)); val.textContent = (v < 0 ? '−' : '') + Math.abs(Math.round(v)) + ' °C'; val.style.color = '#F4F0E8';
      c.place(val, V(.55, th.userData.yFor(v) + .2, 0), 70, 0); c.place(sub, V(.55, th.userData.yFor(v) + .2, 0), 70, 36); }; } },

  { name: 'coffee', caps: ['O frio não vem de uma vez.', 'A Terra esfria como *um café esquecido:*', 'rápido no começo, devagar depois.'], post: .8, build(c) {
    c.scene.background = new THREE.Color(0x0d1018); const cf = makeCoffee(c); cf.scale.setScalar(1.5); c.scene.add(cf);
    const tb = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.2, .12, 64), std(0x8a6444, { roughness: .55 })); tb.position.y = -.12; tb.receiveShadow = true; c.scene.add(tb);
    const key = new THREE.SpotLight(0xffe2bd, 7, 20, .42, .7, 1.5); key.position.set(-2.5, 5, 3.5); key.target.position.set(0, .3, 0); key.castShadow = true; key.shadow.mapSize.set(1024, 1024); c.scene.add(key, key.target, new THREE.HemisphereLight(0x8fa8ff, 0x30241c, .22));
    const el = c.hud('<svg width="240" height="120" viewBox="0 0 240 120"><path d="M8 4V112H236" fill="none" stroke="rgba(244,240,232,.45)" stroke-width="2"/><path class="p" d="M10 12 C 40 78, 90 100, 232 106" fill="none" stroke="#F4F0E8" stroke-width="5" stroke-linecap="round" stroke-dasharray="270" stroke-dashoffset="270"/></svg><div style="position:absolute;left:14px;top:-2px;font:600 8px Inter;letter-spacing:.28em">TEMPERATURA</div><div style="position:absolute;right:6px;bottom:-12px;font:600 8px Inter;letter-spacing:.28em">TEMPO</div>', 'panel', 'left:134px;top:170px;padding:18px 16px 18px');
    const p = el.querySelector('.p'); c.post.bloom = .35; c.post.threshold = .95;
    return t => { const cool = seg(t, 1.2, c.dur - .6); cf.userData.steam.userData.set(t, 1 - cool * .92);
      c.path(t, [[0, [1.6, 2.6, 5.4], [0, .75, 0], 32], [c.dur, [.5, 2.0, 4.3], [0, .7, 0], 32]], eo);
      p.setAttribute('stroke-dashoffset', (270 * (1 - eo(seg(t, ct(c, 1), c.dur - .8)))).toFixed(1)); el.style.opacity = seg(t, ct(c, 1) - .3, ct(c, 1)); }; } },

  { name: 'ocean', caps: ['O oceano e o ar ainda guardam *o calor de ontem.*'], post: .6, build(c) {
    const sp = spaceBase(c, { dome: .5 }); const e = makeEarth(1); c.scene.add(e); c.post.bloom = .7; c.post.threshold = .6; c.post.exposure = 1.3; const tag = c.hud('Dia 2 · 9 °C', 'tag', 'left:50%;top:176px');
    return t => { c.path(t, [[0, [-.8, .2, 3.6], [0, -.2, 0], 35], [c.dur, [.2, .5, 4.6], [0, -.3, 0], 35]], eio); sp.set(t); darkEarth(e, t, { rot: 4.2 + t * .05, rim: 3 }); tag.style.opacity = seg(t, .2, .5); }; } },

  { name: 'food', caps: ['Primeiro problema: *a comida.*'], post: .6, build(c) {
    const r = makeRoom(c); const h = makeHelena({ env: c.env }); h.position.set(0, -.28, -.25); c.scene.add(h);
    const R = [[-.55, 0x3e5a80], [-.36, 0xf4efe6], [-.17, 0x6f9a62], [.52, 0x3e5a80], [.7, 0xe3b341]]; R.forEach(([x, col], i) => { const k = cyl(.075, .075, .2, std(col, { roughness: .4, metalness: .4 }), x, .92, .75 + (i % 2) * .12); r.g.add(k); if (i < 3) r.g.add(cyl(.075, .075, .2, std(R[(i + 2) % 5][1], { roughness: .4, metalness: .4 }), x + .05, 1.12, .78)); });
    const lan = new THREE.Group(); lan.add(cyl(.07, .09, .06, std(0x2a2f3a), 0, .03, 0), cyl(.05, .05, .16, new THREE.MeshBasicMaterial({ color: new THREE.Color(1.5, .9, .35) }), 0, .14, 0), cyl(.075, .06, .04, std(0x2a2f3a), 0, .24, 0)); lan.position.set(.62, .815, .8); r.g.add(lan);
    const ll = new THREE.PointLight(0xffd27a, 1.1, 8, 1.7); ll.position.set(.5, 1.12, 1.0); ll.castShadow = true; ll.shadow.mapSize.set(1024, 1024); c.scene.add(ll); const tag = c.hud('1 · a comida', 'tag', 'left:50%;top:176px;font-size:12px');
    return t => { r.set(0, t); c.post.exposure = 1.25; c.post.bloom = .45; c.post.threshold = .9; ll.intensity = 1.1 + wob(t * 5) * .1;
      h.userData.pose({ t, armL: [.5, .1, 1.3], armR: [.5, .1, 1.3], pitch: -.3, yaw: wob(t * .5) * .15, mood: -.6 });
      c.path(t, [[0, [1.3, 1.6, 4.6], [0, .98, .2], 32], [c.dur, [.5, 1.45, 3.7], [0, .98, .2], 32]], eo); tag.style.opacity = seg(t, .2, .5); }; } },

  { name: 'photo', caps: ['Sem luz, a fotossíntese *para na hora.*'], post: .6, build(c) {
    const s = makeSnowField(c, { snowfall: false, light: 3.2 }); s.ground.material.color.set(0x6a5440); const cr = makeCrops(); cr.position.set(0, 0, 3); c.scene.add(cr); const g = gauge(c, 'FOTOSSÍNTESE');
    return t => { s.set(t); const k = eio(seg(t, .5, c.dur - .4)); cr.userData.set(k * .55, 0); c.path(t, [[0, [1.2, .7, 5.2], [0, .45, 0], 36], [c.dur, [.5, .9, 4.3], [0, .35, 0], 36]], eo); g.set(1 - seg(t, .4, 1.3), Math.round(100 * (1 - seg(t, .4, 1.3))) + '%', seg(t, .1, .4)); }; } },

  { name: 'trees', caps: ['Árvores grandes resistem por décadas.', 'As lavouras, *não.*'], post: .7, build(c) {
    const s = makeSnowField(c, { light: 3 }); s.ground.material.color.set(0x8a8a96); const tr = makeTree(1); tr.position.set(-1.9, 0, -3); const cr = makeCrops({ rows: 5, len: 9 }); cr.position.set(1.6, 0, 3.5); c.scene.add(tr, cr);
    const l1 = c.hud('décadas', 'tag'), l2 = c.hud('semanas', 'tag cream');
    return t => { s.set(t); const k = eio(seg(t, ct(c, 1) - .3, c.dur - .3)); cr.userData.set(k, k * .7); tr.userData.set(k * .5);
      c.path(t, [[0, [1.5, 2.2, 11.5], [-.3, 2.4, 0], 36], [c.dur, [.8, 1.9, 9.8], [-.2, 2.2, 0], 36]], eo);
      c.place(l1, V(-1.9, 6.3, -3), 0, 0); l1.style.opacity = seg(t, ct(c, 0) + .5, ct(c, 0) + .7); c.place(l2, V(1.6, 1.3, 1.5), 0, 0); l2.style.opacity = seg(t, ct(c, 1), ct(c, 1) + .2); }; } },

  { name: 'stock', caps: ['O que está no estoque é *tudo o que existe.*'], post: .6, build(c) {
    const r = makeRoom(c); const cols = [0x3e5a80, 0xf4efe6, 0x8fb3e8, 0xe3b341, 0x6f9a62];
    for (let i = 0; i < 7; i++) for (let j = 0; j < 2 + (i % 3 === 0 ? 1 : 0); j++) r.g.add(cyl(.075, .075, .2, std(cols[(i + j * 2) % 5], { roughness: .4, metalness: .4 }), -.8 + i * .26, .92 + j * .2, .6 + (i % 2) * .1));
    const ll = new THREE.PointLight(0xffd27a, 2.4, 8, 1.7); ll.position.set(.4, 1.6, 2.2); ll.castShadow = true; c.scene.add(ll);
    return t => { r.set(0, t); c.post.exposure = 1.25; c.post.bloom = .4; c.post.threshold = .9; c.path(t, [[0, [-1.3, 1.5, 4.2], [0, .95, .6], 34], [c.dur, [1.1, 1.4, 3.9], [0, .95, .6], 34]], eio); }; } },

  { name: 'air', caps: ['Segundo problema: o ar.', 'Surpresa: o oxigênio *não acaba.*', 'Dá pra respirar por milênios.'], post: .7, build(c) {
    const sp = spaceBase(c, { dome: .5 }); const e = makeEarth(2.2); e.position.set(0, -2.9, 0); c.scene.add(e); c.post.bloom = .7; c.post.threshold = .6; c.post.exposure = 1.3; const g = gauge(c, 'OXIGÊNIO NO AR'); const tag = c.hud('2 · o ar', 'tag', 'left:50%;top:176px;font-size:12px');
    return t => { c.path(t, [[0, [0, .5, 5.4], [0, -.7, 0], 38], [c.dur, [.5, .25, 4.6], [0, -.75, 0], 38]], eo); sp.set(t); darkEarth(e, t, { rim: 5, rot: 5.05 + t * .02 }); g.set(.21 * eo(seg(t, .3, 1.4)), '21%', seg(t, .2, .5)); tag.style.opacity = seg(t, .1, .4); }; } },

  { name: 'energy', caps: ['Terceiro problema: a energia.', 'A usina de Helena *virou sucata.*'], post: .7, build(c) {
    const n = nightFarm(c, .8); const tag = c.hud('3 · a energia', 'tag', 'left:50%;top:176px;font-size:12px'); const pz = c.hud('Produção: 0%', 'tag cream', 'left:50%;top:214px');
    return t => { n.set(t); n.h.position.set(1.3, 0, 2.4); n.h.userData.pose({ t, armR: [.55, .12, 1.25], yaw: -.5 + wob(t * .4) * .2, pitch: .05, mood: -.7 });
      c.path(t, [[0, [-6.5, 3.2, 11], [1, 1.2, -3], 40], [c.dur, [-4.5, 2.2, 9], [1, 1.2, -3], 40]], eo); tag.style.opacity = seg(t, .1, .4); pz.style.opacity = seg(t, ct(c, 1), ct(c, 1) + .2); }; } },

  { name: 'wind', caps: ['Sem Sol, o vento *vai parando.*', 'E não há chuva pras represas.'], post: .6, build(c) {
    const s = makeSnowField(c, { light: 5 }); const tu = [[-1.5, -4, 1], [3.5, -14, .9], [-6, -24, .8]].map(([x, z, k]) => { const m = makeTurbine(); m.position.set(x, 0, z); m.scale.setScalar(k); c.scene.add(m); return m; });
    return t => { s.set(t); const a = 1.6 * (1 - Math.exp(-t * .55)) / .55; tu.forEach((m, i) => m.userData.rot.rotation.z = -a - i); c.path(t, [[0, [2.5, 1.4, 12], [-.5, 6.2, -4], 40], [c.dur, [1.5, 1.2, 10.5], [-.6, 6.8, -4], 40]], eo); }; } },

  { name: 'fossil', caps: ['Sobram petróleo, carvão e gás:', '*Sol guardado.* Ainda dá pra queimar.'], post: .7, build(c) {
    const s = makeSnowField(c); const p = makePlant(c); p.position.set(0, 0, -6); p.rotation.y = .25; c.scene.add(p);
    return t => { s.set(t); p.userData.set(t); c.path(t, [[0, [4, 1.6, 15], [0, 4.8, -6], 40], [c.dur, [2.5, 1.2, 12.5], [0, 5.2, -6], 40]], eo); }; } },

  { name: 'bars', caps: ['Mas há um problema.', 'Pra manter o planeta quente,', 'precisaríamos de *milhares de vezes* mais energia.'], post: .9, build(c) {
    c.scene.background = new THREE.Color(0x070910); c.scene.fog = new THREE.Fog(0x070910, 20, 120);
    const fl = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), std(0x10131c, { roughness: .3, metalness: .4, envMap: c.env, envMapIntensity: .25 })); fl.rotation.x = -Math.PI / 2; fl.receiveShadow = true; c.scene.add(fl);
    const hum = box(1.1, .1, 1.1, std(0xf4efe6, { emissive: 0xf4efe6, emissiveIntensity: .35 }), -1.5, .05, 0); c.scene.add(hum);
    const tower = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1, 1.6), new THREE.MeshStandardMaterial({ color: 0xffc861, emissive: 0xffc861, emissiveIntensity: .35, roughness: .5 })); tower.position.set(1.4, .5, 0); c.scene.add(tower);
    const gl = new THREE.PointLight(0xffc861, .8, 30, 1.6); c.scene.add(gl); c.scene.add(new THREE.HemisphereLight(0x8fa8ff, 0x20242f, .5));
    const l1 = c.hud('Humanidade', 'lbl'), l2 = c.hud('O que o Sol entregava', 'lbl o'), l3 = c.hud('~10.000×', 'num', 'font-size:56px'), l4 = c.hud('Fora de escala', 'lbl', 'left:50%;top:176px;opacity:.6');
    c.post.bloom = .6; c.post.threshold = .85;
    return t => { const t0 = ct(c, 1), k = eio(seg(t, t0, c.dur - .9)), hgt = lerp(.1, 90, k * k); tower.scale.y = hgt; tower.position.y = hgt / 2;
      const cy = lerp(1.2, 30, eio(seg(t, t0 + .8, c.dur - .5))); c.look([lerp(.6, 3, k), cy, lerp(8.5, 13, k)], [.4, cy + lerp(-.6, 9, k), 0], 40); gl.position.set(0, cy, 3);
      c.place(l1, V(-1.5, .1, .6), 0, 22); c.place(l2, V(1.4, .0, .9), -30, 40); l1.style.opacity = l2.style.opacity = seg(t, .3, .6) * (1 - seg(t, t0 + 1.2, t0 + 1.8));
      l3.style.left = '270px'; l3.style.top = '330px'; l3.style.opacity = seg(t, ct(c, 2) + .4, ct(c, 2) + .7); l3.style.transform = `translate(-50%,-50%) translateY(${lerp(12, 0, eo(seg(t, ct(c, 2) + .4, ct(c, 2) + .8)))}px)`; }; } },

  { name: 'house', caps: ['Dá pra aquecer *um lugar.*', 'Nunca o planeta.'], post: .9, build(c) {
    const s = makeSnowField(c); const h = makeHouse(c); h.position.set(0, 0, 0); h.rotation.y = -.35; c.scene.add(h);
    return t => { s.set(t); h.userData.smoke.userData.set(t); c.path(t, [[0, [2.2, 1.5, 9], [0, 1.9, 0], 36], [c.dur, [6, 9, 30], [0, 3.5, 0], 36]], eio); }; } },

  { name: 'choice', caps: ['Helena tem uma escolha:', 'ficar e congelar, ou *partir.*'], post: .7, build(c) {
    const n = nightFarm(c, .9);
    return t => { n.set(t); n.h.position.set(1.3, 0, .2); n.h.userData.pose({ t, armR: [.55, .12, 1.25], yaw: lerp(.5, -.1, eio(seg(t, .5, 2))), pitch: lerp(.3, 0, eio(seg(t, .5, 2))), mood: -.5 });
      c.path(t, [[0, [2.6, 1.35, 3.6], [1.3, 1.3, .2], 34], [c.dur, [2.0, 1.4, 2.9], [1.3, 1.32, .2], 34]], eo); }; } },

  { name: 'map', caps: ['Helena abre o mapa.', 'Só há um tipo de lugar', 'onde o calor *vem de baixo.*'], post: 1.0, build(c) {
    const sp = spaceBase(c, { dome: .45 }); const e = makeEarth(1); c.scene.add(e); const hs = addHotspots(e.userData.body, 1); c.post.bloom = .8; c.post.threshold = .7; c.post.exposure = 1.3; const tag = c.hud('vulcões · fontes quentes', 'tag', 'left:50%;top:150px');
    return t => { c.path(t, [[0, [0, .5, 5.2], [0, -.25, 0], 35], [c.dur, [0, 1.1, 3.9], [0, .1, 0], 35]], eio); sp.set(t);
      e.userData.set({ rot: lerp(3.2, 5.05 + .62, eio(seg(t, 0, c.dur - .6))), sunDir: V(.3, .6, 1).normalize(), sun: .22, ice: .55, clouds: 0, city: .7, rim: 2.2, amb: .05, atm: .25 }); hs.set(t, seg(t, .4, 2.2)); tag.style.opacity = seg(t, .6, .9); }; } },

  { name: 'close', dur: 2.3, build(c) { return brandClose(c, { q: 'onde ainda existe calor?', label: 'Parte 3' }); } },
];
