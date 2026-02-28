export type RotationMode = 'winners_stay' | 'full_rotation' | 'king_of_court' | 'skill_based';

export interface Player {
  id: string;
  name: string;
  skillLevel?: number; // 1-5 rating
  gamesPlayed: number;
  gamesWon: number;
  checkedInAt: Date;
  isActive: boolean;
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
  | 'player_removed';

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
  queue: string[]; // Player IDs in queue order
  rotationMode: RotationMode;
  gamesCompleted: Game[];
  activityLog: ActivityLogEntry[];
  createdAt: Date;
  isActive: boolean;
  shareCode?: string; // For session sharing
}

export interface SessionConfig {
  name: string;
  location?: string;
  date?: string;
  time?: string;
  courtCount: number;
  rotationMode: RotationMode;
}
