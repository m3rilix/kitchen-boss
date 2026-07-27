/**
 * Doubles Mode — Queue & Matchup Logic
 *
 * The unit of rotation is a Pair (two permanent partners).
 * Win-Lose queue priority mirrors the Win-Lose Stack mode:
 *   1. Winner vs Winner
 *   2. Loser vs Loser
 *   3. Waiting vs Waiting
 *   4. Mixed (fallback when queues are thin)
 */

import type { Pair, Player, Session } from '@/types';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Auto-generate a pair display name from two player names. */
export function pairDisplayName(pair: Pair, players: Player[]): string {
  if (pair.name) return pair.name;
  const p1 = players.find(p => p.id === pair.player1Id);
  const p2 = players.find(p => p.id === pair.player2Id);
  const n1 = p1?.name ?? '?';
  const n2 = p2?.name ?? '?';
  return `${n1} & ${n2}`;
}

/** True if both players in a pair are available (active + not unavailable). */
export function isPairAvailable(pair: Pair, players: Player[]): boolean {
  const p1 = players.find(p => p.id === pair.player1Id);
  const p2 = players.find(p => p.id === pair.player2Id);
  if (!p1 || !p2) return false;
  return p1.isActive && !p1.unavailable && p2.isActive && !p2.unavailable;
}

/** True if either player in the pair is currently in a game. */
export function isPairInGame(pair: Pair, playersInGame: Set<string>): boolean {
  return playersInGame.has(pair.player1Id) || playersInGame.has(pair.player2Id);
}

/** Find the pair that contains a given player ID (if any). */
export function findPairForPlayer(playerId: string, pairs: Pair[]): Pair | undefined {
  return pairs.find(p => p.player1Id === playerId || p.player2Id === playerId);
}

// ── Matchup builder ───────────────────────────────────────────────────────────

export interface DoublesMatchup {
  pairA: Pair;   // team1: pairA.player1Id + pairA.player2Id
  pairB: Pair;   // team2: pairB.player1Id + pairB.player2Id
  /** Which queue each pair came from — used in startGame to remove from queue */
  pairASource: 'winner' | 'loser' | 'waiting';
  pairBSource: 'winner' | 'loser' | 'waiting';
}

/**
 * Select the next two pairs to play using Win-Lose priority.
 * Pairs in a game or with an unavailable player are excluded.
 */
export function buildDoublesMatchup(session: Session): DoublesMatchup | null {
  const playersInGame = new Set<string>();
  session.courts.forEach(c => {
    if (c.currentGame) {
      c.currentGame.team1.forEach(id => playersInGame.add(id));
      c.currentGame.team2.forEach(id => playersInGame.add(id));
    }
  });

  const { pairs, players } = session;
  const winQ  = session.doublesWinnerQueue  ?? [];
  const loseQ = session.doublesLoserQueue   ?? [];
  const waitQ = session.doublesWaitingQueue ?? [];

  /** Filter a queue to pairs that are currently eligible to play. */
  const eligible = (queue: string[]): Pair[] =>
    queue
      .map(id => pairs.find(p => p.id === id))
      .filter((p): p is Pair =>
        !!p && !isPairInGame(p, playersInGame) && isPairAvailable(p, players)
      );

  const winners  = eligible(winQ);
  const losers   = eligible(loseQ);
  const waiting  = eligible(waitQ);

  type QName = 'winner' | 'loser' | 'waiting';

  const pick = (a: Pair, aName: QName, b: Pair, bName: QName): DoublesMatchup => ({
    pairA: a, pairASource: aName,
    pairB: b, pairBSource: bName,
  });

  // ── Priority 1: Waiting vs Waiting ────────────────────────────────────────
  if (waiting.length >= 2) {
    return pick(waiting[0], 'waiting', waiting[1], 'waiting');
  }

  // ── Priority 2: 1 waiting team — pair with the oldest available non-waiting pool ──
  // Never create Winner vs Loser. Pick Winner or Loser by whichever pair
  // has been waiting longest (smallest waitingSince = joined queue earlier).
  if (waiting.length === 1) {
    const topWinner = winners[0] ?? null;
    const topLoser  = losers[0]  ?? null;

    if (topWinner && topLoser) {
      // Both available — pick the one that has been waiting longer (FIFO)
      const useWinner = topWinner.waitingSince <= topLoser.waitingSince;
      return useWinner
        ? pick(waiting[0], 'waiting', topWinner, 'winner')
        : pick(waiting[0], 'waiting', topLoser,  'loser');
    }
    if (topWinner) return pick(waiting[0], 'waiting', topWinner, 'winner');
    if (topLoser)  return pick(waiting[0], 'waiting', topLoser,  'loser');
    return null; // only one pair in the entire system
  }

  // ── Priority 3: No waiting — alternate Winner vs Winner / Loser vs Loser ──
  // Use session.doublesLastMatchType to decide which pool goes next.
  // If last pure match was 'winner' → try Loser vs Loser first, then Winner vs Winner.
  // If last pure match was 'loser' or null → try Winner vs Winner first, then Loser vs Loser.
  const lastMatch = session.doublesLastMatchType ?? null;

  const tryWinnerVsWinner = winners.length >= 2
    ? pick(winners[0], 'winner', winners[1], 'winner')
    : null;
  const tryLoserVsLoser = losers.length >= 2
    ? pick(losers[0], 'loser', losers[1], 'loser')
    : null;

  if (lastMatch === 'winner') {
    // Last was W vs W → prefer L vs L this time
    return tryLoserVsLoser ?? tryWinnerVsWinner ?? null;
  } else {
    // Last was L vs L, or no history → prefer W vs W
    return tryWinnerVsWinner ?? tryLoserVsLoser ?? null;
  }
}

