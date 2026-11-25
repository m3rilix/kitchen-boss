import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ColorTheme = 'blue' | 'green' | 'white' | 'purple';
export type DarkMode = 'light' | 'dark' | 'system';

/** Order and labels for the theme picker; `swatch` is the dot shown next to each name. */
export const COLOR_THEMES: { id: ColorTheme; label: string; swatch: string; active: string }[] = [
  { id: 'blue', label: 'Blue', swatch: 'bg-blue-500', active: 'bg-blue-500 text-white' },
  { id: 'green', label: 'Green', swatch: 'bg-green-500', active: 'bg-green-500 text-white' },
  { id: 'white', label: 'White', swatch: 'bg-white ring-1 ring-slate-300', active: 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' },
  { id: 'purple', label: 'Purple', swatch: 'bg-violet-500', active: 'bg-violet-500 text-white' },
];

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

type ThemeClasses = {
  bg50: string; bg100: string; bg500: string; bg600: string; bgGradient: string; bgButton: string;
  text: string; textDark: string; textButton: string;
  border: string; ring: string;
  badgeBg: string; badgeText: string; badgeGradient: string; badgeRing: string;
  queueHighlight: string;
};

// Full literal class strings so Tailwind's scanner keeps every one of them.
const PALETTES: Record<ColorTheme, ThemeClasses> = {
  blue: {
    bg50: 'bg-blue-50 dark:bg-blue-900/20',
    bg100: 'bg-blue-100 dark:bg-blue-900/30',
    bg500: 'bg-blue-500',
    bg600: 'bg-blue-600',
    bgGradient: 'from-blue-500 to-blue-600 dark:from-blue-600 dark:to-blue-700',
    bgButton: 'bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50',
    text: 'text-blue-600 dark:text-blue-400',
    textDark: 'text-blue-700 dark:text-blue-300',
    textButton: 'text-blue-700 dark:text-blue-400',
    border: 'border-blue-500',
    ring: 'ring-blue-500 focus:ring-blue-500',
    badgeBg: 'bg-blue-100 dark:bg-blue-900/50',
    badgeText: 'text-blue-700 dark:text-blue-300',
    badgeGradient: 'bg-gradient-to-br from-blue-500 to-blue-600',
    badgeRing: 'ring-blue-300 dark:ring-blue-700',
    queueHighlight: 'from-blue-50 dark:from-blue-900/20',
  },
  green: {
    bg50: 'bg-green-50 dark:bg-green-900/20',
    bg100: 'bg-green-100 dark:bg-green-900/30',
    bg500: 'bg-green-500',
    bg600: 'bg-green-600',
    bgGradient: 'from-green-500 to-green-600 dark:from-green-600 dark:to-green-700',
    bgButton: 'bg-green-50 dark:bg-green-900/30 hover:bg-green-100 dark:hover:bg-green-900/50',
    text: 'text-green-600 dark:text-green-400',
    textDark: 'text-green-700 dark:text-green-300',
    textButton: 'text-green-700 dark:text-green-400',
    border: 'border-green-500',
    ring: 'ring-green-500 focus:ring-green-500',
    badgeBg: 'bg-green-100 dark:bg-green-900/50',
    badgeText: 'text-green-700 dark:text-green-300',
    badgeGradient: 'bg-gradient-to-br from-green-500 to-green-600',
    badgeRing: 'ring-green-300 dark:ring-green-700',
    queueHighlight: 'from-green-50 dark:from-green-900/20',
  },
  // Monochrome: near-black accents in light mode, white accents in dark mode
  white: {
    bg50: 'bg-slate-50 dark:bg-slate-700/30',
    bg100: 'bg-slate-100 dark:bg-slate-700/50',
    bg500: 'bg-slate-700 dark:bg-slate-300',
    bg600: 'bg-slate-900 dark:bg-white dark:text-slate-900',
    bgGradient: 'from-slate-700 to-slate-900 dark:from-slate-200 dark:to-white',
    bgButton: 'bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600',
    text: 'text-slate-900 dark:text-white',
    textDark: 'text-slate-800 dark:text-slate-100',
    textButton: 'text-slate-800 dark:text-slate-100',
    border: 'border-slate-800 dark:border-slate-200',
    ring: 'ring-slate-500 focus:ring-slate-500',
    badgeBg: 'bg-slate-100 dark:bg-slate-700',
    badgeText: 'text-slate-800 dark:text-slate-100',
    badgeGradient: 'bg-gradient-to-br from-slate-700 to-slate-900',
    badgeRing: 'ring-slate-300 dark:ring-slate-500',
    queueHighlight: 'from-slate-50 dark:from-slate-700/30',
  },
  purple: {
    bg50: 'bg-violet-50 dark:bg-violet-900/20',
    bg100: 'bg-violet-100 dark:bg-violet-900/30',
    bg500: 'bg-violet-500',
    bg600: 'bg-violet-600',
    bgGradient: 'from-violet-500 to-violet-600 dark:from-violet-600 dark:to-violet-700',
    bgButton: 'bg-violet-50 dark:bg-violet-900/30 hover:bg-violet-100 dark:hover:bg-violet-900/50',
    text: 'text-violet-600 dark:text-violet-400',
    textDark: 'text-violet-700 dark:text-violet-300',
    textButton: 'text-violet-700 dark:text-violet-300',
    border: 'border-violet-500',
    ring: 'ring-violet-500 focus:ring-violet-500',
    badgeBg: 'bg-violet-100 dark:bg-violet-900/50',
    badgeText: 'text-violet-700 dark:text-violet-300',
    badgeGradient: 'bg-gradient-to-br from-violet-500 to-violet-600',
    badgeRing: 'ring-violet-300 dark:ring-violet-700',
    queueHighlight: 'from-violet-50 dark:from-violet-900/20',
  },
};

// Helper hook to get theme-aware classes
export const useThemeClasses = (): ThemeClasses => {
  const { colorTheme } = useThemeStore();
  return PALETTES[colorTheme] ?? PALETTES.blue;
};
