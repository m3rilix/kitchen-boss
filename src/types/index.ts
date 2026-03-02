export type RotationMode = 'winners_stay' | 'full_rotation' | 'king_of_court' | 'skill_based';

export interface Player {
  id: string;
  name: string;
  skillLevel?: number; // 1-5 rating
  gamesPlayed: number;
  gamesWon: number;
  checkedInAt: Date;
  isActive: boolean;
  // Smart queue tracking (Full experience ready)
  winStreak: number;
  loseStreak: number;
  lastPartners: string[];   // Last 2-3 partner IDs
  lastOpponents: string[];  // Last 2-3 opponent IDs
  waitingSince: number;     // Timestamp when entered queue (0 if in game)
  lastGameResult?: 'won' | 'lost' | null; // Track last game result for visual status
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
  // Smart queue stacks
  winnerStack: string[];   // Players who won their last game
  loserStack: string[];    // Players who lost their last game
  waitingStack: string[];  // New players or overflow
  useSmartQueue: boolean;  // Toggle between FIFO and smart queue
  stackCounter: number;    // Increments each time a stack is played (for naming)
}

export interface SessionConfig {
  name: string;
  location?: string;
  date?: string;
  time?: string;
  courtCount: number;
  rotationMode: RotationMode;
}
