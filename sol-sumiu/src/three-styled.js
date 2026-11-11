// "three" as seen by the film: identical, except MeshStandardMaterial renders as a soft toon
// material (flat illustrated shading, no photo-like reflections), per the brand manual:
// "visual estilizado, nunca ultrarrealista".
import * as T from '/node_modules/three/build/three.module.js';
export * from '/node_modules/three/build/three.module.js';
const steps = [0.30, 0.52, 0.74, 0.90, 1.0];
const data = new Uint8Array(steps.map(v => Math.round(v * 255)));
export const TOON_GRADIENT = new T.DataTexture(data, steps.length, 1, T.RedFormat);
TOON_GRADIENT.minFilter = TOON_GRADIENT.magFilter = T.NearestFilter; TOON_GRADIENT.generateMipmaps = false; TOON_GRADIENT.needsUpdate = true;
const DROP = ['roughness', 'metalness', 'envMap', 'envMapIntensity', 'roughnessMap', 'metalnessMap', 'clearcoat', 'ior'];
export class MeshStandardMaterial extends T.MeshToonMaterial {
  constructor(params = {}) {
    const p = { ...params }; const keep = {};
    for (const k of DROP) if (k in p) { keep[k] = p[k]; delete p[k]; }
    if (p.bumpScale) p.bumpScale = p.bumpScale * .5;
    super(p);
    this.gradientMap = TOON_GRADIENT;
    delete keep.envMap; Object.assign(this, { roughness: 1, metalness: 0, envMapIntensity: 0 }, keep);
    Object.defineProperty(this, 'envMap', { get: () => null, set: () => {}, configurable: true });   // reflections are photo-like: ignored
  }
}
