import type { Player, Game } from '@/types';
import { X, Trophy, Users, Swords } from 'lucide-react';
import { computePlayerMatchStats } from '@/lib/playerStats';
import { formatDiff } from '@/lib/leaderboard';

interface PlayerStatsModalProps {
  player: Player;
  players: Player[];
  gamesCompleted: Game[];
  onClose: () => void;
}

function formatGameTime(date?: Date) {
  if (!date) return '';
  return new Date(date).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

export function PlayerStatsModal({ player, players, gamesCompleted, onClose }: PlayerStatsModalProps) {
  const stats = computePlayerMatchStats(player.id, players, gamesCompleted);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-slate-800 rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-600 flex items-center justify-center font-bold text-slate-700 dark:text-slate-200 shrink-0">
              {player.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-bold text-slate-800 dark:text-slate-100 truncate">{player.name}</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {stats.totalGames} game{stats.totalGames !== 1 ? 's' : ''} played
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Summary tiles */}
          <div className="px-5 py-4 grid grid-cols-4 gap-2">
            <div className="text-center p-2 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <p className="text-lg font-bold text-green-600 dark:text-green-400">{stats.wins}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Wins</p>
            </div>
            <div className="text-center p-2 bg-red-50 dark:bg-red-900/20 rounded-lg">
              <p className="text-lg font-bold text-red-500 dark:text-red-400">{stats.losses}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Losses</p>
            </div>
            <div className="text-center p-2 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
              <p className="text-lg font-bold text-slate-700 dark:text-slate-200">{stats.winPct}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Win%</p>
            </div>
            <div className="text-center p-2 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
              <p className={`text-lg font-bold ${stats.pointDiff > 0 ? 'text-green-600 dark:text-green-400' : stats.pointDiff < 0 ? 'text-red-500 dark:text-red-400' : 'text-slate-600 dark:text-slate-400'}`}>
                {formatDiff(stats.pointDiff)}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">+/-</p>
            </div>
          </div>

          {/* Partners */}
          {stats.partners.length > 0 && (
            <div className="border-t border-slate-100 dark:border-slate-700">
              <div className="px-5 py-2 bg-slate-50 dark:bg-slate-700/50">
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5" /> Partners
                </p>
              </div>
              <div className="px-5 py-2 space-y-1.5">
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
            </div>
          )}

          {/* Opponents */}
          {stats.opponents.length > 0 && (
            <div className="border-t border-slate-100 dark:border-slate-700">
              <div className="px-5 py-2 bg-slate-50 dark:bg-slate-700/50">
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide flex items-center gap-1.5">
                  <Swords className="w-3.5 h-3.5" /> Opponents
                </p>
              </div>
              <div className="px-5 py-2 space-y-1.5">
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
            </div>
          )}

          {/* Match history */}
          <div className="border-t border-slate-100 dark:border-slate-700">
            <div className="px-5 py-2 bg-slate-50 dark:bg-slate-700/50">
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide flex items-center gap-1.5">
                <Trophy className="w-3.5 h-3.5" /> Match History
              </p>
            </div>
            {stats.history.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-6">No matches played yet</p>
            ) : (
              <div className="px-5 py-2 space-y-1.5 pb-4">
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
          </div>
        </div>
      </div>
    </div>
  );
}
