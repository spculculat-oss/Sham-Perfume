/**
 * Prepares the WorldFirst partner handshake. It does not call WorldFirst and does not send money.
 * The private key is returned once to the signed-in owner and is never stored.
 * A portal sighting records that receiving details were seen, never the number itself.
 */
import { createHash, generateKeyPairSync } from 'node:crypto';
import { ValidationError } from '../core/repository';
import type { Store } from '../core/store';
import {
  WORLDFIRST_RECEIVING_REGIONS,
  type WorldFirstAccountNameKind,
  type WorldFirstLinkRecord,
  type WorldFirstLinkView,
  type WorldFirstReceiving,
  type WorldFirstReceivingRegion,
} from '../../src/bank/worldFirstRail';

export const LINK_ID = 'link';
const NAME_KINDS = new Set<WorldFirstAccountNameKind>(['owner', 'worldfirst', 'partner_bank']);
const SECRET_VALUE = /-----BEGIN |IBAN|\b[A-Z]{2}\d{2}[A-Z0-9]{11,30}\b|\d{8,}/;

export function canonicalPrivatePem(raw: string): string {
  const text = raw.replace(/\\n/g, '\n').replace(/\r/g, '').trim();
  if (text.includes('BEGIN')) return text.endsWith('\n') ? text : `${text}\n`;
  const body = text.replace(/\s/g, '');
  const lines = body.match(/.{1,64}/g)?.join('\n') || body;
  return `-----BEGIN PRIVATE KEY-----\n${lines}\n-----END PRIVATE KEY-----\n`;
}

export function privateFingerprint(raw: string): string {
  return createHash('sha256').update(canonicalPrivatePem(raw)).digest('hex');
}

export function publicKeyBody(pem: string): string {
  return pem.replace(/-----BEGIN PUBLIC KEY-----/g, '').replace(/-----END PUBLIC KEY-----/g, '').replace(/\s/g, '');
}

function rejectSecrets(body: Record<string, unknown>, allowed: readonly string[]): void {
  for (const key of Object.keys(body)) {
    if (!allowed.includes(key) || (body[key] !== null && typeof body[key] === 'object')) {
      throw new ValidationError('SECRET', 'لا يُقبل رقم حساب أو مفتاح أو حقل زيادة.');
    }
    if (typeof body[key] === 'string' && SECRET_VALUE.test(body[key])) {
      throw new ValidationError('SECRET', 'لا يُكتب رقم حساب أو مفتاح في هذا النموذج.');
    }
  }
}

function blank(): WorldFirstLinkRecord {
  return {
    id: LINK_ID,
    publicKeyPem: '',
    privateFingerprint: '',
    preparedAt: '',
    receivingSeenAt: '',
    receivingRegion: '',
    accountNameKind: '',
  };
}

function readable(value: WorldFirstLinkRecord | undefined): WorldFirstLinkRecord | undefined {
  if (!value || value.id !== LINK_ID) return undefined;
  const leaked = ['privateKey', 'privateKeyPem', 'iban', 'accountNo', 'accountNumber', 'swift', 'password'].some((key) => key in value);
  if (leaked) return undefined;
  const prepared = Boolean(value.publicKeyPem);
  if (prepared && (!value.publicKeyPem.includes('BEGIN PUBLIC KEY') || !/^[a-f0-9]{64}$/.test(value.privateFingerprint))) return undefined;
  if (value.receivingRegion && !WORLDFIRST_RECEIVING_REGIONS.includes(value.receivingRegion)) return undefined;
  if (value.accountNameKind && !NAME_KINDS.has(value.accountNameKind)) return undefined;
  return value;
}

export function linkView(record: WorldFirstLinkRecord | undefined, env: { WORLDFIRST_PRIVATE_KEY?: string } | undefined): WorldFirstLinkView {
  const safe = readable(record);
  const prepared = Boolean(safe?.publicKeyPem && safe.privateFingerprint);
  const fingerprint = prepared ? safe!.privateFingerprint : '';
  const present = Boolean(env?.WORLDFIRST_PRIVATE_KEY?.trim());
  const serverKey = !fingerprint
    ? (present ? 'unprepared' : 'absent')
    : !present
      ? 'absent'
      : privateFingerprint(env!.WORLDFIRST_PRIVATE_KEY!) === fingerprint ? 'matches' : 'different';
  return {
    prepared,
    publicKeyPem: prepared ? safe!.publicKeyPem : '',
    publicKeyBody: prepared ? publicKeyBody(safe!.publicKeyPem) : '',
    privateFingerprint: fingerprint,
    serverKey,
    receivingSeen: Boolean(safe?.receivingSeenAt),
    receivingRegion: safe?.receivingRegion || '',
    accountNameKind: safe?.accountNameKind || '',
  };
}

