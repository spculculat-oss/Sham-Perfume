import { randomBytes } from 'node:crypto';
/**
 * «مجتمع شام» — PostgreSQL. Production: any Postgres URL (Neon from the Vercel dashboard → Storage, or
 * Supabase) in `DATABASE_URL` / `POSTGRES_URL` / `SHAM_DATABASE_URL`. Tests and local dev: PGlite (the real
 * Postgres engine compiled to WebAssembly), so the same SQL is exercised everywhere.
 */
export type Row = Record<string, any>;

export interface Sql {
  query<T extends Row = Row>(text: string, params?: unknown[]): Promise<T[]>;
  /** Runs `fn` in one transaction (all or nothing). */
  tx<T>(fn: (sql: Sql) => Promise<T>): Promise<T>;
  close(): Promise<void>;
  readonly kind: 'postgres' | 'pglite';
}

type Env = Record<string, string | undefined>;
const isPostgresUrl = (v?: string) => /^postgres(ql)?:\/\/\S+$/i.test((v || '').trim());
/** Pooled URLs first (best for serverless), then direct ones. */
const DB_SUFFIXES = ['DATABASE_URL', 'POSTGRES_URL', 'POSTGRES_PRISMA_URL', 'DATABASE_URL_UNPOOLED', 'POSTGRES_URL_NON_POOLING', 'POSTGRES_URL_NO_SSL'];

/**
 * Finds the database whatever the dashboard named it: the plain names, names with a custom prefix
 * (Vercel → Storage → Connect can add one, e.g. `STORAGE_DATABASE_URL`), Neon's PGHOST/PGUSER/… parts,
 * or any variable holding a postgres:// URL. Returns the variable's name too (never shown with its value).
 */
export function findDatabase(env: Env): { url: string; name?: string } {
  for (const name of ['SHAM_DATABASE_URL', 'DATABASE_URL', 'POSTGRES_URL']) {
    const v = env[name]?.trim();
    if (v) return { url: v, name };
  }
  const keys = Object.keys(env).sort();
  for (const suffix of DB_SUFFIXES) {
    const name = keys.find((k) => (k === suffix || k.endsWith(`_${suffix}`)) && isPostgresUrl(env[k]));
    if (name) return { url: env[name]!.trim(), name };
  }
  for (const k of keys.filter((k) => k === 'PGHOST' || k.endsWith('_PGHOST'))) {
    const pre = k.slice(0, -'PGHOST'.length);
    const [host, user, pass, db] = ['PGHOST', 'PGUSER', 'PGPASSWORD', 'PGDATABASE'].map((n) => env[pre + n]?.trim());
    if (host && user && pass && db) return { url: `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(pass)}@${host}/${encodeURIComponent(db)}?sslmode=require`, name: `${pre}PGHOST…` };
  }
  const name = keys.find((k) => isPostgresUrl(env[k]));
  return name ? { url: env[name]!.trim(), name } : { url: '' };
}
export const databaseUrl = (env: Env) => findDatabase(env).url;
/** Names (only) of the settings that look database-related — shown by /api/community/status when none works. */
export const databaseHints = (env: Env) => Object.keys(env).filter((k) => /DATABASE|POSTGRES|NEON|(^|_)PG[A-Z]/i.test(k)).sort().slice(0, 20);
/** A connection failure, in words the admin can act on (no hosts or secrets). */
export function databaseErrorKind(error: unknown): 'auth' | 'network' | 'ssl' | 'other' {
  const m = String((error as any)?.code || '') + ' ' + (error instanceof Error ? error.message : String(error));
  if (/password|authentication|28P01|28000|role .* does not exist/i.test(m)) return 'auth';
  if (/ENOTFOUND|ECONNREFUSED|ETIMEDOUT|EAI_AGAIN|timeout|getaddrinfo|ECONNRESET/i.test(m)) return 'network';
  if (/ssl|tls|certificate/i.test(m)) return 'ssl';
  return 'other';
}

/** Postgres over TCP (the `postgres` driver: pure JS, works in Vercel functions). */
export async function connectPostgres(url: string): Promise<Sql> {
  const { default: postgres } = await import('postgres');
  const client = postgres(url, {
    max: 3, idle_timeout: 20, connect_timeout: 10, prepare: false, // prepare:false = safe behind poolers (Neon, Supabase)
    ssl: /localhost|127\.0\.0\.1/.test(url) ? false : 'require', onnotice: () => {},
    types: { bigint: postgres.BigInt },
  });
  const wrap = (c: any): Sql => ({
    kind: 'postgres',
    query: async (text, params = []) => [...await c.unsafe(text, params as any[])] as any[],
    tx: (fn) => client.begin((t: any) => fn(wrap(t))) as any,
    close: () => client.end({ timeout: 5 }),
  });
  return wrap(client);
}

