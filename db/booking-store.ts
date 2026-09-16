export type BookingStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';
export type BlackoutType = 'unavailable' | 'holiday';

export type SlotRecord = {
  id: number;
  slot_date: string;
  start_time: string;
  duration_minutes: number;
  status: 'available' | 'unavailable';
  note: string | null;
  created_at: string;
};

export type AvailableSlot = {
  id: string;
  slot_date: string;
  start_time: string;
  duration_minutes: number;
};

export type BlackoutRecord = {
  id: number;
  start_date: string;
  end_date: string;
  start_time: string | null;
  end_time: string | null;
  type: BlackoutType;
  label: string | null;
  created_at: string;
};

export type BookingRecord = {
  id: string;
  slot_id: number;
  customer_name: string;
  phone: string;
  email: string | null;
  treatment: string;
  duration_minutes: number;
  customer_notes: string | null;
  admin_notes: string | null;
  status: BookingStatus;
  created_at: string;
  updated_at: string;
};

export type BookingView = BookingRecord & {
  slot_date: string;
  start_time: string;
};

export type BookingInput = {
  date: string;
  startTime: string;
  durationMinutes: number;
  customerName: string;
  phone: string;
  email: string | null;
  treatment: string;
  customerNotes: string | null;
  adminNotes?: string | null;
  status?: 'pending' | 'confirmed';
};

export type BlackoutInput = {
  startDate: string;
  endDate: string;
  startTime: string | null;
  endTime: string | null;
  type: BlackoutType;
  label: string | null;
};

export type BookingUpdate = {
  status: BookingStatus;
  adminNotes: string | null;
  date?: string;
  startTime?: string;
};

export type AdminOverview = {
  blackouts: BlackoutRecord[];
  bookings: BookingView[];
};

type D1Result<T = unknown> = { success?: boolean; results?: T[]; meta?: Record<string, unknown> };
type D1PreparedStatement = {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  run<T = Record<string, unknown>>(): Promise<D1Result<T>>;
};
export type D1DatabaseLike = {
  prepare(query: string): D1PreparedStatement;
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
};

export class SlotUnavailableError extends Error {
  constructor(message = 'That appointment time is no longer available.') {
    super(message);
    this.name = 'SlotUnavailableError';
  }
}

export class BookingNotFoundError extends Error {
  constructor(message = 'Booking not found.') {
    super(message);
    this.name = 'BookingNotFoundError';
  }
}

export interface BookingStore {
  getAvailability(from: string, to: string, durationMinutes: number): Promise<{ slots: AvailableSlot[]; blackouts: BlackoutRecord[] }>;
  getOverview(from: string, to: string): Promise<AdminOverview>;
  addBlackout(input: BlackoutInput): Promise<BlackoutRecord>;
  removeBlackout(id: number): Promise<boolean>;
  createBooking(input: BookingInput): Promise<BookingView>;
  updateBooking(id: string, input: BookingUpdate): Promise<BookingView>;
  deleteBooking(id: string): Promise<boolean>;
}

const reservingStatuses = new Set<BookingStatus>(['pending', 'confirmed']);
const openingMinutes = 10 * 60;
const closingMinutes = 22 * 60;
const startIntervalMinutes = 30;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

