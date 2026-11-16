import type { Session } from '@/types';
import { Trophy, Activity, Hourglass, Repeat, BarChart3, Timer } from 'lucide-react';
import { pairDisplayName } from '@/lib/doubles';
import { rankPlayers, rankPairs, provisionalThreshold } from '@/lib/leaderboard';
import { analyzeSessionHealth } from '@/lib/sessionHealth';
import { isSkillBased, skillOf } from '@/lib/skill';
import { StarRating } from './StarRating';
import { RankingsColumnHeader, RankingStatCells, RankBadge, RANK_ROW, ProvisionalTag, ProvisionalNote } from './RankingHelp';

/** Live session rankings + session health. Used by both the manager and the shared (player) view. */
export function LeaderboardPanel({ session, onSelectPlayer }: { session: Session; onSelectPlayer: (id: string) => void }) {
  const isDoubles = session.rotationMode === 'doubles';
  const rankedPlayers = rankPlayers(session.players, session.gamesCompleted);
  const rankedPairs = isDoubles ? rankPairs(session.pairs ?? [], session.gamesCompleted) : [];
  const totalGames = session.gamesCompleted.length;
  const activePlayers = session.players.filter(p => p.isActive);
  const sessionHealth = analyzeSessionHealth(session.players, session.gamesCompleted, session.matchHistory ?? []);

  const partnerMap = new Map<string, string>();
  if (isDoubles) {
    (session.pairs ?? []).forEach(pair => {
      const p1 = session.players.find(p => p.id === pair.player1Id);
      const p2 = session.players.find(p => p.id === pair.player2Id);
      if (p1 && p2) { partnerMap.set(p1.id, p2.name); partnerMap.set(p2.id, p1.name); }
    });
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700">
        <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
          <Trophy className="w-4 h-4 text-yellow-500" />
          Session Rankings
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          {totalGames} game{totalGames !== 1 ? 's' : ''} · {activePlayers.length} player{activePlayers.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Body */}
      <div>
          {totalGames === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400 dark:text-slate-500">
              <Trophy className="w-10 h-10 mb-3 opacity-20" />
              <p className="text-sm">No games played yet</p>
            </div>
          ) : (
            <>
              {/* Player Rankings */}
              <RankingsColumnHeader title="Player Rankings" className="border-b border-slate-100 dark:border-slate-700" />
              {rankedPlayers.map((player, idx) => {
                const rank = idx + 1;
                return (
                  <div key={player.id} className={`${RANK_ROW} ${rank <= 3 ? 'bg-yellow-50/40 dark:bg-yellow-900/5' : ''} ${rank % 2 === 0 ? 'bg-slate-50/60 dark:bg-slate-800/30' : ''}`}>
                    <div className="w-6 flex items-center justify-center shrink-0"><RankBadge rank={rank} /></div>
                    <button onClick={() => onSelectPlayer(player.id)} className="flex-1 min-w-0 text-left">
                      <p className="flex items-center min-w-0 font-medium text-slate-800 dark:text-slate-100 text-sm">
                        <span className="truncate hover:underline">{player.name}</span>{player.isProvisional && <ProvisionalTag />}
                      </p>
                      {isSkillBased(session.rotationMode) && <StarRating value={skillOf(player)} size="xs" />}
                      {partnerMap.get(player.id) && <p className="text-xs text-slate-400 truncate">with {partnerMap.get(player.id)}</p>}
                    </button>
                    <RankingStatCells won={player.gamesWon} played={player.gamesPlayed} som={player.somScore} />
                  </div>
                );
              })}
              {rankedPlayers.some(p => p.isProvisional) && (
                <ProvisionalNote threshold={provisionalThreshold(rankedPlayers.map(p => p.gamesPlayed))} />
              )}

              {/* Pair Rankings (doubles only) */}
              {isDoubles && rankedPairs.length > 0 && (
                <>
                  <RankingsColumnHeader title="Pair Rankings" className="mt-2 border-y border-slate-100 dark:border-slate-700" />
                  {rankedPairs.map((pair, idx) => {
                    const rank = idx + 1;
                    const name = pairDisplayName(pair, session.players);
                    return (
                      <div key={pair.id} className={`${RANK_ROW} ${rank <= 3 ? 'bg-yellow-50/40 dark:bg-yellow-900/5' : ''} ${rank % 2 === 0 ? 'bg-slate-50/60 dark:bg-slate-800/30' : ''}`}>
                        <div className="w-6 flex items-center justify-center shrink-0"><RankBadge rank={rank} /></div>
                        <div className="flex-1 min-w-0">
                          <p className="flex items-center min-w-0 font-medium text-slate-800 dark:text-slate-100 text-sm">
                            <span className="truncate">{name}</span>{pair.isProvisional && <ProvisionalTag />}
                          </p>
                        </div>
                        <RankingStatCells won={pair.gamesWon} played={pair.gamesPlayed} som={pair.somScore} />
                      </div>
                    );
                  })}
                  {rankedPairs.some(p => p.isProvisional) && (
                    <ProvisionalNote threshold={provisionalThreshold(rankedPairs.map(p => p.gamesPlayed))} />
                  )}
                </>
              )}

              {/* Session Health */}
              <div className="px-4 py-2 mt-2 bg-slate-50 dark:bg-slate-700/50 border-y border-slate-100 dark:border-slate-700">
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5" />
                  Session Health
                </p>
              </div>
              <div className="px-4 py-3 space-y-4">
                {/* 1. Longest waiting time */}
                <div>
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5 flex items-center gap-1">
                    <Hourglass className="w-3.5 h-3.5 text-blue-500" />
                    Longest Waiting
                  </p>
                  {sessionHealth.longestWaiting.length === 0 ? (
                    <p className="text-xs text-slate-400">No one waiting right now</p>
                  ) : (
                    <div className="space-y-1">
                      {sessionHealth.longestWaiting.map((w) => (
                        <div key={w.id} className="flex items-center justify-between text-xs bg-blue-50 dark:bg-blue-900/10 rounded-lg px-2 py-1.5">
                          <span className="text-slate-700 dark:text-slate-200 truncate">{w.name}</span>
                          <span className="text-blue-600 dark:text-blue-400 font-semibold shrink-0 ml-2">{w.waitMinutes}m</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 2. Games played difference */}
                <div>
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5 flex items-center gap-1">
                    <BarChart3 className="w-3.5 h-3.5 text-teal-500" />
                    Games Played Difference
                  </p>
                  {sessionHealth.gamesPlayedSpread.most && sessionHealth.gamesPlayedSpread.least ? (
                    <div className="flex items-center justify-between text-xs bg-teal-50 dark:bg-teal-900/10 rounded-lg px-2 py-1.5">
                      <span className="text-slate-700 dark:text-slate-200 truncate">
                        {sessionHealth.gamesPlayedSpread.most.name} ({sessionHealth.gamesPlayedSpread.most.gamesPlayed}) vs {sessionHealth.gamesPlayedSpread.least.name} ({sessionHealth.gamesPlayedSpread.least.gamesPlayed})
                      </span>
                      <span className="text-teal-600 dark:text-teal-400 font-semibold shrink-0 ml-2">{sessionHealth.gamesPlayedSpread.diff}</span>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400">No games played yet</p>
                  )}
                </div>

                {/* 3. Repeat partner pairs */}
                <div>
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5 flex items-center gap-1">
                    <Repeat className="w-3.5 h-3.5 text-purple-500" />
                    Repeat Partner Pairs
                  </p>
                  {sessionHealth.repeatPartnerships.length === 0 ? (
                    <p className="text-xs text-slate-400">No repeat partnerships - great variety!</p>
                  ) : (
                    <div className="space-y-1">
                      {sessionHealth.repeatPartnerships.map((rp, i) => (
                        <div key={i} className="flex items-center justify-between text-xs bg-purple-50 dark:bg-purple-900/10 rounded-lg px-2 py-1.5">
                          <span className="text-slate-700 dark:text-slate-200 truncate">{rp.playerAName} &amp; {rp.playerBName}</span>
                          <span className="text-purple-600 dark:text-purple-400 font-semibold shrink-0 ml-2">{rp.count}x</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Repeat matchups (bonus, alongside repeat partners) */}
                <div>
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5 flex items-center gap-1">
                    <Repeat className="w-3.5 h-3.5 text-orange-500" />
                    Repeat Matchups
                  </p>
                  {sessionHealth.repeatMatchups.length === 0 ? (
                    <p className="text-xs text-slate-400">No repeat matchups - great variety!</p>
                  ) : (
                    <div className="space-y-1">
                      {sessionHealth.repeatMatchups.map((rm, i) => (
                        <div key={i} className="flex items-center justify-between text-xs bg-orange-50 dark:bg-orange-900/10 rounded-lg px-2 py-1.5">
                          <span className="text-slate-700 dark:text-slate-200 truncate">{rm.teamANames.join(' & ')} vs {rm.teamBNames.join(' & ')}</span>
                          <span className="text-orange-600 dark:text-orange-400 font-semibold shrink-0 ml-2">{rm.count}x</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 4. Longest match */}
                <div>
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5 flex items-center gap-1">
                    <Timer className="w-3.5 h-3.5 text-rose-500" />
                    Longest Match
                  </p>
                  {sessionHealth.longestMatch ? (
                    <div className="flex items-center justify-between text-xs bg-rose-50 dark:bg-rose-900/10 rounded-lg px-2 py-1.5">
                      <span className="text-slate-700 dark:text-slate-200 truncate">
                        {sessionHealth.longestMatch.team1Names.join(' & ')} vs {sessionHealth.longestMatch.team2Names.join(' & ')}
                      </span>
                      <span className="text-rose-600 dark:text-rose-400 font-semibold shrink-0 ml-2">{sessionHealth.longestMatch.minutes}m</span>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400">No completed matches yet</p>
                  )}
                </div>

                {/* 5. Average match per player */}
                <div>
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5 flex items-center gap-1">
                    <Activity className="w-3.5 h-3.5 text-indigo-500" />
                    Average Match Per Player
                  </p>
                  <div className="flex items-center justify-between text-xs bg-indigo-50 dark:bg-indigo-900/10 rounded-lg px-2 py-1.5">
                    <span className="text-slate-700 dark:text-slate-200">Across {activePlayers.length} active player{activePlayers.length !== 1 ? 's' : ''}</span>
                    <span className="text-indigo-600 dark:text-indigo-400 font-semibold shrink-0 ml-2">{sessionHealth.avgGamesPerPlayer.toFixed(1)}</span>
                  </div>
                </div>
              </div>

              {/* Summary */}
              <div className="px-4 py-4 grid grid-cols-3 gap-3 border-t border-slate-100 dark:border-slate-700 mt-2">
                <div className="text-center p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                  <p className="text-xl font-bold text-slate-800 dark:text-slate-100">{totalGames}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Games</p>
                </div>
                <div className="text-center p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                  <p className="text-xl font-bold text-slate-800 dark:text-slate-100">{activePlayers.length}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Players</p>
                </div>
                <div className="text-center p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                  <p className="text-xl font-bold text-slate-800 dark:text-slate-100">
                    {activePlayers.length > 0 ? (totalGames * 4 / activePlayers.length).toFixed(1) : '–'}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Avg GP</p>
                </div>
              </div>
            </>
          )}
        </div>
    </div>
  );
}
