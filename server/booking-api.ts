import { categories } from '../lib/services';
import {
  BookingNotFoundError,
  SlotUnavailableError,
  getBookingStore,
  type BlackoutInput,
  type BookingStatus,
  type D1DatabaseLike,
} from '../db/booking-store';
import {
  clearAdminSessionCookie,
  createAdminSessionCookie,
  isAdminAuthConfigured,
  verifyAdminPassword,
  verifyAdminSession,
  type AdminAuthEnvironment,
} from './admin-auth';

export type BookingEnvironment = AdminAuthEnvironment & {
  DB?: D1DatabaseLike;
};

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const bookingStatuses: BookingStatus[] = ['pending', 'confirmed', 'completed', 'cancelled', 'no_show'];
const treatmentsByName = new Map(categories.flatMap(category => category.treatments.map(treatment => [treatment.name, treatment] as const)));

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

async function requireAdmin(request: Request, env: BookingEnvironment) {
  const state = await verifyAdminSession(request, env);
  if (state === 'unconfigured') return json({ error: 'admin_not_configured' }, 503);
  if (state !== 'authenticated') return json({ error: 'signin_required' }, 401);
  return null;
}

const loginAttempts = new Map<string, { failures: number; resetAt: number }>();

function loginKey(request: Request) {
  return request.headers.get('cf-connecting-ip') ?? request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local';
}

function loginRateLimited(request: Request) {
  const key = loginKey(request);
  const entry = loginAttempts.get(key);
  if (!entry || entry.resetAt <= Date.now()) {
    loginAttempts.delete(key);
    return false;
  }
  return entry.failures >= 8;
}

function recordLoginFailure(request: Request) {
  const key = loginKey(request);
  const entry = loginAttempts.get(key);
  loginAttempts.set(key, !entry || entry.resetAt <= Date.now()
    ? { failures: 1, resetAt: Date.now() + 15 * 60 * 1000 }
    : { ...entry, failures: entry.failures + 1 });
}

