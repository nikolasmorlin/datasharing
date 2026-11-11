"""Bake procedural/derived textures into assets/ (run once: python3 tools/bake_assets.py)."""
import numpy as np
from PIL import Image, ImageFilter
import os, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'node_modules/three-globe/example')
OUT = os.path.join(ROOT, 'assets')
os.makedirs(OUT, exist_ok=True)

def hash3(ix, iy, iz, seed):
    n = (ix.astype(np.int64) * 374761393 + iy.astype(np.int64) * 668265263 + iz.astype(np.int64) * 2147483647 + seed * 144665) & 0x7fffffff
    n = (n ^ (n >> 13)) * 1274126177 & 0x7fffffff
    n = n ^ (n >> 16)
    return (n & 0xffff).astype(np.float32) / 65535.0

def vnoise3(x, y, z, seed=0):
    ix, iy, iz = np.floor(x), np.floor(y), np.floor(z)
    fx, fy, fz = x - ix, y - iy, z - iz
    ux, uy, uz = [f * f * f * (f * (f * 6 - 15) + 10) for f in (fx, fy, fz)]
    ix, iy, iz = ix.astype(np.int64), iy.astype(np.int64), iz.astype(np.int64)
    def h(dx, dy, dz): return hash3(ix + dx, iy + dy, iz + dz, seed)
    x00 = h(0,0,0) * (1-ux) + h(1,0,0) * ux; x10 = h(0,1,0) * (1-ux) + h(1,1,0) * ux
    x01 = h(0,0,1) * (1-ux) + h(1,0,1) * ux; x11 = h(0,1,1) * (1-ux) + h(1,1,1) * ux
    y0 = x00 * (1-uy) + x10 * uy; y1 = x01 * (1-uy) + x11 * uy
    return y0 * (1-uz) + y1 * uz

def fbm(x, y, z, octaves=6, seed=0, lac=2.0, gain=0.5, ridged=False):
    out = np.zeros_like(x, dtype=np.float32); amp = 1.0; tot = 0.0; f = 1.0
    for o in range(octaves):
        n = vnoise3(x * f, y * f, z * f, seed + o * 17)
        if ridged: n = 1.0 - np.abs(n * 2 - 1)
        out += n * amp; tot += amp; amp *= gain; f *= lac
    return out / tot

def sphere_grid(w, h):
    lon = (np.arange(w, dtype=np.float32) + .5) / w * 2 * np.pi - np.pi
    lat = np.pi / 2 - (np.arange(h, dtype=np.float32) + .5) / h * np.pi
    LON, LAT = np.meshgrid(lon, lat)
    return np.cos(LAT) * np.cos(LON), np.sin(LAT), np.cos(LAT) * np.sin(LON), LON, LAT

def save(arr, name, q=92):
    arr = np.clip(arr, 0, 255).astype(np.uint8)
    Image.fromarray(arr).save(os.path.join(OUT, name), quality=q)
    print('wrote', name, arr.shape)

def bake_clouds():
    im = Image.open(os.path.join(SRC, 'clouds/clouds.png')).convert('RGBA').resize((2048, 1024), Image.LANCZOS)
    a = np.asarray(im).astype(np.float32)
    alpha = a[..., 3] * (a[..., :3].mean(-1) / 255.0)
    print('clouds alpha range', alpha.min(), alpha.max(), 'rgb mean', a[..., :3].mean())
    save(alpha, 'clouds.jpg', 88)

def bake_moon(w=2048, h=1024, seed=7):
    rng = np.random.default_rng(seed)
    X, Y, Z, LON, LAT = sphere_grid(w, h)
    height = (fbm(X * 3, Y * 3, Z * 3, 6, 11) - .5) * .35
    maria = fbm(X * 1.3 + 5, Y * 1.3, Z * 1.3, 4, 23)
    mmask = np.clip((0.47 - maria) * 9, 0, 1)
    alb = 0.60 + (fbm(X * 6, Y * 6, Z * 6, 5, 31) - .5) * .34
    alb = alb * (1 - mmask * .55)
    height = height * (1 - mmask * .7) - mmask * .05
    n = 5200
    u = rng.random(n); rad = 0.0025 + 0.12 * (u ** 9.0)
    cz = rng.uniform(-1, 1, n); clon = rng.uniform(-np.pi, np.pi, n); clat = np.arcsin(cz)
    order = np.argsort(-rad)
    for i in order:
        r = rad[i]; la, lo = clat[i], clon[i]
        ext = r * 1.9
        j0 = int(max(0, np.floor((np.pi / 2 - la - ext) / np.pi * h))); j1 = int(min(h, np.ceil((np.pi / 2 - la + ext) / np.pi * h)))
        if j1 <= j0: continue
        cosl = max(0.05, np.cos(la) - 0.0)
        dl = min(np.pi, ext / max(0.02, min(np.cos(min(abs(la) + ext, 1.55)), cosl)))
        i0 = int(np.floor((lo - dl + np.pi) / (2 * np.pi) * w)); i1 = int(np.ceil((lo + dl + np.pi) / (2 * np.pi) * w))
        cols = np.arange(i0, i1) % w
        if len(cols) > w: cols = np.arange(w)
        sx, sy, sz = X[j0:j1][:, cols], Y[j0:j1][:, cols], Z[j0:j1][:, cols]
        cx, cy, cz_ = np.cos(la) * np.cos(lo), np.sin(la), np.cos(la) * np.sin(lo)
        d = np.arccos(np.clip(sx * cx + sy * cy + sz * cz_, -1, 1)) / r
        depth = min(0.5, 0.18 + r * 2.5)
        bowl = np.where(d < 1, -(1 - d * d) * depth, 0)
        rim = np.exp(-((d - 1.0) / 0.11) ** 2) * depth * .3
        fresh = rng.random() < .1
        height[j0:j1][:, cols] += (bowl + rim) * (0.6 + r * 6)
        da = np.where(d < .9, -0.035, 0) + np.exp(-((d - 1.0) / 0.12) ** 2) * (0.06 if fresh else 0.012)
        if fresh and r > 0.012: da += np.clip(2.6 - d, 0, 1) ** 2 * 0.035
        alb[j0:j1][:, cols] += da
    alb = np.clip(alb, 0.12, 1.0)
    rgb = np.stack([alb * 235, alb * 230, alb * 222], -1)
    save(rgb, 'moon.jpg')
    hh = height - height.min(); hh /= hh.max()
    save(hh * 255, 'moon_bump.jpg')

