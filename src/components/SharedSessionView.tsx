import type { Session, Player, Court, Pair, ActivityType } from '@/types';
import { useThemeClasses } from '@/store/themeStore';
import { PickleballIcon } from './PickleballIcon';
import { SettingsDropdown } from './SettingsDropdown';
import { pairDisplayName } from '@/lib/doubles';
import { useState, useMemo, useEffect } from 'react';
import { Users, Clock, Wifi, Trophy, UserPlus, Play, UserMinus, History, Rocket, Search, ArrowUpDown, ArrowUp, ArrowDown, Layers, Link2, Timer, LayoutGrid, ScrollText, X, GripVertical } from 'lucide-react';

/** Format elapsed milliseconds as M:SS */
function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

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

// Rotation mode display label
const getRotationModeDisplay = (mode: string): string => {
  switch (mode) {
    case 'win_lose_stack': return 'Stack Queue - Win/Lose';
    case 'round_robin':   return 'Stack Queue - Round Robin';
    case 'full_rotation': return 'Stack Queue';
    case 'doubles':       return 'Doubles';
    case 'king_of_court': return 'King of the Court';
    case 'skill_based':   return 'Skill-Based';
    default:              return 'Stack Queue';
  }
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
  { value: 'losses', label: 'Losses' },
  { value: 'waitTime', label: 'Wait Time' },
] as const;

type SortOption = typeof sortOptions[number]['value'];

// â”€â”€ Leaderboard helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function rankPlayers(players: Player[]): Player[] {
  return [...players].filter(p => p.isActive).sort((a, b) => {
    if (b.gamesWon !== a.gamesWon) return b.gamesWon - a.gamesWon;
    const aRate = a.gamesPlayed > 0 ? a.gamesWon / a.gamesPlayed : 0;
    const bRate = b.gamesPlayed > 0 ? b.gamesWon / b.gamesPlayed : 0;
    if (bRate !== aRate) return bRate - aRate;
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
  if (played === 0) return 'â€“';
  return Math.round((won / played) * 100) + '%';
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <span className="text-base">ðŸ¥‡</span>;
  if (rank === 2) return <span className="text-base">ðŸ¥ˆ</span>;
  if (rank === 3) return <span className="text-base">ðŸ¥‰</span>;
  return <span className="text-sm font-semibold text-slate-400 w-6 text-center">{rank}</span>;
}

// â”€â”€ Panel drag-reorder â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

type PanelId = 'courts' | 'queue' | 'players' | 'log';

interface PanelLayout {
  main: PanelId[];
  sidebar: PanelId[];
}

const DEFAULT_SHARED_LAYOUT: PanelLayout = {
  main: ['courts'],
  sidebar: ['queue', 'players', 'log'],
};

function loadSharedLayout(): PanelLayout {
  try {
    const saved = localStorage.getItem('kb-shared-panel-layout');
    if (!saved) return DEFAULT_SHARED_LAYOUT;
    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed.main) || !Array.isArray(parsed.sidebar)) return DEFAULT_SHARED_LAYOUT;
    const all: PanelId[] = ['courts', 'queue', 'players', 'log'];
    const found = new Set([...parsed.main, ...parsed.sidebar]);
    if (!all.every(p => found.has(p))) return DEFAULT_SHARED_LAYOUT;
    return parsed;
  } catch {
    return DEFAULT_SHARED_LAYOUT;
  }
}

interface DropZoneProps {
  col: 'main' | 'sidebar';
  idx: number;
  dragging: PanelId | null;
  dropTarget: { col: 'main' | 'sidebar'; idx: number } | null;
  setDropTarget: (t: { col: 'main' | 'sidebar'; idx: number } | null) => void;
  onDrop: (col: 'main' | 'sidebar', idx: number) => void;
}

function SharedDropZone({ col, idx, dragging, dropTarget, setDropTarget, onDrop }: DropZoneProps) {
  const isActive = dragging !== null && dropTarget?.col === col && dropTarget?.idx === idx;
  return (
    <div
      className={`rounded-lg transition-all duration-150 ${
        !dragging
          ? 'h-0 overflow-hidden'
          : isActive
          ? 'h-8 bg-blue-100 dark:bg-blue-900/30 border-2 border-dashed border-blue-400'
          : 'h-2'
      }`}
      onDragOver={(e) => { if (dragging) { e.preventDefault(); setDropTarget({ col, idx }); } }}
      onDrop={(e) => { if (dragging) { e.preventDefault(); onDrop(col, idx); } }}
    />
  );
}

// â”€â”€ Mobile tab config â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

