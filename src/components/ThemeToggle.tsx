import { useThemeStore } from '@/store/themeStore';
import { Sun, Moon } from 'lucide-react';

export function ThemeToggle() {
  const { darkMode, colorTheme, toggleDarkMode, setColorTheme } = useThemeStore();

  const isDark = darkMode === 'dark';

  return (
    <div className="flex items-center gap-2">
      {/* Color Theme Toggle */}
      <div className="flex items-center bg-slate-100 dark:bg-slate-700 rounded-lg p-0.5">
        <button
          onClick={() => setColorTheme('blue')}
          className={`px-2 py-1 text-xs font-medium rounded transition ${
            colorTheme === 'blue'
              ? 'bg-blue-500 text-white'
              : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
          }`}
          title="Blue theme"
        >
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-blue-500" />
            Blue
          </span>
        </button>
        <button
          onClick={() => setColorTheme('green')}
          className={`px-2 py-1 text-xs font-medium rounded transition ${
            colorTheme === 'green'
              ? 'bg-green-500 text-white'
              : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
          }`}
          title="Green theme"
        >
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-green-500" />
            Green
          </span>
        </button>
      </div>

      {/* Dark Mode Toggle */}
      <button
        onClick={toggleDarkMode}
        className="p-2 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 transition"
        title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      >
        {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
      </button>
    </div>
  );
}
