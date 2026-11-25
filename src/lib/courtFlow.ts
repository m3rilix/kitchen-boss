import { useEffect, useState } from 'react';
import type { Court, Session } from '@/types';
import { usesRoundRobinStacks } from './skill';
import { nextPlayableWinLoseStack } from './winLoseOrder';

/** Format elapsed milliseconds as M:SS */
export function formatElapsed(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/** Live "M:SS" since the game started; "0:00" when no clock is running (empty or Ready court). */
export function useElapsed(startedAt?: Date | string): string {
  const [elapsed, setElapsed] = useState('0:00');
  useEffect(() => {
    if (!startedAt) {
      setElapsed('0:00');
      return;
    }
    const start = new Date(startedAt).getTime();
    const tick = () => setElapsed(formatElapsed(Date.now() - start));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [startedAt]);
  return elapsed;
}

/** Whether the court's Next button has a stack to pull right now. */
export function canPullNextStack(session: Session): boolean {
  if (session.rotationMode === 'doubles') {
    // Need at least 2 eligible pairs (all players available, not on a court)
    const onCourt = playersOnCourts(session);
    const queued = [
      ...(session.doublesWinnerQueue ?? []),
      ...(session.doublesLoserQueue ?? []),
      ...(session.doublesWaitingQueue ?? []),
    ];
    const eligible = queued.filter(pairId => {
      const pair = session.pairs?.find(p => p.id === pairId);
      if (!pair || onCourt.has(pair.player1Id) || onCourt.has(pair.player2Id)) return false;
      const p1 = session.players.find(p => p.id === pair.player1Id);
      const p2 = session.players.find(p => p.id === pair.player2Id);
      return !!(p1?.isActive && !p1.unavailable && p2?.isActive && !p2.unavailable);
    });
    return eligible.length >= 2;
  }
  if (usesRoundRobinStacks(session.rotationMode)) {
    return (session.roundRobinStacks?.length ?? 0) > 0 || (session.customStacks?.length ?? 0) > 0;
  }
  // Win-Lose: the same play order the Next button uses
  return !!nextPlayableWinLoseStack(session);
}

export function playersOnCourts(session: Session): Set<string> {
  return new Set(
    session.courts.flatMap(c => (c.currentGame ? [...c.currentGame.team1, ...c.currentGame.team2] : []))
  );
}

export type CourtState = 'active' | 'ready' | 'waiting' | 'maintenance';

/** Display state: in play → active, players on but not started → ready, empty → waiting. */
export function courtState(court: Court): CourtState {
  if (court.status === 'maintenance') return 'maintenance';
  if (court.status === 'in_game' && court.currentGame) return 'active';
  if (court.status === 'ready' && court.currentGame) return 'ready';
  return 'waiting';
}
