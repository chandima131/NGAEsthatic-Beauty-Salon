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
  customer_notes: string | null;
  admin_notes: string | null;
  status: BookingStatus;
  created_at: string;
  updated_at: string;
};

export type BookingView = BookingRecord & {
  slot_date: string;
  start_time: string;
  duration_minutes: number;
};

export type SlotInput = {
  date: string;
  startTime: string;
  durationMinutes: number;
};

export type BookingInput = {
  slotId: number;
  customerName: string;
  phone: string;
  email: string | null;
  treatment: string;
  customerNotes: string | null;
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
  slotId?: number;
};

export type AdminOverview = {
  slots: SlotRecord[];
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
  getAvailability(from: string, to: string): Promise<{ slots: SlotRecord[]; blackouts: BlackoutRecord[] }>;
  getOverview(from: string, to: string): Promise<AdminOverview>;
  addSlots(slots: SlotInput[]): Promise<number>;
  removeSlot(id: number): Promise<{ deleted: boolean; disabled: boolean }>;
  addBlackout(input: BlackoutInput): Promise<BlackoutRecord>;
  removeBlackout(id: number): Promise<boolean>;
  createBooking(input: BookingInput): Promise<BookingView>;
  updateBooking(id: string, input: BookingUpdate): Promise<BookingView>;
  deleteBooking(id: string): Promise<boolean>;
}

const activeStatuses = new Set<BookingStatus>(['pending', 'confirmed', 'completed']);
const schemaStatements = [
  "CREATE TABLE IF NOT EXISTS availability_slots (id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, slot_date TEXT NOT NULL, start_time TEXT NOT NULL, duration_minutes INTEGER DEFAULT 60 NOT NULL, status TEXT DEFAULT 'available' NOT NULL, note TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL)",
  'CREATE UNIQUE INDEX IF NOT EXISTS idx_availability_slots_date_time ON availability_slots (slot_date, start_time)',
  'CREATE INDEX IF NOT EXISTS idx_availability_slots_date_status ON availability_slots (slot_date, status)',
  "CREATE TABLE IF NOT EXISTS blackouts (id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, start_date TEXT NOT NULL, end_date TEXT NOT NULL, start_time TEXT, end_time TEXT, type TEXT NOT NULL, label TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL)",
  'CREATE INDEX IF NOT EXISTS idx_blackouts_dates ON blackouts (start_date, end_date)',
  "CREATE TABLE IF NOT EXISTS bookings (id TEXT PRIMARY KEY NOT NULL, slot_id INTEGER NOT NULL, customer_name TEXT NOT NULL, phone TEXT NOT NULL, email TEXT, treatment TEXT NOT NULL, customer_notes TEXT, admin_notes TEXT, status TEXT DEFAULT 'pending' NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL, updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL, FOREIGN KEY (slot_id) REFERENCES availability_slots(id) ON DELETE RESTRICT)",
  "CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_active_slot ON bookings (slot_id) WHERE status NOT IN ('cancelled', 'no_show')",
  'CREATE INDEX IF NOT EXISTS idx_bookings_status_created ON bookings (status, created_at)',
];
const readyByDatabase = new WeakMap<object, Promise<void>>();

