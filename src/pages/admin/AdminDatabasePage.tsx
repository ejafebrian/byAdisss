import React, { useCallback, useEffect, useState } from 'react';
import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  Flame,
  HardDrive,
  RefreshCw,
  Server,
  ShieldCheck,
  Sparkles,
  Table2,
} from 'lucide-react';
import firebaseConfig from '../../../firebase-applet-config.json';
import { emailToInviteId, useAuth } from '../../lib/authContext';
import { firestoreDb } from '../../lib/firebase';
import { invalidateClientCatalogCache } from '../../lib/publicCache';
import { formatJakartaDateTime } from '../../lib/types';
import { useUiFeedback } from '../../components/Toast';
import { AdminLayout } from './AdminLayout';

interface TableInspectionStatus {
  name: string;
  label: string;
  exists: boolean;
  rowCount: number;
  expectedColumns: number;
  actualColumns: number;
  missingColumns: string[];
  expectedIndexes: number;
  missingIndexes: string[];
  inSync: boolean;
}

interface DatabaseInspectionReport {
  configured: boolean;
  connected: boolean;
  databaseName: string | null;
  schemaName: string | null;
  runtimeUser: string | null;
  adminUser: string | null;
  hasAdminCredentials: boolean;
  canAutoMigrate: boolean;
  postgresVersion: string | null;
  checkedAt: string;
  error: string | null;
  summary: {
    totalTables: number;
    existingTables: number;
    missingTables: number;
    totalExpectedColumns: number;
    missingColumns: number;
    missingIndexes: number;
    unnumberedProducts: number;
    totalProducts: number;
    totalCategories: number;
    totalAdmins: number;
    schemaInSync: boolean;
  };
  tables: TableInspectionStatus[];
}

interface SchemaMigrationResult {
  tablesCreated: string[];
  columnsAdded: Array<{ table: string; column: string }>;
  indexesCreated: string[];
  skippedDueToPermission: string[];
  productNumbersBackfilled: number;
  usedAdminPool: boolean;
}

interface DatabaseSyncReport {
  ok: boolean;
  durationMs: number;
  syncedAt: string;
  migration: SchemaMigrationResult;
  sequencesSynced: string[];
  defaultsSeeded: boolean;
  inspection: DatabaseInspectionReport;
}

interface FirestoreStatus {
  checking: boolean;
  connected: boolean;
  userDocReady: boolean;
  adminDocReady: boolean;
  databaseId: string;
  error: string | null;
}

