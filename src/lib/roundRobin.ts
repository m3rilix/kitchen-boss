import type { Player, MatchHistoryEntry } from '@/types';

/**
 * Round Robin Stack Building Algorithm
 * 
 * Priority order for player selection:
 * 1. Longest waiting time
 * 2. Least games played
 * 3. New partner combinations (maximize variety)
 * 4. New opponent combinations (maximize variety)
 * 
 * Constraints:
 * - Avoid repeating exact teams consecutively
 * - Avoid repeating exact matchups consecutively
 * - Maintain balanced play time for all players
 */

interface PlayerScore {
  playerId: string;
  waitingTime: number;
  gamesPlayed: number;
  partnerVarietyScore: number;
  opponentVarietyScore: number;
  totalScore: number;
}

/**
 * Calculate how many times two players have partnered
 */
export function getPartnerCount(
  playerId1: string,
  playerId2: string,
  matchHistory: MatchHistoryEntry[]
): number {
  return matchHistory.filter(match => {
    const team1HasBoth = match.team1.includes(playerId1) && match.team1.includes(playerId2);
    const team2HasBoth = match.team2.includes(playerId1) && match.team2.includes(playerId2);
    return team1HasBoth || team2HasBoth;
  }).length;
}

/**
 * Calculate how many times two players have been opponents
 */
export function getOpponentCount(
  playerId1: string,
  playerId2: string,
  matchHistory: MatchHistoryEntry[]
): number {
  return matchHistory.filter(match => {
    const p1InTeam1 = match.team1.includes(playerId1);
    const p1InTeam2 = match.team2.includes(playerId1);
    const p2InTeam1 = match.team1.includes(playerId2);
    const p2InTeam2 = match.team2.includes(playerId2);
    return (p1InTeam1 && p2InTeam2) || (p1InTeam2 && p2InTeam1);
  }).length;
}

/**
 * Check if this exact team played in the last N games
 */
export function wasRecentTeam(
  player1: string,
  player2: string,
  matchHistory: MatchHistoryEntry[],
  lookbackGames: number = 2
): boolean {
  const recentMatches = matchHistory.slice(-lookbackGames);
  return recentMatches.some(match => {
    const team1Match = match.team1.includes(player1) && match.team1.includes(player2);
    const team2Match = match.team2.includes(player1) && match.team2.includes(player2);
    return team1Match || team2Match;
  });
}

/**
 * Check if this exact matchup (team vs team) happened in the last N games
 */
export function wasRecentMatchup(
  team1: [string, string],
  team2: [string, string],
  matchHistory: MatchHistoryEntry[],
  lookbackGames: number = 3
): boolean {
  const recentMatches = matchHistory.slice(-lookbackGames);
  return recentMatches.some(match => {
    const exactMatch = 
      (match.team1.includes(team1[0]) && match.team1.includes(team1[1]) &&
       match.team2.includes(team2[0]) && match.team2.includes(team2[1])) ||
      (match.team1.includes(team2[0]) && match.team1.includes(team2[1]) &&
       match.team2.includes(team1[0]) && match.team2.includes(team1[1]));
    return exactMatch;
  });
}

/**
 * Calculate partner variety score for a player
 * Lower score = more variety needed (should be prioritized for new partners)
 */
export function calculatePartnerVarietyScore(
  playerId: string,
  allPlayers: Player[],
  matchHistory: MatchHistoryEntry[]
): number {
  const otherPlayers = allPlayers.filter(p => p.id !== playerId);
  if (otherPlayers.length === 0) return 0;
  
  const partnerCounts = otherPlayers.map(p => getPartnerCount(playerId, p.id, matchHistory));
  const avgPartnerCount = partnerCounts.reduce((a, b) => a + b, 0) / partnerCounts.length;
  
  // Higher average = more variety achieved
  return avgPartnerCount;
}

/**
 * Calculate opponent variety score for a player
 */