function clearLoginFailures(request: Request) {
  loginAttempts.delete(loginKey(request));
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
      const treatmentName = url.searchParams.get('treatment')?.trim() ?? '';
      const treatment = treatmentsByName.get(treatmentName);
      const range = monthRange(month);
      if (!range) return json({ error: 'Use a valid month in YYYY-MM format.' }, 400);
      if (!treatment) return json({ error: 'Choose a treatment to see its available times.' }, 400);
      const availability = await store.getAvailability(range.from, range.to, treatment.durationMinutes);
      return json({
        month,
        treatment: treatment.name,
        durationMinutes: treatment.durationMinutes,
        openingHours: { days: 'Monday to Sunday', opens: '10:00', closes: '22:00' },
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
      const slotId = textField(input.slotId, 20, true);
      const customerName = textField(input.customerName, 80, true);
      const phone = textField(input.phone, 30, true);
      const email = textField(input.email, 120);
      const treatmentName = textField(input.treatment, 120, true);
      const customerNotes = textField(input.customerNotes, 500);
      const [date, startTime, extra] = slotId?.split('|') ?? [];
      const treatment = treatmentName ? treatmentsByName.get(treatmentName) : undefined;
      if (!slotId || extra !== undefined || !date || !startTime || !customerName || !phone || !treatment || input.consent !== true) return json({ error: 'Complete all required booking details.' }, 400);
      if (!isRealDate(date) || !timePattern.test(startTime)) return json({ error: 'Choose a valid appointment time.' }, 400);
      if (!/^[0-9+() .-]{6,30}$/.test(phone)) return json({ error: 'Enter a valid phone number.' }, 400);
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: 'Enter a valid email address.' }, 400);
      const booking = await store.createBooking({
        date,
        startTime,
        durationMinutes: treatment.durationMinutes,
        customerName,
        phone,
        email: email || null,
        treatment: treatment.name,
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

    if (path === '/api/admin/login') {
      if (request.method !== 'POST') return methodNotAllowed(['POST']);
      if (!sameOrigin(request)) return json({ error: 'Cross-site requests are not accepted.' }, 403);
      if (!isAdminAuthConfigured(env)) return json({ error: 'admin_not_configured' }, 503);
      if (loginRateLimited(request)) return json({ error: 'Too many sign-in attempts. Try again in 15 minutes.' }, 429, { 'Retry-After': '900' });
      const input = await body(request);
      const password = typeof input.password === 'string' ? input.password : '';
      if (!(await verifyAdminPassword(password, env.ADMIN_PASSWORD_HASH))) {
        recordLoginFailure(request);
        return json({ error: 'Incorrect password.' }, 401);
      }
      clearLoginFailures(request);
      return json({ authenticated: true }, 200, { 'Set-Cookie': await createAdminSessionCookie(request, env) });
    }

    if (path === '/api/admin/logout') {
      if (request.method !== 'POST') return methodNotAllowed(['POST']);
      if (!sameOrigin(request)) return json({ error: 'Cross-site requests are not accepted.' }, 403);
      return json({ authenticated: false }, 200, { 'Set-Cookie': clearAdminSessionCookie(request) });
    }

    if (path.startsWith('/api/admin/')) {
      const adminError = await requireAdmin(request, env);
      if (adminError) return adminError;

      if (path === '/api/admin/bookings') {
        if (request.method !== 'POST') return methodNotAllowed(['POST']);
        if (!sameOrigin(request)) return json({ error: 'Cross-site requests are not accepted.' }, 403);
        const input = await body(request);
        const customerName = textField(input.customerName, 80, true);
        const phone = textField(input.phone, 30, true);
        const email = textField(input.email, 120);
        const treatmentName = textField(input.treatment, 120, true);
        const date = textField(input.date, 10, true);
        const startTime = textField(input.startTime, 5, true);
        const adminNotes = textField(input.adminNotes, 600);
        const treatment = treatmentName ? treatmentsByName.get(treatmentName) : undefined;
        if (!customerName || !phone || !treatment || !date || !isRealDate(date) || !startTime || !timePattern.test(startTime) || adminNotes === null) return json({ error: 'Complete the customer, treatment, date, and time.' }, 400);
        if (!/^[0-9+() .-]{6,30}$/.test(phone)) return json({ error: 'Enter a valid phone number.' }, 400);
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: 'Enter a valid email address.' }, 400);
        const booking = await store.createBooking({
          date,
          startTime,
          durationMinutes: treatment.durationMinutes,
          customerName,
          phone,
          email: email || null,
          treatment: treatment.name,
          customerNotes: null,
          adminNotes: adminNotes || 'Booked directly by the salon.',
          status: 'confirmed',
        });
        return json({ booking, message: 'Manual booking added and confirmed.' }, 201);
      }

      if (path === '/api/admin/overview') {
        if (request.method !== 'GET') return methodNotAllowed(['GET']);
        const defaultFrom = londonToday();
        const defaultToDate = new Date(defaultFrom + 'T12:00:00Z');
        defaultToDate.setUTCFullYear(defaultToDate.getUTCFullYear() + 1);
        const range = validRange(url.searchParams.get('from') ?? defaultFrom, url.searchParams.get('to') ?? defaultToDate.toISOString().slice(0, 10));
        if (!range) return json({ error: 'Use valid from and to dates.' }, 400);
        return json({ admin: { authenticated: true }, ...(await store.getOverview(range.from, range.to)) });
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
        const date = input.date === undefined ? undefined : textField(input.date, 10, true);
        const startTime = input.startTime === undefined ? undefined : textField(input.startTime, 5, true);
        if (!status || adminNotes === null || (date !== undefined && (!date || !isRealDate(date))) || (startTime !== undefined && (!startTime || !timePattern.test(startTime)))) return json({ error: 'Enter a valid booking status, appointment time, and note.' }, 400);
        const booking = await store.updateBooking(bookingMatch[1], { status, adminNotes: adminNotes || null, date, startTime });
        return json({ booking, message: 'Booking updated.' });
      }
    }

    return json({ error: 'Not found' }, 404);
  } catch (error) {
    return errorResponse(error);
  }
}