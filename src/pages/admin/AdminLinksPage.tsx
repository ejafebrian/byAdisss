import React, { useCallback, useEffect, useState } from 'react';
import { Edit3, ExternalLink, Plus, Save, Trash2, X } from 'lucide-react';
import { useAuth } from '../../lib/authContext';
import { PublicLink } from '../../lib/types';
import { useUiFeedback } from '../../components/Toast';
import { AdminLayout } from './AdminLayout';

export function AdminLinksPage() {
  const { authFetch } = useAuth();
  const { notifySuccess, notifyError, confirmAction } = useUiFeedback();

  const [items, setItems] = useState<PublicLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [url, setUrl] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState('ExternalLink');
  const [sortOrder, setSortOrder] = useState('0');
  const [isActive, setIsActive] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch('/api/admin/links');
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
    setTitle('');
    setSlug('');
    setUrl('');
    setDescription('');
    setIcon('ExternalLink');
    setSortOrder('0');
    setIsActive(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const endpoint = editingId ? `/api/admin/links/${editingId}` : '/api/admin/links';
    const method = editingId ? 'PUT' : 'POST';
    const res = await authFetch(endpoint, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        slug,
        url,
        description,
        icon,
        sortOrder: Number(sortOrder) || 0,
        isActive,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      notifyError(json.error || 'Gagal menyimpan link');
      return;
    }
    notifySuccess(editingId ? 'Link diperbarui.' : 'Link ditambahkan.');
    resetForm();
    load();
  };

  const handleDelete = async (l: PublicLink) => {
    const ok = await confirmAction({
      title: 'Hapus Link?',
      message: `Hapus tautan "${l.title}"?`,
      confirmLabel: 'Hapus',
      destructive: true,
    });
    if (!ok) return;
    const res = await authFetch(`/api/admin/links/${l.id}`, { method: 'DELETE' });
    if (res.ok) {
      notifySuccess('Link dihapus.');
      load();
    }
  };

  return (
    <AdminLayout title="Links Management" subtitle="Kelola tautan link-in-bio terukur melalui redirect /l/[slug]">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <form
          onSubmit={handleSubmit}
          className="rounded-2xl bg-[#FFFFFF] border border-[#F0C6D2] p-5 space-y-4 self-start"
        >
          <div className="flex items-center justify-between">
            <h2 className="font-serif-display text-lg font-semibold text-[#3F232C]">
              {editingId ? 'Edit Tautan' : 'Tambah Tautan'}
            </h2>
            {editingId && (
              <button type="button" onClick={resetForm} className="text-xs text-[#C25B7C]">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-[#3F232C] mb-1">Judul Tautan *</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Koleksi Skincare Pagi"
              className="w-full min-h-[40px] px-3 rounded-xl border border-[#F0C6D2] bg-[#FFF6F8] text-sm focus:outline-none focus:border-[#C25B7C]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#3F232C] mb-1">Slug (/l/[slug])</label>
            <input
              type="text"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="skincare-pagi"
              className="w-full min-h-[40px] px-3 rounded-xl border border-[#F0C6D2] bg-[#FFF6F8] text-xs font-mono-tabular focus:outline-none focus:border-[#C25B7C]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#3F232C] mb-1">URL Tujuan *</label>
            <input
              type="url"
              required
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://shopee.co.id/..."
              className="w-full min-h-[40px] px-3 rounded-xl border border-[#F0C6D2] bg-[#FFF6F8] text-xs focus:outline-none focus:border-[#C25B7C]"
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
                <option value="ExternalLink">ExternalLink</option>
                <option value="Sparkles">Sparkles</option>
                <option value="ShoppingBag">ShoppingBag</option>
                <option value="Tag">Tag</option>
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
            <span>Aktif</span>
          </label>

          <button
            type="submit"
            className="w-full min-h-[42px] inline-flex items-center justify-center gap-2 rounded-xl bg-[#C25B7C] hover:bg-[#A84867] text-white text-xs font-medium"
          >
            {editingId ? <Save className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            <span>{editingId ? 'Simpan' : 'Tambah Tautan'}</span>
          </button>
        </form>

        <div className="lg:col-span-2 rounded-2xl bg-[#FFFFFF] border border-[#F0C6D2] overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-[#FFF6F8] border-b border-[#F0C6D2] text-[#7D4E5D]">
              <tr>
                <th className="p-3 text-left">Judul</th>
                <th className="p-3 text-left">Slug Redirect</th>
                <th className="p-3 text-right">Clicks</th>
                <th className="p-3 text-center">Status</th>
                <th className="p-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F0C6D2]/60">
              {loading && (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-[#7D4E5D]">
                    Memuat tautan...
                  </td>
                </tr>
              )}
              {!loading &&
                items.map((l) => (
                  <tr key={l.id} className="hover:bg-[#FFF6F8]/70">
                    <td className="p-3">
                      <div className="font-semibold text-[#3F232C]">{l.title}</div>
                      <div className="text-[11px] text-[#7D4E5D] truncate max-w-xs">{l.url}</div>
                    </td>
                    <td className="p-3 font-mono-tabular">
                      <a
                        href={`/l/${encodeURIComponent(l.slug)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[#C25B7C] hover:text-[#A84867]"
                      >
                        <span>/l/{l.slug}</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </td>
                    <td className="p-3 text-right tabular-nums font-medium">{l.clicks ?? 0}</td>
                    <td className="p-3 text-center">
                      <span
                        className={`px-2 py-0.5 rounded text-[11px] font-medium ${
                          l.isActive
                            ? 'bg-emerald-50 text-emerald-800'
                            : 'bg-amber-50 text-amber-800'
                        }`}
                      >
                        {l.isActive ? 'Aktif' : 'Nonaktif'}
                      </span>
                    </td>
                    <td className="p-3 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(l.id);
                          setTitle(l.title);
                          setSlug(l.slug);
                          setUrl(l.url);
                          setDescription(l.description || '');
                          setIcon(l.icon || 'ExternalLink');
                          setSortOrder(String(l.sortOrder ?? 0));
                          setIsActive(l.isActive !== false);
                        }}
                        className="p-1.5 rounded-lg text-[#C25B7C] hover:bg-[#FDE8EE]"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(l)}
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
