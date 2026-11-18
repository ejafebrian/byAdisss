import React, { useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Copy,
  Download,
  FileSpreadsheet,
  Link2,
  RefreshCw,
  Upload,
} from 'lucide-react';
import { useAuth } from '../../lib/authContext';
import { Link } from '../../lib/router';
import { formatIdr } from '../../lib/types';
import { useUiFeedback } from '../../components/Toast';
import { AdminLayout } from './AdminLayout';

interface PreviewRow {
  rowNumber: number;
  productNumber?: number | null;
  productName: string;
  productSlug: string;
  categoryName: string;
  price: number | null;
  affiliateUrl: string;
  label: string;
  isFeatured: boolean;
  isActive: boolean;
  validationStatus: 'valid' | 'warning' | 'error';
  errors: string[];
  warnings: string[];
  existsInDb: boolean;
}

interface PreviewResponse {
  filename: string;
  totalRows: number;
  maxRows: number;
  validCount: number;
  warningCount: number;
  errorCount: number;
  duplicateInDbCount: number;
  rows: PreviewRow[];
}

interface ImportResultResponse {
  job: {
    id: number;
    filename: string;
    totalRows: number;
    successRows: number;
    updatedRows: number;
    skippedRows: number;
    failedRows: number;
    importStatus: string;
  };
  errors: { rowNumber: number; errorMessage: string; rowData: PreviewRow }[];
}

const HEADER_COLUMNS =
  'product_number\tproduct_name\tproduct_slug\tcategory\tdescription\tprice\timage_url\taffiliate_url\tlabel\tfeatured\tstatus\tsort_order';

