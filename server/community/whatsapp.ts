/**
 * Meta WhatsApp Business Cloud API delivery for account-verification and sign-in codes.
 * The sender is server-only; credentials never leave this module or its environment.
 */

type Env = Record<string, string | undefined>;
export type WhatsAppSendResult = { accepted: true } | { accepted: false; reason: 'unconfigured' | 'invalid' | 'provider' };

const value = (env: Env, key: string) => env[key]?.trim() || '';

function config(env: Env) {
  const accessToken = value(env, 'SHAM_WHATSAPP_ACCESS_TOKEN');
  const phoneNumberId = value(env, 'SHAM_WHATSAPP_PHONE_NUMBER_ID');
  const templateName = value(env, 'SHAM_WHATSAPP_AUTH_TEMPLATE');
  const language = value(env, 'SHAM_WHATSAPP_TEMPLATE_LANGUAGE');
  const version = value(env, 'SHAM_WHATSAPP_GRAPH_VERSION');
  if (!accessToken || !/^\d{5,30}$/.test(phoneNumberId)
    || !/^[a-z0-9_]{1,128}$/i.test(templateName)
    || !/^[A-Za-z]{2,3}(?:_[A-Za-z]{2})?$/.test(language)
    || !/^v\d+\.\d+$/.test(version)) return undefined;
  return { accessToken, phoneNumberId, templateName, language, version };
}

/** Safe for a public capability response: only whether a complete sender is configured, never its values. */
export function metaWhatsAppReady(env: Env = process.env): boolean {
  return Boolean(config(env));
}

/** Sends an approved template with one body variable (the six-digit code). */
export async function sendMetaWhatsAppCode(
  phone: string,
  code: string,
  env: Env = process.env,
  fetchFn: typeof fetch = fetch,
): Promise<WhatsAppSendResult> {
  const settings = config(env);
  if (!settings) return { accepted: false, reason: 'unconfigured' };
  const digits = phone.replace(/\D/g, '');
  if (!/^\+[1-9]\d{7,14}$/.test(phone) || !/^\d{6}$/.test(code) || !digits) {
    return { accepted: false, reason: 'invalid' };
  }

  try {
    const response = await fetchFn(`https://graph.facebook.com/${settings.version}/${settings.phoneNumberId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${settings.accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: digits,
        type: 'template',
        template: {
          name: settings.templateName,
          language: { code: settings.language },
          components: [{ type: 'body', parameters: [{ type: 'text', text: code }] }],
        },
      }),
      signal: AbortSignal.timeout(8_000),
    });
    return response.ok ? { accepted: true } : { accepted: false, reason: 'provider' };
  } catch {
    // Never surface or log provider responses, credentials, phone numbers or one-time codes.
    return { accepted: false, reason: 'provider' };
  }
}
