import { useSessionStore } from '@/store/sessionStore';
import { pairDisplayName } from '@/lib/doubles';
import type { Player, Pair } from '@/types';
import { X, Trophy } from 'lucide-react';
import { PickleballIcon } from './PickleballIcon';

// ── Rank helpers ──────────────────────────────────────────────────────────────

function rankPlayers(players: Player[]): Player[] {
  return [...players]
    .filter(p => p.isActive)
    .sort((a, b) => {
      // 1. Most wins
      if (b.gamesWon !== a.gamesWon) return b.gamesWon - a.gamesWon;
      // 2. Highest win rate (among players who have played)
      const aRate = a.gamesPlayed > 0 ? a.gamesWon / a.gamesPlayed : 0;
      const bRate = b.gamesPlayed > 0 ? b.gamesWon / b.gamesPlayed : 0;
      if (bRate !== aRate) return bRate - aRate;
      // 3. Most games played
      return b.gamesPlayed - a.gamesPlayed;
    });
}

function rankPairs(pairs: Pair[]): Pair[] {
  return [...pairs].sort((a, b) => {
    if (b.gamesWon !== a.gamesWon) return b.gamesWon - a.gamesWon;
    const aRate = a.gamesPlayed > 0 ? a.gamesWon / a.gamesPlayed : 0;
    const bRate = b.gamesPlayed > 0 ? b.gamesWon / b.gamesPlayed : 0;
    if (bRate !== aRate) return bRate - aRate;
    return b.gamesPlayed - a.gamesPlayed;
  });
}

function winPct(won: number, played: number): string {
  if (played === 0) return '–';
  return Math.round((won / played) * 100) + '%';
}

// ── Medal badge ───────────────────────────────────────────────────────────────

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <span className="text-lg">🥇</span>;
  if (rank === 2) return <span className="text-lg">🥈</span>;
  if (rank === 3) return <span className="text-lg">🥉</span>;
  return <span className="text-sm font-semibold text-slate-400 w-6 text-center">{rank}</span>;
}

// ── Podium (top 3) ────────────────────────────────────────────────────────────

interface PodiumProps {
  players: Player[];
}