export function AdminImportPage() {
  const { authFetch } = useAuth();
  const { notifySuccess, notifyError } = useUiFeedback();

  const [sourceMode, setSourceMode] = useState<'file' | 'google_sheet'>('google_sheet');
  const [googleSheetUrl, setGoogleSheetUrl] = useState('');
  const [uploadingPreview, setUploadingPreview] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duplicateMode, setDuplicateMode] = useState<'skip' | 'update' | 'new_only'>('skip');
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [result, setResult] = useState<ImportResultResponse | null>(null);

  const handleDownloadTemplate = async () => {
    const res = await authFetch('/api/admin/import/template');
    if (!res.ok) {
      notifyError('Gagal mengunduh template spreadsheet.');
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'by-adisss-import-template.xlsx';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyHeaders = async () => {
    try {
      await navigator.clipboard.writeText(HEADER_COLUMNS);
      notifySuccess('Header kolom Google Sheet disalin ke clipboard.');
    } catch {
      notifyError('Gagal menyalin header.');
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPreview(true);
    setResult(null);
    setPreview(null);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await authFetch('/api/admin/import/preview', {
        method: 'POST',
        body: form,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Gagal memvalidasi file spreadsheet');
      setPreview(json);
      notifySuccess(`File "${json.filename}" berhasil dibaca (${json.totalRows} baris).`);
    } catch (err: any) {
      notifyError(err?.message || 'Gagal memproses file');
    } finally {
      setUploadingPreview(false);
      e.target.value = '';
    }
  };

  const handleGoogleSheetPreview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!googleSheetUrl.trim()) {
      notifyError('Masukkan URL Google Sheet terlebih dahulu.');
      return;
    }
    setUploadingPreview(true);
    setResult(null);
    setPreview(null);
    try {
      const res = await authFetch('/api/admin/import/google-sheet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: googleSheetUrl.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Gagal mengambil data dari Google Sheet');
      setPreview(json);
      notifySuccess(`Google Sheet berhasil dimuat (${json.totalRows} baris siap divalidasi).`);
    } catch (err: any) {
      notifyError(err?.message || 'Gagal memproses Google Sheet');
    } finally {
      setUploadingPreview(false);
    }
  };

  const computePreSummary = () => {
    if (!preview) return { toAdd: 0, toUpdate: 0, toSkip: 0, toReject: 0 };
    let toAdd = 0;
    let toUpdate = 0;
    let toSkip = 0;
    let toReject = 0;

    for (const r of preview.rows) {
      if (r.errors.length > 0) {
        toReject++;
      } else if (r.existsInDb) {
        if (duplicateMode === 'update') toUpdate++;
        else toSkip++;
      } else {
        toAdd++;
      }
    }
    return { toAdd, toUpdate, toSkip, toReject };
  };

  const handleRunImport = async (rowsOverride?: PreviewRow[]) => {
    const targetRows = rowsOverride || preview?.rows;
    if (!targetRows || !targetRows.length) return;

    setExecuting(true);
    setProgress(20);
    const timer = setInterval(() => {
      setProgress((p) => (p < 88 ? p + 12 : p));
    }, 250);

    try {
      const res = await authFetch('/api/admin/import/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: preview?.filename || 'retry-import.xlsx',
          duplicateMode,
          rows: targetRows,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Proses import gagal');
      setProgress(100);
      setResult(json);
      notifySuccess('Proses import selesai.');
    } catch (err: any) {
      notifyError(err?.message || 'Gagal menjalankan import');
    } finally {
      clearInterval(timer);
      setExecuting(false);
    }
  };

  const handleDownloadErrorCsv = async (jobId: number) => {
    const res = await authFetch(`/api/admin/import/history/${jobId}/errors.csv`);
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `import-errors-job-${jobId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const summary = computePreSummary();

  return (
    <AdminLayout
      title="Import Produk Massal"
      subtitle="Unggah produk massal melalui Google Sheet atau file Excel (.xlsx, .xls) / CSV hingga 500 baris"
      actions={
        <button
          type="button"
          onClick={handleDownloadTemplate}
          className="min-h-[40px] inline-flex items-center gap-1.5 px-3 sm:px-3.5 py-2 rounded-xl border border-[#F0C6D2] bg-[#FFFFFF] hover:bg-[#FFF6F8] text-xs font-medium text-[#3F232C] whitespace-nowrap"
        >
          <Download className="w-4 h-4 text-[#C25B7C]" />
          <span className="hidden sm:inline">Download Template (.xlsx)</span>
          <span className="sm:hidden">Template</span>
        </button>
      }
    >
      <div className="space-y-6">
        {/* Source Selector & Upload Card */}
        {!result && (
          <section className="rounded-2xl bg-[#FFFFFF] border border-[#F0C6D2] p-4 sm:p-6 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="font-serif-display text-lg font-semibold text-[#3F232C]">
                  1. Pilih Sumber Data Produk
                </h2>
                <p className="text-xs text-[#7D4E5D] mt-1">
                  Kolom wajib: <span className="font-mono-tabular text-[#C25B7C]">product_name</span> dan{' '}
                  <span className="font-mono-tabular text-[#C25B7C]">affiliate_url</span>. Validasi dilakukan penuh di server.
                </p>
              </div>

              <div className="grid grid-cols-2 sm:inline-flex p-1 rounded-xl bg-[#FFF6F8] border border-[#F0C6D2] w-full sm:w-auto self-start">
                <button
                  type="button"
                  onClick={() => setSourceMode('google_sheet')}
                  className={`min-h-[38px] px-3.5 py-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                    sourceMode === 'google_sheet'
                      ? 'bg-[#C25B7C] text-white'
                      : 'text-[#7D4E5D] hover:text-[#3F232C]'
                  }`}
                >
                  Google Sheet
                </button>
                <button
                  type="button"
                  onClick={() => setSourceMode('file')}
                  className={`min-h-[38px] px-3.5 py-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                    sourceMode === 'file'
                      ? 'bg-[#C25B7C] text-white'
                      : 'text-[#7D4E5D] hover:text-[#3F232C]'
                  }`}
                >
                  File Excel / CSV
                </button>
              </div>
            </div>

            {sourceMode === 'google_sheet' ? (
              <form onSubmit={handleGoogleSheetPreview} className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="relative flex-1">
                    <Link2 className="w-4 h-4 text-[#C25B7C] absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="url"
                      required
                      value={googleSheetUrl}
                      onChange={(e) => setGoogleSheetUrl(e.target.value)}
                      placeholder="https://docs.google.com/spreadsheets/d/1AbC.../edit?usp=sharing"
                      className="w-full min-h-[44px] pl-10 pr-3.5 rounded-xl border border-[#F0C6D2] bg-[#FFF6F8] text-xs text-[#3F232C] focus:outline-none focus:border-[#C25B7C]"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={uploadingPreview || executing}
                    className="min-h-[44px] inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-[#C25B7C] hover:bg-[#A84867] disabled:opacity-60 text-white text-xs font-medium whitespace-nowrap"
                  >
                    <FileSpreadsheet className="w-4 h-4" />
                    <span>
                      {uploadingPreview ? 'Mengambil Google Sheet...' : 'Ambil & Preview Google Sheet'}
                    </span>
                  </button>
                </div>

                <div className="rounded-xl bg-[#FFF6F8] border border-[#F0C6D2]/80 p-3.5 sm:p-4 space-y-2.5 text-xs text-[#7D4E5D]">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold text-[#3F232C]">
                      Panduan Singkat Google Sheet:
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyHeaders}
                      className="min-h-[34px] inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#FFFFFF] border border-[#F0C6D2] text-[11px] font-medium text-[#C25B7C] hover:bg-[#FDE8EE]"
                    >
                      <Copy className="w-3 h-3" />
                      <span>Salin Header Kolom</span>
                    </button>
                  </div>
                  <p className="leading-relaxed">
                    Pastikan akses Google Sheet diset ke <strong>Anyone with the link (Viewer / Lihat saja)</strong>, lalu tempel URL spreadsheet di atas. Anda bisa menyalin header kolom standar berikut ke baris 1 Google Sheet Anda:
                  </p>
                  <div className="p-2.5 rounded-lg bg-[#FFFFFF] border border-[#F0C6D2]/70 font-mono-tabular text-[11px] text-[#3F232C] overflow-x-auto whitespace-nowrap">
                    product_number | product_name | product_slug | category | description | price | image_url | affiliate_url | label | featured | status | sort_order
                  </div>
                </div>
              </form>
            ) : (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl bg-[#FFF6F8] border border-dashed border-[#F0C6D2] p-4 sm:p-5">
                <div className="text-xs text-[#7D4E5D] space-y-1">
                  <div className="font-semibold text-[#3F232C]">Unggah File Spreadsheet Lokal</div>
                  <p>Mendukung format .xlsx, .xls, dan .csv maksimal 5MB (hingga 500 baris).</p>
                </div>
                <label className="min-h-[44px] inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-[#C25B7C] hover:bg-[#A84867] text-white text-xs font-medium cursor-pointer whitespace-nowrap">
                  <Upload className="w-4 h-4" />
                  <span>{uploadingPreview ? 'Membaca & Memvalidasi...' : 'Pilih File (.xlsx / .xls / .csv)'}</span>
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleFileChange}
                    disabled={uploadingPreview || executing}
                    className="sr-only"
                  />
                </label>
              </div>
            )}

            <div className="rounded-xl bg-[#FDE8EE]/55 border border-[#F0C6D2]/70 p-3.5 text-xs text-[#7D4E5D] leading-relaxed">
              Catatan: Validasi URL memeriksa protokol HTTPS/HTTP dan domain Shopee yang diizinkan pada Website Settings, namun tidak memverifikasi status komisi aktif di program Shopee Affiliate.
            </div>
          </section>
        )}

        {/* Preview & Validation Result */}
        {preview && !result && (
          <section className="space-y-5">
            {/* Duplicate Mode & Pre-Import Summary */}
            <div className="rounded-2xl bg-[#FFFFFF] border border-[#F0C6D2] p-4 sm:p-6 space-y-5">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="min-w-0">
                  <h2 className="font-serif-display text-lg font-semibold text-[#3F232C] truncate">
                    2. Preview Validasi: {preview.filename}
                  </h2>
                  <p className="text-xs text-[#7D4E5D] mt-0.5 tabular-nums">
                    Total {preview.totalRows} baris (Batas maksimal: {preview.maxRows} baris)
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-medium text-[#3F232C] mr-1">Mode Duplikasi:</span>
                  {[
                    { id: 'skip', label: 'Skip Duplicate' },
                    { id: 'update', label: 'Update Existing' },
                    { id: 'new_only', label: 'Import New Only' },
                  ].map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setDuplicateMode(m.id as 'skip' | 'update' | 'new_only')}
                      className={`min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                        duplicateMode === m.id
                          ? 'bg-[#C25B7C] text-white border-[#C25B7C]'
                          : 'bg-[#FFF6F8] text-[#7D4E5D] border-[#F0C6D2]'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Validation & Plan Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3.5">
                  <div className="text-[11px] font-medium text-emerald-900">Akan Ditambahkan</div>
                  <div className="mt-1 text-2xl font-semibold text-emerald-900 tabular-nums">
                    {summary.toAdd}
                  </div>
                </div>
                <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-3.5">
                  <div className="text-[11px] font-medium text-blue-900">Akan Diperbarui</div>
                  <div className="mt-1 text-2xl font-semibold text-blue-900 tabular-nums">
                    {summary.toUpdate}
                  </div>
                </div>
                <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3.5">
                  <div className="text-[11px] font-medium text-amber-900">Akan Dilewati</div>
                  <div className="mt-1 text-2xl font-semibold text-amber-900 tabular-nums">
                    {summary.toSkip}
                  </div>
                </div>
                <div className="rounded-xl border border-red-200 bg-red-50/70 p-3.5">
                  <div className="text-[11px] font-medium text-red-900">Ditolak (Error)</div>
                  <div className="mt-1 text-2xl font-semibold text-red-900 tabular-nums">
                    {summary.toReject}
                  </div>
                </div>
              </div>

              {executing && (
                <div className="space-y-2">
                  <div className="flex justify-between text-xs text-[#7D4E5D]">
                    <span>Memproses batch transaksi ke PostgreSQL...</span>
                    <span className="tabular-nums">{progress}%</span>
                  </div>
                  <div className="h-2.5 rounded-full bg-[#FFF6F8] overflow-hidden border border-[#F0C6D2]">
                    <div
                      style={{ width: `${progress}%` }}
                      className="h-full bg-[#C25B7C] transition-all duration-200"
                    />
                  </div>
                </div>
              )}

              <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2.5 sm:gap-3">
                <button
                  type="button"
                  onClick={() => setPreview(null)}
                  className="min-h-[44px] px-4 py-2.5 rounded-xl border border-[#F0C6D2] text-xs font-medium text-[#3F232C]"
                >
                  Reset / Ganti Sumber
                </button>
                <button
                  type="button"
                  disabled={executing || summary.toAdd + summary.toUpdate === 0}
                  onClick={() => handleRunImport()}
                  className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#C25B7C] hover:bg-[#A84867] disabled:opacity-50 text-white text-xs font-medium"
                >
                  {executing ? 'Mengimpor...' : 'Jalankan Import Sekarang'}
                </button>
              </div>
            </div>

            {/* Mobile Preview Cards (< 768px) */}
            <div className="md:hidden space-y-2.5 max-h-[540px] overflow-y-auto pr-0.5">
              {preview.rows.map((r) => (
                <div key={r.rowNumber} className="rounded-2xl bg-[#FFFFFF] border border-[#F0C6D2] p-3.5 space-y-2 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono-tabular text-[11px] text-[#7D4E5D]">Baris #{r.rowNumber}</span>
                    {r.validationStatus === 'valid' && (
                      <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Valid
                      </span>
                    )}
                    {r.validationStatus === 'warning' && (
                      <span className="inline-flex items-center gap-1 text-amber-700 font-medium">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        Warning
                      </span>
                    )}
                    {r.validationStatus === 'error' && (
                      <span className="inline-flex items-center gap-1 text-red-700 font-medium">
                        <AlertCircle className="w-3.5 h-3.5" />
                        Error
                      </span>
                    )}
                  </div>
                  <div className="font-semibold text-[#3F232C] flex items-center gap-1.5">
                    <span className="px-1.5 py-0.5 rounded bg-[#FFF6F8] border border-[#F0C6D2] font-mono-tabular text-[10px] text-[#C25B7C]">
                      {r.productNumber ? `#${r.productNumber}` : 'Auto'}
                    </span>
                    <span className="truncate">
                      {r.productName || <span className="text-red-700 italic">(Kosong)</span>}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-[#7D4E5D]">
                    <span className="font-mono-tabular text-[#C25B7C]">{r.productSlug || '—'}</span>
                    {r.categoryName && <span>• {r.categoryName}</span>}
                    {r.price !== null && <span className="tabular-nums font-medium text-[#3F232C]">• {formatIdr(r.price)}</span>}
                  </div>
                  {(r.errors.length > 0 || r.warnings.length > 0) && (
                    <div className="pt-1 border-t border-[#F0C6D2]/60 space-y-0.5 text-[11px]">
                      {r.errors.map((e, i) => (
                        <div key={i} className="text-red-700">• {e}</div>
                      ))}
                      {r.warnings.map((w, i) => (
                        <div key={i} className="text-amber-700">• {w}</div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Desktop Preview Table (>= 768px) */}
            <div className="hidden md:block rounded-2xl bg-[#FFFFFF] border border-[#F0C6D2] overflow-hidden">
              <div className="overflow-x-auto max-h-[480px]">
                <table className="w-full text-xs">
                  <thead className="bg-[#FFF6F8] border-b border-[#F0C6D2] text-[#7D4E5D] sticky top-0">
                    <tr>
                      <th className="p-3 text-left">Baris</th>
                      <th className="p-3 text-left">No. Produk</th>
                      <th className="p-3 text-left">Validasi</th>
                      <th className="p-3 text-left">Nama Produk</th>
                      <th className="p-3 text-left">Slug</th>
                      <th className="p-3 text-left">Kategori</th>
                      <th className="p-3 text-right">Harga</th>
                      <th className="p-3 text-left">Keterangan Validasi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F0C6D2]/60">
                    {preview.rows.map((r) => (
                      <tr key={r.rowNumber} className="hover:bg-[#FFF6F8]/70">
                        <td className="p-3 font-mono-tabular">{r.rowNumber}</td>
                        <td className="p-3 font-mono-tabular text-[#C25B7C] font-semibold">
                          {r.productNumber ? `#${r.productNumber}` : 'Auto'}
                        </td>
                        <td className="p-3 whitespace-nowrap">
                          {r.validationStatus === 'valid' && (
                            <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Valid
                            </span>
                          )}
                          {r.validationStatus === 'warning' && (
                            <span className="inline-flex items-center gap-1 text-amber-700 font-medium">
                              <AlertTriangle className="w-3.5 h-3.5" />
                              Warning
                            </span>
                          )}
                          {r.validationStatus === 'error' && (
                            <span className="inline-flex items-center gap-1 text-red-700 font-medium">
                              <AlertCircle className="w-3.5 h-3.5" />
                              Error
                            </span>
                          )}
                        </td>
                        <td className="p-3 font-medium text-[#3F232C]">
                          {r.productName || <span className="text-red-700 italic">(Kosong)</span>}
                        </td>
                        <td className="p-3 font-mono-tabular text-[#7D4E5D]">{r.productSlug || '—'}</td>
                        <td className="p-3">{r.categoryName || '—'}</td>
                        <td className="p-3 text-right tabular-nums">
                          {r.price !== null ? formatIdr(r.price) : '—'}
                        </td>
                        <td className="p-3 max-w-xs">
                          {r.errors.length > 0 && (
                            <div className="text-red-700 space-y-0.5">
                              {r.errors.map((e, i) => (
                                <div key={i}>• {e}</div>
                              ))}
                            </div>
                          )}
                          {r.warnings.length > 0 && (
                            <div className="text-amber-700 space-y-0.5">
                              {r.warnings.map((w, i) => (
                                <div key={i}>• {w}</div>
                              ))}
                            </div>
                          )}
                          {r.errors.length === 0 && r.warnings.length === 0 && (
                            <span className="text-emerald-700">Siap diimpor</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}

        {/* Result Summary View */}
        {result && (
          <section className="rounded-2xl bg-[#FFFFFF] border border-[#F0C6D2] p-6 space-y-6">
            <div className="flex items-start gap-3">
              <FileSpreadsheet className="w-7 h-7 text-[#C25B7C] shrink-0" />
              <div>
                <h2 className="font-serif-display text-xl font-semibold text-[#3F232C]">
                  Hasil Import: {result.job.filename}
                </h2>
                <p className="text-xs text-[#7D4E5D] mt-1">
                  Status: <span className="font-semibold uppercase">{result.job.importStatus}</span> · Job #{result.job.id}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 tabular-nums">
              <div className="rounded-xl bg-[#FFF6F8] border border-[#F0C6D2] p-3.5">
                <div className="text-[11px] text-[#7D4E5D]">Total Baris</div>
                <div className="text-xl font-semibold text-[#3F232C] mt-1">{result.job.totalRows}</div>
              </div>
              <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3.5">
                <div className="text-[11px] text-emerald-900">Berhasil</div>
                <div className="text-xl font-semibold text-emerald-900 mt-1">{result.job.successRows}</div>
              </div>
              <div className="rounded-xl bg-blue-50 border border-blue-200 p-3.5">
                <div className="text-[11px] text-blue-900">Diperbarui</div>
                <div className="text-xl font-semibold text-blue-900 mt-1">{result.job.updatedRows}</div>
              </div>
              <div className="rounded-xl bg-amber-50 border border-amber-200 p-3.5">
                <div className="text-[11px] text-amber-900">Dilewati</div>
                <div className="text-xl font-semibold text-amber-900 mt-1">{result.job.skippedRows}</div>
              </div>
              <div className="rounded-xl bg-red-50 border border-red-200 p-3.5">
                <div className="text-[11px] text-red-900">Gagal</div>
                <div className="text-xl font-semibold text-red-900 mt-1">{result.job.failedRows}</div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Link
                to="/admin/products"
                className="px-4 py-2.5 rounded-xl bg-[#C25B7C] text-white text-xs font-medium"
              >
                Lihat Produk Berhasil
              </Link>

              {result.job.failedRows > 0 && (
                <>
                  <button
                    type="button"
                    onClick={() => handleDownloadErrorCsv(result.job.id)}
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-red-200 bg-red-50 text-red-900 text-xs font-medium"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download Error Report (.csv)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const failedRows = result.errors.map((e) => e.rowData).filter(Boolean);
                      if (failedRows.length > 0) {
                        setPreview({
                          filename: result.job.filename,
                          totalRows: failedRows.length,
                          maxRows: 500,
                          validCount: 0,
                          warningCount: 0,
                          errorCount: failedRows.length,
                          duplicateInDbCount: 0,
                          rows: failedRows,
                        });
                        setResult(null);
                      }
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-[#F0C6D2] text-[#3F232C] text-xs font-medium"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Tinjau Baris Gagal</span>
                  </button>
                </>
              )}

              <button
                type="button"
                onClick={() => {
                  setPreview(null);
                  setResult(null);
                }}
                className="px-4 py-2.5 rounded-xl border border-[#F0C6D2] text-[#3F232C] text-xs font-medium"
              >
                Import Baru
              </button>

              <Link
                to="/admin/import-history"
                className="px-4 py-2.5 rounded-xl text-[#C25B7C] underline underline-offset-4 text-xs font-medium"
              >
                Riwayat Import
              </Link>
            </div>
          </section>
        )}
      </div>
    </AdminLayout>
  );
}
