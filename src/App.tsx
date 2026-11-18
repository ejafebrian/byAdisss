import React, { Suspense, lazy, useEffect } from 'react';
import { RouterProvider, useRouter } from './lib/router';
import { sendPublicHeartbeat, trackPublicPageView } from './lib/tracking';
import { UiFeedbackProvider } from './components/Toast';
import { PublicHomePage } from './pages/public/PublicHomePage';
import { PublicLinksPage } from './pages/public/PublicLinksPage';
import { PublicProductDetailPage } from './pages/public/PublicProductDetailPage';
import { NotFoundPage } from './pages/NotFoundPage';

const LazyAdminApp = lazy(() => import('./pages/admin/AdminApp'));

function AdminChunkLoader() {
  return (
    <div className="min-h-screen bg-[#FFF6F8] flex flex-col items-center justify-center p-6 text-center">
      <div className="w-11 h-11 rounded-full border-2 border-[#F0C6D2] border-t-[#C25B7C] animate-orbit-spin" />
      <p className="mt-3 font-serif-display text-base font-medium text-[#3F232C]">
        Memuat Portal Admin by Adisss...
      </p>
    </div>
  );
}

function AppRoutes() {
  const { pathname } = useRouter();
  const normalizedPath = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;

  // Track page views and 30s heartbeat on public pages only
  useEffect(() => {
    if (normalizedPath.startsWith('/admin')) return;
    trackPublicPageView(normalizedPath);

    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        sendPublicHeartbeat(normalizedPath);
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [normalizedPath]);

  // Public Routes (Zero Firebase / Admin JS overhead)
  if (normalizedPath === '/') {
    return <PublicHomePage />;
  }
  if (normalizedPath === '/links') {
    return <PublicLinksPage />;
  }
  const categoryMatch = normalizedPath.match(/^\/category\/([^/]+)$/);
  if (categoryMatch) {
    return <PublicHomePage categorySlug={decodeURIComponent(categoryMatch[1])} />;
  }
  const productMatch = normalizedPath.match(/^\/product\/([^/]+)$/);
  if (productMatch) {
    return <PublicProductDetailPage slug={decodeURIComponent(productMatch[1])} />;
  }

  // Lazy-loaded Admin Routes (loads Firebase & Admin tools only when needed)
  if (normalizedPath.startsWith('/admin')) {
    return (
      <Suspense fallback={<AdminChunkLoader />}>
        <LazyAdminApp normalizedPath={normalizedPath} />
      </Suspense>
    );
  }

  return <NotFoundPage />;
}

export default function App() {
  return (
    <RouterProvider>
      <UiFeedbackProvider>
        <AppRoutes />
      </UiFeedbackProvider>
    </RouterProvider>
  );
}
