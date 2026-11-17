import React, { useEffect, useState } from 'react';
import { ChevronRight, Instagram, Menu, Music2, X } from 'lucide-react';
import { PublicCategory, PublicProfile } from '../../lib/types';
import { SafeImage } from '../../components/SafeImage';
import { Link, useRouter } from '../../lib/router';

interface PublicShellProps {
  profile: PublicProfile | null;
  categories?: PublicCategory[];
  activeTab?: 'catalog' | 'links';
  children: React.ReactNode;
}

export function PublicShell({
  profile,
  categories,
  activeTab = 'catalog',
  children,
}: PublicShellProps) {
  const { pathname } = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [fallbackCategories, setFallbackCategories] = useState<PublicCategory[]>([]);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (categories && categories.length > 0) return;
    let active = true;
    fetch('/api/public/home')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (active && d?.categories) {
          setFallbackCategories(d.categories);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [categories]);

  const navCategories = categories && categories.length > 0 ? categories : fallbackCategories;

  return (
    <div className="min-h-screen bg-[#FFF6F8] md:bg-gradient-to-b md:from-[#FFF6F8] md:via-[#FDE8EE]/70 md:to-[#FADCE4]/50 py-0 md:py-8 px-0 md:px-4">
      <div className="mx-auto w-full max-w-[480px] min-h-screen md:min-h-0 bg-[#FFFFFF] md:rounded-3xl md:border md:border-[#F0C6D2] md:shadow-[0_16px_48px_rgba(194,91,124,0.12)] overflow-hidden flex flex-col relative">
        {/* Top Navbar with Catalog Hamburger Button (Zero Admin/Login menu) */}
        <nav
          aria-label="Menu Utama Katalog"
          className="sticky top-0 z-30 h-14 px-5 bg-[#FFFFFF]/95 backdrop-blur-xs border-b border-[#F0C6D2]/70 flex items-center justify-between"
        >
          <Link
            to="/"
            className="font-serif-display text-lg font-semibold tracking-tight text-[#3F232C] whitespace-nowrap"
          >
            {profile?.brandName || 'by Adisss'}
          </Link>

          <button
            type="button"
            onClick={() => setMenuOpen((prev) => !prev)}
            aria-expanded={menuOpen}
            aria-label={menuOpen ? 'Tutup menu katalog' : 'Buka menu katalog'}
            className="min-h-[44px] min-w-[44px] -mr-2 flex items-center justify-center rounded-xl text-[#C25B7C] hover:bg-[#FDE8EE] transition-colors"
          >
            {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </nav>

        {/* Hamburger Catalog Drawer (Strictly Catalog & Categories only) */}
        {menuOpen && (
          <div className="absolute inset-x-0 top-14 z-40 bg-[#FFFFFF] border-b border-[#F0C6D2] shadow-lg px-5 py-4 space-y-4">
            <div className="space-y-1">
              <Link
                to="/"
                onClick={() => setMenuOpen(false)}
                className={`min-h-[44px] flex items-center justify-between px-3.5 rounded-xl text-sm font-medium transition-colors ${
                  pathname === '/'
                    ? 'bg-[#FDE8EE] text-[#3F232C]'
                    : 'text-[#3F232C] hover:bg-[#FFF6F8]'
                }`}
              >
                <span>Semua Katalog Produk</span>
                <ChevronRight className="w-4 h-4 text-[#C25B7C]" />
              </Link>
              <Link
                to="/links"
                onClick={() => setMenuOpen(false)}
                className={`min-h-[44px] flex items-center justify-between px-3.5 rounded-xl text-sm font-medium transition-colors ${
                  pathname === '/links'
                    ? 'bg-[#FDE8EE] text-[#3F232C]'
                    : 'text-[#3F232C] hover:bg-[#FFF6F8]'
                }`}
              >
                <span>Link Pilihan</span>
                <ChevronRight className="w-4 h-4 text-[#C25B7C]" />
              </Link>
            </div>

            {navCategories.length > 0 && (
              <div className="pt-3 border-t border-[#F0C6D2]/60">
                <div className="px-3.5 mb-2 text-[11px] font-semibold tracking-[0.14em] uppercase text-[#C25B7C]">
                  Kategori Katalog
                </div>
                <div className="grid grid-cols-1 gap-1">
                  {navCategories.map((cat) => {
                    const isCatActive = pathname === `/category/${cat.slug}`;
                    return (
                      <Link
                        key={cat.id}
                        to={`/category/${cat.slug}`}
                        onClick={() => setMenuOpen(false)}
                        className={`min-h-[42px] flex items-center justify-between px-3.5 rounded-xl text-xs font-medium transition-colors ${
                          isCatActive
                            ? 'bg-[#C25B7C] text-[#FFFFFF]'
                            : 'text-[#3F232C] hover:bg-[#FFF6F8]'
                        }`}
                      >
                        <span>{cat.name}</span>
                        <span
                          className={`tabular-nums text-[11px] ${
                            isCatActive ? 'text-white/85' : 'text-[#7D4E5D]'
                          }`}
                        >
                          {cat.productCount ?? 0}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Profile Header */}
        <header className="px-6 pt-7 pb-6 bg-gradient-to-b from-[#FDE8EE]/85 via-[#FFF6F8] to-[#FFFFFF] text-center border-b border-[#F0C6D2]/55">
          <div className="mx-auto w-24 h-24 rounded-full p-1 bg-gradient-to-tr from-[#F0C6D2] via-[#FDE8EE] to-[#C25B7C]/40 shadow-sm">
            <SafeImage
              src={profile?.avatarUrl || '/src/assets/images/resty_profile_avatar_1794936986435.jpg'}
              alt={profile?.brandName || 'by Adisss'}
              className="w-full h-full rounded-full object-cover bg-[#FFF6F8]"
            />
          </div>

          <h1 className="mt-4 font-serif-display text-3xl font-semibold tracking-tight text-[#3F232C]">
            {profile?.brandName || 'by Adisss'}
          </h1>

          <p className="mt-1 text-xs font-medium tracking-[0.14em] text-[#C25B7C]">
            {profile?.username || '@adisssfinds'}
          </p>

          <p className="mt-2 text-[11px] font-semibold tracking-[0.18em] text-[#7D4E5D] uppercase">
            {profile?.tagline || 'GOOD FINDS, HAPPY BUYS!'}
          </p>

          <p className="mt-3 text-sm leading-relaxed text-[#3F232C]/85 max-w-[38ch] mx-auto">
            {profile?.description ||
              "Hi, I'm Adisss! ♡ Sharing cute finds, daily essentials, and little things worth buying."}
          </p>

          {/* Header Social Icons (Instagram & TikTok) */}
          {(profile?.instagramUrl || profile?.tiktokUrl) && (
            <div className="mt-5 flex items-center justify-center gap-3">
              {profile?.instagramUrl && (
                <a
                  href={profile.instagramUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Instagram by Adisss"
                  className="w-11 h-11 rounded-full bg-[#FFFFFF] border border-[#F0C6D2] flex items-center justify-center text-[#C25B7C] hover:bg-[#FDE8EE] hover:text-[#A84867] transition-colors shadow-xs"
                >
                  <Instagram className="w-5 h-5" />
                </a>
              )}
              {profile?.tiktokUrl && (
                <a
                  href={profile.tiktokUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="TikTok by Adisss"
                  className="w-11 h-11 rounded-full bg-[#FFFFFF] border border-[#F0C6D2] flex items-center justify-center text-[#C25B7C] hover:bg-[#FDE8EE] hover:text-[#A84867] transition-colors shadow-xs"
                >
                  <Music2 className="w-5 h-5" />
                </a>
              )}
            </div>
          )}

          {/* Primary Public Section Switcher */}
          <div className="mt-6 grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-[#FFF6F8] border border-[#F0C6D2]">
            <Link
              to="/"
              className={`min-h-[40px] flex items-center justify-center rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                activeTab === 'catalog'
                  ? 'bg-[#C25B7C] text-[#FFFFFF] shadow-xs'
                  : 'text-[#7D4E5D] hover:text-[#3F232C]'
              }`}
            >
              Katalog Produk
            </Link>
            <Link
              to="/links"
              className={`min-h-[40px] flex items-center justify-center rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                activeTab === 'links'
                  ? 'bg-[#C25B7C] text-[#FFFFFF] shadow-xs'
                  : 'text-[#7D4E5D] hover:text-[#3F232C]'
              }`}
            >
              Link Pilihan
            </Link>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 px-5 py-6 space-y-7">{children}</main>

        {/* Clean Footer without Instagram, TikTok, disclosure, or login */}
        <footer className="px-6 py-6 bg-[#FFF6F8] border-t border-[#F0C6D2]/70 text-center">
          <p className="font-serif-display text-base font-medium text-[#3F232C]">
            {profile?.footerText || 'Made with ♡ by Adisss'}
          </p>
        </footer>
      </div>
    </div>
  );
}
