import React, { useEffect, useState } from 'react';
import {
  ArrowUpRight,
  ChevronRight,
  Coffee,
  Flame,
  Home,
  Search,
  ShoppingBag,
  Sparkles,
  Tag,
  X,
} from 'lucide-react';
import {
  formatIdr,
  PublicBanner,
  PublicCategory,
  PublicProduct,
  PublicProfile,
} from '../../lib/types';
import { Link, useRouter } from '../../lib/router';
import { SafeImage } from '../../components/SafeImage';
import { PublicShell } from './PublicShell';

function CategoryIcon({ name, className = 'w-4 h-4' }: { name?: string; className?: string }) {
  switch (name) {
    case 'Flame':
      return <Flame className={className} />;
    case 'ShoppingBag':
      return <ShoppingBag className={className} />;
    case 'Home':
      return <Home className={className} />;
    case 'Coffee':
      return <Coffee className={className} />;
    case 'Tag':
      return <Tag className={className} />;
    default:
      return <Sparkles className={className} />;
  }
}

export function PublicHomePage({ categorySlug }: { categorySlug?: string }) {
  const { navigate } = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [banners, setBanners] = useState<PublicBanner[]>([]);
  const [categories, setCategories] = useState<PublicCategory[]>([]);
  const [featuredProducts, setFeaturedProducts] = useState<PublicProduct[]>([]);
  const [products, setProducts] = useState<PublicProduct[]>([]);
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchInput.trim()), 260);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    const params = new URLSearchParams();
    if (categorySlug) params.set('category', categorySlug);
    if (debouncedSearch) params.set('search', debouncedSearch);

    fetch(`/api/public/home?${params.toString()}`)
      .then(async (res) => {
        if (!res.ok) throw new Error('Gagal memuat katalog');
        return res.json();
      })
      .then((data) => {
        if (!active) return;
        setProfile(data.profile || null);
        setBanners(data.banners || []);
        setCategories(data.categories || []);
        setFeaturedProducts(data.featuredProducts || []);
        setProducts(data.products || []);
        setLoading(false);
      })
      .catch((err) => {
        if (!active) return;
        setError(err?.message || 'Gagal memuat katalog');
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [categorySlug, debouncedSearch]);

  const activeCategoryObj = categories.find((c) => c.slug === categorySlug);

  return (
    <PublicShell profile={profile} categories={categories} activeTab="catalog">
      {/* Promotional Banner */}
      {banners.length > 0 && !categorySlug && !debouncedSearch && (
        <section aria-label="Sorotan Promo">
          {banners.slice(0, 2).map((banner) => {
            const inner = (
              <div className="group relative rounded-2xl overflow-hidden border border-[#F0C6D2] bg-[#FFF6F8] shadow-xs">
                <div className="aspect-[16/9] w-full overflow-hidden">
                  <SafeImage
                    src={banner.imageUrl}
                    alt={banner.title}
                    fallbackLabel={banner.title}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                  />
                </div>
                <div className="p-4 bg-gradient-to-r from-[#FFF6F8] to-[#FDE8EE]">
                  <h2 className="font-serif-display text-lg font-semibold text-[#3F232C] text-balance">
                    {banner.title}
                  </h2>
                  {banner.description && (
                    <p className="mt-1 text-xs text-[#7D4E5D] leading-relaxed">
                      {banner.description}
                    </p>
                  )}
                </div>
              </div>
            );

            if (banner.targetUrl) {
              const isInternalAnchor = banner.targetUrl.startsWith('#');
              const isExternal = /^https?:\/\//i.test(banner.targetUrl);
              return (
                <a
                  key={banner.id}
                  href={banner.targetUrl}
                  target={isExternal ? '_blank' : undefined}
                  rel={isExternal ? 'noopener noreferrer' : undefined}
                  onClick={(e) => {
                    if (isInternalAnchor) {
                      e.preventDefault();
                      document
                        .getElementById(banner.targetUrl.slice(1))
                        ?.scrollIntoView({ behavior: 'smooth' });
                    }
                  }}
                  className="block mb-3 last:mb-0"
                >
                  {inner}
                </a>
              );
            }
            return (
              <div key={banner.id} className="mb-3 last:mb-0">
                {inner}
              </div>
            );
          })}
        </section>
      )}

      {/* Search Bar */}
      <section aria-label="Pencarian Produk">
        <div className="relative">
          <Search
            className="w-4 h-4 text-[#C25B7C] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
            aria-hidden="true"
          />
          <input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Cari rekomendasi produk..."
            aria-label="Cari rekomendasi produk"
            className="w-full min-h-[44px] pl-10 pr-10 rounded-xl bg-[#FFF6F8] border border-[#F0C6D2] text-sm text-[#3F232C] placeholder:text-[#7D4E5D]/65 focus:outline-none focus:ring-2 focus:ring-[#C25B7C]/25 focus:border-[#C25B7C]"
          />
          {searchInput && (
            <button
              type="button"
              onClick={() => setSearchInput('')}
              aria-label="Hapus pencarian"
              className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center text-[#7D4E5D] hover:text-[#3F232C]"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </section>

      {/* Categories Grid */}
      {categories.length > 0 && (
        <section aria-label="Kategori Produk">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-serif-display text-lg font-semibold text-[#3F232C]">
              Kategori Pilihan
            </h2>
            {categorySlug && (
              <button
                type="button"
                onClick={() => navigate('/')}
                className="text-xs font-medium text-[#C25B7C] underline underline-offset-4 hover:text-[#A84867]"
              >
                Lihat Semua
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            {categories.map((cat) => {
              const selected = cat.slug === categorySlug;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => navigate(selected ? '/' : `/category/${cat.slug}`)}
                  className={`min-h-[52px] flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border text-left transition-colors ${
                    selected
                      ? 'bg-[#C25B7C] border-[#C25B7C] text-[#FFFFFF]'
                      : 'bg-[#FFF6F8] border-[#F0C6D2] text-[#3F232C] hover:bg-[#FDE8EE]'
                  }`}
                >
                  <span
                    className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                      selected ? 'bg-white/20 text-white' : 'bg-[#FDE8EE] text-[#C25B7C]'
                    }`}
                  >
                    <CategoryIcon name={cat.icon} className="w-4 h-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold truncate">{cat.name}</div>
                    <div
                      className={`text-[11px] tabular-nums ${
                        selected ? 'text-white/85' : 'text-[#7D4E5D]'
                      }`}
                    >
                      {cat.productCount ?? 0} produk
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* Featured Products */}
      {!categorySlug && !debouncedSearch && featuredProducts.length > 0 && (
        <section aria-label="Produk Unggulan">
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="font-serif-display text-lg font-semibold text-[#3F232C]">
              Pilihan Unggulan Adisss
            </h2>
            <span className="text-xs text-[#C25B7C] font-medium">Kurasi favorit</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {featuredProducts.slice(0, 4).map((item) => (
              <article
                key={item.id}
                className="rounded-2xl border border-[#F0C6D2] bg-[#FFFFFF] overflow-hidden flex flex-col shadow-[0_4px_14px_rgba(194,91,124,0.06)]"
              >
                <Link
                  to={`/product/${item.productSlug}`}
                  className="block aspect-[4/3] overflow-hidden bg-[#FFF6F8]"
                >
                  <SafeImage
                    src={item.imageUrl}
                    alt={item.productName}
                    fallbackLabel={item.productName}
                    className="w-full h-full object-cover hover:scale-[1.03] transition-transform duration-300"
                  />
                </Link>
                <div className="p-3 flex-1 flex flex-col">
                  {(item.label || item.categoryName) && (
                    <div className="text-[10px] font-medium tracking-wide text-[#C25B7C] truncate">
                      {[item.label, item.categoryName].filter(Boolean).join(' · ')}
                    </div>
                  )}
                  <Link
                    to={`/product/${item.productSlug}`}
                    className="mt-1 text-xs font-semibold text-[#3F232C] line-clamp-2 hover:text-[#C25B7C]"
                  >
                    {item.productName}
                  </Link>
                  {formatIdr(item.price) && (
                    <div className="mt-1.5 text-xs font-semibold text-[#7D4E5D] tabular-nums">
                      {formatIdr(item.price)}
                    </div>
                  )}
                  <div className="mt-auto pt-2.5">
                    <a
                      href={`/go/${encodeURIComponent(item.productSlug)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full min-h-[38px] inline-flex items-center justify-center gap-1 rounded-xl bg-[#C25B7C] hover:bg-[#A84867] text-[#FFFFFF] text-xs font-medium transition-colors"
                    >
                      <span>Lihat Produk</span>
                      <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />
                    </a>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {/* Main Catalog */}
      <section id="catalog" aria-label="Katalog Produk">
        <div className="flex items-baseline justify-between mb-3">
          <div>
            <h2 className="font-serif-display text-lg font-semibold text-[#3F232C]">
              {activeCategoryObj ? activeCategoryObj.name : 'Semua Katalog Produk'}
            </h2>
            {activeCategoryObj?.description && (
              <p className="text-xs text-[#7D4E5D] mt-0.5">{activeCategoryObj.description}</p>
            )}
          </div>
          {!loading && (
            <span className="text-xs text-[#7D4E5D] tabular-nums shrink-0">
              {products.length} item
            </span>
          )}
        </div>

        {loading && (
          <div className="space-y-3" aria-busy="true">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className="h-28 rounded-2xl bg-[#FFF6F8] border border-[#F0C6D2]/60 animate-pulse"
              />
            ))}
          </div>
        )}

        {!loading && error && (
          <div className="rounded-2xl border border-red-200 bg-[#FFF5F5] p-5 text-center">
            <p className="text-sm text-red-900">{error}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-3 px-4 py-2 rounded-xl bg-[#C25B7C] text-white text-xs font-medium"
            >
              Muat Ulang
            </button>
          </div>
        )}

        {!loading && !error && products.length === 0 && (
          <div className="rounded-2xl border border-[#F0C6D2] bg-[#FFF6F8] p-8 text-center">
            <ShoppingBag className="w-8 h-8 text-[#C25B7C]/55 mx-auto mb-2" />
            <p className="text-sm font-medium text-[#3F232C]">
              Belum ada produk yang sesuai filter ini.
            </p>
            <p className="mt-1 text-xs text-[#7D4E5D]">
              Coba kata kunci lain atau lihat semua kategori.
            </p>
            {(categorySlug || searchInput) && (
              <button
                type="button"
                onClick={() => {
                  setSearchInput('');
                  navigate('/');
                }}
                className="mt-4 px-4 py-2 rounded-xl bg-[#C25B7C] text-white text-xs font-medium"
              >
                Reset Filter
              </button>
            )}
          </div>
        )}

        {!loading && !error && products.length > 0 && (
          <div className="space-y-3">
            {products.map((item) => (
              <article
                key={item.id}
                className="rounded-2xl border border-[#F0C6D2] bg-[#FFFFFF] p-3 flex gap-3.5 items-stretch shadow-[0_2px_10px_rgba(194,91,124,0.05)] hover:border-[#C25B7C]/60 transition-colors"
              >
                <Link
                  to={`/product/${item.productSlug}`}
                  className="w-24 sm:w-28 aspect-[4/3] rounded-xl overflow-hidden bg-[#FFF6F8] shrink-0 self-center"
                >
                  <SafeImage
                    src={item.imageUrl}
                    alt={item.productName}
                    fallbackLabel={item.productName}
                    className="w-full h-full object-cover"
                  />
                </Link>

                <div className="min-w-0 flex-1 flex flex-col justify-between">
                  <div>
                    {(item.label || item.categoryName) && (
                      <div className="text-[11px] font-medium text-[#C25B7C] truncate">
                        {[item.label, item.categoryName].filter(Boolean).join(' · ')}
                      </div>
                    )}
                    <Link
                      to={`/product/${item.productSlug}`}
                      className="mt-0.5 block text-sm font-semibold text-[#3F232C] leading-snug line-clamp-2 hover:text-[#C25B7C]"
                    >
                      {item.productName}
                    </Link>
                    {item.description && (
                      <p className="mt-1 text-xs text-[#7D4E5D] line-clamp-2 leading-relaxed">
                        {item.description}
                      </p>
                    )}
                  </div>

                  <div className="mt-2.5 flex items-center justify-between gap-2">
                    <div className="text-sm font-semibold text-[#3F232C] tabular-nums">
                      {formatIdr(item.price) || 'Cek Harga Shopee'}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Link
                        to={`/product/${item.productSlug}`}
                        aria-label={`Detail ${item.productName}`}
                        className="min-h-[38px] px-2.5 inline-flex items-center justify-center rounded-xl border border-[#F0C6D2] text-xs font-medium text-[#7D4E5D] hover:bg-[#FFF6F8]"
                      >
                        Detail
                      </Link>
                      <a
                        href={`/go/${encodeURIComponent(item.productSlug)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="min-h-[38px] px-3 inline-flex items-center justify-center gap-1 rounded-xl bg-[#C25B7C] hover:bg-[#A84867] text-[#FFFFFF] text-xs font-medium transition-colors whitespace-nowrap"
                      >
                        <span>Lihat Produk</span>
                        <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
                      </a>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </PublicShell>
  );
}
