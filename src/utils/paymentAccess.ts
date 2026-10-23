import { getCurrentUserSession } from './authStorage';
import { getSessionToken } from '../community/api';
import type { UserProfile } from '../types/auth';

/**
 * Owner's rule: no payment without signing in to a real account.
 * A real account is one the server verified (it issued a session token). The demo login,
 * guest checkout and browser-only local profiles (made when the account server is down) never pay.
 */
export function isVerifiedCustomer(user: Pick<UserProfile, 'id' | 'email'> | null | undefined, token = getSessionToken()): boolean {
  if (!user?.id || user.id === 'guest_client' || !user.email) return false;
  if (user.id.startsWith('usr-')) return false; // made in this browser only, never seen by the server
  return Boolean(token);
}

/** A signed-in customer with a server-verified account, or null. */
export function signedInCustomer(): UserProfile | null {
  const user = getCurrentUserSession().user;
  return isVerifiedCustomer(user) ? user : null;
}

/** Someone is signed in on this device only (no verified account), so payment stays locked. */
export function localOnlyProfile(): boolean {
  const user = getCurrentUserSession().user;
  return Boolean(user?.id && user.email) && !isVerifiedCustomer(user);
}

/** Opens the site sign-in window and reports whether a customer is already signed in. */
export function requireCustomerLogin(): boolean {
  if (signedInCustomer()) return true;
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('sham-require-auth'));
  return false;
}