type MobileSection = 'courts' | 'queue' | 'players' | 'log';

const MOBILE_TABS: { id: MobileSection; label: string; icon: React.ReactNode }[] = [
  { id: 'courts',  label: 'Courts',  icon: <LayoutGrid className="w-5 h-5" /> },
  { id: 'queue',   label: 'Queue',   icon: <Layers className="w-5 h-5" /> },
  { id: 'players', label: 'Players', icon: <Users className="w-5 h-5" /> },
  { id: 'log',     label: 'Log',     icon: <ScrollText className="w-5 h-5" /> },
];

export function SharedSessionView({ session, onExit }: SharedSessionViewProps) {
  const theme = useThemeClasses();
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [activeTab, setActiveTab] = useState<MobileSection>('courts');
  const [layout, setLayoutState] = useState<PanelLayout>(loadSharedLayout);
  const [dragging, setDragging] = useState<PanelId | null>(null);
  const [dropTarget, setDropTarget] = useState<{ col: 'main' | 'sidebar'; idx: number } | null>(null);

  const saveLayout = (l: PanelLayout) => {
    setLayoutState(l);
    localStorage.setItem('kb-shared-panel-layout', JSON.stringify(l));
  };

  const handleDrop = (col: 'main' | 'sidebar', idx: number) => {
    if (!dragging) return;
    const newLayout: PanelLayout = {
      main: layout.main.filter(p => p !== dragging),
      sidebar: layout.sidebar.filter(p => p !== dragging),
    };
    newLayout[col] = [
      ...newLayout[col].slice(0, idx),
      dragging,
      ...newLayout[col].slice(idx),
    ];
    saveLayout(newLayout);
    setDragging(null);
    setDropTarget(null);
  };

  const startDrag = (id: PanelId, e: React.DragEvent) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', id);
    setTimeout(() => setDragging(id), 0);
  };

  const endDrag = () => {
    setDragging(null);
    setDropTarget(null);
  };

  const scrollTo = (id: MobileSection) => {
    setActiveTab(id);
    document.getElementById(`shared-section-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // Get player by ID
  const getPlayerById = (playerId: string): Player | undefined => {
    return session?.players?.find(p => p.id === playerId);
  };

  const isDoubles = session?.rotationMode === 'doubles';

  // â”€â”€ Doubles queue display â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const doublesQueueSections = useMemo(() => {
    if (!isDoubles || !session?.pairs) return null;

    const playersInGameSet = new Set<string>();
    for (const court of session?.courts || []) {
      if (court.currentGame) {
        court.currentGame.team1.forEach(id => playersInGameSet.add(id));
        court.currentGame.team2.forEach(id => playersInGameSet.add(id));
      }
    }

    const buildSection = (queueIds: string[], label: string, color: 'yellow' | 'blue' | 'slate') => {
      const pairs = queueIds
        .map(id => session.pairs?.find(p => p.id === id))
        .filter((p): p is Pair => !!p);
      return { label, color, pairs };
    };

    return [
      buildSection(session.doublesWinnerQueue ?? [], 'Winners', 'yellow'),
      buildSection(session.doublesLoserQueue ?? [], 'Losers', 'blue'),
      buildSection(session.doublesWaitingQueue ?? [], 'Waiting', 'slate'),
    ];
  }, [isDoubles, session?.pairs, session?.doublesWinnerQueue, session?.doublesLoserQueue, session?.doublesWaitingQueue, session?.courts]);

  // Total pairs queued (for header count in doubles mode)
  const totalPairsQueued = useMemo(() => {
    if (!isDoubles) return 0;
    return (session?.doublesWinnerQueue?.length ?? 0)
      + (session?.doublesLoserQueue?.length ?? 0)
      + (session?.doublesWaitingQueue?.length ?? 0);
  }, [isDoubles, session?.doublesWinnerQueue, session?.doublesLoserQueue, session?.doublesWaitingQueue]);

  // Build stacks matching the Manager View logic exactly
  const stackQueue = useMemo(() => {
    try {
      if (!session?.players) return [];
      
      const getPlayersInStackOrder = (stackIds: string[]): Player[] => {
        try {
          return (stackIds || [])
            .map(id => session.players.find(p => p.id === id))
            .filter((p): p is Player => p !== undefined && p.isActive);
        } catch (e) {
          console.error('Error in getPlayersInStackOrder:', e);
          return [];
        }
      };
    
    // Get players by stack type
    const winners = getPlayersInStackOrder(session.winnerStack ?? []);
    const losers = getPlayersInStackOrder(session.loserStack ?? []);
    const free = getPlayersInStackOrder(session.waitingStack ?? []);
    
    // Combine losers + free and sort by wait time (matches game selection logic)
    const allLosersAndFree = [...losers, ...free].sort((a, b) => {
      // Handle undefined/null values
      const aWait = a?.waitingSince ?? 0;
      const bWait = b?.waitingSince ?? 0;
      if (aWait === 0 && bWait === 0) return 0;
      if (aWait === 0) return 1;
      if (bWait === 0) return -1;
      return aWait - bWait;
    });
    
    type StackGroup = {
      id: string;
      players: Player[];
      type: 'winners' | 'mixed' | 'forming';
      label: string;
      isReady: boolean;
    };
    
    // Build winner ready stacks
    const winnerReadyStacks: StackGroup[] = [];
    const winnerReadyCount = Math.floor(winners.length / 4);
    for (let i = 0; i < winnerReadyCount; i++) {
      winnerReadyStacks.push({
        id: `winners-${i}`,
        players: winners.slice(i * 4, (i + 1) * 4),
        type: 'winners',
        label: '', // Will be numbered later
        isReady: true,
      });
    }
    
    // Build mixed ready stacks from losers + free
    const mixedReadyStacks: StackGroup[] = [];
    const mixedReadyCount = Math.floor(allLosersAndFree.length / 4);
    for (let i = 0; i < mixedReadyCount; i++) {
      mixedReadyStacks.push({
        id: `mixed-${i}`,
        players: allLosersAndFree.slice(i * 4, (i + 1) * 4),
        type: 'mixed',
        label: '', // Will be numbered later
        isReady: true,
      });
    }
    
    // Combine ALL ready stacks and sort by longest waiting player (matches Manager View)
    const allReadyStacks = [...winnerReadyStacks, ...mixedReadyStacks].sort((a, b) => {
      // Handle empty stacks
      if (!a.players.length && !b.players.length) return 0;
      if (!a.players.length) return 1;
      if (!b.players.length) return -1;
      
      const aMinWait = Math.min(...a.players.map(p => p?.waitingSince ?? Infinity));
      const bMinWait = Math.min(...b.players.map(p => p?.waitingSince ?? Infinity));
      return aMinWait - bMinWait;
    });
    
    // Number the ready stacks sequentially
    allReadyStacks.forEach((stack, idx) => {
      stack.label = `Stack ${idx + 1}`;
    });
    
    // Build forming stacks
    const formingStacks: StackGroup[] = [];
    const remainingWinners = winners.slice(winnerReadyCount * 4);
    const remainingMixed = allLosersAndFree.slice(mixedReadyCount * 4);
    
    if (remainingWinners.length > 0) {
      formingStacks.push({
        id: 'forming-winners',
        players: remainingWinners,
        type: 'forming',
        label: `Winners Forming (${remainingWinners.length}/4)`,
        isReady: false,
      });
    }
    
    if (remainingMixed.length > 0) {
      formingStacks.push({
        id: 'forming-mixed',
        players: remainingMixed,
        type: 'forming',
        label: `Forming (${remainingMixed.length}/4)`,
        isReady: false,
      });
    }
    
    // Sort forming stacks by longest waiting player too
    formingStacks.sort((a, b) => {
      // Handle empty stacks
      if (!a.players.length && !b.players.length) return 0;
      if (!a.players.length) return 1;
      if (!b.players.length) return -1;
      
      const aMinWait = Math.min(...a.players.map(p => p?.waitingSince ?? Infinity));
      const bMinWait = Math.min(...b.players.map(p => p?.waitingSince ?? Infinity));
      return aMinWait - bMinWait;
    });
    
    return [...allReadyStacks, ...formingStacks];
    } catch (e) {
      console.error('Error in stackQueue computation:', e);
      return [];
    }
  }, [session?.players, session?.winnerStack, session?.loserStack, session?.waitingStack]);

  // Count players in games
  const playersInGame = session?.courts?.reduce((count, court) => {
    return count + (court.currentGame ? 4 : 0);
  }, 0) || 0;

  // Get player status based on their stack / doubles queue
  const getPlayerStatus = (playerId: string): 'winner' | 'loser' | 'waiting' | 'playing' | 'unavailable' => {
    try {
      const player = session?.players?.find(p => p.id === playerId);
      if (player?.unavailable) return 'unavailable';

      // Check if in game
      for (const court of session?.courts || []) {
        if (court.currentGame) {
          if (court.currentGame.team1.includes(playerId) || court.currentGame.team2.includes(playerId)) {
            return 'playing';
          }
        }
      }

      if (isDoubles) {
        // Find the pair this player belongs to
        const pair = session?.pairs?.find(p => p.player1Id === playerId || p.player2Id === playerId);
        if (!pair) return 'waiting';
        if (session?.doublesWinnerQueue?.includes(pair.id)) return 'winner';
        if (session?.doublesLoserQueue?.includes(pair.id)) return 'loser';
        return 'waiting';
      }

      if (session?.winnerStack?.includes(playerId)) return 'winner';
      if (session?.loserStack?.includes(playerId)) return 'loser';
      return 'waiting';
    } catch (e) {
      console.error('Error in getPlayerStatus:', e);
      return 'waiting';
    }
  };

  // Filter and sort players
  const filteredAndSortedPlayers = useMemo(() => {
    try {
      let players = session?.players?.filter(p => p.isActive) || [];
      if (!players.length) return [];
    
    // Filter by search
    if (searchQuery.trim()) {
      players = players.filter(p => 
        p.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    // Sort
    return players.sort((a, b) => {
      // Handle undefined players
      if (!a && !b) return 0;
      if (!a) return 1;
      if (!b) return -1;
      
      let result = 0;
      switch (sortBy) {
        case 'name':
          result = (a.name || '').localeCompare(b.name || '');
          break;
        case 'games':
          result = (a.gamesPlayed || 0) - (b.gamesPlayed || 0);
          break;
        case 'wins':
          result = (a.gamesWon || 0) - (b.gamesWon || 0);
          break;
        case 'losses':
          result = ((a.gamesPlayed || 0) - (a.gamesWon || 0)) - ((b.gamesPlayed || 0) - (b.gamesWon || 0));
          break;
        case 'waitTime':
          // Only compare waiting times for players actually waiting (waitingSince > 0)
          // Players in game (waitingSince = 0) should be considered as not waiting at all
          const aWait = a.waitingSince || 0;
          const bWait = b.waitingSince || 0;
          if (aWait === 0 && bWait === 0) {
            result = 0;
          } else if (aWait === 0) {
            result = 1; // a is in game, b is waiting
          } else if (bWait === 0) {
            result = -1; // b is in game, a is waiting
          } else {
            // Lower waitingSince = waiting longer
            result = aWait - bWait;
          }
          break;
      }
      return sortDir === 'asc' ? result : -result;
    });
    } catch (e) {
      console.error('Error in filteredAndSortedPlayers:', e);
      return [];
    }
  }, [session?.players, searchQuery, sortBy, sortDir]);

  // Early return if no session (after all hooks)
  if (!session) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-500">Session not found</p>
        </div>
      </div>
    );
  }

  // â”€â”€ Panel content â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const renderPanelContent = (id: PanelId): React.ReactNode => {
    switch (id) {
      case 'courts':
        return (
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700">
              <h3 className="font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <LayoutGrid className="w-4 h-4 text-blue-500" />
                Courts ({session?.courts?.length || 0})
              </h3>
            </div>
            <div className="p-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {(session?.courts || []).map((court) => (
                  <ReadOnlyCourtView key={court.id} court={court} getPlayerById={getPlayerById} />
                ))}
              </div>
            </div>
          </div>
        );

      case 'queue':
        return (
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700">
              <h3 className="font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <Layers className="w-4 h-4 text-amber-500" />
                {isDoubles
                  ? `Pairs Queue (${totalPairsQueued})`
                  : `Stack Queue (${session?.queue?.length || 0})`
                }
              </h3>
            </div>
            <div className="p-3 max-h-80 overflow-y-auto">
              {isDoubles ? (
                doublesQueueSections && doublesQueueSections.every(s => s.pairs.length === 0) ? (
                  <p className="text-sm text-slate-500 text-center py-4">No pairs queued</p>
                ) : (
                  <div className="space-y-4">
                    {doublesQueueSections?.map((section) => section.pairs.length === 0 ? null : (
                      <div key={section.label} className="space-y-1.5">
                        <div className="flex items-center gap-2 px-1">
                          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                            section.color === 'yellow' ? 'bg-amber-400' :
                            section.color === 'blue'   ? 'bg-blue-400' : 'bg-slate-400'
                          }`} />
                          <span className={`text-xs font-semibold ${
                            section.color === 'yellow' ? 'text-amber-600 dark:text-amber-400' :
                            section.color === 'blue'   ? 'text-blue-600 dark:text-blue-400' :
                                                         'text-slate-500 dark:text-slate-400'
                          }`}>
                            {section.label} ({section.pairs.length})
                          </span>
                        </div>
                        {section.pairs.map((pair, idx) => {
                          const p1 = session.players.find(p => p.id === pair.player1Id);
                          const p2 = session.players.find(p => p.id === pair.player2Id);
                          const displayName = pairDisplayName(pair, session.players);
                          const losses = pair.gamesPlayed - pair.gamesWon;
                          const inGame = (session?.courts || []).some(c =>
                            c.currentGame &&
                            (c.currentGame.team1.includes(pair.player1Id) || c.currentGame.team2.includes(pair.player1Id))
                          );
                          return (
                            <div key={pair.id} className={`flex items-center gap-3 p-2 rounded-lg border-l-2 ${
                              section.color === 'yellow' ? 'border-amber-400 bg-amber-50 dark:bg-amber-900/10' :
                              section.color === 'blue'   ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/10' :
                                                           'border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/40'
                            }`}>
                              <span className="text-xs font-bold text-slate-400 dark:text-slate-500 w-4 text-center flex-shrink-0">{idx + 1}</span>
                              <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-600 flex items-center justify-center flex-shrink-0">
                                <Link2 className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">{displayName}</span>
                                  {inGame && (
                                    <span className="px-1.5 py-0.5 text-xs font-medium bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-300 rounded">In Game</span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                                  <span>{pair.gamesWon}W â€“ {losses}L</span>
                                  {p1 && p2 && (<><span>â€¢</span><span className="truncate">{p1.name} &amp; {p2.name}</span></>)}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                )
              ) : (
                stackQueue.length === 0 ? (
                  <p className="text-sm text-slate-500 text-center py-4">No players waiting</p>
                ) : (
                  <div className="space-y-3">
                    {stackQueue.map((stack) => (
                      <div key={stack.id} className="space-y-1">
                        <div className={`flex items-center justify-between px-2 py-1 rounded-lg ${
                          stack.isReady ? stack.type === 'winners' ? 'bg-green-100 dark:bg-green-900/30' : 'bg-blue-100 dark:bg-blue-900/30' : 'bg-slate-100 dark:bg-slate-700'
                        }`}>
                          <span className={`text-xs font-semibold ${
                            stack.isReady ? stack.type === 'winners' ? 'text-green-700 dark:text-green-300' : 'text-blue-700 dark:text-blue-300' : 'text-slate-600 dark:text-slate-400'
                          }`}>{stack.label}</span>
                          {stack.isReady && (
                            <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                              <Play className="w-3 h-3" />Ready
                            </span>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-1">
                          {stack.players.map((player) => (
                            <div key={player.id} className={`flex items-center gap-2 p-1.5 rounded-lg text-xs ${
                              stack.type === 'winners' ? 'bg-green-50 dark:bg-green-900/20' :
                              stack.isReady ? 'bg-blue-50 dark:bg-blue-900/20' : 'bg-slate-50 dark:bg-slate-700/50'
                            }`}>
                              <div className={`w-5 h-5 rounded-full flex items-center justify-center font-semibold text-xs flex-shrink-0 ${
                                stack.type === 'winners' ? 'bg-green-200 dark:bg-green-800 text-green-700 dark:text-green-200' : 'bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-300'
                              }`}>{player.name.charAt(0).toUpperCase()}</div>
                              <span className="truncate text-slate-700 dark:text-slate-200">{player.name}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )
              )}
            </div>
          </div>
        );

      case 'players':
        return (
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700">
              <h3 className="font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-500" />
                All Players ({session?.players?.filter(p => p.isActive).length || 0})
              </h3>
            </div>
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
                        onClick={() => { setSortBy(option.value); setShowSortMenu(false); }}
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
                  const pair = isDoubles ? session.pairs?.find(p => p.player1Id === player.id || p.player2Id === player.id) : undefined;
                  const partnerId = pair ? (pair.player1Id === player.id ? pair.player2Id : pair.player1Id) : undefined;
                  const partner = partnerId ? session.players.find(p => p.id === partnerId) : undefined;
                  return (
                    <div key={player.id} className={`flex items-center gap-3 p-2 rounded-lg ${
                      status === 'playing'     ? 'bg-red-50 dark:bg-red-900/20' :
                      status === 'unavailable' ? 'bg-slate-100 dark:bg-slate-700/60 opacity-60' :
                                                 'hover:bg-slate-50 dark:hover:bg-slate-700'
                    }`}>
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold text-sm flex-shrink-0 ${
                        status === 'playing'     ? 'bg-red-200 dark:bg-red-800 text-red-700 dark:text-red-200' :
                        status === 'winner'      ? 'bg-green-200 dark:bg-green-800 text-green-700 dark:text-green-200' :
                        status === 'loser'       ? 'bg-orange-200 dark:bg-orange-800 text-orange-700 dark:text-orange-200' :
                        status === 'unavailable' ? 'bg-slate-200 dark:bg-slate-600 text-slate-400 dark:text-slate-500' :
                                                   'bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-300'
                      }`}>{player.name.charAt(0).toUpperCase()}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-sm font-medium truncate ${
                            status === 'unavailable' ? 'line-through text-slate-400 dark:text-slate-500' : 'text-slate-700 dark:text-slate-200'
                          }`}>{player.name}</span>
                          {status === 'playing' && (
                            <span className="px-1.5 py-0.5 text-xs font-medium bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 rounded">Playing</span>
                          )}
                          {status === 'unavailable' && (
                            <span className="px-1.5 py-0.5 text-xs font-medium bg-slate-200 dark:bg-slate-700 text-slate-500 rounded">Unavailable</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 flex-wrap">
                          <span>{player.gamesPlayed} games</span>
                          {partner && (<><span>â€¢</span><span className="flex items-center gap-1"><Link2 className="w-3 h-3" />{partner.name}</span></>)}
                          {player.waitingSince > 0 && !isDoubles && (
                            <><span>â€¢</span><span className="flex items-center gap-1"><Clock className="w-3 h-3" />{formatWaitTime(player.waitingSince, player.gamesPlayed)}</span></>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );

      case 'log':
        return (
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700">
              <h3 className="font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <History className="w-4 h-4 text-slate-500" />
                Recent Activity
              </h3>
            </div>
            <div className="p-4 max-h-48 overflow-y-auto">
              {(session?.activityLog?.length || 0) === 0 ? (
                <p className="text-sm text-slate-500 text-center py-4">No activity yet</p>
              ) : (
                <div className="space-y-2">
                  {(session?.activityLog || []).slice(0, 10).map((entry) => (
                    <div key={entry.id} className="flex items-start gap-2 py-1">
                      <div className="flex-shrink-0 mt-0.5">{getActivityIcon(entry.type)}</div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs ${entry.type === 'stack_skipped' ? 'text-purple-600 dark:text-purple-400 font-medium' : 'text-slate-600 dark:text-slate-400'}`}>
                          {entry.message}
                        </p>
                        <p className="text-xs text-slate-400 dark:text-slate-500">{formatActivityTime(entry.timestamp)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
    }
  };

  const renderColumn = (col: 'main' | 'sidebar', panels: PanelId[]) => {
    const isEmpty = panels.length === 0;
    return (
      <div
        className={`space-y-1 min-h-16 rounded-xl transition-all ${
          dragging && isEmpty
            ? 'border-2 border-dashed border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/40 p-6 flex items-center justify-center'
            : ''
        }`}
        onDragOver={(e) => { if (dragging && isEmpty) { e.preventDefault(); setDropTarget({ col, idx: 0 }); } }}
        onDrop={(e) => { if (dragging && isEmpty) { e.preventDefault(); handleDrop(col, 0); } }}
      >
        {dragging && isEmpty ? (
          <p className="text-sm text-slate-400 select-none">Drop panel here</p>
        ) : (
          <>
            <SharedDropZone col={col} idx={0} dragging={dragging} dropTarget={dropTarget} setDropTarget={setDropTarget} onDrop={handleDrop} />
            {panels.map((panelId, i) => (
              <div key={panelId}>
                <div
                  id={`shared-section-${panelId}`}
                  className={`scroll-mt-20 transition-opacity duration-150 ${dragging === panelId ? 'opacity-30 pointer-events-none' : ''}`}
                >
                  <div
                    draggable
                    onDragStart={(e) => startDrag(panelId, e)}
                    onDragEnd={endDrag}
                    className="group hidden lg:flex items-center justify-center h-6 mb-1 rounded cursor-grab active:cursor-grabbing hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                    title="Drag to reposition panel"
                  >
                    <GripVertical className="w-4 h-4 text-slate-300 dark:text-slate-600 group-hover:text-slate-500 dark:group-hover:text-slate-300 transition-colors" />
                  </div>
                  {renderPanelContent(panelId)}
                </div>
                <SharedDropZone col={col} idx={i + 1} dragging={dragging} dropTarget={dropTarget} setDropTarget={setDropTarget} onDrop={handleDrop} />
              </div>
            ))}
          </>
        )}
      </div>
    );
  };

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
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                  {getRotationModeDisplay(session.rotationMode)}
                </p>
                {(session.date || session.location) && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                    {session.date && <span>{formatDate(session.date)} {formatTime(session.time)}</span>}
                    {session.date && session.location && <span> â€¢ </span>}
                    {session.location && <span>{session.location}</span>}
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
                  <p className="font-semibold text-slate-800 dark:text-slate-100">
                    {isDoubles ? totalPairsQueued : (session?.queue?.length || 0)}
                  </p>
                </div>
              </div>
              <div className="w-px h-8 bg-slate-200 dark:bg-slate-600" />
              <div className="text-sm">
                <p className="text-xs text-slate-500 dark:text-slate-400">Courts</p>
                <p className="font-semibold text-slate-800 dark:text-slate-100">{session?.courts?.length || 0}</p>
              </div>
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowLeaderboard(true)}
                className={`p-2 rounded-lg transition ${theme.bgButton} ${theme.textButton}`}
                title="Leaderboard / Stats"
              >
                <Trophy className="w-4 h-4" />
              </button>
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
      <main className="container mx-auto px-4 py-6 pb-24 lg:pb-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            {renderColumn('main', layout.main)}
          </div>
          <div>
            {renderColumn('sidebar', layout.sidebar)}
          </div>
        </div>
      </main>


      {/* Mobile bottom tab nav */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 z-20">
        <div className="flex">
          {MOBILE_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => scrollTo(tab.id)}
              className={`flex-1 flex flex-col items-center gap-0.5 py-2 text-xs font-medium transition ${
                activeTab === tab.id ? `${theme.text}` : 'text-slate-400 dark:text-slate-500'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </nav>

      {/* Leaderboard Modal */}
      {showLeaderboard && (
        <LeaderboardModal session={session} onClose={() => setShowLeaderboard(false)} />
      )}
    </div>
  );
}

// â”€â”€ Leaderboard Modal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function LeaderboardModal({ session, onClose }: { session: Session; onClose: () => void }) {
  const isDoubles = session.rotationMode === 'doubles';
  const rankedPlayers = rankPlayers(session.players);
  const rankedPairs = isDoubles ? rankPairs(session.pairs ?? []) : [];
  const totalGames = session.gamesCompleted.length;
  const activePlayers = session.players.filter(p => p.isActive);

  const partnerMap = new Map<string, string>();
  if (isDoubles) {
    (session.pairs ?? []).forEach(pair => {
      const p1 = session.players.find(p => p.id === pair.player1Id);
      const p2 = session.players.find(p => p.id === pair.player2Id);
      if (p1 && p2) { partnerMap.set(p1.id, p2.name); partnerMap.set(p2.id, p1.name); }
    });
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-white dark:bg-slate-800 rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <Trophy className="w-4 h-4 text-yellow-500" />
              Leaderboard
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {session.name} Â· {totalGames} game{totalGames !== 1 ? 's' : ''} Â· {activePlayers.length} player{activePlayers.length !== 1 ? 's' : ''}
            </p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {totalGames === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400 dark:text-slate-500">
              <Trophy className="w-10 h-10 mb-3 opacity-20" />
              <p className="text-sm">No games played yet</p>
            </div>
          ) : (
            <>
              {/* Player Rankings */}
              <div className="px-4 py-2 bg-slate-50 dark:bg-slate-700/50 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Player Rankings</p>
                <div className="flex items-center gap-3 text-xs text-slate-400 pr-1">
                  <span className="w-8 text-center">W</span>
                  <span className="w-8 text-center">L</span>
                  <span className="w-10 text-center">Win%</span>
                  <span className="w-8 text-center">GP</span>
                </div>
              </div>
              {rankedPlayers.map((player, idx) => {
                const rank = idx + 1;
                const losses = player.gamesPlayed - player.gamesWon;
                return (
                  <div key={player.id} className={`flex items-center gap-3 px-4 py-2.5 ${rank <= 3 ? 'bg-yellow-50/40 dark:bg-yellow-900/5' : ''} ${rank % 2 === 0 ? 'bg-slate-50/60 dark:bg-slate-800/30' : ''}`}>
                    <div className="w-7 flex items-center justify-center shrink-0"><RankBadge rank={rank} /></div>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold text-sm shrink-0 ${
                      rank === 1 ? 'bg-yellow-200 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-100' :
                      rank === 2 ? 'bg-slate-200 text-slate-700 dark:bg-slate-600 dark:text-slate-100' :
                      rank === 3 ? 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-200' :
                                   'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                    }`}>{player.name.charAt(0).toUpperCase()}</div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-800 dark:text-slate-100 text-sm truncate">{player.name}</p>
                      {partnerMap.get(player.id) && <p className="text-xs text-slate-400">with {partnerMap.get(player.id)}</p>}
                    </div>
                    <div className="flex items-center gap-3 text-sm shrink-0">
                      <span className="w-8 text-center font-bold text-green-600 dark:text-green-400">{player.gamesWon}</span>
                      <span className="w-8 text-center font-bold text-red-500 dark:text-red-400">{losses}</span>
                      <span className="w-10 text-center font-semibold text-slate-700 dark:text-slate-300">{winPct(player.gamesWon, player.gamesPlayed)}</span>
                      <span className="w-8 text-center text-slate-500 dark:text-slate-400">{player.gamesPlayed}</span>
                    </div>
                  </div>
                );
              })}

              {/* Pair Rankings (doubles only) */}
              {isDoubles && rankedPairs.length > 0 && (
                <>
                  <div className="px-4 py-2 mt-2 bg-slate-50 dark:bg-slate-700/50 border-y border-slate-100 dark:border-slate-700 flex items-center justify-between">
                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Pair Rankings</p>
                    <div className="flex items-center gap-3 text-xs text-slate-400 pr-1">
                      <span className="w-8 text-center">W</span>
                      <span className="w-8 text-center">L</span>
                      <span className="w-10 text-center">Win%</span>
                      <span className="w-8 text-center">GP</span>
                    </div>
                  </div>
                  {rankedPairs.map((pair, idx) => {
                    const rank = idx + 1;
                    const losses = pair.gamesPlayed - pair.gamesWon;
                    const name = pairDisplayName(pair, session.players);
                    return (
                      <div key={pair.id} className={`flex items-center gap-3 px-4 py-2.5 ${rank <= 3 ? 'bg-yellow-50/40 dark:bg-yellow-900/5' : ''} ${rank % 2 === 0 ? 'bg-slate-50/60 dark:bg-slate-800/30' : ''}`}>
                        <div className="w-7 flex items-center justify-center shrink-0"><RankBadge rank={rank} /></div>
                        <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-bold">2s</div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-slate-800 dark:text-slate-100 text-sm truncate">{name}</p>
                        </div>
                        <div className="flex items-center gap-3 text-sm shrink-0">
                          <span className="w-8 text-center font-bold text-green-600 dark:text-green-400">{pair.gamesWon}</span>
                          <span className="w-8 text-center font-bold text-red-500 dark:text-red-400">{losses}</span>
                          <span className="w-10 text-center font-semibold text-slate-700 dark:text-slate-300">{winPct(pair.gamesWon, pair.gamesPlayed)}</span>
                          <span className="w-8 text-center text-slate-500 dark:text-slate-400">{pair.gamesPlayed}</span>
                        </div>
                      </div>
                    );
                  })}
                </>
              )}

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
                    {activePlayers.length > 0 ? (totalGames * 4 / activePlayers.length).toFixed(1) : 'â€“'}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Avg GP</p>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// Read-only court view component
function ReadOnlyCourtView({ court, getPlayerById }: { court: Court; getPlayerById: (id: string) => Player | undefined }) {
  const theme = useThemeClasses();
  const isInGame = court.status === 'in_game' && court.currentGame;
  const isMaintenance = court.status === 'maintenance';

  // Live elapsed-time ticker
  const [elapsedTime, setElapsedTime] = useState('0:00');
  useEffect(() => {
    if (!court.currentGame?.startedAt) {
      setElapsedTime('0:00');
      return;
    }
    const startedAt = new Date(court.currentGame.startedAt).getTime();
    const tick = () => setElapsedTime(formatElapsed(Date.now() - startedAt));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [court.currentGame?.startedAt]);

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
          {isMaintenance ? (
            <span className="px-2 py-0.5 text-xs font-medium bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300 rounded-full">
              Maintenance
            </span>
          ) : isInGame ? (
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 text-xs font-bold bg-red-600 text-white border border-red-700 rounded-full flex items-center gap-1 animate-pulse">
                <span className="w-2 h-2 bg-white rounded-full" />
                LIVE
              </span>
              <span className="flex items-center gap-1 text-xs font-semibold text-slate-600 dark:text-slate-300 tabular-nums">
                <Timer className="w-3.5 h-3.5 text-slate-400" />
                {elapsedTime}
              </span>
            </div>
          ) : (
            <span className="px-2 py-0.5 text-xs font-medium bg-slate-200 text-slate-600 dark:bg-slate-600 dark:text-slate-300 rounded-full">
              Available
            </span>
          )}
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
