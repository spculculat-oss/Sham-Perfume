import { Suspense, lazy, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// The management dashboard is a separate lazily-loaded bundle reachable at #admin.
const AdminApp = lazy(() => import('./admin/AdminApp.tsx'));
const isAdminRoute = () => window.location.hash.replace(/^#\/?/, '').startsWith('admin');

function Root() {
  const [admin, setAdmin] = useState(isAdminRoute);
  useEffect(() => {
    const sync = () => setAdmin(isAdminRoute());
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

createRoot(document.getElementById('root')!).render(<Root />);
