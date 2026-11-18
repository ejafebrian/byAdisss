import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowUpRight,
  ChevronRight,
  Search,
  ShoppingBag,
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
import { CatalogInlineLoader, CatalogLoader } from '../../components/CatalogLoader';
import { fetchHomeData, getCachedHome } from '../../lib/publicCache';
import { PublicShell } from './PublicShell';

export function PublicHomePage({ categorySlug }: { categorySlug?: string }) {
  const { navigate } = useRouter();
  const initialCacheRef = useRef(getCachedHome(categorySlug, ''));
  const initialCache = initialCacheRef.current;

  const [loading, setLoading] = useState(!initialCache);
  const [refreshingList, setRefreshingList] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<PublicProfile | null>(initialCache?.profile ?? null);
  const [banners, setBanners] = useState<PublicBanner[]>(initialCache?.banners ?? []);
  const [categories, setCategories] = useState<PublicCategory[]>(initialCache?.categories ?? []);
  const [featuredProducts, setFeaturedProducts] = useState<PublicProduct[]>(
    initialCache?.featuredProducts ?? []
  );
  const [products, setProducts] = useState<PublicProduct[]>(initialCache?.products ?? []);
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [reloadNonce, setReloadNonce] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchInput.trim()), 200);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    let active = true;
    const cached = getCachedHome(categorySlug, debouncedSearch);

    if (cached) {
      setProfile(cached.profile || null);
      setBanners(cached.banners || []);
      setCategories(cached.categories || []);
      setFeaturedProducts(cached.featuredProducts || []);
      setProducts(cached.products || []);
      setLoading(false);
      setRefreshingList(false);
    } else if (categories.length > 0) {
      setRefreshingList(true);
    } else {
      setLoading(true);
    }

    setError(null);

    fetchHomeData(categorySlug, debouncedSearch)
      .then((data) => {
        if (!active) return;
        setProfile(data.profile || null);
        setBanners(data.banners || []);
        setCategories(data.categories || []);
        setFeaturedProducts(data.featuredProducts || []);
        setProducts(data.products || []);
        setLoading(false);
        setRefreshingList(false);
      })
      .catch((err) => {
        if (!active) return;
        if (!cached) {
          setError(err?.message || 'Gagal memuat katalog');
        }
        setLoading(false);
        setRefreshingList(false);
      });

    return () => {
      active = false;
    };
  }, [categorySlug, debouncedSearch, reloadNonce]);

  const activeCategoryObj = categories.find((c) => c.slug === categorySlug);

  return (
    <PublicShell profile={profile} categories={categories} activeTab="catalog">
      {loading ? (
        <CatalogLoader />
      ) : (
        <div className="space-y-7 animate-fade-up-in">
          {/* Promotional Banner */}
          {banners.length > 0 && !categorySlug && !debouncedSearch && (
            <section aria-label="Sorotan Promo">
              {banners.slice(0, 2).map((banner, idx) => {
                const inner = (
                  <div className="group relative rounded-2xl overflow-hidden border border-[#F0C6D2] bg-[#FFF6F8] shadow-xs">
                    <div className="aspect-[16/9] w-full overflow-hidden">
                      <SafeImage
                        src={banner.imageUrl}
                        alt={banner.title}
                        fallbackLabel={banner.title}
                        priority={idx === 0}
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
                {featuredProducts.slice(0, 4).map((item, idx) => (
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
                        priority={idx < 2}
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
            <div className="flex items-baseline justify-between gap-2 mb-3">
              <div className="min-w-0">
                <h2 className="font-serif-display text-lg font-semibold text-[#3F232C]">
                  {activeCategoryObj ? activeCategoryObj.name : 'Semua Katalog Produk'}
                </h2>
                {activeCategoryObj?.description && (
                  <p className="text-xs text-[#7D4E5D] mt-0.5">{activeCategoryObj.description}</p>
                )}
              </div>
              <div className="flex items-center gap-3 shrink-0">
                {categorySlug && (
                  <button
                    type="button"
                    onClick={() => navigate('/')}
                    className="text-xs font-medium text-[#C25B7C] underline underline-offset-4 hover:text-[#A84867]"
                  >
                    Semua Produk
                  </button>
                )}
                {!refreshingList && (
                  <span className="text-xs text-[#7D4E5D] tabular-nums">
                    {products.length} item
                  </span>
                )}
              </div>
            </div>

            {refreshingList && <CatalogInlineLoader />}

            {!refreshingList && error && (
              <div className="rounded-2xl border border-red-200 bg-[#FFF5F5] p-5 text-center">
                <p className="text-sm text-red-900">{error}</p>
                <button
                  type="button"
                  onClick={() => setReloadNonce((n) => n + 1)}
                  className="mt-3 px-4 py-2 rounded-xl bg-[#C25B7C] hover:bg-[#A84867] text-white text-xs font-medium transition-colors"
                >
                  Coba Lagi
                </button>
              </div>
            )}

            {!refreshingList && !error && products.length === 0 && (
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

            {!refreshingList && !error && products.length > 0 && (
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
        </div>
      )}
    </PublicShell>
  );
}
