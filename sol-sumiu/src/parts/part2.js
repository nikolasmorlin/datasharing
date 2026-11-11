// PARTE 2 — Sete dias
import * as THREE from 'three';
import { clamp, lerp, seg, ss, eio, eo, ei, eback, pulse, wob, V } from '../engine.js';
import { TEXDEFS } from '../lib/textures.js';
import { makeEarth, makeGlow } from '../lib/space.js';
import { makeHelena } from '../lib/helena.js';
import { makeSolarFarm, makeRoom, makeTablet, std, box, cyl, ball } from '../lib/sets.js';
import { spaceBase, brandOutro, endCard } from '../lib/common.js';
import { makeSnow, makeSnowField, makeThermo, makeCoffee, makeTree, makeCrops, makeHouse, makePlant, addHotspots, makePuffs, makeTurbine } from '../lib/props.js';
export const textures = TEXDEFS;
const ct = (c, i) => (c.shot.caps[i] ? c.shot.caps[i].t0 : 1e9);
const darkEarth = (e, t, o = {}) => e.userData.set({ rot: 5.05 + t * .03, sunDir: V(.5, .35, 1).normalize(), sun: 0, city: 2.4, rim: 2.2, amb: .03, ...o });
function nightFarm(c, frost = 0) { const f = makeSolarFarm(c); const h = makeHelena({ env: c.env, outfit: frost > .3 ? 'parka' : 'vest' }); h.position.set(1.3, 0, 2.4); c.scene.add(h); const tb = makeTablet(); h.userData.arms[1].grip.add(tb); tb.rotation.set(-1.15, 0, 0); tb.position.set(-.05, -.02, .06);
  const snow = makeSnow({ pr: c.renderer.getPixelRatio(), box: [16, 9, 16] }); snow.position.set(1.3, 0, 2); c.scene.add(snow); c.post.exposure = 2.0; c.post.bloom = .5; c.post.threshold = .8;
  return { f, h, tb, set(t, sn = 1) { f.set(0, t); f.frost(frost); f.hemi.intensity = .3 + frost * .45; tb.userData.l.intensity = .16; snow.userData.set(t, sn); } }; }
const bigNum = (c, top = 150) => c.hud('', '', `position:absolute;left:0;right:0;top:${top}px;text-align:center;font:400 84px/1 Anton;color:#ff5a36;text-shadow:0 6px 30px rgba(0,0,0,.8)`);
const gauge = (c, label) => { const el = c.hud(`<svg width="190" height="190" viewBox="0 0 190 190"><circle cx="95" cy="95" r="78" fill="rgba(10,12,20,.55)" stroke="rgba(244,239,230,.16)" stroke-width="13"/><circle class="a" cx="95" cy="95" r="78" fill="none" stroke="#ff5a36" stroke-width="13" stroke-linecap="round" stroke-dasharray="490" stroke-dashoffset="490" transform="rotate(-90 95 95)"/></svg><div class="v" style="position:absolute;left:0;right:0;top:56px;text-align:center;font:700 52px Oswald;color:#fff">21%</div><div style="position:absolute;left:0;right:0;top:118px;text-align:center;font:800 9px Inter;letter-spacing:.3em;color:#f4efe6">${label}</div>`, '', 'position:absolute;left:175px;top:120px;width:190px;height:190px');
  const a = el.querySelector('.a'), v = el.querySelector('.v'); return { el, set(k, txt, op = 1) { a.setAttribute('stroke-dashoffset', (490 * (1 - k)).toFixed(1)); v.textContent = txt; el.style.opacity = op; } }; };

