import { useState } from 'react';
import { useSessionStore } from '@/store/sessionStore';
import { useThemeClasses } from '@/store/themeStore';
import { UserPlus, Trash2, RotateCcw, Users, AlertCircle, FlaskConical, Search, ArrowUpDown, AlertTriangle, ArrowUp, ArrowDown, Clock, Link2, Link2Off, BanIcon, Plus, Check, X, UserCheck } from 'lucide-react';
import { PickleballIcon } from './PickleballIcon';
import { pairDisplayName } from '@/lib/doubles';
import { PlayerStatsModal } from './PlayerStatsModal';
import type { Pair } from '@/types';

// Format waiting time - only show "Just joined" for players with 0 games
const formatWaitTime = (waitingSince: number, gamesPlayed: number = 0): string => {
  if (waitingSince === 0) return ''; // In game
  if (waitingSince < 0) return 'Not in queue'; // Removed from queue
  const now = Date.now();
  const waitMs = now - waitingSince;
  const minutes = Math.floor(waitMs / 60000);
  if (minutes < 1) return gamesPlayed === 0 ? 'Just joined' : '<1m';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
};

export function PlayerList() {
  const { session, addPlayer, removePlayer, addToQueue, isNameDuplicate, addPair, removePair, addPairToQueue, setPlayerUnavailable, checkInPlayer, checkInPair } = useSessionStore();
  const theme = useThemeClasses();
  const [playerNames, setPlayerNames] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'games' | 'wins' | 'losses' | 'waitTime'>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [statsPlayerId, setStatsPlayerId] = useState<string | null>(null);

  // Doubles mode — pair creation modal
  const [showPairModal, setShowPairModal] = useState(false);
  const [selectedForPair, setSelectedForPair] = useState<string | null>(null);
  const [pairModalSearch, setPairModalSearch] = useState('');

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
    if (!session) return;

    const addAndCheckIn = (name: string) => {
      addPlayer(name);
      // Auto check-in in dev mode — find player by name right after add (zustand is sync)
      const state = useSessionStore.getState();
      const player = state.session?.players.find(p => p.name === name && !p.checkedInAt);
      if (player) checkInPlayer(player.id);
    };

    if (count === 'all') {
      ALL_RADIANTS.forEach(name => {
        if (!isNameDuplicate(name)) addAndCheckIn(name);
      });
    } else {
      const existingNames = new Set(session.players.map(p => p.name));
      const availableNames = ALL_RADIANTS.filter(name => !existingNames.has(name));
      availableNames.slice(0, count).forEach(addAndCheckIn);
    }
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

  // Set of player IDs already in a pair
  const pairedPlayerIds = new Set(
    (session.pairs ?? []).flatMap(p => [p.player1Id, p.player2Id])
  );

  // Available players for pair modal: active and unpaired
  const availableForPairing = session.players.filter(
    p => p.isActive && !pairedPlayerIds.has(p.id)
  );

  // Filter and sort players — always show all players (no pairing mode filter)
  const basePlayerList = session.players;

  const filteredAndSortedPlayers = basePlayerList
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
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    // Players in game (waitingSince = 0) or removed (waitingSince < 0) go to the end
          const aNotWaiting = a.waitingSince <= 0;
          const bNotWaiting = b.waitingSince <= 0;
          if (aNotWaiting && bNotWaiting) {
            // Both not waiting - removed players (-1) go after in-game players (0)
            result = a.waitingSince - b.waitingSince;
          } else if (aNotWaiting) {
            result = 1; // a is not waiting, b is waiting - b comes first
          } else if (bNotWaiting) {
            result = -1; // b is not waiting, a is waiting - a comes first
          } else {
            // Both waiting - lower waitingSince = waiting longer = higher priority
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
    if (waitingSince <= 0) return false; // In game (0) or removed from queue (-1)
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
    <>
    {showPairModal && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col">
          {/* Modal header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-700">
            <div>
              <h3 className="font-semibold text-slate-800 dark:text-slate-100 text-base">Create New Pair</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {selectedForPair
                  ? `Selected: ${session.players.find(p => p.id === selectedForPair)?.name} — now pick a partner`
                  : 'Select the first player'}
              </p>
            </div>
            <button
              onClick={() => { setShowPairModal(false); setSelectedForPair(null); setPairModalSearch(''); }}
              className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          {/* Search bar */}
          <div className="px-4 pt-3 pb-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                autoFocus
                type="text"
                value={pairModalSearch}
                onChange={e => setPairModalSearch(e.target.value)}
                placeholder="Search players…"
                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-400"
              />
            </div>
          </div>
          {/* Player grid */}
          <div className="overflow-y-auto p-4 pt-3 flex-1">
            {availableForPairing.length === 0 ? (
              <p className="text-center text-sm text-slate-400 py-8">No unpaired players available.</p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {availableForPairing.filter(p => p.name.toLowerCase().includes(pairModalSearch.toLowerCase())).map(player => {
                  const isSelected = selectedForPair === player.id;
                  return (
                    <button
                      key={player.id}
                      onClick={() => {
                        if (!selectedForPair) {
                          setSelectedForPair(player.id);
                        } else if (selectedForPair !== player.id) {
                          addPair(selectedForPair, player.id);
                          setShowPairModal(false);
                          setSelectedForPair(null);
                        }
                      }}
                      className={`flex items-center gap-2.5 p-3 rounded-xl border-2 text-left transition ${
                        isSelected
                          ? 'border-green-500 bg-green-50 dark:bg-green-900/30'
                          : 'border-slate-200 dark:border-slate-600 hover:border-green-300 hover:bg-green-50/50 dark:hover:bg-green-900/10'
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold text-sm flex-shrink-0 ${
                        isSelected ? 'bg-green-500 text-white' : 'bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-200'
                      }`}>
                        {player.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">{player.name}</p>
                        <p className="text-xs text-slate-500">{player.gamesWon}W–{player.gamesPlayed - player.gamesWon}L</p>
                      </div>
                      {isSelected && <Check className="w-4 h-4 text-green-600 ml-auto flex-shrink-0" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    )}
    <div className="space-y-4">

    {/* ── TEAMS / PAIRS TABLE (doubles only) ─────────────────────────────── */}
    {session.rotationMode === 'doubles' && (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 flex items-center justify-between">
        <h3 className="font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
          <Link2 className="w-4 h-4 text-green-600" />
          Teams ({(session.pairs ?? []).length})
        </h3>
        <button
          onClick={() => { setShowPairModal(true); setPairModalSearch(''); setSelectedForPair(null); }}
          className="flex items-center gap-1 px-2 py-1 text-sm font-medium text-green-700 bg-green-100 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-300 dark:hover:bg-green-900/50 rounded-lg transition"
          title="Pair two players together"
        >
          <Plus className="w-4 h-4" />
          New Pair
        </button>
      </div>

      {(session.pairs ?? []).length === 0 ? (
        <div className="px-4 py-6 text-center text-sm text-slate-400 dark:text-slate-500">
          No teams yet. Click "New Pair" to create one.
        </div>
      ) : (
        <div className="divide-y divide-slate-100 dark:divide-slate-700">
          {(session.pairs ?? []).map((pair: Pair) => {
            const p1 = session.players.find(p => p.id === pair.player1Id);
            const p2 = session.players.find(p => p.id === pair.player2Id);
            const inGame = playersInGame.has(pair.player1Id) || playersInGame.has(pair.player2Id);
            const inQueue = [
              ...(session.doublesWinnerQueue ?? []),
              ...(session.doublesLoserQueue  ?? []),
              ...(session.doublesWaitingQueue ?? []),
            ].includes(pair.id);
            const isPairPending = !p1?.checkedInAt || !p2?.checkedInAt;
            const losses = pair.gamesPlayed - pair.gamesWon;
            return (
              <div key={pair.id} className={`flex items-center gap-3 px-4 py-3 ${inGame ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}>
                <div className="w-9 h-9 rounded-full flex items-center justify-center font-semibold text-sm bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400">
                  <Link2 className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-slate-800 dark:text-slate-100 truncate text-sm">
                      {pairDisplayName(pair, session.players)}
                    </p>
                    {inGame && <span className="px-1.5 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 rounded">Playing</span>}
                    {inQueue && !inGame && <span className="px-1.5 py-0.5 text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300 rounded">Queued</span>}
                    {isPairPending && !inGame && !inQueue && <span className="px-1.5 py-0.5 text-xs font-medium bg-amber-100 text-amber-700 rounded">Pending</span>}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    <span className="font-semibold text-slate-700 dark:text-slate-300">{pair.gamesWon}W–{losses}L</span>
                    <span className="text-slate-400">{p1?.name} &amp; {p2?.name}</span>
                    {(p1?.unavailable || p2?.unavailable) && (
                      <span className="text-red-500">{p1?.unavailable ? p1.name : p2?.name} unavailable</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {!inGame && !inQueue && isPairPending && (
                    <button
                      onClick={() => checkInPair(pair.id)}
                      className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-amber-700 bg-amber-100 hover:bg-amber-200 rounded-lg transition"
                      title="Check in pair"
                    >
                      <UserCheck className="w-3.5 h-3.5" />
                      Check-in
                    </button>
                  )}
                  {!inGame && !inQueue && !isPairPending && (
                    <button onClick={() => addPairToQueue(pair.id)} className="p-1.5 text-slate-400 hover:text-green-600 transition" title="Add to queue">
                      <Plus className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={() => { if (confirm(`Dissolve ${pairDisplayName(pair, session.players)}?`)) removePair(pair.id); }}
                    className="p-1.5 text-slate-400 hover:text-red-500 transition"
                    title="Dissolve pair"
                  >
                    <Link2Off className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
    )}

    {/* ── PLAYERS TABLE ────────────────────────────────────────────────────── */}
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
      <div className="p-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <Users className="w-4 h-4 text-blue-500" />
            Players ({session.players.filter(p => p.isActive).length})
          </h3>
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
                  <div className="absolute right-0 mt-1 w-40 bg-white border border-slate-200 rounded-lg shadow-lg z-50 py-1">
                    {[1, 2, 3, 4].map(count => (
                      <button
                        key={count}
                        onClick={() => handleAddTestPlayers(count)}
                        className="w-full px-3 py-1.5 text-left text-sm text-slate-700 hover:bg-purple-50 hover:text-purple-700"
                      >
                        +{count} Player{count > 1 ? 's' : ''}
                      </button>
                    ))}
                    <hr className="my-1 border-slate-200" />
                    <button
                      onClick={() => handleAddTestPlayers('all')}
                      className="w-full px-3 py-1.5 text-left text-sm text-purple-700 font-medium hover:bg-purple-50"
                    >
                      Add All Radiants ({ALL_RADIANTS.length})
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
            const isDoubles = session.rotationMode === 'doubles';
            const isPending = !player.checkedInAt;

            // Doubles: check if player already has a pair
            const hasPair = isDoubles && (session.pairs ?? []).some(
              p => p.player1Id === player.id || p.player2Id === player.id
            );

            return (
              <div
                key={player.id}
                className={`flex items-center gap-3 p-3 transition ${
                  isInGame ? 'bg-blue-50' : ''
                }`}
              >
                {/* Avatar */}
                <button
                  onClick={() => setStatsPlayerId(player.id)}
                  title="View player stats"
                  className={`w-9 h-9 rounded-full flex items-center justify-center font-semibold text-sm shrink-0 ${
                  isInGame
                    ? 'bg-blue-200 text-blue-700'
                    : player.unavailable
                      ? 'bg-red-100 text-red-500'
                      : 'bg-slate-200 text-slate-600'
                }`}>
                  {player.unavailable
                    ? <BanIcon className="w-4 h-4" />
                    : player.name.charAt(0).toUpperCase()}
                </button>

                {/* Player Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setStatsPlayerId(player.id)}
                      className={`font-medium truncate hover:underline text-left ${player.unavailable ? 'text-red-500 line-through' : 'text-slate-800'}`}
                    >
                      {player.name}
                    </button>
                    {isInGame && (
                      <span className="px-1.5 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 rounded">
                        Playing
                      </span>
                    )}
                    {player.unavailable && !isInGame && (
                      <span className="px-1.5 py-0.5 text-xs font-medium bg-red-100 text-red-500 rounded">
                        Unavailable
                      </span>
                    )}
                    {isDoubles && hasPair && (
                      <span className="px-1.5 py-0.5 text-xs font-medium bg-green-100 text-green-700 rounded flex items-center gap-0.5">
                        <Link2 className="w-2.5 h-2.5" /> Paired
                      </span>
                    )}
                    {isPending && !isInGame && (
                      <span className="px-1.5 py-0.5 text-xs font-medium bg-amber-100 text-amber-700 rounded">
                        Pending
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
                  {isDoubles ? (
                    /* Doubles actions: unavailable toggle + pair button + remove */
                    <>
                      {/* Unavailable toggle */}
                      {!isInGame && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setPlayerUnavailable(player.id, !player.unavailable); }}
                          className={`p-1.5 transition ${player.unavailable ? 'text-red-500 hover:text-slate-400' : 'text-slate-400 hover:text-red-500'}`}
                          title={player.unavailable ? 'Mark available' : 'Mark unavailable (sits out)'}
                        >
                          <BanIcon className="w-4 h-4" />
                        </button>
                      )}
                      {/* Remove player */}
                      {!isInGame && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm(`Remove ${player.name}?`)) removePlayer(player.id);
                          }}
                          className="p-1.5 text-slate-400 hover:text-red-500 transition"
                          title="Remove player"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </>
                  ) : (
                    /* Non-doubles actions */
                    <>
                      {!isInGame && isPending && (
                        <button
                          onClick={() => checkInPlayer(player.id)}
                          className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-amber-700 bg-amber-100 hover:bg-amber-200 rounded-lg transition"
                          title="Check in player"
                        >
                          <UserCheck className="w-3.5 h-3.5" />
                          Check-in
                        </button>
                      )}
                      {!isInGame && !isInQueue && !isPending && (
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
                    </>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Stats Footer */}
      {session.players.length > 0 && (
        <div className="p-3 bg-slate-50 dark:bg-slate-800 border-t border-slate-100 dark:border-slate-700 text-xs text-slate-500 dark:text-slate-400 text-center">
          {session.gamesCompleted.length} games completed this session
        </div>
      )}
    </div>

    </div>

    {statsPlayerId && (() => {
      const statsPlayer = session.players.find(p => p.id === statsPlayerId);
      return statsPlayer ? (
        <PlayerStatsModal
          player={statsPlayer}
          players={session.players}
          gamesCompleted={session.gamesCompleted}
          onClose={() => setStatsPlayerId(null)}
        />
      ) : null;
    })()}
    </>
  );
}
