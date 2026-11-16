import type { Player, Pair, Game } from '@/types';

/** Ranking metrics added on top of the player/pair. All records come from the match log. */
export interface RankingMetrics {
  pointDiff: number;
  /** wins / games played, 0 when no games */
  winRate: number;
  /** Strength of Match: average win rate of opponents faced (per appearance), 0.5 = average */
  somScore: number;
  /** winRate + SOM_WEIGHT × (somScore − 0.5) — the primary sort key */
  adjustedWinRate: number;
  /** Fewer games than the session's provisional threshold; ranked after established entries */
  isProvisional: boolean;
}

export type PlayerWithDiff = Player & RankingMetrics;
export type PairWithDiff = Pair & RankingMetrics;

/** How much opponent strength shifts win rate. SOM spans ~0.3–0.75 in practice → about ±12 points. */
const SOM_WEIGHT = 0.5;
/** Provisional threshold = this fraction of the average games played (rounded), never below MIN. */
const PROVISIONAL_FRACTION = 0.75;
const PROVISIONAL_MIN_GAMES = 2;
const NEUTRAL_SOM = 0.5;

/** Net points (points won − points lost) across all completed games for a player. */
export function computePlayerPointDiff(playerId: string, gamesCompleted: Game[]): number {
  let diff = 0;
  for (const g of gamesCompleted) {
    if (!g.score) continue;
    if (g.team1.includes(playerId)) diff += g.score.team1 - g.score.team2;
    else if (g.team2.includes(playerId)) diff += g.score.team2 - g.score.team1;
  }
  return diff;
}

/** Net points for a doubles pair — only counts games where both partners played together as a unit. */
export function computePairPointDiff(pair: Pair, gamesCompleted: Game[]): number {
  let diff = 0;
  for (const g of gamesCompleted) {
    if (!g.score) continue;
    const inTeam1 = g.team1.includes(pair.player1Id) && g.team1.includes(pair.player2Id);
    const inTeam2 = g.team2.includes(pair.player1Id) && g.team2.includes(pair.player2Id);
    if (inTeam1) diff += g.score.team1 - g.score.team2;
    else if (inTeam2) diff += g.score.team2 - g.score.team1;
  }
  return diff;
}

// ── Shared internals ─────────────────────────────────────────────────────────

type Side = 'team1' | 'team2';
const decided = (games: Game[]) => games.filter(g => g.winner);
const otherSide = (s: Side): Side => (s === 'team1' ? 'team2' : 'team1');

/** Which side `ids` were all on in this game, if any. */
function sideOf(g: Game, ids: string[]): Side | null {
  if (ids.every(id => g.team1.includes(id))) return 'team1';
  if (ids.every(id => g.team2.includes(id))) return 'team2';
  return null;
}

/**
 * Opponent's win rate across their games, excluding games where they faced `entityIds`
 * (so an opponent's record isn't inflated or deflated by results against the player being scored).
 */
function adjustedOpponentWinRate(opponentId: string, entityIds: string[], games: Game[]): number {
  let wins = 0;
  let played = 0;
  for (const g of games) {
    const oppSide = sideOf(g, [opponentId]);
    if (!oppSide) continue;
    if (entityIds.some(id => g[otherSide(oppSide)].includes(id))) continue;
    played++;
    if (g.winner === oppSide) wins++;
  }
  return played > 0 ? wins / played : NEUTRAL_SOM;
}

/** Record + SOM for a player (ids = [playerId]) or a pair (ids = both partners). */
function computeMetrics(ids: string[], games: Game[]) {
  let wins = 0;
  let played = 0;
  const oppRates: number[] = [];
  for (const g of games) {
    const side = sideOf(g, ids);
    if (!side) continue;
    played++;
    if (g.winner === side) wins++;
    for (const oppId of g[otherSide(side)]) {
      oppRates.push(adjustedOpponentWinRate(oppId, ids, games));
    }
  }
  const winRate = played > 0 ? wins / played : 0;
  const somScore = oppRates.length > 0 ? oppRates.reduce((a, b) => a + b, 0) / oppRates.length : NEUTRAL_SOM;
  return {
    wins,
    played,
    winRate,
    somScore,
    adjustedWinRate: played > 0 ? winRate + SOM_WEIGHT * (somScore - NEUTRAL_SOM) : 0,
  };
}

/** Provisional threshold for a session: 75% of the average games played by those who've played, min 2. */
export function provisionalThreshold(gamesPlayed: number[]): number {
  const played = gamesPlayed.filter(n => n > 0);
  if (played.length === 0) return PROVISIONAL_MIN_GAMES;
  const avg = played.reduce((a, b) => a + b, 0) / played.length;
  return Math.max(PROVISIONAL_MIN_GAMES, Math.round(avg * PROVISIONAL_FRACTION));
}

/** Established first → adjusted win rate → games played → point differential. */
function compareRanked<T extends RankingMetrics & { gamesPlayed: number }>(a: T, b: T): number {
  if (a.isProvisional !== b.isProvisional) return a.isProvisional ? 1 : -1;
  const adj = b.adjustedWinRate - a.adjustedWinRate;
  if (Math.abs(adj) > 1e-9) return adj;
  if (b.gamesPlayed !== a.gamesPlayed) return b.gamesPlayed - a.gamesPlayed;
  return b.pointDiff - a.pointDiff;
}

/**
 * Ranks active players. Records (W/L/games) are recomputed from the match log so the
 * table always agrees with the ordering.
 */
export function rankPlayers(players: Player[], gamesCompleted: Game[]): PlayerWithDiff[] {
  const games = decided(gamesCompleted);
  const rows = players
    .filter(p => p.isActive)
    .map(p => {
      const m = computeMetrics([p.id], games);
      return {
        ...p,
        gamesWon: m.wins,
        gamesPlayed: m.played,
        pointDiff: computePlayerPointDiff(p.id, gamesCompleted),
        winRate: m.winRate,
        somScore: m.somScore,
        adjustedWinRate: m.adjustedWinRate,
        isProvisional: false,
      };
    });
  const threshold = provisionalThreshold(rows.map(r => r.gamesPlayed));
  return rows.map(r => ({ ...r, isProvisional: r.gamesPlayed < threshold })).sort(compareRanked);
}

/** Ranks doubles pairs with the same rules, counting only games the partners played together. */
export function rankPairs(pairs: Pair[], gamesCompleted: Game[]): PairWithDiff[] {
  const games = decided(gamesCompleted);
  const rows = pairs.map(p => {
    const m = computeMetrics([p.player1Id, p.player2Id], games);
    return {
      ...p,
      gamesWon: m.wins,
      gamesPlayed: m.played,
      pointDiff: computePairPointDiff(p, gamesCompleted),
      winRate: m.winRate,
      somScore: m.somScore,
      adjustedWinRate: m.adjustedWinRate,
      isProvisional: false,
    };
  });
  const threshold = provisionalThreshold(rows.map(r => r.gamesPlayed));
  return rows.map(r => ({ ...r, isProvisional: r.gamesPlayed < threshold })).sort(compareRanked);
}

export function winPct(won: number, played: number): string {
  if (played === 0) return '–';
  return Math.round((won / played) * 100) + '%';
}

/** SOM as a percentage ("64%"), or "–" before any games. */
export function formatSom(somScore: number, played: number): string {
  if (played === 0) return '–';
  return Math.round(somScore * 100) + '%';
}

/** "+15" / "-4" / "0" — signed display string for point differential. */
export function formatDiff(diff: number): string {
  if (diff > 0) return `+${diff}`;
  return `${diff}`;
}
