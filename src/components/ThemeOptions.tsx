import { Sun, Moon, Monitor } from 'lucide-react';
import { useThemeStore, COLOR_THEMES, type DarkMode } from '@/store/themeStore';

const MODES: { id: DarkMode; label: string; icon: React.ReactNode }[] = [
  { id: 'light', label: 'Light', icon: <Sun className="w-4 h-4" /> },
  { id: 'dark', label: 'Dark', icon: <Moon className="w-4 h-4" /> },
  { id: 'system', label: 'Auto', icon: <Monitor className="w-4 h-4" /> },
];

/** Appearance (light / dark / follow device) and colour theme pickers, shared by every theme menu. */
export function ThemeOptions({ compact = false }: { compact?: boolean }) {
  const { colorTheme, darkMode, setColorTheme, setDarkMode } = useThemeStore();
  const label = 'text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide';
  const size = compact ? 'px-2 py-1.5 text-xs' : 'px-3 py-2 text-sm';

  return (
    <div className={compact ? 'space-y-3' : 'space-y-4'}>
      <div>
        <p className={label}>Appearance</p>
        <div className="mt-2 grid grid-cols-3 gap-1.5" role="radiogroup" aria-label="Appearance">
          {MODES.map(m => (
            <button
              key={m.id}
              role="radio"
              aria-checked={darkMode === m.id}
              onClick={() => setDarkMode(m.id)}
              className={`flex items-center justify-center gap-1.5 ${size} rounded-lg font-medium transition ${
                darkMode === m.id
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                  : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
              }`}
            >
              {m.icon}
              {m.label}
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className={label}>Color</p>
        <div className="mt-2 grid grid-cols-2 gap-1.5" role="radiogroup" aria-label="Color theme">
          {COLOR_THEMES.map(t => (
            <button
              key={t.id}
              role="radio"
              aria-checked={colorTheme === t.id}
              onClick={() => setColorTheme(t.id)}
              className={`flex items-center gap-2 ${size} rounded-lg font-medium transition ${
                colorTheme === t.id
                  ? t.active
                  : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
              }`}
            >
              <span className={`w-4 h-4 rounded-full border-2 border-white dark:border-slate-800 shadow-sm shrink-0 ${t.swatch}`} />
              {t.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
