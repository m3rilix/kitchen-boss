import type { Session, Player, Court } from '@/types';
import { useThemeClasses } from '@/store/themeStore';
import { PickleballIcon } from './PickleballIcon';
import { SettingsDropdown } from './SettingsDropdown';
import { Users, Clock, Eye } from 'lucide-react';

interface SharedSessionViewProps {
  session: Session;
  onExit: () => void;
}

export function SharedSessionView({ session, onExit }: SharedSessionViewProps) {
  const theme = useThemeClasses();

  // Get player by ID
  const getPlayerById = (playerId: string): Player | undefined => {
    return session.players.find(p => p.id === playerId);
  };

  // Get players in queue
  const getPlayersInQueue = (): Player[] => {
    return session.queue
      .map(id => session.players.find(p => p.id === id))
      .filter((p): p is Player => p !== undefined);
  };

  // Count players in games
  const playersInGame = session.courts.reduce((count, court) => {
    return count + (court.currentGame ? 4 : 0);
  }, 0);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors">
      {/* Header */}
      <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-40">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            {/* Left: Logo & Session Info */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className={`p-2 ${theme.bg100} rounded-lg`}>
                  <PickleballIcon className={`w-5 h-5 ${theme.text}`} />
                </div>
                <div>
                  <h1 className="font-bold text-slate-800 dark:text-slate-100">{session.name}</h1>
                  <div className="flex items-center gap-1 text-xs text-amber-600">
                    <Eye className="w-3 h-3" />
                    <span>Read-only view</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Stats & Actions */}
            <div className="flex items-center gap-4">
              <div className="hidden sm:flex items-center gap-4 text-sm">
                <div className="flex items-center gap-1.5">
                  <Users className={`w-4 h-4 ${theme.text}`} />
                  <span className="text-slate-600 dark:text-slate-400">
                    <span className="font-semibold text-slate-800 dark:text-slate-100">{playersInGame}</span> playing
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-amber-600" />
                  <span className="text-slate-600 dark:text-slate-400">
                    <span className="font-semibold text-slate-800 dark:text-slate-100">{session.queue.length}</span> waiting
                  </span>
                </div>
              </div>
              <SettingsDropdown />
              <button
                onClick={onExit}
                className="px-3 py-1.5 text-sm font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition"
              >
                Exit
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Courts Section */}
          <div className="lg:col-span-2 space-y-4">
            <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100">
              Courts ({session.courts.length})
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {session.courts.map((court) => (
                <ReadOnlyCourtView key={court.id} court={court} getPlayerById={getPlayerById} />
              ))}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Queue */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700">
                <h3 className="font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-500" />
                  Queue ({session.queue.length})
                </h3>
              </div>
              <div className="p-4">
                {session.queue.length === 0 ? (
                  <p className="text-sm text-slate-500 text-center py-4">No players waiting</p>
                ) : (
                  <div className="space-y-2">
                    {getPlayersInQueue().slice(0, 8).map((player, index) => (
                      <div
                        key={player.id}
                        className={`flex items-center gap-3 p-2 rounded-lg ${
                          index < 4 ? `${theme.bg100} border ${theme.border}` : 'bg-slate-50 dark:bg-slate-700'
                        }`}
                      >
                        <span className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold ${
                          index < 4 ? `${theme.bg500} text-white` : 'bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-300'
                        }`}>
                          {index + 1}
                        </span>
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{player.name}</span>
                        {index < 4 && (
                          <span className={`ml-auto text-xs ${theme.text} font-medium`}>Next up</span>
                        )}
                      </div>
                    ))}
                    {session.queue.length > 8 && (
                      <p className="text-xs text-slate-500 text-center pt-2">
                        +{session.queue.length - 8} more in queue
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* All Players */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700">
                <h3 className="font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                  <Users className="w-4 h-4 text-blue-500" />
                  Players ({session.players.filter(p => p.isActive).length})
                </h3>
              </div>
              <div className="p-4 max-h-64 overflow-y-auto">
                <div className="space-y-1">
                  {session.players.filter(p => p.isActive).map((player) => (
                    <div key={player.id} className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-slate-50 dark:hover:bg-slate-700">
                      <span className="text-sm text-slate-700 dark:text-slate-200">{player.name}</span>
                      <span className="text-xs text-slate-500">{player.gamesPlayed} games</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Activity Log */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700">
                <h3 className="font-semibold text-slate-800 dark:text-slate-100">Recent Activity</h3>
              </div>
              <div className="p-4 max-h-48 overflow-y-auto">
                {session.activityLog.length === 0 ? (
                  <p className="text-sm text-slate-500 text-center py-4">No activity yet</p>
                ) : (
                  <div className="space-y-2">
                    {session.activityLog.slice(0, 10).map((entry) => (
                      <div key={entry.id} className="text-xs text-slate-600 dark:text-slate-400">
                        {entry.message}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

// Read-only court view component
function ReadOnlyCourtView({ court, getPlayerById }: { court: Court; getPlayerById: (id: string) => Player | undefined }) {
  const theme = useThemeClasses();
  const isInGame = court.status === 'in_game' && court.currentGame;
  const isMaintenance = court.status === 'maintenance';

  const team1Players = court.currentGame?.team1.map(id => getPlayerById(id));
  const team2Players = court.currentGame?.team2.map(id => getPlayerById(id));

  return (
    <div className={`bg-white dark:bg-slate-800 rounded-xl border overflow-hidden ${
      isMaintenance ? 'border-orange-300 dark:border-orange-600' : 'border-slate-200 dark:border-slate-700'
    }`}>
      {/* Header */}
      <div className={`px-4 py-3 border-b ${
        isMaintenance 
          ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800' 
          : isInGame 
            ? `${theme.bg100} ${theme.border}` 
            : 'bg-slate-50 dark:bg-slate-700 border-slate-100 dark:border-slate-600'
      }`}>
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-slate-800 dark:text-slate-100">{court.name}</h3>
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
            isMaintenance 
              ? 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300'
              : isInGame 
                ? `${theme.bg100} ${theme.text}` 
                : 'bg-slate-200 text-slate-600 dark:bg-slate-600 dark:text-slate-300'
          }`}>
            {isMaintenance ? 'Maintenance' : isInGame ? 'In Game' : 'Available'}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {isInGame && team1Players && team2Players ? (
          <div className="grid grid-cols-2 gap-4">
            {/* Team 1 */}
            <div className="space-y-2">
              <div className="text-xs font-medium text-slate-500 uppercase tracking-wide">Team 1</div>
              {team1Players.map((player, i) => (
                <div key={i} className="flex items-center gap-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <div className="w-8 h-8 bg-blue-200 dark:bg-blue-800 rounded-full flex items-center justify-center text-blue-700 dark:text-blue-200 font-semibold text-sm">
                    {player?.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">{player?.name}</span>
                </div>
              ))}
            </div>

            {/* Team 2 */}
            <div className="space-y-2">
              <div className="text-xs font-medium text-slate-500 uppercase tracking-wide">Team 2</div>
              {team2Players.map((player, i) => (
                <div key={i} className="flex items-center gap-2 p-2 bg-red-50 dark:bg-red-900/20 rounded-lg">
                  <div className="w-8 h-8 bg-red-200 dark:bg-red-800 rounded-full flex items-center justify-center text-red-700 dark:text-red-200 font-semibold text-sm">
                    {player?.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">{player?.name}</span>
                </div>
              ))}
            </div>
          </div>
        ) : isMaintenance ? (
          <div className="text-center py-6">
            <p className="text-sm text-orange-600 dark:text-orange-400">Under maintenance</p>
          </div>
        ) : (
          <div className="text-center py-6">
            <p className="text-sm text-slate-500">Waiting for players</p>
          </div>
        )}
      </div>
    </div>
  );
}
