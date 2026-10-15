import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

type Toast = { id: number; type?: 'success' | 'error' | 'info'; message: string; };

const TONE = {
    success: 'border-accent/25 bg-accent-tint text-accent',
    error: 'border-danger-line bg-danger-tint text-danger',
    info: 'border-line bg-surface text-ink',
} as const;

type ToastContextValue = { push: (msg: string, type?: Toast['type']) => void; };

const ToastCtx = createContext<ToastContextValue | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode; }) {
    const [toasts, setToasts] = useState<Toast[]>([]);
    const push = useCallback((message: string, type: Toast['type'] = 'info') => {
        const id = Date.now() + Math.floor(Math.random() * 1000);
        setToasts((t) => [...t, { id, type, message }]);
    }, []);

    useEffect(() => {
        if (!toasts.length) return;
        const timers = toasts.map((toast) =>
            window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== toast.id)), 4000)
        );
        return () => { timers.forEach((id) => clearTimeout(id)); };
    }, [toasts]);

    const value = useMemo(() => ({ push }), [push]);

    return (
        <ToastCtx.Provider value={value}>
            {children}
            <div className="fixed bottom-4 left-4 right-4 z-50 flex flex-col items-end space-y-2 sm:bottom-6 sm:left-auto sm:right-6">
                {toasts.map((t) => (
                    <div key={t.id} className={`max-w-full rounded-input border px-4 py-3 text-sm font-medium shadow-panel sm:max-w-sm ${TONE[t.type ?? 'info']}`}>
                        {t.message}
                    </div>
                ))}
            </div>
        </ToastCtx.Provider>
    );
}

export function useToast() {
    const ctx = useContext(ToastCtx);
    if (!ctx) throw new Error('useToast must be used within ToastProvider');
    return ctx;
}

export default ToastProvider;
