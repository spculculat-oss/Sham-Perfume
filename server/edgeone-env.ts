/**
 * Tencent EdgeOne Makers (Pages) runtime defaults. Imported BEFORE ./app so the store, proxy trust
 * and rate-limit keys see them. Explicit values from the EdgeOne console always win.
 */
process.env.SHAM_PLATFORM ||= 'edgeone';
// Cloud Functions have no durable disk: memory store unless SHAM_STORE=firestore is configured.
process.env.SHAM_SERVERLESS ||= '1';
// The runtime re-evaluates the bundle per request; keep dotenv from logging a line every time.
process.env.DOTENV_CONFIG_QUIET ||= 'true';
export {};
