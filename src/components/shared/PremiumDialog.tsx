import { useEffect, ReactNode } from 'react';
import { AlertTriangle, Info, X } from 'lucide-react';

interface PremiumDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm?: () => void;
  title: string;
  subtitle?: string;
  message?: string;
  children?: ReactNode;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'warning' | 'info';
  infoText?: string;
  isLoading?: boolean;
  maxWidth?: string;
  hideIcon?: boolean;
}

export function PremiumDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  subtitle,
  message,
  children,
  confirmText = 'Confirm',
  cancelText,
  infoText,
  isLoading = false,
  maxWidth = 'max-w-md',
  hideIcon = false
}: PremiumDialogProps) {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'Enter' && !isLoading && onConfirm) {
        onConfirm();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, onConfirm, isLoading]);

  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-[9999] flex items-center justify-center p-4 fade-in-animate"
        onClick={onClose}
      >
        {/* Enhanced Backdrop with Multiple Blur Layers */}
        {/* <div className="absolute inset-0 bg-gradient-to-br from-black/80 via-emerald-950/50 to-black/80" /> */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-teal-900/20 via-transparent to-transparent" />

        {/* Animated Background Orbs */}
        {/* <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-500/30 rounded-full blur-3xl animate-pulse-slow" /> */}
        {/* <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl animate-pulse-slower" /> */}

        <div
          className={`relative bg-white/[0.03] border border-white/[0.08] rounded-3xl ${maxWidth} w-full overflow-hidden shadow-2xl shadow-purple-900/30 slide-up-animate`}
          onClick={(e) => e.stopPropagation()}
          role="alertdialog"
          aria-labelledby="dialog-title"
          aria-describedby="dialog-desc"
        >
          {/* Glassmorphic Border Glow */}
          <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-purple-500/10 via-blue-500/5 to-pink-500/10 opacity-60 pointer-events-none" />
          <div className="absolute inset-[1px] rounded-3xl bg-gradient-to-br from-gray-900/95 via-gray-900/90 to-gray-900/95" />

          {/* Close Button */}
          <button
            onClick={onClose}
            disabled={isLoading}
            className="absolute top-6 right-6 z-10 w-10 h-10 flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-gray-400 hover:text-gray-200 transition-[color,background-color,border-color,transform] duration-300 group disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5 group-hover:rotate-90 transition-transform duration-300" />
          </button>

          {/* Header */}
          <div className="relative px-8 pt-8 pb-6">
            {/* Glowing Icon Container */}
            {!hideIcon && (
              <div className="relative w-16 h-16 mb-5">
                {/* Glow effect */}
                <div className="absolute inset-0 bg-gradient-to-br from-red-500/30 to-red-600/30 rounded-2xl blur-xl animate-pulse-glow" />
                {/* Icon container */}
                <div className="relative w-full h-full bg-gradient-to-br from-red-500/20 to-red-600/10 border border-red-500/30 rounded-2xl flex items-center justify-center shadow-lg shadow-red-500/20">
                  <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent rounded-2xl" />
                  <AlertTriangle className="w-7 h-7 text-red-400 relative z-10 drop-shadow-[0_0_8px_rgba(239,68,68,0.5)]" />
                </div>
              </div>
            )}

            <h2 id="dialog-title" className="text-2xl font-bold bg-gradient-to-br from-white via-gray-100 to-gray-300 bg-clip-text text-transparent mb-2.5 tracking-tight leading-tight">
              {title}
            </h2>
            {subtitle && (
              <p className="text-sm text-gray-400/90 tracking-wide font-medium leading-relaxed">
                {subtitle}
              </p>
            )}
          </div>

          {/* Body */}
          <div className="relative px-8 pb-8">
            {message && (
              <p id="dialog-desc" className="text-[15px] leading-relaxed text-gray-300/80 mb-6 font-light">
                {message}
              </p>
            )}

            {children}

            {/* Premium Info Callout */}
            {infoText && (
              <div className="relative mb-6 group">
                {/* Glow effect */}
                <div className="absolute inset-0 bg-gradient-to-r from-purple-500/20 to-blue-500/20 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                {/* Card */}
                <div className="relative bg-gradient-to-br from-purple-500/10 to-blue-500/5 border border-purple-400/20 rounded-2xl p-5 flex items-start gap-4 overflow-hidden">
                  {/* Shine effect */}
                  <div className="absolute inset-0 bg-gradient-to-br from-white/[0.03] via-transparent to-transparent" />

                  <div className="relative w-10 h-10 flex-shrink-0 bg-purple-500/15 border border-purple-400/30 rounded-xl flex items-center justify-center">
                    <Info className="w-5 h-5 text-purple-300 drop-shadow-[0_0_6px_rgba(168,85,247,0.4)]" />
                  </div>

                  <p className="relative text-[13.5px] leading-relaxed text-gray-300/90 font-light pt-1.5">
                    {infoText}
                  </p>
                </div>
              </div>
            )}

            {/* Premium Action Buttons */}
            {(onConfirm || cancelText) && (
              <div className="flex gap-3 mt-6">
                {/* Cancel Button */}
                <button
                  onClick={onClose}
                  disabled={isLoading}
                  className="flex-1 relative px-6 py-4 rounded-2xl font-semibold text-[15px] transition-colors duration-300 disabled:opacity-50 disabled:cursor-not-allowed group overflow-hidden"
                >
                  {/* Background layers */}
                  <div className="absolute inset-0 bg-white/[0.04] group-hover:bg-white/[0.08] transition-[color,background-color,border-color,opacity] duration-300" />
                  <div className="absolute inset-0 border border-white/10 group-hover:border-purple-400/30 rounded-2xl transition-[color,background-color,border-color,opacity] duration-300" />
                  <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                  {/* Content */}
                  <span className="relative z-10 text-gray-300 group-hover:text-white transition-colors duration-300">
                    {cancelText}
                  </span>
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-mono text-gray-500/60 group-hover:text-gray-400 opacity-60 group-hover:opacity-100 transition-[color,background-color,border-color,opacity] duration-300">
                    Esc
                  </span>
                </button>

                {/* Confirm Button */}
                {onConfirm && (
                  <button
                    onClick={onConfirm}
                    disabled={isLoading}
                    className="flex-1 relative px-6 py-4 rounded-2xl font-semibold text-[15px] transition-[transform,opacity] duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 group overflow-hidden hover:-translate-y-0.5"
                  >
                    {/* Animated gradient background */}
                    <div className="absolute inset-0 bg-gradient-to-br from-red-500 via-red-600 to-red-700 opacity-100 group-hover:opacity-0 transition-opacity duration-300" />
                    <div className="absolute inset-0 bg-gradient-to-br from-red-600 via-red-700 to-red-800 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                    {/* Shine effect */}
                    <div className="absolute inset-0 bg-gradient-to-br from-white/20 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                    {/* Glow */}
                    <div className="absolute inset-0 shadow-lg shadow-red-500/40 group-hover:shadow-red-500/60 rounded-2xl transition-shadow duration-300" />

                    {isLoading ? (
                      <span className="relative z-10 flex items-center justify-center gap-2.5 text-white">
                        <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span className="font-medium">Processing...</span>
                      </span>
                    ) : (
                      <>
                        <span className="relative z-10 text-white font-medium tracking-wide">
                          {confirmText}
                        </span>
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-mono text-white/60 opacity-60 group-hover:opacity-100 transition-opacity duration-300">
                          ⏎
                        </span>
                      </>
                    )}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Bottom gradient accent */}
          <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-purple-500/30 to-transparent" />
        </div>
      </div>

      {/* Enhanced CSS Animations */}
      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(40px) scale(0.94);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @keyframes pulse-slow {
          0%, 100% {
            opacity: 0.3;
            transform: scale(1);
          }
          50% {
            opacity: 0.5;
            transform: scale(1.05);
          }
        }

        @keyframes pulse-slower {
          0%, 100% {
            opacity: 0.2;
            transform: scale(1);
          }
          50% {
            opacity: 0.4;
            transform: scale(1.08);
          }
        }

        @keyframes pulse-glow {
          0%, 100% {
            opacity: 0.5;
            transform: scale(0.95);
          }
          50% {
            opacity: 0.8;
            transform: scale(1.05);
          }
        }

        .fade-in-animate {
          animation: fadeIn 0.3s ease-out forwards;
        }

        .slide-up-animate {
          animation: slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        .animate-pulse-slow {
          animation: pulse-slow 4s ease-in-out infinite;
        }

        .animate-pulse-slower {
          animation: pulse-slower 6s ease-in-out infinite;
        }

        .animate-pulse-glow {
          animation: pulse-glow 2s ease-in-out infinite;
        }
      `}</style>
    </>
  );
}