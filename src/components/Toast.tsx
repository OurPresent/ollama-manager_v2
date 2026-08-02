import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, XCircle, Info } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info';

interface ToastMessage {
  id: number;
  type: ToastType;
  title: string;
  description?: string;
}

interface ToastContextValue {
  showToast: (type: ToastType, title: string, description?: string) => void;
}

const ToastContext = createContext<ToastContextValue>({ showToast: () => {} });

export const useToast = () => useContext(ToastContext);

const STYLES: Record<ToastType, { box: string; icon: React.ReactNode; title: string }> = {
  success: {
    box: 'border-emerald-500/40 bg-emerald-50 dark:bg-emerald-500/10',
    icon: <CheckCircle2 className="w-5 h-5 text-emerald-500 dark:text-emerald-400" />,
    title: 'text-emerald-800 dark:text-emerald-200',
  },
  error: {
    box: 'border-rose-500/40 bg-rose-50 dark:bg-rose-500/10',
    icon: <XCircle className="w-5 h-5 text-rose-500 dark:text-rose-400" />,
    title: 'text-rose-800 dark:text-rose-200',
  },
  info: {
    box: 'border-sky-500/40 bg-sky-50 dark:bg-sky-500/10',
    icon: <Info className="w-5 h-5 text-sky-500 dark:text-sky-400" />,
    title: 'text-sky-800 dark:text-sky-200',
  },
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback((type: ToastType, title: string, description?: string) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev.slice(-3), { id, type, title, description }]);
    setTimeout(() => dismiss(id), 4500);
  }, [dismiss]);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 w-80 max-w-[calc(100vw-2rem)]">
        {toasts.map((t) => {
          const style = STYLES[t.type];
          return (
            <div
              key={t.id}
              className={`flex items-start gap-3 border rounded-lg px-4 py-3 shadow-lg backdrop-blur animate-slide-in ${style.box}`}
            >
              {style.icon}
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-mono font-bold ${style.title}`}>{t.title}</p>
                {t.description && (
                  <p className="text-xs font-mono text-zinc-600 dark:text-zinc-300 mt-0.5 break-words">
                    {t.description}
                  </p>
                )}
              </div>
              <button
                onClick={() => dismiss(t.id)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-lg leading-none"
              >
                ×
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};
