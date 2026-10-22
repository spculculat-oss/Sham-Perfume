import { Suspense, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import SpecialistsHub from './components/SpecialistsHub';
import './index.css';
import { ErrorBoundary, lazyWithReload } from './utils/lazyRetry';
import { getInitialLanguage } from './لغات/i18n';
import { loadAiPack } from './لغات/aiPackLoader';

// The management dashboard is a separate lazily-loaded bundle reachable at #admin.
const AdminApp = lazyWithReload(() => import('./admin/AdminApp.tsx'));
const isAdminRoute = () => window.location.hash.replace(/^#\/?/, '').startsWith('admin');
// «خريطة التشغيل» (#admin/ops, the old #ops too) is for the management only: its own code gate, which works on the
// static Pages site without a server (src/admin/OpsMapGate.tsx).
const OpsMapGate = lazyWithReload(() => import('./admin/OpsMapGate.tsx'));
const isOpsRoute = () => /^#\/?(?:admin\/)?ops(?:$|[/?])/.test(window.location.hash);

function Root() {
  const [admin, setAdmin] = useState(isAdminRoute);
  const [ops, setOps] = useState(isOpsRoute);
  useEffect(() => {
    const sync = () => { setAdmin(isAdminRoute()); setOps(isOpsRoute()); };
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, []);
  if (admin || ops) {
    return (
      <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-stone-500">…</div>}>
        {ops ? <OpsMapGate /> : <AdminApp />}
        {/* «مجلس المتخصصين»: استشاريّو أقسام الموقع — يشتغل من متصفح الإدارة بدون سيرفر */}
        <SpecialistsHub section="admin_panel" lang={getInitialLanguage()} />
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
