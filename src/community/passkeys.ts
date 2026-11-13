/**
 * «مجتمع شام» — the browser side of passkeys: the server speaks base64url, the WebAuthn API speaks
 * ArrayBuffers. This file converts between the two and never touches the keys — the device does
 * (fingerprint, face, or PIN).
 */
import type { PasskeyAssertResult, PasskeyGetOptions, PasskeyRegisterOptions, PasskeyRegisterResult } from './api';

export function webauthnAvailable(): boolean {
  return typeof window !== 'undefined' && !!window.isSecureContext && !!navigator.credentials;
}

const bufToB64url = (buf: ArrayBuffer | Uint8Array): string => {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const b64urlToBuf = (s: string): ArrayBuffer => {
  const b = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
  const bytes = new Uint8Array(b.length);
  for (let i = 0; i < b.length; i++) bytes[i] = b.charCodeAt(i);
  return bytes.buffer;
};

/** Ask the device to create a passkey (the answer goes straight to the server for verification). */
export async function createPasskey(opts: PasskeyRegisterOptions): Promise<PasskeyRegisterResult> {
  const credential = (await navigator.credentials.create({
    publicKey: {
      rp: opts.rp, user: { ...opts.user, id: b64urlToBuf(opts.user.id) }, challenge: b64urlToBuf(opts.challenge),
      pubKeyCredParams: opts.pubKeyCredParams, timeout: opts.timeout, attestation: opts.attestation,
      authenticatorSelection: opts.authenticatorSelection as PublicKeyCredentialCreationOptions['authenticatorSelection'],
      excludeCredentials: opts.excludeCredentials.map((c) => ({ type: c.type, id: b64urlToBuf(c.id) })),
    } as PublicKeyCredentialCreationOptions,
  })) as PublicKeyCredential | null;
  if (!credential) throw new Error('cancelled');
  const response = credential.response as AuthenticatorAttestationResponse;
  return { id: credential.id, clientDataJSON: bufToB64url(response.clientDataJSON), attestationObject: bufToB64url(response.attestationObject) };
}

/** Ask the device to prove itself (sign-in). */
export async function usePasskey(opts: PasskeyGetOptions): Promise<PasskeyAssertResult> {
  const credential = (await navigator.credentials.get({
    publicKey: {
      challenge: b64urlToBuf(opts.challenge), timeout: opts.timeout, rpId: opts.rpId,
      userVerification: opts.userVerification as PublicKeyCredentialRequestOptions['userVerification'],
      allowedCredentials: opts.allowedCredentials.map((c) => ({ type: c.type, id: b64urlToBuf(c.id) })),
    } as PublicKeyCredentialRequestOptions,
  })) as PublicKeyCredential | null;
  if (!credential) throw new Error('cancelled');
  const response = credential.response as AuthenticatorAssertionResponse;
  return {
    credentialId: credential.id, clientDataJSON: bufToB64url(response.clientDataJSON),
    authenticatorData: bufToB64url(response.authenticatorData), signature: bufToB64url(response.signature),
  };
}