def bake_ice_earth(w=4096, h=2048):
    day = np.asarray(Image.open(os.path.join(SRC, 'img/earth-blue-marble.jpg')).convert('RGB').resize((w, h), Image.LANCZOS)).astype(np.float32)
    water = np.asarray(Image.open(os.path.join(SRC, 'img/earth-water.png')).convert('L').resize((w, h), Image.LANCZOS)).astype(np.float32) / 255
    topo = np.asarray(Image.open(os.path.join(SRC, 'img/earth-topology.png')).convert('L').resize((w, h), Image.LANCZOS)).astype(np.float32) / 255
    print('water at mid-atlantic', water[h // 2, int((150 / 360) * w)], 'sahara', water[int(h * (70 / 180)), int((200 / 360) * w)])
    X, Y, Z, LON, LAT = sphere_grid(w, h)
    gx = np.gradient(topo, axis=1); gy = np.gradient(topo, axis=0)
    shade = np.clip(0.5 - (gx * 0.7 + gy * 0.7) * 40, 0, 1)
    lum = day.mean(-1, keepdims=True)
    snow = np.array([232, 238, 246], np.float32)
    land = (day * .22 + lum * .25 + snow * .55) * (0.72 + 0.5 * shade[..., None])
    crack = fbm(X * 22, Y * 22, Z * 22, 5, 5, ridged=True)
    crack2 = fbm(X * 70, Y * 70, Z * 70, 3, 9, ridged=True)
    cl = np.clip((crack - 0.80) * 9, 0, 1) * .55 + np.clip((crack2 - 0.84) * 9, 0, 1) * .25
    patch = fbm(X * 6, Y * 6, Z * 6, 5, 3)
    ice = np.array([196, 220, 238], np.float32) * (0.80 + 0.32 * patch[..., None])
    ice = ice * (1 - cl[..., None]) + np.array([70, 120, 170], np.float32) * cl[..., None]
    wm = water[..., None] if water[h // 2, int((150 / 360) * w)] > .5 else 1 - water[..., None]
    out = land * (1 - wm) + ice * wm
    save(out, 'earth_ice.jpg', 90)
    save(wm[..., 0] * 255, 'earth_watermask.jpg', 85)

def bake_ground(w=1024, seed=3):
    # tileable-ish dry soil / sand albedo + bump
    y, x = np.mgrid[0:w, 0:w].astype(np.float32) / w
    ang = x * 2 * np.pi; ang2 = y * 2 * np.pi
    # torus mapping for seamless tiling (4D -> use two 3D lookups)
    a = fbm(np.cos(ang) * 2.5, np.sin(ang) * 2.5, np.cos(ang2) * 2.5 + 7, 6, seed)
    b = fbm(np.cos(ang2) * 4 + 3, np.sin(ang2) * 4, np.sin(ang) * 4 + np.cos(ang) * 2, 6, seed + 5)
    n = (a * .6 + b * .4)
    n = (n - n.min()) / (n.max() - n.min())
    c1 = np.array([170, 142, 104], np.float32); c2 = np.array([214, 190, 150], np.float32)
    rgb = c1 + (c2 - c1) * n[..., None]
    sp = (np.random.default_rng(seed).random((w, w)) > 0.985).astype(np.float32)
    sp = np.asarray(Image.fromarray((sp * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.2))).astype(np.float32) / 255
    rgb *= (1 - sp[..., None] * .35)
    save(rgb, 'ground.jpg', 88)
    save(n * 255, 'ground_bump.jpg', 85)

if __name__ == '__main__':
    which = sys.argv[1:] or ['clouds', 'moon', 'ice', 'ground']
    if 'clouds' in which: bake_clouds()
    if 'moon' in which: bake_moon()
    if 'ice' in which: bake_ice_earth()
    if 'ground' in which: bake_ground()
