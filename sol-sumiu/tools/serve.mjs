// Minimal static file server for the render pages (no deps).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = { '.html':'text/html; charset=utf-8', '.js':'text/javascript', '.mjs':'text/javascript', '.css':'text/css', '.json':'application/json',
  '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.woff2':'font/woff2', '.woff':'font/woff', '.svg':'image/svg+xml', '.glsl':'text/plain' };
export function startServer(port = 0) {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      let p = decodeURIComponent(req.url.split('?')[0]);
      if (p === '/') p = '/src/index.html';
      const fp = path.join(ROOT, p);
      if (!fp.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
      fs.readFile(fp, (err, data) => {
        if (err) { res.writeHead(404); return res.end('not found: ' + p); }
        res.writeHead(200, { 'Content-Type': TYPES[path.extname(fp).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' });
        res.end(data);
      });
    });
    srv.listen(port, '127.0.0.1', () => resolve({ srv, port: srv.address().port }));
  });
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { port } = await startServer(Number(process.argv[2] || 8123));
  console.log('http://127.0.0.1:' + port);
}
