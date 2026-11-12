// PARTE 1 — O dia em que o Sol sumiu
import * as THREE from 'three';
import { clamp, lerp, seg, ss, eio, eo, ei, eback, pulse, wob, V } from '../engine.js';
import { TEXDEFS } from '../lib/textures.js';
import { makeSun, makeEarth, makeMoon, makeJupiter } from '../lib/space.js';
import { makeHelena } from '../lib/helena.js';
import { makeSolarFarm, makeRoom, makeTablet, makePhone } from '../lib/sets.js';
import { spaceBase, diagram, timerHud, brandOpen, brandClose, AU } from '../lib/common.js';
export const textures = TEXDEFS;

const ct = (c, i) => (c.shot.caps[i] ? c.shot.caps[i].t0 : 1e9);
const A0 = .5, e0 = V(Math.cos(A0), 0, Math.sin(A0)), p0 = V(-Math.sin(A0), 0, Math.cos(A0));
const mix3 = (a, b, k) => a.map((v, i) => lerp(v, b[i], k));
const pt = (e, p, y) => [e0.x * e + p0.x * p, y, e0.z * e + p0.z * p];
function prodHud(c, top = 170) {
  const el = c.hud('<div style="font:600 8px Inter;letter-spacing:.28em;color:rgba(244,240,232,.7);margin-bottom:8px">PRODUÇÃO DA USINA</div><div style="display:flex;align-items:center;gap:10px"><div class="bar" style="position:relative;width:150px"><i></i></div><div class="v" style="font:600 22px \'Inter Tight\';letter-spacing:-.02em;color:#F4F0E8;width:58px;text-align:right">100%</div></div>', 'panel', `left:50%;top:${top}px;transform:translateX(-50%);padding:12px 16px 12px`);
  const bar = el.querySelector('i'), v = el.querySelector('.v');
  return { el, set(k, op = 1) { bar.style.width = (k * 100).toFixed(1) + '%'; v.textContent = Math.round(k * 100) + '%'; el.style.opacity = op; v.style.color = '#F4F0E8'; } };
}
function farm(c, o) { const f = makeSolarFarm(c, o); const h = makeHelena({ env: c.env }); h.position.set(1.3, 0, 2.4); c.scene.add(h); const tb = makeTablet(); h.userData.arms[1].grip.add(tb); tb.rotation.set(-1.15, 0, 0); tb.position.set(-.05, -.02, .06); c.post.bloom = .22; c.post.threshold = 1.0; return { f, h, tb }; }
function night(c, k = 1) { c.post.exposure = lerp(.78, 1.35, k); c.post.bloom = lerp(.22, .6, k); c.post.threshold = lerp(1, .75, k); }

