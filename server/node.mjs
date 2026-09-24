import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, sep, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createNodeDatabase } from './node-database.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
for (const name of ['.env.local', '.env']) {
  try { process.loadEnvFile(resolve(root, name)); } catch (error) { if (error.code !== 'ENOENT') throw error; }
}
const dev = process.argv.includes('--dev');
const host = process.env.HOST || (dev ? '127.0.0.1' : '0.0.0.0');
const port = Number(process.env.PORT || 3000);
const vite = dev ? await (await import('vite')).createServer({ root, appType: 'custom', server: { middlewareMode: true } }) : null;
const production = dev ? null : await import('../dist/server/index.js');
const template = dev ? null : await readFile(resolve(root, 'dist/template.html'), 'utf8');
const staticRoot = resolve(root, 'dist/client');
const bookingDatabase = createNodeDatabase(process.env.BOOKING_DB_PATH || resolve(root, '.data', 'bookings.sqlite'));
const mimeTypes = { '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff', '.json': 'application/json' };

async function toRequest(req, url) {
  const headers = new Headers();
  for (const [name, value] of Object.entries(req.headers)) {
    if (Array.isArray(value)) headers.set(name, value.join(', '));
    else if (value !== undefined) headers.set(name, value);
  }
  const init = { method: req.method, headers };
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    const chunks = [];
    let total = 0;
    for await (const chunk of req) {
      total += chunk.length;
      if (total > 100_000) throw Object.assign(new Error('Payload too large'), { code: 'PAYLOAD_TOO_LARGE' });
      chunks.push(chunk);
    }
    init.body = Buffer.concat(chunks);
  }
  return new Request(url, init);
}

async function serve(req, res) {
  try {
    const origin = 'http://' + (req.headers.host || 'localhost');
    const url = new URL(req.url || '/', origin);
    const handler = dev ? await vite.ssrLoadModule('/server/handler.tsx') : production;
    const html = dev ? await vite.transformIndexHtml(url.pathname, await readFile(resolve(root, 'index.html'), 'utf8')) : template;
    const request = await toRequest(req, url);
    const response = await handler.handleRequest(request, html, {
      ADMIN_PASSWORD_HASH: process.env.ADMIN_PASSWORD_HASH,
      ADMIN_SESSION_SECRET: process.env.ADMIN_SESSION_SECRET,
      TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID,
      TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN,
      TWILIO_MESSAGING_SERVICE_SID: process.env.TWILIO_MESSAGING_SERVICE_SID,
      TWILIO_FROM_NUMBER: process.env.TWILIO_FROM_NUMBER,
      TWILIO_OWNER_NUMBER: process.env.TWILIO_OWNER_NUMBER,
      DB: bookingDatabase,
    });
    if (response) {
      res.writeHead(response.status, Object.fromEntries(response.headers));
      res.end(req.method === 'HEAD' ? undefined : Buffer.from(await response.arrayBuffer()));
      return;
    }
    const path = resolve(staticRoot, '.' + decodeURIComponent(url.pathname));
    if (!path.startsWith(staticRoot + sep)) { res.writeHead(404); res.end('Not found'); return; }
    try {
      if (!(await stat(path)).isFile()) throw Object.assign(new Error('Not a file'), { code: 'ENOENT' });
      const data = await readFile(path);
      res.writeHead(200, { 'Content-Type': mimeTypes[extname(path)] || 'application/octet-stream', 'X-Content-Type-Options': 'nosniff', 'Cache-Control': url.pathname.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'public, max-age=3600' });
      res.end(req.method === 'HEAD' ? undefined : data);
    } catch (error) { if (error.code !== 'ENOENT' && error.code !== 'ENOTDIR') throw error; res.writeHead(404); res.end('Not found'); }
  } catch (error) {
    if (dev) vite.ssrFixStacktrace(error);
    console.error('Request failed:', error.name);
    const statusCode = error.code === 'PAYLOAD_TOO_LARGE' ? 413 : error instanceof URIError ? 400 : 500;
    if (!res.headersSent) res.writeHead(statusCode, { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' });
    res.end(statusCode === 413 ? 'Payload too large' : statusCode === 400 ? 'Bad request' : 'Unable to load this page');
  }
}
const server = createServer((req, res) => {
  if (vite) vite.middlewares(req, res, () => { void serve(req, res); });
  else void serve(req, res);
});
server.listen(port, host, () => console.log('NG Aesthetics React + Node.js: http://' + host + ':' + server.address().port));
async function shutdown() { await vite?.close(); server.close(); server.closeAllConnections(); bookingDatabase.close(); }
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
