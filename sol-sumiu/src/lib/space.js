// Space assets: stars, Sun, Earth (day/night/frozen), Moon, Jupiter, spacetime grid.
import * as THREE from 'three';
import { TEX, rng } from '../engine.js';
export const BRAND = { navy: 0x14171f, creme: 0xf4f0e8, coral: 0xff5b3a, gold: 0xffc861, sky: 0x8fb3e8 };

export const NOISE = /* glsl */`
vec3 mod289(vec3 x){return x-floor(x*(1./289.))*289.;} vec4 mod289(vec4 x){return x-floor(x*(1./289.))*289.;}
vec4 permute(vec4 x){return mod289(((x*34.)+1.)*x);} vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){ const vec2 C=vec2(1./6.,1./3.); const vec4 D=vec4(0.,.5,1.,2.);
  vec3 i=floor(v+dot(v,C.yyy)); vec3 x0=v-i+dot(i,C.xxx); vec3 g=step(x0.yzx,x0.xyz); vec3 l=1.-g; vec3 i1=min(g.xyz,l.zxy); vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx; vec3 x2=x0-i2+C.yyy; vec3 x3=x0-D.yyy; i=mod289(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.,i1.z,i2.z,1.))+i.y+vec4(0.,i1.y,i2.y,1.))+i.x+vec4(0.,i1.x,i2.x,1.));
  float n_=.142857142857; vec3 ns=n_*D.wyz-D.xzx; vec4 j=p-49.*floor(p*ns.z*ns.z); vec4 x_=floor(j*ns.z); vec4 y_=floor(j-7.*x_);
  vec4 x=x_*ns.x+ns.yyyy; vec4 y=y_*ns.x+ns.yyyy; vec4 h=1.-abs(x)-abs(y); vec4 b0=vec4(x.xy,y.xy); vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.+1.; vec4 s1=floor(b1)*2.+1.; vec4 sh=-step(h,vec4(0.)); vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy; vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x); vec3 p1=vec3(a0.zw,h.y); vec3 p2=vec3(a1.xy,h.z); vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3))); p0*=norm.x; p1*=norm.y; p2*=norm.z; p3*=norm.w;
  vec4 m=max(.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.); m=m*m;
  return 42.*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3))); }
float fbm(vec3 p){ float a=.5, s=0.; for(int i=0;i<5;i++){ s+=a*snoise(p); p=p*2.03+vec3(17.1,3.7,9.2); a*=.5; } return s; }
`;

// ---------- stars ----------
export function makeStars({ count = 4500, radius = 1500, seed = 5, size = 1, pr = 2 } = {}) {
  const r = rng(seed), pos = new Float32Array(count * 3), col = new Float32Array(count * 3), sz = new Float32Array(count), ph = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const z = r() * 2 - 1, a = r() * Math.PI * 2, s = Math.sqrt(1 - z * z);
    pos.set([s * Math.cos(a) * radius, z * radius, s * Math.sin(a) * radius], i * 3);
    const m = Math.pow(r(), 7); sz[i] = (.9 + m * 3.6 + r() * .5) * size; ph[i] = r() * 6.283;
    const c = [.96, .94, .91]; const b = .55 + m * 2.2 + r() * .35;
    col.set([c[0] * b, c[1] * b, c[2] * b], i * 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aCol', new THREE.BufferAttribute(col, 3));
  g.setAttribute('aSize', new THREE.BufferAttribute(sz, 1)); g.setAttribute('aPh', new THREE.BufferAttribute(ph, 1));
  const m = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uOp: { value: 1 }, uPR: { value: pr } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `attribute vec3 aCol; attribute float aSize, aPh; uniform float uTime, uPR; varying vec3 vC;
      void main(){ vC = aCol * (.82 + .18 * sin(uTime * (1.2 + fract(aPh) * 2.) + aPh)); vec4 mv = modelViewMatrix * vec4(position, 1.); gl_Position = projectionMatrix * mv; gl_PointSize = aSize * uPR; }`,
    fragmentShader: `uniform float uOp; varying vec3 vC; void main(){ float d = length(gl_PointCoord - .5) * 2.; float a = smoothstep(1., .55, d); gl_FragColor = vec4(vC * a * uOp, 1.); }`,
  });
  const p = new THREE.Points(g, m); p.frustumCulled = false; p.renderOrder = -10;
  p.userData.set = (t, op = 1) => { m.uniforms.uTime.value = t; m.uniforms.uOp.value = op; };
  return p;
}
export function makeSkyDome() {   // (brand: no photographic sky) kept as a no-op for API compatibility
  const m = new THREE.Object3D(); m.userData.set = () => {}; return m;
}

