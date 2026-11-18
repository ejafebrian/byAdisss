import React, { useEffect, useState } from 'react';
import { Heart, ShoppingBag } from 'lucide-react';

const LOADING_MESSAGES = [
  'Menyiapkan kurasi favorit by Adisss...',
  'Mengambil produk Shopee pilihan terbaikmu...',
  'Sebentar lagi ya, katalog cantikmu hampir siap...',
  'Merapikan kategori & penawaran spesial...',
];

function BoutiqueStatusBanner() {
  const [msgIndex, setMsgIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setMsgIndex((prev) => (prev + 1) % LOADING_MESSAGES.length);
    }, 1800);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="rounded-2xl border border-[#F0C6D2] bg-gradient-to-br from-[#FFF6F8] via-[#FFFFFF] to-[#FDE8EE]/80 p-4 shadow-[0_6px_20px_rgba(194,91,124,0.08)]">
      <div className="flex items-center gap-3.5">
        <div className="relative w-12 h-12 shrink-0 flex items-center justify-center">
          <div
            className="absolute inset-0 rounded-full border-2 border-[#F0C6D2]/60 border-t-[#C25B7C] border-r-[#C25B7C]/70 animate-orbit-spin"
            aria-hidden="true"
          />
          <div className="w-9 h-9 rounded-full bg-[#FDE8EE] flex items-center justify-center text-[#C25B7C] animate-float-gentle">
            <ShoppingBag className="w-4 h-4" aria-hidden="true" />
          </div>
          <Heart
            className="w-3 h-3 text-[#C25B7C] fill-[#C25B7C] absolute -bottom-0.5 -right-0.5"
            aria-hidden="true"
          />
        </div>

        <div className="min-w-0 flex-1">
          <p className="font-serif-display text-sm font-semibold text-[#3F232C]">
            Memuat Katalog by Adisss
          </p>
          <p
            key={msgIndex}
            className="mt-0.5 text-xs text-[#7D4E5D] animate-fade-up-in truncate"
          >
            {LOADING_MESSAGES[msgIndex]}
          </p>
          <div
            className="mt-2.5 h-1.5 w-full rounded-full bg-[#FDE8EE] overflow-hidden"
            aria-hidden="true"
          >
            <div className="h-full w-2/5 rounded-full bg-gradient-to-r from-[#F0C6D2] via-[#C25B7C] to-[#F0C6D2] animate-progress-glide" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function CatalogLoader() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Memuat katalog produk">
      <BoutiqueStatusBanner />

      {/* Banner Skeleton */}
      <div className="rounded-2xl overflow-hidden border border-[#F0C6D2]/80 bg-[#FFFFFF]">
        <div className="aspect-[16/9] w-full rose-shimmer" />
        <div className="p-4 space-y-2 bg-[#FFF6F8]">
          <div className="h-4 w-2/3 rounded-md rose-shimmer" />
          <div className="h-3 w-5/6 rounded-md rose-shimmer" />
        </div>
      </div>

      {/* Featured Cards Skeleton */}
      <div>
        <div className="h-4 w-40 rounded-md rose-shimmer mb-3" />
        <div className="grid grid-cols-2 gap-3">
          {[1, 2].map((n) => (
            <div
              key={n}
              className="rounded-2xl border border-[#F0C6D2]/70 bg-[#FFFFFF] overflow-hidden"
            >
              <div className="aspect-[4/3] w-full rose-shimmer" />
              <div className="p-3 space-y-2">
                <div className="h-2.5 w-1/2 rounded rose-shimmer" />
                <div className="h-3.5 w-full rounded rose-shimmer" />
                <div className="h-3 w-2/5 rounded rose-shimmer" />
                <div className="h-9 w-full rounded-xl rose-shimmer mt-2" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Catalog List Skeleton */}
      <div className="space-y-3">
        {[1, 2, 3].map((n) => (
          <div
            key={n}
            className="rounded-2xl border border-[#F0C6D2]/70 bg-[#FFFFFF] p-3 flex gap-3.5 items-center"
          >
            <div className="w-24 sm:w-28 aspect-[4/3] rounded-xl rose-shimmer shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-2.5 w-1/3 rounded rose-shimmer" />
              <div className="h-3.5 w-5/6 rounded rose-shimmer" />
              <div className="h-3 w-1/2 rounded rose-shimmer" />
              <div className="flex justify-between items-center pt-1">
                <div className="h-3.5 w-20 rounded rose-shimmer" />
                <div className="h-8 w-24 rounded-xl rose-shimmer" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function CatalogInlineLoader() {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Memperbarui daftar produk">
      <div
        className="h-1.5 w-full rounded-full bg-[#FDE8EE] overflow-hidden"
        aria-hidden="true"
      >
        <div className="h-full w-2/5 rounded-full bg-gradient-to-r from-[#F0C6D2] via-[#C25B7C] to-[#F0C6D2] animate-progress-glide" />
      </div>
      {[1, 2, 3].map((n) => (
        <div
          key={n}
          className="rounded-2xl border border-[#F0C6D2]/70 bg-[#FFFFFF] p-3 flex gap-3.5 items-center"
        >
          <div className="w-24 sm:w-28 aspect-[4/3] rounded-xl rose-shimmer shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-2.5 w-1/3 rounded rose-shimmer" />
            <div className="h-3.5 w-5/6 rounded rose-shimmer" />
            <div className="flex justify-between items-center pt-2">
              <div className="h-3.5 w-20 rounded rose-shimmer" />
              <div className="h-8 w-24 rounded-xl rose-shimmer" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function LinksLoader() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Memuat daftar tautan">
      <BoutiqueStatusBanner />
      <div className="space-y-3">
        {[1, 2, 3].map((n) => (
          <div
            key={n}
            className="h-20 rounded-2xl border border-[#F0C6D2]/70 bg-[#FFF6F8] p-4 flex items-center gap-3.5"
          >
            <div className="w-11 h-11 rounded-xl rose-shimmer shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-3.5 w-3/4 rounded rose-shimmer" />
              <div className="h-3 w-1/2 rounded rose-shimmer" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ProductDetailLoader() {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Memuat detail produk">
      <BoutiqueStatusBanner />
      <div className="aspect-[4/3] rounded-2xl border border-[#F0C6D2]/80 rose-shimmer" />
      <div className="space-y-2.5">
        <div className="h-3 w-1/3 rounded rose-shimmer" />
        <div className="h-6 w-4/5 rounded rose-shimmer" />
        <div className="h-5 w-1/3 rounded rose-shimmer" />
      </div>
      <div className="space-y-2">
        <div className="h-3 w-full rounded rose-shimmer" />
        <div className="h-3 w-5/6 rounded rose-shimmer" />
      </div>
      <div className="h-12 w-full rounded-xl rose-shimmer" />
    </div>
  );
}
