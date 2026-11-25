import type { Session } from '@/types';

export type WinLoseKind = 'waiting' | 'winner' | 'loser';

export interface WinLoseStackRef {
  kind: WinLoseKind;
  /** Index into session.waitingStacks / winnerStacks / loserStacks */
  index: number;
  playerIds: string[];
}

type StackType = 'regular' | 'winner' | 'loser';

const KEY: Record<WinLoseKind, 'waitingStacks' | 'winnerStacks' | 'loserStacks'> = {
  waiting: 'waitingStacks',
  winner: 'winnerStacks',
  loser: 'loserStacks',
};

/**
 * Win-Lose play order — the single source of truth for "which stack plays next", used by the
 * court's Next button, the manager queue and the share view so they can never disagree.
 *
 * Rule: Regular stacks first; then Winner and Loser stacks alternate. After a Loser or Regular
 * stack starts, a Winner stack is next; after a Winner stack, a Loser stack. If one type runs out,
 * the other continues. Only full (4-player) stacks whose players are all off-court are included.
 *
 * The first entry is exactly what Next will start. Later entries are a forecast: finished games
 * add new winner/loser stacks that slot into the alternation.
 */
export function orderReadyWinLoseStacks(session: Session): WinLoseStackRef[] {
  const onCourt = new Set(
    session.courts.flatMap(c => (c.currentGame ? [...c.currentGame.team1, ...c.currentGame.team2] : []))
  );
  const ready = (kind: WinLoseKind): WinLoseStackRef[] =>
    (session[KEY[kind]] || [])
      .map((playerIds, index) => ({ kind, index, playerIds }))
      .filter(s => s.playerIds.length === 4 && s.playerIds.every(id => !onCourt.has(id)));

  const regular = ready('waiting');
  const winners = ready('winner');
  const losers = ready('loser');

  const ordered: WinLoseStackRef[] = [];
  let last: StackType | undefined = session.lastStackType;
  while (regular.length || winners.length || losers.length) {
    if (regular.length) {
      ordered.push(regular.shift()!);
      last = 'regular';
      continue;
    }
    const winnerDue = last === 'loser' || last === 'regular';
    const [first, second] = winnerDue ? [winners, losers] : [losers, winners];
    const pick = first.length ? first : second;
    const next = pick.shift()!;
    ordered.push(next);
    last = next.kind === 'winner' ? 'winner' : 'loser';
  }
  return ordered;
}

/** Win-Lose stacks still filling up (fewer than 4 players): Regular, then Loser, then Winner. */
export function formingWinLoseStacks(session: Session): WinLoseStackRef[] {
  return (['waiting', 'loser', 'winner'] as WinLoseKind[]).flatMap(kind =>
    (session[KEY[kind]] || [])
      .map((playerIds, index) => ({ kind, index, playerIds }))
      .filter(s => s.playerIds.length > 0 && s.playerIds.length < 4)
  );
}
