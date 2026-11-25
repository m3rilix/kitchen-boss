import { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Trophy, Shuffle } from 'lucide-react';
import type { Court } from '@/types';
import { useSessionStore } from '@/store/sessionStore';

const MIN_WINNING_SCORE = 11;
const MIN_WIN_MARGIN = 2;
const MAX_SCORE = 20;

/** Validates a pair of scores against pickleball win rules. Returns an error message, or null if valid. */
function validateScore(s1: number, s2: number): string | null {
  if (Number.isNaN(s1) || Number.isNaN(s2)) return 'Enter a score for both teams';
  if (s1 < 0 || s2 < 0) return 'Scores cannot be negative';
  if (s1 > MAX_SCORE || s2 > MAX_SCORE) return `Scores cannot exceed ${MAX_SCORE}`;
  if (s1 === s2) return 'Scores cannot be tied';
  const winningScore = Math.max(s1, s2);
  const margin = Math.abs(s1 - s2);
  if (winningScore < MIN_WINNING_SCORE) return `Winning score must be at least ${MIN_WINNING_SCORE}`;
  // Win-by-2 only applies past 11 (deuce); a game to 11 can end 11-10
  if (winningScore > MIN_WINNING_SCORE && margin < MIN_WIN_MARGIN) {
    return `Past ${MIN_WINNING_SCORE}, must win by at least ${MIN_WIN_MARGIN} points`;
  }
  return null;
}

/**
 * Dev-only: a random valid score. Mostly a normal game to 11; sometimes a deuce game past 11,
 * which is always won by exactly 2.
 */
function randomScore(): { winner: 'team1' | 'team2'; score: { team1: number; team2: number } } {
  const isDeuce = MAX_SCORE > MIN_WINNING_SCORE + 1 && Math.random() < 0.3;
  const winningScore = isDeuce
    ? MIN_WINNING_SCORE + 1 + Math.floor(Math.random() * (MAX_SCORE - MIN_WINNING_SCORE))
    : MIN_WINNING_SCORE;
  const losingScore = isDeuce
    ? winningScore - MIN_WIN_MARGIN
    : Math.floor(Math.random() * (MIN_WINNING_SCORE - MIN_WIN_MARGIN + 1));
  const winner: 'team1' | 'team2' = Math.random() < 0.5 ? 'team1' : 'team2';
  return {
    winner,
    score: winner === 'team1' ? { team1: winningScore, team2: losingScore } : { team1: losingScore, team2: winningScore },
  };
}

interface ScoreEntryModalProps {
  court: Court;
  onClose: () => void;
}

/** Final-score pop-up: Team A names vs Team B names, with large score boxes. Ends the game on submit. */
export function ScoreEntryModal({ court, onClose }: ScoreEntryModalProps) {
  const { endGame, getPlayerById } = useSessionStore();
  const [team1Score, setTeam1Score] = useState('');
  const [team2Score, setTeam2Score] = useState('');
  const [error, setError] = useState('');
  if (!court.currentGame) return null;

  const team1Players = court.currentGame.team1.map(id => getPlayerById(id));
  const team2Players = court.currentGame.team2.map(id => getPlayerById(id));

  const submit = () => {
    // A blank field counts as 0 (e.g. an 11-0 shutout only needs the winning score typed)
    const s1 = team1Score.trim() === '' ? 0 : parseInt(team1Score, 10);
    const s2 = team2Score.trim() === '' ? 0 : parseInt(team2Score, 10);
    const err = validateScore(s1, s2);
    if (err) {
      setError(err);
      return;
    }
    endGame(court.id, s1 > s2 ? 'team1' : 'team2', { team1: s1, team2: s2 });
    onClose();
  };

  const submitRandom = () => {
    const { winner, score } = randomScore();
    endGame(court.id, winner, score);
    onClose();
  };

  const teams = [
    { key: 'team1', label: 'Team A', players: team1Players, value: team1Score, set: setTeam1Score, tone: 'blue' },
    { key: 'team2', label: 'Team B', players: team2Players, value: team2Score, set: setTeam2Score, tone: 'red' },
  ] as const;

  const teamBlock = (t: typeof teams[number], autoFocus: boolean) => (
    <div key={t.key} className="flex flex-col items-center gap-2 min-w-0">
      <div className={`w-full text-center rounded-lg px-2 py-2 ${t.tone === 'blue' ? 'bg-blue-50 dark:bg-blue-900/20' : 'bg-red-50 dark:bg-red-900/20'}`}>
        <p className={`text-[10px] font-semibold uppercase tracking-wide ${t.tone === 'blue' ? 'text-blue-700 dark:text-blue-300' : 'text-red-700 dark:text-red-300'}`}>{t.label}</p>
        {t.players.map((p, i) => (
          <p key={i} className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">{p?.name ?? '—'}</p>
        ))}
      </div>
      <input
        type="number"
        inputMode="numeric"
        min={0}
        max={MAX_SCORE}
        autoFocus={autoFocus}
        value={t.value}
        onChange={(e) => { t.set(e.target.value); setError(''); }}
        onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
        placeholder="0"
        aria-label={`${t.label} score`}
        className={`w-full px-2 py-3 text-center text-3xl font-bold rounded-xl border-2 outline-none focus:ring-4 ${
          t.tone === 'blue'
            ? 'text-blue-700 dark:text-blue-300 bg-white dark:bg-slate-900 border-blue-200 dark:border-blue-800 focus:border-blue-500 focus:ring-blue-500/20'
            : 'text-red-700 dark:text-red-300 bg-white dark:bg-slate-900 border-red-200 dark:border-red-800 focus:border-red-500 focus:ring-red-500/20'
        }`}
      />
    </div>
  );

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Final score for ${court.name}`}
        className="w-full sm:max-w-md bg-white dark:bg-slate-800 rounded-t-2xl sm:rounded-2xl shadow-2xl p-5 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">Final score</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">{court.name}</p>
          </div>
          <button onClick={onClose} className="p-2 -mr-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-3">
          {teamBlock(teams[0], true)}
          <div className="pt-10 text-sm font-bold text-slate-400">vs</div>
          {teamBlock(teams[1], false)}
        </div>

        {error && <p className="text-sm text-center text-red-600 dark:text-red-400">{error}</p>}

        <button
          onClick={submit}
          className="flex items-center justify-center gap-2 w-full py-3 text-base font-semibold text-white bg-green-600 rounded-xl hover:bg-green-700 transition"
        >
          <Trophy className="w-5 h-5" />
          Submit Score
        </button>
        {import.meta.env.DEV && (
          <button
            onClick={submitRandom}
            className="flex items-center justify-center gap-2 w-full py-2 text-sm font-medium text-purple-700 bg-purple-100 dark:bg-purple-900/30 dark:text-purple-300 rounded-lg hover:bg-purple-200 transition"
            title="End with a random valid score (dev only)"
          >
            <Shuffle className="w-4 h-4" />
            Random Score (Dev)
          </button>
        )}
      </div>
    </div>,
    document.body
  );
}
