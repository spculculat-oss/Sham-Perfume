import { getCurrentUserSession } from './authStorage';
import type { UserProfile } from '../types/auth';

/** A signed-in customer. Guest checkout is not a customer. */
export function signedInCustomer(): UserProfile | null {
  const user = getCurrentUserSession().user;
  if (!user?.id || user.id === 'guest_client' || !user.email) return null;
  return user;
}

/** Opens the site sign-in window and reports whether a customer is already signed in. */
export function requireCustomerLogin(): boolean {
  if (signedInCustomer()) return true;
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('sham-require-auth'));
  return false;
}
