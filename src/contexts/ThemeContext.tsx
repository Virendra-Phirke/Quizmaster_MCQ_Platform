import React, { createContext, useEffect, useState, useCallback } from 'react';

interface ThemeContextType {
  isDark: boolean;
  toggleTheme: () => void;
  setTheme: (theme: 'light' | 'dark') => void;
  accent: string; // legacy name
  accentColor: string; // alias for clarity
  cycleAccent: (newAccent?: string) => void;
  setAccent: (accent: string) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);
export { ThemeContext };

const ACCENTS = ['purple-pink', 'blue-cyan', 'green-teal', 'orange-red', 'indigo-purple'];

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Always use dark theme - force dark mode
  const [isDark] = useState(true);
  const [accent, setAccent] = useState(() => localStorage.getItem('accent') || 'purple-pink');

  useEffect(() => {
    // Force dark class on document
    document.documentElement.classList.add('dark');
    localStorage.setItem('theme', 'dark');
  }, []);

  useEffect(() => {
    document.documentElement.dataset.accent = accent;
    localStorage.setItem('accent', accent);
  }, [accent]);

  // Keep these functions for compatibility but they won't change theme
  const toggleTheme = () => {}; // No-op
  const setTheme = () => {}; // No-op

  const cycleAccent = useCallback((newAccent?: string) => {
    if (newAccent && ACCENTS.includes(newAccent)) {
      setAccent(newAccent);
      return;
    }
    setAccent(prev => ACCENTS[(ACCENTS.indexOf(prev) + 1) % ACCENTS.length]);
  }, []);

  return (
    <ThemeContext.Provider value={{ isDark, toggleTheme, setTheme, accent, accentColor: accent, cycleAccent, setAccent }}>
      {children}
    </ThemeContext.Provider>
  );
}