export const shots = [
  { name: 'recap', pre: .4, caps: ['O SOL *SUMIU.*'], post: .5, build(c) {
    const sp = spaceBase(c, { dome: .5 }); const e = makeEarth(1); c.scene.add(e); c.post.bloom = .7; c.post.threshold = .6; c.post.exposure = 1.25;
    return t => { c.path(t, [[0, [.3, .4, 6.6], [0, -.3, 0], 35], [c.dur, [0, .3, 4.5], [0, -.3, 0], 35]], eo); sp.set(t); darkEarth(e, t); c.fade = 1 - seg(t, 0, .3); }; } },

  { name: 'seven', caps: ['HELENA TEM', '*SETE DIAS.*'], post: .7, build(c) {
    const n = nightFarm(c); const num = bigNum(c, 140);
    return t => { n.set(t, seg(t, 0, 1)); n.h.position.set(1.3, 0, .2); n.h.userData.pose({ t, armR: [.55, .12, 1.25], pitch: lerp(.5, -.2, eio(seg(t, .3, 1.2))), mood: -.7, browUp: .6 });
      c.path(t, [[0, [2.5, 1.2, 3.2], [1.3, 1.45, .2], 34], [c.dur, [2.1, 1.3, 2.7], [1.3, 1.45, .2], 34]], eo);
      num.textContent = '7 DIAS'; num.style.opacity = seg(t, ct(c, 1), ct(c, 1) + .15); num.style.transform = `scale(${lerp(.6, 1, eback(seg(t, ct(c, 1), ct(c, 1) + .3)))})`; }; } },

  { name: 'thermo', caps: ['É O TEMPO', 'PRA TEMPERATURA MÉDIA|DA TERRA', 'CAIR *ABAIXO DE ZERO.*'], post: 1.0, build(c) {
    c.scene.background = new THREE.Color(0x0b0e17); const th = makeThermo(c); th.position.set(-.05, .2, 0); th.rotation.y = -.22; c.scene.add(th);
    const fl = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), std(0x12151f, { roughness: .35, metalness: .3, envMap: c.env, envMapIntensity: .3 })); fl.rotation.x = -Math.PI / 2; fl.position.y = -.5; fl.receiveShadow = true; c.scene.add(fl);
    const key = new THREE.SpotLight(0xffffff, 22, 20, .5, .6, 1.5); key.position.set(3, 5, 5); key.target.position.set(0, 1.2, 0); key.castShadow = true; key.shadow.mapSize.set(1024, 1024); c.scene.add(key, key.target, new THREE.HemisphereLight(0x8fa8ff, 0x20242f, .5));
    const rim = new THREE.PointLight(0xff5a36, 14, 9, 1.6); rim.position.set(-2.2, 1.2, -1.6); c.scene.add(rim);
    const day = c.hud('DIA 1', 'tag', 'left:50%;top:138px;font-size:22px'); const val = c.hud('15 °C', 'num', 'font-size:54px'); const sub = c.hud('MÉDIA DA TERRA', 'lbl');
    c.post.bloom = .5; c.post.threshold = .9; c.capY = 700;
    return t => { const k = seg(t, .6, c.dur - 1.0), v = 15 - 33 * (1 - Math.exp(-k * 2.6)) / (1 - Math.exp(-2.6)); th.userData.set(v);
      c.path(t, [[0, [1.9, 1.5, 7.4], [.75, 1.0, 0], 30], [c.dur, [1.3, 1.25, 6.4], [.75, .9, 0], 30]], eo);
      day.textContent = 'DIA ' + Math.min(7, 1 + Math.floor(k * 6.99)); val.textContent = (v < 0 ? '−' : '') + Math.abs(Math.round(v)) + ' °C'; val.style.color = v < 0 ? '#8fc4ff' : '#fff';
      c.place(val, V(.55, th.userData.yFor(v) + .2, 0), 70, 0); c.place(sub, V(.55, th.userData.yFor(v) + .2, 0), 70, 36); }; } },

  { name: 'coffee', caps: ['O FRIO NÃO VEM|DE UMA VEZ.', 'A TERRA ESFRIA', 'COMO UM|*CAFÉ ESQUECIDO:*', 'RÁPIDO NO COMEÇO,', '*DEVAGAR* DEPOIS.'], post: .8, build(c) {
    c.scene.background = new THREE.Color(0x0d1018); const cf = makeCoffee(c); cf.scale.setScalar(1.5); c.scene.add(cf);
    const tb = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.2, .12, 64), std(0x8a6444, { roughness: .55 })); tb.position.y = -.12; tb.receiveShadow = true; c.scene.add(tb);
    const key = new THREE.SpotLight(0xffe2bd, 7, 20, .42, .7, 1.5); key.position.set(-2.5, 5, 3.5); key.target.position.set(0, .3, 0); key.castShadow = true; key.shadow.mapSize.set(1024, 1024); c.scene.add(key, key.target, new THREE.HemisphereLight(0x8fa8ff, 0x30241c, .22));
    const el = c.hud('<svg width="240" height="120" viewBox="0 0 240 120"><path d="M8 4V112H236" fill="none" stroke="rgba(244,239,230,.55)" stroke-width="2"/><path class="p" d="M10 12 C 40 78, 90 100, 232 106" fill="none" stroke="#ff5a36" stroke-width="5" stroke-linecap="round" stroke-dasharray="270" stroke-dashoffset="270"/></svg><div style="position:absolute;left:14px;top:-2px;font:800 8px Inter;letter-spacing:.28em">TEMPERATURA</div><div style="position:absolute;right:6px;bottom:-12px;font:800 8px Inter;letter-spacing:.28em">TEMPO</div>', 'panel', 'left:134px;top:96px;padding:18px 16px 18px');
    const p = el.querySelector('.p'); c.post.bloom = .35; c.post.threshold = .95;
    return t => { const cool = seg(t, 1.2, c.dur - .6); cf.userData.steam.userData.set(t, 1 - cool * .92);
      c.path(t, [[0, [1.6, 2.6, 5.4], [0, .75, 0], 32], [c.dur, [.5, 2.0, 4.3], [0, .7, 0], 32]], eo);
      p.setAttribute('stroke-dashoffset', (270 * (1 - eo(seg(t, ct(c, 1), c.dur - .8)))).toFixed(1)); el.style.opacity = seg(t, ct(c, 1) - .3, ct(c, 1)); }; } },

  { name: 'ocean', caps: ['O OCEANO E O AR', 'AINDA GUARDAM', 'O *CALOR DE ONTEM.*'], post: .6, build(c) {
    const sp = spaceBase(c, { dome: .5 }); const e = makeEarth(1); c.scene.add(e); c.post.bloom = .7; c.post.threshold = .6; c.post.exposure = 1.3; const tag = c.hud('DIA 2 · 9 °C', 'tag dark', 'left:50%;top:150px');
    return t => { c.path(t, [[0, [-.8, .2, 3.6], [0, -.2, 0], 35], [c.dur, [.2, .5, 4.6], [0, -.3, 0], 35]], eio); sp.set(t); darkEarth(e, t, { rot: 4.2 + t * .05, rim: 3 }); tag.style.opacity = seg(t, .2, .5); }; } },

  { name: 'food', caps: ['*PRIMEIRO* PROBLEMA:', 'A *COMIDA.*'], post: .6, build(c) {
    const r = makeRoom(c); const h = makeHelena({ env: c.env }); h.position.set(0, -.28, -.25); c.scene.add(h);
    const R = [[-.55, 0xd24a2c], [-.36, 0xf4efe6], [-.17, 0x4f7fb8], [.52, 0xd24a2c], [.7, 0xe0b040]]; R.forEach(([x, col], i) => { const k = cyl(.075, .075, .2, std(col, { roughness: .4, metalness: .4 }), x, .92, .75 + (i % 2) * .12); r.g.add(k); if (i < 3) r.g.add(cyl(.075, .075, .2, std(R[(i + 2) % 5][1], { roughness: .4, metalness: .4 }), x + .05, 1.12, .78)); });
    const lan = new THREE.Group(); lan.add(cyl(.07, .09, .06, std(0x2a2f3a), 0, .03, 0), cyl(.05, .05, .16, new THREE.MeshBasicMaterial({ color: new THREE.Color(1.5, .9, .35) }), 0, .14, 0), cyl(.075, .06, .04, std(0x2a2f3a), 0, .24, 0)); lan.position.set(.62, .815, .8); r.g.add(lan);
    const ll = new THREE.PointLight(0xffb060, 1.1, 8, 1.7); ll.position.set(.5, 1.12, 1.0); ll.castShadow = true; ll.shadow.mapSize.set(1024, 1024); c.scene.add(ll); const tag = c.hud('1 · A COMIDA', 'tag', 'left:50%;top:140px;font-size:22px');
    return t => { r.set(0, t); c.post.exposure = 1.25; c.post.bloom = .45; c.post.threshold = .9; ll.intensity = 1.1 + wob(t * 5) * .1;
      h.userData.pose({ t, armL: [.5, .1, 1.3], armR: [.5, .1, 1.3], pitch: -.3, yaw: wob(t * .5) * .15, mood: -.6 });
      c.path(t, [[0, [1.3, 1.6, 4.6], [0, .98, .2], 32], [c.dur, [.5, 1.45, 3.7], [0, .98, .2], 32]], eo); tag.style.opacity = seg(t, .2, .5); }; } },

  { name: 'photo', caps: ['SEM LUZ,', 'A FOTOSSÍNTESE', '*PARA NA HORA.*'], post: .6, build(c) {
    const s = makeSnowField(c, { snowfall: false, light: 3.2 }); s.ground.material.color.set(0x6a5440); const cr = makeCrops(); cr.position.set(0, 0, 3); c.scene.add(cr); const g = gauge(c, 'FOTOSSÍNTESE');
    return t => { s.set(t); const k = eio(seg(t, .5, c.dur - .4)); cr.userData.set(k * .55, 0); c.path(t, [[0, [1.2, .7, 5.2], [0, .45, 0], 36], [c.dur, [.5, .9, 4.3], [0, .35, 0], 36]], eo); g.set(1 - seg(t, .4, 1.3), Math.round(100 * (1 - seg(t, .4, 1.3))) + '%', seg(t, .1, .4)); }; } },

  { name: 'trees', caps: ['ÁRVORES GRANDES', 'RESISTEM POR *DÉCADAS.*', 'AS LAVOURAS,', '*NÃO.*'], post: .7, build(c) {
    const s = makeSnowField(c, { light: 3 }); s.ground.material.color.set(0x8a8a96); const tr = makeTree(1); tr.position.set(-1.9, 0, -3); const cr = makeCrops({ rows: 5, len: 9 }); cr.position.set(1.6, 0, 3.5); c.scene.add(tr, cr);
    const l1 = c.hud('DÉCADAS', 'tag green'), l2 = c.hud('SEMANAS', 'tag');
    return t => { s.set(t); const k = eio(seg(t, ct(c, 2) - .3, c.dur - .3)); cr.userData.set(k, k * .7); tr.userData.set(k * .5);
      c.path(t, [[0, [1.5, 2.2, 11.5], [-.3, 2.4, 0], 36], [c.dur, [.8, 1.9, 9.8], [-.2, 2.2, 0], 36]], eo);
      c.place(l1, V(-1.9, 6.3, -3), 0, 0); l1.style.opacity = seg(t, ct(c, 1), ct(c, 1) + .2); c.place(l2, V(1.6, 1.3, 1.5), 0, 0); l2.style.opacity = seg(t, ct(c, 3), ct(c, 3) + .2); }; } },

  { name: 'stock', caps: ['O QUE ESTÁ|NO ESTOQUE', 'É *TUDO O QUE EXISTE.*'], post: .6, build(c) {
    const r = makeRoom(c); const cols = [0xd24a2c, 0xf4efe6, 0x4f7fb8, 0xe0b040, 0x4f9a4a];
    for (let i = 0; i < 7; i++) for (let j = 0; j < 2 + (i % 3 === 0 ? 1 : 0); j++) r.g.add(cyl(.075, .075, .2, std(cols[(i + j * 2) % 5], { roughness: .4, metalness: .4 }), -.8 + i * .26, .92 + j * .2, .6 + (i % 2) * .1));
    const ll = new THREE.PointLight(0xffb060, 2.4, 8, 1.7); ll.position.set(.4, 1.6, 2.2); ll.castShadow = true; c.scene.add(ll);
    return t => { r.set(0, t); c.post.exposure = 1.25; c.post.bloom = .4; c.post.threshold = .9; c.path(t, [[0, [-1.3, 1.5, 4.2], [0, .95, .6], 34], [c.dur, [1.1, 1.4, 3.9], [0, .95, .6], 34]], eio); }; } },

  { name: 'air', caps: ['*SEGUNDO:* O AR.', 'SURPRESA:', 'O OXIGÊNIO|*NÃO ACABA.*', 'DÁ PRA RESPIRAR', 'POR *MILÊNIOS.*'], post: .7, build(c) {
    const sp = spaceBase(c, { dome: .5 }); const e = makeEarth(2.2); e.position.set(0, -2.9, 0); c.scene.add(e); c.post.bloom = .7; c.post.threshold = .6; c.post.exposure = 1.3; const g = gauge(c, 'OXIGÊNIO NO AR'); const tag = c.hud('2 · O AR', 'tag', 'left:50%;top:92px;font-size:22px');
    return t => { c.path(t, [[0, [0, .5, 5.4], [0, -.7, 0], 38], [c.dur, [.5, .25, 4.6], [0, -.75, 0], 38]], eo); sp.set(t); darkEarth(e, t, { rim: 5, rot: 5.05 + t * .02 }); g.set(.21 * eo(seg(t, .3, 1.4)), '21%', seg(t, .2, .5)); tag.style.opacity = seg(t, .1, .4); }; } },

  { name: 'energy', caps: ['*TERCEIRO:* A ENERGIA.', 'A USINA DE HELENA', 'VIROU *SUCATA.*'], post: .7, build(c) {
    const n = nightFarm(c, .8); const tag = c.hud('3 · A ENERGIA', 'tag', 'left:50%;top:140px;font-size:22px'); const pz = c.hud('PRODUÇÃO: <b style="color:#ff5a36">0%</b>', 'tag dark', 'left:50%;top:184px');
    return t => { n.set(t); n.h.position.set(1.3, 0, 2.4); n.h.userData.pose({ t, armR: [.55, .12, 1.25], yaw: -.5 + wob(t * .4) * .2, pitch: .05, mood: -.7 });
      c.path(t, [[0, [-6.5, 3.2, 11], [1, 1.2, -3], 40], [c.dur, [-4.5, 2.2, 9], [1, 1.2, -3], 40]], eo); tag.style.opacity = seg(t, .1, .4); pz.style.opacity = seg(t, ct(c, 2), ct(c, 2) + .2); }; } },

  { name: 'wind', caps: ['SEM SOL,', 'NÃO HÁ *VENTO*', 'NEM *CHUVA*|PRAS REPRESAS.'], post: .6, build(c) {
    const s = makeSnowField(c, { light: 5 }); const tu = [[-1.5, -4, 1], [3.5, -14, .9], [-6, -24, .8]].map(([x, z, k]) => { const m = makeTurbine(); m.position.set(x, 0, z); m.scale.setScalar(k); c.scene.add(m); return m; });
    return t => { s.set(t); const a = 1.6 * (1 - Math.exp(-t * .55)) / .55; tu.forEach((m, i) => m.userData.rot.rotation.z = -a - i); c.path(t, [[0, [2.5, 1.4, 12], [-.5, 6.2, -4], 40], [c.dur, [1.5, 1.2, 10.5], [-.6, 6.8, -4], 40]], eo); }; } },

  { name: 'fossil', caps: ['SOBRAM PETRÓLEO,|CARVÃO E GÁS:', '*SOL GUARDADO.*', 'AINDA DÁ|PRA QUEIMAR.'], post: .7, build(c) {
    const s = makeSnowField(c); const p = makePlant(c); p.position.set(0, 0, -6); p.rotation.y = .25; c.scene.add(p);
    return t => { s.set(t); p.userData.set(t); c.path(t, [[0, [4, 1.6, 15], [0, 4.8, -6], 40], [c.dur, [2.5, 1.2, 12.5], [0, 5.2, -6], 40]], eo); }; } },

  { name: 'bars', caps: ['MAS HÁ|*UM PROBLEMA.*', 'PRA MANTER|O PLANETA QUENTE,', 'PRECISARÍAMOS|PRODUZIR', '*MILHARES DE VEZES*', 'MAIS ENERGIA.'], post: .9, build(c) {
    c.scene.background = new THREE.Color(0x070910); c.scene.fog = new THREE.Fog(0x070910, 20, 120);
    const fl = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), std(0x10131c, { roughness: .3, metalness: .4, envMap: c.env, envMapIntensity: .25 })); fl.rotation.x = -Math.PI / 2; fl.receiveShadow = true; c.scene.add(fl);
    const hum = box(1.1, .1, 1.1, std(0xf4efe6, { emissive: 0xf4efe6, emissiveIntensity: .35 }), -1.5, .05, 0); c.scene.add(hum);
    const tower = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1, 1.6), new THREE.MeshStandardMaterial({ color: 0xff5a36, emissive: 0xff3a16, emissiveIntensity: .6, roughness: .5 })); tower.position.set(1.4, .5, 0); c.scene.add(tower);
    const gl = new THREE.PointLight(0xff5a36, .8, 30, 1.6); c.scene.add(gl); c.scene.add(new THREE.HemisphereLight(0x8fa8ff, 0x20242f, .5));
    const l1 = c.hud('HUMANIDADE', 'lbl'), l2 = c.hud('O QUE O SOL ENTREGAVA', 'lbl o'), l3 = c.hud('~10.000×', 'num', 'font-size:44px;color:#ff5a36'), l4 = c.hud('FORA DE ESCALA', 'lbl', 'left:50%;top:150px;opacity:.6');
    c.post.bloom = .6; c.post.threshold = .85;
    return t => { const t0 = ct(c, 1), k = eio(seg(t, t0, c.dur - .9)), hgt = lerp(.1, 90, k * k); tower.scale.y = hgt; tower.position.y = hgt / 2;
      const cy = lerp(1.2, 30, eio(seg(t, t0 + .8, c.dur - .5))); c.look([lerp(.6, 3, k), cy, lerp(8.5, 13, k)], [.4, cy + lerp(-.6, 9, k), 0], 40); gl.position.set(0, cy, 3);
      c.place(l1, V(-1.5, .1, .6), 0, 22); c.place(l2, V(1.4, .0, .9), -30, 40); l1.style.opacity = l2.style.opacity = seg(t, .3, .6) * (1 - seg(t, t0 + 1.2, t0 + 1.8));
      l3.style.left = '270px'; l3.style.top = '300px'; l3.style.opacity = seg(t, ct(c, 3), ct(c, 3) + .2); l3.style.transform = `translate(-50%,-50%) scale(${lerp(.6, 1, eback(seg(t, ct(c, 3), ct(c, 3) + .3)))})`; }; } },

  { name: 'house', caps: ['DÁ PRA AQUECER|*UM LUGAR.*', '*NUNCA*|O PLANETA.'], post: .9, build(c) {
    const s = makeSnowField(c); const h = makeHouse(c); h.position.set(0, 0, 0); h.rotation.y = -.35; c.scene.add(h);
    return t => { s.set(t); h.userData.smoke.userData.set(t); c.path(t, [[0, [2.2, 1.5, 9], [0, 1.9, 0], 36], [c.dur, [6, 9, 30], [0, 3.5, 0], 36]], eio); }; } },

  { name: 'choice', caps: ['HELENA TEM|UMA ESCOLHA:', 'FICAR E *CONGELAR,*', 'OU *PARTIR.*'], post: .7, build(c) {
    const n = nightFarm(c, .9);
    return t => { n.set(t); n.h.position.set(1.3, 0, .2); n.h.userData.pose({ t, armR: [.55, .12, 1.25], yaw: lerp(.5, -.1, eio(seg(t, .5, 2))), pitch: lerp(.3, 0, eio(seg(t, .5, 2))), mood: -.5 });
      c.path(t, [[0, [2.6, 1.35, 3.6], [1.3, 1.3, .2], 34], [c.dur, [2.0, 1.4, 2.9], [1.3, 1.32, .2], 34]], eo); }; } },

  { name: 'map', caps: ['HELENA|ABRE O MAPA.', 'SÓ HÁ UM|TIPO DE LUGAR', 'ONDE O CALOR', '*VEM DE BAIXO.*'], post: 1.0, build(c) {
    const sp = spaceBase(c, { dome: .45 }); const e = makeEarth(1); c.scene.add(e); const hs = addHotspots(e.userData.body, 1); c.post.bloom = .8; c.post.threshold = .7; c.post.exposure = 1.3; const tag = c.hud('VULCÕES · FONTES QUENTES', 'tag dark', 'left:50%;top:150px');
    return t => { c.path(t, [[0, [0, .5, 5.2], [0, -.25, 0], 35], [c.dur, [0, 1.1, 3.9], [0, .1, 0], 35]], eio); sp.set(t);
      e.userData.set({ rot: lerp(3.2, 5.05 + .62, eio(seg(t, 0, c.dur - .6))), sunDir: V(.3, .6, 1).normalize(), sun: .22, ice: .55, clouds: 0, city: .7, rim: 2.2, amb: .05, atm: .25 }); hs.set(t, seg(t, .4, 2.2)); tag.style.opacity = seg(t, .6, .9); }; } },

  { name: 'end', dur: 3.6, build(c) {
    const sp = spaceBase(c, { dome: .35 }); const e = makeEarth(1); e.position.set(0, -2.6, 0); c.scene.add(e); const hs = addHotspots(e.userData.body, 1); c.post.bloom = .7; c.post.threshold = .7; c.post.exposure = 1.2;
    const card = endCard(c, { part: '3', q: 'ONDE AINDA<br>EXISTE <b>CALOR?</b>' });
    return t => { c.look([0, .4, 6.2], [0, -.6, 0], 35); sp.set(t); e.userData.set({ rot: 5.6 + t * .03, sunDir: V(0, 1, .4).normalize(), sun: .2, ice: .6, clouds: 0, city: .7, rim: 2.2, amb: .04, atm: .25 }); hs.set(t, 1); card(t); c.fade = seg(t, c.dur - .3, c.dur); }; } },

  { name: 'brand', dur: 3.2, build(c) { const u = brandOutro(c); return t => u(t); } },
];