// ---------- Sun ----------
export function makeSun(R = 1) {
  const g = new THREE.Group();
  const u = { uTime: { value: 0 }, uPower: { value: 1 } };
  const body = new THREE.Mesh(new THREE.SphereGeometry(R, 96, 64), new THREE.ShaderMaterial({
    uniforms: u,
    vertexShader: `varying vec3 vN, vV, vP; void main(){ vP = position; vec4 w = modelMatrix * vec4(position, 1.); vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - w.xyz); gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: NOISE + `uniform float uTime, uPower; varying vec3 vN, vV, vP;
      void main(){ float mu = max(dot(normalize(vN), normalize(vV)), 0.);
        float blob = smoothstep(.15, .35, snoise(normalize(vP) * 2.4 + vec3(0., uTime * .05, 0.)));
        vec3 col = mix(vec3(1., .74, .32), vec3(1., .93, .70), smoothstep(.15, .8, mu));
        col = mix(col, vec3(1., .97, .86), smoothstep(.75, .95, mu) * .7);
        col = mix(col, col * .975, blob * smoothstep(.2, .6, mu));
        gl_FragColor = vec4(col * uPower * .56, 1.); }`,
  }));
  g.add(body);
  const corona = new THREE.Mesh(new THREE.PlaneGeometry(R * 7, R * 7), new THREE.ShaderMaterial({
    uniforms: u, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
    fragmentShader: `uniform float uTime, uPower; varying vec2 vUv;
      void main(){ float r = length(vUv - .5) * 7.; if (r < .99) discard;
        float soft = exp(-(r - 1.) * 2.2) * .55;
        float ring1 = smoothstep(.06, 0., abs(r - (1.35 + .04 * sin(uTime * 1.1)))) * .16, ring2 = smoothstep(.05, 0., abs(r - (1.8 + .05 * sin(uTime * .8 + 1.)))) * .08;
        gl_FragColor = vec4(vec3(1., .78, .40) * (soft + ring1 + ring2) * smoothstep(3.4, 2.2, r) * uPower * .5, 1.); }`,
  }));
  corona.renderOrder = 5; g.add(corona);
  g.userData = { body, corona, u, set(t, power, cam) { u.uTime.value = t; u.uPower.value = power; if (cam) corona.quaternion.copy(cam.quaternion); body.rotation.y = t * .02; } };
  return g;
}

// ---------- Earth ----------
export function makeEarth(R = 1, { seg = 96 } = {}) {
  const g = new THREE.Group();
  const u = {
    tDay: { value: TEX.day }, tNight: { value: TEX.lights }, tIce: { value: TEX.ice || TEX.day }, tWater: { value: TEX.water }, tClouds: { value: TEX.clouds },
    uSunDir: { value: new THREE.Vector3(1, 0, 0) }, uSun: { value: 1 }, uIce: { value: 0 }, uCity: { value: 1 }, uAmb: { value: .02 }, uCloud: { value: 0 }, uAtm: { value: 1 }, uClouds: { value: 1 }, uRim: { value: 0 },
  };
  const vs = `varying vec2 vUv; varying vec3 vN, vW; void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position, 1.); vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * viewMatrix * w; }`;
  const body = new THREE.Mesh(new THREE.SphereGeometry(R, seg, seg * .66 | 0), new THREE.ShaderMaterial({
    uniforms: u, vertexShader: vs,
    fragmentShader: `uniform sampler2D tDay, tNight, tIce, tWater, tClouds; uniform vec3 uSunDir; uniform float uSun, uIce, uCity, uAmb, uCloud, uAtm, uClouds, uRim; varying vec2 vUv; varying vec3 vN, vW;
      void main(){ vec3 N = normalize(vN), Vd = normalize(cameraPosition - vW), L = normalize(uSunDir);
        float ndl = dot(N, L);
        float day = (smoothstep(-.06, .02, ndl) * .62 + smoothstep(.22, .30, ndl) * .23 + smoothstep(.55, .63, ndl) * .15) * uSun;
        vec3 base = mix(texture2D(tDay, vUv).rgb, texture2D(tIce, vUv).rgb, uIce);
        float cl = texture2D(tClouds, vec2(vUv.x + uCloud, vUv.y)).r * uClouds;
        vec3 lit = base * (day * .62 + uAmb);
        lit = mix(lit, vec3(.957, .941, .91) * (day * .6 + uAmb * 1.4), cl);
        float nm = 1. - smoothstep(-.1, .05, ndl) * uSun;
        float dots = texture2D(tNight, vUv).r;
        lit += vec3(1., .80, .42) * dots * .55 * uCity * nm * (1. - cl * .7);
        float fr = smoothstep(.55, 1., 1. - max(dot(N, Vd), 0.));
        lit += vec3(.34, .55, .9) * fr * (.06 + .7 * day) * uAtm + vec3(.30, .42, .66) * fr * uRim * .55;
        gl_FragColor = vec4(lit, 1.); }`,
  }));
  const atm = new THREE.Mesh(new THREE.SphereGeometry(R * 1.13, 64, 48), new THREE.ShaderMaterial({
    uniforms: u, vertexShader: vs, side: THREE.BackSide, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    fragmentShader: `uniform vec3 uSunDir; uniform float uSun, uAtm; varying vec3 vN, vW;
      void main(){ vec3 N = normalize(vN), Vd = normalize(cameraPosition - vW);
        float k = smoothstep(0., .466, abs(dot(N, Vd))); k = pow(k, 3.2) * .7;
        float day = smoothstep(-.35, .5, dot(N, normalize(uSunDir))) * uSun;
        gl_FragColor = vec4(vec3(.25, .52, 1.) * k * (.03 + 1.25 * day) * uAtm, 1.); }`,
  }));
  const spin = new THREE.Group(); spin.add(body); g.add(spin); g.add(atm);
  spin.rotation.z = -23.4 * Math.PI / 180;
  g.userData = { u, body, spin, atm, set(o) { for (const k in o) { if (k === 'rot') body.rotation.y = o.rot; else if (k === 'sunDir') u.uSunDir.value.copy(o.sunDir); else if (u['u' + k[0].toUpperCase() + k.slice(1)]) u['u' + k[0].toUpperCase() + k.slice(1)].value = o[k]; } } };
  return g;
}

// ---------- Moon ----------
export function makeMoon(R = 1) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(R, 96, 64), new THREE.MeshStandardMaterial({ map: TEX.moon, bumpMap: TEX.moonBump, bumpScale: .8 }));
  return m;
}

// ---------- Jupiter ----------
export function makeJupiter(R = 1) {
  const u = { uSunDir: { value: new THREE.Vector3(1, .2, .5) }, uSun: { value: 1 }, uAmb: { value: .012 }, uTime: { value: 0 } };
  const m = new THREE.Mesh(new THREE.SphereGeometry(R, 128, 96), new THREE.ShaderMaterial({
    uniforms: u,
    vertexShader: `varying vec3 vP, vN, vW; void main(){ vP = position; vec4 w = modelMatrix * vec4(position, 1.); vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: NOISE + `uniform vec3 uSunDir; uniform float uSun, uAmb, uTime; varying vec3 vP, vN, vW;
      void main(){ vec3 p = normalize(vP); float lat = asin(p.y); float lon = atan(p.z, p.x);
        float warp = snoise(vec3(p.x * 2., p.y * 5., p.z * 2.) + vec3(uTime * .01, 0., 0.));
        float v = lat * 3.4 + warp * .07;
        float band = floor(v * 2.2 + 8.);
        float k = fract(sin(band * 12.9898) * 43758.5453);
        vec3 col = k < .33 ? vec3(.93, .87, .76) : k < .66 ? vec3(.80, .66, .50) : vec3(.62, .46, .34);
        col = mix(col, vec3(.70, .70, .74), smoothstep(1.05, 1.35, abs(lat)));
        vec2 sp = vec2(lon - 1.9, lat + .36); float sd = length(sp * vec2(1., 1.9));
        col = mix(col, vec3(.55, .33, .27), step(sd, .16)); col = mix(col, vec3(.93, .87, .76), step(abs(sd - .19), .018));
        vec3 N = normalize(vN), Vd = normalize(cameraPosition - vW); float ndl = dot(N, normalize(uSunDir));
        float lit = (smoothstep(-.04, .04, ndl) * .7 + smoothstep(.35, .43, ndl) * .3) * uSun * .58 + uAmb;
        col *= lit;
        gl_FragColor = vec4(col, 1.); }`,
  }));
  m.rotation.z = -3 * Math.PI / 180;
  m.userData = { u, set(t, sun) { u.uTime.value = t; u.uSun.value = sun; m.rotation.y = t * .06; } };
  return m;
}

