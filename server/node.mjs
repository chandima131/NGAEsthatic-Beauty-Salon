import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, sep, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
// Both server/node.mjs and built dist/node.mjs live one directory below root.
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
const mimeTypes = { '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff', '.json': 'application/json' };

async function serve(req, res) {
  try {
    const url = new URL(req.url || '/', 'http://localhost');
    const handler = dev ? await vite.ssrLoadModule('/server/handler.tsx') : production;
    const html = dev ? await vite.transformIndexHtml(url.pathname, await readFile(resolve(root, 'index.html'), 'utf8')) : template;
    const response = await handler.handleRequest(new Request(url, { method: req.method }), process.env, html);
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
    if (!res.headersSent) res.writeHead(error instanceof URIError ? 400 : 500, { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' });
    res.end(error instanceof URIError ? 'Bad request' : 'Unable to load this page');
  }
}
const server = createServer((req, res) => {
  if (vite) vite.middlewares(req, res, () => { void serve(req, res); });
  else void serve(req, res);
});
server.listen(port, host, () => console.log(`NG Aesthetics React + Node.js: http://${host}:${server.address().port}`));
async function shutdown() { await vite?.close(); server.close(); server.closeAllConnections(); }
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
