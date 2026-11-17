import React, { useCallback, useEffect, useState } from 'react';
import { Plus, Shield, Trash2 } from 'lucide-react';
import { useAuth } from '../../lib/authContext';
import { formatJakartaDateTime } from '../../lib/types';
import { useUiFeedback } from '../../components/Toast';
import { AdminLayout } from './AdminLayout';

interface AdminAccountRow {
  id: number;
  email: string;
  displayName: string;
  role: string;
  isActive: boolean;
  createdAt: string;
}

interface AuditLogRow {
  id: number;
  adminEmail: string;
  action: string;
  entityType: string;
  entityId: string;
  createdAt: string;
}

export function AdminAccountsPage() {
  const { admin, authFetch } = useAuth();
  const { notifySuccess, notifyError, confirmAction } = useUiFeedback();

  const [accounts, setAccounts] = useState<AdminAccountRow[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogRow[]>([]);
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [role, setRole] = useState('admin');

  const load = useCallback(async () => {
    const res = await authFetch('/api/admin/accounts');
    if (res.ok) {
      const d = await res.json();
      setAccounts(d.accounts || []);
      setAuditLogs(d.auditLogs || []);
    }
  }, [authFetch]);

  useEffect(() => {
    load();
  }, [load]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await authFetch('/api/admin/accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, displayName, role }),
    });
    const json = await res.json();
    if (!res.ok) {
      notifyError(json.error || 'Gagal menambahkan admin');
      return;
    }
    notifySuccess(`Admin ${email} berhasil diotorisasi.`);
    setEmail('');
    setDisplayName('');
    load();
  };

  const handleRemove = async (acc: AdminAccountRow) => {
    const ok = await confirmAction({
      title: 'Cabut Akses Admin?',
      message: `Hapus otorisasi admin untuk ${acc.email}?`,
      confirmLabel: 'Hapus Akses',
      destructive: true,
    });
    if (!ok) return;
    const res = await authFetch(`/api/admin/accounts/${acc.id}`, { method: 'DELETE' });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      notifyError(j.error || 'Gagal menghapus admin');
      return;
    }
    notifySuccess('Akses admin dicabut.');
    load();
  };

  return (
    <AdminLayout title="Admin Account & RBAC" subtitle="Kelola otorisasi akun admin dan log aktivitas keamanan">
      <div className="space-y-6">
        <div className="rounded-2xl bg-[#FFFFFF] border border-[#F0C6D2] p-5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-[#FDE8EE] flex items-center justify-center text-[#C25B7C]">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-semibold text-[#3F232C]">{admin?.displayName}</div>
              <div className="text-xs text-[#7D4E5D]">{admin?.email}</div>
            </div>
          </div>
          <span className="px-3 py-1 rounded-lg bg-[#FFF6F8] border border-[#F0C6D2] text-xs font-medium text-[#C25B7C]">
            Role: {admin?.role}
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {admin?.role === 'super_admin' && (
            <form
              onSubmit={handleAdd}
              className="rounded-2xl bg-[#FFFFFF] border border-[#F0C6D2] p-5 space-y-4 self-start"
            >
              <h2 className="font-serif-display text-lg font-semibold text-[#3F232C]">
                Otorisasi Admin Baru
              </h2>
              <div>
                <label className="block text-xs font-medium text-[#3F232C] mb-1">Email Google Admin *</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="partner@gmail.com"
                  className="w-full min-h-[40px] px-3 rounded-xl border border-[#F0C6D2] bg-[#FFF6F8] text-sm focus:outline-none focus:border-[#C25B7C]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#3F232C] mb-1">Nama Tampilan</label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Tim Konten"
                  className="w-full min-h-[40px] px-3 rounded-xl border border-[#F0C6D2] bg-[#FFF6F8] text-sm focus:outline-none focus:border-[#C25B7C]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#3F232C] mb-1">Role</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full min-h-[40px] px-3 rounded-xl border border-[#F0C6D2] bg-[#FFF6F8] text-xs"
                >
                  <option value="admin">admin</option>
                  <option value="editor">editor</option>
                  <option value="super_admin">super_admin</option>
                </select>
              </div>
              <button
                type="submit"
                className="w-full min-h-[42px] inline-flex items-center justify-center gap-2 rounded-xl bg-[#C25B7C] hover:bg-[#A84867] text-white text-xs font-medium"
              >
                <Plus className="w-4 h-4" />
                <span>Tambah Admin</span>
              </button>
            </form>
          )}

          <div
            className={`${
              admin?.role === 'super_admin' ? 'lg:col-span-2' : 'lg:col-span-3'
            } space-y-6`}
          >
            <div className="rounded-2xl bg-[#FFFFFF] border border-[#F0C6D2] overflow-hidden">
              <div className="px-5 py-3.5 border-b border-[#F0C6D2]/70 font-serif-display text-base font-semibold text-[#3F232C]">
                Daftar Admin Terotorisasi
              </div>
              <table className="w-full text-xs">
                <thead className="bg-[#FFF6F8] border-b border-[#F0C6D2] text-[#7D4E5D]">
                  <tr>
                    <th className="p-3 text-left">Email</th>
                    <th className="p-3 text-left">Nama</th>
                    <th className="p-3 text-left">Role</th>
                    <th className="p-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F0C6D2]/60">
                  {accounts.map((acc) => (
                    <tr key={acc.id}>
                      <td className="p-3 font-medium text-[#3F232C]">{acc.email}</td>
                      <td className="p-3 text-[#7D4E5D]">{acc.displayName}</td>
                      <td className="p-3">{acc.role}</td>
                      <td className="p-3 text-right">
                        {admin?.role === 'super_admin' && acc.id !== admin.id && (
                          <button
                            type="button"
                            onClick={() => handleRemove(acc)}
                            className="p-1.5 rounded-lg text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="rounded-2xl bg-[#FFFFFF] border border-[#F0C6D2] overflow-hidden">
              <div className="px-5 py-3.5 border-b border-[#F0C6D2]/70 font-serif-display text-base font-semibold text-[#3F232C]">
                Log Aktivitas Admin Terbaru
              </div>
              <table className="w-full text-xs">
                <thead className="bg-[#FFF6F8] border-b border-[#F0C6D2] text-[#7D4E5D]">
                  <tr>
                    <th className="p-3 text-left">Waktu</th>
                    <th className="p-3 text-left">Admin</th>
                    <th className="p-3 text-left">Aksi</th>
                    <th className="p-3 text-left">Entitas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F0C6D2]/60">
                  {auditLogs.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-6 text-center text-[#7D4E5D]">
                        Belum ada log aktivitas.
                      </td>
                    </tr>
                  ) : (
                    auditLogs.map((log) => (
                      <tr key={log.id}>
                        <td className="p-3 tabular-nums text-[#7D4E5D]">
                          {formatJakartaDateTime(log.createdAt)}
                        </td>
                        <td className="p-3">{log.adminEmail}</td>
                        <td className="p-3 font-mono-tabular font-medium text-[#C25B7C]">{log.action}</td>
                        <td className="p-3 text-[#7D4E5D]">
                          {log.entityType} {log.entityId ? `#${log.entityId}` : ''}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
