import type { Player, MatchHistoryEntry } from '@/types';
import { skillOf } from './skill';

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
 * Check if two players have recent collision history (partnership or opponent matchup).
 * Uses persistent player-level history, so works even with empty session matchHistory.
 * Prevents both repeat partnerships AND repeated opponent matchups.
 */
function hasRecentCollision(p1: Player, p2: Player): boolean {
  // Check partnership history - they shouldn't pair again
  if (p1.lastPartners.includes(p2.id) || p2.lastPartners.includes(p1.id)) {
    return true;
  }
  // Check opponent history - they shouldn't face each other again
  if (p1.lastOpponents.includes(p2.id) || p2.lastOpponents.includes(p1.id)) {
    return true;
  }
  return false;
}

/**
 * Given exactly 4 already-selected players, pick the 2v2 team split that best avoids
 * repeat partnerships. Strategy: prefer splits where both pairs are NEW (zero gravity),
 * fallback to one repeat pair (one gravity), then fallback to collision-aware scoring.
 * Does NOT change who's in the group of 4 — only which two players end up on the same team.
 *
 * For win-lose FIFO mode: accepts whatever 4 players FIFO provides, but ensures they're
 * paired to maximize separation of players who have prior partnership history (using
 * persistent player.lastPartners, NOT session matchHistory). This works even on session
 * start with empty matchHistory.
 */
export function pickBestTeamSplit(
  players: [Player, Player, Player, Player],
  matchHistory?: MatchHistoryEntry[]
): [string, string, string, string] {
  const [p0, p1, p2, p3] = players;
  const allPlayers = [p0, p1, p2, p3];
  const splits: [[Player, Player], [Player, Player]][] = [
    [[p0, p1], [p2, p3]],
    [[p0, p2], [p1, p3]],
    [[p0, p3], [p1, p2]],
  ];

  // Calculate repeat "gravity" using player-level collision history
  // Check both session matchHistory (if provided) AND persistent player.lastPartners/lastOpponents
  // Gravity = 0: both pairs are new (no partnerships or opponent conflicts)
  // Gravity = 1: one pair has history, one pair is new
  // Gravity = 2: both pairs have history
  const splitGravity = splits.map(([t1, t2]) => {
    const t1HasHistory = hasRecentCollision(t1[0], t1[1]) ||
      (matchHistory && getPartnerCount(t1[0].id, t1[1].id, matchHistory) > 0);
    const t2HasHistory = hasRecentCollision(t2[0], t2[1]) ||
      (matchHistory && getPartnerCount(t2[0].id, t2[1].id, matchHistory) > 0);
    return (t1HasHistory ? 1 : 0) + (t2HasHistory ? 1 : 0);
  });

  // Priority 1: find a split where both pairs are new (gravity = 0)
  const zeroGravityIdx = splitGravity.findIndex(g => g === 0);
  if (zeroGravityIdx !== -1) {
    const split = splits[zeroGravityIdx];
    return [split[0][0].id, split[0][1].id, split[1][0].id, split[1][1].id];
  }

  // Priority 2: find a split with only one repeated pair (gravity = 1)
  const oneGravityIdx = splitGravity.findIndex(g => g === 1);
  if (oneGravityIdx !== -1) {
    const split = splits[oneGravityIdx];
    return [split[0][0].id, split[0][1].id, split[1][0].id, split[1][1].id];
  }

  // Priority 3: all splits have repeats; use collision-aware scoring to minimize total conflicts
  // Calculate each player's collision count (how many others in this group they've recently played with/against)
  const playerCollisions: Record<string, number> = {};
  for (const p of allPlayers) {
    playerCollisions[p.id] = allPlayers.filter(
      other => other.id !== p.id && hasRecentCollision(p, other)
    ).length;
  }

  // For each split, sum the collision counts of the two pairs (lower is better)
  const splitCollisionScore = splits.map(([t1, t2]) => {
    const t1Collision = playerCollisions[t1[0].id] + playerCollisions[t1[1].id];
    const t2Collision = playerCollisions[t2[0].id] + playerCollisions[t2[1].id];
    return t1Collision + t2Collision;
  });

  // Pick the split with lowest total collision weight
  let bestIdx = 0;
  let bestCollision = splitCollisionScore[0];
  for (let i = 1; i < splitCollisionScore.length; i++) {
    if (splitCollisionScore[i] < bestCollision) {
      bestCollision = splitCollisionScore[i];
      bestIdx = i;
    }
  }

  const split = splits[bestIdx];
  return [split[0][0].id, split[0][1].id, split[1][0].id, split[1][1].id];
}

// ── Skill-Based ──────────────────────────────────────────────────────────────
//
// Weights are in the same units as scoreArrangement, where a recent repeat
// partnership/matchup costs 100. So a 1-star team imbalance (40) is tolerated
// before repeating a recent team, but a 3-star imbalance (120) is not.
const SKILL_BALANCE_WEIGHT = 40; // per star of difference between the two team totals
const SKILL_SPREAD_WEIGHT = 25;  // per star between the strongest and weakest player on the court
const SKILL_RANK_WEIGHT = 2;     // per queue position skipped to find a closer-level player
const SKILL_POOL_SIZE = 8;

