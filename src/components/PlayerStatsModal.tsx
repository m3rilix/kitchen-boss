import { useState } from 'react';
import type { Player, Session } from '@/types';
import { X, Trophy, Users, Swords, MapPin, CalendarDays, ChevronDown } from 'lucide-react';
import { computePlayerMatchStats } from '@/lib/playerStats';
import { rankPlayers, formatDiff } from '@/lib/leaderboard';
import { isSkillBased, skillOf } from '@/lib/skill';
import { useThemeClasses } from '@/store/themeStore';
import { PickleballIcon } from './PickleballIcon';
import { StarRating } from './StarRating';

interface PlayerStatsModalProps {
  player: Player;
  session: Session;
  onClose: () => void;
  /** Share view: partners / opponents / match history sit behind a "Show details" button. */
  hideDetailsByDefault?: boolean;
}

const MEDALS = ['🥇', '🥈', '🥉'];

function formatGameTime(date?: Date) {
  if (!date) return '';
  return new Date(date).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

/** "Sunday, Nov 23, 2026" from the session date (YYYY-MM-DD), falling back to when it was created. */
function formatSessionDate(session: Session): string {
  const d = session.date ? new Date(session.date + 'T00:00:00') : new Date(session.createdAt);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });
}

/**
 * Player ranking card: a screenshot-friendly summary of a player's session ("proud moments"),
 * with partners, opponents and match history underneath.
 */
