import React, { useEffect, useState } from 'react';
import { AlertCircle, ArrowRight, CheckCircle2, Lock, Mail } from 'lucide-react';
import { useAuth } from '../../lib/authContext';
import { useRouter } from '../../lib/router';

export function AdminLoginPage() {
  const { admin, loading, authError, signInGoogle, signInEmail, resetPassword } = useAuth();
  const { navigate } = useRouter();
  const [mode, setMode] = useState<'login' | 'reset'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [resetSent, setResetSent] = useState(false);

  useEffect(() => {
    if (!loading && admin) {
      navigate('/admin', { replace: true });
    }
  }, [loading, admin, navigate]);

  const handleGoogleLogin = async () => {
    setLocalError(null);
    setSubmitting(true);
    try {
      await signInGoogle();
    } catch {
      // authError is already captured in context
    } finally {
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
      await signInEmail(email.trim(), password);
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

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#FFF6F8] to-[#FDE8EE]/60 flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-3xl bg-[#FFFFFF] border border-[#F0C6D2] p-8 shadow-[0_14px_45px_rgba(194,91,124,0.1)]">
        <div className="text-center">
          <p className="text-[11px] font-semibold tracking-[0.2em] uppercase text-[#C25B7C]">
            Admin Portal
          </p>
          <h1 className="mt-1 font-serif-display text-3xl font-semibold text-[#3F232C]">
            by Adisss
          </h1>
          <p className="mt-2 text-xs text-[#7D4E5D]">
            {mode === 'login'
              ? 'Masuk untuk mengelola katalog produk, import Google Sheet, sandbox link, dan analitik.'
              : 'Reset password akun admin terdaftar.'}
          </p>
        </div>

        {displayError && (
          <div
            role="alert"
            className="mt-5 flex items-start gap-2.5 rounded-xl border border-red-200 bg-[#FFF5F5] p-3.5 text-xs text-red-900"
          >
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
            <span className="leading-relaxed">{displayError}</span>
          </div>
        )}

        {resetSent && (
          <div className="mt-5 flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs text-emerald-900">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
            <span>Tautan reset password telah dikirim ke {email}. Periksa kotak masuk Anda.</span>
          </div>
        )}

        {mode === 'login' ? (
          <div className="mt-6 space-y-5">
            <button
              type="button"
              disabled={submitting || loading}
              onClick={handleGoogleLogin}
              className="w-full min-h-[46px] flex items-center justify-center gap-3 rounded-xl bg-[#C25B7C] hover:bg-[#A84867] disabled:opacity-60 text-[#FFFFFF] text-sm font-medium transition-colors"
            >
              <span>{submitting ? 'Memverifikasi...' : 'Masuk dengan Google'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <div className="relative flex items-center py-1">
              <div className="flex-grow border-t border-[#F0C6D2]/80" />
              <span className="mx-3 text-[11px] font-medium text-[#7D4E5D]">
                atau email & password
              </span>
              <div className="flex-grow border-t border-[#F0C6D2]/80" />
            </div>

            <form onSubmit={handleEmailLogin} className="space-y-4">
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
                    placeholder="admin@byadisss.id"
                    className="w-full min-h-[44px] pl-10 pr-3.5 rounded-xl border border-[#F0C6D2] bg-[#FFF6F8] text-sm text-[#3F232C] focus:outline-none focus:border-[#C25B7C]"
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
                    className="w-full min-h-[44px] pl-10 pr-3.5 rounded-xl border border-[#F0C6D2] bg-[#FFF6F8] text-sm text-[#3F232C] focus:outline-none focus:border-[#C25B7C]"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting || loading}
                className="w-full min-h-[44px] rounded-xl border border-[#C25B7C] text-[#C25B7C] hover:bg-[#FDE8EE]/60 disabled:opacity-60 text-sm font-medium transition-colors"
              >
                Login dengan Email
              </button>
            </form>

            <p className="text-[11px] text-center text-[#7D4E5D]/90 leading-relaxed">
              Akses terbatas hanya untuk admin yang telah diotorisasi. Pendaftaran publik dinonaktifkan.
            </p>
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
                placeholder="admin@byadisss.id"
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
