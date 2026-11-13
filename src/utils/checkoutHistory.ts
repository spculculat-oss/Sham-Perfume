/**
 * #418/#419: the order window («السلة → التوصيل والدفع») owns one browser-history entry, so the phone's back
 * button closes it like a page. The app's own back handler must leave those history moves alone — it would
 * otherwise scroll to the top or show «اضغط رجوع تاني للخروج» while the visitor only closed his basket.
 */
let skipNext = false;
let open = false;

export function checkoutOpened(): void {
  open = true;
  try { window.history.pushState({ ...(window.history.state || {}), modal: 'checkout' }, ''); } catch { /* ignore */ }
}

/** Closed from inside (✕, the dark backdrop, «أكمل التسوق»): drop our history entry quietly. */
export function checkoutClosed(): void {
  open = false;
  if (window.history.state?.modal === 'checkout') {
    skipNext = true;
    try { window.history.back(); } catch { skipNext = false; }
  }
}

/** For App's popstate handler: `true` = this back/forward belongs to the order window, do nothing else. */
export function popBelongsToCheckout(): boolean {
  if (skipNext) { skipNext = false; return true; }
  if (open) { open = false; return true; } // the back button closed the open order window
  return false;
}
