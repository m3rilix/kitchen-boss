import type { Session, Player, Court, ActivityType } from '@/types';
import { useThemeClasses } from '@/store/themeStore';
import { PickleballIcon } from './PickleballIcon';
import { SettingsDropdown } from './SettingsDropdown';
import { useState, useMemo } from 'react';
import { Users, Clock, Wifi, Trophy, UserPlus, Play, UserMinus, History, Rocket, Search, ArrowUpDown, ArrowUp, ArrowDown, Layers } from 'lucide-react';

interface SharedSessionViewProps {
  session: Session;
  onExit: () => void;
}

// Format waiting time - only show "Just joined" for players with 0 games
const formatWaitTime = (waitingSince: number, gamesPlayed: number = 0): string => {
  if (waitingSince === 0) return 'In game';
  const now = Date.now();
  const waitMs = now - waitingSince;
  const minutes = Math.floor(waitMs / 60000);
  if (minutes < 1) return gamesPlayed === 0 ? 'Just joined' : '<1m';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
};

// Get activity icon
const getActivityIcon = (type: ActivityType) => {
  switch (type) {
    case 'game_started':
      return <Play className="w-3.5 h-3.5 text-blue-500" />;
    case 'game_ended':
      return <Trophy className="w-3.5 h-3.5 text-amber-500" />;
    case 'player_added':
      return <UserPlus className="w-3.5 h-3.5 text-green-500" />;
    case 'player_removed':
      return <UserMinus className="w-3.5 h-3.5 text-red-500" />;
    case 'stack_skipped':
      return <Rocket className="w-3.5 h-3.5 text-purple-500" />;
    default:
      return <History className="w-3.5 h-3.5 text-slate-400" />;
  }
};

// Format date for display
const formatDate = (dateStr?: string) => {
  if (!dateStr) return '';
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
};

// Format time for display
const formatTime = (timeStr?: string) => {
  if (!timeStr) return '';
  const [hours, minutes] = timeStr.split(':');
  const hour = parseInt(hours);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 || 12;
  return `${hour12}:${minutes} ${ampm}`;
};

// Format activity timestamp
const formatActivityTime = (date: Date) => {
  const d = new Date(date);
  return d.toLocaleTimeString('en-US', { 
    hour: 'numeric', 
    minute: '2-digit',
    hour12: true 
  });
};

// Sort options for All Players
const sortOptions = [
  { value: 'name', label: 'Name' },
  { value: 'games', label: 'Games' },
  { value: 'wins', label: 'Wins' },
  { value: 'waitTime', label: 'Wait Time' },
] as const;

type SortOption = typeof sortOptions[number]['value'];

