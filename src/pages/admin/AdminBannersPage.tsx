import React, { useCallback, useEffect, useState } from 'react';
import { Edit3, Plus, Save, Trash2, Upload, X } from 'lucide-react';
import { useAuth } from '../../lib/authContext';
import { PublicBanner } from '../../lib/types';
import { SafeImage } from '../../components/SafeImage';
import { useUiFeedback } from '../../components/Toast';
import { AdminLayout } from './AdminLayout';

export function AdminBannersPage() {
  const { authFetch } = useAuth();
  const { notifySuccess, notifyError, confirmAction } = useUiFeedback();

  const [items, setItems] = useState<PublicBanner[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [targetUrl, setTargetUrl] = useState('');
  const [sortOrder, setSortOrder] = useState('0');
  const [isActive, setIsActive] = useState(true);
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch('/api/admin/banners');
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
    setDescription('');
    setImageUrl('');
    setTargetUrl('');
    setSortOrder('0');
    setIsActive(true);
    setStartsAt('');
    setEndsAt('');
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('folder', 'banners');
      if (imageUrl.startsWith('/api/assets/')) {
        form.append('replaceUrl', imageUrl);
      }
      const res = await authFetch('/api/admin/upload', { method: 'POST', body: form });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Gagal mengunggah banner');
      setImageUrl(json.url);
      notifySuccess('Gambar banner diunggah.');
    } catch (err: any) {
      notifyError(err?.message || 'Gagal mengunggah gambar');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const endpoint = editingId ? `/api/admin/banners/${editingId}` : '/api/admin/banners';
    const method = editingId ? 'PUT' : 'POST';
    const res = await authFetch(endpoint, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        description,
        imageUrl,
        targetUrl,
        sortOrder: Number(sortOrder) || 0,
        isActive,
        startsAt: startsAt ? new Date(startsAt).toISOString() : null,
        endsAt: endsAt ? new Date(endsAt).toISOString() : null,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      notifyError(json.error || 'Gagal menyimpan banner');
      return;
    }
    notifySuccess(editingId ? 'Banner diperbarui.' : 'Banner ditambahkan.');
    resetForm();
    load();
  };

  const handleDelete = async (b: PublicBanner) => {
    const ok = await confirmAction({
      title: 'Hapus Banner?',
      message: `Hapus banner "${b.title}"?`,
      confirmLabel: 'Hapus',
      destructive: true,
    });
    if (!ok) return;
    const res = await authFetch(`/api/admin/banners/${b.id}`, { method: 'DELETE' });
    if (res.ok) {
      notifySuccess('Banner dihapus.');
      load();
    }
  };

  return (
    <AdminLayout title="Banners" subtitle="Kelola banner promosi halaman publik dan jadwal tayangnya">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <form
          onSubmit={handleSubmit}
          className="rounded-2xl bg-[#FFFFFF] border border-[#F0C6D2] p-5 space-y-4 self-start"
        >
          <div className="flex items-center justify-between">
            <h2 className="font-serif-display text-lg font-semibold text-[#3F232C]">
              {editingId ? 'Edit Banner' : 'Tambah Banner'}
            </h2>
            {editingId && (
              <button type="button" onClick={resetForm} className="text-xs text-[#C25B7C]">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-[#3F232C] mb-1">Judul Banner *</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="A Little Something You'll Love ♡"
              className="w-full min-h-[40px] px-3 rounded-xl border border-[#F0C6D2] bg-[#FFF6F8] text-sm focus:outline-none focus:border-[#C25B7C]"
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

          <div>
            <label className="block text-xs font-medium text-[#3F232C] mb-1">Upload Gambar Banner (16:9)</label>
            <div className="aspect-[16/9] rounded-xl overflow-hidden border border-[#F0C6D2] bg-[#FFF6F8] mb-2">
              <SafeImage src={imageUrl} alt={title || 'Banner'} className="w-full h-full object-cover" />
            </div>
            <div className="flex items-center gap-2">
              <label className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#F0C6D2] bg-[#FFF6F8] hover:bg-[#FDE8EE] text-xs font-medium text-[#3F232C] cursor-pointer">
                <Upload className="w-3.5 h-3.5 text-[#C25B7C]" />
                <span>{uploading ? 'Mengunggah...' : 'Upload'}</span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  onChange={handleUpload}
                  className="sr-only"
                />
              </label>
              <input
                type="text"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="Atau URL gambar"
                className="flex-1 min-h-[38px] px-3 rounded-xl border border-[#F0C6D2] bg-[#FFF6F8] text-xs"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#3F232C] mb-1">URL Tujuan (Opsional)</label>
            <input
              type="text"
              value={targetUrl}
              onChange={(e) => setTargetUrl(e.target.value)}
              placeholder="#catalog atau https://..."
              className="w-full min-h-[40px] px-3 rounded-xl border border-[#F0C6D2] bg-[#FFF6F8] text-xs"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#3F232C] mb-1">Mulai Tayang</label>
              <input
                type="datetime-local"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
                className="w-full min-h-[38px] px-2 rounded-xl border border-[#F0C6D2] bg-[#FFF6F8] text-[11px]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#3F232C] mb-1">Selesai Tayang</label>
              <input
                type="datetime-local"
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
                className="w-full min-h-[38px] px-2 rounded-xl border border-[#F0C6D2] bg-[#FFF6F8] text-[11px]"
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-3">
            <label className="flex items-center gap-2 text-xs font-medium text-[#3F232C]">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="w-4 h-4 accent-[#C25B7C]"
              />
              <span>Aktif</span>
            </label>
            <div className="flex items-center gap-2">
              <span className="text-xs text-[#7D4E5D]">Urutan</span>
              <input
                type="number"
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
                className="w-20 min-h-[38px] px-2.5 rounded-xl border border-[#F0C6D2] bg-[#FFF6F8] text-xs tabular-nums"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full min-h-[42px] inline-flex items-center justify-center gap-2 rounded-xl bg-[#C25B7C] hover:bg-[#A84867] text-white text-xs font-medium"
          >
            {editingId ? <Save className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            <span>{editingId ? 'Simpan Banner' : 'Tambah Banner'}</span>
          </button>
        </form>

        <div className="lg:col-span-2 space-y-4">
          {loading && (
            <div className="rounded-2xl bg-[#FFFFFF] border border-[#F0C6D2] p-8 text-center text-xs text-[#7D4E5D]">
              Memuat banner...
            </div>
          )}
          {!loading &&
            items.map((b) => (
              <div
                key={b.id}
                className="rounded-2xl bg-[#FFFFFF] border border-[#F0C6D2] p-4 flex flex-col sm:flex-row gap-4 items-center"
              >
                <div className="w-full sm:w-44 aspect-[16/9] rounded-xl overflow-hidden bg-[#FFF6F8] shrink-0">
                  <SafeImage src={b.imageUrl} alt={b.title} className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-0.5 rounded text-[11px] font-medium ${
                        b.isActive ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'
                      }`}
                    >
                      {b.isActive ? 'Aktif' : 'Nonaktif'}
                    </span>
                    <span className="text-[11px] text-[#7D4E5D]">Urutan #{b.sortOrder}</span>
                  </div>
                  <h3 className="mt-1 font-serif-display text-base font-semibold text-[#3F232C]">
                    {b.title}
                  </h3>
                  {b.description && <p className="text-xs text-[#7D4E5D] mt-0.5">{b.description}</p>}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingId(b.id);
                      setTitle(b.title);
                      setDescription(b.description || '');
                      setImageUrl(b.imageUrl || '');
                      setTargetUrl(b.targetUrl || '');
                      setSortOrder(String(b.sortOrder ?? 0));
                      setIsActive(b.isActive !== false);
                      setStartsAt(b.startsAt ? b.startsAt.slice(0, 16) : '');
                      setEndsAt(b.endsAt ? b.endsAt.slice(0, 16) : '');
                    }}
                    className="p-2 rounded-lg text-[#C25B7C] hover:bg-[#FDE8EE]"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(b)}
                    className="p-2 rounded-lg text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
        </div>
      </div>
    </AdminLayout>
  );
}
