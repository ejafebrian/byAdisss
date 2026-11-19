import React, { useEffect, useState } from 'react';
import { ArrowLeft, CheckCircle2, AlertCircle, FlaskConical, Hash, Save, Sparkles, Upload } from 'lucide-react';
import { useAuth } from '../../lib/authContext';
import { Link, useRouter } from '../../lib/router';
import { PublicCategory } from '../../lib/types';
import { SafeImage } from '../../components/SafeImage';
import { useUiFeedback } from '../../components/Toast';
import { invalidateClientCatalogCache } from '../../lib/publicCache';
import { AdminLayout } from './AdminLayout';

function slugifyClient(str: string) {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function AdminProductFormPage({ productId }: { productId?: number }) {
  const isEdit = Boolean(productId);
  const { authFetch } = useAuth();
  const { navigate } = useRouter();
  const { notifySuccess, notifyError } = useUiFeedback();

  const [categories, setCategories] = useState<PublicCategory[]>([]);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [testingSandbox, setTestingSandbox] = useState(false);
  const [sandboxStatus, setSandboxStatus] = useState<{ ok: boolean; text: string } | null>(null);

  const [numberMode, setNumberMode] = useState<'auto' | 'manual'>(isEdit ? 'manual' : 'auto');
  const [productNumber, setProductNumber] = useState('');
  const [nextAutoInfo, setNextAutoInfo] = useState<{ nextNumber: number; maxNumber: number } | null>(null);

  const [productName, setProductName] = useState('');
  const [productSlug, setProductSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [price, setPrice] = useState('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [affiliateUrl, setAffiliateUrl] = useState('');
  const [label, setLabel] = useState('');
  const [isFeatured, setIsFeatured] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [sortOrder, setSortOrder] = useState('0');

  useEffect(() => {
    authFetch('/api/admin/categories')
      .then((r) => r.json())
      .then((d) => setCategories(d.items || []))
      .catch(() => {});

    authFetch('/api/admin/products/next-number')
      .then((r) => r.json())
      .then((d) => {
        if (typeof d?.nextNumber === 'number') {
          setNextAutoInfo({ nextNumber: d.nextNumber, maxNumber: d.maxNumber ?? 0 });
        }
      })
      .catch(() => {});
  }, [authFetch]);

  useEffect(() => {
    if (!isEdit || !productId) return;
    authFetch(`/api/admin/products/${productId}`)
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d?.error || 'Produk tidak ditemukan');
        return d;
      })
      .then((d) => {
        const p = d.product;
        if (p.productNumber !== null && p.productNumber !== undefined) {
          setNumberMode('manual');
          setProductNumber(String(p.productNumber));
        } else {
          setNumberMode('auto');
          setProductNumber('');
        }
        setProductName(p.productName || '');
        setProductSlug(p.productSlug || '');
        setSlugTouched(true);
        setDescription(p.description || '');
        setImageUrl(p.imageUrl || '');
        setPrice(p.price !== null && p.price !== undefined ? String(Number(p.price)) : '');
        setCategoryId(p.categoryId ? String(p.categoryId) : '');
        setAffiliateUrl(p.affiliateUrl || '');
        setLabel(p.label || '');
        setIsFeatured(Boolean(p.isFeatured));
        setIsActive(Boolean(p.isActive));
        setSortOrder(String(p.sortOrder ?? 0));
        setLoading(false);
      })
      .catch((err) => {
        notifyError(err?.message || 'Gagal memuat produk');
        navigate('/admin/products');
      });
  }, [isEdit, productId, authFetch, navigate, notifyError]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('folder', 'products');
      if (imageUrl.startsWith('/api/assets/')) {
        form.append('replaceUrl', imageUrl);
      }
      const res = await authFetch('/api/admin/upload', {
        method: 'POST',
        body: form,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Gagal mengunggah gambar');
      setImageUrl(json.url);
      notifySuccess('Gambar produk berhasil diunggah.');
    } catch (err: any) {
      notifyError(err?.message || 'Gagal mengunggah gambar');
    } finally {
      setUploading(false);
    }
  };

  const handleQuickSandboxCheck = async () => {
    if (!affiliateUrl.trim()) {
      notifyError('Masukkan link affiliate terlebih dahulu.');
      return;
    }
    setTestingSandbox(true);
    setSandboxStatus(null);
    try {
      const res = await authFetch('/api/admin/sandbox/test-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: affiliateUrl.trim(), productId: productId || null }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Gagal memeriksa link');
      setSandboxStatus({ ok: Boolean(json.validAllowlist), text: json.reason });
    } catch (err: any) {
      notifyError(err?.message || 'Gagal memeriksa link');
    } finally {
      setTestingSandbox(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productName.trim()) {
      notifyError('Nama produk wajib diisi.');
      return;
    }
    if (!affiliateUrl.trim()) {
      notifyError('Link affiliate Shopee wajib diisi.');
      return;
    }
    if (numberMode === 'manual') {
      const parsedNo = Number(productNumber.trim());
      if (!productNumber.trim() || !Number.isInteger(parsedNo) || parsedNo < 1) {
        notifyError('Masukkan nomor produk manual berupa angka bulat >= 1, atau pilih mode Otomatis.');
        return;
      }
    }

    setSaving(true);
    try {
      const endpoint = isEdit ? `/api/admin/products/${productId}` : '/api/admin/products';
      const method = isEdit ? 'PUT' : 'POST';
      const res = await authFetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          numberMode,
          productNumber: numberMode === 'manual' ? Number(productNumber.trim()) : null,
          productName: productName.trim(),
          productSlug: (productSlug || slugifyClient(productName)).trim(),
          description,
          imageUrl,
          price: price === '' ? null : Number(price),
          categoryId: categoryId ? Number(categoryId) : null,
          affiliateUrl: affiliateUrl.trim(),
          label,
          isFeatured,
          isActive,
          sortOrder: Number(sortOrder) || 0,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Gagal menyimpan produk');

      invalidateClientCatalogCache();
      notifySuccess(isEdit ? 'Produk berhasil diperbarui.' : 'Produk baru berhasil ditambahkan.');
      navigate('/admin/products');
    } catch (err: any) {
      notifyError(err?.message || 'Gagal menyimpan produk');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminLayout
      title={isEdit ? 'Edit Product' : 'Add Product'}
      subtitle={isEdit ? 'Perbarui detail, gambar, atau link affiliate Shopee' : 'Tambahkan produk rekomendasi baru secara manual'}
      actions={
        <Link
          to="/admin/products"
          className="min-h-[40px] inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#F0C6D2] bg-[#FFFFFF] text-xs font-medium text-[#3F232C]"
        >
          <ArrowLeft className="w-3.5 h-3.5 text-[#C25B7C]" />
          <span>Kembali</span>
        </Link>
      }
    >
      {loading ? (
        <div className="rounded-2xl bg-[#FFFFFF] border border-[#F0C6D2] p-8 text-center text-xs text-[#7D4E5D]">
          Memuat detail produk...
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="max-w-3xl space-y-5 sm:space-y-6">
          <div className="rounded-2xl bg-[#FFFFFF] border border-[#F0C6D2] p-4 sm:p-6 space-y-5">
            {/* Nomor Produk / Nomor Urut (Manual atau Otomatis) */}
            <div className="rounded-2xl border border-[#F0C6D2] bg-[#FFF6F8]/85 p-3.5 sm:p-4 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div>
                  <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#3F232C]">
                    <Hash className="w-3.5 h-3.5 text-[#C25B7C]" />
                    <span>Nomor Produk / Nomor Urut *</span>
                  </label>
                  <p className="text-[11px] text-[#7D4E5D] mt-0.5">
                    Pilih penomoran otomatis berurutan atau ketik nomor produk secara manual.
                  </p>
                </div>

                <div className="grid grid-cols-2 sm:inline-flex p-1 rounded-xl bg-[#FFFFFF] border border-[#F0C6D2] shrink-0">
                  <button
                    type="button"
                    onClick={() => setNumberMode('auto')}
                    className={`min-h-[36px] inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                      numberMode === 'auto'
                        ? 'bg-[#C25B7C] text-[#FFFFFF] shadow-2xs'
                        : 'text-[#7D4E5D] hover:text-[#3F232C]'
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Otomatis</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setNumberMode('manual');
                      if (!productNumber && nextAutoInfo) {
                        setProductNumber(String(nextAutoInfo.nextNumber));
                      }
                    }}
                    className={`min-h-[36px] inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                      numberMode === 'manual'
                        ? 'bg-[#C25B7C] text-[#FFFFFF] shadow-2xs'
                        : 'text-[#7D4E5D] hover:text-[#3F232C]'
                    }`}
                  >
                    <Hash className="w-3.5 h-3.5" />
                    <span>Manual</span>
                  </button>
                </div>
              </div>

              {numberMode === 'auto' ? (
                <div className="rounded-xl border border-[#F0C6D2] bg-[#FFFFFF] px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <span className="inline-flex items-center justify-center min-w-[44px] h-8 px-2.5 rounded-lg bg-[#FDE8EE] text-[#C25B7C] font-mono-tabular text-sm font-semibold">
                      #{nextAutoInfo ? nextAutoInfo.nextNumber : '…'}
                    </span>
                    <div className="text-xs text-[#3F232C]">
                      Nomor urut otomatis saat disimpan
                      {nextAutoInfo && nextAutoInfo.maxNumber > 0 && (
                        <span className="block text-[11px] text-[#7D4E5D]">
                          Nomor tertinggi saat ini: #{nextAutoInfo.maxNumber}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="text-[11px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                    Auto-increment
                  </span>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-mono-tabular text-sm font-semibold text-[#C25B7C]">
                      #
                    </span>
                    <input
                      type="number"
                      min="1"
                      max="999999"
                      step="1"
                      required
                      value={productNumber}
                      onChange={(e) => setProductNumber(e.target.value)}
                      placeholder={nextAutoInfo ? String(nextAutoInfo.nextNumber) : '1'}
                      aria-label="Nomor Produk Manual"
                      className="w-full min-h-[44px] pl-8 pr-3.5 rounded-xl border border-[#F0C6D2] bg-[#FFFFFF] text-sm font-mono-tabular font-semibold text-[#3F232C] focus:outline-none focus:border-[#C25B7C]"
                    />
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#7D4E5D]">
                    <span>
                      {nextAutoInfo
                        ? `Nomor tertinggi saat ini: #${nextAutoInfo.maxNumber}`
                        : 'Masukkan angka bulat >= 1'}
                    </span>
                    {nextAutoInfo && (
                      <button
                        type="button"
                        onClick={() => setProductNumber(String(nextAutoInfo.nextNumber))}
                        className="font-medium text-[#C25B7C] hover:text-[#A84867] underline underline-offset-2"
                      >
                        Pakai #{nextAutoInfo.nextNumber}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-[#3F232C] mb-1.5">
                  Nama Produk *
                </label>
                <input
                  type="text"
                  required
                  value={productName}
                  onChange={(e) => {
                    setProductName(e.target.value);
                    if (!slugTouched) {
                      setProductSlug(slugifyClient(e.target.value));
                    }
                  }}
                  placeholder="Contoh: Rosehip Radiance Serum 30ml"
                  className="w-full min-h-[44px] px-3.5 rounded-xl border border-[#F0C6D2] bg-[#FFF6F8] text-sm focus:outline-none focus:border-[#C25B7C]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#3F232C] mb-1.5">
                  Product Slug (URL /go/[slug])
                </label>
                <input
                  type="text"
                  value={productSlug}
                  onChange={(e) => {
                    setSlugTouched(true);
                    setProductSlug(slugifyClient(e.target.value));
                  }}
                  placeholder="rosehip-radiance-serum"
                  className="w-full min-h-[44px] px-3.5 rounded-xl border border-[#F0C6D2] bg-[#FFF6F8] text-sm font-mono-tabular focus:outline-none focus:border-[#C25B7C]"
                />
              </div>
            </div>

            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                <label className="block text-xs font-medium text-[#3F232C]">
                  Affiliate URL (Shopee / TikTok) *
                </label>
                <button
                  type="button"
                  onClick={handleQuickSandboxCheck}
                  disabled={testingSandbox}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-[#C25B7C] hover:text-[#A84867]"
                >
                  <FlaskConical className="w-3.5 h-3.5" />
                  <span>{testingSandbox ? 'Menguji...' : 'Tes Link di Sandbox'}</span>
                </button>
              </div>
              <input
                type="url"
                required
                value={affiliateUrl}
                onChange={(e) => {
                  setAffiliateUrl(e.target.value);
                  setSandboxStatus(null);
                }}
                placeholder="https://shopee.co.id/... atau https://vt.tiktok.com/..."
                className="w-full min-h-[44px] px-3.5 rounded-xl border border-[#F0C6D2] bg-[#FFF6F8] text-sm focus:outline-none focus:border-[#C25B7C]"
              />
              {sandboxStatus && (
                <div
                  className={`mt-2 flex items-center gap-1.5 text-xs ${
                    sandboxStatus.ok ? 'text-emerald-700' : 'text-red-700'
                  }`}
                >
                  {sandboxStatus.ok ? (
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  ) : (
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  )}
                  <span>{sandboxStatus.text}</span>
                </div>
              )}
              <p className="mt-1 text-[11px] text-[#7D4E5D]">
                Harus menggunakan HTTPS/HTTP dan berasal dari domain Shopee atau TikTok yang diizinkan pada Website Settings.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-[#3F232C] mb-1.5">
                  Kategori
                </label>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full min-h-[44px] px-3 rounded-xl border border-[#F0C6D2] bg-[#FFF6F8] text-sm"
                >
                  <option value="">Tanpa Kategori</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#3F232C] mb-1.5">
                  Harga (IDR)
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="129000"
                  className="w-full min-h-[44px] px-3.5 rounded-xl border border-[#F0C6D2] bg-[#FFF6F8] text-sm tabular-nums"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#3F232C] mb-1.5">
                  Label
                </label>
                <select
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  className="w-full min-h-[44px] px-3 rounded-xl border border-[#F0C6D2] bg-[#FFF6F8] text-sm"
                >
                  <option value="">Tanpa Label</option>
                  <option value="BEST SELLER">BEST SELLER</option>
                  <option value="VIRAL">VIRAL</option>
                  <option value="RECOMMENDED">RECOMMENDED</option>
                  <option value="NEW">NEW</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#3F232C] mb-1.5">
                Deskripsi Singkat
              </label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Ceritakan keunggulan produk..."
                className="w-full p-3.5 rounded-xl border border-[#F0C6D2] bg-[#FFF6F8] text-sm focus:outline-none focus:border-[#C25B7C]"
              />
            </div>

            {/* Image Upload or URL */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
              <div className="aspect-[4/3] max-w-[260px] md:max-w-none rounded-xl overflow-hidden border border-[#F0C6D2] bg-[#FFF6F8]">
                <SafeImage
                  src={imageUrl}
                  alt={productName || 'Preview Produk'}
                  fallbackLabel="Preview Foto"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="md:col-span-2 space-y-3">
                <div>
                  <label className="block text-xs font-medium text-[#3F232C] mb-1.5">
                    Upload Foto Produk (JPEG/PNG/WEBP, maks 2MB)
                  </label>
                  <label className="min-h-[44px] inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[#F0C6D2] bg-[#FFF6F8] hover:bg-[#FDE8EE] text-xs font-medium text-[#3F232C] cursor-pointer">
                    <Upload className="w-4 h-4 text-[#C25B7C]" />
                    <span>{uploading ? 'Mengunggah...' : 'Pilih File Gambar'}</span>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/gif"
                      onChange={handleImageUpload}
                      disabled={uploading}
                      className="sr-only"
                    />
                  </label>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#3F232C] mb-1.5">
                    Atau Masukkan Image URL
                  </label>
                  <input
                    type="text"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    placeholder="https://..."
                    className="w-full min-h-[42px] px-3 rounded-xl border border-[#F0C6D2] bg-[#FFF6F8] text-xs"
                  />
                </div>
              </div>
            </div>

            {/* Toggles & Sort Order */}
            <div className="pt-3 border-t border-[#F0C6D2]/70 grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
              <label className="min-h-[36px] flex items-center gap-2.5 cursor-pointer text-xs font-medium text-[#3F232C]">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="w-4 h-4 accent-[#C25B7C]"
                />
                <span>Produk Aktif (Tampil di Katalog)</span>
              </label>

              <label className="min-h-[36px] flex items-center gap-2.5 cursor-pointer text-xs font-medium text-[#3F232C]">
                <input
                  type="checkbox"
                  checked={isFeatured}
                  onChange={(e) => setIsFeatured(e.target.checked)}
                  className="w-4 h-4 accent-[#C25B7C]"
                />
                <span>Tandai sebagai Featured</span>
              </label>

              <div>
                <label className="block text-xs font-medium text-[#3F232C] mb-1">Sort Order</label>
                <input
                  type="number"
                  min="0"
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value)}
                  className="w-full min-h-[40px] px-3 rounded-xl border border-[#F0C6D2] bg-[#FFF6F8] text-xs tabular-nums"
                />
              </div>
            </div>
          </div>

          <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2.5 sm:gap-3">
            <Link
              to="/admin/products"
              className="min-h-[44px] inline-flex items-center justify-center px-4 py-2.5 rounded-xl border border-[#F0C6D2] bg-[#FFFFFF] text-xs font-medium text-[#3F232C]"
            >
              Batal
            </Link>
            <button
              type="submit"
              disabled={saving}
              className="min-h-[44px] inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#C25B7C] hover:bg-[#A84867] disabled:opacity-60 text-white text-xs font-medium"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Menyimpan...' : isEdit ? 'Simpan Perubahan' : 'Tambahkan Produk'}</span>
            </button>
          </div>
        </form>
      )}
    </AdminLayout>
  );
}
