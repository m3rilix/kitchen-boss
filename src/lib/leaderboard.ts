import type { Player, Pair, Game } from '@/types';

export type PlayerWithDiff = Player & { pointDiff: number };
export type PairWithDiff = Pair & { pointDiff: number };

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

/** Ranks active players: wins → win rate → point differential → games played. */
export function rankPlayers(players: Player[], gamesCompleted: Game[]): PlayerWithDiff[] {
  return players
    .filter(p => p.isActive)
    .map(p => ({ ...p, pointDiff: computePlayerPointDiff(p.id, gamesCompleted) }))
    .sort((a, b) => {
      if (b.gamesWon !== a.gamesWon) return b.gamesWon - a.gamesWon;
      const aRate = a.gamesPlayed > 0 ? a.gamesWon / a.gamesPlayed : 0;
      const bRate = b.gamesPlayed > 0 ? b.gamesWon / b.gamesPlayed : 0;
      if (bRate !== aRate) return bRate - aRate;
      if (b.pointDiff !== a.pointDiff) return b.pointDiff - a.pointDiff;
      return b.gamesPlayed - a.gamesPlayed;
    });
}

/** Ranks doubles pairs: wins → win rate → point differential → games played. */
export function rankPairs(pairs: Pair[], gamesCompleted: Game[]): PairWithDiff[] {
  return pairs
    .map(p => ({ ...p, pointDiff: computePairPointDiff(p, gamesCompleted) }))
    .sort((a, b) => {
      if (b.gamesWon !== a.gamesWon) return b.gamesWon - a.gamesWon;
      const aRate = a.gamesPlayed > 0 ? a.gamesWon / a.gamesPlayed : 0;
      const bRate = b.gamesPlayed > 0 ? b.gamesWon / b.gamesPlayed : 0;
      if (bRate !== aRate) return bRate - aRate;
      if (b.pointDiff !== a.pointDiff) return b.pointDiff - a.pointDiff;
      return b.gamesPlayed - a.gamesPlayed;
    });
}

export function winPct(won: number, played: number): string {
  if (played === 0) return '–';
  return Math.round((won / played) * 100) + '%';
}

/** "+15" / "-4" / "0" — signed display string for point differential. */
export function formatDiff(diff: number): string {
  if (diff > 0) return `+${diff}`;
  return `${diff}`;
}
