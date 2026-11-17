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
import { auth, googleAuthProvider } from './firebase';

export interface AdminUser {
  id: number;
  uid: string | null;
  email: string;
  displayName: string;
  role: 'super_admin' | 'admin' | 'editor' | string;
  isActive: boolean;
}

interface AuthContextValue {
  firebaseUser: User | null;
  admin: AdminUser | null;
  loading: boolean;
  authError: string | null;
  authErrorCode: string | null;
  getToken: () => Promise<string | null>;
  authFetch: (input: string, init?: RequestInit) => Promise<Response>;
  signInGoogle: () => Promise<void>;
  signInGoogleRedirect: () => Promise<void>;
  signInEmail: (email: string, password: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authErrorCode, setAuthErrorCode] = useState<string | null>(null);

  const verifyBackendAdmin = useCallback(async (user: User | null) => {
    if (!user) {
      setAdmin(null);
      setLoading(false);
      return;
    }
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/admin/me', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setAdmin(null);
        setAuthErrorCode(`http_${res.status}`);
        setAuthError(body.error || 'Akun tidak memiliki izin admin.');
      } else {
        const body = await res.json();
        setAdmin(body.admin);
        setAuthError(null);
        setAuthErrorCode(null);
      }
    } catch {
      setAdmin(null);
      setAuthErrorCode('network_error');
      setAuthError('Gagal memverifikasi sesi admin dengan server.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    getRedirectResult(auth)
      .then((res) => {
        if (res?.user) {
          setFirebaseUser(res.user);
          verifyBackendAdmin(res.user);
        }
      })
      .catch((err) => {
        const mapped = mapFirebaseGoogleError(err);
        setAuthErrorCode(mapped.code);
        setAuthError(mapped.message);
      });

    const unsub = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      verifyBackendAdmin(user);
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

  const signInGoogle = useCallback(async () => {
    setAuthError(null);
    setAuthErrorCode(null);
    setLoading(true);
    try {
      const cred = await signInWithPopup(auth, googleAuthProvider);
      await verifyBackendAdmin(cred.user);
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
    async (email: string, password: string) => {
      setAuthError(null);
      setAuthErrorCode(null);
      setLoading(true);
      try {
        const cred = await signInWithEmailAndPassword(auth, email, password);
        await verifyBackendAdmin(cred.user);
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
    setAuthError(null);
    setAuthErrorCode(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
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
