export type RotationMode = 'winners_stay' | 'full_rotation' | 'round_robin' | 'king_of_court' | 'skill_based' | 'win_lose_stack' | 'doubles';

export interface Player {
  id: string;
  name: string;
  skillLevel?: number; // 1-5 rating
  gamesPlayed: number;
  gamesWon: number;
  checkedInAt?: Date;
  isActive: boolean;
  unavailable?: boolean;    // Temporary "can't play" flag — shown with red marker; pair can't queue
  // Smart queue tracking (Full experience ready)
  winStreak: number;
  loseStreak: number;
  lastPartners: string[];   // Last 2-3 partner IDs
  lastOpponents: string[];  // Last 2-3 opponent IDs
  waitingSince: number;     // Timestamp when entered queue (0 if in game)
  lastGameResult?: 'won' | 'lost' | null; // Track last game result for visual status
}

// ── Doubles mode ─────────────────────────────────────────────────────────────

/** A permanent doubles partnership. Always plays as a unit. */
export interface Pair {
  id: string;
  player1Id: string;
  player2Id: string;
  /** Display name. Auto-generated as "Player1 & Player2" if not set. */
  name?: string;
  gamesPlayed: number;
  gamesWon: number;
  /** Timestamp when the pair entered the queue (0 = not queued). */
  waitingSince: number;
}

export interface Game {
  id: string;
  courtId: string;
  team1: [string, string]; // Player IDs for doubles
  team2: [string, string];
  startedAt: Date;
  endedAt?: Date;
  score?: { team1: number; team2: number };
  winner?: 'team1' | 'team2';
}

export interface Court {
  id: string;
  name: string;
  status: 'available' | 'in_game' | 'maintenance';
  currentGame?: Game;
}

export type ActivityType = 
  | 'game_started'
  | 'game_ended'
  | 'player_added'
  | 'player_queued'
  | 'player_moved_front'
  | 'player_moved_up'
  | 'player_moved_down'
  | 'player_moved'
  | 'player_removed'
  | 'stack_moved'
  | 'stack_skipped';

export interface ActivityLogEntry {
  id: string;
  type: ActivityType;
  timestamp: Date;
  message: string;
  details?: {
    playerIds?: string[];
    playerNames?: string[];
    courtId?: string;
    courtName?: string;
    winner?: 'team1' | 'team2';
    team1Names?: string[];
    team2Names?: string[];
  };
}

// Match history entry for Round Robin tracking
export interface MatchHistoryEntry {
  team1: [string, string]; // Player IDs
  team2: [string, string]; // Player IDs
  timestamp: number;
  courtId: string;
}

export interface Session {
  id: string;
  name: string;
  location?: string;
  date?: string;
  time?: string;
  courts: Court[];
  players: Player[];
  queue: string[]; // Player IDs in queue order (legacy FIFO, still used as fallback)
  rotationMode: RotationMode;
  gamesCompleted: Game[];
  activityLog: ActivityLogEntry[];
  createdAt: Date;
  isActive: boolean;
  shareCode?: string; // For session sharing
  // Smart queue stacks (Win-Lose Stack mode)
  winnerStack: string[];   // DEPRECATED - kept for backward compatibility
  loserStack: string[];    // DEPRECATED - kept for backward compatibility
  waitingStack: string[];  // Players waiting to be assigned to a stack (both modes)
  useSmartQueue: boolean;  // Toggle between FIFO and smart queue
  stackCounter: number;    // Increments each time a stack is played (for naming)
  // Win-Lose Stack mode - Pre-built stacks
  winnerStacks: string[][]; // Array of winner stacks (ready or forming)
  loserStacks: string[][];  // Array of loser stacks (ready or forming)
  waitingStacks: string[][]; // Array of regular stacks (ready or forming) - "waiting" = regular/blue stacks
  lastStackType?: 'winner' | 'loser' | 'regular'; // Track last played stack type for alternating
  // Round Robin tracking
  matchHistory: MatchHistoryEntry[]; // All past matchups for variety tracking
  customStacks: string[][];          // Manager-created custom stacks (array of player ID arrays)
  roundRobinStacks: string[][];      // Pre-built Round Robin stacks (array of 4 player IDs each)
  // Doubles mode
  pairs: Pair[];                     // All registered pairs
  doublesWinnerQueue: string[];      // Pair IDs — pairs who won their last game
  doublesLoserQueue: string[];       // Pair IDs — pairs who lost their last game
  doublesWaitingQueue: string[];     // Pair IDs — pairs who haven't played yet this session
  doublesLastMatchType: 'winner' | 'loser' | null; // Tracks alternation: was last pure match W vs W or L vs L?
}

export interface SessionConfig {
  name: string;
  location?: string;
  date?: string;
  time?: string;
  courtCount: number;
  rotationMode: RotationMode;
}