function toMinutes(time: string) {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
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

function isPastSlot(slot: Pick<SlotRecord, 'slot_date' | 'start_time'>) {
  const now = londonNow();
  return slot.slot_date < now.date || (slot.slot_date === now.date && slot.start_time <= now.time);
}
function isBlocked(slot: Pick<SlotRecord, 'slot_date' | 'start_time' | 'duration_minutes'>, blackout: BlackoutRecord) {
  if (slot.slot_date < blackout.start_date || slot.slot_date > blackout.end_date) return false;
  if (!blackout.start_time || !blackout.end_time) return true;
  const slotStart = toMinutes(slot.start_time);
  const slotEnd = slotStart + slot.duration_minutes;
  return slotStart < toMinutes(blackout.end_time) && slotEnd > toMinutes(blackout.start_time);
}

async function ensureDatabase(db: D1DatabaseLike) {
  const key = db as object;
  let ready = readyByDatabase.get(key);
  if (!ready) {
    ready = (async () => {
      await db.batch(schemaStatements.map(statement => db.prepare(statement)));
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

  async getAvailability(from: string, to: string) {
    const [slots, blackouts, bookedRows] = await Promise.all([
      this.all<SlotRecord>('SELECT * FROM availability_slots WHERE slot_date BETWEEN ? AND ? ORDER BY slot_date, start_time', from, to),
      this.all<BlackoutRecord>('SELECT * FROM blackouts WHERE start_date <= ? AND end_date >= ? ORDER BY start_date, start_time', to, from),
      this.all<{ slot_id: number }>("SELECT slot_id FROM bookings WHERE status IN ('pending', 'confirmed')"),
    ]);
    const booked = new Set(bookedRows.map(row => row.slot_id));
    return {
      slots: slots.filter(slot => slot.status === 'available' && !isPastSlot(slot) && !booked.has(slot.id) && !blackouts.some(blackout => isBlocked(slot, blackout))),
      blackouts,
    };
  }

  async getOverview(from: string, to: string) {
    const [slots, blackouts, bookings] = await Promise.all([
      this.all<SlotRecord>('SELECT * FROM availability_slots WHERE slot_date BETWEEN ? AND ? ORDER BY slot_date, start_time', from, to),
      this.all<BlackoutRecord>('SELECT * FROM blackouts WHERE start_date <= ? AND end_date >= ? ORDER BY start_date, start_time', to, from),
      this.all<BookingView>(`SELECT b.*, s.slot_date, s.start_time, s.duration_minutes
        FROM bookings b JOIN availability_slots s ON s.id = b.slot_id
        WHERE s.slot_date BETWEEN ? AND ?
        ORDER BY s.slot_date, s.start_time, b.created_at`, from, to),
    ]);
    return { slots, blackouts, bookings };
  }

  async addSlots(slots: SlotInput[]) {
    await this.ready();
    await this.db.batch(slots.map(slot => this.db.prepare(`INSERT INTO availability_slots
      (slot_date, start_time, duration_minutes, status, note)
      VALUES (?, ?, ?, 'available', NULL)
      ON CONFLICT(slot_date, start_time) DO UPDATE SET
        duration_minutes = excluded.duration_minutes, status = 'available', note = NULL`)
      .bind(slot.date, slot.startTime, slot.durationMinutes)));
    return slots.length;
  }

  async removeSlot(id: number) {
    await this.ready();
    const booking = await this.first<{ total: number }>('SELECT COUNT(*) AS total FROM bookings WHERE slot_id = ?', id);
    if ((booking?.total ?? 0) > 0) {
      await this.db.prepare("UPDATE availability_slots SET status = 'unavailable' WHERE id = ?").bind(id).run();
      return { deleted: false, disabled: true };
    }
    const result = await this.db.prepare('DELETE FROM availability_slots WHERE id = ?').bind(id).run();
    return { deleted: Number(result.meta?.changes ?? 0) > 0, disabled: false };
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
    return await this.first<BookingView>(`SELECT b.*, s.slot_date, s.start_time, s.duration_minutes
      FROM bookings b JOIN availability_slots s ON s.id = b.slot_id WHERE b.id = ?`, id);
  }

  private async assertSlotAvailable(slotId: number, exceptBookingId?: string) {
    const slot = await this.first<SlotRecord>('SELECT * FROM availability_slots WHERE id = ?', slotId);
    if (!slot || slot.status !== 'available' || isPastSlot(slot)) throw new SlotUnavailableError();
    const blackouts = await this.all<BlackoutRecord>('SELECT * FROM blackouts WHERE start_date <= ? AND end_date >= ?', slot.slot_date, slot.slot_date);
    if (blackouts.some(blackout => isBlocked(slot, blackout))) throw new SlotUnavailableError('That time falls inside an unavailable period.');
    const existing = await this.first<{ id: string }>(
      `SELECT id FROM bookings WHERE slot_id = ? AND status IN ('pending', 'confirmed')${exceptBookingId ? ' AND id != ?' : ''}`,
      ...[slotId, ...(exceptBookingId ? [exceptBookingId] : [])],
    );
    if (existing) throw new SlotUnavailableError();
    return slot;
  }

  async createBooking(input: BookingInput) {
    await this.assertSlotAvailable(input.slotId);
    const id = crypto.randomUUID();
    try {
      await this.db.prepare(`INSERT INTO bookings
        (id, slot_id, customer_name, phone, email, treatment, customer_notes)
        VALUES (?, ?, ?, ?, ?, ?, ?)`)
        .bind(id, input.slotId, input.customerName, input.phone, input.email, input.treatment, input.customerNotes).run();
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
    const slotId = input.slotId ?? current.slot_id;
    if (activeStatuses.has(input.status)) await this.assertSlotAvailable(slotId, id);
    try {
      await this.db.prepare(`UPDATE bookings
        SET slot_id = ?, status = ?, admin_notes = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?`).bind(slotId, input.status, input.adminNotes, id).run();
    } catch {
      throw new SlotUnavailableError();
    }
    const booking = await this.getBooking(id);
    if (!booking) throw new BookingNotFoundError();
    return booking;
  }

  async deleteBooking(id: string) {
    await this.ready();
    const result = await this.db.prepare('DELETE FROM bookings WHERE id = ?').bind(id).run();
    return Number(result.meta?.changes ?? 0) > 0;
  }
}

class MemoryBookingStore implements BookingStore {
  private slots: SlotRecord[] = [];
  private blackouts: BlackoutRecord[] = [];
  private bookings: BookingRecord[] = [];
  private nextSlotId = 1;
  private nextBlackoutId = 1;

  async getAvailability(from: string, to: string) {
    const blackouts = this.blackouts.filter(item => item.start_date <= to && item.end_date >= from);
    const booked = new Set(this.bookings.filter(item => activeStatuses.has(item.status)).map(item => item.slot_id));
    return {
      slots: this.slots.filter(slot => slot.slot_date >= from && slot.slot_date <= to && slot.status === 'available' && !isPastSlot(slot) && !booked.has(slot.id) && !blackouts.some(blackout => isBlocked(slot, blackout))),
      blackouts,
    };
  }

  async getOverview(from: string, to: string) {
    return {
      slots: this.slots.filter(slot => slot.slot_date >= from && slot.slot_date <= to).sort((a, b) => (a.slot_date + a.start_time).localeCompare(b.slot_date + b.start_time)),
      blackouts: this.blackouts.filter(item => item.start_date <= to && item.end_date >= from),
      bookings: this.bookings.flatMap(booking => {
        const slot = this.slots.find(item => item.id === booking.slot_id);
        return slot && slot.slot_date >= from && slot.slot_date <= to ? [{ ...booking, slot_date: slot.slot_date, start_time: slot.start_time, duration_minutes: slot.duration_minutes }] : [];
      }).sort((a, b) => (a.slot_date + a.start_time).localeCompare(b.slot_date + b.start_time)),
    };
  }

  async addSlots(inputs: SlotInput[]) {
    for (const input of inputs) {
      const existing = this.slots.find(slot => slot.slot_date === input.date && slot.start_time === input.startTime);
      if (existing) {
        existing.duration_minutes = input.durationMinutes;
        existing.status = 'available';
        existing.note = null;
      } else {
        this.slots.push({ id: this.nextSlotId++, slot_date: input.date, start_time: input.startTime, duration_minutes: input.durationMinutes, status: 'available', note: null, created_at: new Date().toISOString() });
      }
    }
    return inputs.length;
  }

  async removeSlot(id: number) {
    if (this.bookings.some(booking => booking.slot_id === id)) {
      const slot = this.slots.find(item => item.id === id);
      if (slot) slot.status = 'unavailable';
      return { deleted: false, disabled: true };
    }
    const before = this.slots.length;
    this.slots = this.slots.filter(slot => slot.id !== id);
    return { deleted: before !== this.slots.length, disabled: false };
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

  private slotAvailable(slotId: number, exceptBookingId?: string) {
    const slot = this.slots.find(item => item.id === slotId);
    if (!slot || slot.status !== 'available' || isPastSlot(slot) || this.blackouts.some(item => isBlocked(slot, item))) throw new SlotUnavailableError();
    if (this.bookings.some(item => item.slot_id === slotId && item.id !== exceptBookingId && activeStatuses.has(item.status))) throw new SlotUnavailableError();
    return slot;
  }

  private view(booking: BookingRecord): BookingView {
    const slot = this.slots.find(item => item.id === booking.slot_id);
    if (!slot) throw new SlotUnavailableError();
    return { ...booking, slot_date: slot.slot_date, start_time: slot.start_time, duration_minutes: slot.duration_minutes };
  }

  async createBooking(input: BookingInput) {
    this.slotAvailable(input.slotId);
    const now = new Date().toISOString();
    const booking: BookingRecord = { id: crypto.randomUUID(), slot_id: input.slotId, customer_name: input.customerName, phone: input.phone, email: input.email, treatment: input.treatment, customer_notes: input.customerNotes, admin_notes: null, status: 'pending', created_at: now, updated_at: now };
    this.bookings.push(booking);
    return this.view(booking);
  }

  async updateBooking(id: string, input: BookingUpdate) {
    const booking = this.bookings.find(item => item.id === id);
    if (!booking) throw new BookingNotFoundError();
    const slotId = input.slotId ?? booking.slot_id;
    if (activeStatuses.has(input.status)) this.slotAvailable(slotId, id);
    booking.slot_id = slotId;
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