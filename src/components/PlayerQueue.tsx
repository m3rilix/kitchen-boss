import { useState, useMemo } from 'react';
import { useSessionStore } from '@/store/sessionStore';
import { useThemeClasses } from '@/store/themeStore';
import { X, Search, Trophy, TrendingDown, Layers, ChevronsUp, ChevronsDown, GripVertical, Star, Users, Zap, Rocket, Play, Clock, Plus, Check, Trash2, RefreshCw } from 'lucide-react';
import type { Player } from '@/types';

type StackType = 'ready' | 'forming-winners' | 'forming-losers' | 'forming-free' | 'winners' | 'losers' | 'custom' | 'round-robin';

interface StackGroup {
  id: string;
  players: Player[];
  type: StackType;
  label: string;
  isForming: boolean;
  customIndex?: number; // For custom stacks
}

export function PlayerQueue() {
  const { session, getPlayersInQueue, removeFromQueue, movePlayerToPosition, movePlayerToStack, startGame, createCustomStack, removeCustomStack, reshuffleByWaitingTime, reshuffleByGamesPlayed, smartRebuildStacks } = useSessionStore();
  const theme = useThemeClasses();
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedStacks, setExpandedStacks] = useState<Set<string>>(new Set(['forming-winners', 'forming-losers', 'forming-free', 'forming-mixed']));
  const [draggedPlayerId, setDraggedPlayerId] = useState<string | null>(null);
  const [isCreatingCustomStack, setIsCreatingCustomStack] = useState(false);
  const [customStackSelection, setCustomStackSelection] = useState<string[]>([]);
  const [showReorderMenu, setShowReorderMenu] = useState(false);

  // Get players currently in a game (must be before early return to maintain hook order)
  const playersInGame = useMemo(() => {
    if (!session) return new Set<string>();
    const inGame = new Set<string>();
    session.courts.forEach((court) => {
      if (court.currentGame) {
        court.currentGame.team1.forEach((id) => inGame.add(id));
        court.currentGame.team2.forEach((id) => inGame.add(id));
      }
    });
    return inGame;
  }, [session?.courts]);

  // Stack counter from session (tracks total stacks played)
  const stackCounter = session?.stackCounter ?? 0;

  // Build visual stacks - separate forming stacks for winners, losers, and free
  const stacks = useMemo(() => {
    if (!session) return [];
    
    const isRoundRobin = session.rotationMode === 'round_robin';
    console.log('[PlayerQueue] rotationMode:', session.rotationMode, 'isRoundRobin:', isRoundRobin);
    
    // Get player IDs already in custom stacks (to exclude from other stacks)
    const customStackPlayerIds = new Set((session.customStacks || []).flat());
    
    // Get players in stack order (not queue order) for proper visual display
    // Exclude players already in custom stacks
    const getPlayersInStackOrder = (stackIds: string[]): Player[] => {
      return stackIds
        .filter(id => !customStackPlayerIds.has(id))
        .map(id => session.players.find(p => p.id === id))
        .filter((p): p is Player => p !== undefined && p.isActive);
    };
    
    // For Round Robin mode, use pre-built stacks from session.roundRobinStacks
    if (isRoundRobin) {
      // Get pre-built stacks from session (these are stable and don't change unless reorder is triggered)
      const preBuiltStacks = session.roundRobinStacks || [];
      
      // Convert to StackGroup format
      console.log('[PlayerQueue] preBuiltStacks:', preBuiltStacks);
      const roundRobinStackGroups: StackGroup[] = preBuiltStacks.map((stackIds, idx) => {
        const players = stackIds
          .map(id => session.players.find(p => p.id === id))
          .filter((p): p is Player => p !== undefined);
        console.log('[PlayerQueue] Stack', idx, 'stackIds:', stackIds, 'players found:', players.length, players.map(p => p.name));
        return {
          id: `rr-${idx}-${stackIds.slice(0, 2).join('-')}`,
          players,
          type: 'round-robin' as StackType,
          label: `Stack ${stackCounter + idx + 1}`,
          isForming: false,
        };
      }).filter(stack => stack.players.length === 4);
      console.log('[PlayerQueue] roundRobinStackGroups after filter:', roundRobinStackGroups.length);
      
      // Get all waiting players not in pre-built stacks (for the "Waiting" forming stack)
      const usedPlayerIds = new Set(preBuiltStacks.flat());
      const allWaitingPlayers = session.players.filter(p => 
        p.isActive && 
        p.waitingSince > 0 && 
        !customStackPlayerIds.has(p.id) &&
        !usedPlayerIds.has(p.id)
      );
      
      const formingStack: StackGroup | null = allWaitingPlayers.length > 0 ? {
        id: 'rr-forming',
        players: allWaitingPlayers,
        type: 'forming-free' as StackType,
        label: `Waiting (${allWaitingPlayers.length})`,
        isForming: true,
      } : null;
      
      // Custom stacks are shown but NOT used by autoAssignNextGame in Round Robin mode
      const customStackGroups: StackGroup[] = (session.customStacks || []).map((playerIds, idx) => ({
        id: `custom-${idx}`,
        players: playerIds
          .map(id => session.players.find(p => p.id === id))
          .filter((p): p is Player => p !== undefined),
        type: 'custom' as StackType,
        label: `Custom ${idx + 1}`,
        isForming: false,
        customIndex: idx,
      })).filter(stack => stack.players.length === 4);
      
      return [...customStackGroups, ...roundRobinStackGroups, ...(formingStack ? [formingStack] : [])];
    }
    
    // Win-Lose Stack mode - Use pre-built stacks from session
    if (session.rotationMode === 'win_lose_stack' || session.rotationMode === 'full_rotation') {
      // Get pre-built stacks from session (labels will be assigned after ordering)
      const winnerStackGroups: StackGroup[] = (session.winnerStacks || []).map((stackIds, idx) => ({
        id: `winner-${idx}`,
        players: stackIds
          .map(id => session.players.find(p => p.id === id))
          .filter((p): p is Player => p !== undefined),
        type: 'winners' as StackType,
        label: '', // Will be set after ordering
        isForming: stackIds.length < 4,
      }));
      
      const loserStackGroups: StackGroup[] = (session.loserStacks || []).map((stackIds, idx) => ({
        id: `loser-${idx}`,
        players: stackIds
          .map(id => session.players.find(p => p.id === id))
          .filter((p): p is Player => p !== undefined),
        type: 'losers' as StackType,
        label: '', // Will be set after ordering
        isForming: stackIds.length < 4,
      }));
      
      // Waiting stacks (Regular/blue stacks)
      const waitingStackGroups: StackGroup[] = (session.waitingStacks || []).map((stackIds, idx) => ({
        id: `waiting-${idx}`,
        players: stackIds
          .map(id => session.players.find(p => p.id === id))
          .filter((p): p is Player => p !== undefined),
        type: stackIds.length === 4 ? 'ready' as StackType : 'forming-free' as StackType,
        label: '', // Will be set after ordering
        isForming: stackIds.length < 4,
      }));
      
      // Custom stacks
      const customStackGroups: StackGroup[] = (session.customStacks || []).map((playerIds, idx) => ({
        id: `custom-${idx}`,
        players: playerIds
          .map(id => session.players.find(p => p.id === id))
          .filter((p): p is Player => p !== undefined),
        type: 'custom' as StackType,
        label: `Custom ${idx + 1}`,
        isForming: false,
        customIndex: idx,
      })).filter(stack => stack.players.length === 4);
      
      // Get ready stacks by type - preserve array order (FIFO)
      const readyRegular = waitingStackGroups.filter(s => !s.isForming);
      const readyLoser = loserStackGroups.filter(s => !s.isForming);
      const readyWinner = winnerStackGroups.filter(s => !s.isForming);
      
      // Determine alternating order based on lastStackType
      // This ONLY changes when a game STARTS (not when it ends)
      // If last was 'loser' or 'regular', winner is next; otherwise loser is next
      const lastType = session.lastStackType;
      const tryWinnerFirst = lastType === 'loser' || lastType === 'regular';
      
      // Build ordered ready stacks: Regular first, then alternating win/lose
      // The order is stable - it only changes when lastStackType changes (in startGame)
      let orderedWinLoseStacks: StackGroup[] = [];
      if (tryWinnerFirst) {
        orderedWinLoseStacks = [...readyWinner, ...readyLoser];
      } else {
        orderedWinLoseStacks = [...readyLoser, ...readyWinner];
      }
      
      const allReadyStacks = [
        ...readyRegular,      // Regular always first
        ...orderedWinLoseStacks,
      ];
      
      const allFormingStacks = [
        ...waitingStackGroups.filter(s => s.isForming),
        ...loserStackGroups.filter(s => s.isForming),
        ...winnerStackGroups.filter(s => s.isForming),
      ];
      
      // Order: Custom → Ready Stacks (priority order) → Forming Stacks
      const orderedStacks = [
        ...customStackGroups,
        ...allReadyStacks,
        ...allFormingStacks
      ];
      
      // Assign labels based on final display order
      // stackCounter = number of games played, so next stack is stackCounter + 1
      let nextStackNumber = stackCounter + 1;
      orderedStacks.forEach(stack => {
        if (stack.type === 'custom') {
          // Custom stacks already have labels
        } else if (stack.isForming) {
          // Forming stacks get descriptive labels
          if (stack.type === 'winners') {
            stack.label = `Winners Forming (${stack.players.length}/4)`;
          } else if (stack.type === 'losers') {
            stack.label = `Losers Forming (${stack.players.length}/4)`;
          } else {
            stack.label = `Regular Forming (${stack.players.length}/4)`;
          }
        } else {
          // Ready stacks get incrementing numbers based on games played
          stack.label = `Stack ${nextStackNumber}`;
          nextStackNumber++;
        }
      });
      
      return orderedStacks;
    }
    
    // DEPRECATED: Old Win-Lose Stack mode (fallback for backward compatibility)
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
    // waitingSince values: -1 = removed from queue, 0 = in game, >0 = waiting timestamp
    const allLosersAndFree = [...losers, ...free].sort((a, b) => {
      // Players not in queue or in game go to the end
      if (a.waitingSince <= 0 && b.waitingSince <= 0) return 0;
      if (a.waitingSince <= 0) return 1;
      if (b.waitingSince <= 0) return -1;
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
    
    // Build custom stacks from session
    const customStackGroups: StackGroup[] = (session.customStacks || []).map((playerIds, idx) => ({
      id: `custom-${idx}`,
      players: playerIds
        .map(id => session.players.find(p => p.id === id))
        .filter((p): p is Player => p !== undefined),
      type: 'custom' as StackType,
      label: `Custom ${idx + 1}`,
      isForming: false,
      customIndex: idx,
    })).filter(stack => stack.players.length === 4);
    
    // Custom stacks go first (highest priority), then ready stacks, then forming
    return [...customStackGroups, ...readyStacks, ...formingStacksList];
  }, [
    session?.players, 
    session?.winnerStack, 
    session?.loserStack, 
    session?.waitingStack, 
    session?.winnerStacks, 
    session?.loserStacks, 
    session?.waitingStacks, 
    session?.lastStackType,  // Visual order ONLY changes when this changes (in startGame)
    session?.customStacks, 
    session?.roundRobinStacks, 
    session?.rotationMode, 
    stackCounter
  ]);

  // Filter stacks by search query (must be before early return to maintain hook order)
  const filteredStacks = useMemo(() => {
    if (!searchQuery.trim()) return stacks;
    return stacks.map(stack => ({
      ...stack,
      players: stack.players.filter((p: Player) => 
        p.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    })).filter(stack => stack.players.length > 0);
  }, [stacks, searchQuery]);

  // Early return after all hooks
  if (!session) return null;

  const queuedPlayers = getPlayersInQueue();

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
      case 'custom': return 'border-purple-400 bg-purple-50 dark:bg-purple-900/20'; // Purple for custom stacks
      case 'round-robin': return 'border-cyan-400 bg-cyan-50 dark:bg-cyan-900/20'; // Cyan for Round Robin stacks
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
      case 'custom':
        return <Star className="w-4 h-4 text-purple-600" />; // Purple star for custom stacks
      case 'round-robin':
        return <RefreshCw className="w-4 h-4 text-cyan-600" />; // Cyan refresh for Round Robin stacks
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
    
    // Check if player is already in this stack
    const isAlreadyInStack = stack.players.some(p => p.id === draggedPlayerId);
    
    // Don't add if stack already has 4 players (unless player is already in this stack)
    if (stack.players.length >= 4 && !isAlreadyInStack) {
      setDraggedPlayerId(null);
      return;
    }
    
    // Don't move if player is already in this stack
    if (isAlreadyInStack) {
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

  // Handle drop on a stack container (for moving players between stacks)
  const handleStackDrop = (e: React.DragEvent, stack: StackGroup) => {
    e.preventDefault();
    e.currentTarget.classList.remove('ring-2', 'ring-blue-400');
    
    if (!draggedPlayerId) return;
    
    // Check if player is already in this stack
    const isAlreadyInStack = stack.players.some(p => p.id === draggedPlayerId);
    
    // Don't allow dropping on full stacks (4 players) unless player is already in this stack
    if (stack.players.length >= 4 && !isAlreadyInStack) {
      setDraggedPlayerId(null);
      return;
    }
    
    // Don't move if player is already in this stack
    if (isAlreadyInStack) {
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
            {/* Action buttons */}
            <div className="flex justify-between items-center">
              <div className="flex gap-2">
                {/* Reorder dropdown */}
                <div className="relative">
                  <button
                    onClick={() => setShowReorderMenu(!showReorderMenu)}
                    className="text-xs text-orange-600 hover:text-orange-700 dark:text-orange-400 dark:hover:text-orange-300 flex items-center gap-1 px-2 py-1 bg-orange-50 dark:bg-orange-900/20 rounded hover:bg-orange-100 dark:hover:bg-orange-900/30 transition"
                    title="Reorder stacks"
                  >
                    <Clock className="w-3 h-3" />
                    Re-order
                    <ChevronsDown className="w-3 h-3" />
                  </button>
                  {showReorderMenu && (
                    <div className="absolute top-full left-0 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg shadow-lg z-50 min-w-[160px]">
                      <button
                        onClick={() => {
                          reshuffleByWaitingTime();
                          setShowReorderMenu(false);
                        }}
                        className="w-full text-left px-3 py-2 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2 rounded-t-lg"
                      >
                        <Clock className="w-3 h-3 text-orange-500" />
                        By Waiting Time
                      </button>
                      <button
                        onClick={() => {
                          reshuffleByGamesPlayed();
                          setShowReorderMenu(false);
                        }}
                        className="w-full text-left px-3 py-2 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2"
                      >
                        <Layers className="w-3 h-3 text-blue-500" />
                        By Least Games
                      </button>
                      <button
                        onClick={() => {
                          smartRebuildStacks();
                          setShowReorderMenu(false);
                        }}
                        className="w-full text-left px-3 py-2 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2 rounded-b-lg border-t border-slate-200 dark:border-slate-600"
                      >
                        <Zap className="w-3 h-3 text-yellow-500" />
                        Smart Stack
                      </button>
                    </div>
                  )}
                </div>
                {/* Create custom stack */}
                {!isCreatingCustomStack ? (
                  <button
                    onClick={() => setIsCreatingCustomStack(true)}
                    className="text-xs text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300 flex items-center gap-1 px-2 py-1 bg-purple-50 dark:bg-purple-900/20 rounded hover:bg-purple-100 dark:hover:bg-purple-900/30 transition"
                    title="Create a custom stack of 4 players"
                  >
                    <Plus className="w-3 h-3" />
                    Custom Stack
                  </button>
                ) : (
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-purple-600 dark:text-purple-400">
                      Select {4 - customStackSelection.length} more
                    </span>
                    <button
                      onClick={() => {
                        if (customStackSelection.length === 4) {
                          createCustomStack(customStackSelection);
                          setCustomStackSelection([]);
                          setIsCreatingCustomStack(false);
                        }
                      }}
                      disabled={customStackSelection.length !== 4}
                      className={`text-xs flex items-center gap-1 px-2 py-1 rounded transition ${
                        customStackSelection.length === 4
                          ? 'text-green-600 bg-green-50 hover:bg-green-100 dark:text-green-400 dark:bg-green-900/20'
                          : 'text-slate-400 bg-slate-100 cursor-not-allowed'
                      }`}
                    >
                      <Check className="w-3 h-3" />
                      Create
                    </button>
                    <button
                      onClick={() => {
                        setCustomStackSelection([]);
                        setIsCreatingCustomStack(false);
                      }}
                      className="text-xs text-red-600 hover:text-red-700 dark:text-red-400 flex items-center gap-1 px-2 py-1 bg-red-50 dark:bg-red-900/20 rounded hover:bg-red-100 dark:hover:bg-red-900/30 transition"
                    >
                      <X className="w-3 h-3" />
                      Cancel
                    </button>
                  </div>
                )}
              </div>
              {/* Expand/Collapse buttons */}
              <div className="flex gap-2">
                <button
                  onClick={expandAll}
                  className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 flex items-center gap-1"
                >
                  <ChevronsDown className="w-3 h-3" />
                  Expand
                </button>
                <button
                  onClick={collapseAll}
                  className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 flex items-center gap-1"
                >
                  <ChevronsUp className="w-3 h-3" />
                  Collapse
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Stacks */}
      <div className="p-3 space-y-3 max-h-[500px] overflow-y-auto">
        {filteredStacks.length === 0 && queuedPlayers.length === 0 ? (
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
                // Show drop indicator if stack has less than 4 players
                if (stack.players.length < 4 && draggedPlayerId) {
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
                  {/* Show "Next" badge on the actual next stack to play (excludes custom stacks) */}
                  {(() => {
                    // Only show on ready stacks (not forming, not custom)
                    if (stack.isForming || stack.type === 'custom' || draggedPlayerId) return null;
                    
                    // Get all ready stacks (excluding custom) that have all players available
                    // Custom stacks are NOT auto-selected by autoAssignNextGame
                    const availableReadyStacks = filteredStacks.filter(s => 
                      !s.isForming && 
                      s.type !== 'custom' &&
                      !s.players.some(p => playersInGame.has(p.id))
                    );
                    
                    // The first available stack is "Next" (order already matches game selection priority)
                    const isNextStack = availableReadyStacks.length > 0 && availableReadyStacks[0].id === stack.id;
                    
                    return isNextStack ? (
                      <span className={`text-xs px-1.5 py-0.5 rounded ${theme.bg600} text-white flex items-center gap-1`}>
                        <Star className="w-3 h-3" />
                        Next
                      </span>
                    ) : null;
                  })()}
                </div>
                <div className="flex items-center gap-1">
                  {stack.players.slice(0, 4).map((p) => {
                    const isInGame = playersInGame.has(p.id);
                    return (
                      <div
                        key={p.id}
                        className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                          isInGame 
                            ? 'bg-blue-200 text-blue-700 opacity-50'
                            : getPlayerStatus(p.id) === 'winner' 
                              ? 'bg-green-200 text-green-700'
                              : getPlayerStatus(p.id) === 'loser'
                                ? 'bg-orange-200 text-orange-700'
                                : 'bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-300'
                        }`}
                        title={isInGame ? `${p.name} (Playing)` : p.name}
                      >
                        {p.name.charAt(0).toUpperCase()}
                      </div>
                    );
                  })}
                  {stack.players.length < 4 && (
                    Array.from({ length: 4 - stack.players.length }).map((_, i) => (
                      <div
                        key={`empty-${i}`}
                        className="w-6 h-6 rounded-full border-2 border-dashed border-slate-300 dark:border-slate-500"
                      />
                    ))
                  )}
                  {/* Delete button for custom stacks */}
                  {stack.type === 'custom' && stack.customIndex !== undefined && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeCustomStack(stack.customIndex!);
                      }}
                      className="ml-1 p-1 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Remove custom stack"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                  {/* Play button for ready stacks when court is available */}
                  {!stack.isForming && stack.players.length === 4 && (() => {
                    const availableCourt = session.courts.find(c => c.status === 'available');
                    if (!availableCourt) {
                      return null;
                    }
                    
                    const players = stack.players;
                    // Check if any player in this stack is already in a game
                    const hasPlayerInGame = players.some(p => playersInGame.has(p.id));
                    if (hasPlayerInGame) return null; // Don't show play button if any player is in game
                    
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
                            skippedQueue,
                            stack.customIndex // Pass custom stack index if this is a custom stack
                          );
                        }}
                        style={{
                          marginLeft: '12px',
                          padding: '8px 16px',
                          fontSize: '14px',
                          fontWeight: 'bold',
                          color: 'white',
                          backgroundColor: skippedQueue ? '#9333ea' : '#16a34a',
                          borderRadius: '8px',
                          border: '2px solid white',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          minWidth: '80px',
                          zIndex: 1000
                        }}
                        title={skippedQueue ? `Skip queue and play on ${availableCourt.name}` : `Start game on ${availableCourt.name}`}
                      >
                        {skippedQueue ? <Rocket className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                        {skippedQueue ? 'Skip' : 'Play'}
                      </button>
                    );
                  })()}
                </div>
              </div>

              {/* Expanded Player List - first ready stack is always expanded, custom stacks can be expanded */}
              {(expandedStacks.has(stack.id) || (!stack.isForming && stack.players.length === 4 && stackIdx === 0)) && (
                <div className="border-t border-slate-200 dark:border-slate-600 bg-white/50 dark:bg-slate-800/50">
                  {stack.players.map((player) => {
                    const globalIdx = getGlobalIndex(player.id);
                    const isPlayerInGame = playersInGame.has(player.id);
                    
                    return (
                      <div
                        key={player.id}
                        draggable={!isPlayerInGame}
                        onDragStart={(e) => {
                          if (isPlayerInGame) {
                            e.preventDefault();
                            return;
                          }
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
                        onClick={() => {
                          if (isCreatingCustomStack) {
                            if (customStackSelection.includes(player.id)) {
                              // Always allow deselection
                              setCustomStackSelection(customStackSelection.filter(id => id !== player.id));
                            } else if (customStackSelection.length < 4) {
                              // Only add if less than 4 selected (allow in-play players)
                              setCustomStackSelection([...customStackSelection, player.id]);
                            }
                          }
                        }}
                        className={`flex items-center gap-2 px-3 py-2 border-b border-slate-100 dark:border-slate-700 last:border-b-0 hover:bg-slate-50 dark:hover:bg-slate-700/30 ${
                          isCreatingCustomStack ? 'cursor-pointer' : 'cursor-grab active:cursor-grabbing'
                        } ${draggedPlayerId === player.id ? 'opacity-50' : ''} ${
                          customStackSelection.includes(player.id) ? 'bg-purple-100 dark:bg-purple-900/30 ring-2 ring-purple-400' : ''
                        } ${isPlayerInGame ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}
                      >
                        {/* Selection indicator or Drag Handle */}
                        {isCreatingCustomStack ? (
                          <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                            customStackSelection.includes(player.id)
                              ? 'bg-purple-500 border-purple-500 text-white'
                              : 'border-slate-300 dark:border-slate-500'
                          }`}>
                            {customStackSelection.includes(player.id) && <Check className="w-3 h-3" />}
                          </div>
                        ) : (
                          <GripVertical className={`w-4 h-4 flex-shrink-0 ${isPlayerInGame ? 'text-slate-200 dark:text-slate-600' : 'text-slate-300 dark:text-slate-500'}`} />
                        )}
                        
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                          isPlayerInGame
                            ? 'bg-blue-200 text-blue-700'
                            : getPlayerStatus(player.id) === 'winner' 
                              ? 'bg-green-200 text-green-700'
                              : getPlayerStatus(player.id) === 'loser'
                                ? 'bg-orange-200 text-orange-700'
                                : 'bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-300'
                        }`}>
                          {player.name.charAt(0).toUpperCase()}
                        </div>
                        <div className={`flex-1 min-w-0 ${isPlayerInGame ? 'opacity-50' : ''}`}>
                          <div className="flex items-center gap-2">
                            <span className={`font-medium text-sm truncate ${isPlayerInGame ? 'text-slate-500 dark:text-slate-400' : 'text-slate-800 dark:text-slate-200'}`}>
                              {player.name}
                            </span>
                            {isPlayerInGame && (
                              <span className="text-xs px-1.5 py-0.5 rounded bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-300">
                                Playing
                              </span>
                            )}
                            {!isPlayerInGame && getPlayerStatus(player.id) === 'winner' && (
                              <Trophy className="w-3 h-3 text-green-600" />
                            )}
                            {!isPlayerInGame && getPlayerStatus(player.id) === 'loser' && (
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
                        
                        {/* Remove from queue button (hidden for custom stacks and during custom stack creation) */}
                        {!isCreatingCustomStack && stack.type !== 'custom' && (
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
                        )}
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