function Podium({ players }: PodiumProps) {
  const top3 = players.slice(0, 3);
  if (top3.length === 0) return null;

  // Reorder: 2nd, 1st, 3rd for visual podium effect
  const order = [top3[1], top3[0], top3[2]].filter(Boolean);
  const heights = top3[1] ? ['h-16', 'h-24', 'h-12'] : ['h-24'];
  const heightMap: Record<string, string> = {
    [top3[0]?.name]: top3[1] ? 'h-24' : 'h-24',
    [top3[1]?.name]: 'h-16',
    [top3[2]?.name]: 'h-12',
  };
  const colorMap: Record<string, string> = {
    [top3[0]?.name]: 'bg-yellow-100 border-yellow-300 dark:bg-yellow-900/20 dark:border-yellow-700',
    [top3[1]?.name]: 'bg-slate-100 border-slate-300 dark:bg-slate-700 dark:border-slate-500',
    [top3[2]?.name]: 'bg-orange-50 border-orange-200 dark:bg-orange-900/20 dark:border-orange-800',
  };

  return (
    <div className="flex items-end justify-center gap-3 mb-6 mt-2">
      {order.map((player) => {
        if (!player) return null;
        const rank = top3.indexOf(player) + 1;
        return (
          <div key={player.id} className="flex flex-col items-center gap-1">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm border-2 ${colorMap[player.name] || 'bg-slate-100 border-slate-300'}`}>
              {player.name.charAt(0).toUpperCase()}
            </div>
            <p className="text-xs font-medium text-slate-700 dark:text-slate-300 max-w-[64px] truncate text-center">{player.name}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">{player.gamesWon}W</p>
            <div className={`w-16 ${heightMap[player.name] || heights[0]} rounded-t-lg border-t border-x flex items-center justify-center ${colorMap[player.name] || 'bg-slate-100 border-slate-300'}`}>
              <RankBadge rank={rank} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Player row ────────────────────────────────────────────────────────────────

interface PlayerRowProps {
  rank: number;
  player: Player;
  partnerName?: string;
}

function PlayerRow({ rank, player, partnerName }: PlayerRowProps) {
  const losses = player.gamesPlayed - player.gamesWon;
  const isTop3 = rank <= 3;

  return (
    <div className={`flex items-center gap-3 px-4 py-2.5 ${isTop3 ? 'bg-yellow-50/40 dark:bg-yellow-900/5' : ''} ${rank % 2 === 0 ? 'bg-slate-50/60 dark:bg-slate-800/30' : ''}`}>
      <div className="w-8 flex items-center justify-center shrink-0">
        <RankBadge rank={rank} />
      </div>
      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold text-sm shrink-0 ${
        rank === 1 ? 'bg-yellow-200 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-100' :
        rank === 2 ? 'bg-slate-200 text-slate-700 dark:bg-slate-600 dark:text-slate-100' :
        rank === 3 ? 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-200' :
        'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
      }`}>
        {player.name.charAt(0).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-slate-800 dark:text-slate-100 text-sm truncate">{player.name}</p>
        {partnerName && (
          <p className="text-xs text-slate-400 dark:text-slate-500">with {partnerName}</p>
        )}
      </div>
      <div className="flex items-center gap-4 text-sm shrink-0">
        <div className="text-center min-w-[40px]">
          <p className="font-bold text-green-600 dark:text-green-400">{player.gamesWon}</p>
          <p className="text-xs text-slate-400">W</p>
        </div>
        <div className="text-center min-w-[40px]">
          <p className="font-bold text-red-500 dark:text-red-400">{losses}</p>
          <p className="text-xs text-slate-400">L</p>
        </div>
        <div className="text-center min-w-[40px]">
          <p className="font-semibold text-slate-700 dark:text-slate-300">{winPct(player.gamesWon, player.gamesPlayed)}</p>
          <p className="text-xs text-slate-400">Win%</p>
        </div>
        <div className="text-center min-w-[40px]">
          <p className="font-medium text-slate-600 dark:text-slate-400">{player.gamesPlayed}</p>
          <p className="text-xs text-slate-400">GP</p>
        </div>
      </div>
    </div>
  );
}

// ── Pair row ──────────────────────────────────────────────────────────────────

interface PairRowProps {
  rank: number;
  pair: Pair;
  players: Player[];
}

function PairRow({ rank, pair, players }: PairRowProps) {
  const losses = pair.gamesPlayed - pair.gamesWon;
  const isTop3 = rank <= 3;
  const name = pairDisplayName(pair, players);

  return (
    <div className={`flex items-center gap-3 px-4 py-2.5 ${isTop3 ? 'bg-yellow-50/40 dark:bg-yellow-900/5' : ''} ${rank % 2 === 0 ? 'bg-slate-50/60 dark:bg-slate-800/30' : ''}`}>
      <div className="w-8 flex items-center justify-center shrink-0">
        <RankBadge rank={rank} />
      </div>
      <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-bold">
        2s
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-slate-800 dark:text-slate-100 text-sm truncate">{name}</p>
      </div>
      <div className="flex items-center gap-4 text-sm shrink-0">
        <div className="text-center min-w-[40px]">
          <p className="font-bold text-green-600 dark:text-green-400">{pair.gamesWon}</p>
          <p className="text-xs text-slate-400">W</p>
        </div>
        <div className="text-center min-w-[40px]">
          <p className="font-bold text-red-500 dark:text-red-400">{losses}</p>
          <p className="text-xs text-slate-400">L</p>
        </div>
        <div className="text-center min-w-[40px]">
          <p className="font-semibold text-slate-700 dark:text-slate-300">{winPct(pair.gamesWon, pair.gamesPlayed)}</p>
          <p className="text-xs text-slate-400">Win%</p>
        </div>
        <div className="text-center min-w-[40px]">
          <p className="font-medium text-slate-600 dark:text-slate-400">{pair.gamesPlayed}</p>
          <p className="text-xs text-slate-400">GP</p>
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface SessionReportProps {
  onClose: () => void;
  onEndSession: () => void;
  isEndOfSession?: boolean; // true = show "End Session" CTA; false = mid-session view
}

export function SessionReport({ onClose, onEndSession, isEndOfSession = false }: SessionReportProps) {
  const { session } = useSessionStore();

  if (!session) return null;

  const isDoubles = session.rotationMode === 'doubles';
  const rankedPlayers = rankPlayers(session.players);
  const rankedPairs = isDoubles ? rankPairs(session.pairs ?? []) : [];
  const totalGames = session.gamesCompleted.length;
  const activePlayers = session.players.filter(p => p.isActive);

  // For doubles: build a map of playerId → partner name
  const partnerMap = new Map<string, string>();
  if (isDoubles) {
    (session.pairs ?? []).forEach(pair => {
      const p1 = session.players.find(p => p.id === pair.player1Id);
      const p2 = session.players.find(p => p.id === pair.player2Id);
      if (p1 && p2) {
        partnerMap.set(p1.id, p2.name);
        partnerMap.set(p2.id, p1.name);
      }
    });
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className={`px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between shrink-0`}>
          <div>
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <Trophy className="w-5 h-5 text-yellow-500" />
              {isEndOfSession ? 'Session Results' : 'Leaderboard'}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {session.name} · {totalGames} game{totalGames !== 1 ? 's' : ''} · {activePlayers.length} player{activePlayers.length !== 1 ? 's' : ''}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">

          {totalGames === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400 dark:text-slate-500">
              <PickleballIcon className="w-12 h-12 mb-3 opacity-30" />
              <p className="text-sm">No games played yet</p>
              <p className="text-xs mt-1">Finish some games to see rankings</p>
            </div>
          ) : (
            <>
              {/* Podium */}
              {rankedPlayers.length >= 2 && (
                <div className="px-4 pt-4">
                  <Podium players={rankedPlayers} />
                </div>
              )}

              {/* Player Rankings */}
              <div>
                <div className="px-4 py-2 bg-slate-50 dark:bg-slate-700/50 border-y border-slate-100 dark:border-slate-700">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                      Player Rankings
                    </p>
                    <div className="flex items-center gap-4 text-xs text-slate-400 pr-1">
                      <span className="w-[40px] text-center">W</span>
                      <span className="w-[40px] text-center">L</span>
                      <span className="w-[40px] text-center">Win%</span>
                      <span className="w-[40px] text-center">GP</span>
                    </div>
                  </div>
                </div>
                {rankedPlayers.map((player, idx) => (
                  <PlayerRow
                    key={player.id}
                    rank={idx + 1}
                    player={player}
                    partnerName={partnerMap.get(player.id)}
                  />
                ))}
              </div>

              {/* Doubles: Pair Rankings */}
              {isDoubles && rankedPairs.length > 0 && (
                <div className="mt-2">
                  <div className="px-4 py-2 bg-slate-50 dark:bg-slate-700/50 border-y border-slate-100 dark:border-slate-700">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                        Pair Rankings
                      </p>
                      <div className="flex items-center gap-4 text-xs text-slate-400 pr-1">
                        <span className="w-[40px] text-center">W</span>
                        <span className="w-[40px] text-center">L</span>
                        <span className="w-[40px] text-center">Win%</span>
                        <span className="w-[40px] text-center">GP</span>
                      </div>
                    </div>
                  </div>
                  {rankedPairs.map((pair, idx) => (
                    <PairRow
                      key={pair.id}
                      rank={idx + 1}
                      pair={pair}
                      players={session.players}
                    />
                  ))}
                </div>
              )}

              {/* Summary stats */}
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

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-700 flex gap-3 shrink-0">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-lg transition"
          >
            {isEndOfSession ? 'Keep Session Open' : 'Close'}
          </button>
          {isEndOfSession && (
            <button
              onClick={onEndSession}
              className="flex-1 py-2.5 text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded-lg transition"
            >
              End Session
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
