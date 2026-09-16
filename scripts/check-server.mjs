import assert from 'node:assert/strict';
import { pbkdf2Sync } from 'node:crypto';
import { spawn } from 'node:child_process';
import { readFile, readdir } from 'node:fs/promises';

const testPassword = 'local-test-password';
const testSalt = Buffer.alloc(16, 7);
const testDigest = pbkdf2Sync(testPassword, testSalt, 310_000, 32, 'sha256');
const testPasswordHash = ['pbkdf2-sha256', 310_000, testSalt.toString('base64url'), testDigest.toString('base64url')].join('$');
const testSessionSecret = 'local-test-session-secret-with-32-characters';
const environment = { ...process.env, HOST: '127.0.0.1', PORT: '0', ADMIN_PASSWORD_HASH: testPasswordHash, ADMIN_SESSION_SECRET: testSessionSecret };
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
  assert.ok(!clientCode.includes('GOOGLE_MAPS_API_KEY') && !clientCode.includes(testPasswordHash) && !clientCode.includes(testSessionSecret));
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
  let response = await fetch(origin + '/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: origin },
    body: JSON.stringify({ password: 'wrong-password' }),
  });
  assert.equal(response.status, 401);
  response = await fetch(origin + '/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: origin },
    body: JSON.stringify({ password: testPassword }),
  });
  assert.equal(response.status, 200);
  const setCookie = response.headers.get('set-cookie');
  assert.match(setCookie, /^ng_admin_session=/);
  assert.match(setCookie, /HttpOnly/);
  assert.match(setCookie, /SameSite=Strict/);
  const adminCookie = setCookie.split(';')[0];

  const target = new Date();
  target.setDate(target.getDate() + 3);
  const date = isoDate(target);
  const month = date.slice(0, 7);
  const treatment = 'Microneedling Facial';
  const availabilityUrl = origin + '/api/availability?month=' + month + '&treatment=' + encodeURIComponent(treatment);
  const adminHeaders = { 'Content-Type': 'application/json', Cookie: adminCookie, Origin: origin };

  response = await fetch(origin + '/api/availability?month=' + month);
  assert.equal(response.status, 400);

  response = await fetch(availabilityUrl);
  let availability = await response.json();
  assert.equal(response.status, 200);
  assert.equal(availability.durationMinutes, 60);
  assert.deepEqual(availability.openingHours, { days: 'Monday to Sunday', opens: '10:00', closes: '22:00' });
  const targetSlots = availability.slots.filter(slot => slot.date === date);
  assert.equal(targetSlots.length, 23);
  assert.equal(targetSlots[0].time, '10:00');
  assert.equal(targetSlots.at(-1).time, '21:00');
  const selected = targetSlots[0];

  const customerHeaders = { 'Content-Type': 'application/json', Origin: origin };
  const requestBody = { slotId: selected.id, customerName: 'Test Customer', phone: '+44 7700 900123', email: 'customer@example.test', treatment, customerNotes: 'First visit', consent: true, website: '' };
  response = await fetch(origin + '/api/bookings', { method: 'POST', headers: customerHeaders, body: JSON.stringify(requestBody) });
  assert.equal(response.status, 201);
  const created = await response.json();
  assert.match(created.booking.reference, /^[0-9A-F]{8}$/);
  assert.equal(created.booking.durationMinutes, 60);

  response = await fetch(origin + '/api/bookings', { method: 'POST', headers: customerHeaders, body: JSON.stringify(requestBody) });
  assert.equal(response.status, 409);

  availability = await (await fetch(availabilityUrl)).json();
  const remainingTimes = availability.slots.filter(slot => slot.date === date).map(slot => slot.time);
  assert.ok(!remainingTimes.includes('10:00') && !remainingTimes.includes('10:30'));
  assert.ok(remainingTimes.includes('11:00'));

  response = await fetch(origin + '/api/admin/overview?from=' + date + '&to=' + date, { headers: adminHeaders });
  let overview = await response.json();
  assert.equal(response.status, 200);
  assert.equal(overview.bookings.length, 1);
  assert.equal(overview.bookings[0].customer_name, 'Test Customer');
  assert.equal(overview.bookings[0].duration_minutes, 60);
  assert.ok(!('slots' in overview));
  const bookingId = overview.bookings[0].id;

  response = await fetch(origin + '/api/admin/bookings/' + bookingId, { method: 'PATCH', headers: adminHeaders, body: JSON.stringify({ status: 'confirmed', date, startTime: '12:00', adminNotes: 'Confirmed and rescheduled by test' }) });
  assert.equal(response.status, 200);
  const updatedBooking = (await response.json()).booking;
  assert.equal(updatedBooking.status, 'confirmed');
  assert.equal(updatedBooking.start_time, '12:00');

  response = await fetch(origin + '/api/admin/blackouts', { method: 'POST', headers: adminHeaders, body: JSON.stringify({ type: 'holiday', startDate: date, endDate: date, startTime: '', endTime: '', label: 'Test holiday' }) });
  assert.equal(response.status, 201);
  const blackoutId = (await response.json()).blackout.id;

  availability = await (await fetch(availabilityUrl)).json();
  assert.equal(availability.slots.filter(slot => slot.date === date).length, 0);

  response = await fetch(origin + '/api/admin/blackouts/' + blackoutId, { method: 'DELETE', headers: adminHeaders });
  assert.equal(response.status, 200);
  response = await fetch(origin + '/api/admin/bookings/' + bookingId, { method: 'DELETE', headers: adminHeaders });
  assert.equal(response.status, 200);

  availability = await (await fetch(availabilityUrl)).json();
  assert.equal(availability.slots.filter(slot => slot.date === date).length, 23);
  assert.equal((await fetch(origin + '/api/admin/slots', { method: 'POST', headers: adminHeaders, body: '{}' })).status, 404);

  response = await fetch(origin + '/api/admin/bookings', {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      customerName: 'Message Customer',
      phone: '+44 7700 900456',
      email: '',
      treatment: 'Eyebrow Tint',
      date,
      startTime: '14:00',
      adminNotes: 'Booked through WhatsApp',
    }),
  });
  assert.equal(response.status, 201);
  const manualBooking = (await response.json()).booking;
  assert.equal(manualBooking.status, 'confirmed');
  assert.equal(manualBooking.duration_minutes, 15);
  assert.equal(manualBooking.admin_notes, 'Booked through WhatsApp');

  response = await fetch(origin + '/api/admin/overview?from=' + date + '&to=' + date, { headers: adminHeaders });
  overview = await response.json();
  assert.equal(overview.bookings.length, 1);
  assert.equal(overview.bookings[0].customer_name, 'Message Customer');
  response = await fetch(origin + '/api/admin/bookings/' + manualBooking.id, { method: 'DELETE', headers: adminHeaders });
  assert.equal(response.status, 200);

  response = await fetch(origin + '/api/admin/logout', { method: 'POST', headers: adminHeaders });
  assert.equal(response.status, 200);
  assert.match(response.headers.get('set-cookie'), /Max-Age=0/);
  assert.equal((await fetch(origin + '/api/admin/overview')).status, 401);

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
      assert.ok(!source.includes('GOOGLE_MAPS_API_KEY') && !source.includes(testPasswordHash) && !source.includes(testSessionSecret));
    }
  }
  console.log('PASS: production server, automatic treatment-duration availability, overlap protection, password admin controls, manual message bookings, rescheduling, holidays, and secret isolation.');
} finally {
  child.kill();
}