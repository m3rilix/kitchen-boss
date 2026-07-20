import type { Player, MatchHistoryEntry } from '@/types';

export interface RepeatPartnership {
  playerAId: string;
  playerAName: string;
  playerBId: string;
  playerBName: string;
  count: number;
}

export interface RepeatMatchup {
  teamANames: [string, string];
  teamBNames: [string, string];
  count: number;
}

export interface WaitingPlayer {
  id: string;
  name: string;
  waitMinutes: number;
}

export interface RotationHealthReport {
  totalGames: number;
  totalPartnerships: number;
  repeatPartnerships: RepeatPartnership[]; // count >= 2, sorted desc
  totalMatchups: number;
  repeatMatchups: RepeatMatchup[]; // count >= 2, sorted desc
  longestWaiting: WaitingPlayer[]; // top 5 currently-waiting players, longest first
}

function pairKey(a: string, b: string): string {
  return [a, b].sort().join('::');
}

/**
 * Scans match history for repeat partnerships/matchups and the players who've been
 * waiting longest right now. Used to surface rotation fairness in the leaderboard.
 */
export function analyzeRotationHealth(
  players: Player[],
  matchHistory: MatchHistoryEntry[],
  now: number = Date.now()
): RotationHealthReport {
  const nameOf = (id: string) => players.find(p => p.id === id)?.name ?? 'Unknown';

  const partnerCounts = new Map<string, { a: string; b: string; count: number }>();
  const matchupCounts = new Map<string, { teamA: [string, string]; teamB: [string, string]; count: number }>();

  for (const m of matchHistory) {
    const [a1, a2] = m.team1;
    const [b1, b2] = m.team2;

    const pk1 = pairKey(a1, a2);
    const existing1 = partnerCounts.get(pk1) ?? { a: a1, b: a2, count: 0 };
    existing1.count++;
    partnerCounts.set(pk1, existing1);

    const pk2 = pairKey(b1, b2);
    const existing2 = partnerCounts.get(pk2) ?? { a: b1, b: b2, count: 0 };
    existing2.count++;
    partnerCounts.set(pk2, existing2);

    // Order-independent team-vs-team key (sorted so A-vs-B and B-vs-A collapse together)
    const matchupKey = [pk1, pk2].sort().join('||');
    const existingM = matchupCounts.get(matchupKey) ?? { teamA: [a1, a2] as [string, string], teamB: [b1, b2] as [string, string], count: 0 };
    existingM.count++;
    matchupCounts.set(matchupKey, existingM);
  }

  const repeatPartnerships: RepeatPartnership[] = Array.from(partnerCounts.values())
    .filter(x => x.count >= 2)
    .map(x => ({ playerAId: x.a, playerAName: nameOf(x.a), playerBId: x.b, playerBName: nameOf(x.b), count: x.count }))
    .sort((p, q) => q.count - p.count)
    .slice(0, 8);

  const repeatMatchups: RepeatMatchup[] = Array.from(matchupCounts.values())
    .filter(x => x.count >= 2)
    .map(x => ({
      teamANames: [nameOf(x.teamA[0]), nameOf(x.teamA[1])] as [string, string],
      teamBNames: [nameOf(x.teamB[0]), nameOf(x.teamB[1])] as [string, string],
      count: x.count,
    }))
    .sort((p, q) => q.count - p.count)
    .slice(0, 8);

  const longestWaiting: WaitingPlayer[] = players
    .filter(p => p.isActive && p.waitingSince > 0)
    .sort((a, b) => a.waitingSince - b.waitingSince) // earliest waitingSince = waiting longest
    .slice(0, 5)
    .map(p => ({ id: p.id, name: p.name, waitMinutes: Math.floor((now - p.waitingSince) / 60000) }));

  return {
    totalGames: matchHistory.length,
    totalPartnerships: partnerCounts.size,
    repeatPartnerships,
    totalMatchups: matchupCounts.size,
    repeatMatchups,
    longestWaiting,
  };
}
