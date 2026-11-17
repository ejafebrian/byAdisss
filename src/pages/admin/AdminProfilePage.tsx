import React, { useEffect, useState } from 'react';
import { Save, Upload } from 'lucide-react';
import { useAuth } from '../../lib/authContext';
import { SafeImage } from '../../components/SafeImage';
import { useUiFeedback } from '../../components/Toast';
import { AdminLayout } from './AdminLayout';

export function AdminProfilePage() {
  const { authFetch } = useAuth();
  const { notifySuccess, notifyError } = useUiFeedback();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [brandName, setBrandName] = useState('by Adisss');
  const [username, setUsername] = useState('@adisssfinds');
  const [tagline, setTagline] = useState('GOOD FINDS, HAPPY BUYS!');
  const [description, setDescription] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [instagramUrl, setInstagramUrl] = useState('');
  const [tiktokUrl, setTiktokUrl] = useState('');
  const [footerText, setFooterText] = useState('');

  useEffect(() => {
    authFetch('/api/admin/profile')
      .then((r) => r.json())
      .then((d) => {
        const p = d.profile;
        if (p) {
          setBrandName(p.brandName || '');
          setUsername(p.username || '');
          setTagline(p.tagline || '');
          setDescription(p.description || '');
          setAvatarUrl(p.avatarUrl || '');
          setInstagramUrl(p.instagramUrl || '');
          setTiktokUrl(p.tiktokUrl || '');
          setFooterText(p.footerText || '');
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [authFetch]);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('folder', 'profile');
      if (avatarUrl.startsWith('/api/assets/')) {
        form.append('replaceUrl', avatarUrl);
      }
      const res = await authFetch('/api/admin/upload', { method: 'POST', body: form });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Gagal mengunggah foto profil');
      setAvatarUrl(json.url);
      notifySuccess('Foto profil diperbarui.');
    } catch (err: any) {
      notifyError(err?.message || 'Gagal mengunggah foto');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await authFetch('/api/admin/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brandName,
          username,
          tagline,
          description,
          avatarUrl,
          instagramUrl,
          tiktokUrl,
          whatsappUrl: '',
          footerText,
          affiliateDisclosure: '',
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Gagal menyimpan profil');
      notifySuccess('Profil publik by Adisss berhasil disimpan.');
    } catch (err: any) {
      notifyError(err?.message || 'Gagal menyimpan profil');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminLayout title="Profile Settings" subtitle="Atur identitas brand, foto profil, tautan sosial media header, dan teks footer">
      {loading ? (
        <div className="rounded-2xl bg-[#FFFFFF] border border-[#F0C6D2] p-8 text-center text-xs text-[#7D4E5D]">
          Memuat profil...
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="max-w-3xl rounded-2xl bg-[#FFFFFF] border border-[#F0C6D2] p-6 space-y-5">
          <div className="flex items-center gap-5">
            <div className="w-20 h-20 rounded-full overflow-hidden border border-[#F0C6D2] bg-[#FFF6F8] shrink-0">
              <SafeImage src={avatarUrl} alt={brandName} className="w-full h-full object-cover" />
            </div>
            <div className="space-y-2">
              <label className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-[#F0C6D2] bg-[#FFF6F8] hover:bg-[#FDE8EE] text-xs font-medium text-[#3F232C] cursor-pointer">
                <Upload className="w-3.5 h-3.5 text-[#C25B7C]" />
                <span>{uploading ? 'Mengunggah...' : 'Ganti Foto Profil'}</span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleAvatarUpload}
                  className="sr-only"
                />
              </label>
              <p className="text-[11px] text-[#7D4E5D]">Format JPG/PNG/WEBP maksimal 2MB.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-[#3F232C] mb-1">Brand Name</label>
              <input
                type="text"
                required
                value={brandName}
                onChange={(e) => setBrandName(e.target.value)}
                className="w-full min-h-[42px] px-3.5 rounded-xl border border-[#F0C6D2] bg-[#FFF6F8] text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#3F232C] mb-1">Username</label>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full min-h-[42px] px-3.5 rounded-xl border border-[#F0C6D2] bg-[#FFF6F8] text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#3F232C] mb-1">Tagline</label>
            <input
              type="text"
              required
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              className="w-full min-h-[42px] px-3.5 rounded-xl border border-[#F0C6D2] bg-[#FFF6F8] text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#3F232C] mb-1">Bio / Deskripsi Singkat</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full p-3.5 rounded-xl border border-[#F0C6D2] bg-[#FFF6F8] text-sm"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-[#3F232C] mb-1">Instagram URL (Header)</label>
              <input
                type="url"
                value={instagramUrl}
                onChange={(e) => setInstagramUrl(e.target.value)}
                className="w-full min-h-[40px] px-3 rounded-xl border border-[#F0C6D2] bg-[#FFF6F8] text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#3F232C] mb-1">TikTok URL (Header)</label>
              <input
                type="url"
                value={tiktokUrl}
                onChange={(e) => setTiktokUrl(e.target.value)}
                className="w-full min-h-[40px] px-3 rounded-xl border border-[#F0C6D2] bg-[#FFF6F8] text-xs"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#3F232C] mb-1">Footer Text</label>
            <input
              type="text"
              value={footerText}
              onChange={(e) => setFooterText(e.target.value)}
              className="w-full min-h-[40px] px-3.5 rounded-xl border border-[#F0C6D2] bg-[#FFF6F8] text-sm"
            />
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#C25B7C] hover:bg-[#A84867] text-white text-xs font-medium"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Menyimpan...' : 'Simpan Profil'}</span>
            </button>
          </div>
        </form>
      )}
    </AdminLayout>
  );
}
