/**
 * Smart Queue System for Kitchen Boss
 * 
 * Simple Version (current):
 * - Separate WinnerStack and LoserStack
 * - Form groups with 2 winners + 2 losers
 * - Highest wait time first
 * - Avoid repeat partners/opponents
 * 
 * Full Version (future):
 * - Priority scoring with waitTime, gamesPlayed, streaks
 * - Court promotion system
 */

import type { Player, Session } from '@/types';

// ============================================
// PLAYER INITIALIZATION
// ============================================

/**
 * Initialize smart queue fields for a new player
 */
export function initializePlayerSmartFields(player: Partial<Player>): Player {
  return {
    ...player,
    winStreak: 0,
    loseStreak: 0,
    lastPartners: [],
    lastOpponents: [],
    waitingSince: Date.now(),
  } as Player;
}

// ============================================
// PRIORITY SCORING (Full version ready)
// ============================================

interface PriorityFactors {
  waitTimeWeight: number;
  gamesPlayedWeight: number;
  winStreakPenalty: number;
  loseStreakBonus: number;
}

const DEFAULT_FACTORS: PriorityFactors = {
  waitTimeWeight: 3,
  gamesPlayedWeight: 1,
  winStreakPenalty: 0.5,
  loseStreakBonus: 0.5,
};

/**
 * Calculate priority score for a player (higher = should play sooner)
 * Used in Full version for advanced sorting
 */
export function calculatePriorityScore(
  player: Player,
  factors: PriorityFactors = DEFAULT_FACTORS
): number {
  const now = Date.now();
  const waitTimeMinutes = player.waitingSince > 0 
    ? (now - player.waitingSince) / 60000 
    : 0;
  
  // Inverse games played (fewer games = higher priority)
  const gamesPlayedInverse = Math.max(0, 10 - player.gamesPlayed);
  
  // Streak adjustments
  const streakAdjustment = player.loseStreak > 0
    ? player.loseStreak * factors.loseStreakBonus
    : -(player.winStreak * factors.winStreakPenalty);
  
  return (
    waitTimeMinutes * factors.waitTimeWeight +
    gamesPlayedInverse * factors.gamesPlayedWeight +
    streakAdjustment
  );
}

// ============================================
// STACK MANAGEMENT
// ============================================

/**
 * Sort players by wait time (longest waiting first)
 */
export function sortByWaitTime(players: Player[]): Player[] {
  return [...players].sort((a, b) => {
    // Earlier waitingSince = waited longer = higher priority
    if (a.waitingSince === 0 && b.waitingSince === 0) return 0;
    if (a.waitingSince === 0) return 1; // a is in game, b goes first
    if (b.waitingSince === 0) return -1;
    return a.waitingSince - b.waitingSince;
  });
}

/**
 * Get players from a stack by IDs
 */
export function getPlayersFromStack(
  playerIds: string[],
  allPlayers: Player[]
): Player[] {
  return playerIds
    .map(id => allPlayers.find(p => p.id === id))
    .filter((p): p is Player => p !== undefined && p.isActive);
}

// ============================================
// GROUP FORMATION (Simple Version)
// ============================================

export interface BalancedGroup {
  players: [string, string, string, string]; // 4 player IDs
  team1: [string, string];
  team2: [string, string];
}

/**
 * Form a group of 4 players from the SAME stack
 * Priority: 
 *   1. Waiting players (never played) - they've been waiting longest
 *   2. Losers play losers - give them a chance to recover
 *   3. Winners play winners - competitive games
 * Fallback: Mix stacks if not enough in one stack
 */
