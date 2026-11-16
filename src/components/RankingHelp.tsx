import { useState } from 'react';
import { Info } from 'lucide-react';
import { winPct, formatSom } from '@/lib/leaderboard';

/**
 * Column widths shared by the header and every row, so they always line up.
 * Sized for the widest value each column can hold ("99" / "100%") so names get the rest.
 */
const NARROW = 'w-6 text-center';
const WIDE = 'w-9 text-center';
const STAT_GAP = 'gap-1';

/** Shared row layout: tight padding so the name column gets as much width as possible. */
export const RANK_ROW = 'flex items-center gap-2 px-3 py-2.5';

interface RankingsColumnHeaderProps {
  title: string;
  className?: string;
}

/**
 * Column header for a rankings table (W · L · Win% · SOM · GP) with a tap-to-open SOM
 * explainer. Tap, not hover, so it works on phones; the explainer renders as its own row
 * below the header, so it can't be clipped by the panel or shift the columns.
 */
export function RankingsColumnHeader({ title, className = '' }: RankingsColumnHeaderProps) {
  const [showSomHelp, setShowSomHelp] = useState(false);

  return (
    <div className={`bg-slate-50 dark:bg-slate-700/50 ${className}`}>
      <div className="px-3 pt-2 flex items-center justify-between gap-2">
        <p className="min-w-0 truncate whitespace-nowrap text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{title}</p>
        <div className={`flex items-center ${STAT_GAP} text-[11px] font-medium text-slate-400 shrink-0`}>
          <span className={NARROW}>W</span>
          <span className={NARROW}>L</span>
          <span className={WIDE}>Win%</span>
          <button
            type="button"
            onClick={() => setShowSomHelp(v => !v)}
            aria-expanded={showSomHelp}
            aria-label="What is SOM?"
            title="Strength of Match — tap for details"
            className={`${WIDE} inline-flex items-center justify-center gap-px hover:text-slate-600 dark:hover:text-slate-200 transition`}
          >
            SOM
            <Info className="w-2.5 h-2.5 shrink-0" />
          </button>
          <span className={NARROW}>GP</span>
        </div>
      </div>
      <p className="px-3 pb-2 text-[11px] text-slate-400 dark:text-slate-500">Ranked by win rate, adjusted for opponent strength</p>
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

/** The five stat values for one ranking row, aligned with RankingsColumnHeader. */
export function RankingStatCells({ won, played, som }: { won: number; played: number; som: number }) {
  return (
    <div className={`flex items-center ${STAT_GAP} text-sm tabular-nums shrink-0`}>
      <span className={`${NARROW} font-bold text-green-600 dark:text-green-400`}>{won}</span>
      <span className={`${NARROW} font-bold text-red-500 dark:text-red-400`}>{played - won}</span>
      <span className={`${WIDE} font-semibold text-slate-700 dark:text-slate-300`}>{winPct(won, played)}</span>
      <span className={`${WIDE} font-medium text-slate-600 dark:text-slate-400`}>{formatSom(som, played)}</span>
      <span className={`${NARROW} text-slate-500 dark:text-slate-400`}>{played}</span>
    </div>
  );
}

/** Rank column: medals for the top 3, the number otherwise. */
export function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <span className="text-base">🥇</span>;
  if (rank === 2) return <span className="text-base">🥈</span>;
  if (rank === 3) return <span className="text-base">🥉</span>;
  return <span className="text-xs font-semibold text-slate-400 tabular-nums">{rank}</span>;
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
    <p className="px-3 py-2 text-[11px] text-slate-400 dark:text-slate-500">
      <span className="font-semibold">P</span> = provisional: fewer than {threshold} games, ranked after regular players.
    </p>
  );
}
