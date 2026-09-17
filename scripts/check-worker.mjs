import assert from 'node:assert/strict';
import { pbkdf2Sync } from 'node:crypto';

globalThis.MessageChannel = undefined;
const { default: worker } = await import('../dist/server/index.js');
const testPassword = 'worker-test-password';
const salt = Buffer.alloc(16, 3);
const digest = pbkdf2Sync(testPassword, salt, 310_000, 32, 'sha256');
const env = {
  ADMIN_PASSWORD_HASH: ['pbkdf2-sha256', 310_000, salt.toString('base64url'), digest.toString('base64url')].join('$'),
  ADMIN_SESSION_SECRET: 'worker-test-session-secret-with-32-characters',
  ASSETS: { fetch: async () => new Response('asset') },
};
const page = await worker.fetch(new Request('https://example.test/'), env);
assert.equal(page.status, 200);
const html = await page.text();
for (const id of ['home','about','services','booking','gallery','location','reviews','contact']) assert.match(html, new RegExp('id="' + id + '"'));
const adminPage = await worker.fetch(new Request('https://example.test/admin'), env);
assert.equal(adminPage.status, 200);
assert.match(await adminPage.text(), /noindex, nofollow/);
const oldPage = await worker.fetch(new Request('https://example.test/contact'), env);
assert.equal(oldPage.status, 301);
assert.equal(oldPage.headers.get('location'), '/#contact');
const asset = await worker.fetch(new Request('https://example.test/images/logo.jpg'), env);
assert.equal(await asset.text(), 'asset');
const missingTreatment = await worker.fetch(new Request('https://example.test/api/availability?month=2026-10'), env);
assert.equal(missingTreatment.status, 400);
const availability = await worker.fetch(new Request('https://example.test/api/availability?month=2026-10&treatment=Luxury%20Microneedling'), env);
assert.equal(availability.status, 200);
const availabilityData = await availability.json();
assert.equal(availabilityData.durationMinutes, 80);
assert.deepEqual(availabilityData.openingHours, { days: 'Monday to Sunday', opens: '10:00', closes: '22:00' });
assert.ok(availabilityData.slots.length > 0);
assert.ok(availabilityData.slots.every(slot => slot.durationMinutes === 80));
const anonymousAdmin = await worker.fetch(new Request('https://example.test/api/admin/overview'), env);
assert.equal(anonymousAdmin.status, 401);
const login = await worker.fetch(new Request('https://example.test/api/admin/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Origin: 'https://example.test' },
  body: JSON.stringify({ password: testPassword }),
}), env);
assert.equal(login.status, 200);
assert.match(login.headers.get('set-cookie'), /HttpOnly; SameSite=Strict/);
assert.match(login.headers.get('set-cookie'), /Secure/);
const cookie = login.headers.get('set-cookie').split(';')[0];
const overview = await worker.fetch(new Request('https://example.test/api/admin/overview', { headers: { Cookie: cookie } }), env);
assert.equal(overview.status, 200);
assert.equal((await overview.json()).admin.authenticated, true);
assert.deepEqual(await (await worker.fetch(new Request('https://example.test/api/google-reviews'), env)).json(), { error: 'Not found' });
console.log('PASS: Sites worker, automatic treatment-specific availability, password session, protected admin route, redirects, and static assets.');
