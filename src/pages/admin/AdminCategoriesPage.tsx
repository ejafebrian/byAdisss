import React, { useCallback, useEffect, useState } from 'react';
import { Edit3, Plus, Save, Trash2, X } from 'lucide-react';
import { useAuth } from '../../lib/authContext';
import { PublicCategory } from '../../lib/types';
import { useUiFeedback } from '../../components/Toast';
import { AdminLayout } from './AdminLayout';

const ICONS = ['Flame', 'ShoppingBag', 'Sparkles', 'Home', 'Coffee', 'Tag'];

export function AdminCategoriesPage() {
  const { authFetch } = useAuth();
  const { notifySuccess, notifyError, confirmAction } = useUiFeedback();

  const [items, setItems] = useState<PublicCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState('Sparkles');
  const [sortOrder, setSortOrder] = useState('0');
  const [isActive, setIsActive] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch('/api/admin/categories');
      const json = await res.json();
      setItems(json.items || []);
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    load();
  }, [load]);

  const resetForm = () => {
    setEditingId(null);
    setName('');
    setSlug('');
    setDescription('');
    setIcon('Sparkles');
    setSortOrder('0');
    setIsActive(true);
  };

  const startEdit = (c: PublicCategory) => {
    setEditingId(c.id);
    setName(c.name);
    setSlug(c.slug);
    setDescription(c.description || '');
    setIcon(c.icon || 'Sparkles');
    setSortOrder(String(c.sortOrder ?? 0));
    setIsActive(c.isActive !== false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = editingId ? `/api/admin/categories/${editingId}` : '/api/admin/categories';
    const method = editingId ? 'PUT' : 'POST';
    const res = await authFetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        slug,
        description,
        icon,
        sortOrder: Number(sortOrder) || 0,
        isActive,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      notifyError(json.error || 'Gagal menyimpan kategori');
      return;
    }
    notifySuccess(editingId ? 'Kategori diperbarui.' : 'Kategori ditambahkan.');
    resetForm();
    load();
  };

  const handleDelete = async (c: PublicCategory) => {
    const ok = await confirmAction({
      title: `Hapus Kategori "${c.name}"?`,
      message:
        (c.productCount || 0) > 0
          ? `Kategori ini terhubung ke ${c.productCount} produk. Jika dihapus, produk tersebut akan dilepas dari kategori ini.`
          : 'Kategori akan dihapus permanen.',
      confirmLabel: 'Hapus Kategori',
      destructive: true,
    });
    if (!ok) return;

    const res = await authFetch(`/api/admin/categories/${c.id}?force=true`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      notifyError(json.error || 'Gagal menghapus kategori');
      return;
    }
    notifySuccess('Kategori dihapus.');
    load();
  };

  return (
    <AdminLayout title="Categories" subtitle="Kelola kategori katalog produk publik">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <form
          onSubmit={handleSubmit}
          className="rounded-2xl bg-[#FFFFFF] border border-[#F0C6D2] p-5 space-y-4 self-start"
        >
          <div className="flex items-center justify-between">
            <h2 className="font-serif-display text-lg font-semibold text-[#3F232C]">
              {editingId ? 'Edit Kategori' : 'Tambah Kategori'}
            </h2>
            {editingId && (
              <button type="button" onClick={resetForm} className="text-xs text-[#C25B7C]">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-[#3F232C] mb-1">Nama Kategori *</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Beauty & Skincare"
              className="w-full min-h-[40px] px-3 rounded-xl border border-[#F0C6D2] bg-[#FFF6F8] text-sm focus:outline-none focus:border-[#C25B7C]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#3F232C] mb-1">Slug</label>
            <input
              type="text"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="beauty-skincare"
              className="w-full min-h-[40px] px-3 rounded-xl border border-[#F0C6D2] bg-[#FFF6F8] text-xs font-mono-tabular focus:outline-none focus:border-[#C25B7C]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#3F232C] mb-1">Deskripsi</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full p-3 rounded-xl border border-[#F0C6D2] bg-[#FFF6F8] text-xs focus:outline-none focus:border-[#C25B7C]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#3F232C] mb-1">Ikon</label>
              <select
                value={icon}
                onChange={(e) => setIcon(e.target.value)}
                className="w-full min-h-[40px] px-3 rounded-xl border border-[#F0C6D2] bg-[#FFF6F8] text-xs"
              >
                {ICONS.map((ic) => (
                  <option key={ic} value={ic}>
                    {ic}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#3F232C] mb-1">Sort Order</label>
              <input
                type="number"
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
                className="w-full min-h-[40px] px-3 rounded-xl border border-[#F0C6D2] bg-[#FFF6F8] text-xs tabular-nums"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-xs font-medium text-[#3F232C]">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="w-4 h-4 accent-[#C25B7C]"
            />
            <span>Kategori Aktif</span>
          </label>

          <button
            type="submit"
            className="w-full min-h-[42px] inline-flex items-center justify-center gap-2 rounded-xl bg-[#C25B7C] hover:bg-[#A84867] text-white text-xs font-medium"
          >
            {editingId ? <Save className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            <span>{editingId ? 'Simpan Perubahan' : 'Tambah Kategori'}</span>
          </button>
        </form>

        <div className="lg:col-span-2 rounded-2xl bg-[#FFFFFF] border border-[#F0C6D2] overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-[#FFF6F8] border-b border-[#F0C6D2] text-[#7D4E5D]">
              <tr>
                <th className="p-3 text-left">Nama</th>
                <th className="p-3 text-left">Slug</th>
                <th className="p-3 text-right">Produk</th>
                <th className="p-3 text-right">Urutan</th>
                <th className="p-3 text-center">Status</th>
                <th className="p-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F0C6D2]/60">
              {loading && (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-[#7D4E5D]">
                    Memuat kategori...
                  </td>
                </tr>
              )}
              {!loading &&
                items.map((c) => (
                  <tr key={c.id} className="hover:bg-[#FFF6F8]/70">
                    <td className="p-3 font-semibold text-[#3F232C]">{c.name}</td>
                    <td className="p-3 font-mono-tabular text-[#C25B7C]">{c.slug}</td>
                    <td className="p-3 text-right tabular-nums">{c.productCount ?? 0}</td>
                    <td className="p-3 text-right tabular-nums">{c.sortOrder}</td>
                    <td className="p-3 text-center">
                      <span
                        className={`px-2 py-0.5 rounded text-[11px] font-medium ${
                          c.isActive
                            ? 'bg-emerald-50 text-emerald-800'
                            : 'bg-amber-50 text-amber-800'
                        }`}
                      >
                        {c.isActive ? 'Aktif' : 'Nonaktif'}
                      </span>
                    </td>
                    <td className="p-3 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => startEdit(c)}
                        className="p-1.5 rounded-lg text-[#C25B7C] hover:bg-[#FDE8EE]"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(c)}
                        className="p-1.5 rounded-lg text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </AdminLayout>
  );
}
