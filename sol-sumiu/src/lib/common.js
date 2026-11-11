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
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1, .012, 8, 160), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 1.2, .55) })); ring.rotation.x = Math.PI / 2;
  const ghost = new THREE.Mesh(new THREE.TorusGeometry(sunR, .01, 6, 90), new THREE.MeshBasicMaterial({ color: 0xf4f0e8, transparent: true, opacity: .55 }));
  const trail = new THREE.Mesh(new THREE.CylinderGeometry(.045, .045, 1, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 1.2, .55) })); trail.visible = false;
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

// ---------- brand (manual: symbol = screen w:h 1:1.7705, corner r .35w; circle r .4675w centred on the right edge) ----------
export const LOGO = { w: 1, h: 1.7705, rc: .35, r: .4675 };
// Flat SVG symbol. variant 'reversa' (on navy: creme screen, navy opening) or 'principal' (on creme: navy screen, creme opening).
// anim: { screen 0..1, hole 0..1, slide 0..1 } drives the opening animation without stretching, rotating or recolouring the mark.
export function logoSVG(px, variant = 'reversa', anim = { screen: 1, hole: 1, slide: 1 }) {
  const { w, h, rc, r } = LOGO, sc = px / h;  // px = screen height in CSS px
  const screenCol = variant === 'reversa' ? '#F4F0E8' : '#14171F', holeCol = variant === 'reversa' ? '#14171F' : '#F4F0E8';
  const W = (w + r) * sc, Hh = h * sc, cx = w * sc, cy = h / 2 * sc, R = r * sc * anim.hole;
  const k = anim.screen, sx = w * sc, sy = h * sc;
  const off = (1 - anim.slide) * -R;                    // coral half starts inside the opening and slides out
  return `<svg width="${W.toFixed(1)}" height="${Hh.toFixed(1)}" viewBox="0 0 ${W.toFixed(2)} ${Hh.toFixed(2)}">
    <defs><clipPath id="scr${px | 0}"><rect width="${sx}" height="${sy}" rx="${rc * sc}" ry="${rc * sc}"/></clipPath></defs>
    <g transform="translate(${sx / 2} ${sy / 2}) scale(${k}) translate(${-sx / 2} ${-sy / 2})" opacity="${Math.min(1, k * 1.4)}">
      <rect width="${sx}" height="${sy}" rx="${rc * sc}" ry="${rc * sc}" fill="${screenCol}"/>
      ${R > .1 ? `<path d="M ${cx} ${cy - R} A ${R} ${R} 0 0 0 ${cx} ${cy + R} Z" fill="${holeCol}"/>
      <path transform="translate(${off} 0)" d="M ${cx} ${cy - R} A ${R} ${R} 0 0 1 ${cx} ${cy + R} Z" fill="#FF5B3A"/>` : ''}
    </g></svg>`;
}

// Abertura (manual 09): symbol in the first second: the screen appears, the opening forms, the coral half slides out.
export function brandOpen(c) {
  c.scene.background = new THREE.Color(0x14171f); c.post.bloom = 0; c.brand = 0;
  const el = c.hud('', 'mark', 'left:270px;top:470px');
  return t => {
    const a = { screen: eback(seg(t, 0, .28)), hole: eo(seg(t, .2, .45)), slide: eio(seg(t, .4, .78)) };
    el.innerHTML = logoSVG(150, 'reversa', a);
    c.look([0, 0, 5], [0, 0, 0], 35); c.fadeColor = '#14171F'; c.fade = seg(t, .82, 1.0) * 0;  // next shot fades in from navy
  };
}

// Encerramento (manual 09, ~2 s): symbol, name and one open question. No long text.
export function brandClose(c, { q, label = '' }) {
  c.scene.background = new THREE.Color(0x14171f); c.post.bloom = 0; c.brand = 0;
  const mark = c.hud(logoSVG(116, 'reversa'), 'mark', 'left:270px;top:350px');
  const lab = label ? c.hud(label, 'lbl', 'left:50%;top:458px;font-size:11px') : null;
  const qq = c.hud(q, 'question', 'top:478px');
  const wm = c.hud('além da tela', 'wordmark', 'top:640px');
  return t => {
    const k = eo(seg(t, 0, .35)); mark.style.opacity = k; mark.style.transform = `translate(-50%,-50%) translateY(${lerp(10, 0, k)}px)`;
    if (lab) lab.style.opacity = seg(t, .15, .4);
    const k2 = eo(seg(t, .12, .45)); qq.style.opacity = k2; qq.style.transform = `translateY(${lerp(12, 0, k2)}px)`;
    const k3 = eo(seg(t, .3, .6)); wm.style.opacity = k3;
    c.look([0, 0, 5], [0, 0, 0], 35); c.fade = 1 - seg(t, 0, .18);
  };
}
