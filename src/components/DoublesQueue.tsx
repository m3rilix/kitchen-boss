import { useState } from 'react';
import { useSessionStore } from '@/store/sessionStore';
import { useThemeClasses } from '@/store/themeStore';
import { pairDisplayName, buildDoublesMatchup } from '@/lib/doubles';
import type { Pair } from '@/types';
import { Trophy, TrendingDown, Clock, Plus, X, Pencil, Check, ArrowUp, Swords } from 'lucide-react';

// ── Helpers ───────────────────────────────────────────────────────────────────

const formatWaitTime = (waitingSince: number): string => {
  if (waitingSince <= 0) return '';
  const ms = Date.now() - waitingSince;
  const minutes = Math.floor(ms / 60000);
  if (minutes < 1) return '<1m';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
};

// ── Sub-components ─────────────────────────────────────────────────────────────

interface PairCardProps {
  pair: Pair;
  queueType: 'winner' | 'loser' | 'waiting';
  isInGame: boolean;
  onRemoveFromQueue: () => void;
  onPromote?: () => void;
}

function PairCard({ pair, queueType, isInGame, onRemoveFromQueue, onPromote }: PairCardProps) {
  const { session, renamePair } = useSessionStore();
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');

  if (!session) return null;

  const displayName = pairDisplayName(pair, session.players);
  const p1 = session.players.find(p => p.id === pair.player1Id);
  const p2 = session.players.find(p => p.id === pair.player2Id);
  const losses = pair.gamesPlayed - pair.gamesWon;

  const typeColors = {
    winner: 'border-l-4 border-l-yellow-400 bg-yellow-50 dark:bg-yellow-900/10',
    loser:  'border-l-4 border-l-blue-400 bg-blue-50 dark:bg-blue-900/10',
    waiting:'border-l-4 border-l-slate-300 bg-white dark:bg-slate-800',
  };

  const handleRename = () => {
    if (editName.trim()) {
      renamePair(pair.id, editName.trim());
    }
    setIsEditing(false);
  };

  return (
    <div className={`flex items-center gap-3 p-2.5 rounded-lg ${isInGame ? 'opacity-50' : ''} ${typeColors[queueType]}`}>
      {/* Icon */}
      <div className="shrink-0">
        {queueType === 'winner' && <Trophy className="w-4 h-4 text-yellow-500" />}
        {queueType === 'loser'  && <TrendingDown className="w-4 h-4 text-blue-400" />}
        {queueType === 'waiting' && <Clock className="w-4 h-4 text-slate-400" />}
      </div>

      {/* Name + players */}
      <div className="flex-1 min-w-0">
        {isEditing ? (
          <div className="flex items-center gap-1">
            <input
              autoFocus
              value={editName}
              onChange={e => setEditName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleRename(); if (e.key === 'Escape') setIsEditing(false); }}
              className="flex-1 px-1.5 py-0.5 text-sm border border-blue-400 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <button onClick={handleRename} className="p-0.5 text-green-600 hover:text-green-700">
              <Check className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1 group">
            <p className="font-medium text-sm text-slate-800 dark:text-slate-100 truncate">{displayName}</p>
            <button
              onClick={() => { setEditName(pair.name ?? ''); setIsEditing(true); }}
              className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-400 hover:text-slate-600 transition"
              title="Rename pair"
            >
              <Pencil className="w-3 h-3" />
            </button>
          </div>
        )}
        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <span className="font-semibold text-slate-700 dark:text-slate-300">
            {pair.gamesWon}W–{losses}L
          </span>
          {(p1?.unavailable || p2?.unavailable) && (
            <span className="px-1 py-0.5 bg-red-100 text-red-600 rounded text-xs font-medium">
              {p1?.unavailable ? p1.name : p2?.name} out
            </span>
          )}
          {pair.waitingSince > 0 && (
            <span className="flex items-center gap-0.5">
              <Clock className="w-3 h-3" />
              {formatWaitTime(pair.waitingSince)}
            </span>
          )}
          {isInGame && (
            <span className="px-1 py-0.5 bg-blue-100 text-blue-600 rounded text-xs font-medium">Playing</span>
          )}
        </div>
      </div>

      {/* Actions */}
      {!isInGame && (
        <div className="flex items-center gap-0.5 shrink-0">
          {/* Promote to loser queue (waiting pairs only) */}
          {queueType === 'waiting' && onPromote && (
            <button
              onClick={onPromote}
              className="p-1 text-slate-400 hover:text-amber-500 transition"
              title="Move to loser queue"
            >
              <ArrowUp className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={onRemoveFromQueue}
            className="p-1 text-slate-400 hover:text-red-500 transition"
            title="Remove from queue"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

// ── Queue Section ─────────────────────────────────────────────────────────────

interface QueueSectionProps {
  title: string;
  pairIds: string[];
  queueType: 'winner' | 'loser' | 'waiting';
  playersInGame: Set<string>;
  emptyText: string;
  color: string;
}

function QueueSection({ title, pairIds, queueType, playersInGame, emptyText, color }: QueueSectionProps) {
  const { session, removePairFromQueue, promotePairToLoserQueue } = useSessionStore();
  if (!session) return null;

  const pairs = pairIds
    .map(id => session.pairs?.find(p => p.id === id))
    .filter((p): p is Pair => !!p);

  return (
    <div>
      <div className={`flex items-center gap-2 mb-2`}>
        <div className={`w-2 h-2 rounded-full ${color}`} />
        <h4 className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide">
          {title}
        </h4>
        <span className="text-xs text-slate-400">({pairs.length})</span>
      </div>
      <div className="space-y-1.5">
        {pairs.length === 0 ? (
          <p className="text-xs text-slate-400 italic pl-4">{emptyText}</p>
        ) : (
          pairs.map(pair => {
            const inGame = playersInGame.has(pair.player1Id) || playersInGame.has(pair.player2Id);
            return (
              <PairCard
                key={pair.id}
                pair={pair}
                queueType={queueType}
                isInGame={inGame}
                onRemoveFromQueue={() => removePairFromQueue(pair.id)}
                onPromote={queueType === 'waiting' ? () => promotePairToLoserQueue(pair.id) : undefined}
              />
            );
          })
        )}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function DoublesQueue() {
  const { session, addPairToQueue } = useSessionStore();
  const theme = useThemeClasses();
  const [showAddMenu, setShowAddMenu] = useState(false);

  if (!session) return null;

  // Players currently in a game
  const playersInGame = new Set<string>();
  session.courts.forEach(c => {
    if (c.currentGame) {
      c.currentGame.team1.forEach(id => playersInGame.add(id));
      c.currentGame.team2.forEach(id => playersInGame.add(id));
    }
  });

  const allQueuedPairIds = new Set([
    ...(session.doublesWinnerQueue  ?? []),
    ...(session.doublesLoserQueue   ?? []),
    ...(session.doublesWaitingQueue ?? []),
  ]);

  // Pairs not in any queue and not in a game (available to be added to queue)
  const unqueuedPairs = (session.pairs ?? []).filter(pair => {
    if (allQueuedPairIds.has(pair.id)) return false;
    // Not currently playing
    if (playersInGame.has(pair.player1Id) || playersInGame.has(pair.player2Id)) return false;
    // Both players still active
    const p1 = session.players.find(p => p.id === pair.player1Id);
    const p2 = session.players.find(p => p.id === pair.player2Id);
    return p1?.isActive && p2?.isActive;
  });

  const totalQueued =
    (session.doublesWinnerQueue?.length ?? 0) +
    (session.doublesLoserQueue?.length  ?? 0) +
    (session.doublesWaitingQueue?.length ?? 0);

  // Compute next matchup preview
  const nextMatchup = totalQueued >= 2 ? buildDoublesMatchup(session) : null;

  const queueBadge = {
    winner:  { label: 'W', bg: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300' },
    loser:   { label: 'L', bg: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' },
    waiting: { label: '~', bg: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300' },
  } as const;

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-slate-800 dark:text-slate-100">
            Doubles Queue ({totalQueued})
          </h3>
          {unqueuedPairs.length > 0 && (
            <div className="relative">
              <button
                onClick={() => setShowAddMenu(!showAddMenu)}
                className={`flex items-center gap-1 px-2 py-1 text-sm font-medium ${theme.textButton} ${theme.bgButton} rounded-lg transition`}
              >
                <Plus className="w-4 h-4" />
                Add
              </button>
              {showAddMenu && (
                <div className="absolute right-0 mt-1 w-52 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg z-50 py-1">
                  <p className="px-3 py-1 text-xs text-slate-400 uppercase font-semibold">Add pair to queue</p>
                  {unqueuedPairs.map(pair => (
                    <button
                      key={pair.id}
                      onClick={() => {
                        addPairToQueue(pair.id);
                        setShowAddMenu(false);
                      }}
                      className="w-full px-3 py-2 text-left text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center justify-between"
                    >
                      <span>{pairDisplayName(pair, session.players)}</span>
                      <span className="text-xs text-slate-400">
                        {pair.gamesWon}W–{pair.gamesPlayed - pair.gamesWon}L
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Next Match Preview */}
      {nextMatchup && (
        <div className="mx-4 mt-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800/60 dark:to-slate-700/40 p-3">
          <div className="flex items-center gap-1.5 mb-2.5">
            <Swords className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Next Match</span>
          </div>
          <div className="flex items-center gap-2">
            {/* Pair A */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${queueBadge[nextMatchup.pairASource].bg}`}>
                  {queueBadge[nextMatchup.pairASource].label}
                </span>
                <span className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">
                  {pairDisplayName(nextMatchup.pairA, session.players)}
                </span>
              </div>
            </div>
            {/* VS divider */}
            <div className="shrink-0 px-1">
              <span className="text-xs font-black text-slate-400 dark:text-slate-500">VS</span>
            </div>
            {/* Pair B */}
            <div className="flex-1 min-w-0 text-right">
              <div className="flex items-center gap-1.5 justify-end">
                <span className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">
                  {pairDisplayName(nextMatchup.pairB, session.players)}
                </span>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${queueBadge[nextMatchup.pairBSource].bg}`}>
                  {queueBadge[nextMatchup.pairBSource].label}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Queue sections */}
      <div className="p-4 space-y-5">
        {totalQueued === 0 ? (
          <p className="text-sm text-slate-400 text-center py-4">
            No pairs in queue. Add pairs to get started.
          </p>
        ) : (
          <>
            <QueueSection
              title="Winners"
              pairIds={session.doublesWinnerQueue ?? []}
              queueType="winner"
              playersInGame={playersInGame}
              emptyText="No pairs queued"
              color="bg-yellow-400"
            />
            <QueueSection
              title="Losers"
              pairIds={session.doublesLoserQueue ?? []}
              queueType="loser"
              playersInGame={playersInGame}
              emptyText="No pairs queued"
              color="bg-blue-400"
            />
            <QueueSection
              title="Waiting"
              pairIds={session.doublesWaitingQueue ?? []}
              queueType="waiting"
              playersInGame={playersInGame}
              emptyText="No pairs queued"
              color="bg-slate-300"
            />
          </>
        )}
      </div>
    </div>
  );
}
