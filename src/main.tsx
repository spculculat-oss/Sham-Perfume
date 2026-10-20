import { Suspense, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { ErrorBoundary, lazyWithReload } from './utils/lazyRetry';
import { getInitialLanguage } from './لغات/i18n';
import { loadAiPack } from './لغات/aiPackLoader';

// The management dashboard is a separate lazily-loaded bundle reachable at #admin.
const AdminApp = lazyWithReload(() => import('./admin/AdminApp.tsx'));
const isAdminRoute = () => window.location.hash.replace(/^#\/?/, '').startsWith('admin');
// The operations map is for the management only: the old #ops link now opens it inside the admin panel
// (#admin/ops), behind the admin code like every other tab.
const opsToAdmin = () => { if (/^#\/?ops(?:$|[/?])/.test(window.location.hash)) window.history.replaceState(null, '', '#admin/ops'); };
opsToAdmin();

function Root() {
  const [admin, setAdmin] = useState(isAdminRoute);
  useEffect(() => {
    const sync = () => { opsToAdmin(); setAdmin(isAdminRoute()); };
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, []);
  if (admin) {
    return (
      <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-stone-500">…</div>}>
        <AdminApp />
      </Suspense>
    );
  }
  return <App />;
}

// Never a blank page: a crash anywhere shows a message with a reload button instead.
const render = () => createRoot(document.getElementById('root')!).render(<ErrorBoundary area="site"><Root /></ErrorBoundary>);
// The visitor's language pack from the language agent first (at most 700 ms), so the first paint is already translated.
let started = false;
const start = () => { if (!started) { started = true; render(); } };
void loadAiPack(getInitialLanguage()).finally(start);
setTimeout(start, 700);
