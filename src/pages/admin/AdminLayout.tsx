import React, { useEffect, useState } from 'react';
import {
  BarChart3,
  ExternalLink,
  FileSpreadsheet,
  FlaskConical,
  FolderTree,
  History,
  Image as ImageIcon,
  LayoutDashboard,
  Link2,
  LogOut,
  Menu,
  Package,
  PlusCircle,
  Settings,
  Shield,
  UserCircle,
  X,
} from 'lucide-react';
import { useAuth } from '../../lib/authContext';
import { Link, useRouter } from '../../lib/router';

interface NavItem {
  label: string;
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  matchPrefix?: string;
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', to: '/admin', icon: LayoutDashboard },
  { label: 'Products', to: '/admin/products', icon: Package },
  { label: 'Add Product', to: '/admin/products/add', icon: PlusCircle },
  { label: 'Import & Google Sheet', to: '/admin/products/import', icon: FileSpreadsheet },
  { label: 'Link Sandbox', to: '/admin/sandbox', icon: FlaskConical },
  { label: 'Categories', to: '/admin/categories', icon: FolderTree },
  { label: 'Links', to: '/admin/links', icon: Link2 },
  { label: 'Banners', to: '/admin/banners', icon: ImageIcon },
  { label: 'Analytics', to: '/admin/analytics', icon: BarChart3 },
  { label: 'Import History', to: '/admin/import-history', icon: History },
  { label: 'Profile Settings', to: '/admin/profile', icon: UserCircle },
  { label: 'Website Settings', to: '/admin/settings', icon: Settings },
  { label: 'Admin Account', to: '/admin/account', icon: Shield },
];

export function AdminLayout({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const { admin, loading, logout } = useAuth();
  const { pathname, navigate } = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!loading && !admin) {
      navigate('/admin/login', { replace: true });
    }
  }, [loading, admin, navigate]);

  if (loading || !admin) {
    return (
      <div className="min-h-screen bg-[#FFF6F8] flex items-center justify-center p-6">
        <div className="text-center space-y-2">
          <div className="w-8 h-8 rounded-full border-2 border-[#F0C6D2] border-t-[#C25B7C] animate-spin mx-auto" />
          <p className="text-xs text-[#7D4E5D]">Memverifikasi sesi admin...</p>
        </div>
      </div>
    );
  }

  const isActiveNav = (to: string) => {
    if (to === '/admin') return pathname === '/admin';
    if (to === '/admin/products') {
      return (
        pathname === '/admin/products' ||
        /^\/admin\/products\/\d+\/edit$/.test(pathname)
      );
    }
    return pathname === to;
  };

  const handleLogout = async () => {
    await logout();
    navigate('/admin/login', { replace: true });
  };

  const sidebarContent = (
    <div className="flex flex-col h-full bg-[#FFFFFF] border-r border-[#F0C6D2]/85">
      <div className="h-16 px-5 flex items-center justify-between border-b border-[#F0C6D2]/75 shrink-0">
        <div>
          <div className="font-serif-display text-xl font-semibold text-[#3F232C] leading-none">
            by Adisss
          </div>
          <div className="text-[11px] text-[#C25B7C] mt-1">Affiliate Studio</div>
        </div>
        <button
          type="button"
          onClick={() => setMobileOpen(false)}
          className="lg:hidden p-2 text-[#7D4E5D] hover:text-[#3F232C]"
          aria-label="Tutup menu"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <nav aria-label="Menu Admin" className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = isActiveNav(item.to);
          return (
            <Link
              key={item.to}
              to={item.to}
              onClick={() => setMobileOpen(false)}
              className={`min-h-[42px] flex items-center gap-3 px-3.5 rounded-xl text-sm font-medium transition-colors whitespace-nowrap ${
                active
                  ? 'bg-[#FDE8EE] text-[#3F232C]'
                  : 'text-[#7D4E5D] hover:bg-[#FFF6F8] hover:text-[#3F232C]'
              }`}
            >
              <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-[#C25B7C]' : 'opacity-80'}`} />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="p-3 border-t border-[#F0C6D2]/75 space-y-1.5 shrink-0">
        <a
          href="/"
          target="_blank"
          rel="noopener noreferrer"
          className="min-h-[40px] flex items-center justify-between px-3.5 rounded-xl text-xs font-medium text-[#7D4E5D] hover:bg-[#FFF6F8] transition-colors"
        >
          <span>Lihat Katalog Publik</span>
          <ExternalLink className="w-3.5 h-3.5 text-[#C25B7C]" />
        </a>

        <button
          type="button"
          onClick={handleLogout}
          className="w-full min-h-[40px] flex items-center gap-3 px-3.5 rounded-xl text-xs font-medium text-red-700 hover:bg-red-50 transition-colors"
        >
          <LogOut className="w-4 h-4 shrink-0" />
          <span>Logout</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#FFF6F8] flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block w-64 shrink-0 sticky top-0 h-screen">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-[#3F232C]/40"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative w-64 max-w-[85vw] h-full z-10">{sidebarContent}</aside>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-30 h-16 bg-[#FFFFFF]/95 backdrop-blur-xs border-b border-[#F0C6D2]/85 px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              aria-label="Buka menu navigasi"
              className="lg:hidden min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl border border-[#F0C6D2] text-[#C25B7C]"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <h1 className="font-serif-display text-lg sm:text-xl font-semibold text-[#3F232C] truncate">
                {title}
              </h1>
              {subtitle && (
                <p className="hidden sm:block text-xs text-[#7D4E5D] truncate">{subtitle}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {actions}
            <div className="hidden md:flex items-center gap-2 pl-3 border-l border-[#F0C6D2]">
              <div className="text-right">
                <div className="text-xs font-medium text-[#3F232C]">{admin.displayName}</div>
                <div className="text-[11px] text-[#C25B7C]">{admin.role}</div>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1440px] w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
