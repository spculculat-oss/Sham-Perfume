import { useEffect } from 'react';
import { T, adminDir } from './adminL10n';
import ShaheenOpsMapPanel from './ShaheenOpsMapPanel';

/**
 * #ops — the operations map on its own page. The admin panel needs the server, but the map only reads the bots'
 * public reports from the repository, so it also works on the GitHub Pages site. Unlinked and kept out of search.
 */
export default function OpsMapPage() {
  useEffect(() => {
    const prevTitle = document.title;
    document.title = T('خريطة تشغيل شام');
    const meta = document.createElement('meta');
    meta.name = 'robots'; meta.content = 'noindex, nofollow';
    document.head.appendChild(meta);
    return () => { document.title = prevTitle; meta.remove(); };
  }, []);
  return (
    <div dir={adminDir()} className="min-h-screen bg-stone-100 font-sans text-stone-900">
      <div className="mx-auto max-w-7xl p-3 sm:p-6">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h1 className="text-lg font-black">{T('خريطة تشغيل شام')}</h1>
          <a href="#home" className="text-xs font-bold text-stone-600 hover:underline">{T('العودة إلى الموقع')}</a>
        </div>
        <ShaheenOpsMapPanel />
      </div>
    </div>
  );
}
