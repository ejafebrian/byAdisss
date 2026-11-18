import React from 'react';
import { AuthProvider } from '../../lib/authContext';
import { AdminLoginPage } from './AdminLoginPage';
import { AdminDashboardPage } from './AdminDashboardPage';
import { AdminProductsPage } from './AdminProductsPage';
import { AdminProductFormPage } from './AdminProductFormPage';
import { AdminImportPage } from './AdminImportPage';
import { AdminImportHistoryPage } from './AdminImportHistoryPage';
import { AdminCategoriesPage } from './AdminCategoriesPage';
import { AdminLinksPage } from './AdminLinksPage';
import { AdminBannersPage } from './AdminBannersPage';
import { AdminProfilePage } from './AdminProfilePage';
import { AdminSettingsPage } from './AdminSettingsPage';
import { AdminAccountsPage } from './AdminAccountsPage';
import { AdminSandboxPage } from './AdminSandboxPage';
import { NotFoundPage } from '../NotFoundPage';

export default function AdminApp({ normalizedPath }: { normalizedPath: string }) {
  const renderAdminRoute = () => {
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
  };

  return <AuthProvider>{renderAdminRoute()}</AuthProvider>;
}
