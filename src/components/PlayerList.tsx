import { useState } from 'react';
import { useSessionStore } from '@/store/sessionStore';
import { useThemeClasses } from '@/store/themeStore';
import { UserPlus, Trash2, RotateCcw, Users, AlertCircle, FlaskConical, Search, ArrowUpDown, AlertTriangle, ArrowUp, ArrowDown, Clock } from 'lucide-react';
import { PickleballIcon } from './PickleballIcon';

// Format waiting time - only show "Just joined" for players with 0 games
const formatWaitTime = (waitingSince: number, gamesPlayed: number = 0): string => {
  if (waitingSince === 0) return '';
  const now = Date.now();
  const waitMs = now - waitingSince;
  const minutes = Math.floor(waitMs / 60000);
  if (minutes < 1) return gamesPlayed === 0 ? 'Just joined' : '<1m';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
};

export function PlayerList() {
  const { session, addPlayer, removePlayer, addToQueue, isNameDuplicate } = useSessionStore();
  const theme = useThemeClasses();
  const [playerNames, setPlayerNames] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'games' | 'wins' | 'losses' | 'waitTime'>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [showSortMenu, setShowSortMenu] = useState(false);

  // Test players for dev mode (All Radiants)
  const ALL_RADIANTS = [
    'Abby', 'Calvin', 'Clare', 'Clark', 'Cliff', 'Cres', 'Danilo', 'Earl',
    'Faiza', 'Fritz', 'Humelda', 'Jared', 'Joey', 'Johnny', 'Jona', 'Juancho',
    'Junmar', 'Khai', 'Linc', 'Mark', 'Martin', 'Nicole', 'Nino', 'Paul',
    'Peter', 'Sandy', 'Sean', 'Tots', 'Vance'
  ];

  const isDev = import.meta.env.DEV;
  const [showDevMenu, setShowDevMenu] = useState(false);

  const handleAddTestPlayers = (count: number | 'all') => {
    const namesToAdd = count === 'all' ? ALL_RADIANTS : ALL_RADIANTS.slice(0, count);
    namesToAdd.forEach(name => {
      if (!isNameDuplicate(name)) {
        addPlayer(name);
      }
    });
    setShowDevMenu(false);
  };

  if (!session) return null;

  // Parse names and check for duplicates
  const parseNames = (input: string) => {
    return input
      .split(/[\n,;]+/)
      .map(name => name.trim())
      .filter(name => name.length > 0);
  };

  const handleAddPlayers = (e: React.FormEvent) => {
    e.preventDefault();
    const names = parseNames(playerNames);
    
    // Check for duplicates
    const duplicates: string[] = [];
    const newNames: string[] = [];
    
    names.forEach(name => {
      if (isNameDuplicate(name)) {
        duplicates.push(name);
      } else if (!newNames.some(n => n.toLowerCase() === name.toLowerCase())) {
        // Also check for duplicates within the input itself
        newNames.push(name);
      }
    });
    
    if (duplicates.length > 0) {
      setDuplicateWarning(duplicates);
      // Still add the non-duplicate names
      if (newNames.length > 0) {
        newNames.forEach(name => addPlayer(name));
      }
      return;
    }
    
    if (newNames.length > 0) {
      newNames.forEach(name => addPlayer(name));
      setPlayerNames('');
      setShowAddForm(false);
      setDuplicateWarning([]);
    }
  };

  const names = parseNames(playerNames);
  const duplicatesInInput = names.filter(name => isNameDuplicate(name));
  const uniqueNewNames = names.filter(name => !isNameDuplicate(name));
  const nameCount = uniqueNewNames.length;

  // Get players currently in a game
  const playersInGame = new Set<string>();
  session.courts.forEach((court) => {
    if (court.currentGame) {
      court.currentGame.team1.forEach((id) => playersInGame.add(id));
      court.currentGame.team2.forEach((id) => playersInGame.add(id));
    }
  });

  // Filter and sort players
  const filteredAndSortedPlayers = session.players
    .filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => {
      let result = 0;
      switch (sortBy) {
        case 'games':
          result = a.gamesPlayed - b.gamesPlayed;
          break;
        case 'wins':
          result = a.gamesWon - b.gamesWon;
          break;
        case 'losses':
          result = (a.gamesPlayed - a.gamesWon) - (b.gamesPlayed - b.gamesWon);
          break;
        case 'waitTime':
          // Only compare waiting times for players actually waiting (waitingSince > 0)
          // Players in game (waitingSince = 0) should be considered as not waiting at all
          if (a.waitingSince === 0 && b.waitingSince === 0) {
            result = 0;
          } else if (a.waitingSince === 0) {
            result = 1; // a is in game, b is waiting
          } else if (b.waitingSince === 0) {
            result = -1; // b is in game, a is waiting
          } else {
            // Lower waitingSince = waiting longer
            result = a.waitingSince - b.waitingSince;
          }
          break;
        default:
          result = a.name.localeCompare(b.name);
      }
      return sortDir === 'desc' ? -result : result;
    });

  // Calculate average wait time for players in queue
  const now = Date.now();
  const waitingPlayers = session.players.filter(p => p.waitingSince > 0);
  const avgWaitTime = waitingPlayers.length > 0
    ? waitingPlayers.reduce((sum, p) => sum + (now - p.waitingSince), 0) / waitingPlayers.length
    : 0;
  
  // Threshold: 10 minutes longer than average (in milliseconds)
  const WAIT_THRESHOLD_MS = 10 * 60 * 1000; // 10 minutes

  // Check if player is waiting significantly longer than average (10+ minutes above average)
  const isWaitingTooLong = (_playerId: string, waitingSince: number): boolean => {
    if (waitingSince === 0) return false; // In game
    if (waitingPlayers.length <= 1) return false; // Not enough players to compare
    
    // Player is waiting 10+ minutes longer than average
    const waitTime = now - waitingSince;
    return waitTime > avgWaitTime + WAIT_THRESHOLD_MS;
  };

  const sortOptions = [
    { value: 'name', label: 'Name' },
    { value: 'games', label: 'Games Played' },
    { value: 'wins', label: 'Wins' },
    { value: 'losses', label: 'Losses' },
    { value: 'waitTime', label: 'Wait Time' },
  ] as const;

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="p-4 border-b border-slate-100 bg-slate-50">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-slate-800">All Players ({session.players.length})</h3>
          <div className="flex items-center gap-2">
            {isDev && (
              <div className="relative">
                <button
                  onClick={() => setShowDevMenu(!showDevMenu)}
                  className="flex items-center gap-1 px-2 py-1 text-sm font-medium text-purple-700 bg-purple-100 hover:bg-purple-200 rounded-lg transition"
                  title="Add test players (dev only)"
                >
                  <FlaskConical className="w-4 h-4" />
                  +Dev
                </button>
                {showDevMenu && (
                  <div className="absolute right-0 mt-1 w-36 bg-white border border-slate-200 rounded-lg shadow-lg z-50 py-1">
                    {[4, 8, 9, 10, 11].map(count => (
                      <button
                        key={count}
                        onClick={() => handleAddTestPlayers(count)}
                        className="w-full px-3 py-1.5 text-left text-sm text-slate-700 hover:bg-purple-50 hover:text-purple-700"
                      >
                        Add {count}
                      </button>
                    ))}
                    <hr className="my-1 border-slate-200" />
                    <button
                      onClick={() => handleAddTestPlayers('all')}
                      className="w-full px-3 py-1.5 text-left text-sm text-purple-700 font-medium hover:bg-purple-50"
                    >
                      All Radiants ({ALL_RADIANTS.length})
                    </button>
                  </div>
                )}
              </div>
            )}
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className={`flex items-center gap-1 px-2 py-1 text-sm font-medium ${theme.textButton} ${theme.bgButton} rounded-lg transition`}
            >
              <UserPlus className="w-4 h-4" />
              Add
            </button>
          </div>
        </div>

        {/* Search and Sort */}
        {session.players.length > 0 && (
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search players..."
                className="w-full pl-8 pr-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
            <div className="relative flex items-center gap-1">
              <button
                onClick={() => setShowSortMenu(!showSortMenu)}
                className="flex items-center gap-1 px-2 py-1.5 text-sm text-slate-600 bg-white border border-slate-300 rounded-l-lg hover:bg-slate-50"
              >
                <ArrowUpDown className="w-4 h-4" />
                {sortOptions.find(o => o.value === sortBy)?.label}
              </button>
              <button
                onClick={() => setSortDir(sortDir === 'asc' ? 'desc' : 'asc')}
                className="flex items-center px-2 py-1.5 text-sm text-slate-600 bg-white border border-l-0 border-slate-300 rounded-r-lg hover:bg-slate-50"
                title={sortDir === 'asc' ? 'Ascending' : 'Descending'}
              >
                {sortDir === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />}
              </button>
              {showSortMenu && (
                <div className="absolute right-0 top-full mt-1 w-36 bg-white border border-slate-200 rounded-lg shadow-lg z-50 py-1">
                  {sortOptions.map(option => (
                    <button
                      key={option.value}
                      onClick={() => {
                        setSortBy(option.value);
                        setShowSortMenu(false);
                      }}
                      className={`w-full px-3 py-1.5 text-left text-sm hover:bg-slate-50 ${
                        sortBy === option.value ? 'text-blue-600 font-medium' : 'text-slate-700'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Add Players Form */}
      {showAddForm && (
        <form onSubmit={handleAddPlayers} className="p-3 border-b border-slate-100 bg-slate-50">
          <div className="space-y-2">
            <textarea
              value={playerNames}
              onChange={(e) => {
                setPlayerNames(e.target.value);
                setDuplicateWarning([]);
              }}
              placeholder="Enter player names (one per line, or separated by commas)&#10;&#10;Example:&#10;Totskie&#10;Clare&#10;Mingkie, Paul"
              className={`w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none ${
                duplicatesInInput.length > 0 ? 'border-amber-400' : 'border-slate-300'
              }`}
              rows={5}
              autoFocus
            />
            
            {/* Duplicate Warning */}
            {duplicatesInInput.length > 0 && (
              <div className="flex items-start gap-2 p-2 bg-amber-50 border border-amber-200 rounded-lg">
                <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-amber-700">
                  <span className="font-medium">Duplicate names:</span>{' '}
                  {duplicatesInInput.join(', ')}
                  <p className="text-amber-600 mt-0.5">These players already exist and will be skipped.</p>
                </div>
              </div>
            )}
            
            {/* Post-submit warning */}
            {duplicateWarning.length > 0 && (
              <div className="flex items-start gap-2 p-2 bg-amber-50 border border-amber-200 rounded-lg">
                <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-amber-700">
                  <span className="font-medium">Skipped duplicates:</span>{' '}
                  {duplicateWarning.join(', ')}
                  <button
                    type="button"
                    onClick={() => {
                      setDuplicateWarning([]);
                      setPlayerNames('');
                    }}
                    className="ml-2 underline hover:no-underline"
                  >
                    Clear
                  </button>
                </div>
              </div>
            )}
            
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500 flex items-center gap-1">
                <Users className="w-3 h-3" />
                {nameCount} new player{nameCount !== 1 ? 's' : ''} to add
                {duplicatesInInput.length > 0 && (
                  <span className="text-amber-600">
                    ({duplicatesInInput.length} duplicate{duplicatesInInput.length !== 1 ? 's' : ''})
                  </span>
                )}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setPlayerNames('');
                    setShowAddForm(false);
                    setDuplicateWarning([]);
                  }}
                  className="px-3 py-1.5 text-sm font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={nameCount === 0}
                  className={`px-4 py-1.5 text-sm font-medium text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition ${theme.bg600} hover:opacity-90`}
                >
                  Add {nameCount > 0 ? `${nameCount} Player${nameCount !== 1 ? 's' : ''}` : ''}
                </button>
              </div>
            </div>
          </div>
        </form>
      )}

      {/* Player List */}
      <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
        {filteredAndSortedPlayers.length === 0 ? (
          <div className="p-6 text-center text-slate-500">
            {session.players.length === 0 ? (
              <>
                <p className="text-sm">No players yet</p>
                <p className="text-xs mt-1">Click "Add" to add players</p>
              </>
            ) : (
              <>
                <p className="text-sm">No players match "{searchQuery}"</p>
                <button
                  onClick={() => setSearchQuery('')}
                  className="text-xs text-blue-600 hover:underline mt-1"
                >
                  Clear search
                </button>
              </>
            )}
          </div>
        ) : (
          filteredAndSortedPlayers.map((player) => {
            const isInGame = playersInGame.has(player.id);
            const isInQueue = session.queue.includes(player.id);
            const waitingTooLong = isWaitingTooLong(player.id, player.waitingSince);

            return (
              <div
                key={player.id}
                className={`flex items-center gap-3 p-3 ${
                  isInGame ? 'bg-blue-50' : ''
                }`}
              >
                {/* Avatar */}
                <div className={`w-9 h-9 rounded-full flex items-center justify-center font-semibold text-sm ${
                  isInGame 
                    ? 'bg-blue-200 text-blue-700' 
                    : 'bg-slate-200 text-slate-600'
                }`}>
                  {player.name.charAt(0).toUpperCase()}
                </div>

                {/* Player Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-slate-800 truncate">{player.name}</p>
                    {isInGame && (
                      <span className="px-1.5 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 rounded">
                        Playing
                      </span>
                    )}
                    {waitingTooLong && !isInGame && (
                      <span className="flex items-center gap-1 text-red-600" title="Waiting over 15 minutes">
                        <AlertTriangle className="w-3.5 h-3.5" />
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-500">
                    <span className="font-semibold text-slate-700">
                      {player.gamesWon}-{player.gamesPlayed - player.gamesWon}
                    </span>
                    <span className="flex items-center gap-1">
                      <PickleballIcon className="w-3 h-3" />
                      {player.gamesPlayed} games
                    </span>
                    {player.waitingSince > 0 && (
                      <span className="flex items-center gap-1 text-amber-600">
                        <Clock className="w-3 h-3" />
                        {formatWaitTime(player.waitingSince, player.gamesPlayed)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1">
                  {!isInGame && !isInQueue && (
                    <button
                      onClick={() => addToQueue(player.id)}
                      className="p-1.5 text-slate-400 hover:text-blue-600 transition"
                      title="Add to queue"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                  )}
                  {!isInGame && (
                    <button
                      onClick={() => {
                        if (confirm(`Remove ${player.name}?`)) {
                          removePlayer(player.id);
                        }
                      }}
                      className="p-1.5 text-slate-400 hover:text-red-500 transition"
                      title="Remove player"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Stats Footer */}
      {session.players.length > 0 && (
        <div className="p-3 bg-slate-50 border-t border-slate-100 text-xs text-slate-500 text-center">
          {session.gamesCompleted.length} games completed this session
        </div>
      )}
    </div>
  );
}