export function formBalancedGroup(
  winnerStack: Player[],
  loserStack: Player[],
  waitingStack: Player[]
): BalancedGroup | null {
  // Sort each stack by wait time (longest waiting first)
  const sortedWinners = sortByWaitTime(winnerStack);
  const sortedLosers = sortByWaitTime(loserStack);
  const sortedWaiting = sortByWaitTime(waitingStack);
  
  let selected: Player[] = [];
  
  // Build all possible candidate groups and pick the one with longest waiting player
  const candidates: { stack: Player[], type: string }[] = [];
  
  // Full stacks (4+ players)
  if (sortedWinners.length >= 4) {
    candidates.push({ stack: sortedWinners.slice(0, 4), type: 'winners' });
  }
  if (sortedLosers.length >= 4) {
    candidates.push({ stack: sortedLosers.slice(0, 4), type: 'losers' });
  }
  if (sortedWaiting.length >= 4) {
    candidates.push({ stack: sortedWaiting.slice(0, 4), type: 'waiting' });
  }
  
  // Mixed stack: combine losers + waiting (always consider this if it can form 4)
  if (sortedLosers.length + sortedWaiting.length >= 4) {
    const mixedStack = sortByWaitTime([...sortedLosers, ...sortedWaiting]).slice(0, 4);
    candidates.push({ stack: mixedStack, type: 'mixed' });
  }
  
  // Mixed all: combine all stacks if needed
  if (candidates.length === 0) {
    const allPlayers = sortByWaitTime([
      ...sortedWaiting,
      ...sortedLosers,
      ...sortedWinners,
    ]);
    if (allPlayers.length >= 4) {
      candidates.push({ stack: allPlayers.slice(0, 4), type: 'all' });
    }
  }
  
  // Pick the candidate with the longest waiting player (lowest waitingSince = waiting longest)
  if (candidates.length > 0) {
    const bestCandidate = candidates.reduce((best, curr) => {
      const bestMinWait = Math.min(...best.stack.map(p => p.waitingSince || Infinity));
      const currMinWait = Math.min(...curr.stack.map(p => p.waitingSince || Infinity));
      return currMinWait < bestMinWait ? curr : best;
    });
    
    selected = bestCandidate.stack;
  }
  
  if (selected.length < 4) {
    return null;
  }
  
  // Now pair them intelligently (avoid repeat partners/opponents)
  const pairing = selectTeamPairing(selected);
  
  return {
    players: [selected[0].id, selected[1].id, selected[2].id, selected[3].id],
    team1: pairing.team1,
    team2: pairing.team2,
  };
}

// ============================================
// TEAM PAIRING (Avoid repeats)
// ============================================

interface TeamPairing {
  team1: [string, string];
  team2: [string, string];
  score: number; // Lower is better (fewer repeats)
}

/**
 * Calculate repeat penalty for a potential pairing
 */
function calculatePairingPenalty(
  team1: [Player, Player],
  team2: [Player, Player]
): number {
  let penalty = 0;
  
  // Check partner repeats (high penalty)
  if (team1[0].lastPartners.includes(team1[1].id)) penalty += 10;
  if (team1[1].lastPartners.includes(team1[0].id)) penalty += 10;
  if (team2[0].lastPartners.includes(team2[1].id)) penalty += 10;
  if (team2[1].lastPartners.includes(team2[0].id)) penalty += 10;
  
  // Check opponent repeats (medium penalty)
  const team1Ids = [team1[0].id, team1[1].id];
  const team2Ids = [team2[0].id, team2[1].id];
  
  for (const p of team1) {
    for (const oppId of team2Ids) {
      if (p.lastOpponents.includes(oppId)) penalty += 3;
    }
  }
  for (const p of team2) {
    for (const oppId of team1Ids) {
      if (p.lastOpponents.includes(oppId)) penalty += 3;
    }
  }
  
  return penalty;
}

/**
 * Select best team pairing from 4 players
 * Minimizes repeat partners and opponents
 */
export function selectTeamPairing(players: Player[]): TeamPairing {
  if (players.length !== 4) {
    throw new Error('selectTeamPairing requires exactly 4 players');
  }
  
  const [a, b, c, d] = players;
  
  // All possible pairings (3 ways to split 4 into 2+2)
  const pairings: TeamPairing[] = [
    {
      team1: [a.id, b.id],
      team2: [c.id, d.id],
      score: calculatePairingPenalty([a, b], [c, d]),
    },
    {
      team1: [a.id, c.id],
      team2: [b.id, d.id],
      score: calculatePairingPenalty([a, c], [b, d]),
    },
    {
      team1: [a.id, d.id],
      team2: [b.id, c.id],
      score: calculatePairingPenalty([a, d], [b, c]),
    },
  ];
  
  // Sort by score (lowest penalty first)
  pairings.sort((x, y) => x.score - y.score);
  
  return pairings[0];
}

// ============================================
// GAME END PROCESSING
// ============================================

export interface GameEndResult {
  winnerStack: string[];
  loserStack: string[];
  waitingStack: string[];
  updatedPlayers: Player[];
}

/**
 * Process game end: update stacks and player stats
 */
