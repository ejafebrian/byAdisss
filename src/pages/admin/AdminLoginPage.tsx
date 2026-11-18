import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Info,
  Lock,
  Mail,
} from 'lucide-react';
import { useAuth } from '../../lib/authContext';
import { useRouter } from '../../lib/router';

export function AdminLoginPage() {
  const {
    firebaseUser,
    admin,
    loading,
    authError,
    authErrorCode,
    signInGoogle,
    signInGoogleRedirect,
    signInEmail,
    resetPassword,
    logout,
  } = useAuth();
  const { navigate } = useRouter();
  const [mode, setMode] = useState<'login' | 'reset'>('login');
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [resetSent, setResetSent] = useState(false);
  const [isInIframe, setIsInIframe] = useState(false);
  const [serverHealth, setServerHealth] = useState<{
    dbConfigured?: boolean;
    dbConnected?: boolean;
    dbError?: string | null;
  } | null>(null);

  useEffect(() => {
    try {
      setIsInIframe(window.self !== window.top);
    } catch {
      setIsInIframe(true);
    }
  }, []);

  useEffect(() => {
    if (authErrorCode !== 'http_500' && authErrorCode !== 'http_503') {
      setServerHealth(null);
      return;
    }
    let active = true;
    fetch('/api/health')
      .then((r) => r.json())
      .then((d) => {
        if (active && d && typeof d === 'object') {
          setServerHealth(d);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [authErrorCode]);

  useEffect(() => {
    if (!loading && admin) {
      navigate('/admin', { replace: true });
    }
  }, [loading, admin, navigate]);

  const handleGoogleLogin = async () => {
    setLocalError(null);
    setSubmitting(true);
    try {
      const ok = await signInGoogle();
      if (ok) {
        navigate('/admin', { replace: true });
      }
    } catch {
      // authError is captured in context
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleRedirectLogin = async () => {
    setLocalError(null);
    setSubmitting(true);
    try {
      await signInGoogleRedirect();
    } catch {
      setSubmitting(false);
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    if (!email.trim() || !password) {
      setLocalError('Email dan password wajib diisi.');
      return;
    }
    setSubmitting(true);
    try {
      const ok = await signInEmail(email.trim(), password);
      if (ok) {
        navigate('/admin', { replace: true });
      }
    } catch {
      // authError captured in context
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    setResetSent(false);
    if (!email.trim()) {
      setLocalError('Masukkan alamat email admin untuk menerima tautan reset password.');
      return;
    }
    setSubmitting(true);
    try {
      await resetPassword(email.trim());
      setResetSent(true);
    } catch (err: any) {
      setLocalError(err?.message || 'Gagal mengirim email reset password.');
    } finally {
      setSubmitting(false);
    }
  };

  const displayError = localError || authError;
  const showPopupRecovery =
    isInIframe ||
    authErrorCode === 'auth/popup-blocked' ||
    authErrorCode === 'auth/popup-closed-by-user' ||
    authErrorCode === 'auth/cancelled-popup-request';

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#FFF6F8] to-[#FDE8EE]/70 flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-3xl bg-[#FFFFFF] border border-[#F0C6D2] p-7 sm:p-8 shadow-[0_14px_45px_rgba(194,91,124,0.1)]">
        <div className="text-center">
          <p className="text-[11px] font-semibold tracking-[0.2em] uppercase text-[#C25B7C]">
            Admin Portal
          </p>
          <h1 className="mt-1 font-serif-display text-3xl font-semibold text-[#3F232C]">
            by Adisss
          </h1>
          {mode === 'reset' && (
            <p className="mt-2 text-xs text-[#7D4E5D] leading-relaxed">
              Reset password akun admin terdaftar.
            </p>
          )}
        </div>

        {displayError && (
          <div
            role="alert"
            className="mt-5 space-y-2 rounded-xl border border-red-200 bg-[#FFF5F5] p-3.5 text-xs text-red-900"
          >
            <div className="flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
              <span className="leading-relaxed">{displayError}</span>
            </div>
            {serverHealth && (
              <div className="pt-2 border-t border-red-200/80 text-[11px] font-mono-tabular text-red-900 space-y-0.5">
                <div>
                  DB Configured: <strong>{String(Boolean(serverHealth.dbConfigured))}</strong> | DB Connected:{' '}
                  <strong>{String(Boolean(serverHealth.dbConnected))}</strong>
                </div>
                {serverHealth.dbError && <div>Detail: {serverHealth.dbError}</div>}
              </div>
            )}
            {firebaseUser && !admin && (
              <div className="pt-2 border-t border-red-200/80 flex items-center justify-between gap-2 text-[11px]">
                <span className="truncate text-red-800">
                  Login Firebase saat ini: <strong>{firebaseUser.email}</strong>
                </span>
                <button
                  type="button"
                  onClick={() => logout()}
                  className="shrink-0 font-semibold text-[#C25B7C] hover:text-[#A84867] underline underline-offset-2"
                >
                  Ganti Akun
                </button>
              </div>
            )}
          </div>
        )}

        {resetSent && (
          <div className="mt-5 flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs text-emerald-900">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
            <span>Tautan reset password telah dikirim ke {email}. Periksa kotak masuk Anda.</span>
          </div>
        )}

        {mode === 'login' ? (
          <div className="mt-6 space-y-4">
            <button
              type="button"
              disabled={submitting || loading}
              onClick={handleGoogleLogin}
              className="w-full min-h-[48px] flex items-center justify-center gap-3 rounded-xl bg-[#C25B7C] hover:bg-[#A84867] disabled:opacity-60 text-[#FFFFFF] text-sm font-medium transition-colors shadow-xs"
            >
              <span>{submitting ? 'Memverifikasi...' : 'Masuk dengan Google'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            {showPopupRecovery && (
              <div className="rounded-xl bg-[#FDE8EE]/60 border border-[#F0C6D2] p-3.5 space-y-2.5 text-xs">
                <div className="flex items-start gap-2 text-[#3F232C]">
                  <Info className="w-4 h-4 text-[#C25B7C] shrink-0 mt-0.5" />
                  <p className="leading-relaxed">
                    {isInIframe
                      ? 'Mode preview iframe terkadang memblokir popup login Google. Untuk login paling lancar, buka halaman admin di tab browser baru:'
                      : 'Popup login tidak selesai? Anda dapat membuka tab baru atau memakai metode redirect:'}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <a
                    href="/admin/login"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 min-h-[38px] inline-flex items-center justify-center gap-1.5 px-3 rounded-lg bg-[#FFFFFF] border border-[#C25B7C] text-[#C25B7C] hover:bg-[#FFF6F8] font-medium transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Buka Login di Tab Baru</span>
                  </a>
                  {!isInIframe && (
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={handleGoogleRedirectLogin}
                      className="min-h-[38px] px-3 rounded-lg border border-[#F0C6D2] bg-[#FFFFFF] text-[#7D4E5D] hover:text-[#3F232C] font-medium"
                    >
                      Pakai Redirect
                    </button>
                  )}
                </div>
              </div>
            )}

            <div className="pt-2 border-t border-[#F0C6D2]/70">
              <button
                type="button"
                onClick={() => setShowEmailForm((prev) => !prev)}
                className="w-full flex items-center justify-between py-1.5 text-xs font-medium text-[#7D4E5D] hover:text-[#3F232C]"
              >
                <span>Masuk dengan Email & Password (opsional)</span>
                {showEmailForm ? (
                  <ChevronUp className="w-4 h-4 text-[#C25B7C]" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-[#C25B7C]" />
                )}
              </button>

              {showEmailForm && (
                <form onSubmit={handleEmailLogin} className="mt-3 space-y-3.5">
                  <div>
                    <label
                      htmlFor="admin-email"
                      className="block text-xs font-medium text-[#3F232C] mb-1.5"
                    >
                      Email Admin
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-[#C25B7C] absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        id="admin-email"
                        type="email"
                        autoComplete="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="username"
                        className="w-full min-h-[42px] pl-10 pr-3.5 rounded-xl border border-[#F0C6D2] bg-[#FFF6F8] text-sm text-[#3F232C] focus:outline-none focus:border-[#C25B7C]"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label
                        htmlFor="admin-password"
                        className="block text-xs font-medium text-[#3F232C]"
                      >
                        Password
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setMode('reset');
                          setLocalError(null);
                        }}
                        className="text-xs text-[#C25B7C] hover:text-[#A84867] underline underline-offset-4"
                      >
                        Lupa password?
                      </button>
                    </div>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-[#C25B7C] absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        id="admin-password"
                        type="password"
                        autoComplete="current-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full min-h-[42px] pl-10 pr-3.5 rounded-xl border border-[#F0C6D2] bg-[#FFF6F8] text-sm text-[#3F232C] focus:outline-none focus:border-[#C25B7C]"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={submitting || loading}
                    className="w-full min-h-[42px] rounded-xl border border-[#C25B7C] text-[#C25B7C] hover:bg-[#FDE8EE]/60 disabled:opacity-60 text-sm font-medium transition-colors"
                  >
                    Login dengan Email
                  </button>
                </form>
              )}
            </div>

            <div className="pt-1 flex items-center justify-between text-[11px] text-[#7D4E5D]/90">
              <a href="/" className="hover:text-[#C25B7C] underline underline-offset-4">
                ← Kembali ke Katalog
              </a>
              <span>Akses khusus admin terotorisasi</span>
            </div>
          </div>
        ) : (
          <form onSubmit={handleResetPassword} className="mt-6 space-y-4">
            <div>
              <label
                htmlFor="reset-email"
                className="block text-xs font-medium text-[#3F232C] mb-1.5"
              >
                Email Terdaftar
              </label>
              <input
                id="reset-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="username"
                className="w-full min-h-[44px] px-3.5 rounded-xl border border-[#F0C6D2] bg-[#FFF6F8] text-sm text-[#3F232C] focus:outline-none focus:border-[#C25B7C]"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full min-h-[44px] rounded-xl bg-[#C25B7C] hover:bg-[#A84867] text-white text-sm font-medium transition-colors"
            >
              {submitting ? 'Mengirim...' : 'Kirim Link Reset Password'}
            </button>

            <button
              type="button"
              onClick={() => {
                setMode('login');
                setLocalError(null);
                setResetSent(false);
              }}
              className="w-full text-xs text-[#7D4E5D] hover:text-[#3F232C] py-2"
            >
              Kembali ke Halaman Login
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
