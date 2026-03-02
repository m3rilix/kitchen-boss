import { useState, useMemo } from 'react';
import { useSessionStore } from '@/store/sessionStore';
import { useThemeClasses } from '@/store/themeStore';
import { X, Search, Trophy, TrendingDown, Layers, ChevronsUp, ChevronsDown, GripVertical, Star, Users, Zap, Rocket, Play } from 'lucide-react';
import type { Player } from '@/types';

type StackType = 'ready' | 'forming-winners' | 'forming-losers' | 'forming-free' | 'winners' | 'losers';

interface StackGroup {
  id: string;
  players: Player[];
  type: StackType;
  label: string;
  isForming: boolean;
}

export function PlayerQueue() {
  const { session, getPlayersInQueue, removeFromQueue, movePlayerToPosition, movePlayerToStack, nextStackPlayerIds, setNextStackPlayerIds, startGame } = useSessionStore();
  const theme = useThemeClasses();
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedStacks, setExpandedStacks] = useState<Set<string>>(new Set(['forming-winners', 'forming-losers', 'forming-free', 'forming-mixed']));
  const [draggedPlayerId, setDraggedPlayerId] = useState<string | null>(null);

  if (!session) return null;

  const queuedPlayers = getPlayersInQueue();

  // Stack counter from session (tracks total stacks played)
  const stackCounter = session.stackCounter ?? 0;

  // Build visual stacks - separate forming stacks for winners, losers, and free
  const stacks = useMemo(() => {
    // Get players in stack order (not queue order) for proper visual display
    const getPlayersInStackOrder = (stackIds: string[]): Player[] => {
      return stackIds
        .map(id => session.players.find(p => p.id === id))
        .filter((p): p is Player => p !== undefined && p.isActive);
    };
    
    // Separate players by their stack status, maintaining stack order
    const winners = getPlayersInStackOrder(session.winnerStack ?? []);
    const losers = getPlayersInStackOrder(session.loserStack ?? []);
    const free = getPlayersInStackOrder(session.waitingStack ?? []);
    
    // Helper to create stacks of 4 from a list with stable IDs
    const createStacks = (
      players: Player[], 
      readyType: StackType, 
      formingType: StackType, 
      readyLabelPrefix: string,
      formingLabel: string
    ): StackGroup[] => {
      const result: StackGroup[] = [];
      
      // Full stacks of 4 (ready) - use first player ID as stable identifier
      const fullStackCount = Math.floor(players.length / 4);
      for (let i = 0; i < fullStackCount; i++) {
        const stackPlayers = players.slice(i * 4, (i + 1) * 4);
        // Use sorted player IDs to create stable ID that doesn't change on reorder
        const stableId = `${readyType}-${stackPlayers.map(p => p.id).sort().join('-').slice(0, 20)}`;
        result.push({
          id: stableId,
          players: stackPlayers,
          type: readyType,
          label: readyLabelPrefix, // Will be numbered later
          isForming: false,
        });
      }
      
      // Remaining players (forming) - forming stacks keep their type as ID
      const remaining = players.slice(fullStackCount * 4);
      if (remaining.length > 0) {
        result.push({
          id: formingType,
          players: remaining,
          type: formingType,
          label: `${formingLabel} (${remaining.length}/4)`,
          isForming: true,
        });
      }
      
      return result;
    };
    
    // Create winner stacks (green)
    const winnerStacks = createStacks(winners, 'winners', 'forming-winners', 'Winners', 'Winners Forming');
    
    // For losers + free: combine them and sort by wait time (matches game selection logic)
    // This ensures the UI shows exactly what the game selection will pick
    const allLosersAndFree = [...losers, ...free].sort((a, b) => {
      if (a.waitingSince === 0 && b.waitingSince === 0) return 0;
      if (a.waitingSince === 0) return 1;
      if (b.waitingSince === 0) return -1;
      return a.waitingSince - b.waitingSince;
    });
    
    // Build mixed stacks from combined losers + free
    const mixedReadyStacks: StackGroup[] = [];
    let mixedFormingStack: StackGroup | null = null;
    
    if (allLosersAndFree.length > 0) {
      const readyCount = Math.floor(allLosersAndFree.length / 4);
      for (let i = 0; i < readyCount; i++) {
        const stackPlayers = allLosersAndFree.slice(i * 4, (i + 1) * 4);
        const stableId = `mixed-${stackPlayers.map(p => p.id).sort().join('-').slice(0, 20)}`;
        
        // Determine stack type based on composition for coloring
        const loserCount = stackPlayers.filter(p => losers.some(l => l.id === p.id)).length;
        const freeCount = stackPlayers.filter(p => free.some(f => f.id === p.id)).length;
        
        let stackType: StackType;
        let stackLabel: string;
        if (loserCount === 4) {
          stackType = 'losers';
          stackLabel = 'Losers';
        } else if (freeCount === 4) {
          stackType = 'ready';
          stackLabel = 'Stack';
        } else {
          // Mixed composition - use gray/neutral
          stackType = 'ready';
          stackLabel = 'Mixed';
        }
        
        mixedReadyStacks.push({
          id: stableId,
          players: stackPlayers,
          type: stackType,
          label: stackLabel,
          isForming: false,
        });
      }
      
      const remaining = allLosersAndFree.slice(readyCount * 4);
      if (remaining.length > 0) {
        mixedFormingStack = {
          id: 'forming-mixed',
          players: remaining,
          type: 'forming-losers',
          label: `Mixed Forming (${remaining.length}/4)`,
          isForming: true,
        };
      }
    }
    
    // Winner forming stacks
    const formingWinners = winnerStacks.filter(s => s.isForming);
    
    // Build forming stacks list
    let formingStacksList: StackGroup[] = [];
    if (mixedFormingStack) {
      formingStacksList.push(mixedFormingStack);
    }
    formingStacksList = [...formingStacksList, ...formingWinners];
    
    // Sort forming stacks by longest waiting player
    formingStacksList.sort((a, b) => {
      const aMinWait = Math.min(...a.players.map(p => p.waitingSince || Infinity));
      const bMinWait = Math.min(...b.players.map(p => p.waitingSince || Infinity));
      return aMinWait - bMinWait;
    });
    
    // Collect ALL ready stacks: winners + mixed (combined losers+free)
    const allReadyStacks = [
      ...winnerStacks.filter(s => !s.isForming),
      ...mixedReadyStacks,
    ];
    
    // Sort by the longest waiting player in each stack
    const readyStacks = allReadyStacks.sort((a, b) => {
      const aMinWait = Math.min(...a.players.map(p => p.waitingSince || Infinity));
      const bMinWait = Math.min(...b.players.map(p => p.waitingSince || Infinity));
      return aMinWait - bMinWait;
    });
    
    // Number the ready stacks sequentially from stackCounter
    readyStacks.forEach((stack, idx) => {
      const stackNum = stackCounter + idx + 1;
      stack.label = `Stack ${stackNum}`;
    });
    
    return [...readyStacks, ...formingStacksList];
  }, [session.players, session.winnerStack, session.loserStack, session.waitingStack, stackCounter]);

  // Filter stacks by search query
  const filteredStacks = useMemo(() => {
    if (!searchQuery.trim()) return stacks;
    return stacks.map(stack => ({
      ...stack,
      players: stack.players.filter(p => 
        p.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    })).filter(stack => stack.players.length > 0);
  }, [stacks, searchQuery]);

  // Get stack status for a player
  // Get player's visual status based on their last game result (not which stack they're in)
  const getPlayerStatus = (playerId: string): 'winner' | 'loser' | 'waiting' => {
    const player = session.players.find(p => p.id === playerId);
    if (player?.lastGameResult === 'won') return 'winner';
    if (player?.lastGameResult === 'lost') return 'loser';
    return 'waiting';
  };

  const getStackColor = (type: StackType) => {
    switch (type) {
      case 'winners': return 'border-green-400 bg-green-50 dark:bg-green-900/20';
      case 'forming-winners': return 'border-green-300 bg-green-50/50 dark:bg-green-900/10 border-dashed';
      case 'losers': return 'border-orange-400 bg-orange-50 dark:bg-orange-900/20';
      case 'forming-losers': return 'border-orange-300 bg-orange-50/50 dark:bg-orange-900/10 border-dashed';
      case 'ready': return 'border-blue-400 bg-blue-50 dark:bg-blue-900/20'; // Blue for starting/free ready stacks
      case 'forming-free': return 'border-slate-300 bg-slate-50 dark:bg-slate-700/50 border-dashed'; // Gray for mixed forming
      default: return `${theme.border} ${theme.bg100}`;
    }
  };

  const getStackIcon = (type: StackType) => {
    switch (type) {
      case 'winners': 
      case 'forming-winners': 
        return <Trophy className="w-4 h-4 text-green-600" />;
      case 'losers': 
      case 'forming-losers': 
        return <TrendingDown className="w-4 h-4 text-orange-600" />;
      case 'ready':
        return <Zap className="w-4 h-4 text-blue-600" />; // Blue zap for ready stacks
      case 'forming-free': 
        return <Users className="w-4 h-4 text-slate-400" />; // Gray users for mixed forming
      default: 
        return <Layers className={`w-4 h-4 ${theme.text}`} />;
    }
  };

  // Toggle a single stack
  const toggleStack = (stackId: string) => {
    setExpandedStacks(prev => {
      const newSet = new Set(prev);
      if (newSet.has(stackId)) {
        newSet.delete(stackId);
      } else {
        newSet.add(stackId);
      }
      return newSet;
    });
  };

  // Expand/collapse all
  const expandAll = () => {
    setExpandedStacks(new Set(stacks.map(s => s.id)));
  };

  const collapseAll = () => {
    setExpandedStacks(new Set());
  };

  // Get global index of a player in the queue
  const getGlobalIndex = (playerId: string): number => {
    return queuedPlayers.findIndex(p => p.id === playerId);
  };

  // Get target stack type from forming stack type
  const getTargetStackFromType = (type: StackType): 'winner' | 'loser' | 'waiting' | null => {
    if (type === 'forming-winners' || type === 'winners') return 'winner';
    if (type === 'forming-losers' || type === 'losers') return 'loser';
    if (type === 'forming-free' || type === 'ready') return 'waiting';
    return null;
  };

  // Handle drop on a stack header (for adding players to a stack)
  const handleStackHeaderDrop = (e: React.DragEvent, stack: StackGroup) => {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.remove('ring-2', 'ring-blue-400', 'bg-blue-50', 'dark:bg-blue-900/30');
    
    if (!draggedPlayerId) return;
    
    // Don't add if stack already has 4 players
    if (stack.players.length >= 4) {
      setDraggedPlayerId(null);
      return;
    }
    
    // Add player to the appropriate stack
    const targetStack = getTargetStackFromType(stack.type);
    if (targetStack) {
      movePlayerToStack(draggedPlayerId, targetStack);
    }
    setDraggedPlayerId(null);
  };

  // Handle drop on a stack container (for moving players between stacks - forming only)
  const handleStackDrop = (e: React.DragEvent, stack: StackGroup) => {
    e.preventDefault();
    e.currentTarget.classList.remove('ring-2', 'ring-blue-400');
    
    if (!draggedPlayerId) return;
    
    // Only allow dropping on forming stacks
    if (!stack.isForming) {
      setDraggedPlayerId(null);
      return;
    }
    
    const targetStack = getTargetStackFromType(stack.type);
    if (targetStack) {
      movePlayerToStack(draggedPlayerId, targetStack);
    }
    setDraggedPlayerId(null);
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden transition-colors">
      {/* Header */}
      <div className="p-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <Layers className={`w-4 h-4 ${theme.text}`} />
            Stack Queue
          </h3>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded">
              {stacks.filter(s => !s.isForming).length} ready
            </span>
            <span className="text-sm text-slate-500 dark:text-slate-400">{queuedPlayers.length} players</span>
          </div>
        </div>
        
        {/* Search and Expand/Collapse */}
        {queuedPlayers.length > 0 && (
          <div className="space-y-2">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search player..."
                className="w-full pl-8 pr-3 py-1.5 text-sm border border-slate-200 dark:border-slate-600 dark:bg-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
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
            {/* Expand/Collapse buttons */}
            <div className="flex justify-end gap-2">
              <button
                onClick={expandAll}
                className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 flex items-center gap-1"
              >
                <ChevronsDown className="w-3 h-3" />
                Expand All
              </button>
              <button
                onClick={collapseAll}
                className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 flex items-center gap-1"
              >
                <ChevronsUp className="w-3 h-3" />
                Collapse All
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Stacks */}
      <div className="p-3 space-y-3 max-h-[500px] overflow-y-auto">
        {queuedPlayers.length === 0 ? (
          <div className="p-6 text-center text-slate-500">
            <Layers className="w-8 h-8 mx-auto mb-2 text-slate-300" />
            <p className="text-sm">No players in queue</p>
            <p className="text-xs mt-1">Add players to form stacks</p>
          </div>
        ) : filteredStacks.length === 0 ? (
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
          filteredStacks.map((stack, stackIdx) => (
            <div
              key={stack.id}
              className={`rounded-lg border-2 overflow-hidden transition-all group ${getStackColor(stack.type)}`}
              onDragOver={(e) => {
                e.preventDefault();
                if (stack.isForming) {
                  e.currentTarget.classList.add('ring-2', 'ring-blue-400');
                }
              }}
              onDragLeave={(e) => {
                e.currentTarget.classList.remove('ring-2', 'ring-blue-400');
              }}
              onDrop={(e) => handleStackDrop(e, stack)}
            >
              {/* Stack Header - draggable (for ready stacks) and droppable (to add players) */}
              <div 
                className={`flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-white/50 dark:hover:bg-slate-600/30 transition-colors ${
                  stack.players.length < 4 ? 'drop-target' : ''
                } ${!stack.isForming && stack.players.length === 4 ? 'cursor-grab active:cursor-grabbing' : ''}`}
                draggable={!stack.isForming && stack.players.length === 4}
                onDragStart={(e) => {
                  if (!stack.isForming && stack.players.length === 4) {
                    e.dataTransfer.setData('application/json', JSON.stringify({
                      source: 'stack',
                      playerIds: stack.players.map(p => p.id),
                      stackLabel: stack.label
                    }));
                    e.dataTransfer.effectAllowed = 'move';
                  }
                }}
                onClick={() => toggleStack(stack.id)}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (stack.players.length < 4) {
                    e.currentTarget.classList.add('ring-2', 'ring-blue-400', 'bg-blue-50', 'dark:bg-blue-900/30');
                  }
                }}
                onDragLeave={(e) => {
                  e.currentTarget.classList.remove('ring-2', 'ring-blue-400', 'bg-blue-50', 'dark:bg-blue-900/30');
                }}
                onDrop={(e) => handleStackHeaderDrop(e, stack)}
              >
                <div className="flex items-center gap-2">
                  {getStackIcon(stack.type)}
                  <span className="font-medium text-sm text-slate-700 dark:text-slate-200">
                    {stack.label}
                  </span>
                  {stack.players.length < 4 && draggedPlayerId && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-300">
                      Drop to add
                    </span>
                  )}
                  {/* Show "Next" badge on the selected stack or first ready stack */}
                  {!stack.isForming && !draggedPlayerId && stack.players.length === 4 && (() => {
                    // Check if this specific stack is selected (by comparing player IDs)
                    const stackPlayerIds = stack.players.map(p => p.id);
                    const isSelected = nextStackPlayerIds && 
                      nextStackPlayerIds.length === 4 &&
                      stackPlayerIds.every(id => nextStackPlayerIds.includes(id));
                    
                    // Check if stored selection is still valid (matches any ready stack)
                    const readyStacksOnly = filteredStacks.filter(s => !s.isForming && s.players.length === 4);
                    const selectionStillValid = nextStackPlayerIds && readyStacksOnly.some(s => 
                      s.players.map(p => p.id).every(id => nextStackPlayerIds.includes(id))
                    );
                    
                    // Show "Next" on first stack if no selection or selection is invalid
                    const isFirstAndNoValidSelection = (!nextStackPlayerIds || !selectionStillValid) && stackIdx === 0;
                    
                    return (isSelected || isFirstAndNoValidSelection) ? (
                      <span className={`text-xs px-1.5 py-0.5 rounded ${theme.bg600} text-white flex items-center gap-1`}>
                        <Star className="w-3 h-3" />
                        Next
                      </span>
                    ) : (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setNextStackPlayerIds(stackPlayerIds);
                        }}
                        className="p-1 text-slate-400 hover:text-purple-600 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Set as next stack"
                      >
                        <Star className="w-4 h-4" />
                      </button>
                    );
                  })()}
                </div>
                <div className="flex items-center gap-1">
                  {stack.players.slice(0, 4).map((p) => (
                    <div
                      key={p.id}
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                        getPlayerStatus(p.id) === 'winner' 
                          ? 'bg-green-200 text-green-700'
                          : getPlayerStatus(p.id) === 'loser'
                            ? 'bg-orange-200 text-orange-700'
                            : 'bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-300'
                      }`}
                      title={p.name}
                    >
                      {p.name.charAt(0).toUpperCase()}
                    </div>
                  ))}
                  {stack.players.length < 4 && (
                    Array.from({ length: 4 - stack.players.length }).map((_, i) => (
                      <div
                        key={`empty-${i}`}
                        className="w-6 h-6 rounded-full border-2 border-dashed border-slate-300 dark:border-slate-500"
                      />
                    ))
                  )}
                  {/* Play button for ready stacks when court is available */}
                  {!stack.isForming && stack.players.length === 4 && (() => {
                    const availableCourt = session.courts.find(c => c.status === 'available');
                    if (!availableCourt) return null;
                    
                    const players = stack.players;
                    // Check if this is not the first ready stack (skipping the queue)
                    const readyStacksOnly = filteredStacks.filter(s => !s.isForming && s.players.length === 4);
                    const isFirstReadyStack = readyStacksOnly.length > 0 && readyStacksOnly[0].id === stack.id;
                    const skippedQueue = !isFirstReadyStack;
                    
                    return (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          // Start game with this stack
                          startGame(
                            availableCourt.id,
                            [players[0].id, players[1].id],
                            [players[2].id, players[3].id],
                            skippedQueue
                          );
                        }}
                        className={`ml-2 px-2 py-1 text-xs font-medium text-white rounded-lg flex items-center gap-1 transition ${
                          skippedQueue 
                            ? 'bg-purple-600 hover:bg-purple-700' 
                            : 'bg-green-600 hover:bg-green-700'
                        }`}
                        title={skippedQueue ? `Skip queue and play on ${availableCourt.name}` : `Start game on ${availableCourt.name}`}
                      >
                        {skippedQueue ? <Rocket className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                        {skippedQueue ? 'Skip' : 'Play'}
                      </button>
                    );
                  })()}
                </div>
              </div>

              {/* Expanded Player List - first ready stack is always expanded */}
              {(expandedStacks.has(stack.id) || (!stack.isForming && stack.players.length === 4 && stackIdx === 0)) && (
                <div className="border-t border-slate-200 dark:border-slate-600 bg-white/50 dark:bg-slate-800/50">
                  {stack.players.map((player) => {
                    const globalIdx = getGlobalIndex(player.id);
                    
                    return (
                      <div
                        key={player.id}
                        draggable
                        onDragStart={(e) => {
                          setDraggedPlayerId(player.id);
                          // Set drag data for court drops
                          e.dataTransfer.setData('application/json', JSON.stringify({
                            source: 'queue',
                            playerId: player.id
                          }));
                          e.dataTransfer.effectAllowed = 'move';
                        }}
                        onDragEnd={() => setDraggedPlayerId(null)}
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.currentTarget.classList.add('bg-blue-100', 'dark:bg-blue-900/30');
                        }}
                        onDragLeave={(e) => {
                          e.currentTarget.classList.remove('bg-blue-100', 'dark:bg-blue-900/30');
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          e.currentTarget.classList.remove('bg-blue-100', 'dark:bg-blue-900/30');
                          if (draggedPlayerId && draggedPlayerId !== player.id) {
                            movePlayerToPosition(draggedPlayerId, globalIdx);
                          }
                          setDraggedPlayerId(null);
                        }}
                        className={`flex items-center gap-2 px-3 py-2 border-b border-slate-100 dark:border-slate-700 last:border-b-0 hover:bg-slate-50 dark:hover:bg-slate-700/30 cursor-grab active:cursor-grabbing ${
                          draggedPlayerId === player.id ? 'opacity-50' : ''
                        }`}
                      >
                        {/* Drag Handle */}
                        <GripVertical className="w-4 h-4 text-slate-300 dark:text-slate-500 flex-shrink-0" />
                        
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                          getPlayerStatus(player.id) === 'winner' 
                            ? 'bg-green-200 text-green-700'
                            : getPlayerStatus(player.id) === 'loser'
                              ? 'bg-orange-200 text-orange-700'
                              : 'bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-300'
                        }`}>
                          {globalIdx + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm text-slate-800 dark:text-slate-200 truncate">
                              {player.name}
                            </span>
                            {getPlayerStatus(player.id) === 'winner' && (
                              <Trophy className="w-3 h-3 text-green-600" />
                            )}
                            {getPlayerStatus(player.id) === 'loser' && (
                              <TrendingDown className="w-3 h-3 text-orange-600" />
                            )}
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            <span className="font-medium">
                              {player.gamesWon}-{player.gamesPlayed - player.gamesWon}
                            </span>
                            {' • '}{player.gamesPlayed} games
                            {(player.winStreak ?? 0) > 0 && <span className="text-green-600 ml-1">🔥{player.winStreak}</span>}
                          </p>
                        </div>
                        
                        {/* Remove from queue button only */}
                        <div className="flex items-center gap-0.5">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              removeFromQueue(player.id);
                            }}
                            className="p-1 text-slate-400 hover:text-red-500"
                            title="Remove from queue"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      {stacks.length > 0 && (
        <div className={`p-3 ${theme.bg100} border-t border-slate-100 dark:border-slate-700`}>
          <p className={`text-xs ${theme.textDark} text-center font-medium`}>
            {stacks[0]?.isForming 
              ? `Need ${4 - stacks[0].players.length} more player${4 - stacks[0].players.length > 1 ? 's' : ''} to form a stack`
              : 'Click "Start Game" on a court to play the next stack'
            }
          </p>
        </div>
      )}
    </div>
  );
}
