import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  getRedirectResult,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut as firebaseSignOut,
  User,
} from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import {
  auth,
  firestoreDb,
  googleAuthProvider,
  handleFirestoreError,
  OperationType,
} from './firebase';

export interface AdminUser {
  id: number;
  uid: string | null;
  email: string;
  displayName: string;
  role: 'super_admin' | 'admin' | 'editor' | string;
  isActive: boolean;
  isAdmin?: boolean;
}

export interface FirestoreUserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: 'super_admin' | 'admin' | 'editor' | 'user' | string;
  isAdmin: boolean;
  isActive: boolean;
}

interface AuthContextValue {
  firebaseUser: User | null;
  firestoreUser: FirestoreUserProfile | null;
  admin: AdminUser | null;
  loading: boolean;
  authError: string | null;
  authErrorCode: string | null;
  getToken: () => Promise<string | null>;
  authFetch: (input: string, init?: RequestInit) => Promise<Response>;
  signInGoogle: () => Promise<boolean>;
  signInGoogleRedirect: () => Promise<void>;
  signInEmail: (email: string, password: string) => Promise<boolean>;
  resetPassword: (email: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const BOOTSTRAP_OWNER_EMAILS = ['ejafebriansyah3@gmail.com'];
const ALLOWED_ADMIN_ROLES = new Set(['super_admin', 'admin', 'editor']);

export function emailToInviteId(email: string): string {
  return email
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '_')
    .slice(0, 128);
}

function mapFirebaseGoogleError(err: any): { code: string; message: string } {
  const code = String(err?.code || '');
  if (code === 'auth/popup-blocked') {
    return {
      code,
      message:
        'Popup login Google diblokir oleh browser atau iframe preview. Klik "Buka Login di Tab Baru" di bawah ini untuk login dengan lancar.',
    };
  }
  if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
    return {
      code,
      message:
        'Jendela login Google tertutup sebelum selesai. Jika popup diblokir di mode preview iframe, silakan klik "Buka Login di Tab Baru".',
    };
  }
  if (code === 'auth/unauthorized-domain') {
    const host = typeof window !== 'undefined' ? window.location.hostname : '';
    return {
      code,
      message: `Domain "${host}" belum terdaftar di Authorized Domains Firebase Authentication. Tambahkan domain ini di Firebase Console → Authentication → Settings → Authorized domains.`,
    };
  }
  if (code === 'auth/operation-not-allowed') {
    return {
      code,
      message: 'Provider Google Sign-In belum diaktifkan di Firebase Console.',
    };
  }
  return {
    code,
    message: err?.message || 'Gagal login dengan Google. Silakan coba buka halaman login di tab baru.',
  };
}

