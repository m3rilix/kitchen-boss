import { useState } from 'react';
import { Info } from 'lucide-react';

interface RankingsColumnHeaderProps {
  title: string;
  /** Narrower columns (live share-view panel) vs. the wider report/scoreboard tables. */
  compact?: boolean;
  className?: string;
}

/**
 * Column header for a rankings table (W · L · Win% · SOM · GP) with a tap-to-open SOM
 * explainer. Tap, not hover, so it works on phones; the explainer renders as its own row
 * below the header, so it can't be clipped by the panel or shift the columns.
 */
export function RankingsColumnHeader({ title, compact = false, className = '' }: RankingsColumnHeaderProps) {
  const [showSomHelp, setShowSomHelp] = useState(false);
  const cell = compact ? 'w-8 text-center' : 'w-[40px] text-center';
  const wideCell = compact ? 'w-10 text-center' : 'w-[40px] text-center';

  return (
    <div className={`bg-slate-50 dark:bg-slate-700/50 ${className}`}>
      <div className="px-4 pt-2 flex items-center justify-between gap-2">
        <p className="min-w-0 truncate whitespace-nowrap text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{title}</p>
        <div className={`flex items-center ${compact ? 'gap-3' : 'gap-4'} text-xs text-slate-400 pr-1 shrink-0`}>
          <span className={cell}>W</span>
          <span className={cell}>L</span>
          <span className={wideCell}>Win%</span>
          <button
            type="button"
            onClick={() => setShowSomHelp(v => !v)}
            aria-expanded={showSomHelp}
            aria-label="What is SOM?"
            title="Strength of Match — tap for details"
            className={`${wideCell} inline-flex items-center justify-center gap-0.5 hover:text-slate-600 dark:hover:text-slate-200 transition`}
          >
            SOM
            <Info className="w-3 h-3" />
          </button>
          <span className={cell}>GP</span>
        </div>
      </div>
      <p className="px-4 pb-2 text-[11px] text-slate-400 dark:text-slate-500">Ranked by win rate, adjusted for opponent strength</p>
      {showSomHelp && (
        <div className="px-4 pb-2 text-xs text-slate-600 dark:text-slate-300 space-y-1">
          <p>
            <span className="font-semibold">SOM (Strength of Match)</span> is how good your opponents were: their average
            win rate in their other games. 50% is average; higher means you faced tougher players.
          </p>
          <p>Rankings use your win rate, nudged up for tough opponents and down for easy ones.</p>
        </div>
      )}
    </div>
  );
}

/** Small grey "P" marker shown after a provisional player's name. */
export function ProvisionalTag() {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center ml-1 px-1 text-[10px] font-semibold leading-4 rounded bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-400 align-middle"
      title="Provisional — not enough games yet"
    >
      P
    </span>
  );
}

/** Footnote explaining the P tag; render only when at least one row is provisional. */
export function ProvisionalNote({ threshold }: { threshold: number }) {
  return (
    <p className="px-4 py-2 text-[11px] text-slate-400 dark:text-slate-500">
      <span className="font-semibold">P</span> = provisional: fewer than {threshold} games, ranked after regular players.
    </p>
  );
}
