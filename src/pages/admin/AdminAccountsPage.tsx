import React, { useCallback, useEffect, useState } from 'react';
import { deleteDoc, doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { Plus, RefreshCw, Shield, Trash2 } from 'lucide-react';
import { emailToInviteId, useAuth } from '../../lib/authContext';
import { firestoreDb } from '../../lib/firebase';
import { formatJakartaDateTime } from '../../lib/types';
import { useUiFeedback } from '../../components/Toast';
import { AdminLayout } from './AdminLayout';

interface AdminAccountRow {
  id: number;
  uid: string | null;
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

const VALID_ROLES = new Set(['super_admin', 'admin', 'editor']);

export function AdminAccountsPage() {
  const { admin, firebaseUser, authFetch } = useAuth();
  const { notifySuccess, notifyError, confirmAction } = useUiFeedback();

  const [accounts, setAccounts] = useState<AdminAccountRow[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogRow[]>([]);
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [role, setRole] = useState('admin');
  const [submitting, setSubmitting] = useState(false);
  const [syncingFirestore, setSyncingFirestore] = useState(false);

  const syncAccountToFirestore = useCallback(
    async (acc: { email: string; displayName?: string; role: string; uid?: string | null; isActive?: boolean }) => {
      if (!firebaseUser?.uid) return;
      const normalizedEmail = acc.email.trim().toLowerCase();
      const inviteId = emailToInviteId(normalizedEmail);
      const safeRole = VALID_ROLES.has(acc.role) ? acc.role : 'admin';
      const safeName = (acc.displayName || normalizedEmail.split('@')[0] || 'Admin').slice(0, 120);
      if (!inviteId) return;

      const inviteRef = doc(firestoreDb, 'admin_invites', inviteId);
      const existingInvite = await getDoc(inviteRef);

      if (existingInvite.exists()) {
        await updateDoc(inviteRef, {
          email: normalizedEmail,
          displayName: safeName,
          role: safeRole,
          isAdmin: true,
          isActive: acc.isActive !== false,
          updatedAt: serverTimestamp(),
        });
      } else {
        await setDoc(inviteRef, {
          email: normalizedEmail,
          displayName: safeName,
          role: safeRole,
          isAdmin: true,
          isActive: acc.isActive !== false,
          createdByUid: firebaseUser.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      // If this admin already has a linked Firebase UID, immediately upgrade their /users/{uid} and /admins/{uid} docs too
      if (acc.uid && /^[a-zA-Z0-9_-]+$/.test(acc.uid)) {
        const userRef = doc(firestoreDb, 'users', acc.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          await updateDoc(userRef, {
            email: normalizedEmail,
            displayName: safeName,
            role: safeRole,
            isAdmin: true,
            isActive: acc.isActive !== false,
            updatedAt: serverTimestamp(),
          });
        } else {
          await setDoc(userRef, {
            uid: acc.uid,
            email: normalizedEmail,
            displayName: safeName,
            role: safeRole,
            isAdmin: true,
            isActive: acc.isActive !== false,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }

        const adminRef = doc(firestoreDb, 'admins', acc.uid);
        const adminSnap = await getDoc(adminRef);
        if (adminSnap.exists()) {
          await updateDoc(adminRef, {
            email: normalizedEmail,
            role: safeRole,
            isAdmin: true,
            isActive: acc.isActive !== false,
            updatedAt: serverTimestamp(),
          });
        } else {
          await setDoc(adminRef, {
            uid: acc.uid,
            email: normalizedEmail,
            role: safeRole,
            isAdmin: true,
            isActive: acc.isActive !== false,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
      }
    },
    [firebaseUser?.uid]
  );

  const load = useCallback(async () => {
    const res = await authFetch('/api/admin/accounts');
    if (res.ok) {
      const d = await res.json();
      const loadedAccounts: AdminAccountRow[] = d.accounts || [];
      setAccounts(loadedAccounts);
      setAuditLogs(d.auditLogs || []);
      return loadedAccounts;
    }
    return [] as AdminAccountRow[];
  }, [authFetch]);

  useEffect(() => {
    load().then((loaded) => {
      if (admin?.role === 'super_admin' && loaded.length > 0 && firebaseUser?.uid) {
        // Silently ensure all active backend admins have matching Firestore /admin_invites
        Promise.allSettled(loaded.filter((a) => a.isActive).map((a) => syncAccountToFirestore(a))).catch(() => {});
      }
    });
  }, [load, admin?.role, firebaseUser?.uid, syncAccountToFirestore]);

  const handleSyncAll = async () => {
    if (!accounts.length) return;
    setSyncingFirestore(true);
    try {
      await Promise.all(accounts.map((acc) => syncAccountToFirestore(acc)));
      notifySuccess(`${accounts.length} akun admin berhasil disinkronkan ke Firestore.`);
    } catch (err: any) {
      notifyError(err?.message || 'Gagal menyinkronkan beberapa akun ke Firestore.');
    } finally {
      setSyncingFirestore(false);
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const normalizedEmail = email.trim().toLowerCase();
      const res = await authFetch('/api/admin/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalizedEmail, displayName, role }),
      });
      const json = await res.json();
      if (!res.ok) {
        notifyError(json.error || 'Gagal menambahkan admin');
        return;
      }

      let firestoreSynced = false;
      try {
        await syncAccountToFirestore(
          json.account || { email: normalizedEmail, displayName, role, isActive: true }
        );
        firestoreSynced = true;
      } catch (fsErr) {
        console.warn('Firestore admin invite sync warning:', fsErr);
      }

      notifySuccess(
        firestoreSynced
          ? `Admin ${normalizedEmail} berhasil diotorisasi di backend & Firestore.`
          : `Admin ${normalizedEmail} diotorisasi di backend. Klik "Sinkronkan Firestore" jika perlu.`
      );
      setEmail('');
      setDisplayName('');
      await load();
    } finally {
      setSubmitting(false);
    }
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

    try {
      const inviteId = emailToInviteId(acc.email);
      if (inviteId) {
        await deleteDoc(doc(firestoreDb, 'admin_invites', inviteId)).catch(() => {});
      }
      if (acc.uid && acc.uid !== firebaseUser?.uid && /^[a-zA-Z0-9_-]+$/.test(acc.uid)) {
        const userRef = doc(firestoreDb, 'users', acc.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          await updateDoc(userRef, {
            role: 'user',
            isAdmin: false,
            updatedAt: serverTimestamp(),
          }).catch(() => {});
        }
        await deleteDoc(doc(firestoreDb, 'admins', acc.uid)).catch(() => {});
      }
    } catch {
      // ignore non-fatal cleanup errors
    }

    notifySuccess('Akses admin dicabut dari backend & Firestore.');
    load();
  };

  return (
    <AdminLayout
      title="Admin Account & RBAC"
      subtitle="Kelola otorisasi akun admin (Backend + Firestore) dan log aktivitas keamanan"
      actions={
        admin?.role === 'super_admin' ? (
          <button
            type="button"
            disabled={syncingFirestore}
            onClick={handleSyncAll}
            className="min-h-[40px] inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#F0C6D2] bg-[#FFFFFF] hover:bg-[#FFF6F8] text-xs font-medium text-[#3F232C] whitespace-nowrap"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#C25B7C] ${syncingFirestore ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Sinkronkan Firestore</span>
            <span className="sm:hidden">Sinkron</span>
          </button>
        ) : undefined
      }
    >
      <div className="space-y-6">
        <div className="rounded-2xl bg-[#FFFFFF] border border-[#F0C6D2] p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-xl bg-[#FDE8EE] flex items-center justify-center text-[#C25B7C] shrink-0">
              <Shield className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-[#3F232C] truncate">{admin?.displayName}</div>
              <div className="text-xs text-[#7D4E5D] truncate">{admin?.email}</div>
            </div>
          </div>
          <span className="px-3 py-1.5 rounded-lg bg-[#FFF6F8] border border-[#F0C6D2] text-xs font-medium text-[#C25B7C]">
            Role: {admin?.role}
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {admin?.role === 'super_admin' && (
            <form
              onSubmit={handleAdd}
              className="rounded-2xl bg-[#FFFFFF] border border-[#F0C6D2] p-4 sm:p-5 space-y-4 self-start"
            >
              <h2 className="font-serif-display text-lg font-semibold text-[#3F232C]">
                Otorisasi Admin Baru
              </h2>
              <div>
                <label className="block text-xs font-medium text-[#3F232C] mb-1">Email Admin *</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="partner@gmail.com"
                  className="w-full min-h-[44px] px-3.5 rounded-xl border border-[#F0C6D2] bg-[#FFF6F8] text-sm focus:outline-none focus:border-[#C25B7C]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#3F232C] mb-1">Nama Tampilan</label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Tim Konten"
                  className="w-full min-h-[44px] px-3.5 rounded-xl border border-[#F0C6D2] bg-[#FFF6F8] text-sm focus:outline-none focus:border-[#C25B7C]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#3F232C] mb-1">Role</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full min-h-[44px] px-3 rounded-xl border border-[#F0C6D2] bg-[#FFF6F8] text-xs"
                >
                  <option value="admin">admin</option>
                  <option value="editor">editor</option>
                  <option value="super_admin">super_admin</option>
                </select>
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl bg-[#C25B7C] hover:bg-[#A84867] disabled:opacity-60 text-white text-xs font-medium"
              >
                <Plus className="w-4 h-4" />
                <span>{submitting ? 'Menambahkan...' : 'Tambah Admin'}</span>
              </button>
              <p className="text-[11px] text-[#7D4E5D] leading-relaxed">
                Menambahkan admin otomatis menyimpan izin di server backend sekaligus menyinkronkan flag admin Firestore agar akun bisa langsung masuk.
              </p>
            </form>
          )}

          <div
            className={`${
              admin?.role === 'super_admin' ? 'lg:col-span-2' : 'lg:col-span-3'
            } space-y-6 min-w-0`}
          >
            {/* Daftar Admin Terotorisasi */}
            <div className="rounded-2xl bg-[#FFFFFF] border border-[#F0C6D2] overflow-hidden">
              <div className="px-4 sm:px-5 py-3.5 border-b border-[#F0C6D2]/70 font-serif-display text-base font-semibold text-[#3F232C]">
                Daftar Admin Terotorisasi
              </div>

              {/* Mobile Card View */}
              <div className="md:hidden divide-y divide-[#F0C6D2]/60">
                {accounts.map((acc) => (
                  <div key={acc.id} className="p-4 flex items-center justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <div className="text-xs font-semibold text-[#3F232C] truncate">{acc.email}</div>
                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-[#7D4E5D]">
                        <span>{acc.displayName}</span>
                        <span className="px-2 py-0.5 rounded bg-[#FFF6F8] border border-[#F0C6D2] text-[#C25B7C] font-medium">
                          {acc.role}
                        </span>
                      </div>
                    </div>
                    {admin?.role === 'super_admin' && acc.id !== admin.id && (
                      <button
                        type="button"
                        onClick={() => handleRemove(acc)}
                        aria-label={`Hapus akses ${acc.email}`}
                        className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-red-700 hover:bg-red-50 shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Tablet/PC Table View */}
              <div className="hidden md:block overflow-x-auto">
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
            </div>

            {/* Log Aktivitas Admin Terbaru */}
            <div className="rounded-2xl bg-[#FFFFFF] border border-[#F0C6D2] overflow-hidden">
              <div className="px-4 sm:px-5 py-3.5 border-b border-[#F0C6D2]/70 font-serif-display text-base font-semibold text-[#3F232C]">
                Log Aktivitas Admin Terbaru
              </div>

              {/* Mobile Card View */}
              <div className="md:hidden divide-y divide-[#F0C6D2]/60">
                {auditLogs.length === 0 ? (
                  <div className="p-6 text-center text-xs text-[#7D4E5D]">
                    Belum ada log aktivitas.
                  </div>
                ) : (
                  auditLogs.map((log) => (
                    <div key={log.id} className="p-4 space-y-1 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono-tabular font-semibold text-[#C25B7C] truncate">
                          {log.action}
                        </span>
                        <span className="text-[11px] text-[#7D4E5D] shrink-0">
                          {log.entityType} {log.entityId ? `#${log.entityId}` : ''}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2 text-[11px] text-[#7D4E5D]">
                        <span className="truncate">{log.adminEmail}</span>
                        <span className="tabular-nums shrink-0">{formatJakartaDateTime(log.createdAt)}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Tablet/PC Table View */}
              <div className="hidden md:block overflow-x-auto">
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
                          <td className="p-3 tabular-nums text-[#7D4E5D] whitespace-nowrap">
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
      </div>
    </AdminLayout>
  );
}