export function PlayerStatsModal({ player, session, onClose, hideDetailsByDefault = false }: PlayerStatsModalProps) {
  const theme = useThemeClasses();
  const [showDetails, setShowDetails] = useState(!hideDetailsByDefault);
  const stats = computePlayerMatchStats(player.id, session.players, session.gamesCompleted);
  const ranked = rankPlayers(session.players, session.gamesCompleted);
  const rankIdx = ranked.findIndex(p => p.id === player.id);
  const rank = rankIdx >= 0 ? rankIdx + 1 : null;
  const isProvisional = rankIdx >= 0 && ranked[rankIdx].isProvisional;
  const dateLabel = formatSessionDate(session);
  const hasDetails = stats.partners.length > 0 || stats.opponents.length > 0 || stats.history.length > 0;

  return (
    <div
      className={`fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center z-50 ${
        // Share view: centered on phones too, so the card screenshots cleanly
        hideDetailsByDefault ? 'items-center p-4' : 'items-end sm:items-center p-0 sm:p-4'
      }`}
      onClick={onClose}
    >
      <div
        className={`bg-slate-100 dark:bg-slate-900 shadow-2xl w-full sm:max-w-md max-h-[92vh] flex flex-col overflow-hidden ${
          hideDetailsByDefault ? 'max-w-md rounded-2xl' : 'rounded-t-2xl sm:rounded-2xl'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex-1 overflow-y-auto">
          {/* ── Card (the screenshot part) ─────────────────────────────── */}
          <div className="p-3 pb-2">
            <div className="relative rounded-2xl overflow-hidden bg-white dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-slate-700">
              <button
                onClick={onClose}
                className="absolute top-2 right-2 z-10 p-1.5 rounded-full text-white/80 hover:text-white hover:bg-white/15 transition"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>

              {/* Session band */}
              <div className={`${theme.bg600} text-white px-5 pt-4 pb-10`}>
                <p className="text-sm font-semibold leading-snug line-clamp-2 break-words pr-8">{session.name}</p>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-white/85">
                  {dateLabel && (
                    <span className="inline-flex items-center gap-1"><CalendarDays className="w-3.5 h-3.5" />{dateLabel}</span>
                  )}
                  {session.location && (
                    <span className="inline-flex items-center gap-1 min-w-0"><MapPin className="w-3.5 h-3.5 shrink-0" /><span className="truncate">{session.location}</span></span>
                  )}
                </div>
              </div>

              {/* Rank badge overlapping the band */}
              <div className="-mt-8 flex flex-col items-center px-5">
                <div className="w-16 h-16 rounded-full bg-white dark:bg-slate-800 shadow-md border-4 border-white dark:border-slate-800 flex items-center justify-center">
                  {rank && rank <= 3 ? (
                    <span className="text-4xl leading-none">{MEDALS[rank - 1]}</span>
                  ) : (
                    <span className="text-2xl font-black text-slate-700 dark:text-slate-200 tabular-nums">{rank ? `#${rank}` : '–'}</span>
                  )}
                </div>
                <h2 className="mt-2 text-2xl font-extrabold text-slate-900 dark:text-white text-center break-words">{player.name}</h2>
                {isSkillBased(session.rotationMode) && (
                  <div className="mt-1"><StarRating value={skillOf(player)} size="sm" /></div>
                )}
                <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">
                  {rank ? <>Rank <span className="text-slate-800 dark:text-slate-100">{rank}</span> of {ranked.length}</> : 'Not ranked yet'}
                  {isProvisional && <span className="ml-1 text-xs font-medium text-slate-400">(provisional)</span>}
                </p>
              </div>

              {/* Stats */}
              <div className="px-4 pt-4 pb-3 grid grid-cols-4 gap-2">
                <div className="text-center py-2 rounded-xl bg-green-50 dark:bg-green-900/20">
                  <p className="text-2xl font-bold text-green-600 dark:text-green-400 tabular-nums">{stats.wins}</p>
                  <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Wins</p>
                </div>
                <div className="text-center py-2 rounded-xl bg-red-50 dark:bg-red-900/20">
                  <p className="text-2xl font-bold text-red-500 dark:text-red-400 tabular-nums">{stats.losses}</p>
                  <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Losses</p>
                </div>
                <div className="text-center py-2 rounded-xl bg-slate-50 dark:bg-slate-700/50">
                  <p className="text-2xl font-bold text-slate-800 dark:text-slate-100 tabular-nums">{stats.winPct}</p>
                  <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Win %</p>
                </div>
                <div className="text-center py-2 rounded-xl bg-slate-50 dark:bg-slate-700/50">
                  <p className={`text-2xl font-bold tabular-nums ${stats.pointDiff > 0 ? 'text-green-600 dark:text-green-400' : stats.pointDiff < 0 ? 'text-red-500 dark:text-red-400' : 'text-slate-600 dark:text-slate-400'}`}>
                    {formatDiff(stats.pointDiff)}
                  </p>
                  <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">+/-</p>
                </div>
              </div>

              {/* Branding */}
              <div className="px-5 py-2.5 border-t border-slate-100 dark:border-slate-700 flex items-center justify-center gap-1.5 text-slate-400 dark:text-slate-500">
                <PickleballIcon className={`w-4 h-4 ${theme.text}`} />
                <span className="text-xs font-semibold tracking-wide">kitchen-boss</span>
              </div>
            </div>
          </div>

          {/* ── Details (partners / opponents / history) ───────────────── */}
          {/* Expand / collapse toggle (share view only — managers always see details) */}
          {hasDetails && hideDetailsByDefault && (
            <div className="flex justify-center pb-3">
              <button
                onClick={() => setShowDetails(v => !v)}
                aria-expanded={showDetails}
                aria-label={showDetails ? 'Hide partners, opponents and matches' : 'Show partners, opponents and matches'}
                title={showDetails ? 'Hide details' : 'Partners, opponents & matches'}
                className="w-10 h-10 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm text-slate-500 dark:text-slate-300 hover:text-slate-700 dark:hover:text-white hover:shadow transition flex items-center justify-center"
              >
                <ChevronDown className={`w-5 h-5 transition-transform duration-200 ${showDetails ? 'rotate-180' : ''}`} />
              </button>
            </div>
          )}

          {showDetails && hasDetails && (
            <div className="mx-3 mb-3 rounded-2xl overflow-hidden bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
              {stats.partners.length > 0 && (
                <section>
                  <div className="px-4 py-2 bg-slate-50 dark:bg-slate-700/50">
                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5" /> Partners
                    </p>
                  </div>
                  <div className="px-4 py-2 space-y-1.5">
                    {stats.partners.map((p) => (
                      <div key={p.playerId} className="flex items-center justify-between text-sm">
                        <span className="text-slate-700 dark:text-slate-200 truncate">{p.name}</span>
                        <span className="text-slate-500 dark:text-slate-400 shrink-0 ml-2">
                          {p.games} game{p.games !== 1 ? 's' : ''} · <span className="text-green-600 dark:text-green-400 font-medium">{p.wins}W</span>{' '}
                          <span className="text-red-500 dark:text-red-400 font-medium">{p.losses}L</span>
                        </span>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {stats.opponents.length > 0 && (
                <section className="border-t border-slate-100 dark:border-slate-700">
                  <div className="px-4 py-2 bg-slate-50 dark:bg-slate-700/50">
                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide flex items-center gap-1.5">
                      <Swords className="w-3.5 h-3.5" /> Opponents
                    </p>
                  </div>
                  <div className="px-4 py-2 space-y-1.5">
                    {stats.opponents.map((o) => (
                      <div key={o.playerId} className="flex items-center justify-between text-sm">
                        <span className="text-slate-700 dark:text-slate-200 truncate">{o.name}</span>
                        <span className="text-slate-500 dark:text-slate-400 shrink-0 ml-2">
                          {o.games} game{o.games !== 1 ? 's' : ''} · <span className="text-green-600 dark:text-green-400 font-medium">{o.wins}W</span>{' '}
                          <span className="text-red-500 dark:text-red-400 font-medium">{o.losses}L</span>
                        </span>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              <section className="border-t border-slate-100 dark:border-slate-700">
                <div className="px-4 py-2 bg-slate-50 dark:bg-slate-700/50">
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide flex items-center gap-1.5">
                    <Trophy className="w-3.5 h-3.5" /> Match History
                  </p>
                </div>
                {stats.history.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-6">No matches played yet</p>
                ) : (
                  <div className="px-4 py-2 space-y-1.5 pb-3">
                    {stats.history.map((h, i) => (
                      <div key={`${h.gameId}-${i}`} className={`flex items-center justify-between text-xs px-2.5 py-2 rounded-lg ${h.won ? 'bg-green-50 dark:bg-green-900/10' : 'bg-red-50 dark:bg-red-900/10'}`}>
                        <div className="min-w-0">
                          <span className={`font-semibold ${h.won ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
                            {h.won ? 'W' : 'L'}
                          </span>
                          <span className="text-slate-600 dark:text-slate-300 ml-2 truncate">
                            {h.partnerName ? `w/ ${h.partnerName} vs ` : 'vs '}{h.opponentNames.join(' & ')}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 ml-2">
                          {h.score && <span className="text-slate-500 dark:text-slate-400 font-medium">{h.score.mine}-{h.score.theirs}</span>}
                          <span className="text-slate-400 dark:text-slate-500">{formatGameTime(h.endedAt)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
