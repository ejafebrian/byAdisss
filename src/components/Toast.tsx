import React, { createContext, useCallback, useContext, useState } from 'react';
import { CheckCircle2, AlertCircle, X } from 'lucide-react';

interface ToastItem {
  id: number;
  type: 'success' | 'error';
  message: string;
}

interface ConfirmState {
  title: string;
  message: string;
  confirmLabel?: string;
  destructive?: boolean;
  resolve: (value: boolean) => void;
}

interface UiFeedbackContextValue {
  notifySuccess: (message: string) => void;
  notifyError: (message: string) => void;
  confirmAction: (opts: {
    title: string;
    message: string;
    confirmLabel?: string;
    destructive?: boolean;
  }) => Promise<boolean>;
}

const UiFeedbackContext = createContext<UiFeedbackContextValue | null>(null);

export function UiFeedbackProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);

  const pushToast = useCallback((type: 'success' | 'error', message: string) => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  const notifySuccess = useCallback((msg: string) => pushToast('success', msg), [pushToast]);
  const notifyError = useCallback((msg: string) => pushToast('error', msg), [pushToast]);

  const confirmAction = useCallback(
    (opts: {
      title: string;
      message: string;
      confirmLabel?: string;
      destructive?: boolean;
    }) => {
      return new Promise<boolean>((resolve) => {
        setConfirmState({ ...opts, resolve });
      });
    },
    []
  );

  const handleConfirmClose = (result: boolean) => {
    if (confirmState) {
      confirmState.resolve(result);
      setConfirmState(null);
    }
  };

  return (
    <UiFeedbackContext.Provider value={{ notifySuccess, notifyError, confirmAction }}>
      {children}

      {/* Toast Container */}
      <div
        aria-live="polite"
        className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none px-4 sm:px-0"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-start gap-3 rounded-xl border px-4 py-3 shadow-lg text-sm transition-all ${
              t.type === 'success'
                ? 'bg-[#FFFFFF] border-[#F0C6D2] text-[#3F232C]'
                : 'bg-[#FFF5F5] border-red-200 text-red-900'
            }`}
          >
            {t.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            )}
            <span className="flex-1 leading-snug">{t.message}</span>
            <button
              type="button"
              onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
              aria-label="Tutup notifikasi"
              className="text-[#7D4E5D] hover:text-[#3F232C] p-0.5"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      {/* Confirmation Modal */}
      {confirmState && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#3F232C]/40 backdrop-blur-xs p-4"
        >
          <div className="w-full max-w-md rounded-2xl bg-[#FFFFFF] border border-[#F0C6D2] p-6 shadow-xl">
            <h3 className="font-serif-display text-xl font-semibold text-[#3F232C]">
              {confirmState.title}
            </h3>
            <p className="mt-2 text-sm text-[#7D4E5D] leading-relaxed">{confirmState.message}</p>
            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => handleConfirmClose(false)}
                className="px-4 py-2.5 rounded-xl border border-[#F0C6D2] text-sm font-medium text-[#3F232C] hover:bg-[#FFF6F8] transition-colors whitespace-nowrap"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => handleConfirmClose(true)}
                className={`px-4 py-2.5 rounded-xl text-sm font-medium text-white transition-colors whitespace-nowrap ${
                  confirmState.destructive
                    ? 'bg-red-700 hover:bg-red-800'
                    : 'bg-[#C25B7C] hover:bg-[#A84867]'
                }`}
              >
                {confirmState.confirmLabel || 'Lanjutkan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </UiFeedbackContext.Provider>
  );
}

export function useUiFeedback() {
  const ctx = useContext(UiFeedbackContext);
  if (!ctx) throw new Error('useUiFeedback must be used inside UiFeedbackProvider');
  return ctx;
}