/** Cost of a 2v2 split: skill imbalance between teams, minus partner/opponent variety. Lower is better. */
function skillArrangementCost(
  team1: [Player, Player],
  team2: [Player, Player],
  matchHistory: MatchHistoryEntry[]
): number {
  const imbalance = Math.abs(
    skillOf(team1[0]) + skillOf(team1[1]) - skillOf(team2[0]) - skillOf(team2[1])
  );
  return imbalance * SKILL_BALANCE_WEIGHT - scoreArrangement(team1, team2, matchHistory);
}

/**
 * Given 4 already-selected players, pick the 2v2 split with the most even team skill
 * totals (e.g. 5+1 vs 4+2), using partner/opponent variety to break ties.
 */
export function pickBalancedTeamSplit(
  players: [Player, Player, Player, Player],
  matchHistory: MatchHistoryEntry[] = []
): [string, string, string, string] {
  const [p0, p1, p2, p3] = players;
  const splits: [[Player, Player], [Player, Player]][] = [
    [[p0, p1], [p2, p3]],
    [[p0, p2], [p1, p3]],
    [[p0, p3], [p1, p2]],
  ];
  let best = splits[0];
  let bestCost = Infinity;
  for (const split of splits) {
    const cost = skillArrangementCost(split[0], split[1], matchHistory);
    if (cost < bestCost) {
      bestCost = cost;
      best = split;
    }
  }
  return [best[0][0].id, best[0][1].id, best[1][0].id, best[1][1].id];
}

/**
 * Build the next Skill-Based stack: group players of similar level onto one court,
 * then split them into the most even teams.
 *
 * Fairness guarantee: the highest-priority player (longest wait) is always in the
 * stack — only their 3 companions are chosen for skill fit, from the next 7 in line.
 * So nobody at the far end of the skill scale can be skipped indefinitely.
 *
 * @param priorityOrdered - waiting players, highest priority first
 */
export function buildSkillBalancedStack(
  priorityOrdered: Player[],
  matchHistory: MatchHistoryEntry[]
): [string, string, string, string] | null {
  const pool = priorityOrdered.filter(p => p.waitingSince > 0).slice(0, SKILL_POOL_SIZE);
  if (pool.length < 4) return null;

  const anchor = pool[0];
  let best: [string, string, string, string] | null = null;
  let bestCost = Infinity;

  // Anchor + every 3-of-7 companion set, × 3 splits = at most 105 arrangements
  for (let a = 1; a < pool.length - 2; a++) {
    for (let b = a + 1; b < pool.length - 1; b++) {
      for (let c = b + 1; c < pool.length; c++) {
        const group = [anchor, pool[a], pool[b], pool[c]];
        const skills = group.map(skillOf);
        const groupCost =
          (Math.max(...skills) - Math.min(...skills)) * SKILL_SPREAD_WEIGHT +
          (a + b + c - 6) * SKILL_RANK_WEIGHT; // 0 when taking the next 3 in line
        const splits: [[Player, Player], [Player, Player]][] = [
          [[group[0], group[1]], [group[2], group[3]]],
          [[group[0], group[2]], [group[1], group[3]]],
          [[group[0], group[3]], [group[1], group[2]]],
        ];
        for (const [t1, t2] of splits) {
          const cost = groupCost + skillArrangementCost(t1, t2, matchHistory);
          if (cost < bestCost) {
            bestCost = cost;
            best = [t1[0].id, t1[1].id, t2[0].id, t2[1].id];
          }
        }
      }
    }
  }

  return best;
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
 * @param skillBalanced - Skill-Based mode: group similar levels, split into even teams.
 *   The input order (respectOrder) or priority score still decides who's next in line.
 */
export function buildRoundRobinStack(
  waitingPlayers: Player[],
  matchHistory: MatchHistoryEntry[],
  respectOrder: boolean = false,
  skillBalanced: boolean = false
): [string, string, string, string] | null {
  if (waitingPlayers.length < 4) return null;

  if (respectOrder && !skillBalanced) {
    return buildSimpleStack(waitingPlayers);
  }

  // Score all waiting players and sort by priority (highest first)
  const scored = waitingPlayers
    .filter(p => p.waitingSince > 0)
    .map(p => ({ player: p, score: scorePlayer(p, waitingPlayers, matchHistory).totalScore }))
    .sort((a, b) => b.score - a.score);

  if (skillBalanced) {
    const priorityOrdered = respectOrder
      ? waitingPlayers.filter(p => p.waitingSince > 0)
      : scored.map(s => s.player);
    return buildSkillBalancedStack(priorityOrdered, matchHistory);
  }

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
