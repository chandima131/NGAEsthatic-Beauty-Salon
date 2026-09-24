import assert from 'node:assert/strict';
import { pbkdf2Sync } from 'node:crypto';

globalThis.MessageChannel = undefined;
const { default: worker } = await import('../dist/server/index.js');
const testPassword = 'worker-test-password';
const salt = Buffer.alloc(16, 3);
const digest = pbkdf2Sync(testPassword, salt, 310_000, 32, 'sha256');
const smsRequests = [];
const env = {
  ADMIN_PASSWORD_HASH: ['pbkdf2-sha256', 310_000, salt.toString('base64url'), digest.toString('base64url')].join('$'),
  ADMIN_SESSION_SECRET: 'worker-test-session-secret-with-32-characters',
  TWILIO_ACCOUNT_SID: 'AC' + '1'.repeat(32),
  TWILIO_AUTH_TOKEN: 'worker-test-token',
  TWILIO_MESSAGING_SERVICE_SID: 'MG' + '2'.repeat(32),
  TWILIO_OWNER_NUMBER: '+44 7801 247820',
  TWILIO_FETCH: async (input, init) => {
    smsRequests.push({ input: String(input), form: new URLSearchParams(init.body) });
    return new Response(JSON.stringify({ sid: 'SM' + '3'.repeat(32), status: 'queued' }), { status: 201 });
  },
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

const selectedSlot = availabilityData.slots[0];
const bookingResponse = await worker.fetch(new Request('https://example.test/api/bookings', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Origin: 'https://example.test' },
  body: JSON.stringify({
    slotId: selectedSlot.id,
    customerName: 'SMS Test Customer',
    phone: '07700 900789',
    email: '',
    treatment: 'Luxury Microneedling',
    customerNotes: '',
    consent: true,
    website: '',
  }),
}), env);
assert.equal(bookingResponse.status, 201);
assert.equal(smsRequests.length, 2);
assert.deepEqual(smsRequests.map(item => item.form.get('To')), ['+447700900789', '+447801247820']);
assert.match(smsRequests[0].form.get('Body'), /Booking confirmed/);
assert.match(smsRequests[1].form.get('Body'), /: NEW \|/);

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
const adminHeaders = { 'Content-Type': 'application/json', Origin: 'https://example.test', Cookie: cookie };
const overview = await worker.fetch(new Request('https://example.test/api/admin/overview', { headers: { Cookie: cookie } }), env);
assert.equal(overview.status, 200);
const overviewData = await overview.json();
assert.equal(overviewData.admin.authenticated, true);
const booking = overviewData.bookings.find(item => item.customer_name === 'SMS Test Customer');
assert.ok(booking);

let response = await worker.fetch(new Request('https://example.test/api/admin/bookings/' + booking.id, {
  method: 'PATCH',
  headers: adminHeaders,
  body: JSON.stringify({ status: 'confirmed', date: selectedSlot.date, startTime: '14:00', adminNotes: 'Rescheduled by test' }),
}), env);
assert.equal(response.status, 200);
assert.equal(smsRequests.length, 4);
assert.match(smsRequests[2].form.get('Body'), /Booking rescheduled/);
assert.match(smsRequests[3].form.get('Body'), /: MOVED \|/);

response = await worker.fetch(new Request('https://example.test/api/admin/bookings/' + booking.id, {
  method: 'PATCH',
  headers: adminHeaders,
  body: JSON.stringify({ status: 'cancelled', date: selectedSlot.date, startTime: '14:00', adminNotes: 'Cancelled by test' }),
}), env);
assert.equal(response.status, 200);
assert.equal(smsRequests.length, 6);
assert.match(smsRequests[4].form.get('Body'), /Booking cancelled/);
assert.match(smsRequests[5].form.get('Body'), /: CANCELLED \|/);

response = await worker.fetch(new Request('https://example.test/api/admin/bookings/' + booking.id, {
  method: 'DELETE',
  headers: adminHeaders,
}), env);
assert.equal(response.status, 200);
assert.equal(smsRequests.length, 6, 'Deleting an already cancelled booking must not send a duplicate SMS');

assert.deepEqual(await (await worker.fetch(new Request('https://example.test/api/google-reviews'), env)).json(), { error: 'Not found' });
console.log('PASS: Sites worker, treatment availability, Twilio confirmation/reschedule/cancellation SMS, password session, protected admin route, redirects, and static assets.');