export const shots = [
  { name: 'open', dur: 1.0, build(c) { return brandOpen(c); } },
  { name: 'hook', pre: .4, post: 1.0, caps: [{ t: 'Imagine que o Sol *acabou de sumir.*', d: 2.3 }], build(c) {
    const sp = spaceBase(c, { dome: .5 }); const sun = makeSun(1); c.scene.add(sun); c.post.bloom = .6; c.post.threshold = .92;
    const ghost = new THREE.Mesh(new THREE.TorusGeometry(1, .008, 6, 120), new THREE.MeshBasicMaterial({ color: 0xf4f0e8, transparent: true })); c.scene.add(ghost);
    return t => { const tv = ct(c, 0) + 1.0, k = seg(t, tv, tv + .2);
      c.path(t, [[0, [0, .5, 7.4], [0, -.25, 0], 35], [c.dur, [0, .1, 5.6], [0, -.25, 0], 35]], eo);
      sun.scale.setScalar(Math.max(1e-4, 1 - ei(k))); sun.visible = k < 1; sun.userData.set(t * 1.5, 1 + k * 2.5, c.cam); sp.set(t);
      ghost.quaternion.copy(c.cam.quaternion); ghost.visible = k >= 1; ghost.material.opacity = .5 * (1 - seg(t, tv + .2, tv + 1.2)); if (t < .3) { c.fade = 1 - seg(t, 0, .3); } ghost.scale.setScalar(1 + seg(t, tv + .2, tv + 1.2) * .25);
      c.fadeColor = '#F4F0E8'; c.fade = pulse(t, tv + .05, tv + .3, .1) * .35; }; } },

  { name: 'nobody', caps: ['Mas, por enquanto, *ninguém* na Terra sabe.'], post: .5, build(c) {
    const sp = spaceBase(c); const e = makeEarth(1); c.scene.add(e); c.post.bloom = .35; const tag = c.hud('12:00 · meio-dia', 'tag', 'left:50%;top:176px');
    return t => { c.path(t, [[0, [.5, .5, 4.9], [0, -.25, 0], 35], [c.dur, [-.3, .35, 4.2], [0, -.3, 0], 35]], eo); sp.set(t);
      e.userData.set({ rot: 5.05 + t * .03, sunDir: V(.5, .35, 1).normalize(), sun: 1, cloud: t * .002 }); tag.style.opacity = seg(t, .2, .5); }; } },

  { name: 'farmIntro', caps: ['Nem a Helena, que trabalha numa *usina solar.*'], build(c) {
    const { f, h, tb } = farm(c); const tag = c.hud('Helena', 'tag cream', '');
    return t => { f.set(1, t); h.userData.pose({ t, armR: [.55, .12, 1.25], armL: [.05, .1, .15], yaw: lerp(-.5, .15, eio(seg(t, .6, 1.6))), pitch: lerp(-.3, .02, eio(seg(t, .6, 1.6))), mood: .7 });
      c.path(t, [[0, [2.9, 1.5, 7.2], [1.2, 1.2, 2.4], 34], [c.dur, [2.3, 1.42, 5.9], [1.25, 1.22, 2.4], 34]], eo);
      c.place(tag, V(1.3, 1.62, 2.4), 78, 0); tag.style.opacity = seg(t, .5, .8); }; } },

  { name: 'farmWide', caps: ['É meio-dia, e a produção está *no máximo.*'], post: .5, build(c) {
    const { f, h } = farm(c); const hud = prodHud(c);
    return t => { f.set(1, t); h.userData.pose({ t, armR: [.55, .12, 1.25], mood: .5 });
      c.path(t, [[0, [-7.5, 4.2, 12], [1, 1.4, -4], 40], [c.dur, [-4.5, 7.5, 14.5], [1, .6, -6], 40]], eio);
      hud.set(ss(.2, 1.3, t), seg(t, .1, .4)); }; } },

  { name: 'skyBlue', caps: ['O céu continua *azul,*', 'então, pra ela, o Sol ainda está lá.'], post: .5, build(c) {
    const { f, h } = farm(c, { azimuth: 204, elevation: 36 });
    return t => { f.set(1, t); const k = eio(seg(t, .2, 1.2)); h.userData.pose({ t, armR: [.4, .1, 1.0], armL: [lerp(0, 2.3, k), .35, lerp(.1, 1.5, k)], pitch: lerp(0, .55, k), yaw: .3, mood: .4 }); h.rotation.y = 2.5;
      c.path(t, [[0, [2.9, .55, 6.0], [1.2, 2.5, 2.0], 40], [c.dur, [2.6, .45, 5.5], [1.1, 2.9, 1.6], 40]], eo); }; } },

  { name: 'light', caps: ['Isso porque a luz leva *oito minutos* pra chegar aqui.', 'Ou seja, a última luz do Sol ainda está a caminho.'], build(c) {
    const d = diagram(c); const tm = timerHud(c); const l1 = c.hud('TERRA', 'lbl'), l2 = c.hud('ÚLTIMA LUZ', 'lbl o');
    return t => { c.path(t, [[0, pt(12.6, 2.6, 3.9), pt(3.3, 0, -1.0), 37], [c.dur, pt(11.6, 1.6, 3.3), pt(3.3, 0, -1.0), 37]], eo);
      const fr = lerp(.9, 2.9, t / c.dur); d.set({ t, sun: 0, front: fr, ang: A0 + t * .012 }); tm.set(500 - 62 - t * 9, seg(t, .1, .4));
      c.place(l1, d.ePos, 0, 40); c.place(l2, V(e0.x * fr, .3, e0.z * fr), 0, -22); l2.style.opacity = seg(t, .4, .8); }; } },

  { name: 'distance', caps: ['Afinal, ela atravessa *150 milhões* de quilômetros.'], post: .5, build(c) {
    const d = diagram(c); const tm = timerHud(c); const num = c.hud('150.000.000 KM', 'num'); const l0 = c.hud('SOL · AUSENTE', 'lbl o'), l1 = c.hud('TERRA', 'lbl');
    return t => { c.path(t, [[0, pt(12.5, 0, 9.5), pt(3.4, 0, -.6), 37], [c.dur, pt(12.0, -1.2, 11.5), pt(3.4, 0, -.6), 37]], eo);
      d.set({ t, sun: 0, front: 2.9 + t * .16, ang: A0 + .03 + t * .012, link: eo(seg(t, .2, 1.1)) }); tm.set(500 - 90 - t * 9);
      c.place(num, V(e0.x * 3.6, 1.1, e0.z * 3.6), 74, 0); num.style.opacity = seg(t, .8, 1.1); c.place(l0, V(0, 1.6, 0), 0, -6); c.place(l1, d.ePos, 0, 36); }; } },

  { name: 'gravity', caps: ['E a gravidade? Será que ela some na hora?', 'Não: ela viaja na mesma velocidade, *a da luz.*'], post: .6, build(c) {
    const d = diagram(c); const tm = timerHud(c); const l2 = c.hud('ESPAÇO AINDA CURVADO', 'lbl'), l3 = c.hud('JÁ PLANO', 'lbl o');
    return t => { c.path(t, [[0, [7.2, 3.4, 9.6], [.6, -1.3, 0], 36], [c.dur, [5.4, 4.6, 8.6], [.4, -1.0, 0], 36]], eio);
      const fr = lerp(1.2, 4.6, eio(t / c.dur)); d.set({ t, sun: 0, front: fr, ang: A0 + .05 }); tm.set(500 - 120 - t * 9);
      c.place(l2, V(-fr - 2.2, -.2, 1.5), 0, 0); c.place(l3, V(.2, .25, .6), 0, 0); l2.style.opacity = l3.style.opacity = seg(t, 1.2, 1.6); }; } },

  { name: 'ghostOrbit', caps: ['Por isso, durante oito minutos, nada muda.', 'A Terra segue orbitando *um Sol que não existe.*'], post: .6, build(c) {
    const d = diagram(c); const tm = timerHud(c); const l1 = c.hud('TERRA', 'lbl');
    return t => { c.path(t, [[0, [0, 12.5, 15.5], [0, -1.2, 1.2], 36], [c.dur, [0, 15, 12.5], [0, -1.2, .8], 36]], eio);
      d.set({ t, sun: 0, front: 4.6 + t * .12, ang: 1.05 + t * .16, orbit: .6 }); tm.set(500 - 215 - t * 9); c.place(l1, d.ePos, 0, 34); }; } },

  { name: 'lunch', caps: ['Enquanto isso, Helena almoça,', 'responde uma mensagem', 'e ainda reclama do *calor.*'], post: .7, build(c) {
    const r = makeRoom(c); const h = makeHelena({ env: c.env }); h.position.set(0, -.28, -.25); c.scene.add(h); const ph = makePhone(); h.userData.arms[0].grip.add(ph); ph.rotation.set(-1.35, 0, 0); ph.position.set(.02, 0, .04);
    const tm = timerHud(c); c.post.bloom = .3; c.post.threshold = 1.0; const bub = c.hud('• • •', 'tag cream', 'font-size:16px;letter-spacing:.12em;padding:4px 10px 7px 13px;border-radius:14px');
    return t => { r.set(1, t); const k = eio(seg(t, ct(c, 1) - .2, ct(c, 1) + .4)), w = eio(seg(t, ct(c, 2) - .1, ct(c, 2) + .5));
      h.userData.pose({ t, armL: [lerp(.3, .85, k), .12, lerp(.9, 1.75, k)], armR: [lerp(.45, 1.55, w), lerp(.1, .5, w), lerp(1.3, 2.25, w)], yaw: lerp(0, .28, k) * (1 - w), pitch: lerp(-.32, -.2, k) + w * .3, tilt: w * .1, mood: lerp(.5, -.35, w), mouth: w > .5 ? 'flat' : 'smile' });
      c.path(t, [[0, [1.5, 1.75, 5.6], [0, .98, 0], 32], [c.dur, [.5, 1.55, 4.5], [0, .95, 0], 32]], eo);
      tm.set(243 - t * 22); c.place(bub, V(-.2, 1.25, .1), -78, -30); bub.style.opacity = pulse(t, ct(c, 1), ct(c, 2), .15); }; } },

  { name: 'nowarn', caps: ['E nenhum satélite consegue avisar,', 'já que nada viaja *mais rápido que a luz.*'], post: .5, build(c) {
    const d = diagram(c); const tm = timerHud(c);
    return t => { c.path(t, [[0, pt(9.9, 1.5, 1.25), pt(4.6, -.3, -.4), 36], [c.dur, pt(9.5, 1.1, 1.05), pt(4.6, -.3, -.4), 36]], eo);
      d.set({ t, sun: 0, front: lerp(5.0, 6.15, t / c.dur), ang: A0 + .1 + t * .01 }); tm.set(120 - t * 8); }; } },

  { name: 'oneMin', caps: ['Até que falta *um minuto.*'], post: .6, build(c) {
    const { f, h } = farm(c); const tm = timerHud(c);
    return t => { f.set(1, t); h.position.set(1.3, 0, lerp(-3.5, .2, t / c.dur)); h.userData.pose({ t, walk: 1, walkPhase: t * 6.5, armR: [.55, .12, 1.25], pitch: -.25, mood: .5 });
      c.path(t, [[0, [1.9, 1.2, 5.6], [1.3, 1.15, 0], 36], [c.dur, [1.75, 1.25, 5.2], [1.3, 1.2, 0], 36]], eo); tm.set(60 - t * 1.6); }; } },

  { name: 'count', pre: .2, post: .25, caps: [{ t: '3', d: .85, cls: 'big' }, { t: '2', d: .85, cls: 'big' }, { t: '1', d: .85, cls: 'big' }], build(c) {
    const { f, h } = farm(c); const tm = timerHud(c);
    return t => { f.set(1, t); h.position.set(1.3, 0, .2); const k = eio(seg(t, 1.5, 2.3)); h.userData.pose({ t, armR: [.55, .12, 1.25], pitch: lerp(-.3, .3, k), yaw: .1, mood: .4 });
      c.path(t, [[0, [1.9, 1.45, 3.5], [1.3, 1.3, .2], 30], [c.dur, [1.7, 1.48, 2.9], [1.3, 1.32, .2], 30]], eo); tm.set(3.99 - (t - .2) / .85); }; } },

  { name: 'blackout', pre: .9, post: 1.0, caps: [{ t: 'E, de repente, o céu *apaga.*', d: 1.9 }], build(c) {
    const { f, h, tb } = farm(c); const hud = prodHud(c);
    return t => { const tv = ct(c, 0) + .55, day = 1 - seg(t, tv, tv + .1), n = 1 - day; f.set(day, t); night(c, n); tb.userData.l.intensity = .5 * n;
      h.position.set(1.3, 0, .2); const k = eio(seg(t, tv + .25, tv + .9)); h.userData.pose({ t, armR: [.55, .12, 1.25], pitch: lerp(-.25, .6, k), mood: lerp(.4, -.9, seg(t, tv, tv + .3)), browUp: n });
      c.path(t, [[0, [-5.5, 5.2, 11.5], [1, 1.2, -4], 40], [c.dur, [-4.6, 4.6, 10.3], [1, 1.6, -4], 40]], eo);
      hud.set(1 - ss(tv, tv + .5, t)); }; } },

  { name: 'helenaDark', caps: ['É meio-dia, mas é *noite total.*'], post: .6, build(c) {
    const { f, h, tb } = farm(c);
    return t => { f.set(0, t); night(c, 1); tb.userData.l.intensity = .4; h.position.set(1.3, 0, .2); h.userData.pose({ t, armR: [.55, .12, 1.25], pitch: lerp(.45, .65, eio(seg(t, 0, 1.5))), yaw: wob(t * .6) * .2, mood: -.9, browUp: 1 });
      c.path(t, [[0, [2.3, 1.15, 2.6], [1.3, 1.6, .2], 34], [c.dur, [2.6, .95, 3.0], [1.25, 1.75, .2], 34]], eo); }; } },

  { name: 'moon', caps: ['A Lua *some junto,*', 'porque ela só refletia a luz do Sol.'], post: .7, build(c) {
    const sp = spaceBase(c, { dome: .5 }); const m = makeMoon(1); c.scene.add(m); const l = new THREE.DirectionalLight(0xfff4e0, 2.4); l.position.set(3, 1.2, 2.6); const rl = new THREE.DirectionalLight(0x7f9cff, .16); rl.position.set(-3, 1.5, -2.5); c.scene.add(l, rl, new THREE.AmbientLight(0x8899cc, .02)); c.post.bloom = .35;
    return t => { c.path(t, [[0, [0, .3, 5.6], [0, -.2, 0], 35], [c.dur, [.3, .2, 4.9], [0, -.25, 0], 35]], eo); sp.set(t); m.rotation.y = 1 + t * .03;
      const tv = ct(c, 0) + .75; l.intensity = 2.4 * (1 - seg(t, tv, tv + .12)); }; } },

  { name: 'gravEnd', caps: ['E, no mesmo instante, *a gravidade acaba.*'], post: .6, build(c) {
    const d = diagram(c); const l1 = c.hud('TERRA', 'lbl');
    return t => { c.path(t, [[0, pt(10.6, 2.2, 1.9), pt(5.4, -.5, -.3), 36], [c.dur, pt(10.2, 1.6, 1.5), pt(5.6, -.5, -.3), 36]], eo);
      d.set({ t, sun: 0, front: lerp(6.0, 9.2, t / c.dur), ang: A0 + .12 }); c.place(l1, d.ePos, 0, 60); }; } },

  { name: 'straight', caps: ['A Terra, que corria a 30 km por segundo,', 'agora segue *em linha reta.*'], post: .8, build(c) {
    const d = diagram(c); const l1 = c.hud('30 km/s', 'tag', '');
    return t => { c.path(t, [[0, [-8.4, 2.6, 8.2], [-6.5, .2, -3], 40], [c.dur, [-8.0, 3.6, 9.4], [-6.6, .2, -4], 40]], eio);
      const k = Math.max(0, t - 1.0); d.set({ t, sun: 0, front: 30, ang: Math.PI - .3 + Math.min(t, 1.0) * .3, free: k > 0 ? k * 2.0 : 0, orbit: .75 }); c.place(l1, d.ePos, 56, -4); l1.style.opacity = seg(t, .9, 1.2); }; } },

  { name: 'jupiter', caps: ['Mesmo assim, Júpiter brilha por *mais de uma hora,*', 'refletindo um Sol que já não existe.'], post: 1.1, build(c) {
    const sp = spaceBase(c, { dome: .5 }); const j = makeJupiter(1); c.scene.add(j); c.post.bloom = .3; const tag = c.hud('+ 1 hora', 'tag', 'left:50%;top:176px');
    return t => { c.path(t, [[0, [.8, .5, 6.2], [0, -.3, 0], 35], [c.dur, [-.4, .3, 4.7], [0, -.35, 0], 35]], eo); sp.set(t);
      const tv = c.shot.caps[1].t1 + .15; j.userData.set(t, .8 * (1 - seg(t, tv, tv + .15))); j.userData.u.uSunDir.value.set(.9, .25, .7).normalize(); tag.style.opacity = seg(t, ct(c, 0) + .6, ct(c, 0) + .9); }; } },

  { name: 'window', caps: ['Então Helena olha pela janela', 'e vê *estrelas* ao meio-dia.'], post: .8, build(c) {
    const r = makeRoom(c); r.table.visible = false; const h = makeHelena({ env: c.env }); h.position.set(.25, 0, -.9); h.rotation.y = Math.PI + .15; c.scene.add(h); const ph = makePhone(); h.userData.arms[0].grip.add(ph); ph.rotation.set(-1.2, 0, 0);
    const lamp = new THREE.PointLight(0x9fc4ff, .45, 7, 1.6); lamp.position.set(.2, 1.3, -.5); c.scene.add(lamp);
    return t => { r.set(0, t); c.post.exposure = 1.3; c.post.bloom = .5; c.post.threshold = .8; ph.userData.l.intensity = .25;
      h.userData.pose({ t, armL: [.5, .15, 1.2], pitch: lerp(.1, .4, eio(seg(t, .2, 1.6))), mood: -.6 });
      c.path(t, [[0, [1.0, 1.9, 5.2], [.1, 1.45, -2], 34], [c.dur, [.6, 1.8, 4.0], [.1, 1.5, -2], 34]], eo); }; } },

  { name: 'worst', caps: ['Só que o frio *ainda nem começou.*'], post: .8, build(c) {
    const sp = spaceBase(c, { dome: .5 }); const e = makeEarth(1); c.scene.add(e); c.post.bloom = .7; c.post.threshold = .6; c.post.exposure = 1.25;
    return t => { c.path(t, [[0, [.2, .3, 4.3], [0, -.3, 0], 35], [c.dur, [.6, .5, 6.4], [0, -.4, 0], 35]], eio); sp.set(t);
      e.userData.set({ rot: 5.05 + t * .02, sunDir: V(.5, .35, 1).normalize(), sun: 0, city: 2.4, rim: 2.2, amb: .03 }); }; } },

  { name: 'close', dur: 2.3, build(c) { return brandClose(c, { q: 'quanto tempo até o frio chegar?', label: 'Parte 2' }); } },
];