export function processGameEnd(
  session: Session,
  winnerIds: [string, string],
  loserIds: [string, string]
): GameEndResult {
  const updatedPlayers = session.players.map(player => {
    const isWinner = winnerIds.includes(player.id);
    const isLoser = loserIds.includes(player.id);
    
    if (!isWinner && !isLoser) {
      return player;
    }
    
    // Determine partner and opponents
    const partnerId = isWinner
      ? winnerIds.find(id => id !== player.id)!
      : loserIds.find(id => id !== player.id)!;
    const opponentIds = isWinner ? loserIds : winnerIds;
    
    return {
      ...player,
      winStreak: isWinner ? player.winStreak + 1 : 0,
      loseStreak: isLoser ? player.loseStreak + 1 : 0,
      gamesWon: isWinner ? player.gamesWon + 1 : player.gamesWon,
      lastPartners: [partnerId, ...player.lastPartners].slice(0, 3),
      lastOpponents: [...opponentIds, ...player.lastOpponents].slice(0, 4),
      waitingSince: Date.now(), // Reset wait time when entering queue
    };
  });
  
  // Remove from current stacks
  const removeFromStacks = [...winnerIds, ...loserIds];
  
  let newWinnerStack = session.winnerStack.filter(id => !removeFromStacks.includes(id));
  let newLoserStack = session.loserStack.filter(id => !removeFromStacks.includes(id));
  let newWaitingStack = session.waitingStack.filter(id => !removeFromStacks.includes(id));
  
  // Add winners to winner stack
  newWinnerStack = [...newWinnerStack, ...winnerIds];
  
  // Add losers to loser stack
  newLoserStack = [...newLoserStack, ...loserIds];
  
  return {
    winnerStack: newWinnerStack,
    loserStack: newLoserStack,
    waitingStack: newWaitingStack,
    updatedPlayers,
  };
}

// ============================================
// NEXT GAME SELECTION
// ============================================

/**
 * Get the next 4 players for a game using smart queue logic
 * Returns null if not enough players
 */
export function getNextGamePlayers(session: Session): BalancedGroup | null {
  // Get active players from each stack (with defensive checks for old sessions)
  const winners = getPlayersFromStack(session.winnerStack ?? [], session.players);
  const losers = getPlayersFromStack(session.loserStack ?? [], session.players);
  const waiting = getPlayersFromStack(session.waitingStack ?? [], session.players);
  
  console.log('[SmartQueue] Stack sizes:', {
    winners: winners.length,
    losers: losers.length,
    waiting: waiting.length,
    winnerIds: session.winnerStack ?? [],
    loserIds: session.loserStack ?? [],
    waitingIds: session.waitingStack ?? [],
  });
  
  // Log waiting player names for debugging
  if (waiting.length > 0) {
    console.log('[SmartQueue] Waiting players:', waiting.map(p => p.name));
  }
  
  // Filter out players currently in games
  const playersInGames = new Set<string>();
  session.courts.forEach(court => {
    if (court.currentGame) {
      court.currentGame.team1.forEach(id => playersInGames.add(id));
      court.currentGame.team2.forEach(id => playersInGames.add(id));
    }
  });
  
  const availableWinners = winners.filter(p => !playersInGames.has(p.id));
  const availableLosers = losers.filter(p => !playersInGames.has(p.id));
  const availableWaiting = waiting.filter(p => !playersInGames.has(p.id));
  
  console.log('[SmartQueue] Available after filtering:', {
    winners: availableWinners.length,
    losers: availableLosers.length,
    waiting: availableWaiting.length,
    waitingNames: availableWaiting.map(p => p.name),
  });
  
  const totalAvailable = availableWinners.length + availableLosers.length + availableWaiting.length;
  
  if (totalAvailable < 4) {
    console.log('[SmartQueue] Not enough players:', totalAvailable);
    return null;
  }
  
  const result = formBalancedGroup(availableWinners, availableLosers, availableWaiting);
  
  if (result) {
    const selectedNames = result.players.map(id => 
      session.players.find(p => p.id === id)?.name || id
    );
    console.log('[SmartQueue] Selected players:', selectedNames);
  }
  
  return result;
}

// ============================================
// MIGRATION HELPERS
// ============================================

/**
 * Migrate a FIFO queue to smart queue stacks
 * All existing queue players go to waitingStack
 */
export function migrateToSmartQueue(session: Session): Partial<Session> {
  return {
    winnerStack: [],
    loserStack: [],
    waitingStack: [...session.queue],
    useSmartQueue: true,
  };
}
