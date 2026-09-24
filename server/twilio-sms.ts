import type { BookingView } from '../db/booking-store';

export type BookingSmsEvent = 'confirmation' | 'reschedule' | 'cancellation';

export type TwilioSmsEnvironment = {
  TWILIO_ACCOUNT_SID?: string;
  TWILIO_AUTH_TOKEN?: string;
  TWILIO_MESSAGING_SERVICE_SID?: string;
  TWILIO_FROM_NUMBER?: string;
  TWILIO_OWNER_NUMBER?: string;
  TWILIO_FETCH?: typeof fetch;
};

export type SmsNotificationResult = {
  configured: boolean;
  queued: number;
  failed: number;
};

const salonName = 'NG Aesthetics';
const salonPhone = '07801 247820';
const sidPattern = /^AC[0-9a-fA-F]{32}$/;
const servicePattern = /^MG[0-9a-fA-F]{32}$/;
const e164Pattern = /^\+[1-9]\d{7,14}$/;

function value(input: string | undefined) {
  return input?.trim() ?? '';
}

export function normaliseSmsPhone(input: string) {
  let phone = input.trim().replace(/[\s().-]/g, '');
  if (phone.startsWith('00')) phone = '+' + phone.slice(2);
  if (phone.startsWith('+440')) phone = '+44' + phone.slice(4);
  if (phone.startsWith('0')) phone = '+44' + phone.slice(1);
  return e164Pattern.test(phone) ? phone : null;
}

function smsDate(date: string) {
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Europe/London',
  }).format(new Date(date + 'T12:00:00Z'));
}

function shortText(input: string, maximum: number) {
  const clean = input
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7E]/g, '?')
    .replace(/\s+/g, ' ')
    .trim();
  return clean.length <= maximum ? clean : clean.slice(0, maximum - 1).trimEnd() + '.';
}

function reference(booking: BookingView) {
  return booking.id.slice(0, 8).toUpperCase();
}

function customerMessage(event: BookingSmsEvent, booking: BookingView) {
  const treatment = shortText(booking.treatment, 48);
  const appointment = smsDate(booking.slot_date) + ' at ' + booking.start_time;
  const ref = reference(booking);
  if (event === 'reschedule') {
    return salonName + ': Booking rescheduled. ' + treatment + ' is now ' + appointment + '. Ref ' + ref + '. Changes: ' + salonPhone + '.';
  }
  if (event === 'cancellation') {
    return salonName + ': Booking cancelled. ' + treatment + ' on ' + appointment + '. Ref ' + ref + '. Contact: ' + salonPhone + '.';
  }
  return salonName + ': Booking confirmed for ' + treatment + ' on ' + appointment + '. Ref ' + ref + '. Changes: ' + salonPhone + '.';
}

function ownerMessage(event: BookingSmsEvent, booking: BookingView) {
  const treatment = shortText(booking.treatment, 34);
  const customer = shortText(booking.customer_name, 24);
  const customerPhone = normaliseSmsPhone(booking.phone) ?? shortText(booking.phone, 18);
  const appointment = smsDate(booking.slot_date) + ' ' + booking.start_time;
  const label = event === 'reschedule' ? 'MOVED' : event === 'cancellation' ? 'CANCELLED' : 'NEW';
  return salonName + ': ' + label + ' | ' + customer + ' | ' + treatment + ' | ' + appointment + ' | ' + customerPhone + ' | ' + reference(booking);
}

function configuration(env: TwilioSmsEnvironment) {
  const accountSid = value(env.TWILIO_ACCOUNT_SID);
  const authToken = value(env.TWILIO_AUTH_TOKEN);
  const messagingServiceSid = value(env.TWILIO_MESSAGING_SERVICE_SID);
  const fromNumber = value(env.TWILIO_FROM_NUMBER);
  const ownerNumber = normaliseSmsPhone(value(env.TWILIO_OWNER_NUMBER));
  const senderValid = servicePattern.test(messagingServiceSid) || Boolean(fromNumber);
  if (!sidPattern.test(accountSid) || !authToken || !senderValid || !ownerNumber) return null;
  return { accountSid, authToken, messagingServiceSid, fromNumber, ownerNumber };
}

async function sendMessage(
  to: string,
  body: string,
  config: NonNullable<ReturnType<typeof configuration>>,
  fetcher: typeof fetch,
) {
  const form = new URLSearchParams({ To: to, Body: body });
  if (servicePattern.test(config.messagingServiceSid)) form.set('MessagingServiceSid', config.messagingServiceSid);
  else form.set('From', config.fromNumber);
  const credentials = btoa(config.accountSid + ':' + config.authToken);
  const response = await fetcher(
    'https://api.twilio.com/2010-04-01/Accounts/' + config.accountSid + '/Messages.json',
    {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + credentials,
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
      },
      body: form.toString(),
    },
  );
  if (response.ok) return;
  let code = '';
  try {
    const error = await response.json() as { code?: number | string };
    if (error.code) code = ' (' + error.code + ')';
  } catch {}
  throw new Error('Twilio rejected an SMS request' + code + '.');
}

export async function sendBookingSmsNotifications(
  event: BookingSmsEvent,
  booking: BookingView,
  env: TwilioSmsEnvironment,
): Promise<SmsNotificationResult> {
  const config = configuration(env);
  if (!config) return { configured: false, queued: 0, failed: 0 };

  const customerNumber = normaliseSmsPhone(booking.phone);
  const messages = [
    customerNumber ? { to: customerNumber, body: customerMessage(event, booking) } : null,
    { to: config.ownerNumber, body: ownerMessage(event, booking) },
  ].filter((message): message is { to: string; body: string } => Boolean(message));

  const fetcher = env.TWILIO_FETCH ?? fetch;
  const results = await Promise.allSettled(messages.map(message => sendMessage(message.to, message.body, config, fetcher)));
  const failed = results.filter(result => result.status === 'rejected').length;
  if (failed) console.warn('Twilio SMS notification failure:', failed + ' of ' + results.length + ' messages were not accepted.');
  return { configured: true, queued: results.length - failed, failed };
}