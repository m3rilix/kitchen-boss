import type { Player, RotationMode } from '@/types';

export const MIN_SKILL = 1;
export const MAX_SKILL = 5;
export const DEFAULT_SKILL = 3;

/** A player's 1–5 star rating; unrated players sit in the middle of the scale. */
export function skillOf(player: Player): number {
  return player.skillLevel ?? DEFAULT_SKILL;
}

/**
 * Modes that run on the pre-built round-robin pipeline (roundRobinStacks + waitingStack).
 * Skill-Based reuses it wholesale — only the stack builder and team split differ.
 */
export function usesRoundRobinStacks(mode: RotationMode | undefined): boolean {
  return mode === 'round_robin' || mode === 'skill_based';
}

export function isSkillBased(mode: RotationMode | undefined): boolean {
  return mode === 'skill_based';
}