export function SharedSessionView({ session, onExit }: SharedSessionViewProps) {
  const theme = useThemeClasses();
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [showSortMenu, setShowSortMenu] = useState(false);

  // Get player by ID
  const getPlayerById = (playerId: string): Player | undefined => {
    return session.players.find(p => p.id === playerId);
  };

  // Build stacks matching the Manager View logic exactly
  const stackQueue = useMemo(() => {
    const getPlayersInStackOrder = (stackIds: string[]): Player[] => {
      return stackIds
        .map(id => session.players.find(p => p.id === id))
        .filter((p): p is Player => p !== undefined && p.isActive);
    };
    
    // Get players by stack type
    const winners = getPlayersInStackOrder(session.winnerStack ?? []);
    const losers = getPlayersInStackOrder(session.loserStack ?? []);
    const free = getPlayersInStackOrder(session.waitingStack ?? []);
    
    // Combine losers + free and sort by wait time (matches game selection logic)
    const allLosersAndFree = [...losers, ...free].sort((a, b) => {
      if (a.waitingSince === 0 && b.waitingSince === 0) return 0;
      if (a.waitingSince === 0) return 1;
      if (b.waitingSince === 0) return -1;
      return a.waitingSince - b.waitingSince;
    });
    
    type StackGroup = {
      id: string;
      players: Player[];
      type: 'winners' | 'mixed' | 'forming';
      label: string;
      isReady: boolean;
    };
    
    const stacks: StackGroup[] = [];
    let stackNumber = 1;
    
    // Winner stacks (ready groups of 4)
    const winnerReadyCount = Math.floor(winners.length / 4);
    for (let i = 0; i < winnerReadyCount; i++) {
      stacks.push({
        id: `winners-${i}`,
        players: winners.slice(i * 4, (i + 1) * 4),
        type: 'winners',
        label: `Stack ${stackNumber++}`,
        isReady: true,
      });
    }
    
    // Mixed stacks from losers + free (ready groups of 4)
    const mixedReadyCount = Math.floor(allLosersAndFree.length / 4);
    for (let i = 0; i < mixedReadyCount; i++) {
      stacks.push({
        id: `mixed-${i}`,
        players: allLosersAndFree.slice(i * 4, (i + 1) * 4),
        type: 'mixed',
        label: `Stack ${stackNumber++}`,
        isReady: true,
      });
    }
    
    // Forming stacks (remaining players)
    const remainingWinners = winners.slice(winnerReadyCount * 4);
    const remainingMixed = allLosersAndFree.slice(mixedReadyCount * 4);
    
    if (remainingWinners.length > 0) {
      stacks.push({
        id: 'forming-winners',
        players: remainingWinners,
        type: 'forming',
        label: `Winners Forming (${remainingWinners.length}/4)`,
        isReady: false,
      });
    }
    
    if (remainingMixed.length > 0) {
      stacks.push({
        id: 'forming-mixed',
        players: remainingMixed,
        type: 'forming',
        label: `Forming (${remainingMixed.length}/4)`,
        isReady: false,
      });
    }
    
    return stacks;
  }, [session.players, session.winnerStack, session.loserStack, session.waitingStack]);

  // Count players in games
  const playersInGame = session.courts.reduce((count, court) => {
    return count + (court.currentGame ? 4 : 0);
  }, 0);

  // Get player status based on their stack
  const getPlayerStatus = (playerId: string): 'winner' | 'loser' | 'waiting' | 'playing' => {
    // Check if in game
    for (const court of session.courts) {
      if (court.currentGame) {
        if (court.currentGame.team1.includes(playerId) || court.currentGame.team2.includes(playerId)) {
          return 'playing';
        }
      }
    }
    if (session.winnerStack?.includes(playerId)) return 'winner';
    if (session.loserStack?.includes(playerId)) return 'loser';
    return 'waiting';
  };

  // Filter and sort players
  const filteredAndSortedPlayers = useMemo(() => {
    let players = session.players.filter(p => p.isActive);
    
    // Filter by search
    if (searchQuery.trim()) {
      players = players.filter(p => 
        p.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    // Sort
    return players.sort((a, b) => {
      let result = 0;
      switch (sortBy) {
        case 'name':
          result = a.name.localeCompare(b.name);
          break;
        case 'games':
          result = a.gamesPlayed - b.gamesPlayed;
          break;
        case 'wins':
          result = a.gamesWon - b.gamesWon;
          break;
        case 'waitTime':
          result = a.waitingSince - b.waitingSince;
          break;
      }
      return sortDir === 'asc' ? result : -result;
    });
  }, [session.players, searchQuery, sortBy, sortDir]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors">
      {/* Header */}
      <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-40">
        <div className="container mx-auto px-4 py-3">
          {/* Main Row */}
          <div className="flex items-center justify-between gap-4">
            {/* Left: Logo + Title */}
            <div className="flex items-center gap-3 min-w-0">
              <div className={`w-10 h-10 ${theme.bg100} rounded-full flex items-center justify-center flex-shrink-0`}>
                <PickleballIcon className={`w-6 h-6 ${theme.text}`} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h1 className="font-bold text-slate-800 dark:text-slate-100 truncate">{session.name}</h1>
                  <div className="flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium text-green-600 bg-green-50 dark:bg-green-900/30 rounded-full">
                    <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                    <Wifi className="w-3 h-3" />
                    <span>Live</span>
                  </div>
                </div>
                {(session.location || session.date) && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                    {session.location && <span>{session.location}</span>}
                    {session.location && session.date && <span> • </span>}
                    {session.date && <span>{formatDate(session.date)} {formatTime(session.time)}</span>}
                  </p>
                )}
              </div>
            </div>

            {/* Center: Stats (desktop only) - matches SessionHeader */}
            <div className="hidden md:flex items-center gap-4 px-4 py-2 bg-slate-100 dark:bg-slate-700/50 rounded-lg">
              <div className="flex items-center gap-2 text-sm">
                <Users className="w-4 h-4 text-green-600 dark:text-green-400" />
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Playing</p>
                  <p className="font-semibold text-slate-800 dark:text-slate-100">{playersInGame}</p>
                </div>
              </div>
              <div className="w-px h-8 bg-slate-200 dark:bg-slate-600" />
              <div className="flex items-center gap-2 text-sm">
                <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Waiting</p>
                  <p className="font-semibold text-slate-800 dark:text-slate-100">{session.queue.length}</p>
                </div>
              </div>
              <div className="w-px h-8 bg-slate-200 dark:bg-slate-600" />
              <div className="text-sm">
                <p className="text-xs text-slate-500 dark:text-slate-400">Courts</p>
                <p className="font-semibold text-slate-800 dark:text-slate-100">{session.courts.length}</p>
              </div>
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-2">
              <SettingsDropdown />
              <button
                onClick={onExit}
                className="px-3 py-1.5 text-sm font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600 transition"
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
            {/* Stack Queue - matches Manager View exactly */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700">
                <h3 className="font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-amber-500" />
                  Stack Queue ({session.queue.length})
                </h3>
              </div>
              <div className="p-3 max-h-80 overflow-y-auto">
                {stackQueue.length === 0 ? (
                  <p className="text-sm text-slate-500 text-center py-4">No players waiting</p>
                ) : (
                  <div className="space-y-3">
                    {stackQueue.map((stack) => (
                      <div key={stack.id} className="space-y-1">
                        {/* Stack Header */}
                        <div className={`flex items-center justify-between px-2 py-1 rounded-lg ${
                          stack.isReady 
                            ? stack.type === 'winners' 
                              ? 'bg-green-100 dark:bg-green-900/30' 
                              : 'bg-blue-100 dark:bg-blue-900/30'
                            : 'bg-slate-100 dark:bg-slate-700'
                        }`}>
                          <span className={`text-xs font-semibold ${
                            stack.isReady
                              ? stack.type === 'winners'
                                ? 'text-green-700 dark:text-green-300'
                                : 'text-blue-700 dark:text-blue-300'
                              : 'text-slate-600 dark:text-slate-400'
                          }`}>
                            {stack.label}
                          </span>
                          {stack.isReady && (
                            <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                              <Play className="w-3 h-3" />
                              Ready
                            </span>
                          )}
                        </div>
                        {/* Stack Players */}
                        <div className="grid grid-cols-2 gap-1">
                          {stack.players.map((player) => (
                            <div
                              key={player.id}
                              className={`flex items-center gap-2 p-1.5 rounded-lg text-xs ${
                                stack.type === 'winners'
                                  ? 'bg-green-50 dark:bg-green-900/20'
                                  : stack.isReady
                                    ? 'bg-blue-50 dark:bg-blue-900/20'
                                    : 'bg-slate-50 dark:bg-slate-700/50'
                              }`}
                            >
                              <div className={`w-5 h-5 rounded-full flex items-center justify-center font-semibold text-xs flex-shrink-0 ${
                                stack.type === 'winners'
                                  ? 'bg-green-200 dark:bg-green-800 text-green-700 dark:text-green-200'
                                  : 'bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-300'
                              }`}>
                                {player.name.charAt(0).toUpperCase()}
                              </div>
                              <span className="truncate text-slate-700 dark:text-slate-200">{player.name}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* All Players */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700">
                <h3 className="font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                  <Users className="w-4 h-4 text-blue-500" />
                  All Players ({session.players.filter(p => p.isActive).length})
                </h3>
              </div>
              
              {/* Search and Sort */}
              <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-700 flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search..."
                    className="w-full pl-7 pr-2 py-1 text-xs border border-slate-200 dark:border-slate-600 rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200"
                  />
                </div>
                <div className="relative flex items-center">
                  <button
                    onClick={() => setShowSortMenu(!showSortMenu)}
                    className="flex items-center gap-1 px-2 py-1 text-xs text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-l-lg hover:bg-slate-200 dark:hover:bg-slate-600"
                  >
                    <ArrowUpDown className="w-3 h-3" />
                    {sortOptions.find(o => o.value === sortBy)?.label}
                  </button>
                  <button
                    onClick={() => setSortDir(sortDir === 'asc' ? 'desc' : 'asc')}
                    className="flex items-center px-1.5 py-1 text-xs text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 border border-l-0 border-slate-200 dark:border-slate-600 rounded-r-lg hover:bg-slate-200 dark:hover:bg-slate-600"
                    title={sortDir === 'asc' ? 'Ascending' : 'Descending'}
                  >
                    {sortDir === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
                  </button>
                  {showSortMenu && (
                    <div className="absolute right-0 top-full mt-1 w-28 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg shadow-lg z-50 py-1">
                      {sortOptions.map(option => (
                        <button
                          key={option.value}
                          onClick={() => {
                            setSortBy(option.value);
                            setShowSortMenu(false);
                          }}
                          className={`w-full px-3 py-1 text-left text-xs hover:bg-slate-50 dark:hover:bg-slate-700 ${
                            sortBy === option.value ? 'text-blue-600 font-medium' : 'text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              
              <div className="p-3 max-h-64 overflow-y-auto">
                <div className="space-y-2">
                  {filteredAndSortedPlayers.map((player) => {
                    const status = getPlayerStatus(player.id);
                    return (
                      <div key={player.id} className={`flex items-center gap-3 p-2 rounded-lg ${
                        status === 'playing' ? 'bg-blue-50 dark:bg-blue-900/20' : 'hover:bg-slate-50 dark:hover:bg-slate-700'
                      }`}>
                        {/* Avatar with status color */}
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold text-sm flex-shrink-0 ${
                          status === 'playing' 
                            ? 'bg-blue-200 dark:bg-blue-800 text-blue-700 dark:text-blue-200'
                            : status === 'winner'
                              ? 'bg-green-200 dark:bg-green-800 text-green-700 dark:text-green-200'
                              : status === 'loser'
                                ? 'bg-orange-200 dark:bg-orange-800 text-orange-700 dark:text-orange-200'
                                : 'bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-300'
                        }`}>
                          {player.name.charAt(0).toUpperCase()}
                        </div>
                        {/* Player info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">{player.name}</span>
                            {status === 'playing' && (
                              <span className="px-1.5 py-0.5 text-xs font-medium bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded">
                                Playing
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                            <span>{player.gamesPlayed} games</span>
                            {player.waitingSince > 0 && (
                              <>
                                <span>•</span>
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {formatWaitTime(player.waitingSince, player.gamesPlayed)}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Activity Log */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700">
                <h3 className="font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                  <History className="w-4 h-4 text-slate-500" />
                  Recent Activity
                </h3>
              </div>
              <div className="p-4 max-h-48 overflow-y-auto">
                {session.activityLog.length === 0 ? (
                  <p className="text-sm text-slate-500 text-center py-4">No activity yet</p>
                ) : (
                  <div className="space-y-2">
                    {session.activityLog.slice(0, 10).map((entry) => (
                      <div 
                        key={entry.id} 
                        className="flex items-start gap-2 py-1"
                      >
                        <div className="flex-shrink-0 mt-0.5">
                          {getActivityIcon(entry.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-xs ${
                            entry.type === 'stack_skipped' 
                              ? 'text-purple-600 dark:text-purple-400 font-medium' 
                              : 'text-slate-600 dark:text-slate-400'
                          }`}>
                            {entry.message}
                          </p>
                          <p className="text-xs text-slate-400 dark:text-slate-500">
                            {formatActivityTime(entry.timestamp)}
                          </p>
                        </div>
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
      <div className={`px-3 py-2 border-b ${
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
      <div className="p-3">
        {isInGame && team1Players && team2Players ? (
          <div className="grid grid-cols-2 gap-3">
            {/* Team 1 */}
            <div className="space-y-1.5">
              <div className="text-xs font-medium text-slate-500 uppercase tracking-wide">Team 1</div>
              {team1Players.map((player, i) => (
                <div key={i} className="flex items-center gap-2 p-1.5 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <div className="w-7 h-7 bg-blue-200 dark:bg-blue-800 rounded-full flex items-center justify-center text-blue-700 dark:text-blue-200 font-semibold text-xs">
                    {player?.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">{player?.name}</span>
                </div>
              ))}
            </div>

            {/* Team 2 */}
            <div className="space-y-1.5">
              <div className="text-xs font-medium text-slate-500 uppercase tracking-wide">Team 2</div>
              {team2Players.map((player, i) => (
                <div key={i} className="flex items-center gap-2 p-1.5 bg-red-50 dark:bg-red-900/20 rounded-lg">
                  <div className="w-7 h-7 bg-red-200 dark:bg-red-800 rounded-full flex items-center justify-center text-red-700 dark:text-red-200 font-semibold text-xs">
                    {player?.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">{player?.name}</span>
                </div>
              ))}
            </div>
          </div>
        ) : isMaintenance ? (
          <div className="text-center py-4">
            <p className="text-sm text-orange-600 dark:text-orange-400">Under maintenance</p>
          </div>
        ) : (
          <div className="text-center py-4">
            <p className="text-sm text-slate-500">Waiting for players</p>
          </div>
        )}
      </div>
    </div>
  );
}
