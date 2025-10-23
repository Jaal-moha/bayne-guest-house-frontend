import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

type Toast = { id: number; type?: 'success' | 'error' | 'info'; message: string; };

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
            <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end space-y-2">
                {toasts.map((t) => (
                    <div key={t.id} className={`max-w-sm rounded-md px-4 py-2 shadow-lg border ${t.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : t.type === 'error' ? 'bg-red-50 border-red-200 text-red-800' : 'bg-white border-gray-200 text-gray-900'}`}>
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
