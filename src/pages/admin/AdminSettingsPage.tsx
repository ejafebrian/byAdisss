import React, { useEffect, useState } from 'react';
import { ArrowRight, Database, Plus, Save } from 'lucide-react';
import { useAuth } from '../../lib/authContext';
import { Link } from '../../lib/router';
import {
  DEFAULT_ALLOWED_AFFILIATE_DOMAINS,
  TIKTOK_ALLOWED_AFFILIATE_DOMAINS,
} from '../../lib/validators';
import { useUiFeedback } from '../../components/Toast';
import { AdminLayout } from './AdminLayout';

export function AdminSettingsPage() {
  const { authFetch } = useAuth();
  const { notifySuccess, notifyError } = useUiFeedback();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [allowedDomains, setAllowedDomains] = useState('');
  const [importMaxRows, setImportMaxRows] = useState('500');
  const [retentionDays, setRetentionDays] = useState('365');

  useEffect(() => {
    authFetch('/api/admin/settings')
      .then((r) => r.json())
      .then((d) => {
        const s = d.settings || {};
        setAllowedDomains(s.allowed_affiliate_domains || DEFAULT_ALLOWED_AFFILIATE_DOMAINS.join(','));
        setImportMaxRows(s.import_max_rows || '500');
        setRetentionDays(s.analytics_retention_days || '365');
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [authFetch]);

  const parsedDomainList = allowedDomains
    .split(',')
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);
  const missingTikTokDomains = TIKTOK_ALLOWED_AFFILIATE_DOMAINS.filter(
    (d) => !parsedDomainList.includes(d)
  );

  const handleAppendTikTokDomains = () => {
    const merged = Array.from(new Set([...parsedDomainList, ...TIKTOK_ALLOWED_AFFILIATE_DOMAINS]));
    setAllowedDomains(merged.join(','));
  };

  const handleResetDefaultDomains = () => {
    setAllowedDomains(DEFAULT_ALLOWED_AFFILIATE_DOMAINS.join(','));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await authFetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          settings: {
            allowed_affiliate_domains: allowedDomains,
            import_max_rows: importMaxRows,
            analytics_retention_days: retentionDays,
            privacy_notice_enabled: 'false',
            privacy_notice_text: '',
          },
        }),
      });
      if (!res.ok) throw new Error('Gagal menyimpan pengaturan');
      notifySuccess('Pengaturan website berhasil diperbarui.');
    } catch (err: any) {
      notifyError(err?.message || 'Gagal menyimpan');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminLayout title="Website Settings" subtitle="Konfigurasi domain affiliate yang diizinkan, batas import, dan retensi data analitik">
      {loading ? (
        <div className="rounded-2xl bg-[#FFFFFF] border border-[#F0C6D2] p-8 text-center text-xs text-[#7D4E5D]">
          Memuat pengaturan...
        </div>
      ) : (
        <div className="max-w-2xl space-y-6">
          <form onSubmit={handleSave} className="rounded-2xl bg-[#FFFFFF] border border-[#F0C6D2] p-4 sm:p-6 space-y-5">
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                <label className="block text-xs font-medium text-[#3F232C]">
                  Allowlist Domain Affiliate (dipisahkan koma)
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  {missingTikTokDomains.length > 0 && (
                    <button
                      type="button"
                      onClick={handleAppendTikTokDomains}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#FDE8EE] hover:bg-[#F9D6E0] text-[#C25B7C] text-[11px] font-medium transition-colors"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Tambahkan Domain TikTok</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleResetDefaultDomains}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-[#F0C6D2] bg-[#FFF6F8] hover:bg-[#FDE8EE]/50 text-[#7D4E5D] text-[11px] font-medium transition-colors"
                  >
                    Reset Default Shopee & TikTok
                  </button>
                </div>
              </div>
              <input
                type="text"
                value={allowedDomains}
                onChange={(e) => setAllowedDomains(e.target.value)}
                className="w-full min-h-[44px] px-3.5 rounded-xl border border-[#F0C6D2] bg-[#FFF6F8] text-xs font-mono-tabular focus:outline-none focus:border-[#C25B7C]"
              />
              <p className="mt-1 text-[11px] text-[#7D4E5D]">
                Endpoint /go/[slug], Sandbox Link, dan sistem import hanya mengizinkan redirect ke domain pada daftar ini (mendukung Shopee & TikTok).
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-[#3F232C] mb-1">
                  Maksimal Baris Import per File / Sheet
                </label>
                <input
                  type="number"
                  min="1"
                  max="2000"
                  value={importMaxRows}
                  onChange={(e) => setImportMaxRows(e.target.value)}
                  className="w-full min-h-[44px] px-3.5 rounded-xl border border-[#F0C6D2] bg-[#FFF6F8] text-sm tabular-nums"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#3F232C] mb-1">
                  Kebijakan Retensi Data Analitik (Hari)
                </label>
                <input
                  type="number"
                  min="30"
                  max="3650"
                  value={retentionDays}
                  onChange={(e) => setRetentionDays(e.target.value)}
                  className="w-full min-h-[44px] px-3.5 rounded-xl border border-[#F0C6D2] bg-[#FFF6F8] text-sm tabular-nums"
                />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={saving}
                className="w-full sm:w-auto min-h-[44px] inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#C25B7C] hover:bg-[#A84867] text-white text-xs font-medium"
              >
                <Save className="w-4 h-4" />
                <span>{saving ? 'Menyimpan...' : 'Simpan Pengaturan'}</span>
              </button>
            </div>
          </form>

          <div className="rounded-2xl bg-[#FFFFFF] border border-[#F0C6D2] p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#FDE8EE] text-[#C25B7C] flex items-center justify-center shrink-0">
                <Database className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-serif-display text-base font-semibold text-[#3F232C]">
                  Sinkronisasi Database & Skema Otomatis
                </h2>
                <p className="text-xs text-[#7D4E5D] mt-0.5">
                  Periksa koneksi PostgreSQL & Firestore, buat tabel/kolom yang kurang secara otomatis, dan sinkronkan sequence database.
                </p>
              </div>
            </div>
            <Link
              to="/admin/database"
              className="min-h-[42px] inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-[#FDE8EE] hover:bg-[#F9D6E0] text-[#3F232C] text-xs font-medium shrink-0"
            >
              <span>Buka Database Sync</span>
              <ArrowRight className="w-3.5 h-3.5 text-[#C25B7C]" />
            </Link>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
