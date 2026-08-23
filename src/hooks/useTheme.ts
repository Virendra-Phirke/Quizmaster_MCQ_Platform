import { useContext } from 'react';
import { ThemeContext } from '../contexts/ThemeContext';

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    // Provide fallback values instead of throwing
    return {
      isDark: false,
      toggleTheme: () => {},
      setTheme: () => {},
      accent: 'purple-pink',
      accentColor: 'purple-pink',
      cycleAccent: () => {},
      setAccent: () => {}
    };
  }
  return context;
}
