// Shared scene builders used by the three parts.
import * as THREE from 'three';
import { W, H, clamp, lerp, seg, ss, eio, eo, eback, V } from '../engine.js';
import { makeStars, makeSkyDome, makeSun, makeEarth, makeGrid, makeGlow } from './space.js';

export const fmt = s => { s = Math.max(0, s); const m = Math.floor(s / 60), r = Math.floor(s % 60); return String(m).padStart(2, '0') + ':' + String(r).padStart(2, '0'); };

export function spaceBase(c, { dome = .4, count = 4500, size = 1 } = {}) {
  const stars = makeStars({ pr: c.renderer.getPixelRatio(), count, size }); const sky = makeSkyDome(dome);
  c.scene.add(stars, sky); c.scene.background = new THREE.Color(0x010206);
  return { stars, sky, set(t, op = 1) { stars.userData.set(t, op); } };
}

export function timerHud(c, sub = 'ATÉ O CÉU APAGAR') {
  const el = c.hud(`<div class="d">08:20</div><div class="s">${sub}</div>`, 'timer'); const d = el.querySelector('.d');
  return { el, set(sec, op = 1) { d.textContent = fmt(sec); el.style.opacity = op; } };
}

// Sun–Earth "diagram" in real 3D: spacetime grid with the Sun's gravity well, Earth on its orbit,
// and the last light / gravity front expanding at the speed of light. Not to scale.
export const AU = 7;
export function diagram(c, { sunR = .95 } = {}) {
  const sp = spaceBase(c, { dome: .3 });
  const grid = makeGrid({ size: 64, well: 2.4, a: 2.2 }); const sun = makeSun(sunR); sun.position.y = .15;
  const earth = makeEarth(.34, { seg: 64 });
  const orbit = new THREE.Mesh(new THREE.TorusGeometry(AU, .012, 6, 200), new THREE.MeshBasicMaterial({ color: 0xbfd4ff, transparent: true, opacity: .32 })); orbit.rotation.x = Math.PI / 2;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1, .012, 8, 160), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.7, .55, .2) })); ring.rotation.x = Math.PI / 2;
  const ghost = new THREE.Mesh(new THREE.TorusGeometry(sunR, .01, 6, 90), new THREE.MeshBasicMaterial({ color: 0xff7a4a, transparent: true, opacity: .55 }));
  const trail = new THREE.Mesh(new THREE.CylinderGeometry(.045, .045, 1, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, .65, .25) })); trail.visible = false;
  const link = new THREE.Mesh(new THREE.CylinderGeometry(.014, .014, 1, 6), new THREE.MeshBasicMaterial({ color: 0xf4efe6, transparent: true, opacity: .8 })); link.visible = false; c.scene.add(link);
  c.scene.add(grid, sun, earth, orbit, ring, ghost, trail);
  c.post.bloom = .42; c.post.threshold = .95; c.post.radius = .5;
  const ePos = new THREE.Vector3();
  return {
    grid, sun, earth, ring, ghost, orbit, trail, ePos,
    // o: { t, sun (0/1 power), front (radius of light front, <0 = none), ang (earth orbit angle), free: distance travelled on tangent after release, lit: override earth lit }
    set(o) {
      const t = o.t ?? 0, front = o.front ?? -1;
      sp.set(t);
      sun.visible = (o.sun ?? 1) > .001; sun.userData.set(t, o.sun ?? 1, c.cam);
      ghost.visible = !sun.visible; ghost.quaternion.copy(c.cam.quaternion); ghost.position.copy(sun.position); ghost.material.opacity = .35 + .2 * Math.sin(t * 3);
      grid.userData.u.uFront.value = front;
      ring.visible = false; ring.scale.setScalar(Math.max(front, .001)); ring.position.y = .02;
      const a = o.ang ?? 0; ePos.set(Math.cos(a) * AU, 0, Math.sin(a) * AU);
      if (o.free) { const tan = V(-Math.sin(a), 0, Math.cos(a)); ePos.addScaledVector(tan, o.free); trail.visible = true; trail.scale.set(1, o.free, 1); trail.position.set(Math.cos(a) * AU, .34, Math.sin(a) * AU).addScaledVector(tan, o.free / 2); trail.quaternion.setFromUnitVectors(V(0, 1, 0), tan); } else trail.visible = false;
      const r = ePos.length(); ePos.y = grid.userData.wellAt(r, front) + .22;
      earth.position.copy(ePos); grid.userData.u.uEarth.value.copy(ePos);
      const lit = o.lit ?? (front < 0 || front < r ? 1 : 0);
      earth.userData.set({ rot: 2 + t * .5, sunDir: ePos.clone().multiplyScalar(-1).setY(.15).normalize(), sun: lit, city: 2.2, cloud: t * .004, amb: lerp(.11, .02, lit), rim: 1.6 * (1 - lit) });
      orbit.material.opacity = o.orbit ?? .32;
      link.visible = (o.link ?? 0) > 0; if (link.visible) { const k = o.link, A = V(0, .9, 0), B = ePos.clone().setY(ePos.y + .0), d = B.clone().sub(A), len = d.length() * k; link.scale.set(1, len, 1); link.position.copy(A).addScaledVector(d.normalize(), len / 2); link.quaternion.setFromUnitVectors(V(0, 1, 0), d); }
    },
  };
}

