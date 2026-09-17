import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import worker, { checkForRelease } from './worker.js';
import { openLocalD1 } from './local-db.js';

const root = new URL('../public/', import.meta.url);
const dbPath = fileURLToPath(new URL('../.local/releases.sqlite', import.meta.url));
const db = openLocalD1(dbPath);
const env = { DB: db };
const files = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/app.js', ['app.js', 'text/javascript; charset=utf-8']],
  ['/style.css', ['style.css', 'text/css; charset=utf-8']],
  ['/catalog.json', ['catalog.json', 'application/json; charset=utf-8']],
]);

const server = createServer(async (req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  if (pathname === '/api/releases') {
    const response = await worker.fetch(new Request(`http://localhost${pathname}`, { method: req.method }), env);
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
    return;
  }
  const asset = files.get(pathname);
  if (!asset || req.method !== 'GET') { res.writeHead(404); res.end('Not Found'); return; }
  try {
    const body = await readFile(new URL(asset[0], root));
    res.writeHead(200, { 'Content-Type': asset[1] });
    res.end(body);
  } catch {
    res.writeHead(500); res.end('Asset unavailable');
  }
});

const port = Number(process.env.PORT || 8787);
server.listen(port, '127.0.0.1', () => console.log(`Release page: http://127.0.0.1:${port}`));
checkForRelease(env).then(result => {
  console.log(result.ok ? 'PICO public release checked' : 'PICO public release unavailable; showing last snapshot');
}).catch(() => console.error('Release database unavailable'));

process.on('SIGINT', () => { db.close(); server.close(); });
