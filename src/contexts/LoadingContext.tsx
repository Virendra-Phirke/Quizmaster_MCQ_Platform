import React, { createContext, useState, useCallback, useMemo } from 'react';

interface PendingEntry { key: string; startedAt: number; }

interface LoadingContextType {
  pending: Record<string, PendingEntry>;
  isLoading: (key?: string) => boolean;
  start: (key: string) => void;
  stop: (key: string) => void;
  wrap: <T>(key: string, fn: () => Promise<T>) => Promise<T>;
}

const LoadingContext = createContext<LoadingContextType | undefined>(undefined);

export const LoadingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [pending, setPending] = useState<Record<string, PendingEntry>>({});

  const start = useCallback((key: string) => {
    setPending(p => ({ ...p, [key]: { key, startedAt: Date.now() } }));
  }, []);

  const stop = useCallback((key: string) => {
    setPending(p => {
      const copy = { ...p };
      delete copy[key];
      return copy;
    });
  }, []);

  const isLoading = useCallback((key?: string) => {
    if (key) return !!pending[key];
    return Object.keys(pending).length > 0;
  }, [pending]);

  const wrap = useCallback(async <T,>(key: string, fn: () => Promise<T>) => {
    start(key);
    try {
      return await fn();
    } finally {
      stop(key);
    }
  }, [start, stop]);

  const value = useMemo<LoadingContextType>(() => ({
    pending, isLoading, start, stop, wrap
  }), [pending, isLoading, start, stop, wrap]);

  return <LoadingContext.Provider value={value}>{children}</LoadingContext.Provider>;
};

export default LoadingContext;
