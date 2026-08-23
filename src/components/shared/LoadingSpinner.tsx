import { memo } from 'react';

const LoadingSpinner = memo(() => {
  return (
    <div
      role="status"
      aria-label="Loading"
      className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-[#0f0f12]/40 pointer-events-none"
    >
      <div className="relative">
        {/* Outer glow */}
        <div className="absolute inset-0 bg-blue-500/20 rounded-full blur-xl animate-pulse"></div>
        {/* Spinner */}
        <div className="w-12 h-12 border-4 border-slate-700/50 border-t-teal-500 rounded-full animate-spin relative z-10"></div>
      </div>
      <p className="mt-4 text-slate-400 font-medium animate-pulse">Loading...</p>
      <span className="sr-only">Loading</span>
    </div>
  );
});

LoadingSpinner.displayName = 'LoadingSpinner';

export default LoadingSpinner;