export function calculateOpponentVarietyScore(
  playerId: string,
  allPlayers: Player[],
  matchHistory: MatchHistoryEntry[]
): number {
  const otherPlayers = allPlayers.filter(p => p.id !== playerId);
  if (otherPlayers.length === 0) return 0;
  
  const opponentCounts = otherPlayers.map(p => getOpponentCount(playerId, p.id, matchHistory));
  const avgOpponentCount = opponentCounts.reduce((a, b) => a + b, 0) / opponentCounts.length;
  
  return avgOpponentCount;
}

/**
 * Score a player for selection priority
 * Higher score = higher priority to play
 */
export function scorePlayer(
  player: Player,
  allPlayers: Player[],
  matchHistory: MatchHistoryEntry[],
  now: number = Date.now()
): PlayerScore {
  // Waiting time (higher = more priority)
  const waitingTime = player.waitingSince > 0 ? now - player.waitingSince : 0;
  
  // Games played (lower = more priority, so we invert)
  const maxGames = Math.max(...allPlayers.map(p => p.gamesPlayed), 1);
  const gamesPlayedScore = maxGames - player.gamesPlayed;
  
  // Partner variety (lower variety = more priority for new partners)
  const partnerVarietyScore = -calculatePartnerVarietyScore(player.id, allPlayers, matchHistory);
  
  // Opponent variety (lower variety = more priority for new opponents)
  const opponentVarietyScore = -calculateOpponentVarietyScore(player.id, allPlayers, matchHistory);
  
  // Weighted total score
  // Weights: waiting time (40%), games played (30%), partner variety (15%), opponent variety (15%)
  const totalScore = 
    (waitingTime / 60000) * 0.4 +  // Convert to minutes
    gamesPlayedScore * 0.3 +
    partnerVarietyScore * 0.15 +
    opponentVarietyScore * 0.15;
  
  return {
    playerId: player.id,
    waitingTime,
    gamesPlayed: player.gamesPlayed,
    partnerVarietyScore,
    opponentVarietyScore,
    totalScore,
  };
}

/**
 * Find the best partner for a player
 */
export function findBestPartner(
  player: Player,
  availablePlayers: Player[],
  matchHistory: MatchHistoryEntry[]
): Player | null {
  if (availablePlayers.length === 0) return null;
  
  // Score each potential partner
  const partnerScores = availablePlayers.map(p => {
    const partnerCount = getPartnerCount(player.id, p.id, matchHistory);
    const wasRecent = wasRecentTeam(player.id, p.id, matchHistory, 2);
    
    // Lower partner count = better (more variety)
    // Penalize recent teams heavily
    const score = -partnerCount - (wasRecent ? 100 : 0);
    
    return { player: p, score };
  });
  
  // Sort by score (higher is better)
  partnerScores.sort((a, b) => b.score - a.score);
  
  return partnerScores[0]?.player || null;
}

/**
 * Find the best opponents for a team
 */