/** PGlite (in-memory, or a folder for local dev). Loaded by name so production bundles never include it. */
export async function connectPglite(dataDir?: string): Promise<Sql> {
  const name = '@electric-sql/pglite';
  const { PGlite } = await import(/* @vite-ignore */ name);
  const db = new PGlite(dataDir);
  const wrap = (c: any, inTx = false): Sql => ({
    kind: 'pglite',
    query: async (text, params = []) => (await c.query(text, params)).rows,
    tx: (fn) => (inTx ? fn(wrap(c, true)) : db.transaction((t: any) => fn(wrap(t, true)))),
    close: () => (inTx ? Promise.resolve() : db.close()),
  });
  return wrap(db);
}

export const SCHEMA_VERSION = 2;

export const SCHEMA: string[] = [
  `CREATE TABLE IF NOT EXISTS community_meta (key text PRIMARY KEY, value text NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS users (
    id text PRIMARY KEY,
    handle text UNIQUE NOT NULL,
    name text NOT NULL,
    email_idx text UNIQUE NOT NULL,
    email_enc text NOT NULL,
    pass_hash text NOT NULL,
    role text NOT NULL DEFAULT 'user',
    status text NOT NULL DEFAULT 'active',
    country text NOT NULL DEFAULT '',
    lang text NOT NULL DEFAULT 'ar',
    craft_level text NOT NULL DEFAULT 'hobbyist',
    bio text NOT NULL DEFAULT '',
    avatar text,
    private_enc text,
    created_at timestamptz NOT NULL DEFAULT now(),
    last_seen timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS users_name ON users (lower(name))`,
  `CREATE TABLE IF NOT EXISTS sessions (
    hash text PRIMARY KEY,
    user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    agent text NOT NULL DEFAULT '',
    created_at timestamptz NOT NULL DEFAULT now(),
    expires_at timestamptz NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS sessions_user ON sessions (user_id)`,
  /* v2 — account security (the Google/Apple/Meta study, see SHAM_AUTH.md): the e-mail-verified flag,
     per-account lockout counters, the encrypted TOTP secret, session devices (ip + last use), one-time
     auth codes and the short-lived pending two-factor logins. */
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at timestamptz`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_logins int NOT NULL DEFAULT 0`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_until timestamptz`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_secret_enc text`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_enabled boolean NOT NULL DEFAULT false`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_last text NOT NULL DEFAULT ''`,
  `ALTER TABLE sessions ADD COLUMN IF NOT EXISTS ip text NOT NULL DEFAULT ''`,
  `ALTER TABLE sessions ADD COLUMN IF NOT EXISTS last_used_at timestamptz NOT NULL DEFAULT now()`,
  `CREATE TABLE IF NOT EXISTS auth_codes (
    id text PRIMARY KEY,
    user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    purpose text NOT NULL,
    code_salt text NOT NULL,
    code_hash text NOT NULL,
    expires_at timestamptz NOT NULL,
    used_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS auth_codes_user ON auth_codes (user_id, purpose, created_at)`,
  `CREATE TABLE IF NOT EXISTS pending_logins (
    token_hash text PRIMARY KEY,
    user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    agent text NOT NULL DEFAULT '',
    ip text NOT NULL DEFAULT '',
    expires_at timestamptz NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS merchants (
    user_id text PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    slug text UNIQUE NOT NULL,
    store_name text NOT NULL,
    about text NOT NULL DEFAULT '',
    logo text,
    country text NOT NULL DEFAULT '',
    currency text NOT NULL DEFAULT 'EGP',
    status text NOT NULL DEFAULT 'pending',
    legal_enc text,
    payout_enc text,
    admin_note text NOT NULL DEFAULT '',
    created_at timestamptz NOT NULL DEFAULT now(),
    reviewed_at timestamptz
  )`,
  `CREATE TABLE IF NOT EXISTS merchant_products (
    id text PRIMARY KEY,
    merchant_id text NOT NULL REFERENCES merchants(user_id) ON DELETE CASCADE,
    name text NOT NULL,
    description text NOT NULL DEFAULT '',
    category text NOT NULL DEFAULT 'perfume',
    images jsonb NOT NULL DEFAULT '[]',
    price double precision NOT NULL,
    currency text NOT NULL,
    stock integer NOT NULL DEFAULT 0,
    source_enc text,
    status text NOT NULL DEFAULT 'pending',
    review_note text NOT NULL DEFAULT '',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS products_merchant ON merchant_products (merchant_id)`,
  `CREATE INDEX IF NOT EXISTS products_status ON merchant_products (status)`,
  `CREATE TABLE IF NOT EXISTS orders (
    id text PRIMARY KEY,
    number text UNIQUE NOT NULL,
    buyer_id text REFERENCES users(id) ON DELETE SET NULL,
    merchant_id text REFERENCES merchants(user_id) ON DELETE SET NULL,
    items jsonb NOT NULL,
    merchant_total double precision NOT NULL DEFAULT 0,
    merchant_currency text NOT NULL DEFAULT 'EGP',
    margin_egp double precision NOT NULL DEFAULT 0,
    shipping_usd double precision NOT NULL DEFAULT 0,
    total_charged double precision NOT NULL DEFAULT 0,
    charge_currency text NOT NULL DEFAULT 'EGP',
    country text NOT NULL DEFAULT '',
    address_enc text,
    status text NOT NULL DEFAULT 'awaiting_payment',
    payment_ref text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS orders_buyer ON orders (buyer_id)`,
  `CREATE INDEX IF NOT EXISTS orders_merchant ON orders (merchant_id)`,
  `CREATE INDEX IF NOT EXISTS orders_ref ON orders (payment_ref)`,
  `CREATE TABLE IF NOT EXISTS recipes (
    id text PRIMARY KEY,
    user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title text NOT NULL,
    data jsonb NOT NULL DEFAULT '{}',
    notes text NOT NULL DEFAULT '',
    visibility text NOT NULL DEFAULT 'private',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS recipes_user ON recipes (user_id)`,
  `CREATE TABLE IF NOT EXISTS learning (
    user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    item_id text NOT NULL,
    kind text NOT NULL DEFAULT 'lesson',
    title text NOT NULL DEFAULT '',
    progress integer NOT NULL DEFAULT 0,
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, item_id)
  )`,
  `CREATE TABLE IF NOT EXISTS posts (
    id text PRIMARY KEY,
    author_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    body text NOT NULL DEFAULT '',
    image text,
    recipe_id text REFERENCES recipes(id) ON DELETE SET NULL,
    visibility text NOT NULL DEFAULT 'public',
    status text NOT NULL DEFAULT 'visible',
    created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    edited_at timestamptz
  )`,
  `CREATE INDEX IF NOT EXISTS posts_created ON posts (created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS posts_author ON posts (author_id, created_at DESC)`,
  `CREATE TABLE IF NOT EXISTS reactions (
    post_id text NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kind text NOT NULL,
    PRIMARY KEY (post_id, user_id)
  )`,
  `CREATE TABLE IF NOT EXISTS comments (
    id text PRIMARY KEY,
    post_id text NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    author_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    body text NOT NULL,
    status text NOT NULL DEFAULT 'visible',
    created_at timestamptz NOT NULL DEFAULT clock_timestamp()
  )`,
  `CREATE INDEX IF NOT EXISTS comments_post ON comments (post_id, created_at)`,
  `CREATE TABLE IF NOT EXISTS friendships (
    user_a text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user_b text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    requester text NOT NULL,
    status text NOT NULL DEFAULT 'pending',
    created_at timestamptz NOT NULL DEFAULT now(),
    accepted_at timestamptz,
    PRIMARY KEY (user_a, user_b),
    CHECK (user_a < user_b)
  )`,
  `CREATE INDEX IF NOT EXISTS friendships_b ON friendships (user_b)`,
  `CREATE TABLE IF NOT EXISTS blocks (
    blocker text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    blocked text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (blocker, blocked)
  )`,
  `CREATE TABLE IF NOT EXISTS conversations (
    id text PRIMARY KEY,
    kind text NOT NULL DEFAULT 'direct',
    title text NOT NULL DEFAULT '',
    direct_key text UNIQUE,
    created_by text REFERENCES users(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    last_at timestamptz NOT NULL DEFAULT clock_timestamp()
  )`,
  `CREATE TABLE IF NOT EXISTS members (
    conversation_id text NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role text NOT NULL DEFAULT 'member',
    joined_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    last_read_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    muted boolean NOT NULL DEFAULT false,
    typing_until timestamptz,
    left_at timestamptz,
    PRIMARY KEY (conversation_id, user_id)
  )`,
  `CREATE INDEX IF NOT EXISTS members_user ON members (user_id)`,
  `CREATE TABLE IF NOT EXISTS messages (
    id text PRIMARY KEY,
    conversation_id text NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id text REFERENCES users(id) ON DELETE SET NULL,
    kind text NOT NULL DEFAULT 'text',
    body_enc text,
    attachment_enc text,
    reply_to text,
    created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    edited_at timestamptz,
    deleted_at timestamptz,
    touched_at timestamptz NOT NULL DEFAULT clock_timestamp()
  )`,
  `CREATE INDEX IF NOT EXISTS messages_conv ON messages (conversation_id, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS messages_touched ON messages (conversation_id, touched_at)`,
  `CREATE TABLE IF NOT EXISTS message_reactions (
    message_id text NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    emoji text NOT NULL,
    PRIMARY KEY (message_id, user_id)
  )`,
  `CREATE TABLE IF NOT EXISTS notifications (
    id text PRIMARY KEY,
    user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kind text NOT NULL,
    actor_id text REFERENCES users(id) ON DELETE CASCADE,
    ref text NOT NULL DEFAULT '',
    created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    read_at timestamptz
  )`,
  `CREATE INDEX IF NOT EXISTS notifications_user ON notifications (user_id, created_at DESC)`,
  `CREATE TABLE IF NOT EXISTS reports (
    id text PRIMARY KEY,
    reporter_id text REFERENCES users(id) ON DELETE SET NULL,
    target_kind text NOT NULL,
    target_id text NOT NULL,
    reason text NOT NULL DEFAULT '',
    status text NOT NULL DEFAULT 'open',
    admin_note text NOT NULL DEFAULT '',
    created_at timestamptz NOT NULL DEFAULT now(),
    resolved_at timestamptz
  )`,
  `CREATE TABLE IF NOT EXISTS audit (
    id bigserial PRIMARY KEY,
    actor text NOT NULL,
    action text NOT NULL,
    target text NOT NULL DEFAULT '',
    detail text NOT NULL DEFAULT '',
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
];

/** Creates the tables (idempotent) and records the schema version. */
export async function migrate(sql: Sql): Promise<void> {
  const [done] = await sql.query(`SELECT to_regclass('community_meta') AS t`).catch(() => [{ t: null }]);
  if (done?.t) {
    const [row] = await sql.query(`SELECT value FROM community_meta WHERE key = 'schema'`);
    if (Number(row?.value) >= SCHEMA_VERSION) return;
  }
  await sql.tx(async (t) => {
    for (const statement of SCHEMA) await t.query(statement);
    await t.query(`INSERT INTO community_meta (key, value) VALUES ('schema', $1) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`, [String(SCHEMA_VERSION)]);
  });
}

/**
 * The encryption key of members' private data (envelope encryption).
 *
 *  - No SHAM_DATA_KEY: the server creates a random data key on first start and keeps it in `community_meta`
 *    («auto» — the community works as soon as a database is connected, nothing else to set).
 *  - SHAM_DATA_KEY set later: the stored data key gets wrapped with it («wrapped»), so a copy of the database
 *    alone no longer opens anything. Changing SHAM_DATA_KEY afterwards needs the old one.
 *  - Databases that started with SHAM_DATA_KEY keep using it directly («env»).
 */
export type KeyMode = 'auto' | 'wrapped' | 'env';
export class DataKeyError extends Error {}

export async function loadDataKey(sql: Sql, envKey: string, wrap: (secret: string) => { seal(v: string): string | null; open(v: string): string }): Promise<{ secret: string; mode: KeyMode }> {
  const read = async () => (await sql.query(`SELECT value FROM community_meta WHERE key = 'data_key'`))[0]?.value as string | undefined;
  let row = await read();
  const strong = envKey.length >= 24;
  if (!row) {
    if (strong) {
      // A database that already holds members was encrypted with SHAM_DATA_KEY itself.
      await sql.query(`INSERT INTO community_meta (key, value) VALUES ('data_key', 'env') ON CONFLICT (key) DO NOTHING`);
    } else {
      const fresh = randomBytes(32).toString('base64url');
      await sql.query(`INSERT INTO community_meta (key, value) VALUES ('data_key', $1) ON CONFLICT (key) DO NOTHING`, [`plain:${fresh}`]);
    }
    row = await read(); // another server instance may have won the race
  }
  if (row === 'env') {
    if (!strong) throw new DataKeyError('This database was encrypted with SHAM_DATA_KEY: set it again');
    return { secret: envKey, mode: 'env' };
  }
  if (row?.startsWith('plain:')) {
    const secret = row.slice('plain:'.length);
    if (strong) {
      const sealed = wrap(envKey).seal(secret);
      await sql.query(`UPDATE community_meta SET value = $1 WHERE key = 'data_key' AND value = $2`, [`wrapped:${sealed}`, row]);
      return { secret, mode: 'wrapped' };
    }
    return { secret, mode: 'auto' };
  }
  if (row?.startsWith('wrapped:')) {
    if (!strong) throw new DataKeyError('The data key is wrapped with SHAM_DATA_KEY: set it again');
    const secret = wrap(envKey).open(row.slice('wrapped:'.length));
    if (!secret) throw new DataKeyError('SHAM_DATA_KEY does not match the one this database was protected with');
    return { secret, mode: 'wrapped' };
  }
  throw new DataKeyError('Unknown data key record');
}
