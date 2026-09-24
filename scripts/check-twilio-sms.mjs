import assert from 'node:assert/strict';
import { normaliseSmsPhone, sendBookingSmsNotifications } from '../server/twilio-sms.ts';

const accountSid = 'AC' + '1'.repeat(32);
const serviceSid = 'MG' + '2'.repeat(32);
const authToken = 'test-auth-token';
const booking = {
  id: 'abcdef12-3456-7890-abcd-ef1234567890',
  slot_id: 1,
  customer_name: 'Test Customer',
  phone: '07700 900123',
  email: null,
  treatment: 'Microneedling',
  duration_minutes: 75,
  customer_notes: null,
  admin_notes: null,
  status: 'confirmed',
  created_at: '2026-09-24T10:00:00.000Z',
  updated_at: '2026-09-24T10:00:00.000Z',
  slot_date: '2026-10-02',
  start_time: '14:30',
};

assert.equal(normaliseSmsPhone('07700 900123'), '+447700900123');
assert.equal(normaliseSmsPhone('0044 7700 900123'), '+447700900123');
assert.equal(normaliseSmsPhone('+44 (0)7700 900123'), '+447700900123');
assert.equal(normaliseSmsPhone('not-a-number'), null);

const requests = [];
const fetcher = async (input, init) => {
  requests.push({ input: String(input), init });
  return new Response(JSON.stringify({ sid: 'SM' + '3'.repeat(32), status: 'queued' }), {
    status: 201,
    headers: { 'Content-Type': 'application/json' },
  });
};
const environment = {
  TWILIO_ACCOUNT_SID: accountSid,
  TWILIO_AUTH_TOKEN: authToken,
  TWILIO_MESSAGING_SERVICE_SID: serviceSid,
  TWILIO_OWNER_NUMBER: '+44 7801 247820',
  TWILIO_FETCH: fetcher,
};

for (const event of ['confirmation', 'reschedule', 'cancellation']) {
  const before = requests.length;
  const result = await sendBookingSmsNotifications(event, booking, environment);
  assert.deepEqual(result, { configured: true, queued: 2, failed: 0 });
  const eventRequests = requests.slice(before);
  assert.equal(eventRequests.length, 2);
  assert.deepEqual(eventRequests.map(item => new URLSearchParams(item.init.body).get('To')), ['+447700900123', '+447801247820']);
  for (const item of eventRequests) {
    assert.equal(item.input, 'https://api.twilio.com/2010-04-01/Accounts/' + accountSid + '/Messages.json');
    assert.equal(item.init.method, 'POST');
    assert.equal(item.init.headers.Authorization, 'Basic ' + btoa(accountSid + ':' + authToken));
    const form = new URLSearchParams(item.init.body);
    assert.equal(form.get('MessagingServiceSid'), serviceSid);
    assert.equal(form.get('From'), null);
    assert.ok(form.get('Body').startsWith('NG Aesthetics:'));
    assert.ok(form.get('Body').length <= 160, 'Booking SMS should fit one standard segment');
  }
}
assert.match(new URLSearchParams(requests[0].init.body).get('Body'), /Booking confirmed/);
assert.match(new URLSearchParams(requests[2].init.body).get('Body'), /Booking rescheduled/);
assert.match(new URLSearchParams(requests[4].init.body).get('Body'), /Booking cancelled/);

let unconfiguredCalls = 0;
const unconfigured = await sendBookingSmsNotifications('confirmation', booking, {
  TWILIO_FETCH: async () => {
    unconfiguredCalls++;
    return new Response(null, { status: 500 });
  },
});
assert.deepEqual(unconfigured, { configured: false, queued: 0, failed: 0 });
assert.equal(unconfiguredCalls, 0);

const fromRequests = [];
const fromResult = await sendBookingSmsNotifications('confirmation', { ...booking, phone: 'invalid' }, {
  TWILIO_ACCOUNT_SID: accountSid,
  TWILIO_AUTH_TOKEN: authToken,
  TWILIO_FROM_NUMBER: 'NGAesthetic',
  TWILIO_OWNER_NUMBER: '07801 247820',
  TWILIO_FETCH: async (_input, init) => {
    fromRequests.push(init);
    return new Response('{}', { status: 201 });
  },
});
assert.deepEqual(fromResult, { configured: true, queued: 1, failed: 0 });
const fromForm = new URLSearchParams(fromRequests[0].body);
assert.equal(fromForm.get('From'), 'NGAesthetic');
assert.equal(fromForm.get('MessagingServiceSid'), null);

const originalWarn = console.warn;
console.warn = () => {};
const failure = await sendBookingSmsNotifications('confirmation', booking, {
  ...environment,
  TWILIO_FETCH: async () => new Response(JSON.stringify({ code: 21614 }), { status: 400 }),
});
console.warn = originalWarn;
assert.deepEqual(failure, { configured: true, queued: 0, failed: 2 });

console.log('PASS: Twilio SMS confirmation, reschedule, cancellation, UK number normalisation, fallback sender, and failure isolation.');