// ── Game-end processing ───────────────────────────────────────────────────────

export interface DoublesGameEndResult {
  pairs:               Pair[];
  players:             Player[];
  doublesWinnerQueue:  string[];
  doublesLoserQueue:   string[];
  doublesWaitingQueue: string[];
}

/**
 * After a doubles game ends:
 * - Remove both pairs from all queues (they were in a game, not queued)
 * - Append winning pair to winner queue, losing pair to loser queue
 * - Update Pair stats (gamesPlayed, gamesWon, waitingSince)
 * - Update individual Player stats (gamesPlayed, gamesWon, lastGameResult)
 */
export function processDoublesGameEnd(
  winnerPairId: string,
  loserPairId:  string,
  session:      Session
): DoublesGameEndResult {
  const now = Date.now();

  // Remove both pairs from every queue (safety: shouldn't be there, but just in case)
  const removeFromAll = (queue: string[]) =>
    queue.filter(id => id !== winnerPairId && id !== loserPairId);

  const newWinnerQ  = [...removeFromAll(session.doublesWinnerQueue  ?? []), winnerPairId];
  const newLoserQ   = [...removeFromAll(session.doublesLoserQueue   ?? []), loserPairId];
  const newWaitingQ = removeFromAll(session.doublesWaitingQueue ?? []);

  // Update pair records
  const newPairs = (session.pairs ?? []).map(pair => {
    if (pair.id === winnerPairId) {
      return { ...pair, gamesPlayed: pair.gamesPlayed + 1, gamesWon: pair.gamesWon + 1, waitingSince: now };
    }
    if (pair.id === loserPairId) {
      return { ...pair, gamesPlayed: pair.gamesPlayed + 1, waitingSince: now };
    }
    return pair;
  });

  // Determine which player IDs belong to each result
  const winnerPair = session.pairs?.find(p => p.id === winnerPairId);
  const loserPair  = session.pairs?.find(p => p.id === loserPairId);
  const winnerPlayerIds = winnerPair ? [winnerPair.player1Id, winnerPair.player2Id] : [];
  const loserPlayerIds  = loserPair  ? [loserPair.player1Id,  loserPair.player2Id]  : [];

  // Update individual player stats
  const newPlayers = session.players.map(player => {
    const isWinner = winnerPlayerIds.includes(player.id);
    const isLoser  = loserPlayerIds.includes(player.id);
    if (!isWinner && !isLoser) return player;
    return {
      ...player,
      gamesPlayed:    player.gamesPlayed + 1,
      gamesWon:       isWinner ? player.gamesWon + 1 : player.gamesWon,
      winStreak:      isWinner ? player.winStreak + 1 : 0,
      loseStreak:     isLoser  ? player.loseStreak + 1 : 0,
      waitingSince:   now,
      lastGameResult: (isWinner ? 'won' : 'lost') as 'won' | 'lost',
    };
  });

  return {
    pairs:               newPairs,
    players:             newPlayers,
    doublesWinnerQueue:  newWinnerQ,
    doublesLoserQueue:   newLoserQ,
    doublesWaitingQueue: newWaitingQ,
  };
}

/**
 * After a game is cancelled: return both pairs to the waiting queue
 * (no win/loss recorded).
 */
export function processDoublesCancelGame(
  pairAId: string,
  pairBId: string,
  session: Session
): Pick<DoublesGameEndResult, 'doublesWinnerQueue' | 'doublesLoserQueue' | 'doublesWaitingQueue' | 'players'> {
  const now = Date.now();
  const remove = (q: string[]) => q.filter(id => id !== pairAId && id !== pairBId);

  const pairA = session.pairs?.find(p => p.id === pairAId);
  const pairB = session.pairs?.find(p => p.id === pairBId);
  const returnedPlayerIds = [
    ...(pairA ? [pairA.player1Id, pairA.player2Id] : []),
    ...(pairB ? [pairB.player1Id, pairB.player2Id] : []),
  ];

  const newPlayers = session.players.map(p =>
    returnedPlayerIds.includes(p.id) ? { ...p, waitingSince: now } : p
  );

  return {
    doublesWinnerQueue:  remove(session.doublesWinnerQueue  ?? []),
    doublesLoserQueue:   remove(session.doublesLoserQueue   ?? []),
    doublesWaitingQueue: [pairAId, pairBId, ...remove(session.doublesWaitingQueue ?? [])],
    players: newPlayers,
  };
}

// ── Queue count helpers (for UI) ─────────────────────────────────────────────

/** How many eligible (non-game, available) pairs are across all doubles queues. */
export function countEligiblePairs(session: Session): number {
  const playersInGame = new Set<string>();
  session.courts.forEach(c => {
    if (c.currentGame) {
      c.currentGame.team1.forEach(id => playersInGame.add(id));
      c.currentGame.team2.forEach(id => playersInGame.add(id));
    }
  });
  const allQueued = new Set([
    ...(session.doublesWinnerQueue  ?? []),
    ...(session.doublesLoserQueue   ?? []),
    ...(session.doublesWaitingQueue ?? []),
  ]);
  return [...allQueued].filter(pairId => {
    const pair = session.pairs?.find(p => p.id === pairId);
    return pair && !isPairInGame(pair, playersInGame) && isPairAvailable(pair, session.players);
  }).length;
}
