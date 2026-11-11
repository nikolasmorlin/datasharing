# O dia em que o Sol sumiu — trilogia em 3D

Vídeos verticais (1080×1920, 30 fps) renderizados em 3D com Three.js, quadro a quadro, em Chromium headless.

- `out/` — vídeos finais e `roteiro.md` (legendas com tempos)
- `src/parts/part{1,2,3}.js` — cenas, câmeras e legendas de cada parte
- `src/lib/` — Sol, Terra, Lua, Júpiter, Helena, cenários e props
- `src/engine.js` — linha do tempo determinística, legendas e pós-processamento
- `tools/` — `still.mjs` (prévia em stills), `render.mjs` (render paralelo + ffmpeg), `bake_assets.py` (texturas)

```
npm install
python3 tools/bake_assets.py                # só se precisar regerar assets/
node tools/still.mjs 1 shots                # folha de contato da parte 1
node tools/render.mjs 1 --out out/parte1.mp4
```

Texturas da Terra: NASA Blue Marble / Black Marble (via pacote `three-globe`). Fontes: Anton, Oswald, Inter (OFL).
