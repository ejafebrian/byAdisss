import React, { useEffect, useState } from 'react';
import { ArrowLeft, ArrowUpRight, ShieldCheck } from 'lucide-react';
import { formatIdr, PublicProduct, PublicProfile } from '../../lib/types';
import { Link } from '../../lib/router';
import { SafeImage } from '../../components/SafeImage';
import { ProductDetailLoader } from '../../components/CatalogLoader';
import { fetchProductDetail, getCachedProduct } from '../../lib/publicCache';
import { PublicShell } from './PublicShell';

export function PublicProductDetailPage({ slug }: { slug: string }) {
  const cached = getCachedProduct(slug);
  const [loading, setLoading] = useState(!cached);
  const [notFound, setNotFound] = useState(false);
  const [profile, setProfile] = useState<PublicProfile | null>(cached?.profile ?? null);
  const [product, setProduct] = useState<PublicProduct | null>(cached?.product ?? null);
  const [related, setRelated] = useState<PublicProduct[]>(cached?.related ?? []);

  useEffect(() => {
    let active = true;
    const prefill = getCachedProduct(slug);
    if (prefill) {
      setProfile(prefill.profile || null);
      setProduct(prefill.product || null);
      setRelated(prefill.related || []);
      setLoading(false);
    } else {
      setLoading(true);
    }
    setNotFound(false);

    fetchProductDetail(slug)
      .then((data) => {
        if (!active) return;
        if (!data) {
          setNotFound(true);
          setLoading(false);
          return;
        }
        setProfile(data.profile || null);
        setProduct(data.product || null);
        setRelated(data.related || []);
        setLoading(false);
      })
      .catch(() => {
        if (active && !prefill) {
          setNotFound(true);
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [slug]);

  return (
    <PublicShell profile={profile} activeTab="catalog">
      <div>
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-[#C25B7C] hover:text-[#A84867]"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Kembali ke Katalog</span>
        </Link>
      </div>

      {loading && <ProductDetailLoader />}

      {!loading && (notFound || !product) && (
        <div className="rounded-2xl border border-[#F0C6D2] bg-[#FFF6F8] p-8 text-center">
          <h2 className="font-serif-display text-xl font-semibold text-[#3F232C]">
            Produk Tidak Ditemukan
          </h2>
          <p className="mt-2 text-xs text-[#7D4E5D]">
            Produk ini mungkin sudah dinonaktifkan atau dipindahkan dari katalog.
          </p>
          <Link
            to="/"
            className="mt-5 inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-[#C25B7C] text-white text-xs font-medium"
          >
            Lihat Produk Lainnya
          </Link>
        </div>
      )}

      {!loading && product && (
        <article className="space-y-5 animate-fade-up-in">
          <div className="aspect-[4/3] rounded-2xl overflow-hidden border border-[#F0C6D2] bg-[#FFF6F8]">
            <SafeImage
              src={product.imageUrl}
              alt={product.productName}
              fallbackLabel={product.productName}
              priority
              className="w-full h-full object-cover"
            />
          </div>

          <div>
            {(product.productNumber || product.label || product.categoryName) && (
              <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-[#C25B7C]">
                {product.productNumber ? (
                  <span className="px-2 py-0.5 rounded-md bg-[#FFF6F8] border border-[#F0C6D2] font-mono-tabular font-semibold text-[#C25B7C]">
                    #{product.productNumber}
                  </span>
                ) : null}
                <span>{[product.label, product.categoryName].filter(Boolean).join(' · ')}</span>
              </div>
            )}
            <h2 className="mt-1 font-serif-display text-2xl font-semibold text-[#3F232C] text-balance">
              {product.productName}
            </h2>
            {formatIdr(product.price) && (
              <div className="mt-2 text-lg font-semibold text-[#7D4E5D] tabular-nums">
                {formatIdr(product.price)}
              </div>
            )}
          </div>

          {product.description && (
            <p className="text-sm leading-relaxed text-[#3F232C]/85 whitespace-pre-line">
              {product.description}
            </p>
          )}

          <div className="pt-2 space-y-2.5">
            <a
              href={`/go/${encodeURIComponent(product.productSlug)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full min-h-[48px] inline-flex items-center justify-center gap-2 rounded-xl bg-[#C25B7C] hover:bg-[#A84867] text-[#FFFFFF] text-sm font-medium transition-colors shadow-sm"
            >
              <span>Lihat Produk di Shopee</span>
              <ArrowUpRight className="w-4 h-4" />
            </a>
            <div className="flex items-center justify-center gap-1.5 text-[11px] text-[#7D4E5D]">
              <ShieldCheck className="w-3.5 h-3.5 text-[#C25B7C]" aria-hidden="true" />
              <span>Link terverifikasi melalui katalog resmi {profile?.brandName || 'by Adisss'}</span>
            </div>
          </div>

          {related.length > 0 && (
            <section className="pt-5 border-t border-[#F0C6D2]/60">
              <h3 className="font-serif-display text-base font-semibold text-[#3F232C] mb-3">
                Rekomendasi Serupa
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {related.map((rel) => (
                  <Link
                    key={rel.id}
                    to={`/product/${rel.productSlug}`}
                    className="rounded-xl border border-[#F0C6D2] bg-[#FFF6F8] overflow-hidden block hover:border-[#C25B7C] transition-colors"
                  >
                    <div className="aspect-[4/3] overflow-hidden">
                      <SafeImage
                        src={rel.imageUrl}
                        alt={rel.productName}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="p-2.5">
                      <div className="text-xs font-semibold text-[#3F232C] line-clamp-1">
                        {rel.productNumber ? `#${rel.productNumber} · ` : ''}
                        {rel.productName}
                      </div>
                      {formatIdr(rel.price) && (
                        <div className="mt-0.5 text-[11px] text-[#7D4E5D] tabular-nums">
                          {formatIdr(rel.price)}
                        </div>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </article>
      )}
    </PublicShell>
  );
}
