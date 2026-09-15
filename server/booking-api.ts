import { categories } from '../lib/services';
import {
  BookingNotFoundError,
  SlotUnavailableError,
  getBookingStore,
  type BlackoutInput,
  type BookingStatus,
  type D1DatabaseLike,
  type SlotInput,
} from '../db/booking-store';

export type BookingEnvironment = {
  DB?: D1DatabaseLike;
  ADMIN_EMAILS?: string;
};

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const bookingStatuses: BookingStatus[] = ['pending', 'confirmed', 'completed', 'cancelled', 'no_show'];
const treatmentNames = new Set(categories.flatMap(category => category.treatments.map(treatment => treatment.name)));

function json(data: unknown, status = 200, extraHeaders: HeadersInit = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      ...extraHeaders,
    },
  });
}

function londonToday() {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find(part => part.type === type)?.value ?? '';
  return value('year') + '-' + value('month') + '-' + value('day');
}

function isRealDate(value: string) {
  if (!datePattern.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function monthRange(month: string) {
  if (!/^\d{4}-\d{2}$/.test(month)) return null;
  const [year, value] = month.split('-').map(Number);
  if (value < 1 || value > 12) return null;
  const end = new Date(Date.UTC(year, value, 0));
  return {
    from: month + '-01',
    to: end.toISOString().slice(0, 10),
  };
}

function timeToMinutes(value: string) {
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
}

function minutesToTime(value: number) {
  return String(Math.floor(value / 60)).padStart(2, '0') + ':' + String(value % 60).padStart(2, '0');
}

function textField(value: unknown, max: number, required = false) {
  if (typeof value !== 'string') return required ? null : '';
  const clean = value.trim().replace(/\s+/g, ' ');
  if ((required && !clean) || clean.length > max) return null;
  return clean;
}

async function body(request: Request) {
  const length = Number(request.headers.get('content-length') || 0);
  if (length > 20_000) throw new Error('body_too_large');
  if (!request.headers.get('content-type')?.toLowerCase().includes('application/json')) throw new Error('json_required');
  return await request.json() as Record<string, unknown>;
}

function sameOrigin(request: Request) {
  const origin = request.headers.get('origin');
  return !origin || origin === new URL(request.url).origin;
}

function methodNotAllowed(methods: string[]) {
  return json({ error: 'Method not allowed.' }, 405, { Allow: methods.join(', ') });
}

function requireAdmin(request: Request, env: BookingEnvironment): { ok: true; email: string } | { ok: false; response: Response } {
  const email = request.headers.get('oai-authenticated-user-email')?.trim().toLowerCase();
  if (!email) return { ok: false, response: json({ error: 'signin_required', signInUrl: '/signin-with-chatgpt?return_to=/admin' }, 401) };
  const allowed = (env.ADMIN_EMAILS ?? '').split(',').map(value => value.trim().toLowerCase()).filter(Boolean);
  if (!allowed.length) return { ok: false, response: json({ error: 'admin_not_configured' }, 503) };
  if (!allowed.includes(email)) return { ok: false, response: json({ error: 'not_authorized', email }, 403) };
  return { ok: true, email };
}
function errorResponse(error: unknown) {
  if (error instanceof SlotUnavailableError) return json({ error: error.message }, 409);
  if (error instanceof BookingNotFoundError) return json({ error: error.message }, 404);
  if (error instanceof SyntaxError) return json({ error: 'Invalid JSON request.' }, 400);
  if (error instanceof Error && error.message === 'body_too_large') return json({ error: 'Request is too large.' }, 413);
  if (error instanceof Error && error.message === 'json_required') return json({ error: 'Send this request as JSON.' }, 415);
  console.error('Booking request failed:', error instanceof Error ? error.name : 'UnknownError');
  return json({ error: 'Unable to complete that request right now.' }, 500);
}

function validRange(from: string | null, to: string | null) {
  if (!from || !to || !isRealDate(from) || !isRealDate(to) || from > to) return null;
  return { from, to };
}

export async function handleBookingApi(request: Request, env: BookingEnvironment = {}): Promise<Response | null> {
  const url = new URL(request.url);
  const path = url.pathname;
  if (!path.startsWith('/api/')) return null;
  const store = getBookingStore(env.DB);

  try {
    if (path === '/api/availability') {
      if (request.method !== 'GET') return methodNotAllowed(['GET']);
      const month = url.searchParams.get('month') ?? londonToday().slice(0, 7);
      const range = monthRange(month);
      if (!range) return json({ error: 'Use a valid month in YYYY-MM format.' }, 400);
      const availability = await store.getAvailability(range.from, range.to);
      return json({
        month,
        timezone: 'Europe/London',
        slots: availability.slots.map(slot => ({
          id: slot.id,
          date: slot.slot_date,
          time: slot.start_time,
          durationMinutes: slot.duration_minutes,
        })),
        blackouts: availability.blackouts.map(item => ({
          startDate: item.start_date,
          endDate: item.end_date,
          startTime: item.start_time,
          endTime: item.end_time,
          type: item.type,
          label: item.label,
        })),
      });
    }

    if (path === '/api/bookings') {
      if (request.method !== 'POST') return methodNotAllowed(['POST']);
      if (!sameOrigin(request)) return json({ error: 'Cross-site requests are not accepted.' }, 403);
      const input = await body(request);
      if (input.website) return json({ error: 'Unable to submit this booking.' }, 400);
      const slotId = Number(input.slotId);
      const customerName = textField(input.customerName, 80, true);
      const phone = textField(input.phone, 30, true);
      const email = textField(input.email, 120);
      const treatment = textField(input.treatment, 120, true);
      const customerNotes = textField(input.customerNotes, 500);
      if (!Number.isInteger(slotId) || slotId < 1 || !customerName || !phone || !treatment || input.consent !== true) return json({ error: 'Complete all required booking details.' }, 400);
      if (!/^[0-9+() .-]{6,30}$/.test(phone)) return json({ error: 'Enter a valid phone number.' }, 400);
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: 'Enter a valid email address.' }, 400);
      if (!treatmentNames.has(treatment)) return json({ error: 'Choose a treatment from the service list.' }, 400);
      const booking = await store.createBooking({
        slotId,
        customerName,
        phone,
        email: email || null,
        treatment,
        customerNotes: customerNotes || null,
      });
      return json({
        booking: {
          reference: booking.id.slice(0, 8).toUpperCase(),
          date: booking.slot_date,
          time: booking.start_time,
          durationMinutes: booking.duration_minutes,
          treatment: booking.treatment,
          status: booking.status,
        },
      }, 201);
    }

    if (path.startsWith('/api/admin/')) {
      const admin = requireAdmin(request, env);
      if (!admin.ok) return admin.response;

      if (path === '/api/admin/overview') {
        if (request.method !== 'GET') return methodNotAllowed(['GET']);
        const defaultFrom = londonToday();
        const defaultToDate = new Date(defaultFrom + 'T12:00:00Z');
        defaultToDate.setUTCFullYear(defaultToDate.getUTCFullYear() + 1);
        const range = validRange(url.searchParams.get('from') ?? defaultFrom, url.searchParams.get('to') ?? defaultToDate.toISOString().slice(0, 10));
        if (!range) return json({ error: 'Use valid from and to dates.' }, 400);
        return json({ admin: { email: admin.email }, ...(await store.getOverview(range.from, range.to)) });
      }

      if (path === '/api/admin/slots') {
        if (request.method !== 'POST') return methodNotAllowed(['POST']);
        if (!sameOrigin(request)) return json({ error: 'Cross-site requests are not accepted.' }, 403);
        const input = await body(request);
        const date = textField(input.date, 10, true);
        const startTime = textField(input.startTime, 5, true);
        const endTime = textField(input.endTime, 5, true);
        const durationMinutes = Number(input.durationMinutes);
        if (!date || !isRealDate(date) || date < londonToday() || !startTime || !endTime || !timePattern.test(startTime) || !timePattern.test(endTime) || ![15, 30, 45, 60, 90, 120].includes(durationMinutes)) return json({ error: 'Enter a valid future date, time range, and slot length.' }, 400);
        const start = timeToMinutes(startTime);
        const end = timeToMinutes(endTime);
        if (end <= start || end - start > 12 * 60) return json({ error: 'The end time must be after the start time.' }, 400);
        const slots: SlotInput[] = [];
        for (let value = start; value + durationMinutes <= end; value += durationMinutes) slots.push({ date, startTime: minutesToTime(value), durationMinutes });
        if (!slots.length || slots.length > 48) return json({ error: 'This time range does not create a valid set of slots.' }, 400);
        await store.addSlots(slots);
        return json({ message: slots.length + (slots.length === 1 ? ' slot added.' : ' slots added.'), count: slots.length }, 201);
      }

      const slotMatch = path.match(/^\/api\/admin\/slots\/(\d+)$/);
      if (slotMatch) {
        if (request.method !== 'DELETE') return methodNotAllowed(['DELETE']);
        if (!sameOrigin(request)) return json({ error: 'Cross-site requests are not accepted.' }, 403);
        const result = await store.removeSlot(Number(slotMatch[1]));
        return json({ ...result, message: result.disabled ? 'The slot has booking history, so it was marked unavailable.' : 'Slot removed.' });
      }

      if (path === '/api/admin/blackouts') {
        if (request.method !== 'POST') return methodNotAllowed(['POST']);
        if (!sameOrigin(request)) return json({ error: 'Cross-site requests are not accepted.' }, 403);
        const input = await body(request);
        const type = input.type === 'holiday' ? 'holiday' : input.type === 'unavailable' ? 'unavailable' : null;
        const startDate = textField(input.startDate, 10, true);
        const endDate = textField(input.endDate, 10, true);
        const startTime = textField(input.startTime, 5);
        const endTime = textField(input.endTime, 5);
        const label = textField(input.label, 100);
        if (!type || !startDate || !endDate || !isRealDate(startDate) || !isRealDate(endDate) || startDate > endDate) return json({ error: 'Enter a valid unavailable date range.' }, 400);
        if (startDate < londonToday()) return json({ error: 'Unavailable periods must end in the future.' }, 400);
        if ((startTime && !endTime) || (!startTime && endTime) || (startTime && endTime && (!timePattern.test(startTime) || !timePattern.test(endTime) || timeToMinutes(endTime) <= timeToMinutes(startTime)))) return json({ error: 'Add both start and end times, or leave both blank for full days.' }, 400);
        const blackoutInput: BlackoutInput = { startDate, endDate, startTime: startTime || null, endTime: endTime || null, type, label: label || null };
        const blackout = await store.addBlackout(blackoutInput);
        return json({ blackout, message: type === 'holiday' ? 'Holiday added.' : 'Unavailable period added.' }, 201);
      }

      const blackoutMatch = path.match(/^\/api\/admin\/blackouts\/(\d+)$/);
      if (blackoutMatch) {
        if (request.method !== 'DELETE') return methodNotAllowed(['DELETE']);
        if (!sameOrigin(request)) return json({ error: 'Cross-site requests are not accepted.' }, 403);
        const deleted = await store.removeBlackout(Number(blackoutMatch[1]));
        return deleted ? json({ message: 'Unavailable period removed.' }) : json({ error: 'Unavailable period not found.' }, 404);
      }

      const bookingMatch = path.match(/^\/api\/admin\/bookings\/([0-9a-f-]+)$/i);
      if (bookingMatch) {
        if (request.method === 'DELETE') {
          if (!sameOrigin(request)) return json({ error: 'Cross-site requests are not accepted.' }, 403);
          const deleted = await store.deleteBooking(bookingMatch[1]);
          return deleted ? json({ message: 'Booking deleted.' }) : json({ error: 'Booking not found.' }, 404);
        }
        if (request.method !== 'PATCH') return methodNotAllowed(['PATCH', 'DELETE']);
        if (!sameOrigin(request)) return json({ error: 'Cross-site requests are not accepted.' }, 403);
        const input = await body(request);
        const status = typeof input.status === 'string' && bookingStatuses.includes(input.status as BookingStatus) ? input.status as BookingStatus : null;
        const adminNotes = textField(input.adminNotes, 600);
        const slotId = input.slotId === undefined ? undefined : Number(input.slotId);
        if (!status || adminNotes === null || (slotId !== undefined && (!Number.isInteger(slotId) || slotId < 1))) return json({ error: 'Enter a valid booking status, slot, and note.' }, 400);
        const booking = await store.updateBooking(bookingMatch[1], { status, adminNotes: adminNotes || null, slotId });
        return json({ booking, message: 'Booking updated.' });
      }
    }

    return json({ error: 'Not found' }, 404);
  } catch (error) {
    return errorResponse(error);
  }
}