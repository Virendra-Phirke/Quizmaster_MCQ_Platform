import React, { useState, useEffect, useCallback, useContext, createContext } from 'react';
import { CheckCircle, XCircle, AlertCircle, Info, X } from 'lucide-react';

export interface ToastProps {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  duration?: number;
  onClose: (id: string) => void;
}

const Toast: React.FC<ToastProps> = ({
  id,
  type,
  title,
  message,
  duration = 5000,
  onClose
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    // Entrance animation
    requestAnimationFrame(() => setIsVisible(true));

    // Progress bar animation
    const startTime = Date.now();
    const progressInterval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, 100 - (elapsed / duration) * 100);
      setProgress(remaining);
    }, 16);

    // Exit animation
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(() => onClose(id), 400);
    }, duration);

    return () => {
      clearTimeout(timer);
      clearInterval(progressInterval);
    };
  }, [id, duration, onClose]);

  const configs = {
    success: {
      icon: CheckCircle,
      gradient: 'from-emerald-500/20 to-emerald-600/20',
      border: 'border-emerald-500/30',
      iconColor: 'text-emerald-400',
      iconBg: 'bg-emerald-500/10',
      progressBar: 'bg-emerald-500',
      glow: 'shadow-emerald-500/20'
    },
    error: {
      icon: XCircle,
      gradient: 'from-red-500/20 to-red-600/20',
      border: 'border-red-500/30',
      iconColor: 'text-red-400',
      iconBg: 'bg-red-500/10',
      progressBar: 'bg-red-500',
      glow: 'shadow-red-500/20'
    },
    warning: {
      icon: AlertCircle,
      gradient: 'from-amber-500/20 to-amber-600/20',
      border: 'border-amber-500/30',
      iconColor: 'text-amber-400',
      iconBg: 'bg-amber-500/10',
      progressBar: 'bg-amber-500',
      glow: 'shadow-amber-500/20'
    },
    info: {
      icon: Info,
      gradient: 'from-blue-500/20 to-blue-600/20',
      border: 'border-blue-500/30',
      iconColor: 'text-blue-400',
      iconBg: 'bg-blue-500/10',
      progressBar: 'bg-blue-500',
      glow: 'shadow-blue-500/20'
    }
  };

  const config = configs[type];
  const Icon = config.icon;

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(() => onClose(id), 400);
  };

  return (
    <div
      className={`
        relative w-full overflow-hidden
        transform transition-all duration-400 ease-out
        ${isVisible ? 'translate-x-0 opacity-100 scale-100' : 'translate-x-full opacity-0 scale-95'}
      `}
    >
      {/* Main Container */}
      <div className={`
        relative rounded-xl border
        bg-gradient-to-br ${config.gradient}
        ${config.border} ${config.glow}
        shadow-2xl
        bg-slate-900/95
        transition-all duration-300 hover:shadow-3xl hover:scale-[1.02]
      `}>
        {/* Glass morphism overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent rounded-xl" />

        {/* Content */}
        <div className="relative p-4">
          <div className="flex items-start gap-3">
            {/* Icon Container */}
            <div className={`
              flex-shrink-0 rounded-lg p-2
              ${config.iconBg}
              ring-1 ring-white/10
            `}>
              <Icon className={`h-5 w-5 ${config.iconColor}`} />
            </div>

            {/* Text Content */}
            <div className="flex-1 min-w-0 pt-0.5">
              <h4 className="font-semibold text-slate-100 text-sm leading-tight">
                {title}
              </h4>
              {message && (
                <p className="mt-1.5 text-sm text-slate-400 leading-relaxed">
                  {message}
                </p>
              )}
            </div>

            {/* Close Button */}
            <button
              onClick={handleClose}
              className={`
                flex-shrink-0 rounded-lg p-1.5 -mr-1 -mt-1
                text-slate-400 hover:text-slate-200
                hover:bg-white/5
                transition-all duration-200
                focus:outline-none focus:ring-2 focus:ring-white/20
              `}
              aria-label="Close notification"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-slate-800/50 overflow-hidden">
          <div
            className={`h-full ${config.progressBar} transition-all duration-100 ease-linear shadow-lg`}
            style={{
              width: `${progress}%`,
              boxShadow: `0 0 10px currentColor`
            }}
          />
        </div>
      </div>
    </div>
  );
};

// Context Definition
type ToastContextType = {
  addToast: (toast: Omit<ToastProps, 'id' | 'onClose'>) => string;
  removeToast: (id: string) => void;
  // Legacy compatibility for refactoring
  ToastContainer: () => JSX.Element | null;
};

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastProps[]>([]);
  // We use a ref for timeouts to avoid re-renders or closures issues, 
  // but logic is inside Toast component now? 
  // Wait, the original code had logic in Toast AND useToast?
  // Original `useToast` set a timeout to call `removeToast`.
  // Original `Toast` also bad exit animation logic.
  // The `Toast` component handles the timer in the code above (useEffect).
  // So we don't need global timeouts in the provider, just a way to remove the toast from state.

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, []);

  const addToast = useCallback((toast: Omit<ToastProps, 'id' | 'onClose'>) => {
    const id = Math.random().toString(36).substr(2, 9);

    // Optional: Dedup logic here if needed

    const newToast = { ...toast, id, onClose: removeToast };
    setToasts(prev => [...prev, newToast as ToastProps]);
    return id;
  }, [removeToast]);

  const value = React.useMemo(() => ({
    addToast,
    removeToast,
    ToastContainer: () => null // No-op component for backward compatibility during refactor
  }), [addToast, removeToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* Global Toast Container */}
      <div className="fixed top-4 right-4 z-[9999] space-y-3 pointer-events-none max-w-sm w-full">
        <div className="space-y-3">
          {toasts.map(toast => (
            <div key={toast.id} className="pointer-events-auto">
              <Toast {...toast} />
            </div>
          ))}
        </div>
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};