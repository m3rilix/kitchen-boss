import { useState, useRef, useEffect } from 'react';
import { useThemeStore } from '@/store/themeStore';
import { Palette, X, Sun, Moon } from 'lucide-react';

export function SettingsDropdown() {
  const { colorTheme, darkMode, setColorTheme } = useThemeStore();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const isDark = darkMode === 'dark';

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 transition"
        title="Theme"
      >
        <Palette className="w-5 h-5" />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 overflow-hidden z-50">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-700">
            <h3 className="font-semibold text-slate-800 dark:text-slate-100">Theme</h3>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-4 space-y-4">
            {/* Dark Mode - Disabled */}
            <div>
              <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                Appearance
              </label>
              <div className="mt-2 flex gap-2">
                <button
                  disabled
                  className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition ${
                    !isDark
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-slate-100 text-slate-400'
                  } cursor-not-allowed opacity-60`}
                >
                  <Sun className="w-4 h-4" />
                  Light
                </button>
                <button
                  disabled
                  className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition ${
                    isDark
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-slate-100 text-slate-400'
                  } cursor-not-allowed opacity-60`}
                >
                  <Moon className="w-4 h-4" />
                  Dark
                </button>
              </div>
              <p className="mt-1 text-xs text-slate-400">Coming soon</p>
            </div>

            {/* Color Theme */}
            <div>
              <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                Color
              </label>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <button
                  onClick={() => setColorTheme('blue')}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition ${
                    colorTheme === 'blue'
                      ? 'bg-blue-500 text-white'
                      : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                  }`}
                >
                  <span className="w-4 h-4 rounded-full bg-blue-500 border-2 border-white shadow-sm" />
                  Blue
                </button>
                <button
                  onClick={() => setColorTheme('green')}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition ${
                    colorTheme === 'green'
                      ? 'bg-green-500 text-white'
                      : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                  }`}
                >
                  <span className="w-4 h-4 rounded-full bg-green-500 border-2 border-white shadow-sm" />
                  Green
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
