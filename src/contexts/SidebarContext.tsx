import { createContext, useContext, useState, useCallback, useEffect, useMemo, ReactNode } from 'react';

interface SidebarContextType {
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;
  minimizeSidebar: () => void;
  expandSidebar: () => void;
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [sidebarCollapsed, _setSidebarCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('teacherSidebarCollapsed') === 'true';
    } catch {
      return false;
    }
  });

  // Persist every change to localStorage
  const setSidebarCollapsed = useCallback((collapsed: boolean) => {
    _setSidebarCollapsed(collapsed);
    try {
      localStorage.setItem('teacherSidebarCollapsed', String(collapsed));
    } catch { /* ignore */ }
  }, []);

  // Sync on initial load in case localStorage was updated elsewhere
  useEffect(() => {
    const stored = localStorage.getItem('teacherSidebarCollapsed');
    if (stored !== null) {
      _setSidebarCollapsed(stored === 'true');
    }
  }, []);

  const minimizeSidebar = useCallback(() => setSidebarCollapsed(true), [setSidebarCollapsed]);
  const expandSidebar = useCallback(() => setSidebarCollapsed(false), [setSidebarCollapsed]);

  const value = useMemo(
    () => ({ sidebarCollapsed, setSidebarCollapsed, minimizeSidebar, expandSidebar }),
    [sidebarCollapsed, setSidebarCollapsed, minimizeSidebar, expandSidebar]
  );

  return (
    <SidebarContext.Provider value={value}>
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  const context = useContext(SidebarContext);
  if (context === undefined) {
    throw new Error('useSidebar must be used within a SidebarProvider');
  }
  return context;
}
