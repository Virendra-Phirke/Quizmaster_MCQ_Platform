import React from 'react';
import { RefreshCw, Copy, CheckCircle, Home } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorInfo?: React.ErrorInfo;
  copied: boolean;
}

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, copied: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error, copied: false };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
    this.setState({ errorInfo });
  }

  copySessionId = () => {
    const sessionId = this.generateSessionId();
    navigator.clipboard.writeText(sessionId);
    this.setState({ copied: true });
    setTimeout(() => this.setState({ copied: false }), 2000);
  };

  generateSessionId = () => {
    // Generate a deterministic-looking session ID from the error
    const hash = this.state.error?.message
      ? Array.from(this.state.error.message)
        .reduce((acc, char) => acc + char.charCodeAt(0), 0)
        .toString(16)
        .padStart(8, '0')
      : Math.random().toString(16).slice(2, 10);
    return `${hash.slice(0, 4)}-${hash.slice(4, 8)}-${Math.random().toString(16).slice(2, 6)}`;
  };

  render() {
    if (this.state.hasError) {
      const sessionId = this.generateSessionId();
      const statusCode = '500 Internal Error';

      return (
        <>
          <style>{`
            @keyframes pulse-slow {
              0%, 100% { opacity: 0.3; transform: scale(1); }
              50% { opacity: 0.6; transform: scale(1.05); }
            }
            @keyframes float-in {
              from { opacity: 0; transform: translateY(24px); }
              to   { opacity: 1; transform: translateY(0); }
            }
            @keyframes badge-in {
              from { opacity: 0; transform: translateY(-12px) scale(0.9); }
              to   { opacity: 1; transform: translateY(0) scale(1); }
            }
            @keyframes shimmer-line {
              0%   { background-position: -200% center; }
              100% { background-position: 200% center; }
            }
            @keyframes spin-slow {
              from { transform: rotate(0deg); }
              to   { transform: rotate(360deg); }
            }
            .anim-badge    { animation: badge-in  0.4s cubic-bezier(0.34,1.56,0.64,1) both; }
            .anim-heading  { animation: float-in  0.5s ease both 0.15s; }
            .anim-sub      { animation: float-in  0.5s ease both 0.25s; }
            .anim-card     { animation: float-in  0.5s ease both 0.35s; }
            .anim-btns     { animation: float-in  0.5s ease both 0.45s; }
            .glow-blob     { animation: pulse-slow 4s ease-in-out infinite; }
            .glow-blob-2   { animation: pulse-slow 4s ease-in-out infinite 2s; }
            .shimmer-btn {
              background-size: 200% auto;
              animation: shimmer-line 2.5s linear infinite;
            }
            .spin-on-hover:hover svg {
              animation: spin-slow 0.6s linear 1;
            }
          `}</style>

          <div className="relative min-h-screen bg-[#0d1117] flex flex-col items-center justify-center px-4 py-12 overflow-hidden">

            {/* Background blobs */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
              <div className="glow-blob absolute -top-1/4 -left-1/4 w-1/2 h-1/2 rounded-full bg-amber-500/5 blur-[120px]" />
              <div className="glow-blob-2 absolute -bottom-1/4 -right-1/4 w-1/2 h-1/2 rounded-full bg-orange-600/5 blur-[120px]" />
              {/* Subtle grid */}
              <div className="absolute inset-0 opacity-[0.03]"
                style={{
                  backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)',
                  backgroundSize: '48px 48px'
                }}
              />
            </div>

            {/* SYSTEM ALERT badge */}
            <div className="anim-badge relative z-10 mb-6 sm:mb-8">
              <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-900/40 border border-amber-600/40 text-amber-400 text-[10px] sm:text-xs font-bold tracking-[0.2em] uppercase">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                System Alert
              </span>
            </div>

            {/* Main heading */}
            <div className="anim-heading relative z-10 text-center mb-4 sm:mb-6 px-2">
              <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold tracking-tight leading-[1.1]">
                <span
                  className="shimmer-btn"
                  style={{
                    background: 'linear-gradient(90deg, #f97316, #fb923c, #fbbf24, #f97316)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',

                  }}
                >
                  Oops!
                </span>

              </h1>
              <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold tracking-tight leading-[1.1] mt-4">
                <span className="text-slate-100"> Something didn’t go as planned. </span>
                <br />
              </h1>

            </div>

            {/* Subtitle */}
            <p className="anim-sub relative z-10 text-center text-slate-400 text-sm sm:text-base max-w-md sm:max-w-lg px-4 leading-relaxed mb-8 sm:mb-10">
              Try refreshing the page or return to the dashboard.
            </p>

            {/* Error details card */}
            <div className="anim-card relative z-10 w-full max-w-xl sm:max-w-2xl px-0 sm:px-4">
              <div className="bg-[#161b22] border border-slate-700/60 rounded-2xl overflow-hidden shadow-2xl">
                {/* Card header */}
                <div className="px-5 sm:px-6 pt-5 pb-4 border-b border-slate-700/50">
                  <span className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-[0.18em]">
                    Error Details
                  </span>
                </div>

                {/* Status code + Session ID row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-slate-700/40">
                  {/* Status Code */}
                  <div className="bg-[#161b22] px-5 sm:px-6 py-5">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.18em] mb-2">
                      Status Code
                    </p>
                    <p className="font-mono text-base sm:text-lg font-semibold text-red-400">
                      {statusCode}
                    </p>
                  </div>

                  {/* Session ID */}
                  <div className="bg-[#161b22] px-5 sm:px-6 py-5">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.18em] mb-2">
                      Session ID
                    </p>
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-mono text-base sm:text-lg font-semibold text-slate-200 truncate">
                        {sessionId}
                      </p>
                      <button
                        onClick={this.copySessionId}
                        className="shrink-0 p-1.5 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-slate-700/60 transition-all duration-200"
                        title="Copy session ID"
                      >
                        {this.state.copied
                          ? <CheckCircle className="w-4 h-4 text-green-400" />
                          : <Copy className="w-4 h-4" />
                        }
                      </button>
                    </div>
                  </div>
                </div>

              </div>
            </div>

            {/* Action buttons */}
            <div className="anim-btns relative z-10 flex flex-col sm:flex-row gap-3 mt-8 sm:mt-10 w-full max-w-xl sm:max-w-2xl px-0 sm:px-4">
              {/* Try Again — amber glow */}
              <button
                onClick={() => window.location.reload()}
                className="spin-on-hover group flex-1 flex items-center justify-center gap-2.5 px-6 py-4 rounded-2xl font-bold text-sm sm:text-base transition-all duration-200 active:scale-[0.97] shadow-lg shadow-slate-500/20 text-slate-200 hover:text-white bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 hover:border-slate-500"
              >
                <RefreshCw className="w-4 h-4 transition-transform duration-300 group-hover:rotate-180" />
                Try Again
              </button>

              {/* Go Home — dark */}
              <button
                onClick={() => (window.location.href = '/')}
                className="group flex-1 flex items-center justify-center gap-2.5 px-6 py-4 rounded-2xl font-bold text-sm sm:text-base text-slate-200 hover:text-white bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 hover:border-slate-500 transition-all duration-200 active:scale-[0.97]"
              >
                <Home className="w-4 h-4" />
                Go Home
              </button>
            </div>

            {/* Footer note */}
            <p className="relative z-10 mt-8 text-xs text-slate-600 text-center">
              If the issue persists, please{' '}
              <button
                onClick={() => (window.location.href = '/')}
                className="text-slate-500 hover:text-amber-400 underline underline-offset-2 transition-colors duration-200"
              >
                contact support
              </button>
            </p>
          </div>
        </>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;