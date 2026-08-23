import React from 'react';

interface SkeletonProps {
  className?: string;
  variant?: 'default' | 'pulse' | 'wave';
}

export const Skeleton: React.FC<SkeletonProps> = ({
  className = '',
  variant = 'wave'
}) => {
  return (
    <div className={`relative overflow-hidden rounded-lg bg-gray-800/60 ${className}`}>
      {variant !== 'default' && (
        <div
          className={`absolute inset-0 ${
            variant === 'pulse'
              ? 'animate-pulse bg-gray-700/40'
              : '-translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-gray-600/30 to-transparent'
          }`}
        />
      )}
    </div>
  );
};

interface TextSkeletonProps {
  lines?: number;
  className?: string;
  variant?: 'default' | 'pulse' | 'wave';
}

export const TextSkeleton: React.FC<TextSkeletonProps> = ({ 
  lines = 3, 
  className = '',
  variant = 'wave'
}) => (
  <div className={`space-y-3 ${className}`}>
    {Array.from({ length: lines }).map((_, i) => (
      <Skeleton 
        key={i} 
        variant={variant}
        className={`h-4 ${i === lines - 1 ? 'w-2/3' : 'w-full'}`}
      />
    ))}
  </div>
);

interface CardSkeletonProps {
  lines?: number;
  className?: string;
  variant?: 'default' | 'pulse' | 'wave';
  showAvatar?: boolean;
  showImage?: boolean;
}

export const CardSkeleton: React.FC<CardSkeletonProps> = ({ 
  lines = 4, 
  className = '',
  variant = 'wave',
  showAvatar = false,
  showImage = false
}) => (
  <div className={`p-6 border border-gray-200/60 dark:border-gray-700/50 rounded-2xl bg-white/80 dark:bg-gray-900/80 shadow-lg hover:shadow-xl transition-shadow duration-300 ${className}`}>
    {/* Header with optional avatar */}
    <div className="flex items-center gap-3 mb-4">
      {showAvatar && (
        <Skeleton variant={variant} className="h-10 w-10 rounded-full flex-shrink-0" />
      )}
      <div className="flex-1">
        <Skeleton variant={variant} className="h-6 w-2/5 mb-2" />
        <Skeleton variant={variant} className="h-3 w-1/4" />
      </div>
    </div>

    {/* Optional image */}
    {showImage && (
      <Skeleton variant={variant} className="h-48 w-full mb-4 rounded-xl" />
    )}

    {/* Content lines */}
    <TextSkeleton lines={lines} variant={variant} />
  </div>
);

interface ListSkeletonProps {
  items?: number;
  className?: string;
  variant?: 'default' | 'pulse' | 'wave';
}

export const ListSkeleton: React.FC<ListSkeletonProps> = ({
  items = 5,
  className = '',
  variant = 'wave'
}) => (
  <div className={`space-y-4 ${className}`}>
    {Array.from({ length: items }).map((_, i) => (
      <div key={i} className="flex items-center gap-4">
        <Skeleton variant={variant} className="h-12 w-12 rounded-lg flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton variant={variant} className="h-4 w-3/4" />
          <Skeleton variant={variant} className="h-3 w-1/2" />
        </div>
      </div>
    ))}
  </div>
);

interface TableSkeletonProps {
  rows?: number;
  columns?: number;
  className?: string;
  variant?: 'default' | 'pulse' | 'wave';
}

export const TableSkeleton: React.FC<TableSkeletonProps> = ({
  rows = 5,
  columns = 4,
  className = '',
  variant = 'wave'
}) => (
  <div className={`w-full ${className}`}>
    {/* Header */}
    <div className="grid gap-4 mb-4 p-4 bg-gray-50/50 dark:bg-gray-800/30 rounded-t-xl" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
      {Array.from({ length: columns }).map((_, i) => (
        <Skeleton key={i} variant={variant} className="h-5" />
      ))}
    </div>
    {/* Rows */}
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="grid gap-4 p-4" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
          {Array.from({ length: columns }).map((_, colIndex) => (
            <Skeleton key={colIndex} variant={variant} className="h-4" />
          ))}
        </div>
      ))}
    </div>
  </div>
);

// Tailwind config additions needed for animations:
/*
Add to your tailwind.config.js:

module.exports = {
  theme: {
    extend: {
      animation: {
        'shimmer': 'shimmer 2s infinite',
        'shimmer-wave': 'shimmer-wave 2.5s ease-in-out infinite',
      },
      keyframes: {
        shimmer: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        },
        'shimmer-wave': {
          '0%': { backgroundPosition: '200% 0' },
          '100%': { backgroundPosition: '-200% 0' },
        },
      },
    },
  },
}
*/