// ---------- brand outro ("além da tela") ----------
export function brandOutro(c) {
  c.scene.background = new THREE.Color(0x12151f);
  const g = new THREE.Group();
  const shape = new THREE.Shape(); const w = 1.0, h = 1.62, r = .16;
  shape.moveTo(-w / 2 + r, -h / 2); shape.lineTo(w / 2 - r, -h / 2); shape.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r); shape.lineTo(w / 2, h / 2 - r); shape.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2);
  shape.lineTo(-w / 2 + r, h / 2); shape.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r); shape.lineTo(-w / 2, -h / 2 + r); shape.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
  const slab = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: .09, bevelEnabled: true, bevelSize: .015, bevelThickness: .015, bevelSegments: 3, curveSegments: 20 }), new THREE.MeshStandardMaterial({ color: 0xf4efe6, roughness: .7, envMap: c.env, envMapIntensity: .25 }));
  slab.castShadow = true; g.add(slab);
  const half = (col, flip, basic) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(.36, .36, .03, 64, 1, false, flip ? 0 : Math.PI, Math.PI), basic ? new THREE.MeshBasicMaterial({ color: col }) : new THREE.MeshStandardMaterial({ color: col, roughness: .6 })); m.rotation.x = Math.PI / 2; return m; };
  const sunG = new THREE.Group(); const dark = half(0x12151f, false), bright = half(new THREE.Color(1.45, .34, .16), true, true); sunG.add(dark, bright); sunG.position.set(w / 2, .16, .125); g.add(sunG);
  const glow = makeGlow(2.6, 0xff5a36); glow.position.set(w / 2 + .2, .16, -.2); glow.material.opacity = .0; g.add(glow);
  g.position.y = .55; c.scene.add(g);
  const key = new THREE.DirectionalLight(0xffffff, .95); key.position.set(-2, 3, 5); c.scene.add(key, new THREE.AmbientLight(0x8890a8, .3));
  const word = c.hud('além da tela', '', 'position:absolute;left:0;right:0;top:590px;text-align:center;font:600 41px/1 Inter;letter-spacing:-.02em;color:#f4efe6');
  const line = c.hud('', '', 'position:absolute;left:50%;top:652px;height:1.5px;background:rgba(244,239,230,.7);transform:translateX(-50%)');
  c.post.bloom = .3; c.post.threshold = 1.05; c.post.vig = .6; c.brand = 0;
  return (t) => {
    const k = eback(seg(t, .1, .7)); g.scale.setScalar(lerp(.6, 1, k)); slab.material.opacity = 1; g.rotation.y = lerp(-.9, 0, eo(seg(t, .1, 1.0))) + Math.sin(t * .8) * .04;
    const s = eo(seg(t, .55, 1.25)); sunG.position.x = lerp(.1, w / 2, s); sunG.scale.setScalar(lerp(.2, 1, s)); bright.visible = dark.visible = s > .01;
    glow.material.opacity = .16 * s;
    word.style.opacity = seg(t, .9, 1.4); word.style.transform = `translateY(${lerp(14, 0, eo(seg(t, .9, 1.5)))}px)`;
    line.style.width = lerp(0, 46, eo(seg(t, 1.3, 1.9))) + 'px';
    c.look([0, .5, 7.2], [0, .2, 0], 30); c.fade = 1 - seg(t, 0, .25);
  };
}

// ---------- end card (PARTE N + question) ----------
export function endCard(c, { part, q, cta = 'SIGA PARA NÃO PERDER' }) {
  const title = c.hud(`<small>PARTE</small>${part}`, 'title', 'top:270px'); const sub = c.hud(q, 'sub', 'top:505px;padding:0 40px;font-size:34px');
  const foot = c.hud(cta, 'lbl', 'left:50%;top:630px;opacity:.7');
  return (t) => {
    const a = eback(seg(t, .15, .55)); title.style.opacity = seg(t, .15, .4); title.style.transform = `scale(${lerp(.7, 1, a)})`;
    sub.style.opacity = seg(t, .7, 1.0); sub.style.transform = `translateY(${lerp(16, 0, eo(seg(t, .7, 1.2)))}px)`;
    foot.style.opacity = .7 * seg(t, 1.4, 1.8);
  };
}