const baseSchemaStatements = [
  "CREATE TABLE IF NOT EXISTS availability_slots (id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, slot_date TEXT NOT NULL, start_time TEXT NOT NULL, duration_minutes INTEGER DEFAULT 60 NOT NULL, status TEXT DEFAULT 'available' NOT NULL, note TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL)",
  'CREATE UNIQUE INDEX IF NOT EXISTS idx_availability_slots_date_time ON availability_slots (slot_date, start_time)',
  'CREATE INDEX IF NOT EXISTS idx_availability_slots_date_status ON availability_slots (slot_date, status)',
  "CREATE TABLE IF NOT EXISTS blackouts (id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, start_date TEXT NOT NULL, end_date TEXT NOT NULL, start_time TEXT, end_time TEXT, type TEXT NOT NULL, label TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL)",
  'CREATE INDEX IF NOT EXISTS idx_blackouts_dates ON blackouts (start_date, end_date)',
  "CREATE TABLE IF NOT EXISTS bookings (id TEXT PRIMARY KEY NOT NULL, slot_id INTEGER NOT NULL, customer_name TEXT NOT NULL, phone TEXT NOT NULL, email TEXT, treatment TEXT NOT NULL, duration_minutes INTEGER DEFAULT 60 NOT NULL, customer_notes TEXT, admin_notes TEXT, status TEXT DEFAULT 'pending' NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL, updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL, FOREIGN KEY (slot_id) REFERENCES availability_slots(id) ON DELETE RESTRICT)",
  'CREATE INDEX IF NOT EXISTS idx_bookings_status_created ON bookings (status, created_at)',
];

const readyByDatabase = new WeakMap<object, Promise<void>>();

