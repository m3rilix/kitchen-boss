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
  // Weights: waiting time (50%), games played (10%), partner variety (20%), opponent variety (20%)
  // gamesPlayed is weighted low: open play format means late arrivals can't control when they join
  const totalScore =
    (waitingTime / 60000) * 0.5 +  // Convert to minutes
    gamesPlayedScore * 0.1 +
    partnerVarietyScore * 0.2 +
    opponentVarietyScore * 0.2;
  
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
 * Score a 4-player arrangement for variety (team assignment quality).
 * Higher = better variety (fewer repeated partners/opponents, no recent repeats).
 */
function scoreArrangement(
  team1: [Player, Player],
  team2: [Player, Player],
  matchHistory: MatchHistoryEntry[]
): number {
  const t1Ids: [string, string] = [team1[0].id, team1[1].id];
  const t2Ids: [string, string] = [team2[0].id, team2[1].id];

  const partnerScore =
    -getPartnerCount(team1[0].id, team1[1].id, matchHistory) +
    -getPartnerCount(team2[0].id, team2[1].id, matchHistory);

  const recentTeamPenalty =
    (wasRecentTeam(team1[0].id, team1[1].id, matchHistory, 2) ? -100 : 0) +
    (wasRecentTeam(team2[0].id, team2[1].id, matchHistory, 2) ? -100 : 0);

  const opponentScore =
    -getOpponentCount(team1[0].id, team2[0].id, matchHistory) +
    -getOpponentCount(team1[0].id, team2[1].id, matchHistory) +
    -getOpponentCount(team1[1].id, team2[0].id, matchHistory) +
    -getOpponentCount(team1[1].id, team2[1].id, matchHistory);

  const recentMatchupPenalty = wasRecentMatchup(t1Ids, t2Ids, matchHistory, 3) ? -100 : 0;

  return partnerScore + recentTeamPenalty + opponentScore + recentMatchupPenalty;
}

/**
 * Given exactly 4 already-selected players, pick the 2v2 team split that best avoids
 * repeat partners/opponents (same variety scoring used by buildRoundRobinStack). Does
 * NOT change who's in the group of 4 — only which two players end up on the same team.
 *
 * Used to port round robin's variety-aware team assignment into modes that select
 * their own group of 4 by other means (e.g. Win-Lose Stack's FIFO stack building) but
 * still want the actual team pairing to avoid repeats.
 */
export function pickBestTeamSplit(
  players: [Player, Player, Player, Player],
  matchHistory: MatchHistoryEntry[]
): [string, string, string, string] {
  const [p0, p1, p2, p3] = players;
  const splits: [[Player, Player], [Player, Player]][] = [
    [[p0, p1], [p2, p3]],
    [[p0, p2], [p1, p3]],
    [[p0, p3], [p1, p2]],
  ];

  let best = splits[0];
  let bestScore = -Infinity;
  for (const split of splits) {
    const [t1, t2] = split;
    const s = scoreArrangement(t1, t2, matchHistory);
    if (s > bestScore) {
      bestScore = s;
      best = split;
    }
  }

  return [best[0][0].id, best[0][1].id, best[1][0].id, best[1][1].id];
}

/**
 * Build the next Round Robin stack of 4 players.
 *
 * Strategy: score all waiting players, take the top 8 by priority (wait time +
 * games played + variety), then find the best 4-player team arrangement from
 * that pool. This ensures ALL 4 spots are filled by high-priority players, not
 * just the first — fixing the "Player1 always plays" bias of the old approach.
 *
 * @param respectOrder - If true, takes first 4 in order (used by manual reorder).
 */
export function buildRoundRobinStack(
  waitingPlayers: Player[],
  matchHistory: MatchHistoryEntry[],
  respectOrder: boolean = false
): [string, string, string, string] | null {
  if (waitingPlayers.length < 4) return null;

  if (respectOrder) {
    return buildSimpleStack(waitingPlayers);
  }

  // Score all waiting players and sort by priority (highest first)
  const scored = waitingPlayers
    .filter(p => p.waitingSince > 0)
    .map(p => ({ player: p, score: scorePlayer(p, waitingPlayers, matchHistory).totalScore }))
    .sort((a, b) => b.score - a.score);

  if (scored.length < 4) return null;

  // Take the top 8 candidates (all 4 selected players will come from this pool)
  const candidates = scored.slice(0, Math.min(8, scored.length)).map(s => s.player);
  const n = candidates.length;

  let best: [string, string, string, string] | null = null;
  let bestScore = -Infinity;

  // Try all C(n,4) combinations and 3 team splits each — max C(8,4)×3 = 210 iterations
  for (let a = 0; a < n - 3; a++) {
    for (let b = a + 1; b < n - 2; b++) {
      for (let c = b + 1; c < n - 1; c++) {
        for (let d = c + 1; d < n; d++) {
          const p = [candidates[a], candidates[b], candidates[c], candidates[d]];
          const splits: [[Player, Player], [Player, Player]][] = [
            [[p[0], p[1]], [p[2], p[3]]],
            [[p[0], p[2]], [p[1], p[3]]],
            [[p[0], p[3]], [p[1], p[2]]],
          ];
          for (const [t1, t2] of splits) {
            const s = scoreArrangement(t1, t2, matchHistory);
            if (s > bestScore) {
              bestScore = s;
              best = [t1[0].id, t1[1].id, t2[0].id, t2[1].id];
            }
          }
        }
      }
    }
  }

  return best;
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
