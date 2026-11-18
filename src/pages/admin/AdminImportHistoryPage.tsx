import React, { useEffect, useState } from 'react';
import { Download, History } from 'lucide-react';
import { useAuth } from '../../lib/authContext';
import { formatJakartaDateTime } from '../../lib/types';
import { AdminLayout } from './AdminLayout';

interface ImportJob {
  id: number;
  filename: string;
  adminEmail: string;
  totalRows: number;
  successRows: number;
  updatedRows: number;
  skippedRows: number;
  failedRows: number;
  importStatus: string;
  duplicateMode: string;
  createdAt: string;
}

export function AdminImportHistoryPage() {
  const { authFetch } = useAuth();
  const [items, setItems] = useState<ImportJob[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    authFetch('/api/admin/import/history')
      .then((r) => r.json())
      .then((d) => {
        setItems(d.items || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [authFetch]);

  const downloadFile = async (urlPath: string, filename: string) => {
    const res = await authFetch(urlPath);
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AdminLayout
      title="Import History"
      subtitle="Riwayat import massal spreadsheet & Google Sheet beserta laporan error yang dapat diunduh ulang"
      actions={
        <button
          type="button"
          onClick={() => downloadFile('/api/admin/export/import_history', 'by-adisss-import-history.csv')}
          className="min-h-[40px] inline-flex items-center gap-1.5 px-3 sm:px-3.5 py-2 rounded-xl border border-[#F0C6D2] bg-[#FFFFFF] text-xs font-medium text-[#3F232C] whitespace-nowrap"
        >
          <Download className="w-3.5 h-3.5 text-[#C25B7C]" />
          <span className="hidden sm:inline">Export History CSV</span>
          <span className="sm:hidden">Export CSV</span>
        </button>
      }
    >
      {/* Mobile & Tablet Card View (< 1024px) */}
      <div className="lg:hidden space-y-3">
        {loading && (
          <div className="rounded-2xl bg-[#FFFFFF] border border-[#F0C6D2] p-8 text-center text-xs text-[#7D4E5D]">
            Memuat riwayat import...
          </div>
        )}

        {!loading && items.length === 0 && (
          <div className="rounded-2xl bg-[#FFFFFF] border border-[#F0C6D2] p-8 text-center text-xs text-[#7D4E5D]">
            <History className="w-7 h-7 mx-auto mb-2 opacity-50 text-[#C25B7C]" />
            Belum ada riwayat import produk.
          </div>
        )}

        {!loading &&
          items.map((job) => (
            <article
              key={job.id}
              className="rounded-2xl bg-[#FFFFFF] border border-[#F0C6D2] p-4 space-y-3 text-xs"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-semibold text-[#3F232C] truncate">{job.filename}</div>
                  <div className="text-[11px] text-[#7D4E5D] truncate">{job.adminEmail}</div>
                </div>
                <span className="px-2 py-0.5 rounded-md bg-[#FFF6F8] border border-[#F0C6D2] text-[10px] font-semibold uppercase text-[#C25B7C] shrink-0">
                  {job.importStatus}
                </span>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#7D4E5D] tabular-nums">
                <span>{formatJakartaDateTime(job.createdAt)}</span>
                <span>Mode: {job.duplicateMode}</span>
              </div>

              <div className="grid grid-cols-5 gap-1.5 rounded-xl bg-[#FFF6F8] border border-[#F0C6D2]/60 p-2 text-center text-[11px] tabular-nums">
                <div>
                  <div className="text-[#7D4E5D]">Total</div>
                  <div className="font-semibold text-[#3F232C]">{job.totalRows}</div>
                </div>
                <div>
                  <div className="text-emerald-800">Ok</div>
                  <div className="font-semibold text-emerald-700">{job.successRows}</div>
                </div>
                <div>
                  <div className="text-blue-800">Upd</div>
                  <div className="font-semibold text-blue-700">{job.updatedRows}</div>
                </div>
                <div>
                  <div className="text-amber-800">Skip</div>
                  <div className="font-semibold text-amber-700">{job.skippedRows}</div>
                </div>
                <div>
                  <div className="text-red-800">Fail</div>
                  <div className="font-semibold text-red-700">{job.failedRows}</div>
                </div>
              </div>

              {job.failedRows > 0 && (
                <button
                  type="button"
                  onClick={() =>
                    downloadFile(
                      `/api/admin/import/history/${job.id}/errors.csv`,
                      `import-errors-job-${job.id}.csv`
                    )
                  }
                  className="w-full min-h-[38px] inline-flex items-center justify-center gap-1.5 rounded-xl border border-red-200 bg-red-50/70 text-red-700 font-medium"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Unduh Error Report (.csv)</span>
                </button>
              )}
            </article>
          ))}
      </div>

      {/* Desktop Table (>= 1024px) */}
      <div className="hidden lg:block rounded-2xl bg-[#FFFFFF] border border-[#F0C6D2] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-[#FFF6F8] border-b border-[#F0C6D2] text-[#7D4E5D]">
              <tr>
                <th className="p-3 text-left">File / Sumber</th>
                <th className="p-3 text-left">Admin</th>
                <th className="p-3 text-left">Tanggal</th>
                <th className="p-3 text-left">Mode</th>
                <th className="p-3 text-right">Total</th>
                <th className="p-3 text-right">Berhasil</th>
                <th className="p-3 text-right">Updated</th>
                <th className="p-3 text-right">Skipped</th>
                <th className="p-3 text-right">Failed</th>
                <th className="p-3 text-left">Status</th>
                <th className="p-3 text-right">Error Report</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F0C6D2]/60 tabular-nums">
              {loading && (
                <tr>
                  <td colSpan={11} className="p-8 text-center text-[#7D4E5D]">
                    Memuat riwayat import...
                  </td>
                </tr>
              )}

              {!loading && items.length === 0 && (
                <tr>
                  <td colSpan={11} className="p-10 text-center text-[#7D4E5D]">
                    <History className="w-7 h-7 mx-auto mb-2 opacity-50 text-[#C25B7C]" />
                    Belum ada riwayat import produk.
                  </td>
                </tr>
              )}

              {!loading &&
                items.map((job) => (
                  <tr key={job.id} className="hover:bg-[#FFF6F8]/70">
                    <td className="p-3 font-medium text-[#3F232C]">{job.filename}</td>
                    <td className="p-3 text-[#7D4E5D]">{job.adminEmail}</td>
                    <td className="p-3 whitespace-nowrap text-[#7D4E5D]">
                      {formatJakartaDateTime(job.createdAt)}
                    </td>
                    <td className="p-3">{job.duplicateMode}</td>
                    <td className="p-3 text-right">{job.totalRows}</td>
                    <td className="p-3 text-right text-emerald-700 font-medium">{job.successRows}</td>
                    <td className="p-3 text-right text-blue-700">{job.updatedRows}</td>
                    <td className="p-3 text-right text-amber-700">{job.skippedRows}</td>
                    <td className="p-3 text-right text-red-700 font-medium">{job.failedRows}</td>
                    <td className="p-3 uppercase font-medium text-[#3F232C]">{job.importStatus}</td>
                    <td className="p-3 text-right">
                      {job.failedRows > 0 ? (
                        <button
                          type="button"
                          onClick={() =>
                            downloadFile(
                              `/api/admin/import/history/${job.id}/errors.csv`,
                              `import-errors-job-${job.id}.csv`
                            )
                          }
                          className="inline-flex items-center gap-1 text-red-700 hover:underline font-medium"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Unduh CSV</span>
                        </button>
                      ) : (
                        <span className="text-[#7D4E5D]/60">—</span>
                      )}
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
