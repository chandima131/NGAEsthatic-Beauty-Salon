import { sql } from 'drizzle-orm';
import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const availabilitySlots = sqliteTable('availability_slots', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  slotDate: text('slot_date').notNull(),
  startTime: text('start_time').notNull(),
  durationMinutes: integer('duration_minutes').notNull().default(60),
  status: text('status', { enum: ['available', 'unavailable'] }).notNull().default('available'),
  note: text('note'),
  createdAt: text('created_at').notNull().default(sql.raw('CURRENT_TIMESTAMP')),
}, table => [
  uniqueIndex('idx_availability_slots_date_time').on(table.slotDate, table.startTime),
  index('idx_availability_slots_date_status').on(table.slotDate, table.status),
]);

export const blackouts = sqliteTable('blackouts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  startDate: text('start_date').notNull(),
  endDate: text('end_date').notNull(),
  startTime: text('start_time'),
  endTime: text('end_time'),
  type: text('type', { enum: ['unavailable', 'holiday'] }).notNull(),
  label: text('label'),
  createdAt: text('created_at').notNull().default(sql.raw('CURRENT_TIMESTAMP')),
}, table => [
  index('idx_blackouts_dates').on(table.startDate, table.endDate),
]);

export const bookings = sqliteTable('bookings', {
  id: text('id').primaryKey(),
  slotId: integer('slot_id').notNull().references(() => availabilitySlots.id, { onDelete: 'restrict' }),
  customerName: text('customer_name').notNull(),
  phone: text('phone').notNull(),
  email: text('email'),
  treatment: text('treatment').notNull(),
  customerNotes: text('customer_notes'),
  adminNotes: text('admin_notes'),
  status: text('status', { enum: ['pending', 'confirmed', 'completed', 'cancelled', 'no_show'] }).notNull().default('pending'),
  createdAt: text('created_at').notNull().default(sql.raw('CURRENT_TIMESTAMP')),
  updatedAt: text('updated_at').notNull().default(sql.raw('CURRENT_TIMESTAMP')),
}, table => [
  uniqueIndex('idx_bookings_active_slot').on(table.slotId).where(sql.raw('"status" NOT IN (' + "'cancelled', 'no_show'" + ')')),
  index('idx_bookings_status_created').on(table.status, table.createdAt),
]);
