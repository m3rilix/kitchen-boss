import { useState, useEffect } from 'react';
import { useSessionStore } from '@/store/sessionStore';
import { useThemeClasses } from '@/store/themeStore';
import { getWaitTime } from '@/lib/utils';
import { ChevronUp, ChevronDown, X, Users, ChevronsUp, Search } from 'lucide-react';

export function PlayerQueue() {
  const { session, getPlayersInQueue, moveInQueue, removeFromQueue, moveToFrontOfQueue } = useSessionStore();
  const theme = useThemeClasses();
  const [insertedPlayer, setInsertedPlayer] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Clear notification after 3 seconds
  useEffect(() => {
    if (insertedPlayer) {
      const timer = setTimeout(() => setInsertedPlayer(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [insertedPlayer]);

  if (!session) return null;

  const queuedPlayers = getPlayersInQueue();
  
  // Filter players by search query
  const filteredPlayers = searchQuery.trim()
    ? queuedPlayers.filter(player => 
        player.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : queuedPlayers;

  const handleMoveToFront = (playerId: string, playerName: string) => {
    moveToFrontOfQueue(playerId);
    setInsertedPlayer(playerName);
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden transition-colors">
      <div className="p-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <Users className={`w-4 h-4 ${theme.text}`} />
            Paddle Queue
          </h3>
          <span className="text-sm text-slate-500 dark:text-slate-400">{queuedPlayers.length} waiting</span>
        </div>
        {/* Search Input */}
        {queuedPlayers.length > 0 && (
          <div className="relative">
            <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search player..."
              className="w-full pl-8 pr-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Inserted Player Notification */}
      {insertedPlayer && (
        <div className="px-4 py-2 bg-purple-50 dark:bg-purple-900/30 border-b border-purple-100 dark:border-purple-800">
          <span className="text-sm text-purple-700 dark:text-purple-300">
            <span className="font-medium">{insertedPlayer}</span> moved to front of queue!
          </span>
        </div>
      )}

      <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
        {queuedPlayers.length === 0 ? (
          <div className="p-6 text-center text-slate-500">
            <p className="text-sm">No players in queue</p>
            <p className="text-xs mt-1">Add players to get started</p>
          </div>
        ) : filteredPlayers.length === 0 ? (
          <div className="p-6 text-center text-slate-500">
            <p className="text-sm">No players match "{searchQuery}"</p>
            <button
              onClick={() => setSearchQuery('')}
              className="text-xs text-blue-600 hover:underline mt-1"
            >
              Clear search
            </button>
          </div>
        ) : (
          filteredPlayers.map((player) => {
            // Get original index for position display
            const originalIndex = queuedPlayers.findIndex(p => p.id === player.id);
            const isNextUp = originalIndex < 4;
            return (
              <div
                key={player.id}
                className={`flex items-center gap-3 p-3 transition ${
                  originalIndex === 0 && insertedPlayer === player.name 
                    ? 'bg-purple-50 dark:bg-purple-900/30' 
                    : isNextUp 
                      ? `bg-gradient-to-r ${theme.queueHighlight} to-transparent border-l-4 ${theme.border}`
                      : 'hover:bg-slate-50 dark:hover:bg-slate-700/50'
                } ${searchQuery && 'bg-yellow-50 dark:bg-yellow-900/20'}`}
              >
                {/* Position */}
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                  originalIndex < 4 
                    ? `${theme.bg600} text-white` 
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                }`}>
                  {originalIndex + 1}
                </div>

              {/* Player Info */}
              <div className="flex-1 min-w-0">
                <p className={`font-medium truncate ${
                  isNextUp ? 'text-slate-900 dark:text-white' : 'text-slate-800 dark:text-slate-200'
                }`}>
                  {player.name}
                  {originalIndex < 4 && <span className={`ml-2 text-xs font-normal ${theme.text}`}>Next up!</span>}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Waiting {getWaitTime(new Date(player.checkedInAt))}
                </p>
              </div>

                {/* Actions */}
                <div className="flex items-center gap-1">
                  {/* Skip to Front button - only show if not already first */}
                  {originalIndex > 0 && (
                    <button
                      onClick={() => handleMoveToFront(player.id, player.name)}
                      className="p-1 text-slate-400 hover:text-purple-600 transition"
                      title="Skip to front of queue"
                    >
                      <ChevronsUp className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={() => moveInQueue(player.id, 'up')}
                    disabled={originalIndex === 0}
                    className="p-1 text-slate-400 hover:text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Move up"
                  >
                    <ChevronUp className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => moveInQueue(player.id, 'down')}
                    disabled={originalIndex === queuedPlayers.length - 1}
                    className="p-1 text-slate-400 hover:text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Move down"
                  >
                    <ChevronDown className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => removeFromQueue(player.id)}
                    className="p-1 text-slate-400 hover:text-red-500"
                    title="Remove from queue"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {queuedPlayers.length >= 4 && (
        <div className={`p-3 ${theme.bg100} border-t border-slate-100 dark:border-slate-700`}>
          <p className={`text-xs ${theme.textDark} text-center font-medium`}>
            Next 4 players ready for court assignment
          </p>
        </div>
      )}
    </div>
  );
}
