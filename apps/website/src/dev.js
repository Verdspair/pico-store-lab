import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import worker, { checkForRelease } from './worker.js';
import { openLocalD1 } from './local-db.js';

const root = new URL('../public/', import.meta.url);
const dbPath = fileURLToPath(new URL('../.local/releases.sqlite', import.meta.url));
const db = openLocalD1(dbPath);
// Local-only fallback so `npm run dev` can exercise the account flow.
// Production reads the value from `wrangler secret put SESSION_SECRET`.
const devSecret = process.env.SESSION_SECRET ?? 'local-development-session-secret-please-rotate';
if (!process.env.SESSION_SECRET) console.warn('SESSION_SECRET unset; using a local development secret');
const env = { DB: db, SESSION_SECRET: devSecret };
const files = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/app.js', ['app.js', 'text/javascript; charset=utf-8']],
  ['/md5.js', ['md5.js', 'text/javascript; charset=utf-8']],
  ['/style.css', ['style.css', 'text/css; charset=utf-8']],
  ['/i18n.css', ['i18n.css', 'text/css; charset=utf-8']],
  ['/catalog.json', ['catalog.json', 'application/json; charset=utf-8']],
]);

const server = createServer(async (req, res) => {
  const requested = new URL(req.url, 'http://localhost');
  const pathname = requested.pathname;
  if (pathname.startsWith('/api/')) {
    const headers = {};
    for (const [name, value] of Object.entries(req.headers)) {
      if (typeof value === 'string') headers[name] = value;
    }
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const init = { method: req.method, headers };
    if (req.method !== 'GET' && req.method !== 'HEAD' && chunks.length) init.body = Buffer.concat(chunks);
    const response = await worker.fetch(new Request(requested, init), env);
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
