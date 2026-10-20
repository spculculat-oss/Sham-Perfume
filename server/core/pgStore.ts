/**
 * Postgres adapter for Sham Core (and so «بنك شام»): the SAME database the community already uses
 * (Neon from Vercel → Storage, or any Postgres URL). One key/value table, one JSON document per entity,
 * so the domain schema can evolve without migrations. `create` is an atomic INSERT … ON CONFLICT DO NOTHING,
 * which keeps the append-only ledger replay-safe across serverless instances.
 */
import type { CollectionName, Collections } from './types';
import type { Store } from './store';
import type { Sql } from '../community/db';

export const PG_STORE_TABLE = 'sham_store';

export class PostgresStore implements Store {
  readonly kind = 'postgres' as const;
  readonly persistent = true;
  private ready?: Promise<Sql>;

  /** `connect` is lazy: the first request opens the pool and creates the table once. */
  constructor(private connect: () => Promise<Sql>) {}

  private db(): Promise<Sql> {
    this.ready ||= (async () => {
      const sql = await this.connect();
      await sql.query(`CREATE TABLE IF NOT EXISTS ${PG_STORE_TABLE} (
        collection text NOT NULL,
        id text NOT NULL,
        value jsonb NOT NULL,
        updated_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (collection, id)
      )`);
      return sql;
    })().catch((error) => { this.ready = undefined; throw error; }); // retry on the next request
    return this.ready;
  }

  private static parse<T>(value: unknown): T {
    return (typeof value === 'string' ? JSON.parse(value) : value) as T;
  }

  async get<C extends CollectionName>(collection: C, id: string) {
    const rows = await (await this.db()).query(`SELECT value FROM ${PG_STORE_TABLE} WHERE collection = $1 AND id = $2`, [collection, id]);
    return rows[0] ? PostgresStore.parse<Collections[C]>(rows[0].value) : undefined;
  }
  async list<C extends CollectionName>(collection: C) {
    const rows = await (await this.db()).query(`SELECT value FROM ${PG_STORE_TABLE} WHERE collection = $1 ORDER BY id`, [collection]);
    return rows.map((r) => PostgresStore.parse<Collections[C]>(r.value));
  }
  async put<C extends CollectionName>(collection: C, id: string, value: Collections[C]) {
    await (await this.db()).query(
      `INSERT INTO ${PG_STORE_TABLE} (collection, id, value) VALUES ($1, $2, $3::jsonb)
       ON CONFLICT (collection, id) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
      [collection, id, JSON.stringify(value)],
    );
  }
  async create<C extends CollectionName>(collection: C, id: string, value: Collections[C]) {
    const rows = await (await this.db()).query(
      `INSERT INTO ${PG_STORE_TABLE} (collection, id, value) VALUES ($1, $2, $3::jsonb) ON CONFLICT (collection, id) DO NOTHING RETURNING id`,
      [collection, id, JSON.stringify(value)],
    );
    return rows.length > 0;
  }
  async delete(collection: CollectionName, id: string) {
    const rows = await (await this.db()).query(`DELETE FROM ${PG_STORE_TABLE} WHERE collection = $1 AND id = $2 RETURNING id`, [collection, id]);
    return rows.length > 0;
  }
}
