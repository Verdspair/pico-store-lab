import { mkdirSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';

export function openLocalD1(path = ':memory:') {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const sqlite = new DatabaseSync(path);
  sqlite.exec(readFileSync(fileURLToPath(new URL('../migrations/0001_release_tracking.sql', import.meta.url)), 'utf8'));
  const prepare = sql => ({
    bind: (...params) => ({
      sql, params,
      async first() { return sqlite.prepare(sql).get(...params) ?? null; },
      async all() { return { results: sqlite.prepare(sql).all(...params) }; },
      async run() { return sqlite.prepare(sql).run(...params); },
    }),
  });
  return {
    prepare,
    async batch(statements) {
      sqlite.exec('BEGIN');
      try {
        for (const statement of statements) sqlite.prepare(statement.sql).run(...statement.params);
        sqlite.exec('COMMIT');
      } catch (error) {
        sqlite.exec('ROLLBACK');
        throw error;
      }
    },
    close() { sqlite.close(); },
  };
}
