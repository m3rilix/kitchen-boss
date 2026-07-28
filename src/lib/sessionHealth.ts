import type { Player, MatchHistoryEntry, Game } from '@/types';

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

export interface GamesPlayedSpread {
  diff: number;
  most: { id: string; name: string; gamesPlayed: number } | null;
  least: { id: string; name: string; gamesPlayed: number } | null;
}

export interface LongestMatch {
  minutes: number;
  team1Names: [string, string];
  team2Names: [string, string];
}

export interface SessionHealthReport {
  totalGames: number;
  longestWaiting: WaitingPlayer[]; // top 5 currently-waiting players, longest first
  gamesPlayedSpread: GamesPlayedSpread;
  repeatPartnerships: RepeatPartnership[]; // count >= 2, sorted desc
  repeatMatchups: RepeatMatchup[]; // count >= 2, sorted desc
  longestMatch: LongestMatch | null;
  avgGamesPerPlayer: number;
}

function pairKey(a: string, b: string): string {
  return [a, b].sort().join('::');
}

/**
 * Scans session data for fairness/rotation signals: repeat partnerships/matchups,
 * who's waited longest, the spread in games played, and match duration. Powers the
 * "Session Health" section in the leaderboard.
 */
export function analyzeSessionHealth(
  players: Player[],
  gamesCompleted: Game[],
  matchHistory: MatchHistoryEntry[],
  now: number = Date.now()
): SessionHealthReport {
  const nameOf = (id: string) => players.find(p => p.id === id)?.name ?? 'Unknown';

  // ── Repeat partnerships / matchups (from match history) ──
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

  // ── Longest waiting (right now) ──
  const longestWaiting: WaitingPlayer[] = players
    .filter(p => p.isActive && p.waitingSince > 0)
    .sort((a, b) => a.waitingSince - b.waitingSince) // earliest waitingSince = waiting longest
    .slice(0, 5)
    .map(p => ({ id: p.id, name: p.name, waitMinutes: Math.floor((now - p.waitingSince) / 60000) }));

  // ── Games played spread (most vs least, among active players who've played) ──
  const activePlayed = players.filter(p => p.isActive && p.gamesPlayed > 0);
  let gamesPlayedSpread: GamesPlayedSpread = { diff: 0, most: null, least: null };
  if (activePlayed.length > 0) {
    let most = activePlayed[0];
    let least = activePlayed[0];
    for (const p of activePlayed) {
      if (p.gamesPlayed > most.gamesPlayed) most = p;
      if (p.gamesPlayed < least.gamesPlayed) least = p;
    }
    gamesPlayedSpread = {
      diff: most.gamesPlayed - least.gamesPlayed,
      most: { id: most.id, name: most.name, gamesPlayed: most.gamesPlayed },
      least: { id: least.id, name: least.name, gamesPlayed: least.gamesPlayed },
    };
  }

  // ── Longest single match (by duration) ──
  let longestMatch: LongestMatch | null = null;
  let longestMs = -1;
  for (const g of gamesCompleted) {
    if (!g.endedAt) continue;
    const ms = new Date(g.endedAt).getTime() - new Date(g.startedAt).getTime();
    if (ms > longestMs) {
      longestMs = ms;
      longestMatch = {
        minutes: Math.round(ms / 60000),
        team1Names: [nameOf(g.team1[0]), nameOf(g.team1[1])],
        team2Names: [nameOf(g.team2[0]), nameOf(g.team2[1])],
      };
    }
  }

  // ── Average games played per active player ──
  const activePlayers = players.filter(p => p.isActive);
  const avgGamesPerPlayer = activePlayers.length > 0
    ? activePlayers.reduce((sum, p) => sum + p.gamesPlayed, 0) / activePlayers.length
    : 0;

  return {
    totalGames: gamesCompleted.length,
    longestWaiting,
    gamesPlayedSpread,
    repeatPartnerships,
    repeatMatchups,
    longestMatch,
    avgGamesPerPlayer,
  };
}
