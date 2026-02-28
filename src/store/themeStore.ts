import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ColorTheme = 'blue' | 'green';
export type DarkMode = 'light' | 'dark' | 'system';

interface ThemeState {
  colorTheme: ColorTheme;
  darkMode: DarkMode;
  setColorTheme: (theme: ColorTheme) => void;
  setDarkMode: (mode: DarkMode) => void;
  toggleDarkMode: () => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      colorTheme: 'blue',
      darkMode: 'light',

      setColorTheme: (colorTheme) => set({ colorTheme }),
      
      setDarkMode: (darkMode) => set({ darkMode }),
      
      toggleDarkMode: () => {
        const current = get().darkMode;
        set({ darkMode: current === 'dark' ? 'light' : 'dark' });
      },
    }),
    {
      name: 'kitchenboss-theme',
    }
  )
);

// Helper hook to get theme-aware classes
export const useThemeClasses = () => {
  const { colorTheme } = useThemeStore();
  const isGreen = colorTheme === 'green';
  
  return {
    // Backgrounds
    bg50: isGreen ? 'bg-green-50 dark:bg-green-900/20' : 'bg-blue-50 dark:bg-blue-900/20',
    bg100: isGreen ? 'bg-green-100 dark:bg-green-900/30' : 'bg-blue-100 dark:bg-blue-900/30',
    bg500: isGreen ? 'bg-green-500' : 'bg-blue-500',
    bg600: isGreen ? 'bg-green-600' : 'bg-blue-600',
    bgGradient: isGreen ? 'from-green-500 to-green-600 dark:from-green-600 dark:to-green-700' : 'from-blue-500 to-blue-600 dark:from-blue-600 dark:to-blue-700',
    bgButton: isGreen ? 'bg-green-50 dark:bg-green-900/30 hover:bg-green-100 dark:hover:bg-green-900/50' : 'bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50',
    
    // Text
    text: isGreen ? 'text-green-600 dark:text-green-400' : 'text-blue-600 dark:text-blue-400',
    textDark: isGreen ? 'text-green-700 dark:text-green-300' : 'text-blue-700 dark:text-blue-300',
    textButton: isGreen ? 'text-green-700 dark:text-green-400' : 'text-blue-700 dark:text-blue-400',
    
    // Borders
    border: isGreen ? 'border-green-500' : 'border-blue-500',
    ring: isGreen ? 'ring-green-500 focus:ring-green-500' : 'ring-blue-500 focus:ring-blue-500',
    
    // Badge for queue
    badgeBg: isGreen ? 'bg-green-100 dark:bg-green-900/50' : 'bg-blue-100 dark:bg-blue-900/50',
    badgeText: isGreen ? 'text-green-700 dark:text-green-300' : 'text-blue-700 dark:text-blue-300',
    badgeGradient: isGreen ? 'bg-gradient-to-br from-green-500 to-green-600' : 'bg-gradient-to-br from-blue-500 to-blue-600',
    badgeRing: isGreen ? 'ring-green-300 dark:ring-green-700' : 'ring-blue-300 dark:ring-blue-700',
    
    // Queue highlight
    queueHighlight: isGreen ? 'from-green-50 dark:from-green-900/20' : 'from-blue-50 dark:from-blue-900/20',
  };
};
