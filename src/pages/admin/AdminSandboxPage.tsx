import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  FlaskConical,
  Link2,
  Save,
  Search,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../../lib/authContext';
import { useRouter } from '../../lib/router';
import { useUiFeedback } from '../../components/Toast';
import { AdminLayout } from './AdminLayout';

interface SandboxProductOption {
  id: number;
  productName: string;
  productSlug: string;
  affiliateUrl: string;
  isActive: boolean;
  isArchived: boolean;
  categoryName: string | null;
}

interface SandboxTestResult {
  validProtocol: boolean;
  validAllowlist: boolean;
  reason: string;
  allowedDomains: string[];
  parsed: {
    protocol: string;
    host: string;
    path: string;
    queryParams: Record<string, string>;
  };
  productPreview: {
    id: number;
    productName: string;
    productSlug: string;
    isActive: boolean;
    isArchived: boolean;
    currentAffiliateUrl: string;
  } | null;
  simulatedRedirect: string | null;
}

export function AdminSandboxPage() {
  const { authFetch } = useAuth();
  const { search } = useRouter();
  const { notifySuccess, notifyError } = useUiFeedback();

  const [products, setProducts] = useState<SandboxProductOption[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [productFilter, setProductFilter] = useState('');
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [testUrl, setTestUrl] = useState('');
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<SandboxTestResult | null>(null);

  const loadProducts = useCallback(async () => {
    setLoadingProducts(true);
    try {
      const res = await authFetch('/api/admin/products?limit=100&status=all&sort=sortOrder');
      if (!res.ok) throw new Error('Gagal memuat daftar produk');
      const json = await res.json();
      const list: SandboxProductOption[] = json.items || [];
      setProducts(list);

      const urlParams = new URLSearchParams(search);
      const qProductId = urlParams.get('productId');
      if (qProductId) {
        const match = list.find((p) => String(p.id) === qProductId);
        if (match) {
          setSelectedProductId(String(match.id));
          setTestUrl(match.affiliateUrl);
          return;
        }
      }

      if (list.length > 0 && !selectedProductId) {
        setSelectedProductId(String(list[0].id));
        setTestUrl(list[0].affiliateUrl);
      }
    } catch (err: any) {
      notifyError(err?.message || 'Gagal memuat produk untuk sandbox');
    } finally {
      setLoadingProducts(false);
    }
  }, [authFetch, notifyError, search, selectedProductId]);

  useEffect(() => {
    loadProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedProduct = products.find((p) => String(p.id) === selectedProductId) || null;

  const handleSelectProduct = (idStr: string) => {
    setSelectedProductId(idStr);
    setResult(null);
    const found = products.find((p) => String(p.id) === idStr);
    if (found) {
      setTestUrl(found.affiliateUrl);
    }
  };

  const handleTestLink = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!testUrl.trim()) {
      notifyError('Masukkan URL Shopee affiliate terlebih dahulu.');
      return;
    }

    setTesting(true);
    try {
      const res = await authFetch('/api/admin/sandbox/test-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: testUrl.trim(),
          productId: selectedProductId ? Number(selectedProductId) : null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Gagal menguji tautan di sandbox');
      setResult(json);
    } catch (err: any) {
      notifyError(err?.message || 'Terjadi kesalahan saat menguji URL');
    } finally {
      setTesting(false);
    }
  };

  const handleSaveAffiliateUrl = async () => {
    if (!selectedProduct) {
      notifyError('Pilih produk terlebih dahulu untuk menyimpan link.');
      return;
    }
    if (!testUrl.trim()) {
      notifyError('URL affiliate tidak boleh kosong.');
      return;
    }

    setSaving(true);
    try {
      const res = await authFetch(`/api/admin/products/${selectedProduct.id}/affiliate-url`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ affiliateUrl: testUrl.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Gagal menyimpan link affiliate');

      setProducts((prev) =>
        prev.map((p) =>
          p.id === selectedProduct.id ? { ...p, affiliateUrl: json.product.affiliateUrl } : p
        )
      );
      notifySuccess(`Link affiliate "${selectedProduct.productName}" berhasil diperbarui.`);
      await handleTestLink();
    } catch (err: any) {
      notifyError(err?.message || 'Gagal menyimpan link affiliate');
    } finally {
      setSaving(false);
    }
  };

  const filteredProducts = products.filter((p) => {
    if (!productFilter.trim()) return true;
    const q = productFilter.toLowerCase();
    return (
      p.productName.toLowerCase().includes(q) ||
      p.productSlug.toLowerCase().includes(q) ||
      (p.categoryName || '').toLowerCase().includes(q)
    );
  });

  const queryEntries = result ? Object.entries(result.parsed.queryParams || {}) : [];

  return (
    <AdminLayout
      title="Affiliate Link Sandbox"
      subtitle="Uji validasi domain Shopee, periksa parameter tracking, simulasi redirect /go/[slug], dan simpan link tanpa mencatat klik dummy"
    >
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Product Selector List */}
        <section className="lg:col-span-5 rounded-2xl bg-[#FFFFFF] border border-[#F0C6D2] p-5 space-y-4 self-start">
          <div>
            <h2 className="font-serif-display text-lg font-semibold text-[#3F232C]">
              1. Pilih Produk Target
            </h2>
            <p className="text-xs text-[#7D4E5D] mt-0.5">
              Pilih produk untuk mengedit link affiliate-nya atau kosongkan untuk uji URL bebas.
            </p>
          </div>

          <div className="relative">
            <Search className="w-4 h-4 text-[#7D4E5D] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={productFilter}
              onChange={(e) => setProductFilter(e.target.value)}
              placeholder="Filter produk atau slug..."
              className="w-full min-h-[40px] pl-9 pr-3 rounded-xl border border-[#F0C6D2] bg-[#FFF6F8] text-xs text-[#3F232C] focus:outline-none focus:border-[#C25B7C]"
            />
          </div>

          <div className="max-h-[380px] overflow-y-auto space-y-1.5 pr-1">
            <button
              type="button"
              onClick={() => handleSelectProduct('')}
              className={`w-full text-left px-3.5 py-2.5 rounded-xl border text-xs transition-colors ${
                selectedProductId === ''
                  ? 'bg-[#FDE8EE] border-[#C25B7C] text-[#3F232C] font-semibold'
                  : 'bg-[#FFF6F8] border-[#F0C6D2]/60 text-[#7D4E5D] hover:border-[#F0C6D2]'
              }`}
            >
              Mode Bebas (Tanpa Produk Terkait)
            </button>

            {loadingProducts ? (
              <div className="py-8 text-center text-xs text-[#7D4E5D]">Memuat daftar produk...</div>
            ) : filteredProducts.length === 0 ? (
              <div className="py-6 text-center text-xs text-[#7D4E5D]">
                Tidak ada produk cocok dengan filter.
              </div>
            ) : (
              filteredProducts.map((p) => {
                const active = String(p.id) === selectedProductId;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleSelectProduct(String(p.id))}
                    className={`w-full text-left px-3.5 py-2.5 rounded-xl border transition-colors ${
                      active
                        ? 'bg-[#FDE8EE] border-[#C25B7C]'
                        : 'bg-[#FFFFFF] border-[#F0C6D2]/70 hover:bg-[#FFF6F8]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-[#3F232C] truncate">
                        {p.productName}
                      </span>
                      <span
                        className={`text-[10px] font-medium shrink-0 ${
                          p.isActive ? 'text-emerald-700' : 'text-amber-700'
                        }`}
                      >
                        {p.isActive ? 'Aktif' : 'Nonaktif'}
                      </span>
                    </div>
                    <div className="mt-0.5 text-[11px] font-mono-tabular text-[#C25B7C] truncate">
                      /go/{p.productSlug}
                    </div>
                    <div className="mt-0.5 text-[11px] text-[#7D4E5D] truncate">
                      {p.affiliateUrl}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </section>

        {/* Right: Sandbox Editor & Inspector */}
        <section className="lg:col-span-7 space-y-5">
          <form
            onSubmit={handleTestLink}
            className="rounded-2xl bg-[#FFFFFF] border border-[#F0C6D2] p-5 space-y-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-serif-display text-lg font-semibold text-[#3F232C] flex items-center gap-2">
                  <FlaskConical className="w-5 h-5 text-[#C25B7C]" />
                  <span>2. Sandbox Editor & Pengujian Link</span>
                </h2>
                <p className="text-xs text-[#7D4E5D] mt-0.5">
                  {selectedProduct
                    ? `Mengedit tautan tujuan untuk "${selectedProduct.productName}" (/go/${selectedProduct.productSlug})`
                    : 'Tempel tautan affiliate Shopee untuk memeriksa validitas protokol & domain.'}
                </p>
              </div>
              {selectedProduct && (
                <a
                  href={`/go/${encodeURIComponent(selectedProduct.productSlug)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#F0C6D2] bg-[#FFF6F8] hover:bg-[#FDE8EE] text-xs font-medium text-[#3F232C] shrink-0"
                >
                  <span>Tes /go/ Live</span>
                  <ExternalLink className="w-3.5 h-3.5 text-[#C25B7C]" />
                </a>
              )}
            </div>

            <div>
              <label
                htmlFor="sandbox-url-input"
                className="block text-xs font-medium text-[#3F232C] mb-1.5"
              >
                Shopee Affiliate URL
              </label>
              <textarea
                id="sandbox-url-input"
                rows={3}
                value={testUrl}
                onChange={(e) => setTestUrl(e.target.value)}
                placeholder="https://shopee.co.id/product/... atau https://s.shopee.co.id/..."
                className="w-full p-3.5 rounded-xl border border-[#F0C6D2] bg-[#FFF6F8] text-xs font-mono-tabular text-[#3F232C] focus:outline-none focus:border-[#C25B7C]"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <button
                type="submit"
                disabled={testing}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[#C25B7C] text-[#C25B7C] hover:bg-[#FDE8EE]/60 disabled:opacity-60 text-xs font-medium transition-colors"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>{testing ? 'Menguji...' : 'Uji Validasi & Simulasi Redirect'}</span>
              </button>

              {selectedProduct && (
                <button
                  type="button"
                  disabled={saving || !testUrl.trim()}
                  onClick={handleSaveAffiliateUrl}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#C25B7C] hover:bg-[#A84867] disabled:opacity-60 text-white text-xs font-medium transition-colors"
                >
                  <Save className="w-4 h-4" />
                  <span>{saving ? 'Menyimpan...' : 'Simpan Link ke Produk'}</span>
                </button>
              )}
            </div>
          </form>

          {/* Sandbox Inspection Result */}
          {result && (
            <div className="rounded-2xl bg-[#FFFFFF] border border-[#F0C6D2] p-5 space-y-4">
              <div
                className={`rounded-xl border p-4 flex items-start gap-3 ${
                  result.validAllowlist
                    ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
                    : 'bg-red-50/70 border-red-200 text-red-900'
                }`}
              >
                {result.validAllowlist ? (
                  <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-700 mt-0.5" />
                ) : (
                  <AlertCircle className="w-5 h-5 shrink-0 text-red-700 mt-0.5" />
                )}
                <div className="space-y-1 text-xs">
                  <div className="font-semibold">
                    {result.validAllowlist ? 'Valid & Diizinkan Redirect' : 'Ditolak oleh Security Allowlist'}
                  </div>
                  <p className="leading-relaxed">{result.reason}</p>
                </div>
              </div>

              {result.simulatedRedirect && (
                <div className="rounded-xl bg-[#FFF6F8] border border-[#F0C6D2] p-3.5 space-y-1">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-[#C25B7C]">
                    Simulasi Redirect Server (Tanpa Mencatat Klik)
                  </div>
                  <div className="text-xs font-mono-tabular text-[#3F232C] break-all">
                    {result.simulatedRedirect}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="rounded-xl bg-[#FFF6F8] border border-[#F0C6D2]/70 p-3">
                  <div className="text-[11px] text-[#7D4E5D]">Protokol</div>
                  <div className="mt-1 font-mono-tabular font-semibold text-[#3F232C]">
                    {result.parsed.protocol ? result.parsed.protocol.toUpperCase() : '—'}
                  </div>
                </div>
                <div className="rounded-xl bg-[#FFF6F8] border border-[#F0C6D2]/70 p-3 sm:col-span-2">
                  <div className="text-[11px] text-[#7D4E5D]">Hostname</div>
                  <div className="mt-1 font-mono-tabular font-semibold text-[#3F232C] break-all">
                    {result.parsed.host || '—'}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-xs font-semibold text-[#3F232C] flex items-center gap-1.5">
                  <Link2 className="w-3.5 h-3.5 text-[#C25B7C]" />
                  <span>Query Parameter Affiliate ({queryEntries.length})</span>
                </div>
                {queryEntries.length === 0 ? (
                  <p className="text-xs text-[#7D4E5D] bg-[#FFF6F8] rounded-xl p-3 border border-[#F0C6D2]/60">
                    Tidak ada query parameter tambahan pada URL ini (umum pada shortlink s.shopee.co.id / shope.ee).
                  </p>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-[#F0C6D2]/70">
                    <table className="w-full text-xs">
                      <thead className="bg-[#FFF6F8] text-[#7D4E5D] border-b border-[#F0C6D2]/70">
                        <tr>
                          <th className="p-2.5 text-left font-medium">Parameter</th>
                          <th className="p-2.5 text-left font-medium">Nilai</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#F0C6D2]/50 font-mono-tabular">
                        {queryEntries.map(([k, v]) => (
                          <tr key={k}>
                            <td className="p-2.5 font-medium text-[#C25B7C]">{k}</td>
                            <td className="p-2.5 text-[#3F232C] break-all">{v}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="text-[11px] text-[#7D4E5D] pt-2 border-t border-[#F0C6D2]/60">
                Allowlist domain aktif: <span className="font-mono-tabular">{result.allowedDomains.join(', ')}</span>
              </div>
            </div>
          )}
        </section>
      </div>
    </AdminLayout>
  );
}
