import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFile, readdir } from 'node:fs/promises';

const environment = { ...process.env, HOST: '127.0.0.1', PORT: '0', GOOGLE_MAPS_API_KEY: '', GOOGLE_PLACE_ID: '' };
const child = spawn(process.execPath, ['dist/node.mjs'], { env: environment, stdio: ['ignore', 'pipe', 'pipe'] });
let log = '';
child.stdout.on('data', chunk => { log += chunk; });
child.stderr.on('data', chunk => { log += chunk; });
try {
  const origin = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Server startup timed out: ' + log)), 15000);
    child.once('exit', code => { clearTimeout(timeout); reject(new Error(`Server exited ${code}: ${log}`)); });
    child.stdout.on('data', () => { const match = log.match(/http:\/\/127\.0\.0\.1:\d+/); if (match) { clearTimeout(timeout); resolve(match[0]); } });
  });
  await new Promise((resolve, reject) => {
    const checker = spawn(process.execPath, ['--experimental-strip-types', 'scripts/check-site.mjs'], { env: { ...environment, TEST_ORIGIN: origin }, stdio: 'inherit' });
    checker.once('exit', code => code === 0 ? resolve() : reject(new Error(`Site checks failed: ${code}`)));
    checker.once('error', reject);
  });
  const homepage = await (await fetch(origin)).text();
  assert.ok(!homepage.includes('<!--app-html-->') && !homepage.includes('<!--app-head-->'));
  assert.match(homepage, /id="root"/);
  const script = homepage.match(/src="(\/assets\/[^" ]+\.js)"/)[1];
  const client = await fetch(origin + script);
  assert.match(client.headers.get('content-type'), /javascript/);
  const clientCode = await client.text();
  assert.ok(!clientCode.includes('GOOGLE_MAPS_API_KEY') && !clientCode.includes('X-Goog-Api-Key'));
  assert.match(client.headers.get('cache-control'), /immutable/);
  for (const path of ['/server/node.mjs', '/.env.local', '/package.json', '/assets/../../server/node.mjs', '/api/missing']) assert.equal((await fetch(origin + path)).status, 404, path);
  assert.equal((await fetch(origin + '/assets/%zz')).status, 400);
  for (const path of ['/', '/api/google-reviews']) {
    const post = await fetch(origin + path, { method: 'POST' });
    assert.equal(post.status, 405);
    assert.equal(post.headers.get('allow'), 'GET, HEAD');
    const head = await fetch(origin + path, { method: 'HEAD' });
    assert.equal(head.status, 200);
    assert.equal(await head.text(), '');
  }
  const reviews = await fetch(origin + '/api/google-reviews');
  assert.match(reviews.headers.get('cache-control'), /no-store/);
  assert.deepEqual(await reviews.json(), { available: false });
  const pkg = JSON.parse(await readFile('package.json', 'utf8'));
  assert.ok(!pkg.dependencies.next && !pkg.devDependencies.vinext);
  for (const name of await readdir('dist/client/assets')) {
    if (name.endsWith('.js')) assert.ok(!(await readFile('dist/client/assets/' + name, 'utf8')).includes('GOOGLE_MAPS_API_KEY'));
  }
  console.log('PASS: standalone production Node server, SSR, client assets, 404s, protected files, HEAD/405, Google fallback, and secret isolation.');
} finally { child.kill(); }
