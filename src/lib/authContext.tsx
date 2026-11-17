import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
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
  getToken: () => Promise<string | null>;
  authFetch: (input: string, init?: RequestInit) => Promise<Response>;
  signInGoogle: () => Promise<void>;
  signInEmail: (email: string, password: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

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
        setAuthError(body.error || 'Akun tidak memiliki izin admin.');
      } else {
        const body = await res.json();
        setAdmin(body.admin);
        setAuthError(null);
      }
    } catch {
      setAdmin(null);
      setAuthError('Gagal memverifikasi sesi admin dengan server.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
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
    setLoading(true);
    try {
      const cred = await signInWithPopup(auth, googleAuthProvider);
      await verifyBackendAdmin(cred.user);
    } catch (err: any) {
      setLoading(false);
      const code = err?.code || '';
      if (code === 'auth/popup-closed-by-user') {
        setAuthError('Jendela login Google ditutup sebelum selesai.');
      } else {
        setAuthError(err?.message || 'Gagal login dengan Google.');
      }
      throw err;
    }
  }, [verifyBackendAdmin]);

  const signInEmail = useCallback(
    async (email: string, password: string) => {
      setAuthError(null);
      setLoading(true);
      try {
        const cred = await signInWithEmailAndPassword(auth, email, password);
        await verifyBackendAdmin(cred.user);
      } catch (err: any) {
        setLoading(false);
        const code = err?.code || '';
        if (code === 'auth/operation-not-allowed') {
          setAuthError(
            'Login Email/Password belum diaktifkan di Firebase Console. Silakan gunakan tombol Masuk dengan Google atau aktifkan provider Email/Password di Firebase Console.'
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
  }, []);

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
        admin,
        loading,
        authError,
        getToken,
        authFetch,
        signInGoogle,
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