export interface PreparedLink {
  prepared: true;
  reissued: boolean;
  publicKeyPem: string;
  publicKeyBody: string;
  privateFingerprint: string;
  privateKeyPem?: string;
  sendsExternal: false;
  transmission: 'blocked';
  receiving: WorldFirstReceiving;
}

export class WorldFirstLink {
  constructor(private store: Store, private now: () => string, private env: Record<string, string | undefined>) {}

  private async read(): Promise<WorldFirstLinkRecord | undefined> {
    return readable(await this.store.get('shamWorldFirstLink', LINK_ID));
  }

  async view(): Promise<WorldFirstLinkView> {
    return linkView(await this.read(), this.env);
  }

  async prepare(body: unknown): Promise<PreparedLink> {
    const raw = body && typeof body === 'object' && !Array.isArray(body) ? body as Record<string, unknown> : {};
    rejectSecrets(raw, ['rotate']);
    if ('rotate' in raw && raw.rotate !== true && raw.rotate !== false) throw new ValidationError('INVALID_LINK', 'تدوير المفتاح يكون نعم أو لا فقط.');
    const current = (await this.read()) || blank();
    const rotate = raw.rotate === true;
    if (current.publicKeyPem && !rotate) {
      const view = linkView(current, this.env);
      return {
        prepared: true,
        reissued: false,
        publicKeyPem: view.publicKeyPem,
        publicKeyBody: view.publicKeyBody,
        privateFingerprint: view.privateFingerprint,
        sendsExternal: false,
        transmission: 'blocked',
        receiving: current.receivingSeenAt ? 'owner_seen_in_portal' : 'not_issued',
      };
    }
    const keys = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const privateKeyPem = keys.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
    const publicKeyPem = keys.publicKey.export({ type: 'spki', format: 'pem' }).toString();
    const next: WorldFirstLinkRecord = {
      ...current,
      id: LINK_ID,
      publicKeyPem,
      privateFingerprint: privateFingerprint(privateKeyPem),
      preparedAt: this.now(),
    };
    await this.store.put('shamWorldFirstLink', LINK_ID, next);
    return {
      prepared: true,
      reissued: true,
      publicKeyPem,
      publicKeyBody: publicKeyBody(publicKeyPem),
      privateFingerprint: next.privateFingerprint,
      privateKeyPem,
      sendsExternal: false,
      transmission: 'blocked',
      receiving: next.receivingSeenAt ? 'owner_seen_in_portal' : 'not_issued',
    };
  }

  async seen(body: unknown): Promise<WorldFirstLinkView & { sendsExternal: false; transmission: 'blocked'; receiving: WorldFirstReceiving }> {
    const raw = body && typeof body === 'object' && !Array.isArray(body) ? body as Record<string, unknown> : {};
    rejectSecrets(raw, ['seenInPortal', 'region', 'accountNameKind']);
    if (raw.seenInPortal !== true) throw new ValidationError('NOT_SEEN', 'التأكيد لازم يكون من جوه صفحة Receive، مش من الإيميل.');
    const region = String(raw.region || '');
    if (!WORLDFIRST_RECEIVING_REGIONS.includes(region as WorldFirstReceivingRegion)) {
      throw new ValidationError('INVALID_REGION', 'المنطقة دي مش من مناطق استقبال وورلد فيرست.');
    }
    const accountNameKind = String(raw.accountNameKind || '');
    if (!NAME_KINDS.has(accountNameKind as WorldFirstAccountNameKind)) throw new ValidationError('INVALID_LINK', 'حدد اسم صاحب الحساب من غير ما تكتب الرقم.');
    const current = (await this.read()) || blank();
    const next: WorldFirstLinkRecord = {
      ...current,
      id: LINK_ID,
      receivingSeenAt: this.now(),
      receivingRegion: region as WorldFirstReceivingRegion,
      accountNameKind: accountNameKind as WorldFirstAccountNameKind,
    };
    await this.store.put('shamWorldFirstLink', LINK_ID, next);
    return { ...linkView(next, this.env), sendsExternal: false, transmission: 'blocked', receiving: 'owner_seen_in_portal' };
  }
}
