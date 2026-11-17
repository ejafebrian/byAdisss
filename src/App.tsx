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

  // Public Routes
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

  // Admin Routes
  if (normalizedPath === '/admin/login') {
    return <AdminLoginPage />;
  }
  if (normalizedPath === '/admin') {
    return <AdminDashboardPage />;
  }
  if (normalizedPath === '/admin/analytics') {
    return <AdminDashboardPage isAnalyticsView />;
  }
  if (normalizedPath === '/admin/products') {
    return <AdminProductsPage />;
  }
  if (normalizedPath === '/admin/products/add') {
    return <AdminProductFormPage />;
  }
  const editMatch = normalizedPath.match(/^\/admin\/products\/(\d+)\/edit$/);
  if (editMatch) {
    return <AdminProductFormPage productId={Number(editMatch[1])} />;
  }
  if (normalizedPath === '/admin/products/import') {
    return <AdminImportPage />;
  }
  if (normalizedPath === '/admin/sandbox') {
    return <AdminSandboxPage />;
  }
  if (normalizedPath === '/admin/categories') {
    return <AdminCategoriesPage />;
  }
  if (normalizedPath === '/admin/links') {
    return <AdminLinksPage />;
  }
  if (normalizedPath === '/admin/banners') {
    return <AdminBannersPage />;
  }
  if (normalizedPath === '/admin/import-history') {
    return <AdminImportHistoryPage />;
  }
  if (normalizedPath === '/admin/settings') {
    return <AdminSettingsPage />;
  }
  if (normalizedPath === '/admin/profile') {
    return <AdminProfilePage />;
  }
  if (normalizedPath === '/admin/account') {
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
