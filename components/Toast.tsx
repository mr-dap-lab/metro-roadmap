import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from 'lucide-react';
import { ID } from '../types';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType, duration?: number) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

interface ToastItemProps {
  toast: Toast;
  onClose: (id: string) => void;
}

const ToastItem: React.FC<ToastItemProps> = ({ toast, onClose }) => {
  const { id, message, type, duration = 4000 } = toast;

  // Resolve styles, icons, colors dynamically
  const config = useMemo(() => {
    switch (type) {
      case 'success':
        return {
          bg: 'bg-white/95 backdrop-blur-md border-emerald-150 shadow-emerald-50/40',
          border: 'border-emerald-100',
          text: 'text-slate-800',
          iconColor: 'text-emerald-500 bg-emerald-50 border-emerald-100/50',
          icon: <CheckCircle2 className="w-4 h-4 shrink-0" />,
          progressBg: 'bg-emerald-500'
        };
      case 'error':
        return {
          bg: 'bg-white/95 backdrop-blur-md border-rose-150 shadow-rose-50/40',
          border: 'border-rose-100',
          text: 'text-slate-800',
          iconColor: 'text-rose-500 bg-rose-50 border-rose-100/50',
          icon: <AlertCircle className="w-4 h-4 shrink-0" />,
          progressBg: 'bg-rose-500'
        };
      case 'warning':
        return {
          bg: 'bg-white/95 backdrop-blur-md border-amber-150 shadow-amber-50/40',
          border: 'border-amber-100',
          text: 'text-slate-800',
          iconColor: 'text-amber-500 bg-amber-50 border-amber-100/50',
          icon: <AlertTriangle className="w-4 h-4 shrink-0" />,
          progressBg: 'bg-amber-500'
        };
      case 'info':
      default:
        return {
          bg: 'bg-white/95 backdrop-blur-md border-indigo-150 shadow-indigo-50/40',
          border: 'border-indigo-100',
          text: 'text-slate-800',
          iconColor: 'text-indigo-500 bg-indigo-50 border-indigo-100/50',
          icon: <Info className="w-4 h-4 shrink-0" />,
          progressBg: 'bg-indigo-500'
        };
    }
  }, [type]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -15, scale: 0.92, transition: { duration: 0.2 } }}
      transition={{ type: 'spring', stiffness: 350, damping: 28 }}
      className={`w-[340px] max-w-full ${config.bg} ${config.border} border rounded-2xl shadow-xl flex flex-col overflow-hidden pointer-events-auto select-none`}
      id={`toast-card-${id}`}
    >
      <div className="p-4 flex items-start gap-3">
        <div className={`${config.iconColor} p-2 rounded-xl border shrink-0 flex items-center justify-center`}>
          {config.icon}
        </div>
        <div className="flex-1 min-w-0 pt-1">
          <p className={`${config.text} text-xs font-bold leading-snug text-slate-800 tracking-tight`}>
            {message}
          </p>
        </div>
        <button
          onClick={() => onClose(id)}
          className="text-slate-400 hover:text-slate-600 active:bg-slate-100 transition-all rounded-lg p-1 hover:bg-slate-50 mt-0.5 shrink-0"
          id={`toast-close-${id}`}
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Dynamic Progress indicator bar */}
      {duration > 0 && (
        <div className="h-1 bg-slate-50 w-full overflow-hidden shrink-0 mt-auto">
          <motion.div
            initial={{ width: '100%' }}
            animate={{ width: '0%' }}
            transition={{ duration: duration / 1000, ease: 'linear' }}
            className={`h-full ${config.progressBg}`}
          />
        </div>
      )}
    </motion.div>
  );
};

interface ToastContainerProps {
  toasts: Toast[];
  removeToast: (id: string) => void;
}

const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, removeToast }) => {
  return (
    <div className="fixed bottom-6 right-6 z-[99999] flex flex-col gap-3 max-w-full pointer-events-none" id="global-toast-container">
      <AnimatePresence mode="popLayout" initial={false}>
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onClose={removeToast} />
        ))}
      </AnimatePresence>
    </div>
  );
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback((message: string, type: ToastType = 'info', duration: number = 4000) => {
    const id = Date.now().toString(36) + Math.random().toString(36).substring(2, 5);
    const newToast: Toast = { id, message, type, duration };
    setToasts((prev) => [...prev, newToast]);

    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }
  }, [removeToast]);

  const value = useMemo(() => ({ showToast, removeToast }), [showToast, removeToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </ToastContext.Provider>
  );
};
