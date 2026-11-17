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

  let existingUserData: Record<string, any> | null = null;
  try {
    const snap = await getDoc(userDocRef);
    if (snap.exists()) {
      existingUserData = snap.data();
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, `users/${user.uid}`);
  }

  if (!existingUserData) {
    const initialRole = isBootstrapOwner ? 'super_admin' : 'user';
    const initialIsAdmin = isBootstrapOwner;
    try {
      await setDoc(userDocRef, {
        uid: user.uid,
        email,
        displayName,
        role: initialRole,
        isAdmin: initialIsAdmin,
        isActive: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      existingUserData = {
        uid: user.uid,
        email,
        displayName,
        role: initialRole,
        isAdmin: initialIsAdmin,
        isActive: true,
      };
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `users/${user.uid}`);
    }
  } else if (
    isBootstrapOwner &&
    (existingUserData.isAdmin !== true ||
      existingUserData.role !== 'super_admin' ||
      existingUserData.isActive !== true)
  ) {
    try {
      await updateDoc(userDocRef, {
        email,
        displayName,
        role: 'super_admin',
        isAdmin: true,
        isActive: true,
        updatedAt: serverTimestamp(),
      });
      existingUserData = {
        ...existingUserData,
        email,
        displayName,
        role: 'super_admin',
        isAdmin: true,
        isActive: true,
      };
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}`);
    }
  }

  // Ensure Firestore /admins/{uid} mirror exists for bootstrap owner
  if (isBootstrapOwner) {
    try {
      const adminSnap = await getDoc(adminDocRef);
      if (!adminSnap.exists()) {
        await setDoc(adminDocRef, {
          uid: user.uid,
          email,
          role: 'super_admin',
          isAdmin: true,
          isActive: true,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `admins/${user.uid}`);
    }
  }

  const profile: FirestoreUserProfile = {
    uid: user.uid,
    email: String(existingUserData?.email || email),
    displayName: String(existingUserData?.displayName || displayName),
    role: String(existingUserData?.role || 'user'),
    isAdmin: existingUserData?.isAdmin === true,
    isActive: existingUserData?.isActive !== false,
  };

  const hasAdminAccess =
    profile.isAdmin === true &&
    profile.isActive === true &&
    ALLOWED_ADMIN_ROLES.has(profile.role);

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

    try {
      // 1. Explicitly check & verify the admin flag + role in the Firestore user document
      const { profile, hasAdminAccess } = await syncAndVerifyFirestoreUser(user);
      setFirestoreUser(profile);

      if (!hasAdminAccess) {
        setAdmin(null);
        setAuthErrorCode('firestore_not_admin');
        setAuthError(
          `Akun (${profile.email}) tidak memiliki flag admin (isAdmin: true, role: ${profile.role}) pada dokumen pengguna Firestore.`
        );
        return false;
      }

      // 2. Verify session & role with the backend API
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

      if (!res.ok) {
        setAdmin(null);
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
      }

      setAdmin({
        ...body.admin,
        isAdmin: profile.isAdmin,
      });
      setAuthError(null);
      setAuthErrorCode(null);
      return true;
    } catch (err: any) {
      setAdmin(null);
      const message = err?.message || '';
      if (message.includes('authInfo') && message.includes('operationType')) {
        setAuthErrorCode('firestore_permission_denied');
        setAuthError(
          'Akses ke dokumen admin Firestore ditolak oleh Security Rules. Pastikan email Google Anda sudah terverifikasi dan terdaftar.'
        );
      } else {
        setAuthErrorCode('verification_error');
        setAuthError('Gagal memverifikasi sesi admin dengan Firestore & server.');
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
