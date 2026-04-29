'use client';

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';

type ToastKind = 'success' | 'error' | 'info';
interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
}

interface ToastContextValue {
  toast: (message: string, kind?: ToastKind) => void;
  confirm: (message: string, opts?: { confirmText?: string; cancelText?: string; danger?: boolean }) => Promise<boolean>;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}

let nextId = 1;

interface ConfirmState {
  message: string;
  confirmText: string;
  cancelText: string;
  danger: boolean;
  resolve: (v: boolean) => void;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);

  const toast = useCallback((message: string, kind: ToastKind = 'info') => {
    const id = nextId++;
    setToasts(prev => [...prev, { id, kind, message }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3500);
  }, []);

  const confirm = useCallback((message: string, opts?: { confirmText?: string; cancelText?: string; danger?: boolean }) => {
    return new Promise<boolean>((resolve) => {
      setConfirmState({
        message,
        confirmText: opts?.confirmText ?? '확인',
        cancelText: opts?.cancelText ?? '취소',
        danger: !!opts?.danger,
        resolve,
      });
    });
  }, []);

  // Esc 닫기
  useEffect(() => {
    if (!confirmState) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        confirmState.resolve(false);
        setConfirmState(null);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [confirmState]);

  const handleConfirm = (result: boolean) => {
    confirmState?.resolve(result);
    setConfirmState(null);
  };

  return (
    <ToastContext.Provider value={{ toast, confirm }}>
      {children}

      {/* Toast 스택 — 모바일은 상단 중앙(햄버거 버튼 영역 회피), 데스크톱은 우상단 */}
      <div className="fixed top-3 left-3 right-3 sm:left-auto sm:top-4 sm:right-4 z-[1100] flex flex-col gap-2 pointer-events-none items-stretch sm:items-end">
        {toasts.map(t => (
          <div
            key={t.id}
            className={`pointer-events-auto px-4 py-3 rounded-lg shadow-lg text-sm font-medium animate-fadeIn w-full sm:w-auto sm:min-w-[240px] sm:max-w-md ${
              t.kind === 'success' ? 'bg-green-100 text-green-800 border border-green-200' :
              t.kind === 'error' ? 'bg-red-100 text-red-800 border border-red-200' :
              'bg-gray-900 text-white'
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>

      {/* Confirm 다이얼로그 */}
      {confirmState && (
        <div
          className="fixed inset-0 bg-black/50 z-[1050] flex items-center justify-center p-4"
          onClick={() => handleConfirm(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            role="alertdialog"
            className="bg-white rounded-2xl shadow-xl w-full max-w-sm animate-fadeIn"
          >
            <div className="px-6 py-5">
              <p className="text-base text-gray-900 whitespace-pre-line">{confirmState.message}</p>
            </div>
            <div className="px-4 pb-4 flex gap-2">
              <button
                type="button"
                onClick={() => handleConfirm(false)}
                className="flex-1 px-4 py-2.5 bg-white hover:bg-gray-50 border border-gray-300 rounded-lg font-medium text-gray-700"
              >
                {confirmState.cancelText}
              </button>
              <button
                type="button"
                autoFocus
                onClick={() => handleConfirm(true)}
                className={`flex-1 px-4 py-2.5 rounded-lg font-semibold text-white ${
                  confirmState.danger ? 'bg-red-500 hover:bg-red-600' : 'bg-primary hover:bg-primary-hover'
                }`}
              >
                {confirmState.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
    </ToastContext.Provider>
  );
}
