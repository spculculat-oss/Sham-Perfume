/**
 * Outbound notifications ("integrations"). One generic, signed JSON webhook works with
 * Slack/Discord incoming webhooks (text/content fields) and automation tools (n8n, Make, Zapier)
 * that can forward to WhatsApp, Telegram or e-mail. No provider SDK, no vendor lock-in.
 */
import { createHmac } from 'node:crypto';

type Env = Record<string, string | undefined>;
export type NotifyEvent = 'request.created' | 'order.status_changed' | 'conversation.handoff' | 'feedback.negative' | 'test';

export interface Notifier {
  readonly configured: boolean;
  send(event: NotifyEvent, text: string, data: Record<string, unknown>): Promise<boolean>;
}

export function createNotifier(env: Env = process.env, request: typeof fetch = fetch): Notifier {
  const url = env.SHAM_WEBHOOK_URL?.trim() || '';
  const secret = env.SHAM_WEBHOOK_SECRET?.trim() || '';
  const valid = /^https:\/\//i.test(url) || (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//i.test(url));
  return {
    configured: valid,
    async send(event, text, data) {
      if (!valid) return false;
      const body = JSON.stringify({ event, at: new Date().toISOString(), text, content: text, data });
      const headers: Record<string, string> = { 'Content-Type': 'application/json', 'X-Sham-Event': event };
      // Receivers verify: hex(HMAC-SHA256(secret, raw body)) === X-Sham-Signature (after "sha256=").
      if (secret) headers['X-Sham-Signature'] = `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;
      try {
        const response = await request(url, { method: 'POST', headers, body, signal: AbortSignal.timeout(4000) });
        return response.ok;
      } catch {
        return false; // Notifications must never break a visitor's request.
      }
    },
  };
}
