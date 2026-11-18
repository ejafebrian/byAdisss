import React, { useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import { useAuth } from '../../lib/authContext';
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
        setAllowedDomains(s.allowed_affiliate_domains || 'shopee.co.id,shope.ee,s.shopee.co.id,shp.ee,shopee.com');
        setImportMaxRows(s.import_max_rows || '500');
        setRetentionDays(s.analytics_retention_days || '365');
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [authFetch]);

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
        <form onSubmit={handleSave} className="max-w-2xl rounded-2xl bg-[#FFFFFF] border border-[#F0C6D2] p-4 sm:p-6 space-y-5">
          <div>
            <label className="block text-xs font-medium text-[#3F232C] mb-1">
              Allowlist Domain Affiliate (dipisahkan koma)
            </label>
            <input
              type="text"
              value={allowedDomains}
              onChange={(e) => setAllowedDomains(e.target.value)}
              className="w-full min-h-[44px] px-3.5 rounded-xl border border-[#F0C6D2] bg-[#FFF6F8] text-xs font-mono-tabular focus:outline-none focus:border-[#C25B7C]"
            />
            <p className="mt-1 text-[11px] text-[#7D4E5D]">
              Endpoint /go/[slug], Sandbox Link, dan sistem import hanya mengizinkan redirect ke domain pada daftar ini.
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
      )}
    </AdminLayout>
  );
}
