import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

class NodePreparedStatement {
  constructor(database, query, values = []) {
    this.database = database;
    this.query = query;
    this.values = values;
  }

  bind(...values) {
    return new NodePreparedStatement(this.database, this.query, values);
  }

  async first() {
    return this.database.prepare(this.query).get(...this.values) ?? null;
  }

  async all() {
    return { success: true, results: this.database.prepare(this.query).all(...this.values) };
  }

  executeRun() {
    const result = this.database.prepare(this.query).run(...this.values);
    return {
      success: true,
      meta: {
        changes: Number(result.changes),
        last_row_id: Number(result.lastInsertRowid),
      },
    };
  }

  async run() {
    return this.executeRun();
  }
}

export function createNodeDatabase(path) {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const database = new DatabaseSync(path);
  database.exec('PRAGMA foreign_keys = ON');
  database.exec('PRAGMA journal_mode = WAL');
  database.exec('PRAGMA busy_timeout = 5000');

  return {
    prepare(query) {
      return new NodePreparedStatement(database, query);
    },
    async batch(statements) {
      database.exec('BEGIN IMMEDIATE');
      try {
        const results = statements.map(statement => statement.executeRun());
        database.exec('COMMIT');
        return results;
      } catch (error) {
        database.exec('ROLLBACK');
        throw error;
      }
    },
    close() {
      database.close();
    },
  };
}
