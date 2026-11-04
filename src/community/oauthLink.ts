/**
 * Sign in with the account the visitor already has.
 * The button opens Google's or Facebook's own window. Sham only receives the token that window
 * returns, and the server checks it with the provider. A typed e-mail is never sent as a token,
 * and a closed window does not create a local account.
 */
import { cx } from './api';

export interface OAuthPublicConfig {
  googleClientId: string | null;
  facebookAppId: string | null;
}

export function oauthConfig(): Promise<OAuthPublicConfig> {
  return cx<OAuthPublicConfig>('/community/auth/oauth/config');
}

function loadScript(src: string): Promise<void> {
  const found = document.querySelector(`script[src="${src}"]`);
  if (found?.getAttribute('data-sham-ready') === '1') return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = (found as HTMLScriptElement | null) || document.createElement('script');
    const finish = () => { script.setAttribute('data-sham-ready', '1'); resolve(); };
    const fail = () => reject(new Error('script'));
    script.addEventListener('load', finish, { once: true });
    script.addEventListener('error', fail, { once: true });
    if (!found) {
      script.src = src;
      script.async = true;
      document.head.appendChild(script);
    }
  });
}

type GoogleTokenClient = { requestAccessToken: (override?: { prompt?: string }) => void };
type GoogleNamespace = { accounts?: { oauth2?: { initTokenClient: (config: {
  client_id: string;
  scope: string;
  callback: (resp: { access_token?: string; error?: string }) => void;
  error_callback?: (err: { type?: string }) => void;
}) => GoogleTokenClient } } };

let googleReady: Promise<void> | null = null;

/** Load Google's script when the login form opens, so the click can still open the popup. */
export function prepareGoogle(): Promise<void> {
  if (googleReady) return googleReady;
  googleReady = loadScript('https://accounts.google.com/gsi/client').then(() => {
    if (!(window as Window & { google?: GoogleNamespace }).google?.accounts?.oauth2) throw new Error('script');
  }).catch((error) => { googleReady = null; throw error; });
  return googleReady;
}

/** Google's account chooser. Resolves with the access token Google issued, or rejects if the window closed. */
export function googleAccessToken(clientId: string): Promise<string> {
  return prepareGoogle().then(() => new Promise((resolve, reject) => {
    const oauth2 = (window as Window & { google?: GoogleNamespace }).google?.accounts?.oauth2;
    if (!oauth2) { reject(new Error('script')); return; }
    let settled = false;
    const done = (token?: string, reason = 'cancelled') => {
      if (settled) return;
      settled = true;
      if (token) resolve(token);
      else reject(new Error(reason));
    };
    const client = oauth2.initTokenClient({
      client_id: clientId,
      scope: 'openid email profile',
      callback: (resp) => done(resp.access_token, resp.error || 'cancelled'),
      error_callback: () => done(undefined, 'cancelled'),
    });
    client.requestAccessToken({ prompt: 'select_account' });
  }));
}

type FbLogin = (cb: (resp: { authResponse?: { accessToken?: string } | null }) => void, opts: { scope: string }) => void;
type FbWindow = Window & { FB?: { init: (opts: { appId: string; cookie: boolean; xfbml: boolean; version: string }) => void; login: FbLogin }; fbAsyncInit?: () => void };

let facebookReady: Promise<void> | null = null;
let facebookAppId = '';

export function prepareFacebook(appId: string): Promise<void> {
  if (facebookReady && facebookAppId === appId) return facebookReady;
  facebookAppId = appId;
  facebookReady = new Promise((resolve, reject) => {
    const w = window as FbWindow;
    const start = () => {
      if (!w.FB) { facebookReady = null; reject(new Error('script')); return; }
      w.FB.init({ appId, cookie: false, xfbml: false, version: 'v21.0' });
      resolve();
    };
    if (w.FB) { start(); return; }
    w.fbAsyncInit = start;
    loadScript('https://connect.facebook.net/en_US/sdk.js').catch((error) => { facebookReady = null; reject(error); });
  });
  return facebookReady;
}

export function facebookAccessToken(appId: string): Promise<string> {
  return prepareFacebook(appId).then(() => new Promise((resolve, reject) => {
    const FB = (window as FbWindow).FB;
    if (!FB) { reject(new Error('script')); return; }
    FB.login((resp) => {
      const token = resp.authResponse?.accessToken;
      if (token) resolve(token);
      else reject(new Error('cancelled'));
    }, { scope: 'email,public_profile' });
  }));
}