function toMinutes(time: string) {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

function toTime(value: number) {
  return String(Math.floor(value / 60)).padStart(2, '0') + ':' + String(value % 60).padStart(2, '0');
}

function isRealDate(value: string) {
  if (!datePattern.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function londonNow() {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date());
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find(part => part.type === type)?.value ?? '';
  return { date: value('year') + '-' + value('month') + '-' + value('day'), time: value('hour') + ':' + value('minute') };
}

function isPastSlot(slot: Pick<AvailableSlot, 'slot_date' | 'start_time'>) {
  const now = londonNow();
  return slot.slot_date < now.date || (slot.slot_date === now.date && slot.start_time <= now.time);
}

function isWorkingTime(date: string, startTime: string, durationMinutes: number) {
  if (!isRealDate(date) || !timePattern.test(startTime) || !Number.isInteger(durationMinutes) || durationMinutes < 15 || durationMinutes > 180) return false;
  const start = toMinutes(startTime);
  return start >= openingMinutes
    && start < closingMinutes
    && (start - openingMinutes) % startIntervalMinutes === 0
    && start + durationMinutes <= closingMinutes;
}

function isBlocked(slot: Pick<AvailableSlot, 'slot_date' | 'start_time' | 'duration_minutes'>, blackout: BlackoutRecord) {
  if (slot.slot_date < blackout.start_date || slot.slot_date > blackout.end_date) return false;
  if (!blackout.start_time || !blackout.end_time) return true;
  const slotStart = toMinutes(slot.start_time);
  const slotEnd = slotStart + slot.duration_minutes;
  return slotStart < toMinutes(blackout.end_time) && slotEnd > toMinutes(blackout.start_time);
}

function overlaps(startTime: string, durationMinutes: number, otherStartTime: string, otherDurationMinutes: number) {
  const start = toMinutes(startTime);
  const otherStart = toMinutes(otherStartTime);
  return start < otherStart + otherDurationMinutes && start + durationMinutes > otherStart;
}

function eachDate(from: string, to: string) {
  const dates: string[] = [];
  const current = new Date(from + 'T12:00:00Z');
  const end = new Date(to + 'T12:00:00Z');
  while (current <= end) {
    dates.push(current.toISOString().slice(0, 10));
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return dates;
}

function regularSlots(from: string, to: string, durationMinutes: number) {
  const slots: AvailableSlot[] = [];
  for (const date of eachDate(from, to)) {
    for (let start = openingMinutes; start + durationMinutes <= closingMinutes; start += startIntervalMinutes) {
      const time = toTime(start);
      slots.push({ id: date + '|' + time, slot_date: date, start_time: time, duration_minutes: durationMinutes });
    }
  }
  return slots;
}

function reservationSegments(date: string, startTime: string, durationMinutes: number) {
  const values: Array<{ date: string; time: string }> = [];
  const start = toMinutes(startTime);
  for (let offset = 0; offset < durationMinutes; offset += startIntervalMinutes) values.push({ date, time: toTime(start + offset) });
  return values;
}

async function ensureDatabase(db: D1DatabaseLike) {
  const key = db as object;
  let ready = readyByDatabase.get(key);
  if (!ready) {
    ready = (async () => {
      await db.batch(baseSchemaStatements.map(statement => db.prepare(statement)));
      const columns = await db.prepare('PRAGMA table_info(bookings)').all<{ name: string }>();
      if (!(columns.results ?? []).some(column => column.name === 'duration_minutes')) {
        await db.prepare('ALTER TABLE bookings ADD COLUMN duration_minutes INTEGER DEFAULT 60 NOT NULL').run();
      }
      await db.batch([
        db.prepare('DROP INDEX IF EXISTS idx_bookings_active_slot'),
        db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_active_slot ON bookings (slot_id) WHERE status IN ('pending', 'confirmed')"),
        db.prepare("CREATE TABLE IF NOT EXISTS booking_segments (booking_id TEXT NOT NULL, slot_date TEXT NOT NULL, segment_time TEXT NOT NULL, PRIMARY KEY (slot_date, segment_time), FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE)"),
        db.prepare('CREATE INDEX IF NOT EXISTS idx_booking_segments_booking ON booking_segments (booking_id)'),
      ]);
      for (const offset of [0, 30, 60, 90, 120, 150]) {
        await db.prepare(`INSERT OR IGNORE INTO booking_segments (booking_id, slot_date, segment_time)
          SELECT b.id, s.slot_date, substr(time(s.start_time, '+${offset} minutes'), 1, 5)
          FROM bookings b JOIN availability_slots s ON s.id = b.slot_id
          WHERE b.status IN ('pending', 'confirmed') AND b.duration_minutes > ?`).bind(offset).run();
      }
      await db.prepare('PRAGMA optimize').run();
    })();
    readyByDatabase.set(key, ready);
  }
  await ready;
}

class D1BookingStore implements BookingStore {
  constructor(private readonly db: D1DatabaseLike) {}

  private async ready() {
    await ensureDatabase(this.db);
  }

  private async all<T>(sql: string, ...values: unknown[]) {
    await this.ready();
    const result = await this.db.prepare(sql).bind(...values).all<T>();
    return result.results ?? [];
  }

  private async first<T>(sql: string, ...values: unknown[]) {
    await this.ready();
    return await this.db.prepare(sql).bind(...values).first<T>();
  }

  async getAvailability(from: string, to: string, durationMinutes: number) {
    const [blackouts, bookings, disabled] = await Promise.all([
      this.all<BlackoutRecord>('SELECT * FROM blackouts WHERE start_date <= ? AND end_date >= ? ORDER BY start_date, start_time', to, from),
      this.all<{ id: string; slot_date: string; start_time: string; duration_minutes: number }>(`SELECT b.id, s.slot_date, s.start_time, b.duration_minutes
        FROM bookings b JOIN availability_slots s ON s.id = b.slot_id
        WHERE s.slot_date BETWEEN ? AND ? AND b.status IN ('pending', 'confirmed')`, from, to),
      this.all<{ slot_date: string; start_time: string }>("SELECT slot_date, start_time FROM availability_slots WHERE slot_date BETWEEN ? AND ? AND status = 'unavailable'", from, to),
    ]);
    const disabledKeys = new Set(disabled.map(slot => slot.slot_date + '|' + slot.start_time));
    return {
      slots: regularSlots(from, to, durationMinutes).filter(slot =>
        !isPastSlot(slot)
        && !disabledKeys.has(slot.id)
        && !blackouts.some(blackout => isBlocked(slot, blackout))
        && !bookings.some(booking => booking.slot_date === slot.slot_date && overlaps(slot.start_time, slot.duration_minutes, booking.start_time, booking.duration_minutes))),
      blackouts,
    };
  }

  async getOverview(from: string, to: string) {
    const [blackouts, bookings] = await Promise.all([
      this.all<BlackoutRecord>('SELECT * FROM blackouts WHERE start_date <= ? AND end_date >= ? ORDER BY start_date, start_time', to, from),
      this.all<BookingView>(`SELECT b.*, s.slot_date, s.start_time
        FROM bookings b JOIN availability_slots s ON s.id = b.slot_id
        WHERE s.slot_date BETWEEN ? AND ?
        ORDER BY s.slot_date, s.start_time, b.created_at`, from, to),
    ]);
    return { blackouts, bookings };
  }

  async addBlackout(input: BlackoutInput) {
    const row = await this.first<BlackoutRecord>(`INSERT INTO blackouts
      (start_date, end_date, start_time, end_time, type, label)
      VALUES (?, ?, ?, ?, ?, ?) RETURNING *`,
      input.startDate, input.endDate, input.startTime, input.endTime, input.type, input.label);
    if (!row) throw new Error('Unable to save the unavailable period.');
    return row;
  }

  async removeBlackout(id: number) {
    await this.ready();
    const result = await this.db.prepare('DELETE FROM blackouts WHERE id = ?').bind(id).run();
    return Number(result.meta?.changes ?? 0) > 0;
  }

  private async getBooking(id: string) {
    return await this.first<BookingView>(`SELECT b.*, s.slot_date, s.start_time
      FROM bookings b JOIN availability_slots s ON s.id = b.slot_id WHERE b.id = ?`, id);
  }

  private async ensureSlot(date: string, startTime: string, durationMinutes: number) {
    const existing = await this.first<SlotRecord>('SELECT * FROM availability_slots WHERE slot_date = ? AND start_time = ?', date, startTime);
    if (existing?.status === 'unavailable') throw new SlotUnavailableError();
    if (existing) return existing;
    const created = await this.first<SlotRecord>(`INSERT INTO availability_slots
      (slot_date, start_time, duration_minutes, status, note)
      VALUES (?, ?, ?, 'available', NULL) RETURNING *`, date, startTime, durationMinutes);
    if (!created) throw new SlotUnavailableError();
    return created;
  }

  private async assertAppointmentAvailable(date: string, startTime: string, durationMinutes: number, exceptBookingId?: string) {
    const candidate: AvailableSlot = { id: date + '|' + startTime, slot_date: date, start_time: startTime, duration_minutes: durationMinutes };
    if (!isWorkingTime(date, startTime, durationMinutes) || isPastSlot(candidate)) throw new SlotUnavailableError('Choose a time between 10:00 and 22:00 that leaves enough time for the treatment.');
    const blackouts = await this.all<BlackoutRecord>('SELECT * FROM blackouts WHERE start_date <= ? AND end_date >= ?', date, date);
    if (blackouts.some(blackout => isBlocked(candidate, blackout))) throw new SlotUnavailableError('That time falls inside an unavailable period.');
    const bookings = await this.all<{ id: string; start_time: string; duration_minutes: number }>(`SELECT b.id, s.start_time, b.duration_minutes
      FROM bookings b JOIN availability_slots s ON s.id = b.slot_id
      WHERE s.slot_date = ? AND b.status IN ('pending', 'confirmed')`, date);
    if (bookings.some(booking => booking.id !== exceptBookingId && overlaps(startTime, durationMinutes, booking.start_time, booking.duration_minutes))) throw new SlotUnavailableError();
  }

  async createBooking(input: BookingInput) {
    await this.assertAppointmentAvailable(input.date, input.startTime, input.durationMinutes);
    const slot = await this.ensureSlot(input.date, input.startTime, input.durationMinutes);
    const id = crypto.randomUUID();
    const statements = [
      this.db.prepare(`INSERT INTO bookings
        (id, slot_id, customer_name, phone, email, treatment, duration_minutes, customer_notes, admin_notes, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(id, slot.id, input.customerName, input.phone, input.email, input.treatment, input.durationMinutes, input.customerNotes, input.adminNotes ?? null, input.status ?? 'pending'),
      ...reservationSegments(input.date, input.startTime, input.durationMinutes)
        .map(segment => this.db.prepare('INSERT INTO booking_segments (booking_id, slot_date, segment_time) VALUES (?, ?, ?)')
          .bind(id, segment.date, segment.time)),
    ];
    try {
      await this.db.batch(statements);
    } catch {
      throw new SlotUnavailableError();
    }
    const booking = await this.getBooking(id);
    if (!booking) throw new Error('Unable to create the booking.');
    return booking;
  }

  async updateBooking(id: string, input: BookingUpdate) {
    const current = await this.getBooking(id);
    if (!current) throw new BookingNotFoundError();
    const date = input.date ?? current.slot_date;
    const startTime = input.startTime ?? current.start_time;
    let slotId = current.slot_id;
    if (reservingStatuses.has(input.status)) {
      await this.assertAppointmentAvailable(date, startTime, current.duration_minutes, id);
      slotId = (await this.ensureSlot(date, startTime, current.duration_minutes)).id;
    } else if (date !== current.slot_date || startTime !== current.start_time) {
      slotId = (await this.ensureSlot(date, startTime, current.duration_minutes)).id;
    }
    const statements = [
      this.db.prepare('DELETE FROM booking_segments WHERE booking_id = ?').bind(id),
      this.db.prepare(`UPDATE bookings
        SET slot_id = ?, status = ?, admin_notes = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?`).bind(slotId, input.status, input.adminNotes, id),
    ];
    if (reservingStatuses.has(input.status)) {
      statements.push(...reservationSegments(date, startTime, current.duration_minutes)
        .map(segment => this.db.prepare('INSERT INTO booking_segments (booking_id, slot_date, segment_time) VALUES (?, ?, ?)')
          .bind(id, segment.date, segment.time)));
    }
    try {
      await this.db.batch(statements);
    } catch {
      throw new SlotUnavailableError();
    }
    const booking = await this.getBooking(id);
    if (!booking) throw new BookingNotFoundError();
    return booking;
  }

  async deleteBooking(id: string) {
    await this.ready();
    const result = await this.db.batch([
      this.db.prepare('DELETE FROM booking_segments WHERE booking_id = ?').bind(id),
      this.db.prepare('DELETE FROM bookings WHERE id = ?').bind(id),
    ]);
    return Number(result[1]?.meta?.changes ?? 0) > 0;
  }
}

class MemoryBookingStore implements BookingStore {
  private slots: SlotRecord[] = [];
  private blackouts: BlackoutRecord[] = [];
  private bookings: BookingRecord[] = [];
  private nextSlotId = 1;
  private nextBlackoutId = 1;

  async getAvailability(from: string, to: string, durationMinutes: number) {
    const blackouts = this.blackouts.filter(item => item.start_date <= to && item.end_date >= from);
    const bookings = this.bookings.flatMap(booking => {
      if (!reservingStatuses.has(booking.status)) return [];
      const slot = this.slots.find(item => item.id === booking.slot_id);
      return slot ? [{ ...booking, slot }] : [];
    });
    return {
      slots: regularSlots(from, to, durationMinutes).filter(slot =>
        !isPastSlot(slot)
        && !blackouts.some(blackout => isBlocked(slot, blackout))
        && !bookings.some(booking => booking.slot.slot_date === slot.slot_date && overlaps(slot.start_time, slot.duration_minutes, booking.slot.start_time, booking.duration_minutes))),
      blackouts,
    };
  }

  async getOverview(from: string, to: string) {
    return {
      blackouts: this.blackouts.filter(item => item.start_date <= to && item.end_date >= from),
      bookings: this.bookings.flatMap(booking => {
        const slot = this.slots.find(item => item.id === booking.slot_id);
        return slot && slot.slot_date >= from && slot.slot_date <= to ? [{ ...booking, slot_date: slot.slot_date, start_time: slot.start_time }] : [];
      }).sort((left, right) => (left.slot_date + left.start_time).localeCompare(right.slot_date + right.start_time)),
    };
  }

  async addBlackout(input: BlackoutInput) {
    const blackout: BlackoutRecord = { id: this.nextBlackoutId++, start_date: input.startDate, end_date: input.endDate, start_time: input.startTime, end_time: input.endTime, type: input.type, label: input.label, created_at: new Date().toISOString() };
    this.blackouts.push(blackout);
    return blackout;
  }

  async removeBlackout(id: number) {
    const before = this.blackouts.length;
    this.blackouts = this.blackouts.filter(item => item.id !== id);
    return before !== this.blackouts.length;
  }

  private ensureSlot(date: string, startTime: string, durationMinutes: number) {
    const existing = this.slots.find(slot => slot.slot_date === date && slot.start_time === startTime);
    if (existing) return existing;
    const slot: SlotRecord = { id: this.nextSlotId++, slot_date: date, start_time: startTime, duration_minutes: durationMinutes, status: 'available', note: null, created_at: new Date().toISOString() };
    this.slots.push(slot);
    return slot;
  }

  private appointmentAvailable(date: string, startTime: string, durationMinutes: number, exceptBookingId?: string) {
    const candidate: AvailableSlot = { id: date + '|' + startTime, slot_date: date, start_time: startTime, duration_minutes: durationMinutes };
    if (!isWorkingTime(date, startTime, durationMinutes) || isPastSlot(candidate)) throw new SlotUnavailableError('Choose a time between 10:00 and 22:00 that leaves enough time for the treatment.');
    if (this.blackouts.some(item => isBlocked(candidate, item))) throw new SlotUnavailableError('That time falls inside an unavailable period.');
    if (this.bookings.some(booking => {
      if (booking.id === exceptBookingId || !reservingStatuses.has(booking.status)) return false;
      const slot = this.slots.find(item => item.id === booking.slot_id);
      return Boolean(slot && slot.slot_date === date && overlaps(startTime, durationMinutes, slot.start_time, booking.duration_minutes));
    })) throw new SlotUnavailableError();
  }

  private view(booking: BookingRecord): BookingView {
    const slot = this.slots.find(item => item.id === booking.slot_id);
    if (!slot) throw new SlotUnavailableError();
    return { ...booking, slot_date: slot.slot_date, start_time: slot.start_time };
  }

  async createBooking(input: BookingInput) {
    this.appointmentAvailable(input.date, input.startTime, input.durationMinutes);
    const slot = this.ensureSlot(input.date, input.startTime, input.durationMinutes);
    const now = new Date().toISOString();
    const booking: BookingRecord = {
      id: crypto.randomUUID(),
      slot_id: slot.id,
      customer_name: input.customerName,
      phone: input.phone,
      email: input.email,
      treatment: input.treatment,
      duration_minutes: input.durationMinutes,
      customer_notes: input.customerNotes,
      admin_notes: input.adminNotes ?? null,
      status: input.status ?? 'pending',
      created_at: now,
      updated_at: now,
    };
    this.bookings.push(booking);
    return this.view(booking);
  }

  async updateBooking(id: string, input: BookingUpdate) {
    const booking = this.bookings.find(item => item.id === id);
    if (!booking) throw new BookingNotFoundError();
    const current = this.view(booking);
    const date = input.date ?? current.slot_date;
    const startTime = input.startTime ?? current.start_time;
    if (reservingStatuses.has(input.status)) this.appointmentAvailable(date, startTime, booking.duration_minutes, id);
    const slot = this.ensureSlot(date, startTime, booking.duration_minutes);
    booking.slot_id = slot.id;
    booking.status = input.status;
    booking.admin_notes = input.adminNotes;
    booking.updated_at = new Date().toISOString();
    return this.view(booking);
  }

  async deleteBooking(id: string) {
    const before = this.bookings.length;
    this.bookings = this.bookings.filter(item => item.id !== id);
    return before !== this.bookings.length;
  }
}

const d1Stores = new WeakMap<object, D1BookingStore>();
const memoryStore = new MemoryBookingStore();

export function getBookingStore(db?: D1DatabaseLike): BookingStore {
  if (!db) return memoryStore;
  const key = db as object;
  let store = d1Stores.get(key);
  if (!store) {
    store = new D1BookingStore(db);
    d1Stores.set(key, store);
  }
  return store;
}
