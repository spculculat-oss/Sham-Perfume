import { Component, lazy, type ComponentType, type ErrorInfo, type ReactNode } from 'react';

/**
 * Pages republishes the site many times a day (news bulletins, catalog updates) and every publish renames the
 * lazily-loaded bundles. A tab opened before a publish then asks for a file that no longer exists — without this,
 * React unmounts the whole site and the visitor sees a blank white page.
 */
const RELOAD_KEY = 'sham_stale_bundle_reload_at';

export function isStaleBundleError(error: unknown): boolean {
  const text = String((error as { message?: string })?.message || error || '');
  return /dynamically imported module|Importing a module script failed|error loading dynamically imported module|ChunkLoadError|Loading chunk \S+ failed|MIME type of "?text\/html|Unable to preload CSS/i.test(text);
}

/** Reloads the page once (per minute) to pick up the freshly published files. Returns false if it already tried. */
export function reloadForFreshBundle(): boolean {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY) || 0);
    if (Date.now() - last < 60_000) return false;
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch { /* private mode: still try once */ }
  window.location.reload();
  return true;
}

/** `React.lazy` that survives a publish: one quiet retry, then a single page reload for the new file names. */
export function lazyWithReload<T extends ComponentType<any>>(factory: () => Promise<{ default: T }>) {
  return lazy(async () => {
    try {
      return await factory();
    } catch (first) {
      await new Promise((r) => setTimeout(r, 400));
      try {
        return await factory();
      } catch (error) {
        if (isStaleBundleError(error) && reloadForFreshBundle()) return new Promise<{ default: T }>(() => {}); // the page is reloading
        throw error;
      }
    }
  });
}

const isArabic = () => {
  try { return (document.documentElement.lang || 'ar').startsWith('ar'); } catch { return true; }
};

interface BoundaryProps { children: ReactNode; area?: string; compact?: boolean; ar?: boolean; onReset?: () => void }
interface BoundaryState { error: Error | null }

/** Shows a clear message and a reload button instead of a blank page when a part of the site crashes. */
export class ErrorBoundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): BoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[sham] ${this.props.area || 'app'} crashed:`, error, info.componentStack);
    if (isStaleBundleError(error)) reloadForFreshBundle();
  }

  private reset = () => {
    this.setState({ error: null });
    this.props.onReset?.();
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    const ar = this.props.ar ?? isArabic();
    const stale = isStaleBundleError(error);
    const title = stale
      ? (ar ? 'فيه نسخة أحدث من الموقع' : 'A newer version of the site is available')
      : (ar ? 'حصلت مشكلة في عرض الجزء ده' : 'Something went wrong showing this part');
    const body = stale
      ? (ar ? 'الموقع اتحدّث وإنت فاتحه. دوس «إعادة تحميل» عشان تاخد النسخة الجديدة.' : 'The site was updated while it was open. Reload to get the new version.')
      : (ar ? 'باقي الموقع شغال عادي. جرّب تاني، ولو المشكلة فضلت دوس «إعادة تحميل».' : 'The rest of the site still works. Try again, or reload the page.');
    return (
      <div dir={ar ? 'rtl' : 'ltr'} className={`${this.props.compact ? 'py-10' : 'min-h-[60vh] py-20'} flex items-center justify-center px-4`}>
        <div className="max-w-md w-full rounded-2xl border border-amber-200 bg-white p-6 text-center shadow-sm">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-2xl">🌿</div>
          <h2 className="mb-2 text-lg font-bold text-stone-900">{title}</h2>
          <p className="mb-5 text-sm leading-relaxed text-stone-600">{body}</p>
          <div className="flex flex-wrap justify-center gap-2">
            <button type="button" onClick={() => window.location.reload()} className="rounded-xl bg-amber-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-800">
              {ar ? 'إعادة تحميل' : 'Reload'}
            </button>
            {!stale && (
              <button type="button" onClick={this.reset} className="rounded-xl border border-stone-200 bg-stone-50 px-4 py-2.5 text-sm font-semibold text-stone-800 hover:bg-stone-100">
                {ar ? 'جرّب تاني' : 'Try again'}
              </button>
            )}
            {this.props.onReset && (
              <button type="button" onClick={() => { window.location.hash = '#home'; this.reset(); }} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-stone-600 hover:bg-stone-100">
                {ar ? 'الرئيسية' : 'Home'}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }
}
