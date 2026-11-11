// Helena: stylised 3D character built from primitives, with a tiny pose rig.
import * as THREE from 'three';
import { clamp, lerp, ss } from '../engine.js';

const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: .7, metalness: 0, envMapIntensity: .35, ...o });
const mesh = (g, m) => { const x = new THREE.Mesh(g, m); x.castShadow = true; x.receiveShadow = true; return x; };

export function makeHelena({ outfit = 'vest', env = null } = {}) {
  const SKIN = mat(0x8f5b3c, { roughness: .62 }), HAIR = mat(0x17110f, { roughness: .5 }), ORANGE = mat(0xe3b341, { roughness: .8 }), NAVY = mat(0x2a3352, { roughness: .85 }),
    DARK = mat(0x1b2030, { roughness: .85 }), WHITE = mat(0xf2ede4, { roughness: .6 }), EYE = mat(0x0c0a0a, { roughness: .25, envMapIntensity: .5 }), LIP = mat(0x5a2a22, { roughness: .6 });
  const parka = outfit === 'parka';
  const sleeve = parka ? ORANGE : NAVY;
  for (const m of [SKIN, HAIR, ORANGE, NAVY, DARK, WHITE, EYE, LIP]) m.envMap = env;
  const root = new THREE.Group();
  const body = new THREE.Group(); root.add(body);            // everything above the feet (for lean / bob)
  // legs
  const legs = [];
  for (const sx of [-1, 1]) {
    const hip = new THREE.Group(); hip.position.set(sx * .085, .74, 0); body.add(hip);
    const leg = mesh(new THREE.CapsuleGeometry(parka ? .075 : .066, .56, 6, 14), DARK); leg.position.y = -.33; hip.add(leg);
    const shoe = mesh(new THREE.SphereGeometry(.1, 20, 14), parka ? DARK : WHITE); shoe.scale.set(.82, .5, 1.45); shoe.position.set(0, -.69, .05); hip.add(shoe);
    legs.push(hip);
  }
  // torso
  const torso = new THREE.Group(); torso.position.y = .74; body.add(torso);
  const chest = mesh(new THREE.CapsuleGeometry(parka ? .215 : .185, .36, 8, 24), ORANGE); chest.scale.set(1, 1, .78); chest.position.y = .33; torso.add(chest);
  if (!parka) {
    const shirt = mesh(new THREE.CapsuleGeometry(.178, .36, 8, 24), NAVY); shirt.scale.set(.5, 1.02, .8); shirt.position.set(0, .33, .012); torso.add(shirt);   // open vest front
    for (const y of [.2, .31]) { const band = mesh(new THREE.TorusGeometry(.187, .012, 8, 40), WHITE); band.rotation.x = Math.PI / 2; band.scale.set(1, .79, 1); band.position.y = y; torso.add(band); }
  } else {
    const zip = mesh(new THREE.BoxGeometry(.014, .5, .01), DARK); zip.position.set(0, .34, .17); torso.add(zip);
    const hem = mesh(new THREE.TorusGeometry(.2, .035, 10, 36), ORANGE); hem.rotation.x = Math.PI / 2; hem.scale.set(1, .8, 1); hem.position.y = .06; torso.add(hem);
  }
  const neck = mesh(new THREE.CylinderGeometry(.052, .06, .1, 16), parka ? ORANGE : SKIN); neck.position.y = .66; torso.add(neck);
  // head
  const head = new THREE.Group(); head.position.y = .73; head.scale.setScalar(1.08); torso.add(head);
  const skull = mesh(new THREE.SphereGeometry(.2, 40, 30), SKIN); skull.scale.set(1, 1.06, .98); skull.position.y = .17; head.add(skull);
  const hair = mesh(new THREE.SphereGeometry(.212, 40, 24, 0, Math.PI * 2, 0, Math.PI * .55), HAIR); hair.position.y = .178; hair.rotation.x = -.42; hair.scale.set(1.01, 1.04, 1.02); head.add(hair);
  const bun = mesh(new THREE.SphereGeometry(.088, 24, 18), HAIR); bun.position.set(0, .4, -.07); head.add(bun);
  for (const sx of [-1, 1]) { const ear = mesh(new THREE.SphereGeometry(.036, 14, 10), SKIN); ear.scale.set(.5, 1, .8); ear.position.set(sx * .198, .15, -.01); head.add(ear); }
  const nose = mesh(new THREE.SphereGeometry(.024, 14, 10), SKIN); nose.position.set(0, .135, .196); head.add(nose);
  const eyes = [], brows = [];
  for (const sx of [-1, 1]) {
    const e = new THREE.Group(); e.position.set(sx * .074, .185, .178); head.add(e);
    const ball = mesh(new THREE.SphereGeometry(.027, 18, 14), EYE); ball.scale.set(1, 1.28, .55); e.add(ball);
    const hl = new THREE.Mesh(new THREE.SphereGeometry(.0045, 8, 8), new THREE.MeshBasicMaterial({ color: 0xdddddd })); hl.position.set(.008, .013, .0135); e.add(hl);
    eyes.push(e);
    const br = mesh(new THREE.CapsuleGeometry(.0085, .05, 4, 8), HAIR); br.rotation.z = Math.PI / 2; const bg = new THREE.Group(); bg.position.set(sx * .076, .252, .184); bg.add(br); head.add(bg); brows.push(bg);
  }
  const smile = mesh(new THREE.TorusGeometry(.042, .0085, 8, 20, Math.PI), LIP); smile.rotation.z = Math.PI; smile.position.set(0, .1, .188); smile.rotation.x = -.1; head.add(smile);
  const mouthO = mesh(new THREE.SphereGeometry(.024, 14, 10), LIP); mouthO.scale.set(1, 1.2, .4); mouthO.position.set(0, .078, .192); head.add(mouthO); mouthO.visible = false;
  if (parka) {
    const hood = mesh(new THREE.SphereGeometry(.262, 36, 24, 0, Math.PI * 2, 0, Math.PI * .78), ORANGE); hood.position.set(0, .165, -.035); hood.rotation.x = -1.02; head.add(hood);
    const fur = mesh(new THREE.TorusGeometry(.212, .05, 12, 40), mat(0xe9e2d2, { roughness: 1 })); fur.position.set(0, .178, .06); fur.scale.set(1, 1.08, 1); fur.rotation.x = -.12; head.add(fur);
    hair.visible = false; bun.visible = false;
    const scarf = mesh(new THREE.TorusGeometry(.11, .05, 10, 30), DARK); scarf.rotation.x = Math.PI / 2; scarf.position.y = .69; torso.add(scarf);
  }
  // arms
  const arms = [];
  for (const sx of [-1, 1]) {
    const sh = new THREE.Group(); sh.position.set(sx * (parka ? .225 : .2), .5, 0); torso.add(sh);
    const up = mesh(new THREE.CapsuleGeometry(parka ? .062 : .05, .2, 6, 12), sleeve); up.position.y = -.13; sh.add(up);
    const el = new THREE.Group(); el.position.y = -.27; sh.add(el);
    const fo = mesh(new THREE.CapsuleGeometry(parka ? .056 : .045, .19, 6, 12), sleeve); fo.position.y = -.12; el.add(fo);
    const hand = mesh(new THREE.SphereGeometry(.052, 16, 12), parka ? DARK : SKIN); hand.position.y = -.27; el.add(hand);
    const grip = new THREE.Group(); grip.position.y = -.3; el.add(grip);
    arms.push({ sh, el, hand, grip, sx });
  }
  const blinkAt = t => { const k = t % 3.4, k2 = (t + 1.3) % 5.3; return Math.max(1 - ss(0, .07, Math.abs(k - 3.2)), 1 - ss(0, .07, Math.abs(k2 - 5.1))); };
  root.userData = {
    head, torso, body, arms, legs, eyes,
    // p: { t, yaw, pitch, tilt (head), armL/armR: [swing(x), out(z), elbow], lean, mood: 0 neutral..1 smile / -1 worried, mouth: 'smile'|'o'|'flat', blink, walk }
    pose(p = {}) {
      const t = p.t ?? 0;
      head.rotation.set(-(p.pitch ?? 0), p.yaw ?? 0, p.tilt ?? 0);
      torso.rotation.set(p.lean ?? 0, p.twist ?? 0, 0);
      const br = 1 + Math.sin(t * 1.7) * .012; torso.scale.set(1, br, 1);
      const bl = p.blink ?? blinkAt(t);
      for (const e of eyes) e.scale.y = lerp(1, .08, clamp(bl));
      const mood = p.mood ?? .4;
      brows.forEach((b, i) => { const s = i ? 1 : -1; b.rotation.z = s * (mood < 0 ? -mood * .38 : -mood * .06); b.position.y = .252 + (p.browUp ?? 0) * .02 + (mood < 0 ? .006 : 0); });
      const m = p.mouth ?? (mood > .15 ? 'smile' : mood < -.3 ? 'o' : 'flat');
      smile.visible = m !== 'o'; mouthO.visible = m === 'o';
      smile.scale.set(1, m === 'flat' ? .12 : lerp(.45, 1, clamp(mood)), 1);
      const A = [p.armL ?? [0, .1, .12], p.armR ?? [0, .1, .12]];
      arms.forEach((a, i) => { a.sh.rotation.set(-A[i][0], 0, a.sx * A[i][1]); a.el.rotation.set(-A[i][2], 0, 0); });
      const w = p.walk ?? 0, ph = (p.walkPhase ?? t * 6.2);
      legs.forEach((l, i) => { l.rotation.x = Math.sin(ph + i * Math.PI) * .55 * w; });
      body.position.y = Math.abs(Math.sin(ph)) * .025 * w;
      if (w) arms.forEach((a, i) => { a.sh.rotation.x += Math.sin(ph + (i ? 0 : Math.PI)) * .45 * w; });
    },
  };
  root.userData.pose({});
  return root;
}
