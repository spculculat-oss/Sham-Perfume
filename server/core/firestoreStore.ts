/**
 * Firestore adapter over the public REST API using a service account (no SDK dependency,
 * works in Vercel functions and any Node host). Each entity is stored as one JSON string
 * field so the domain schema can evolve without Firestore type mapping.
 */
import { createSign } from 'node:crypto';
import type { CollectionName, Collections } from './types';
import type { Store } from './store';

interface Options {
  projectId: string;
  clientEmail: string;
  privateKey: string;
  prefix: string;
  fetch?: typeof fetch;
}

const b64url = (input: string | Buffer) => Buffer.from(input).toString('base64url');

export class FirestoreStore implements Store {
  readonly kind = 'firestore' as const;
  readonly persistent = true;
  private token?: { value: string; expires: number };
  private request: typeof fetch;

  constructor(private options: Options) {
    this.request = options.fetch || fetch;
  }

  private base(collection: CollectionName) {
    return `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(this.options.projectId)}/databases/(default)/documents/${this.options.prefix}${collection}`;
  }

  private async accessToken(): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    if (this.token && this.token.expires - 60 > now) return this.token.value;
    const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
    const claims = b64url(JSON.stringify({
      iss: this.options.clientEmail,
      scope: 'https://www.googleapis.com/auth/datastore',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    }));
    const signer = createSign('RSA-SHA256');
    signer.update(`${header}.${claims}`);
    const assertion = `${header}.${claims}.${b64url(signer.sign(this.options.privateKey))}`;
    const response = await this.request('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
    });
    if (!response.ok) throw new Error(`Firestore auth failed (${response.status})`);
    const data = await response.json() as { access_token: string; expires_in: number };
    this.token = { value: data.access_token, expires: now + data.expires_in };
    return data.access_token;
  }

  private async call(url: string, init: RequestInit = {}) {
    const token = await this.accessToken();
    return this.request(url, {
      ...init,
      headers: { ...(init.headers || {}), Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(10000),
    });
  }

  private static decode<T>(doc: { fields?: { json?: { stringValue?: string } } }): T | undefined {
    const raw = doc.fields?.json?.stringValue;
    return raw ? JSON.parse(raw) as T : undefined;
  }

  async get<C extends CollectionName>(collection: C, id: string) {
    const response = await this.call(`${this.base(collection)}/${encodeURIComponent(id)}`);
    if (response.status === 404) return undefined;
    if (!response.ok) throw new Error(`Firestore get failed (${response.status})`);
    return FirestoreStore.decode<Collections[C]>(await response.json() as { fields?: { json?: { stringValue?: string } } });
  }

  async list<C extends CollectionName>(collection: C) {
    const out: Collections[C][] = [];
    let pageToken = '';
    do {
      const url = `${this.base(collection)}?pageSize=300${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`;
      const response = await this.call(url);
      if (!response.ok) throw new Error(`Firestore list failed (${response.status})`);
      const data = await response.json() as { documents?: { fields?: { json?: { stringValue?: string } } }[]; nextPageToken?: string };
      for (const doc of data.documents || []) {
        const value = FirestoreStore.decode<Collections[C]>(doc);
        if (value) out.push(value);
      }
      pageToken = data.nextPageToken || '';
    } while (pageToken);
    return out;
  }

  async put<C extends CollectionName>(collection: C, id: string, value: Collections[C]) {
    const response = await this.call(`${this.base(collection)}/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify({ fields: { json: { stringValue: JSON.stringify(value) }, updatedAt: { timestampValue: new Date().toISOString() } } }),
    });
    if (!response.ok) throw new Error(`Firestore write failed (${response.status})`);
  }

  async delete(collection: CollectionName, id: string) {
    const existing = await this.get(collection, id);
    if (!existing) return false;
    const response = await this.call(`${this.base(collection)}/${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (!response.ok) throw new Error(`Firestore delete failed (${response.status})`);
    return true;
  }
}
