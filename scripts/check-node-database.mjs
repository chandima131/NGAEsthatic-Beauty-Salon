import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createNodeDatabase } from '../server/node-database.mjs';

const directory = await mkdtemp(join(tmpdir(), 'ng-aesthetics-db-'));
const databasePath = join(directory, 'bookings.sqlite');
let database;

try {
  database = createNodeDatabase(databasePath);
  await database.prepare('CREATE TABLE bookings (id TEXT PRIMARY KEY, customer_name TEXT NOT NULL, slot_date TEXT NOT NULL)').run();
  await database.prepare('INSERT INTO bookings (id, customer_name, slot_date) VALUES (?, ?, ?)').bind('persistent-booking', 'Persistent Customer', '2030-01-15').run();
  database.close();

  database = createNodeDatabase(databasePath);
  const booking = await database.prepare('SELECT * FROM bookings WHERE id = ?').bind('persistent-booking').first();
  assert.equal(booking?.customer_name, 'Persistent Customer');
  assert.equal(booking?.slot_date, '2030-01-15');
  database.close();
  database = undefined;

  console.log('PASS: local SQLite bookings survive a database close and reopen.');
} finally {
  try { database?.close(); } catch {}
  await rm(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}
