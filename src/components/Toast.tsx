import React from 'react';
import { ToastMessage } from '../types';
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react';

interface ToastProps {
  toasts: ToastMessage[];
  onClose: (id: string) => void;
}

export const ToastContainer: React.FC<ToastProps> = ({ toasts, onClose }) => {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-5 right-5 z-[99999] flex flex-col gap-2.5 max-w-sm w-full pointer-events-none px-4 sm:px-0">
      {toasts.map((toast) => {
        const icons = {
          success: <CheckCircle2 className="w-5 h-5 shrink-0 text-white" />,
          warning: <AlertTriangle className="w-5 h-5 shrink-0 text-white" />,
          error: <XCircle className="w-5 h-5 shrink-0 text-white" />,
          info: <Info className="w-5 h-5 shrink-0 text-white" />,
        };

        const bgStyles = {
          success: 'bg-gradient-to-r from-emerald-600 to-emerald-700 text-white border-l-4 border-emerald-900',
          warning: 'bg-gradient-to-r from-amber-600 to-amber-700 text-white border-l-4 border-amber-900',
          error: 'bg-gradient-to-r from-red-600 to-red-700 text-white border-l-4 border-red-900',
          info: 'bg-gradient-to-r from-blue-600 to-blue-700 text-white border-l-4 border-blue-900',
        };

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto rounded-xl p-4 shadow-2xl flex items-center gap-3 transition-all duration-300 animate-in fade-in slide-in-from-top-2 ${bgStyles[toast.type]}`}
          >
            {icons[toast.type]}
            <span className="flex-1 text-sm font-medium leading-snug">{toast.text}</span>
            <button
              onClick={() => onClose(toast.id)}
              className="text-white/80 hover:text-white transition-colors p-1 rounded-md"
              aria-label="Fechar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
