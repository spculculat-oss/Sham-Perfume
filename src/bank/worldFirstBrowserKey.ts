/**
 * RSA2 key pair in the browser, the same PKCS8/SPKI shape WorldFirst asks the partner to generate.
 * Used when the owner desk is open but the server copy of the link is not published yet.
 * The private key is returned once and is never stored here.
 */

function pem(bytes: ArrayBuffer, label: 'PRIVATE KEY' | 'PUBLIC KEY'): string {
  let binary = '';
  const view = new Uint8Array(bytes);
  for (let i = 0; i < view.length; i += 0x8000) binary += String.fromCharCode(...view.subarray(i, i + 0x8000));
  const body = btoa(binary).match(/.{1,64}/g)?.join('\n') || btoa(binary);
  return `-----BEGIN ${label}-----\n${body}\n-----END ${label}-----\n`;
}

export async function prepareBrowserLinkKey(): Promise<{ publicKeyPem: string; publicKeyBody: string; privateKeyPem: string }> {
  const pair = await crypto.subtle.generateKey(
    { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true,
    ['sign', 'verify'],
  );
  const privateKeyPem = pem(await crypto.subtle.exportKey('pkcs8', pair.privateKey), 'PRIVATE KEY');
  const publicKeyPem = pem(await crypto.subtle.exportKey('spki', pair.publicKey), 'PUBLIC KEY');
  return {
    publicKeyPem,
    publicKeyBody: publicKeyPem.replace(/-----BEGIN PUBLIC KEY-----|-----END PUBLIC KEY-----/g, '').replace(/\s/g, ''),
    privateKeyPem,
  };
}
