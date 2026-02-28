import { useEffect } from 'react';
import { useThemeStore } from '@/store/themeStore';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { darkMode, colorTheme } = useThemeStore();

  useEffect(() => {
    const root = document.documentElement;
    
    // Handle dark mode
    if (darkMode === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.classList.toggle('dark', prefersDark);
    } else {
      root.classList.toggle('dark', darkMode === 'dark');
    }

    // Handle color theme
    root.setAttribute('data-theme', colorTheme);
  }, [darkMode, colorTheme]);

  // Listen for system theme changes
  useEffect(() => {
    if (darkMode !== 'system') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => {
      document.documentElement.classList.toggle('dark', e.matches);
    };

    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, [darkMode]);

  return <>{children}</>;
}