async function syncAndVerifyFirestoreUser(user: User): Promise<{
  profile: FirestoreUserProfile;
  hasAdminAccess: boolean;
}> {
  const email = (user.email || '').trim().toLowerCase();
  const displayName = (user.displayName || email.split('@')[0] || 'Admin').slice(0, 120);
  const isBootstrapOwner = BOOTSTRAP_OWNER_EMAILS.includes(email) && user.emailVerified;

  const userDocRef = doc(firestoreDb, 'users', user.uid);
  const adminDocRef = doc(firestoreDb, 'admins', user.uid);

  // Check if a Super Admin pre-authorized this email via /admin_invites/{inviteId}
  let invitedRole: string | null = null;
  let invitedDisplayName: string | null = null;
  if (email && user.emailVerified) {
    const inviteId = emailToInviteId(email);
    if (inviteId) {
      const inviteDocRef = doc(firestoreDb, 'admin_invites', inviteId);
      try {
        const inviteSnap = await getDoc(inviteDocRef);
        if (inviteSnap.exists()) {
          const inviteData = inviteSnap.data();
          if (
            inviteData?.isActive === true &&
            inviteData?.isAdmin === true &&
            String(inviteData?.email || '').trim().toLowerCase() === email &&
            ALLOWED_ADMIN_ROLES.has(String(inviteData?.role || ''))
          ) {
            invitedRole = String(inviteData.role);
            if (inviteData.displayName) {
              invitedDisplayName = String(inviteData.displayName).slice(0, 120);
            }
          }
        }
      } catch (err) {
        // Non-fatal here; log structured diagnostic without blocking backend check
        console.warn('Firestore admin_invites check skipped:', err);
      }
    }
  }

  let existingUserData: Record<string, any> | null = null;
  try {
    const snap = await getDoc(userDocRef);
    if (snap.exists()) {
      existingUserData = snap.data();
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, `users/${user.uid}`);
  }

  const targetAdminRole = isBootstrapOwner ? 'super_admin' : invitedRole;
  const effectiveDisplayName = invitedDisplayName || displayName;

  if (!existingUserData) {
    const initialRole = targetAdminRole || 'user';
    const initialIsAdmin = Boolean(targetAdminRole);
    try {
      await setDoc(userDocRef, {
        uid: user.uid,
        email,
        displayName: effectiveDisplayName,
        role: initialRole,
        isAdmin: initialIsAdmin,
        isActive: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      existingUserData = {
        uid: user.uid,
        email,
        displayName: effectiveDisplayName,
        role: initialRole,
        isAdmin: initialIsAdmin,
        isActive: true,
      };
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `users/${user.uid}`);
    }
  } else if (
    targetAdminRole &&
    (existingUserData.isAdmin !== true ||
      existingUserData.role !== targetAdminRole ||
      existingUserData.isActive !== true)
  ) {
    try {
      await updateDoc(userDocRef, {
        email,
        displayName: String(existingUserData.displayName || effectiveDisplayName).slice(0, 120),
        role: targetAdminRole,
        isAdmin: true,
        isActive: true,
        updatedAt: serverTimestamp(),
      });
      existingUserData = {
        ...existingUserData,
        email,
        role: targetAdminRole,
        isAdmin: true,
        isActive: true,
      };
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}`);
    }
  }

  // Ensure Firestore /admins/{uid} mirror exists for bootstrap owner or invited admin
  if (targetAdminRole) {
    try {
      const adminSnap = await getDoc(adminDocRef);
      if (!adminSnap.exists()) {
        await setDoc(adminDocRef, {
          uid: user.uid,
          email,
          role: targetAdminRole,
          isAdmin: true,
          isActive: true,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } else {
        const currentAdmin = adminSnap.data();
        if (
          currentAdmin?.role !== targetAdminRole ||
          currentAdmin?.isAdmin !== true ||
          currentAdmin?.isActive !== true
        ) {
          await updateDoc(adminDocRef, {
            email,
            role: targetAdminRole,
            isAdmin: true,
            isActive: true,
            updatedAt: serverTimestamp(),
          });
        }
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `admins/${user.uid}`);
    }
  }

  // Also check /admins/{uid} directly in case admin record was granted without updating /users/{uid}
  let hasAdminMirror = false;
  let adminMirrorRole: string | null = null;
  if (existingUserData?.isAdmin !== true || !ALLOWED_ADMIN_ROLES.has(String(existingUserData?.role || ''))) {
    try {
      const adminSnap = await getDoc(adminDocRef);
      if (adminSnap.exists()) {
        const aData = adminSnap.data();
        if (aData?.isActive === true && aData?.isAdmin === true && ALLOWED_ADMIN_ROLES.has(String(aData?.role || ''))) {
          hasAdminMirror = true;
          adminMirrorRole = String(aData.role);
        }
      }
    } catch {
      // ignore if user has no admin doc
    }
  }

  const profile: FirestoreUserProfile = {
    uid: user.uid,
    email: String(existingUserData?.email || email),
    displayName: String(existingUserData?.displayName || effectiveDisplayName),
    role: adminMirrorRole || String(existingUserData?.role || 'user'),
    isAdmin: existingUserData?.isAdmin === true || hasAdminMirror,
    isActive: existingUserData?.isActive !== false,
  };

  // Recognize admin access if account is active AND either has explicit admin role or isAdmin === true
  const hasAdminAccess =
    profile.isActive === true &&
    (ALLOWED_ADMIN_ROLES.has(profile.role) || profile.isAdmin === true);

  return { profile, hasAdminAccess };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [firestoreUser, setFirestoreUser] = useState<FirestoreUserProfile | null>(null);
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authErrorCode, setAuthErrorCode] = useState<string | null>(null);

  const verifyBackendAdmin = useCallback(async (user: User | null): Promise<boolean> => {
    if (!user) {
      setAdmin(null);
      setFirestoreUser(null);
      setLoading(false);
      return false;
    }

    let profile: FirestoreUserProfile | null = null;
    let firestoreHasAdminAccess = false;
    let firestorePermissionDenied = false;

    try {
      // 1. Sync & inspect Firestore user/admin/invite documents
      const syncResult = await syncAndVerifyFirestoreUser(user);
      profile = syncResult.profile;
      firestoreHasAdminAccess = syncResult.hasAdminAccess;
      setFirestoreUser(profile);
    } catch (err: any) {
      const message = String(err?.message || '');
      if (message.includes('authInfo') && message.includes('operationType')) {
        firestorePermissionDenied = true;
      }
      // Do NOT abort yet — fall through to verify against backend /api/admin/me
      // so admins authorized in PostgreSQL (or email/password accounts before email verification)
      // can still be verified authoritatively by the server!
    }

    try {
      // 2. Authoritatively verify session & admin role with the backend API (/api/admin/me)
      const token = await user.getIdToken();
      const res = await fetch('/api/admin/me', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const rawText = await res.text();
      let body: Record<string, any> = {};
      try {
        body = rawText ? JSON.parse(rawText) : {};
      } catch {
        body = {};
      }

      if (res.ok && body.admin) {
        const resolvedRole = String(body.admin.role || profile?.role || 'admin');
        setFirestoreUser((prev) =>
          prev
            ? { ...prev, role: resolvedRole, isAdmin: true }
            : {
                uid: user.uid,
                email: String(body.admin.email || user.email || ''),
                displayName: String(body.admin.displayName || user.displayName || 'Admin'),
                role: resolvedRole,
                isAdmin: true,
                isActive: true,
              }
        );
        setAdmin({
          ...body.admin,
          isAdmin: true,
        });
        setAuthError(null);
        setAuthErrorCode(null);
        return true;
      }

      // Backend returned non-OK
      setAdmin(null);
      if (res.status === 403 && !firestoreHasAdminAccess && profile) {
        setAuthErrorCode('firestore_not_admin');
        setAuthError(
          body.error
            ? String(body.error)
            : `Akun (${profile.email}) belum terdaftar sebagai admin aktif (status Firestore: isAdmin=${String(profile.isAdmin)}, role=${profile.role}).`
        );
        return false;
      }

      if (res.status === 403 && firestorePermissionDenied) {
        setAuthErrorCode('firestore_permission_denied');
        setAuthError(
          body.error
            ? String(body.error)
            : 'Akses ditolak: email belum terverifikasi di Firebase Auth atau belum terdaftar sebagai admin.'
        );
        return false;
      }

      setAuthErrorCode(`http_${res.status}`);
      if (body.error) {
        setAuthError(String(body.error));
      } else if (res.status === 404) {
        setAuthError(
          'Endpoint API /api/admin/me tidak ditemukan (HTTP 404). Pastikan konfigurasi vercel.json dan api/index.js sudah terdeploy ulang.'
        );
      } else if (res.status >= 500) {
        setAuthError(
          `Server backend mengalami error (HTTP ${res.status}) saat memverifikasi admin. Periksa konfigurasi database (DATABASE_URL / SQL_HOST) pada environment server.`
        );
      } else {
        setAuthError(
          `Akun (${user.email || 'tanpa email'}) tidak memiliki izin admin (HTTP ${res.status}).`
        );
      }
      return false;
    } catch {
      setAdmin(null);
      if (firestorePermissionDenied) {
        setAuthErrorCode('firestore_permission_denied');
        setAuthError(
          'Akses ke dokumen admin Firestore ditolak oleh Security Rules. Pastikan email akun Anda sudah terverifikasi.'
        );
      } else {
        setAuthErrorCode('verification_error');
        setAuthError('Gagal memverifikasi sesi admin dengan server backend.');
      }
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    getRedirectResult(auth)
      .then((res) => {
        if (res?.user) {
          setFirebaseUser(res.user);
          void verifyBackendAdmin(res.user);
        }
      })
      .catch((err) => {
        const mapped = mapFirebaseGoogleError(err);
        setAuthErrorCode(mapped.code);
        setAuthError(mapped.message);
      });

    const unsub = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      void verifyBackendAdmin(user);
    });
    return () => unsub();
  }, [verifyBackendAdmin]);

  const getToken = useCallback(async () => {
    if (!auth.currentUser) return null;
    return auth.currentUser.getIdToken();
  }, []);

  const authFetch = useCallback(
    async (input: string, init: RequestInit = {}) => {
      const token = await getToken();
      const headers = new Headers(init.headers || {});
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }
      return fetch(input, { ...init, headers });
    },
    [getToken]
  );

  const signInGoogle = useCallback(async (): Promise<boolean> => {
    setAuthError(null);
    setAuthErrorCode(null);
    setLoading(true);
    try {
      const cred = await signInWithPopup(auth, googleAuthProvider);
      setFirebaseUser(cred.user);
      return await verifyBackendAdmin(cred.user);
    } catch (err: any) {
      setLoading(false);
      const mapped = mapFirebaseGoogleError(err);
      setAuthErrorCode(mapped.code);
      setAuthError(mapped.message);
      throw err;
    }
  }, [verifyBackendAdmin]);

  const signInGoogleRedirect = useCallback(async () => {
    setAuthError(null);
    setAuthErrorCode(null);
    try {
      await signInWithRedirect(auth, googleAuthProvider);
    } catch (err: any) {
      const mapped = mapFirebaseGoogleError(err);
      setAuthErrorCode(mapped.code);
      setAuthError(mapped.message);
      throw err;
    }
  }, []);

  const signInEmail = useCallback(
    async (email: string, password: string): Promise<boolean> => {
      setAuthError(null);
      setAuthErrorCode(null);
      setLoading(true);
      try {
        const cred = await signInWithEmailAndPassword(auth, email, password);
        setFirebaseUser(cred.user);
        return await verifyBackendAdmin(cred.user);
      } catch (err: any) {
        setLoading(false);
        const code = String(err?.code || '');
        setAuthErrorCode(code);
        if (code === 'auth/operation-not-allowed') {
          setAuthError(
            'Login Email/Password belum diaktifkan di Firebase Console. Silakan klik tombol "Masuk dengan Google" di atas.'
          );
        } else if (
          code === 'auth/wrong-password' ||
          code === 'auth/invalid-credential' ||
          code === 'auth/user-not-found'
        ) {
          setAuthError('Email atau password salah.');
        } else {
          setAuthError(err?.message || 'Gagal login.');
        }
        throw err;
      }
    },
    [verifyBackendAdmin]
  );

  const resetPassword = useCallback(async (email: string) => {
    await sendPasswordResetEmail(auth, email);
  }, []);

  const logout = useCallback(async () => {
    await firebaseSignOut(auth);
    setAdmin(null);
    setFirebaseUser(null);
    setFirestoreUser(null);
    setAuthError(null);
    setAuthErrorCode(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
        firestoreUser,
        admin,
        loading,
        authError,
        authErrorCode,
        getToken,
        authFetch,
        signInGoogle,
        signInGoogleRedirect,
        signInEmail,
        resetPassword,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
