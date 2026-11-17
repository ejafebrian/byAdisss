import React from 'react';
import { Link } from '../lib/router';

export function NotFoundPage() {
  return (
    <div className="min-h-screen bg-[#FFF6F8] flex items-center justify-center p-6">
      <div className="max-w-md w-full rounded-3xl bg-[#FFFFFF] border border-[#F0C6D2] p-8 text-center shadow-sm">
        <div className="text-xs font-semibold tracking-[0.18em] text-[#C25B7C]">404</div>
        <h1 className="mt-2 font-serif-display text-2xl font-semibold text-[#3F232C]">
          Halaman Tidak Ditemukan
        </h1>
        <p className="mt-2 text-sm text-[#7D4E5D] leading-relaxed">
          Maaf, halaman atau produk yang kamu cari tidak tersedia di by Adisss.
        </p>
        <Link
          to="/"
          className="mt-6 inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-[#C25B7C] hover:bg-[#A84867] text-[#FFFFFF] text-sm font-medium transition-colors"
        >
          Kembali ke Beranda
        </Link>
      </div>
    </div>
  );
}
