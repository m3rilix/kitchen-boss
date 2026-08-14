/**
 * Round Robin Algorithm Simulation
 * Run via: npx tsx src/lib/roundRobin.sim.ts
 *
 * Scenario: 30 players, 4 courts, 2-hour session
 * - 26 players arrive at session start (randomly spread over 0–5 min)
 * - 4 players arrive at T+60m
 * - Each game lasts 10–15 minutes (randomized per court)
 *
 * Uses 1-minute time ticks to correctly handle player trickle-in at session start.
 * Time is anchored in the past so scorePlayer() (Date.now() - waitingSince) works correctly.
 */

import { buildRoundRobinStack, getPartnerCount, getOpponentCount } from './roundRobin';
import type { Player, MatchHistoryEntry } from '@/types';

/** Simulation-only extension of Player — extra fields for tracking sim state. */
type SimPlayer = Player & { addedAt: number; lastPlayedAt: number };

const COURTS = 4;
const SESSION_MINS = 120;
const LATE_ARRIVAL_MIN = 60;
const GAME_MIN_MINS = 10;
const GAME_MAX_MINS = 15;

// Anchor session 2 hours in the past so all simulated timestamps are behind Date.now()
const SIM_ORIGIN = Date.now() - SESSION_MINS * 60_000;

function toMs(min: number) { return SIM_ORIGIN + min * 60_000; }
function toMin(ms: number)  { return Math.round((ms - SIM_ORIGIN) / 60_000); }
function rng(lo: number, hi: number) { return Math.floor(Math.random() * (hi - lo + 1)) + lo; }

const NAMES = [
  'Alice','Bob','Carol','Dave','Eve','Frank','Grace','Hank',
  'Iris','Jack','Kate','Leo','Mia','Ned','Olivia','Pete',
  'Quinn','Rosa','Sam','Tara','Uma','Vic','Wendy','Xen','Yara','Zoe',
  // 4 late arrivals
  'Larry','Linda','Luke','Lucy',
];

function makePlayer(name: string, arrivalMin: number): SimPlayer {
  const t = toMs(arrivalMin);
  return {
    id: name.toLowerCase(),
    name,
    gamesPlayed: 0,
    gamesWon: 0,
    isActive: true,
    waitingSince: t,
    checkedInAt: new Date(t),
    winStreak: 0,
    loseStreak: 0,
    lastPartners: [],
    lastOpponents: [],
    // sim-only fields
    addedAt: t,
    lastPlayedAt: 0,
  };
}

