import type { Player, Game } from '@/types';
import { computePlayerPointDiff } from './leaderboard';

export interface PartnerOpponentStat {
  playerId: string;
  name: string;
  games: number;
  wins: number;
  losses: number;
}

export interface MatchHistoryItem {
  gameId: string;
  won: boolean;
  partnerName?: string;
  opponentNames: string[];
  /** Score from this player's perspective: { mine, theirs }. */
  score?: { mine: number; theirs: number };
  endedAt?: Date;
  isEdited?: boolean;
}

export interface PlayerMatchStats {
  totalGames: number;
  wins: number;
  losses: number;
  winPct: string;
  pointDiff: number;
  partners: PartnerOpponentStat[];
  opponents: PartnerOpponentStat[];
  history: MatchHistoryItem[];
}

/** Builds full match stats for a single player: W/L, partners, opponents, and match history. */
export function computePlayerMatchStats(
  playerId: string,
  players: Player[],
  gamesCompleted: Game[]
): PlayerMatchStats {
  const nameById = new Map(players.map(p => [p.id, p.name]));
  const partnerMap = new Map<string, PartnerOpponentStat>();
  const opponentMap = new Map<string, PartnerOpponentStat>();
  const history: MatchHistoryItem[] = [];

  let wins = 0;
  let losses = 0;

  for (const game of gamesCompleted) {
    const onTeam1 = game.team1.includes(playerId);
    const onTeam2 = game.team2.includes(playerId);
    if (!onTeam1 && !onTeam2) continue;

    const myTeam = onTeam1 ? game.team1 : game.team2;
    const otherTeam = onTeam1 ? game.team2 : game.team1;
    const partnerId = myTeam.find(id => id !== playerId);
    const won = (onTeam1 && game.winner === 'team1') || (onTeam2 && game.winner === 'team2');

    if (won) wins++; else losses++;

    if (partnerId) {
      const existing = partnerMap.get(partnerId) ?? { playerId: partnerId, name: nameById.get(partnerId) || 'Unknown', games: 0, wins: 0, losses: 0 };
      existing.games++;
      if (won) existing.wins++; else existing.losses++;
      partnerMap.set(partnerId, existing);
    }

    for (const oppId of otherTeam) {
      const existing = opponentMap.get(oppId) ?? { playerId: oppId, name: nameById.get(oppId) || 'Unknown', games: 0, wins: 0, losses: 0 };
      existing.games++;
      if (won) existing.wins++; else existing.losses++;
      opponentMap.set(oppId, existing);
    }

    const score = game.score
      ? { mine: onTeam1 ? game.score.team1 : game.score.team2, theirs: onTeam1 ? game.score.team2 : game.score.team1 }
      : undefined;

    history.push({
      gameId: game.id,
      won,
      partnerName: partnerId ? nameById.get(partnerId) : undefined,
      opponentNames: otherTeam.map(id => nameById.get(id) || 'Unknown'),
      score,
      endedAt: game.endedAt,
      isEdited: game.isEdited,
    });
  }

  history.sort((a, b) => {
    const at = a.endedAt ? new Date(a.endedAt).getTime() : 0;
    const bt = b.endedAt ? new Date(b.endedAt).getTime() : 0;
    return bt - at;
  });

  const totalGames = wins + losses;

  return {
    totalGames,
    wins,
    losses,
    winPct: totalGames === 0 ? '–' : `${Math.round((wins / totalGames) * 100)}%`,
    pointDiff: computePlayerPointDiff(playerId, gamesCompleted),
    partners: [...partnerMap.values()].sort((a, b) => b.games - a.games),
    opponents: [...opponentMap.values()].sort((a, b) => b.games - a.games),
    history,
  };
}
