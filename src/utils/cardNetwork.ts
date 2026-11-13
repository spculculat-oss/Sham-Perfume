/**
 * Card-network verdict. "Active" is allowed only after a live issuer acceptance.
 * A missing gateway, a test-mode success, or a well-formed number is not active.
 * This module never sees a card number.
 */
export type NetworkVerdict = 'unconfirmed' | 'active' | 'inactive' | 'dummy';
export type NetworkReason =
  | 'NETWORK_NOT_CONNECTED'
  | 'AWAITING_ISSUER'
  | 'ISSUER_ACCEPTED'
  | 'ISSUER_DECLINED'
  | 'EXPIRED'
  | 'TEST_CARD';

export interface NetworkCheck {
  connected: boolean;
  verdict: NetworkVerdict;
  reason: NetworkReason;
  mode?: 'test' | 'live';
}

const PAN = /\d(?:[ -]?\d){12,18}/;

export function containsCardSecret(value: string): boolean {
  return PAN.test(value) || /\b(cvv|cvc|cid)\b/i.test(value);
}

/** Recognises a configured Stripe pair without returning either key. */
export function stripeCardNetwork(env: Record<string, string | undefined>): { mode: 'test' | 'live' } | undefined {
  const secret = env.STRIPE_SECRET_KEY?.trim() || '';
  const publishable = env.STRIPE_PUBLISHABLE_KEY?.trim() || '';
  const secretMode = secret.startsWith('sk_live_') ? 'live' : secret.startsWith('sk_test_') ? 'test' : '';
  const publishableMode = publishable.startsWith('pk_live_') ? 'live' : publishable.startsWith('pk_test_') ? 'test' : '';
  if (!secretMode || secretMode !== publishableMode || secret.length < 24 || publishable.length < 24) return undefined;
  return { mode: secretMode };
}

export function verdictFromProvider(input: {
  connected: boolean;
  mode?: 'test' | 'live';
  status?: string;
  decline?: string;
}): NetworkCheck {
  if (!input.connected) return { connected: false, verdict: 'unconfirmed', reason: 'NETWORK_NOT_CONNECTED' };
  const mode = input.mode;
  if (mode === 'test' && input.status === 'succeeded') return { connected: true, mode, verdict: 'dummy', reason: 'TEST_CARD' };
  if (input.decline === 'expired_card' || input.decline === 'invalid_expiry_year' || input.decline === 'invalid_expiry_month') {
    return { connected: true, mode, verdict: 'inactive', reason: 'EXPIRED' };
  }
  if (input.decline) return { connected: true, mode, verdict: 'inactive', reason: 'ISSUER_DECLINED' };
  if (mode === 'live' && input.status === 'succeeded') return { connected: true, mode, verdict: 'active', reason: 'ISSUER_ACCEPTED' };
  return { connected: true, mode, verdict: 'unconfirmed', reason: 'AWAITING_ISSUER' };
}

export type LiveChip = 'dummy' | 'inactive' | 'active' | 'none';

/** Which instant-check chip may light. A format-valid number never lights "active". */
export function liveChip(local: string, network: NetworkCheck): LiveChip {
  if (network.verdict === 'active') return 'active';
  if (network.verdict === 'inactive' || local === 'expired') return 'inactive';
  if (network.verdict === 'dummy' || local === 'dummy') return 'dummy';
  return 'none';
}

export function networkCopy(check: NetworkCheck, lang: string): string {
  const ar = lang === 'ar';
  if (!check.connected) {
    return ar
      ? 'شبكة البطاقة غير موصولة. لن تُعلَّم البطاقة مفعّلة.'
      : 'The card network is not connected. The card is not marked active.';
  }
  if (check.verdict === 'active') return ar ? 'المُصدر قبل البطاقة. لم يُخصم مبلغ.' : 'The issuer accepted the card. No amount was captured.';
  if (check.verdict === 'inactive') return ar ? 'المُصدر رفض البطاقة. ليست مفعّلة لهذه العملية.' : 'The issuer declined the card. It is not active for this payment.';
  if (check.verdict === 'dummy') return ar ? 'رد شبكة الاختبار. ليست بطاقة عميل مفعّلة.' : 'Test-network response. Not an active customer card.';
  return ar ? 'الشبكة موصولة. التفعيل ينتظر رد المُصدر، ولا يُخمَّن.' : 'The network is connected. Activation waits for the issuer and is not guessed.';
}
