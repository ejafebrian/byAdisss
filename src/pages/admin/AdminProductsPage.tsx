import React, { useCallback, useEffect, useState } from 'react';
import {
  Copy,
  Download,
  Edit3,
  ExternalLink,
  FileSpreadsheet,
  FlaskConical,
  Link2,
  Plus,
  Search,
  Star,
  Trash2,
} from 'lucide-react';
import { useAuth } from '../../lib/authContext';
import { Link, useRouter } from '../../lib/router';
import { formatIdr, formatJakartaDateTime, PublicCategory } from '../../lib/types';
import { SafeImage } from '../../components/SafeImage';
import { useUiFeedback } from '../../components/Toast';
import { AdminLayout } from './AdminLayout';

interface AdminProductRow {
  id: number;
  productName: string;
  productSlug: string;
  imageUrl: string;
  price: string | null;
  categoryId: number | null;
  categoryName: string | null;
  affiliateUrl: string;
  label: string;
  isFeatured: boolean;
  isActive: boolean;
  isArchived: boolean;
  sortOrder: number;
  views: number;
  clicks: number;
  uniqueClickers: number;
  ctr: number;
  lastClickAt: string | null;
}

export function AdminProductsPage() {
  const { authFetch } = useAuth();
  const { navigate } = useRouter();
  const { notifySuccess, notifyError, confirmAction } = useUiFeedback();

  const [items, setItems] = useState<AdminProductRow[]>([]);
  const [categories, setCategories] = useState<PublicCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [status, setStatus] = useState('all');
  const [sort, setSort] = useState('sortOrder');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [bulkCategoryModal, setBulkCategoryModal] = useState(false);
  const [bulkCatId, setBulkCatId] = useState('');
  const [bulkLabel, setBulkLabel] = useState('');

  // Inline Edit Link modal state
  const [editingLinkProduct, setEditingLinkProduct] = useState<AdminProductRow | null>(null);
  const [editingLinkUrl, setEditingLinkUrl] = useState('');
  const [savingLink, setSavingLink] = useState(false);

  useEffect(() => {
    authFetch('/api/admin/categories')
      .then((r) => r.json())
      .then((d) => setCategories(d.items || []))
      .catch(() => {});
  }, [authFetch]);

  const loadProducts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: '15',
        status,
        sort,
      });
      if (search.trim()) params.set('search', search.trim());
      if (categoryId) params.set('categoryId', categoryId);

      const res = await authFetch(`/api/admin/products?${params.toString()}`);
      if (!res.ok) throw new Error('Gagal memuat produk');
      const json = await res.json();
      setItems(json.items || []);
      setTotalPages(json.pagination?.totalPages || 1);
      setTotal(json.pagination?.total || 0);
      setSelectedIds([]);
    } catch (err: any) {
      notifyError(err?.message || 'Gagal memuat daftar produk');
    } finally {
      setLoading(false);
    }
  }, [authFetch, page, search, categoryId, status, sort, notifyError]);

  useEffect(() => {
    const t = setTimeout(loadProducts, 200);
    return () => clearTimeout(t);
  }, [loadProducts]);

  const toggleSelectAll = () => {
    if (selectedIds.length === items.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(items.map((i) => i.id));
    }
  };

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleBulk = async (action: string, extra?: { categoryId?: string; label?: string }) => {
    if (!selectedIds.length) return;
    if (action === 'delete') {
      const ok = await confirmAction({
        title: `Hapus ${selectedIds.length} Produk?`,
        message: 'Tindakan ini menghapus produk terpilih secara permanen dari database.',
        confirmLabel: 'Hapus Produk',
        destructive: true,
      });
      if (!ok) return;
    }

    const res = await authFetch('/api/admin/products/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: selectedIds, action, ...extra }),
    });
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      notifyError(b.error || 'Gagal melakukan aksi massal');
      return;
    }
    notifySuccess(`Berhasil memproses ${selectedIds.length} produk.`);
    setBulkCategoryModal(false);
    loadProducts();
  };

  const handleToggleActive = async (item: AdminProductRow) => {
    const res = await authFetch(`/api/admin/products/${item.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        productName: item.productName,
        productSlug: item.productSlug,
        imageUrl: item.imageUrl,
        price: item.price,
        categoryId: item.categoryId,
        affiliateUrl: item.affiliateUrl,
        label: item.label,
        isFeatured: item.isFeatured,
        isActive: !item.isActive,
        isArchived: item.isArchived,
        sortOrder: item.sortOrder,
      }),
    });
    if (res.ok) {
      notifySuccess(`Status ${item.productName} diperbarui.`);
      loadProducts();
    } else {
      notifyError('Gagal mengubah status produk.');
    }
  };

  const handleToggleFeatured = async (item: AdminProductRow) => {
    const res = await authFetch(`/api/admin/products/${item.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        productName: item.productName,
        productSlug: item.productSlug,
        imageUrl: item.imageUrl,
        price: item.price,
        categoryId: item.categoryId,
        affiliateUrl: item.affiliateUrl,
        label: item.label,
        isFeatured: !item.isFeatured,
        isActive: item.isActive,
        isArchived: item.isArchived,
        sortOrder: item.sortOrder,
      }),
    });
    if (res.ok) {
      notifySuccess('Status unggulan diperbarui.');
      loadProducts();
    }
  };

  const handleSaveQuickLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLinkProduct) return;
    setSavingLink(true);
    try {
      const res = await authFetch(
        `/api/admin/products/${editingLinkProduct.id}/affiliate-url`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ affiliateUrl: editingLinkUrl.trim() }),
        }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Gagal memperbarui link affiliate');
      notifySuccess(`Link affiliate "${editingLinkProduct.productName}" diperbarui.`);
      setEditingLinkProduct(null);
      loadProducts();
    } catch (err: any) {
      notifyError(err?.message || 'Gagal menyimpan link');
    } finally {
      setSavingLink(false);
    }
  };

  const handleDuplicate = async (item: AdminProductRow) => {
    const res = await authFetch(`/api/admin/products/${item.id}/duplicate`, {
      method: 'POST',
    });
    if (res.ok) {
      notifySuccess(`Produk "${item.productName}" berhasil diduplikasi.`);
      loadProducts();
    } else {
      notifyError('Gagal menduplikasi produk.');
    }
  };

  const handleDeleteOne = async (item: AdminProductRow) => {
    const ok = await confirmAction({
      title: 'Hapus Produk?',
      message: `Hapus "${item.productName}" secara permanen?`,
      confirmLabel: 'Hapus',
      destructive: true,
    });
    if (!ok) return;
    const res = await authFetch(`/api/admin/products/${item.id}`, { method: 'DELETE' });
    if (res.ok) {
      notifySuccess('Produk dihapus.');
      loadProducts();
    } else {
      notifyError('Gagal menghapus produk.');
    }
  };

  const handleExportCsv = async () => {
    const res = await authFetch('/api/admin/export/products');
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'by-adisss-products.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AdminLayout
      title="Product Catalog"
      subtitle={`Total ${total} produk terdaftar di database`}
      actions={
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportCsv}
            className="hidden sm:inline-flex min-h-[40px] items-center gap-1.5 px-3 py-2 rounded-xl border border-[#F0C6D2] bg-[#FFFFFF] hover:bg-[#FFF6F8] text-xs font-medium text-[#3F232C] whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5 text-[#C25B7C]" />
            <span>Export CSV</span>
          </button>
          <Link
            to="/admin/sandbox"
            className="hidden md:inline-flex min-h-[40px] items-center gap-1.5 px-3 py-2 rounded-xl border border-[#F0C6D2] bg-[#FFF6F8] hover:bg-[#FDE8EE] text-xs font-medium text-[#3F232C] whitespace-nowrap"
          >
            <FlaskConical className="w-3.5 h-3.5 text-[#C25B7C]" />
            <span>Link Sandbox</span>
          </Link>
          <Link
            to="/admin/products/import"
            className="hidden sm:inline-flex min-h-[40px] items-center gap-1.5 px-3 py-2 rounded-xl border border-[#F0C6D2] bg-[#FFF6F8] hover:bg-[#FDE8EE] text-xs font-medium text-[#3F232C] whitespace-nowrap"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-[#C25B7C]" />
            <span>Import Produk</span>
          </Link>
          <Link
            to="/admin/products/add"
            className="min-h-[40px] inline-flex items-center gap-1.5 px-3 sm:px-3.5 py-2 rounded-xl bg-[#C25B7C] hover:bg-[#A84867] text-[#FFFFFF] text-xs font-medium whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Tambah Produk</span>
            <span className="sm:hidden">Tambah</span>
          </Link>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Mobile Quick Actions (< 640px) */}
        <div className="sm:hidden grid grid-cols-3 gap-2">
          <Link
            to="/admin/products/import"
            className="min-h-[42px] inline-flex items-center justify-center gap-1.5 px-2.5 rounded-xl border border-[#F0C6D2] bg-[#FFFFFF] text-xs font-medium text-[#3F232C]"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-[#C25B7C] shrink-0" />
            <span>Import</span>
          </Link>
          <Link
            to="/admin/sandbox"
            className="min-h-[42px] inline-flex items-center justify-center gap-1.5 px-2.5 rounded-xl border border-[#F0C6D2] bg-[#FFFFFF] text-xs font-medium text-[#3F232C]"
          >
            <FlaskConical className="w-3.5 h-3.5 text-[#C25B7C] shrink-0" />
            <span>Sandbox</span>
          </Link>
          <button
            type="button"
            onClick={handleExportCsv}
            className="min-h-[42px] inline-flex items-center justify-center gap-1.5 px-2.5 rounded-xl border border-[#F0C6D2] bg-[#FFFFFF] text-xs font-medium text-[#3F232C]"
          >
            <Download className="w-3.5 h-3.5 text-[#C25B7C] shrink-0" />
            <span>Export</span>
          </button>
        </div>

        {/* Filters */}
        <div className="rounded-2xl bg-[#FFFFFF] border border-[#F0C6D2] p-3.5 sm:p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-[#C25B7C] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Cari nama, slug, atau label..."
              className="w-full min-h-[42px] pl-9 pr-3 rounded-xl border border-[#F0C6D2] bg-[#FFF6F8] text-xs text-[#3F232C] focus:outline-none focus:border-[#C25B7C]"
            />
          </div>

          <select
            value={categoryId}
            onChange={(e) => {
              setCategoryId(e.target.value);
              setPage(1);
            }}
            className="min-h-[42px] px-3 rounded-xl border border-[#F0C6D2] bg-[#FFF6F8] text-xs text-[#3F232C]"
          >
            <option value="">Semua Kategori</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            className="min-h-[42px] px-3 rounded-xl border border-[#F0C6D2] bg-[#FFF6F8] text-xs text-[#3F232C]"
          >
            <option value="all">Semua (Non-Arsip)</option>
            <option value="active">Aktif</option>
            <option value="inactive">Nonaktif</option>
            <option value="archived">Diarsipkan</option>
          </select>

          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="min-h-[42px] px-3 rounded-xl border border-[#F0C6D2] bg-[#FFF6F8] text-xs text-[#3F232C]"
          >
            <option value="sortOrder">Urutan Tampil</option>
            <option value="newest">Terbaru</option>
            <option value="clicks">Klik Terbanyak</option>
            <option value="price_asc">Harga Terendah</option>
            <option value="price_desc">Harga Tertinggi</option>
          </select>
        </div>

        {/* Mobile/Tablet Select-All + Bulk Toolbar */}
        {!loading && items.length > 0 && (
          <div className="lg:hidden flex items-center justify-between px-1">
            <label className="inline-flex items-center gap-2 text-xs font-medium text-[#3F232C] min-h-[36px] cursor-pointer">
              <input
                type="checkbox"
                checked={items.length > 0 && selectedIds.length === items.length}
                onChange={toggleSelectAll}
                className="w-4 h-4 accent-[#C25B7C]"
              />
              <span>Pilih Semua ({items.length})</span>
            </label>
            <span className="text-[11px] text-[#7D4E5D] tabular-nums">Total: {total} produk</span>
          </div>
        )}

        {/* Bulk Action Toolbar */}
        {selectedIds.length > 0 && (
          <div className="rounded-2xl bg-[#FDE8EE] border border-[#F0C6D2] px-4 py-3 flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs font-semibold text-[#3F232C]">
              {selectedIds.length} produk dipilih
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => handleBulk('activate')}
                className="min-h-[36px] px-3 py-1.5 rounded-lg bg-[#FFFFFF] border border-[#F0C6D2] text-xs font-medium text-[#3F232C]"
              >
                Aktifkan
              </button>
              <button
                type="button"
                onClick={() => handleBulk('deactivate')}
                className="min-h-[36px] px-3 py-1.5 rounded-lg bg-[#FFFFFF] border border-[#F0C6D2] text-xs font-medium text-[#3F232C]"
              >
                Nonaktifkan
              </button>
              <button
                type="button"
                onClick={() => setBulkCategoryModal(true)}
                className="min-h-[36px] px-3 py-1.5 rounded-lg bg-[#FFFFFF] border border-[#F0C6D2] text-xs font-medium text-[#3F232C]"
              >
                Bulk Edit
              </button>
              <button
                type="button"
                onClick={() => handleBulk('archive')}
                className="min-h-[36px] px-3 py-1.5 rounded-lg bg-[#FFFFFF] border border-[#F0C6D2] text-xs font-medium text-[#7D4E5D]"
              >
                Arsipkan
              </button>
              <button
                type="button"
                onClick={() => handleBulk('delete')}
                className="min-h-[36px] px-3 py-1.5 rounded-lg bg-red-700 text-white text-xs font-medium"
              >
                Hapus
              </button>
            </div>
          </div>
        )}

        {/* Mobile & Tablet Card List (< 1024px) */}
        <div className="lg:hidden space-y-3">
          {loading && (
            <div className="rounded-2xl bg-[#FFFFFF] border border-[#F0C6D2] p-8 text-center text-xs text-[#7D4E5D]">
              Memuat katalog produk...
            </div>
          )}

          {!loading && items.length === 0 && (
            <div className="rounded-2xl bg-[#FFFFFF] border border-[#F0C6D2] p-8 text-center text-[#7D4E5D]">
              <p className="font-medium text-sm text-[#3F232C]">Belum ada produk ditemukan.</p>
              <div className="mt-4 flex flex-col sm:flex-row justify-center gap-2">
                <Link
                  to="/admin/products/add"
                  className="min-h-[42px] inline-flex items-center justify-center px-4 py-2 rounded-xl bg-[#C25B7C] text-white text-xs font-medium"
                >
                  Tambah Produk Manual
                </Link>
                <Link
                  to="/admin/products/import"
                  className="min-h-[42px] inline-flex items-center justify-center px-4 py-2 rounded-xl border border-[#F0C6D2] text-[#3F232C] text-xs font-medium"
                >
                  Import Google Sheet / Excel
                </Link>
              </div>
            </div>
          )}

          {!loading &&
            items.map((item) => (
              <article
                key={item.id}
                className="rounded-2xl bg-[#FFFFFF] border border-[#F0C6D2] p-3.5 sm:p-4 space-y-3"
              >
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(item.id)}
                    onChange={() => toggleSelect(item.id)}
                    aria-label={`Pilih ${item.productName}`}
                    className="w-4 h-4 mt-1 accent-[#C25B7C] shrink-0"
                  />
                  <div className="w-14 h-14 rounded-xl overflow-hidden border border-[#F0C6D2]/70 shrink-0 bg-[#FFF6F8]">
                    <SafeImage
                      src={item.imageUrl}
                      alt={item.productName}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-sm font-semibold text-[#3F232C] line-clamp-2">
                        {item.productName}
                      </h3>
                      <button
                        type="button"
                        onClick={() => handleToggleFeatured(item)}
                        aria-label="Toggle Featured"
                        className={`p-1.5 rounded-lg shrink-0 ${
                          item.isFeatured ? 'text-amber-600 bg-amber-50' : 'text-[#7D4E5D]/40'
                        }`}
                      >
                        <Star className={`w-4 h-4 ${item.isFeatured ? 'fill-amber-500' : ''}`} />
                      </button>
                    </div>
                    <div className="mt-0.5 text-[11px] font-mono-tabular text-[#C25B7C] truncate">
                      /go/{item.productSlug}
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
                      <span className="font-semibold text-[#3F232C] tabular-nums">
                        {formatIdr(item.price) || '—'}
                      </span>
                      {item.categoryName && (
                        <span className="px-2 py-0.5 rounded-md bg-[#FFF6F8] border border-[#F0C6D2] text-[11px] text-[#7D4E5D]">
                          {item.categoryName}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => handleToggleActive(item)}
                        className={`px-2 py-0.5 rounded-md text-[11px] font-medium ${
                          item.isArchived
                            ? 'bg-neutral-100 text-neutral-600'
                            : item.isActive
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                              : 'bg-amber-50 text-amber-800 border border-amber-200'
                        }`}
                      >
                        {item.isArchived ? 'Archived' : item.isActive ? 'Aktif' : 'Nonaktif'}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Metrics Strip */}
                <div className="grid grid-cols-4 gap-2 rounded-xl bg-[#FFF6F8] border border-[#F0C6D2]/60 px-3 py-2 text-center text-[11px] tabular-nums">
                  <div>
                    <div className="text-[#7D4E5D]">Views</div>
                    <div className="font-semibold text-[#3F232C]">{item.views}</div>
                  </div>
                  <div>
                    <div className="text-[#7D4E5D]">Clicks</div>
                    <div className="font-semibold text-[#C25B7C]">{item.clicks}</div>
                  </div>
                  <div>
                    <div className="text-[#7D4E5D]">Unik</div>
                    <div className="font-semibold text-[#3F232C]">{item.uniqueClickers}</div>
                  </div>
                  <div>
                    <div className="text-[#7D4E5D]">CTR</div>
                    <div className="font-semibold text-[#3F232C]">{item.ctr}%</div>
                  </div>
                </div>

                {/* Affiliate URL + Touch Actions */}
                <div className="flex items-center justify-between gap-2 text-xs">
                  <a
                    href={`/go/${encodeURIComponent(item.productSlug)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] text-[#7D4E5D] hover:text-[#3F232C] truncate min-w-0"
                  >
                    <ExternalLink className="w-3 h-3 text-[#C25B7C] shrink-0" />
                    <span className="truncate">{item.affiliateUrl}</span>
                  </a>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingLinkProduct(item);
                      setEditingLinkUrl(item.affiliateUrl);
                    }}
                    className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#FFF6F8] border border-[#F0C6D2] text-[11px] font-medium text-[#C25B7C]"
                  >
                    <Link2 className="w-3 h-3" />
                    <span>Ubah Link</span>
                  </button>
                </div>

                <div className="grid grid-cols-4 gap-2 pt-2 border-t border-[#F0C6D2]/60">
                  <button
                    type="button"
                    onClick={() => navigate(`/admin/sandbox?productId=${item.id}`)}
                    className="min-h-[38px] inline-flex items-center justify-center gap-1 rounded-xl border border-[#F0C6D2] text-[11px] font-medium text-[#C25B7C]"
                  >
                    <FlaskConical className="w-3.5 h-3.5" />
                    <span>Uji</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate(`/admin/products/${item.id}/edit`)}
                    className="min-h-[38px] inline-flex items-center justify-center gap-1 rounded-xl border border-[#F0C6D2] text-[11px] font-medium text-[#3F232C]"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Edit</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDuplicate(item)}
                    className="min-h-[38px] inline-flex items-center justify-center gap-1 rounded-xl border border-[#F0C6D2] text-[11px] font-medium text-[#7D4E5D]"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteOne(item)}
                    className="min-h-[38px] inline-flex items-center justify-center gap-1 rounded-xl border border-red-200 bg-red-50/50 text-[11px] font-medium text-red-700"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Hapus</span>
                  </button>
                </div>
              </article>
            ))}

          {totalPages > 1 && (
            <div className="rounded-2xl bg-[#FFFFFF] border border-[#F0C6D2] px-4 py-3 flex items-center justify-between text-xs">
              <span className="text-[#7D4E5D] tabular-nums">
                Hal {page}/{totalPages}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="min-h-[38px] px-3 py-1.5 rounded-lg border border-[#F0C6D2] disabled:opacity-50"
                >
                  Prev
                </button>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="min-h-[38px] px-3 py-1.5 rounded-lg border border-[#F0C6D2] disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Desktop Table (PC 1024px+) */}
        <div className="hidden lg:block rounded-2xl bg-[#FFFFFF] border border-[#F0C6D2] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-[#FFF6F8] border-b border-[#F0C6D2] text-[#7D4E5D]">
                <tr>
                  <th className="p-3 text-left w-9">
                    <input
                      type="checkbox"
                      checked={items.length > 0 && selectedIds.length === items.length}
                      onChange={toggleSelectAll}
                      aria-label="Pilih semua produk"
                      className="accent-[#C25B7C]"
                    />
                  </th>
                  <th className="p-3 text-left">Produk</th>
                  <th className="p-3 text-left">Kategori</th>
                  <th className="p-3 text-right">Harga</th>
                  <th className="p-3 text-left">Affiliate URL</th>
                  <th className="p-3 text-center">Status</th>
                  <th className="p-3 text-center">Featured</th>
                  <th className="p-3 text-right">Views</th>
                  <th className="p-3 text-right">Clicks</th>
                  <th className="p-3 text-right">Unique</th>
                  <th className="p-3 text-right">CTR</th>
                  <th className="p-3 text-left">Last Click</th>
                  <th className="p-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0C6D2]/60">
                {loading && (
                  <tr>
                    <td colSpan={13} className="p-8 text-center text-[#7D4E5D]">
                      Memuat katalog produk...
                    </td>
                  </tr>
                )}

                {!loading && items.length === 0 && (
                  <tr>
                    <td colSpan={13} className="p-10 text-center text-[#7D4E5D]">
                      <p className="font-medium text-[#3F232C]">Belum ada produk ditemukan.</p>
                      <div className="mt-3 flex justify-center gap-2">
                        <Link
                          to="/admin/products/add"
                          className="px-4 py-2 rounded-xl bg-[#C25B7C] text-white text-xs font-medium"
                        >
                          Tambah Produk Manual
                        </Link>
                        <Link
                          to="/admin/products/import"
                          className="px-4 py-2 rounded-xl border border-[#F0C6D2] text-[#3F232C] text-xs font-medium"
                        >
                          Import Google Sheet / Excel
                        </Link>
                      </div>
                    </td>
                  </tr>
                )}

                {!loading &&
                  items.map((item) => (
                    <tr key={item.id} className="hover:bg-[#FFF6F8]/70 transition-colors">
                      <td className="p-3">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(item.id)}
                          onChange={() => toggleSelect(item.id)}
                          aria-label={`Pilih ${item.productName}`}
                          className="accent-[#C25B7C]"
                        />
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-3 min-w-[200px]">
                          <div className="w-11 h-11 rounded-lg overflow-hidden border border-[#F0C6D2]/70 shrink-0 bg-[#FFF6F8]">
                            <SafeImage
                              src={item.imageUrl}
                              alt={item.productName}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div className="min-w-0">
                            <div className="font-semibold text-[#3F232C] truncate max-w-[220px]">
                              {item.productName}
                            </div>
                            <div className="text-[11px] text-[#C25B7C] font-mono-tabular truncate max-w-[220px]">
                              /go/{item.productSlug}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="p-3 whitespace-nowrap text-[#7D4E5D]">
                        {item.categoryName || '—'}
                      </td>
                      <td className="p-3 text-right whitespace-nowrap tabular-nums font-medium">
                        {formatIdr(item.price) || '—'}
                      </td>
                      <td className="p-3 max-w-[180px]">
                        <div className="flex items-center gap-1.5">
                          <a
                            href={`/go/${encodeURIComponent(item.productSlug)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[#7D4E5D] hover:text-[#3F232C] truncate max-w-[130px]"
                            title={item.affiliateUrl}
                          >
                            <span className="truncate">{item.affiliateUrl}</span>
                            <ExternalLink className="w-3 h-3 shrink-0" />
                          </a>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingLinkProduct(item);
                              setEditingLinkUrl(item.affiliateUrl);
                            }}
                            title="Edit Cepat Link Affiliate"
                            className="p-1 rounded-md text-[#C25B7C] hover:bg-[#FDE8EE] shrink-0"
                          >
                            <Link2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                      <td className="p-3 text-center whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleToggleActive(item)}
                          className={`px-2 py-1 rounded-md text-[11px] font-medium ${
                            item.isArchived
                              ? 'bg-neutral-100 text-neutral-600'
                              : item.isActive
                                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                : 'bg-amber-50 text-amber-800 border border-amber-200'
                          }`}
                        >
                          {item.isArchived ? 'Archived' : item.isActive ? 'Aktif' : 'Nonaktif'}
                        </button>
                      </td>
                      <td className="p-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleFeatured(item)}
                          aria-label="Toggle Featured"
                          className={`p-1.5 rounded-lg ${
                            item.isFeatured
                              ? 'text-amber-600 bg-amber-50'
                              : 'text-[#7D4E5D]/40 hover:text-[#7D4E5D]'
                          }`}
                        >
                          <Star className={`w-4 h-4 ${item.isFeatured ? 'fill-amber-500' : ''}`} />
                        </button>
                      </td>
                      <td className="p-3 text-right tabular-nums">{item.views}</td>
                      <td className="p-3 text-right tabular-nums font-semibold text-[#3F232C]">
                        {item.clicks}
                      </td>
                      <td className="p-3 text-right tabular-nums">{item.uniqueClickers}</td>
                      <td className="p-3 text-right tabular-nums">{item.ctr}%</td>
                      <td className="p-3 whitespace-nowrap text-[11px] text-[#7D4E5D] tabular-nums">
                        {formatJakartaDateTime(item.lastClickAt)}
                      </td>
                      <td className="p-3 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => navigate(`/admin/sandbox?productId=${item.id}`)}
                            title="Uji di Sandbox"
                            className="p-1.5 rounded-lg text-[#C25B7C] hover:bg-[#FDE8EE]"
                          >
                            <FlaskConical className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => navigate(`/admin/products/${item.id}/edit`)}
                            title="Edit Produk"
                            className="p-1.5 rounded-lg text-[#7D4E5D] hover:bg-[#FDE8EE]"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDuplicate(item)}
                            title="Duplikasi Produk"
                            className="p-1.5 rounded-lg text-[#7D4E5D] hover:bg-[#FDE8EE]"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteOne(item)}
                            title="Hapus Produk"
                            className="p-1.5 rounded-lg text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-4 py-3 border-t border-[#F0C6D2]/70 flex items-center justify-between text-xs">
              <span className="text-[#7D4E5D] tabular-nums">
                Halaman {page} dari {totalPages}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="px-3 py-1.5 rounded-lg border border-[#F0C6D2] disabled:opacity-50"
                >
                  Sebelumnya
                </button>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="px-3 py-1.5 rounded-lg border border-[#F0C6D2] disabled:opacity-50"
                >
                  Berikutnya
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Inline Edit Affiliate Link Modal */}
        {editingLinkProduct && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#3F232C]/40 p-4">
            <form
              onSubmit={handleSaveQuickLink}
              className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-[#FFFFFF] border border-[#F0C6D2] p-5 sm:p-6 space-y-4 shadow-xl"
            >
              <div>
                <h3 className="font-serif-display text-lg font-semibold text-[#3F232C]">
                  Edit Link Affiliate
                </h3>
                <p className="text-xs text-[#7D4E5D] mt-0.5 break-words">
                  {editingLinkProduct.productName} (/go/{editingLinkProduct.productSlug})
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#3F232C] mb-1.5">
                  Shopee Affiliate URL *
                </label>
                <textarea
                  rows={3}
                  required
                  value={editingLinkUrl}
                  onChange={(e) => setEditingLinkUrl(e.target.value)}
                  placeholder="https://shopee.co.id/... atau https://s.shopee.co.id/..."
                  className="w-full p-3 rounded-xl border border-[#F0C6D2] bg-[#FFF6F8] text-xs font-mono-tabular text-[#3F232C] focus:outline-none focus:border-[#C25B7C]"
                />
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    const pid = editingLinkProduct.id;
                    setEditingLinkProduct(null);
                    navigate(`/admin/sandbox?productId=${pid}`);
                  }}
                  className="min-h-[40px] inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-[#F0C6D2] bg-[#FFF6F8] text-xs font-medium text-[#C25B7C]"
                >
                  <FlaskConical className="w-3.5 h-3.5" />
                  <span>Uji di Sandbox</span>
                </button>

                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingLinkProduct(null)}
                    className="min-h-[40px] px-4 py-2 rounded-xl border border-[#F0C6D2] text-xs font-medium text-[#3F232C]"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={savingLink}
                    className="min-h-[40px] px-4 py-2 rounded-xl bg-[#C25B7C] hover:bg-[#A84867] text-white text-xs font-medium"
                  >
                    {savingLink ? 'Menyimpan...' : 'Simpan Link'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        )}

        {/* Bulk Edit Modal */}
        {bulkCategoryModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#3F232C]/40 p-4">
            <div className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl bg-[#FFFFFF] border border-[#F0C6D2] p-5 sm:p-6 space-y-4">
              <h3 className="font-serif-display text-lg font-semibold text-[#3F232C]">
                Bulk Edit ({selectedIds.length} Produk)
              </h3>
              <div>
                <label className="block text-xs font-medium text-[#3F232C] mb-1">
                  Ubah Kategori (Opsional)
                </label>
                <select
                  value={bulkCatId}
                  onChange={(e) => setBulkCatId(e.target.value)}
                  className="w-full min-h-[42px] px-3 rounded-xl border border-[#F0C6D2] bg-[#FFF6F8] text-xs"
                >
                  <option value="">— Biarkan tetap —</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#3F232C] mb-1">
                  Ubah Label (Opsional)
                </label>
                <input
                  type="text"
                  value={bulkLabel}
                  onChange={(e) => setBulkLabel(e.target.value)}
                  placeholder="Contoh: BEST SELLER"
                  className="w-full min-h-[42px] px-3 rounded-xl border border-[#F0C6D2] bg-[#FFF6F8] text-xs"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setBulkCategoryModal(false)}
                  className="min-h-[40px] px-4 py-2 rounded-xl border border-[#F0C6D2] text-xs font-medium"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={() =>
                    handleBulk('edit', {
                      ...(bulkCatId ? { categoryId: bulkCatId } : {}),
                      ...(bulkLabel !== '' ? { label: bulkLabel } : {}),
                    })
                  }
                  className="min-h-[40px] px-4 py-2 rounded-xl bg-[#C25B7C] text-white text-xs font-medium"
                >
                  Simpan Perubahan
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