function simulate() {
  // Assign random arrival times for early players (0–5 min)
  const earlyPlayers: SimPlayer[] = NAMES.slice(0, 26).map(n => makePlayer(n, rng(0, 5)));
  const latePlayers: SimPlayer[]  = NAMES.slice(26).map(n => makePlayer(n, LATE_ARRIVAL_MIN));
  const allPlayers: SimPlayer[]   = [...earlyPlayers, ...latePlayers];

  const matchHistory: MatchHistoryEntry[] = [];

  // courtFreeAtMin[i] = minute when court i is next free (0 = free from session start)
  const courtFreeAtMin = Array(COURTS).fill(0);

  let totalGames = 0;
  const snapshots: { min: number; lines: string[] }[] = [];

  function snapshot(atMin: number) {
    const active = allPlayers.filter(p => toMin(p.addedAt) <= atMin);
    const counts = active.map(p => p.gamesPlayed);
    const mn = Math.min(...counts), mx = Math.max(...counts);
    const avg = (counts.reduce((a,b) => a+b,0)/counts.length).toFixed(1);
    const lines = [`\n--- T+${atMin}m | ${totalGames} games played so far | late players: ${atMin >= LATE_ARRIVAL_MIN ? 'IN' : 'not yet'} ---`];
    for (const p of [...active].sort((a,b) => b.gamesPlayed - a.gamesPlayed || a.name.localeCompare(b.name))) {
      const tag = latePlayers.includes(p) ? ' [LATE]' : '';
      lines.push(`  ${(p.name + tag).padEnd(14)} games=${p.gamesPlayed}`);
    }
    lines.push(`  min=${mn}  max=${mx}  avg=${avg}  spread=${mx-mn}`);
    snapshots.push({ min: atMin, lines });
  }

  // ── 1-minute tick loop ───────────────────────────────────────────────────
  for (let t = 0; t <= SESSION_MINS; t++) {
    const currentTime = toMs(t);

    // Players available this minute: arrived AND not currently on court
    const waiting = allPlayers.filter(
      p => toMin(p.addedAt) <= t        // has arrived
        && p.waitingSince > 0           // is in the queue
        && p.waitingSince <= currentTime // finished last game (or never played)
    );

    // Try to start games on every free court
    let remainingWaiting = [...waiting];

    for (let c = 0; c < COURTS; c++) {
      if (courtFreeAtMin[c] > t) continue;      // court still busy
      if (remainingWaiting.length < 4) break;   // not enough players

      const gameDuration = rng(GAME_MIN_MINS, GAME_MAX_MINS);
      const gameEndMin   = t + gameDuration;
      if (gameEndMin > SESSION_MINS) break;       // not enough session time

      const stack = buildRoundRobinStack(remainingWaiting, matchHistory, false);
      if (!stack) break;

      courtFreeAtMin[c] = gameEndMin;
      totalGames++;

      const gameEndMs = toMs(gameEndMin);
      matchHistory.push({
        gameId: `sim-${totalGames}`,
        team1: [stack[0], stack[1]],
        team2: [stack[2], stack[3]],
        timestamp: currentTime,
        courtId: `court-${c + 1}`,
      });

      const courtPlayers = stack.map(id => allPlayers.find(p => p.id === id)!);
      for (const p of courtPlayers) {
        p.gamesPlayed++;
        p.lastPlayedAt = currentTime;
        p.waitingSince = gameEndMs;   // re-queues after game
      }

      remainingWaiting = remainingWaiting.filter(p => !stack.includes(p.id));
    }

    // Snapshots at T+30, T+60, T+90, T+120
    if ([30, 60, 90, 120].includes(t)) snapshot(t);
  }

  // ── Final report ────────────────────────────────────────────────────────

  const finalCounts = allPlayers.map(p => p.gamesPlayed);
  const fMin = Math.min(...finalCounts);
  const fMax = Math.max(...finalCounts);
  const fAvg = (finalCounts.reduce((a,b) => a+b,0)/finalCounts.length).toFixed(1);

  const totalPairs = (allPlayers.length * (allPlayers.length - 1)) / 2;
  let partnerPairs = 0, opponentPairs = 0;
  for (let i = 0; i < allPlayers.length; i++) {
    for (let j = i+1; j < allPlayers.length; j++) {
      if (getPartnerCount(allPlayers[i].id, allPlayers[j].id, matchHistory) > 0) partnerPairs++;
      if (getOpponentCount(allPlayers[i].id, allPlayers[j].id, matchHistory) > 0) opponentPairs++;
    }
  }

  console.log('=== Round Robin Simulation ===');
  console.log('30 players | 4 courts | 2-hour session | 4 late arrivals at T+60m | 10–15 min games\n');

  for (const s of snapshots) console.log(s.lines.join('\n'));

  console.log('\n=== Final Results (T+120m) ===');
  console.log(`Total court-games: ${totalGames}`);
  console.log(`Games per player:  min=${fMin}  max=${fMax}  avg=${fAvg}  spread=${fMax-fMin}\n`);

  console.log('Per-player breakdown (sorted by games played):');
  for (const p of [...allPlayers].sort((a,b) => b.gamesPlayed - a.gamesPlayed)) {
    const tag      = latePlayers.includes(p) ? ' ← LATE' : '';
    const uPart    = allPlayers.filter(q => q.id !== p.id && getPartnerCount(p.id, q.id, matchHistory) > 0).length;
    const uOpp     = allPlayers.filter(q => q.id !== p.id && getOpponentCount(p.id, q.id, matchHistory) > 0).length;
    console.log(
      `  ${(p.name + tag).padEnd(20)}  games=${String(p.gamesPlayed).padStart(2)}` +
      `  partners=${String(uPart).padStart(2)}  opponents=${String(uOpp).padStart(2)}`
    );
  }

  const lateAvg  = (latePlayers.reduce((s,p)=>s+p.gamesPlayed,0)/latePlayers.length).toFixed(1);
  const earlyAvg = (earlyPlayers.reduce((s,p)=>s+p.gamesPlayed,0)/earlyPlayers.length).toFixed(1);

  console.log(`\nUnique partner pairs:  ${partnerPairs}/${totalPairs} (${Math.round(partnerPairs/totalPairs*100)}%)`);
  console.log(`Unique opponent pairs: ${opponentPairs}/${totalPairs} (${Math.round(opponentPairs/totalPairs*100)}%)`);
  console.log(`\nEarly arrivals avg: ${earlyAvg} games`);
  console.log(`Late arrivals avg:  ${lateAvg} games  (joined at T+60m)`);

  console.log('\nLate arrival details:');
  for (const p of latePlayers) {
    const first = matchHistory.find(m => m.team1.includes(p.id) || m.team2.includes(p.id));
    if (first) {
      const waitMins = Math.round((first.timestamp - toMs(LATE_ARRIVAL_MIN)) / 60_000);
      console.log(`  ${p.name}: first game ${waitMins}m after arrival  →  ${p.gamesPlayed} total games`);
    } else {
      console.log(`  ${p.name}: never played`);
    }
  }

  // For 30 players/4 courts, late arrivals inherently play fewer games.
  // Among early arrivals only, check spread.
  const earlyCounts = earlyPlayers.map(p => p.gamesPlayed);
  const earlySpread = Math.max(...earlyCounts) - Math.min(...earlyCounts);
  console.log(`\nEarly-only spread: ${earlySpread}  (expected ≤ 3 for a fair algorithm)`);
  console.log(earlySpread <= 3
    ? `✅ Fair among on-time players (spread=${earlySpread})`
    : `⚠️  Early players uneven (spread=${earlySpread}) — review algorithm`
  );
  console.log(`Late vs early gap: ${parseFloat(earlyAvg) - parseFloat(lateAvg)} games  (expected: ~${(LATE_ARRIVAL_MIN / SESSION_MINS * parseFloat(earlyAvg)).toFixed(1)} fewer due to late arrival)`);
}

simulate();
