import React, { useEffect, useState } from 'react';
import { ArrowUpRight, ExternalLink, ShoppingBag, Sparkles, Tag } from 'lucide-react';
import { PublicCategory, PublicLink, PublicProfile } from '../../lib/types';
import { PublicShell } from './PublicShell';

function LinkIcon({ name }: { name?: string }) {
  switch (name) {
    case 'ShoppingBag':
      return <ShoppingBag className="w-5 h-5" />;
    case 'Sparkles':
      return <Sparkles className="w-5 h-5" />;
    case 'Tag':
      return <Tag className="w-5 h-5" />;
    default:
      return <ExternalLink className="w-5 h-5" />;
  }
}

export function PublicLinksPage() {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [categories, setCategories] = useState<PublicCategory[]>([]);
  const [links, setLinks] = useState<PublicLink[]>([]);

  useEffect(() => {
    fetch('/api/public/home')
      .then((res) => res.json())
      .then((data) => {
        setProfile(data.profile || null);
        setCategories(data.categories || []);
        setLinks(data.links || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <PublicShell profile={profile} categories={categories} activeTab="links">
      <section aria-label="Daftar Tautan Rekomendasi">
        <div className="mb-4">
          <h2 className="font-serif-display text-xl font-semibold text-[#3F232C]">
            Link & Koleksi Pilihan
          </h2>
          <p className="mt-1 text-xs text-[#7D4E5D]">
            Klik tautan di bawah untuk membuka koleksi kurasi atau promo aktif.
          </p>
        </div>

        {loading && (
          <div className="space-y-3">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className="h-20 rounded-2xl bg-[#FFF6F8] border border-[#F0C6D2]/60 animate-pulse"
              />
            ))}
          </div>
        )}

        {!loading && links.length === 0 && (
          <div className="rounded-2xl border border-[#F0C6D2] bg-[#FFF6F8] p-8 text-center">
            <p className="text-sm text-[#7D4E5D]">Belum ada tautan aktif saat ini.</p>
          </div>
        )}

        {!loading && links.length > 0 && (
          <div className="space-y-3">
            {links.map((link) => (
              <a
                key={link.id}
                href={`/l/${encodeURIComponent(link.slug)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="group min-h-[64px] flex items-center gap-3.5 p-4 rounded-2xl border border-[#F0C6D2] bg-[#FFF6F8] hover:bg-[#FDE8EE] transition-colors"
              >
                <span className="w-11 h-11 rounded-xl bg-[#FFFFFF] border border-[#F0C6D2] flex items-center justify-center text-[#C25B7C] shrink-0">
                  <LinkIcon name={link.icon} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-[#3F232C] leading-snug">
                    {link.title}
                  </div>
                  {link.description && (
                    <div className="mt-0.5 text-xs text-[#7D4E5D] line-clamp-2">
                      {link.description}
                    </div>
                  )}
                </div>
                <ArrowUpRight className="w-4 h-4 text-[#C25B7C] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform shrink-0" />
              </a>
            ))}
          </div>
        )}
      </section>
    </PublicShell>
  );
}