export function AdminDatabasePage() {
  const { admin, firebaseUser, authFetch } = useAuth();
  const { notifySuccess, notifyError } = useUiFeedback();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [status, setStatus] = useState<DatabaseInspectionReport | null>(null);

  const [syncingDb, setSyncingDb] = useState(false);
  const [syncingFirestore, setSyncingFirestore] = useState(false);
  const [lastSyncReport, setLastSyncReport] = useState<DatabaseSyncReport | null>(null);

  const [optCreateSchema, setOptCreateSchema] = useState(true);
  const [optBackfillNumbers, setOptBackfillNumbers] = useState(true);
  const [optSyncSequences, setOptSyncSequences] = useState(true);
  const [optSeedDefaults, setOptSeedDefaults] = useState(true);

  const [firestoreStatus, setFirestoreStatus] = useState<FirestoreStatus>({
    checking: true,
    connected: false,
    userDocReady: false,
    adminDocReady: false,
    databaseId: firebaseConfig.firestoreDatabaseId || '(default)',
    error: null,
  });

  const checkFirestoreStatus = useCallback(async () => {
    setFirestoreStatus((prev) => ({ ...prev, checking: true, error: null }));
    if (!firebaseUser?.uid) {
      setFirestoreStatus({
        checking: false,
        connected: false,
        userDocReady: false,
        adminDocReady: false,
        databaseId: firebaseConfig.firestoreDatabaseId || '(default)',
        error: 'Sesi Firebase Auth belum aktif.',
      });
      return;
    }

    try {
      const [userSnap, adminSnap] = await Promise.all([
        getDoc(doc(firestoreDb, 'users', firebaseUser.uid)),
        getDoc(doc(firestoreDb, 'admins', firebaseUser.uid)).catch(() => null),
      ]);
      setFirestoreStatus({
        checking: false,
        connected: true,
        userDocReady: userSnap.exists(),
        adminDocReady: Boolean(adminSnap?.exists()),
        databaseId: firebaseConfig.firestoreDatabaseId || '(default)',
        error: null,
      });
    } catch (err: any) {
      setFirestoreStatus({
        checking: false,
        connected: false,
        userDocReady: false,
        adminDocReady: false,
        databaseId: firebaseConfig.firestoreDatabaseId || '(default)',
        error: err?.message || 'Gagal membaca status Firestore.',
      });
    }
  }, [firebaseUser?.uid]);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await authFetch('/api/admin/database/status');
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error || `Gagal memuat status database (HTTP ${res.status})`);
      }
      setStatus(data as DatabaseInspectionReport);
    } catch (err: any) {
      setLoadError(err?.message || 'Gagal memeriksa status database');
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    void loadStatus();
    void checkFirestoreStatus();
  }, [loadStatus, checkFirestoreStatus]);

  const handleSyncDatabase = async () => {
    setSyncingDb(true);
    try {
      const res = await authFetch('/api/admin/database/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          createMissingSchema: optCreateSchema,
          backfillProductNumbers: optBackfillNumbers,
          syncSequences: optSyncSequences,
          seedDefaults: optSeedDefaults,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error || `Gagal menyinkronkan database (HTTP ${res.status})`);
      }

      const report = data.sync as DatabaseSyncReport;
      setLastSyncReport(report);
      if (data.status) {
        setStatus(data.status as DatabaseInspectionReport);
      } else {
        await loadStatus();
      }
      invalidateClientCatalogCache();

      const changesCount =
        report.migration.tablesCreated.length +
        report.migration.columnsAdded.length +
        report.migration.indexesCreated.length +
        report.migration.productNumbersBackfilled;

      notifySuccess(
        changesCount > 0
          ? `Sinkronisasi selesai (${report.durationMs} md): skema & ${changesCount} pembaruan diterapkan.`
          : `Database & seluruh ${report.inspection.summary.totalTables} tabel sudah tersinkron (${report.durationMs} md).`
      );
    } catch (err: any) {
      notifyError(err?.message || 'Gagal menyinkronkan database.');
    } finally {
      setSyncingDb(false);
    }
  };

  const handleSyncAdminsToFirestore = async () => {
    if (!firebaseUser?.uid) {
      notifyError('Login Firebase Auth dibutuhkan untuk sinkronisasi Firestore.');
      return;
    }
    setSyncingFirestore(true);
    try {
      const res = await authFetch('/api/admin/accounts');
      if (!res.ok) {
        throw new Error('Gagal membaca daftar akun admin dari PostgreSQL.');
      }
      const data = await res.json();
      const accounts: Array<{
        email: string;
        displayName?: string;
        role: string;
        uid?: string | null;
        isActive?: boolean;
      }> = data.accounts || [];

      let synced = 0;
      for (const acc of accounts) {
        const normalizedEmail = String(acc.email || '').trim().toLowerCase();
        const inviteId = emailToInviteId(normalizedEmail);
        if (!inviteId) continue;

        const safeRole = ['super_admin', 'admin', 'editor'].includes(acc.role) ? acc.role : 'admin';
        const safeName = (acc.displayName || normalizedEmail.split('@')[0] || 'Admin').slice(0, 120);

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

        if (acc.uid && /^[a-zA-Z0-9_-]+$/.test(acc.uid)) {
          const userRef = doc(firestoreDb, 'users', acc.uid);
          const userSnap = await getDoc(userRef);
          const userPayload = {
            uid: acc.uid,
            email: normalizedEmail,
            displayName: safeName,
            role: safeRole,
            isAdmin: true,
            isActive: acc.isActive !== false,
            updatedAt: serverTimestamp(),
          };
          if (userSnap.exists()) {
            await updateDoc(userRef, userPayload);
          } else {
            await setDoc(userRef, { ...userPayload, createdAt: serverTimestamp() });
          }

          const adminRef = doc(firestoreDb, 'admins', acc.uid);
          const adminSnap = await getDoc(adminRef);
          const adminPayload = {
            uid: acc.uid,
            email: normalizedEmail,
            role: safeRole,
            isAdmin: true,
            isActive: acc.isActive !== false,
            updatedAt: serverTimestamp(),
          };
          if (adminSnap.exists()) {
            await updateDoc(adminRef, adminPayload);
          } else {
            await setDoc(adminRef, { ...adminPayload, createdAt: serverTimestamp() });
          }
        }
        synced += 1;
      }

      await checkFirestoreStatus();
      notifySuccess(`${synced} akun admin berhasil disinkronkan antara PostgreSQL & Firestore.`);
    } catch (err: any) {
      notifyError(err?.message || 'Gagal menyinkronkan akun ke Firestore.');
    } finally {
      setSyncingFirestore(false);
    }
  };

  return (
    <AdminLayout
      title="Database Sync & Skema"
      subtitle="Integrasi langsung PostgreSQL & Firestore dengan sinkronisasi skema database otomatis"
      actions={
        <button
          type="button"
          onClick={() => {
            void loadStatus();
            void checkFirestoreStatus();
          }}
          disabled={loading}
          className="min-h-[40px] inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#F0C6D2] bg-[#FFFFFF] hover:bg-[#FFF6F8] text-xs font-medium text-[#3F232C] whitespace-nowrap"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-[#C25B7C] ${loading ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">Muat Ulang Status</span>
          <span className="sm:hidden">Refresh</span>
        </button>
      }
    >
      <div className="space-y-6">
        {loadError && (
          <div className="rounded-2xl bg-red-50 border border-red-200 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-2.5 text-xs text-red-800">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
              <div>
                <div className="font-semibold">Gagal memeriksa status database</div>
                <div className="text-red-700 mt-0.5">{loadError}</div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => void loadStatus()}
              className="min-h-[38px] px-3.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-medium shrink-0"
            >
              Coba Lagi
            </button>
          </div>
        )}

        {/* Top Integration Cards: PostgreSQL & Firestore */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* PostgreSQL Direct Connection Card */}
          <div className="rounded-2xl bg-[#FFFFFF] border border-[#F0C6D2] p-4 sm:p-5 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-[#FDE8EE] text-[#C25B7C] flex items-center justify-center shrink-0">
                  <Database className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h2 className="font-serif-display text-base font-semibold text-[#3F232C] truncate">
                    PostgreSQL (Cloud SQL)
                  </h2>
                  <p className="text-[11px] text-[#7D4E5D] truncate">
                    {status?.databaseName ? `DB: ${status.databaseName} (${status.schemaName || 'public'})` : 'Memeriksa koneksi...'}
                  </p>
                </div>
              </div>
              <span
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold shrink-0 ${
                  status?.connected
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-amber-50 text-amber-700 border border-amber-200'
                }`}
              >
                {loading ? 'Memeriksa...' : status?.connected ? 'Terhubung' : 'Terputus'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2.5 text-xs">
              <div className="rounded-xl bg-[#FFF6F8] border border-[#F0C6D2]/70 p-2.5">
                <div className="text-[10px] text-[#7D4E5D]">Runtime User</div>
                <div className="font-mono-tabular font-medium text-[#3F232C] truncate mt-0.5">
                  {status?.runtimeUser || '-'}
                </div>
              </div>
              <div className="rounded-xl bg-[#FFF6F8] border border-[#F0C6D2]/70 p-2.5">
                <div className="text-[10px] text-[#7D4E5D]">Auto-Schema DDL</div>
                <div className="font-medium text-[#3F232C] truncate mt-0.5">
                  {status?.canAutoMigrate
                    ? `Aktif (${status.adminUser || 'owner'})`
                    : 'Mode Runtime'}
                </div>
              </div>
            </div>

            {status?.postgresVersion && (
              <div className="flex items-center justify-between text-[11px] text-[#7D4E5D] pt-1 border-t border-[#F0C6D2]/50">
                <span className="truncate">{status.postgresVersion}</span>
                <span className="shrink-0 tabular-nums">
                  {formatJakartaDateTime(status.checkedAt)}
                </span>
              </div>
            )}
          </div>

          {/* Firebase & Firestore Integration Card */}
          <div className="rounded-2xl bg-[#FFFFFF] border border-[#F0C6D2] p-4 sm:p-5 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-[#FDE8EE] text-[#C25B7C] flex items-center justify-center shrink-0">
                  <Flame className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h2 className="font-serif-display text-base font-semibold text-[#3F232C] truncate">
                    Firebase Firestore & Auth
                  </h2>
                  <p className="text-[11px] text-[#7D4E5D] truncate">
                    DB ID: {firestoreStatus.databaseId}
                  </p>
                </div>
              </div>
              <span
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold shrink-0 ${
                  firestoreStatus.connected
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-amber-50 text-amber-700 border border-amber-200'
                }`}
              >
                {firestoreStatus.checking
                  ? 'Memeriksa...'
                  : firestoreStatus.connected
                  ? 'Terhubung'
                  : 'Offline'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2.5 text-xs">
              <div className="rounded-xl bg-[#FFF6F8] border border-[#F0C6D2]/70 p-2.5">
                <div className="text-[10px] text-[#7D4E5D]">Dokumen /users</div>
                <div className="font-medium text-[#3F232C] mt-0.5">
                  {firestoreStatus.userDocReady ? 'Tersinkron' : 'Belum ada'}
                </div>
              </div>
              <div className="rounded-xl bg-[#FFF6F8] border border-[#F0C6D2]/70 p-2.5">
                <div className="text-[10px] text-[#7D4E5D]">Dokumen /admins</div>
                <div className="font-medium text-[#3F232C] mt-0.5">
                  {firestoreStatus.adminDocReady ? 'Tersinkron' : 'Belum ada'}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 pt-1 border-t border-[#F0C6D2]/50">
              <span className="text-[11px] text-[#7D4E5D] truncate">
                {firestoreStatus.error || 'Sinkronisasi akun admin RBAC langsung ke Firestore'}
              </span>
              {admin?.role === 'super_admin' && (
                <button
                  type="button"
                  onClick={handleSyncAdminsToFirestore}
                  disabled={syncingFirestore}
                  className="min-h-[34px] inline-flex items-center gap-1.5 px-3 rounded-lg bg-[#FDE8EE] hover:bg-[#F9D6E0] text-[#3F232C] text-[11px] font-medium shrink-0"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-[#C25B7C]" />
                  <span>{syncingFirestore ? 'Menyinkronkan...' : 'Sinkron Admin'}</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Summary KPI Strip */}
        {status && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="rounded-2xl bg-[#FFFFFF] border border-[#F0C6D2] p-4">
              <div className="flex items-center gap-2 text-[11px] text-[#7D4E5D]">
                <Table2 className="w-3.5 h-3.5 text-[#C25B7C]" />
                <span>Tabel Database</span>
              </div>
              <div className="mt-1.5 text-xl font-semibold text-[#3F232C] tabular-nums">
                {status.summary.existingTables} / {status.summary.totalTables}
              </div>
              <div className="text-[11px] text-[#7D4E5D] mt-0.5">
                {status.summary.missingTables === 0
                  ? 'Semua tabel tersedia'
                  : `${status.summary.missingTables} tabel belum dibuat`}
              </div>
            </div>

            <div className="rounded-2xl bg-[#FFFFFF] border border-[#F0C6D2] p-4">
              <div className="flex items-center gap-2 text-[11px] text-[#7D4E5D]">
                <Server className="w-3.5 h-3.5 text-[#C25B7C]" />
                <span>Integritas Skema</span>
              </div>
              <div className="mt-1.5 flex items-center gap-1.5">
                {status.summary.schemaInSync ? (
                  <>
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    <span className="text-base font-semibold text-emerald-700">Tersinkron</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-5 h-5 text-amber-600" />
                    <span className="text-base font-semibold text-amber-700">Perlu Sinkron</span>
                  </>
                )}
              </div>
              <div className="text-[11px] text-[#7D4E5D] mt-0.5 tabular-nums">
                {status.summary.missingColumns} kolom · {status.summary.missingIndexes} indeks kurang
              </div>
            </div>

            <div className="rounded-2xl bg-[#FFFFFF] border border-[#F0C6D2] p-4">
              <div className="flex items-center gap-2 text-[11px] text-[#7D4E5D]">
                <HardDrive className="w-3.5 h-3.5 text-[#C25B7C]" />
                <span>Total Produk</span>
              </div>
              <div className="mt-1.5 text-xl font-semibold text-[#3F232C] tabular-nums">
                {status.summary.totalProducts}
              </div>
              <div className="text-[11px] text-[#7D4E5D] mt-0.5">
                {status.summary.unnumberedProducts > 0
                  ? `${status.summary.unnumberedProducts} produk belum bernomor`
                  : 'Semua nomor urut lengkap'}
              </div>
            </div>

            <div className="rounded-2xl bg-[#FFFFFF] border border-[#F0C6D2] p-4">
              <div className="flex items-center gap-2 text-[11px] text-[#7D4E5D]">
                <Sparkles className="w-3.5 h-3.5 text-[#C25B7C]" />
                <span>Kategori & Admin</span>
              </div>
              <div className="mt-1.5 text-xl font-semibold text-[#3F232C] tabular-nums">
                {status.summary.totalCategories} / {status.summary.totalAdmins}
              </div>
              <div className="text-[11px] text-[#7D4E5D] mt-0.5">
                Kategori aktif & admin terdaftar
              </div>
            </div>
          </div>
        )}

        {/* Auto-Schema & Sync Control Panel */}
        <div className="rounded-2xl bg-[#FFFFFF] border border-[#F0C6D2] p-4 sm:p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="font-serif-display text-lg font-semibold text-[#3F232C]">
                Sinkronisasi Skema & Data Otomatis
              </h2>
              <p className="text-xs text-[#7D4E5D] mt-0.5">
                Otomatis membuat tabel, menambahkan kolom baru, membuat indeks performa, melengkapi nomor produk, dan menyinkronkan Sequence ID PostgreSQL.
              </p>
            </div>
            <button
              type="button"
              onClick={handleSyncDatabase}
              disabled={syncingDb}
              className="w-full sm:w-auto min-h-[44px] inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#C25B7C] hover:bg-[#A84867] disabled:opacity-60 text-white text-xs font-medium shrink-0"
            >
              <RefreshCw className={`w-4 h-4 ${syncingDb ? 'animate-spin' : ''}`} />
              <span>
                {syncingDb ? 'Menyinkronkan Skema...' : 'Sinkronkan Database & Skema'}
              </span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <label className="flex items-start gap-2.5 p-3 rounded-xl bg-[#FFF6F8] border border-[#F0C6D2]/80 cursor-pointer">
              <input
                type="checkbox"
                checked={optCreateSchema}
                onChange={(e) => setOptCreateSchema(e.target.checked)}
                className="mt-0.5 accent-[#C25B7C]"
              />
              <div>
                <div className="text-xs font-semibold text-[#3F232C]">
                  Tambah Tabel, Kolom & Indeks Otomatis
                </div>
                <div className="text-[11px] text-[#7D4E5D]">
                  Menjalankan DDL otomatis untuk seluruh definisi skema aplikasi.
                </div>
              </div>
            </label>

            <label className="flex items-start gap-2.5 p-3 rounded-xl bg-[#FFF6F8] border border-[#F0C6D2]/80 cursor-pointer">
              <input
                type="checkbox"
                checked={optBackfillNumbers}
                onChange={(e) => setOptBackfillNumbers(e.target.checked)}
                className="mt-0.5 accent-[#C25B7C]"
              />
              <div>
                <div className="text-xs font-semibold text-[#3F232C]">
                  Lengkapi Nomor Urut Produk Kosong
                </div>
                <div className="text-[11px] text-[#7D4E5D]">
                  Mengisi kolom <span className="font-mono-tabular">product_number</span> secara berurutan jika masih NULL.
                </div>
              </div>
            </label>

            <label className="flex items-start gap-2.5 p-3 rounded-xl bg-[#FFF6F8] border border-[#F0C6D2]/80 cursor-pointer">
              <input
                type="checkbox"
                checked={optSyncSequences}
                onChange={(e) => setOptSyncSequences(e.target.checked)}
                className="mt-0.5 accent-[#C25B7C]"
              />
              <div>
                <div className="text-xs font-semibold text-[#3F232C]">
                  Sinkronkan Counter Sequence ID
                </div>
                <div className="text-[11px] text-[#7D4E5D]">
                  Menyamakan serial sequence agar penambahan data baru bebas bentrok ID.
                </div>
              </div>
            </label>

            <label className="flex items-start gap-2.5 p-3 rounded-xl bg-[#FFF6F8] border border-[#F0C6D2]/80 cursor-pointer">
              <input
                type="checkbox"
                checked={optSeedDefaults}
                onChange={(e) => setOptSeedDefaults(e.target.checked)}
                className="mt-0.5 accent-[#C25B7C]"
              />
              <div>
                <div className="text-xs font-semibold text-[#3F232C]">
                  Isi Pengaturan Awal Jika Kosong
                </div>
                <div className="text-[11px] text-[#7D4E5D]">
                  Memastikan profil, domain affiliate, dan pengaturan default tersedia tanpa menimpa data ada.
                </div>
              </div>
            </label>
          </div>

          {/* Last Sync Report Banner */}
          {lastSyncReport && (
            <div className="rounded-xl bg-emerald-50/80 border border-emerald-200 p-4 space-y-2 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 font-semibold text-emerald-800">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Sinkronisasi Database Berhasil ({lastSyncReport.durationMs} md)</span>
                </div>
                <span className="text-[11px] text-emerald-700 tabular-nums">
                  {formatJakartaDateTime(lastSyncReport.syncedAt)}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-[11px] text-emerald-900">
                <div>
                  Tabel dibuat:{' '}
                  <strong className="tabular-nums">{lastSyncReport.migration.tablesCreated.length}</strong>
                </div>
                <div>
                  Kolom ditambah:{' '}
                  <strong className="tabular-nums">{lastSyncReport.migration.columnsAdded.length}</strong>
                </div>
                <div>
                  Indeks dibuat:{' '}
                  <strong className="tabular-nums">{lastSyncReport.migration.indexesCreated.length}</strong>
                </div>
                <div>
                  Sequence disinkron:{' '}
                  <strong className="tabular-nums">{lastSyncReport.sequencesSynced.length}</strong>
                </div>
              </div>

              {lastSyncReport.migration.columnsAdded.length > 0 && (
                <div className="text-[11px] text-emerald-800 pt-1">
                  Kolom baru:{' '}
                  <span className="font-mono-tabular">
                    {lastSyncReport.migration.columnsAdded
                      .map((c) => `${c.table}.${c.column}`)
                      .join(', ')}
                  </span>
                </div>
              )}

              {lastSyncReport.migration.skippedDueToPermission.length > 0 && (
                <div className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2 mt-1">
                  Catatan izin owner: {lastSyncReport.migration.skippedDueToPermission.join(', ')} dilewati karena user DB bukan pemilik tabel.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Live Table Schema Matrix */}
        <div className="rounded-2xl bg-[#FFFFFF] border border-[#F0C6D2] overflow-hidden">
          <div className="px-4 sm:px-5 py-3.5 border-b border-[#F0C6D2]/70 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-serif-display text-base font-semibold text-[#3F232C]">
                Status Skema Tabel PostgreSQL ({status?.tables.length ?? 0} Tabel)
              </h2>
              <p className="text-[11px] text-[#7D4E5D]">
                Pemeriksaan langsung kolom, indeks, dan jumlah baris dari information_schema
              </p>
            </div>
          </div>

          {loading && !status ? (
            <div className="p-8 text-center text-xs text-[#7D4E5D]">
              Memeriksa skema database...
            </div>
          ) : !status || status.tables.length === 0 ? (
            <div className="p-8 text-center text-xs text-[#7D4E5D]">
              Belum ada data inspeksi skema tabel.
            </div>
          ) : (
            <>
              {/* Mobile / Tablet Card List (< md) */}
              <div className="md:hidden divide-y divide-[#F0C6D2]/60">
                {status.tables.map((t) => (
                  <div key={t.name} className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-mono-tabular text-xs font-semibold text-[#3F232C] truncate">
                          {t.name}
                        </div>
                        <div className="text-[11px] text-[#7D4E5D] truncate">{t.label}</div>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded-md text-[10px] font-semibold shrink-0 ${
                          t.inSync
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}
                      >
                        {t.inSync ? 'Tersinkron' : t.exists ? 'Perlu Update' : 'Belum Ada'}
                      </span>
                    </div>

                    <div className="flex items-center gap-4 text-[11px] text-[#7D4E5D] tabular-nums">
                      <span>Baris: <strong className="text-[#3F232C]">{t.rowCount}</strong></span>
                      <span>
                        Kolom: <strong className="text-[#3F232C]">{t.actualColumns}/{t.expectedColumns}</strong>
                      </span>
                    </div>

                    {(t.missingColumns.length > 0 || t.missingIndexes.length > 0) && (
                      <div className="text-[11px] text-amber-800 bg-amber-50 rounded-lg p-2">
                        {t.missingColumns.length > 0 && (
                          <div>Kolom kurang: {t.missingColumns.join(', ')}</div>
                        )}
                        {t.missingIndexes.length > 0 && (
                          <div>Indeks kurang: {t.missingIndexes.join(', ')}</div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Desktop Table View (md+) */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-[#FFF6F8] border-b border-[#F0C6D2] text-[#7D4E5D]">
                    <tr>
                      <th className="p-3 text-left">Nama Tabel</th>
                      <th className="p-3 text-left">Fungsi</th>
                      <th className="p-3 text-left">Status</th>
                      <th className="p-3 text-right">Baris</th>
                      <th className="p-3 text-right">Kolom</th>
                      <th className="p-3 text-left">Detail Skema</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F0C6D2]/60">
                    {status.tables.map((t) => (
                      <tr key={t.name} className="hover:bg-[#FFF6F8]/60">
                        <td className="p-3 font-mono-tabular font-semibold text-[#3F232C]">
                          {t.name}
                        </td>
                        <td className="p-3 text-[#7D4E5D]">{t.label}</td>
                        <td className="p-3">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium ${
                              t.inSync
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-amber-50 text-amber-700 border border-amber-200'
                            }`}
                          >
                            {t.inSync ? 'Tersinkron' : t.exists ? 'Perlu Update' : 'Belum Ada'}
                          </span>
                        </td>
                        <td className="p-3 text-right tabular-nums font-medium text-[#3F232C]">
                          {t.rowCount}
                        </td>
                        <td className="p-3 text-right tabular-nums text-[#7D4E5D]">
                          {t.actualColumns} / {t.expectedColumns}
                        </td>
                        <td className="p-3 text-[11px]">
                          {t.inSync ? (
                            <span className="text-emerald-700">Kolom & indeks lengkap</span>
                          ) : (
                            <div className="space-y-0.5 text-amber-800">
                              {t.missingColumns.length > 0 && (
                                <div>+ Kolom: {t.missingColumns.join(', ')}</div>
                              )}
                              {t.missingIndexes.length > 0 && (
                                <div>+ Indeks: {t.missingIndexes.join(', ')}</div>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
