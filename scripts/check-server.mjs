import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFile, readdir } from 'node:fs/promises';

const environment = { ...process.env, HOST: '127.0.0.1', PORT: '0', ADMIN_EMAILS: 'admin@example.test' };
const child = spawn(process.execPath, ['dist/node.mjs'], { env: environment, stdio: ['ignore', 'pipe', 'pipe'] });
let log = '';
child.stdout.on('data', chunk => { log += chunk; });
child.stderr.on('data', chunk => { log += chunk; });

function isoDate(date) {
  return String(date.getFullYear()) + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
}

try {
  const origin = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Server startup timed out: ' + log)), 15000);
    child.once('exit', code => { clearTimeout(timeout); reject(new Error('Server exited ' + code + ': ' + log)); });
    child.stdout.on('data', () => { const match = log.match(/http:\/\/127\.0\.0\.1:\d+/); if (match) { clearTimeout(timeout); resolve(match[0]); } });
  });
  await new Promise((resolve, reject) => {
    const checker = spawn(process.execPath, ['--experimental-strip-types', 'scripts/check-site.mjs'], { env: { ...environment, TEST_ORIGIN: origin }, stdio: 'inherit' });
    checker.once('exit', code => code === 0 ? resolve() : reject(new Error('Site checks failed: ' + code)));
    checker.once('error', reject);
  });

  const homepage = await (await fetch(origin)).text();
  assert.ok(!homepage.includes('<!--app-html-->') && !homepage.includes('<!--app-head-->'));
  assert.match(homepage, /id="root"/);
  assert.match(homepage, /id="booking"/);
  const script = homepage.match(/src="(\/assets\/[^" ]+\.js)"/)[1];
  const client = await fetch(origin + script);
  assert.match(client.headers.get('content-type'), /javascript/);
  const clientCode = await client.text();
  assert.ok(!clientCode.includes('GOOGLE_MAPS_API_KEY') && !clientCode.includes('admin@example.test'));
  assert.match(client.headers.get('cache-control'), /immutable/);

  for (const path of ['/server/node.mjs', '/.env.local', '/package.json', '/assets/../../server/node.mjs', '/api/missing']) assert.equal((await fetch(origin + path)).status, 404, path);
  assert.equal((await fetch(origin + '/assets/%zz')).status, 400);
  const post = await fetch(origin, { method: 'POST' });
  assert.equal(post.status, 405);
  assert.equal(post.headers.get('allow'), 'GET, HEAD');
  const head = await fetch(origin, { method: 'HEAD' });
  assert.equal(head.status, 200);
  assert.equal(await head.text(), '');

  const adminPage = await fetch(origin + '/admin');
  assert.equal(adminPage.status, 200);
  assert.match(await adminPage.text(), /noindex, nofollow/);
  const anonymousAdmin = await fetch(origin + '/api/admin/overview');
  assert.equal(anonymousAdmin.status, 401);
  const wrongAdmin = await fetch(origin + '/api/admin/overview', { headers: { 'oai-authenticated-user-email': 'wrong@example.test' } });
  assert.equal(wrongAdmin.status, 403);

  const target = new Date();
  target.setDate(target.getDate() + 3);
  const date = isoDate(target);
  const month = date.slice(0, 7);
  const adminHeaders = { 'Content-Type': 'application/json', 'oai-authenticated-user-email': 'admin@example.test', Origin: origin };
  let response = await fetch(origin + '/api/admin/slots', { method: 'POST', headers: adminHeaders, body: JSON.stringify({ date, startTime: '10:00', endTime: '12:00', durationMinutes: 60 }) });
  assert.equal(response.status, 201);
  assert.equal((await response.json()).count, 2);

  response = await fetch(origin + '/api/availability?month=' + month);
  let availability = await response.json();
  assert.equal(response.status, 200);
  assert.equal(availability.slots.filter(slot => slot.date === date).length, 2);
  const selected = availability.slots.find(slot => slot.date === date);

  const customerHeaders = { 'Content-Type': 'application/json', Origin: origin };
  const requestBody = { slotId: selected.id, customerName: 'Test Customer', phone: '+44 7700 900123', email: 'customer@example.test', treatment: 'Microneedling Facial', customerNotes: 'First visit', consent: true, website: '' };
  response = await fetch(origin + '/api/bookings', { method: 'POST', headers: customerHeaders, body: JSON.stringify(requestBody) });
  assert.equal(response.status, 201);
  const created = await response.json();
  assert.match(created.booking.reference, /^[0-9A-F]{8}$/);

  response = await fetch(origin + '/api/bookings', { method: 'POST', headers: customerHeaders, body: JSON.stringify(requestBody) });
  assert.equal(response.status, 409);

  response = await fetch(origin + '/api/admin/overview?from=' + date + '&to=' + date, { headers: adminHeaders });
  let overview = await response.json();
  assert.equal(response.status, 200);
  assert.equal(overview.bookings.length, 1);
  assert.equal(overview.bookings[0].customer_name, 'Test Customer');
  const bookingId = overview.bookings[0].id;

  response = await fetch(origin + '/api/admin/bookings/' + bookingId, { method: 'PATCH', headers: adminHeaders, body: JSON.stringify({ status: 'confirmed', slotId: selected.id, adminNotes: 'Confirmed by test' }) });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).booking.status, 'confirmed');

  response = await fetch(origin + '/api/admin/blackouts', { method: 'POST', headers: adminHeaders, body: JSON.stringify({ type: 'holiday', startDate: date, endDate: date, startTime: '', endTime: '', label: 'Test holiday' }) });
  assert.equal(response.status, 201);
  const blackoutId = (await response.json()).blackout.id;

  availability = await (await fetch(origin + '/api/availability?month=' + month)).json();
  assert.equal(availability.slots.filter(slot => slot.date === date).length, 0);

  response = await fetch(origin + '/api/admin/blackouts/' + blackoutId, { method: 'DELETE', headers: adminHeaders });
  assert.equal(response.status, 200);
  response = await fetch(origin + '/api/admin/bookings/' + bookingId, { method: 'DELETE', headers: adminHeaders });
  assert.equal(response.status, 200);

  availability = await (await fetch(origin + '/api/availability?month=' + month)).json();
  assert.equal(availability.slots.filter(slot => slot.date === date).length, 2);

  response = await fetch(origin + '/api/admin/overview?from=' + date + '&to=' + date, { headers: adminHeaders });
  overview = await response.json();
  for (const slot of overview.slots) {
    const deleted = await fetch(origin + '/api/admin/slots/' + slot.id, { method: 'DELETE', headers: adminHeaders });
    assert.equal(deleted.status, 200);
  }

  const reviews = await fetch(origin + '/api/google-reviews');
  assert.equal(reviews.status, 404);
  assert.deepEqual(await reviews.json(), { error: 'Not found' });
  for (const name of ['Shabz', 'Lisa Bevan', 'Astrella Kate', 'Irene Shode', 'Nosheen Khan', 'Susie Law']) assert.ok(homepage.includes(name));

  const pkg = JSON.parse(await readFile('package.json', 'utf8'));
  assert.ok(!pkg.dependencies.next && !pkg.devDependencies.vinext);
  const hosting = JSON.parse(await readFile('.openai/hosting.json', 'utf8'));
  assert.equal(hosting.d1, 'DB');
  for (const name of await readdir('dist/client/assets')) {
    if (name.endsWith('.js')) {
      const source = await readFile('dist/client/assets/' + name, 'utf8');
      assert.ok(!source.includes('GOOGLE_MAPS_API_KEY') && !source.includes('admin@example.test'));
    }
  }
  console.log('PASS: production server, customer booking flow, protected admin controls, availability, holidays, assets, and secret isolation.');
} finally {
  child.kill();
}