// ---------- spacetime grid (gravity well that "unwinds" at the speed of light) ----------
export function makeGrid({ size = 60, seg = 220, well = 2.2, a = 2.4, color = 0x7fa6dd, front = 0xffc861 } = {}) {
  const geo = new THREE.PlaneGeometry(size, size, seg, seg); geo.rotateX(-Math.PI / 2);
  const u = { uWell: { value: well }, uA: { value: a }, uFront: { value: -1 }, uCol: { value: new THREE.Color(color) }, uFrontCol: { value: new THREE.Color(front) }, uOp: { value: 1 }, uCell: { value: 1 }, uSize: { value: size }, uEarth: { value: new THREE.Vector3(999, 0, 0) }, uEarthWell: { value: .25 } };
  const m = new THREE.Mesh(geo, new THREE.ShaderMaterial({
    uniforms: u, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    vertexShader: `uniform float uWell, uA, uFront, uEarthWell; uniform vec3 uEarth; varying vec2 vXZ; varying float vR, vK;
      float wellf(float r){ return 1. / (1. + (r * r) / (uA * uA)); }
      void main(){ vec3 p = position; float r = length(p.xz); vR = r;
        float k = uFront < 0. ? 1. : smoothstep(uFront - 1.3, uFront + 1.3, r);   // inside the front: news arrived, space is flat
        float ripple = uFront < 0. ? 0. : exp(-pow((r - uFront) / .9, 2.)) * .28;
        p.y -= uWell * wellf(r) * k - ripple;
        float re = length(p.xz - uEarth.xz); p.y -= uEarthWell * exp(-re * re * 1.8);
        vK = k; vXZ = position.xz; gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.); }`,
    fragmentShader: `uniform vec3 uCol, uFrontCol; uniform float uFront, uOp, uCell, uSize; varying vec2 vXZ; varying float vR, vK;
      float gridl(vec2 p, float w){ vec2 g = abs(fract(p - .5) - .5) / fwidth(p); return 1. - min(min(g.x, g.y) / w, 1.); }
      void main(){ float l = gridl(vXZ / uCell, 1.25) * .9 + gridl(vXZ / (uCell * .25), 1.) * .12;
        float edge = smoothstep(uSize * .5, uSize * .2, vR);
        float fr = uFront < 0. ? 0. : exp(-pow((vR - uFront) / .5, 2.));
        vec3 col = mix(uCol * .55, uCol, vK) * l + uFrontCol * fr * (l * 1.5 + .05);
        gl_FragColor = vec4(col * edge * uOp, 1.); }`,
  }));
  m.renderOrder = -2;
  m.userData = { u, wellAt(r, frontR) { let k = frontR < 0 ? 1 : Math.min(1, Math.max(0, (r - (frontR - 1.3)) / 2.6)); k = k * k * (3 - 2 * k); return -u.uWell.value / (1 + r * r / (u.uA.value * u.uA.value)) * k; } };
  return m;
}

// soft additive glow sprite (billboard)
export function makeGlow(size = 1, color = 0xffc861, power = 2.) {
  const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  m.scale.setScalar(size); m.userData.power = power; return m;
}
let _glow; function glowTex() {
  if (_glow) return _glow; const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d');
  const g = x.createRadialGradient(128, 128, 0, 128, 128, 128); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.2, 'rgba(255,255,255,.55)'); g.addColorStop(.5, 'rgba(255,255,255,.14)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 256, 256); _glow = new THREE.CanvasTexture(c); return _glow;
}