export function findBestOpponents(
  team: [Player, Player],
  availablePlayers: Player[],
  matchHistory: MatchHistoryEntry[]
): [Player, Player] | null {
  if (availablePlayers.length < 2) return null;
  
  const teamIds: [string, string] = [team[0].id, team[1].id];
  
  // Try all possible opponent pairs
  const opponentPairs: { pair: [Player, Player]; score: number }[] = [];
  
  for (let i = 0; i < availablePlayers.length; i++) {
    for (let j = i + 1; j < availablePlayers.length; j++) {
      const opp1 = availablePlayers[i];
      const opp2 = availablePlayers[j];
      const oppIds: [string, string] = [opp1.id, opp2.id];
      
      // Check if this matchup was recent
      const wasRecent = wasRecentMatchup(teamIds, oppIds, matchHistory, 3);
      
      // Calculate opponent variety for team members
      const opp1VsTeam1 = getOpponentCount(opp1.id, team[0].id, matchHistory);
      const opp1VsTeam2 = getOpponentCount(opp1.id, team[1].id, matchHistory);
      const opp2VsTeam1 = getOpponentCount(opp2.id, team[0].id, matchHistory);
      const opp2VsTeam2 = getOpponentCount(opp2.id, team[1].id, matchHistory);
      
      // Also check if opponents have partnered recently
      const oppPartnerCount = getPartnerCount(opp1.id, opp2.id, matchHistory);
      const oppWasRecentTeam = wasRecentTeam(opp1.id, opp2.id, matchHistory, 2);
      
      // Score: lower opponent counts = better variety
      // Penalize recent matchups and recent opponent teams
      const score = 
        -(opp1VsTeam1 + opp1VsTeam2 + opp2VsTeam1 + opp2VsTeam2) -
        oppPartnerCount -
        (wasRecent ? 100 : 0) -
        (oppWasRecentTeam ? 50 : 0);
      
      opponentPairs.push({ pair: [opp1, opp2], score });
    }
  }
  
  // Sort by score (higher is better)
  opponentPairs.sort((a, b) => b.score - a.score);
  
  return opponentPairs[0]?.pair || null;
}

/**
 * Build a simple stack of 4 players - takes first 4 in order
 * Used when the input is already sorted (e.g., after reorder)
 */
export function buildSimpleStack(
  waitingPlayers: Player[]
): [string, string, string, string] | null {
  const validPlayers = waitingPlayers.filter(p => p.waitingSince > 0);
  if (validPlayers.length < 4) return null;
  
  // Just take the first 4 players in order
  return [
    validPlayers[0].id,
    validPlayers[1].id,
    validPlayers[2].id,
    validPlayers[3].id,
  ];
}

/**
 * Build the next Round Robin stack of 4 players
 * @param respectOrder - If true, takes first 4 players in order (for reorder). If false, uses scoring algorithm.
 */
export function buildRoundRobinStack(
  waitingPlayers: Player[],
  matchHistory: MatchHistoryEntry[],
  respectOrder: boolean = false
): [string, string, string, string] | null {
  if (waitingPlayers.length < 4) return null;
  
  // If respectOrder is true, just take the first 4 players
  if (respectOrder) {
    return buildSimpleStack(waitingPlayers);
  }
  
  // Score all waiting players
  const scoredPlayers = waitingPlayers
    .filter(p => p.waitingSince > 0) // Only players actually waiting
    .map(p => scorePlayer(p, waitingPlayers, matchHistory))
    .sort((a, b) => b.totalScore - a.totalScore);
  
  if (scoredPlayers.length < 4) return null;
  
  // Pick the highest priority player
  const player1Id = scoredPlayers[0].playerId;
  const player1 = waitingPlayers.find(p => p.id === player1Id)!;
  
  // Find best partner for player1
  const remainingForPartner = waitingPlayers.filter(p => p.id !== player1Id);
  const partner = findBestPartner(player1, remainingForPartner, matchHistory);
  if (!partner) return null;
  
  // Find best opponents
  const remainingForOpponents = remainingForPartner.filter(p => p.id !== partner.id);
  const opponents = findBestOpponents([player1, partner], remainingForOpponents, matchHistory);
  if (!opponents) return null;
  
  return [player1.id, partner.id, opponents[0].id, opponents[1].id];
}

/**
 * Build multiple Round Robin stacks based on court count
 */
export function buildRoundRobinStacks(
  waitingPlayers: Player[],
  matchHistory: MatchHistoryEntry[],
  courtCount: number
): string[][] {
  const stacks: string[][] = [];
  let remaining = [...waitingPlayers].filter(p => p.waitingSince > 0);
  
  // Build one stack per available court
  for (let i = 0; i < courtCount && remaining.length >= 4; i++) {
    const stack = buildRoundRobinStack(remaining, matchHistory);
    if (stack) {
      stacks.push(stack);
      // Remove selected players from remaining
      remaining = remaining.filter(p => !stack.includes(p.id));
    }
  }
  
  return stacks;
}
