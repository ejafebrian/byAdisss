import React, { useEffect } from 'react';
import { AuthProvider } from './lib/authContext';
import { RouterProvider, useRouter } from './lib/router';
import { sendPublicHeartbeat, trackPublicPageView } from './lib/tracking';
import { UiFeedbackProvider } from './components/Toast';
import { PublicHomePage } from './pages/public/PublicHomePage';
import { PublicLinksPage } from './pages/public/PublicLinksPage';
import { PublicProductDetailPage } from './pages/public/PublicProductDetailPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { AdminLoginPage } from './pages/admin/AdminLoginPage';
import { AdminDashboardPage } from './pages/admin/AdminDashboardPage';
import { AdminProductsPage } from './pages/admin/AdminProductsPage';
import { AdminProductFormPage } from './pages/admin/AdminProductFormPage';
import { AdminImportPage } from './pages/admin/AdminImportPage';
import { AdminImportHistoryPage } from './pages/admin/AdminImportHistoryPage';
import { AdminCategoriesPage } from './pages/admin/AdminCategoriesPage';
import { AdminLinksPage } from './pages/admin/AdminLinksPage';
import { AdminBannersPage } from './pages/admin/AdminBannersPage';
import { AdminProfilePage } from './pages/admin/AdminProfilePage';
import { AdminSettingsPage } from './pages/admin/AdminSettingsPage';
import { AdminAccountsPage } from './pages/admin/AdminAccountsPage';
import { AdminSandboxPage } from './pages/admin/AdminSandboxPage';

function AppRoutes() {
  const { pathname } = useRouter();

  // Track page views and 30s heartbeat on public pages only
  useEffect(() => {
    if (pathname.startsWith('/admin')) return;
    trackPublicPageView(pathname);

    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        sendPublicHeartbeat(pathname);
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [pathname]);

  // Public Routes
  if (pathname === '/') {
    return <PublicHomePage />;
  }
  if (pathname === '/links') {
    return <PublicLinksPage />;
  }
  const categoryMatch = pathname.match(/^\/category\/([^/]+)$/);
  if (categoryMatch) {
    return <PublicHomePage categorySlug={decodeURIComponent(categoryMatch[1])} />;
  }
  const productMatch = pathname.match(/^\/product\/([^/]+)$/);
  if (productMatch) {
    return <PublicProductDetailPage slug={decodeURIComponent(productMatch[1])} />;
  }

  // Admin Routes
  if (pathname === '/admin/login') {
    return <AdminLoginPage />;
  }
  if (pathname === '/admin') {
    return <AdminDashboardPage />;
  }
  if (pathname === '/admin/analytics') {
    return <AdminDashboardPage isAnalyticsView />;
  }
  if (pathname === '/admin/products') {
    return <AdminProductsPage />;
  }
  if (pathname === '/admin/products/add') {
    return <AdminProductFormPage />;
  }
  const editMatch = pathname.match(/^\/admin\/products\/(\d+)\/edit$/);
  if (editMatch) {
    return <AdminProductFormPage productId={Number(editMatch[1])} />;
  }
  if (pathname === '/admin/products/import') {
    return <AdminImportPage />;
  }
  if (pathname === '/admin/sandbox') {
    return <AdminSandboxPage />;
  }
  if (pathname === '/admin/categories') {
    return <AdminCategoriesPage />;
  }
  if (pathname === '/admin/links') {
    return <AdminLinksPage />;
  }
  if (pathname === '/admin/banners') {
    return <AdminBannersPage />;
  }
  if (pathname === '/admin/import-history') {
    return <AdminImportHistoryPage />;
  }
  if (pathname === '/admin/settings') {
    return <AdminSettingsPage />;
  }
  if (pathname === '/admin/profile') {
    return <AdminProfilePage />;
  }
  if (pathname === '/admin/account') {
    return <AdminAccountsPage />;
  }

  return <NotFoundPage />;
}

export default function App() {
  return (
    <RouterProvider>
      <AuthProvider>
        <UiFeedbackProvider>
          <AppRoutes />
        </UiFeedbackProvider>
      </AuthProvider>
    </RouterProvider>
  );
}
