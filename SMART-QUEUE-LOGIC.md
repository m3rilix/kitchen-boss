# Stack Queue Logic - Kitchen Boss

## Overview

The Stack Queue system manages player rotation for pickleball games. Instead of a simple FIFO (First-In, First-Out) queue, it uses **three separate stacks** to create balanced, fair matchups.

### Modes

| Mode | Description | Status |
|------|-------------|--------|
| **Win-Lose Stack** | Winners play winners, losers play losers | ✅ Active |
| **Round Robin** | Everyone plays with everyone (balanced rotation) | 🔜 Coming Soon |
| **King of the Court** | Winners stay until they lose | 🔜 Coming Soon |
| **Skill-Based** | Balance teams based on skill ratings | 🔜 Coming Soon |

---

## Data Model

### Player Fields (Smart Queue)
```typescript
interface Player {
  // ... existing fields ...
  winStreak: number;      // Consecutive wins (resets on loss)
  loseStreak: number;     // Consecutive losses (resets on win)
  lastPartners: string[]; // Last 3 partner IDs (for variety)
  lastOpponents: string[];// Last 4 opponent IDs (for variety)
  waitingSince: number;   // Timestamp when entered queue (0 = in game)
}
```

### Session Fields (Smart Queue)
```typescript
interface Session {
  // ... existing fields ...
  winnerStack: string[];   // Player IDs who won their last game
  loserStack: string[];    // Player IDs who lost their last game
  waitingStack: string[];  // Player IDs who haven't played yet
  useSmartQueue: boolean;  // Enable/disable smart queue (default: true)
}
```

---

## Flow: Adding a Player

```
1. Player added via addPlayer()
   ↓
2. Player gets initialized with:
   - winStreak: 0
   - loseStreak: 0
   - lastPartners: []
   - lastOpponents: []
   - waitingSince: Date.now()
   ↓
3. Player ID added to:
   - queue[] (legacy FIFO - for backwards compatibility)
   - waitingStack[] (smart queue)
```

---

## Flow: Starting a Game

```
1. autoAssignNextGame(courtId) called
   ↓
2. Check if useSmartQueue is enabled
   ↓
3. If YES → Call getNextGamePlayers(session)
   ↓
4. getNextGamePlayers() does:
   a. Get players from each stack (filter out inactive)
   b. Filter out players currently in games
   c. Call formBalancedGroup() to select 4 players
   ↓
5. formBalancedGroup() priority:
   
   PRIORITY 1: Waiting players (4+ available)
   → Players who haven't played yet get first priority
   → Sorted by waitingSince (longest waiting first)
   
   PRIORITY 2: Losers play losers (4+ available)
   → Give losers a recovery game against other losers
   → Sorted by waitingSince
   
   PRIORITY 3: Winners play winners (4+ available)
   → Competitive games for those on a streak
   → Sorted by waitingSince
   
   FALLBACK: Mix stacks
   → If no single stack has 4+ players
   → Combine all stacks, sort by wait time
   → Take first 4
   ↓
6. selectTeamPairing() creates teams:
   - Avoids repeat partners (checks lastPartners[])
   - Avoids repeat opponents (checks lastOpponents[])
   - Scores all 3 possible pairings, picks lowest penalty
   ↓
7. startGame() removes players from all stacks
   - Sets waitingSince = 0 (in game)
```

---

## Flow: Ending a Game

```
1. endGame(courtId, winner, score) called
   ↓
2. Identify winners and losers
   ↓
3. Update player stats:
   - gamesPlayed++
   - gamesWon++ (winners only)
   - winStreak: winners +1, losers reset to 0
   - loseStreak: losers +1, winners reset to 0
   - lastPartners: add partner ID (keep last 3)
   - lastOpponents: add opponent IDs (keep last 4)
   - waitingSince: Date.now() (back in queue)
   ↓
4. Update stacks:
   - Remove all 4 players from ALL stacks
   - Add winners to winnerStack
   - Add losers to loserStack
   ↓
5. Players are now ready for next game selection
```

---

## Priority Logic Explained

### Why Waiting First?
Players who haven't played yet have been waiting the longest. It's unfair to make them wait while winners/losers who just finished get to play again.

### Why Losers Before Winners?
- Losers need a "recovery game" against other losers
- Winners are on a hot streak - they can wait a bit
- Creates more balanced games (losers vs losers is more competitive than losers vs winners)

### Why Same-Stack Games?
- **Winners vs Winners**: Competitive, high-skill games
- **Losers vs Losers**: Recovery games, confidence building
- **Waiting vs Waiting**: Fair introduction for new players

---

## Team Pairing Algorithm

When 4 players are selected, there are 3 ways to split them into 2 teams:
```
Players: A, B, C, D

Option 1: (A+B) vs (C+D)
Option 2: (A+C) vs (B+D)
Option 3: (A+D) vs (B+C)
```

Each option is scored based on **penalties**:
- **+10 points**: If partners played together recently (in lastPartners[])
- **+5 points**: If opponents faced each other recently (in lastOpponents[])

The pairing with the **lowest penalty** is selected.

---

## UI Indicators

### In Player Queue:
- **🏆 W badge** (green): Player is in winner stack
- **📉 L badge** (orange): Player is in loser stack
- **🔥2W**: Win streak indicator (2+ consecutive wins)
- **3L**: Lose streak indicator (2+ consecutive losses)
- **3-1**: Win-Loss record (visible to session manager)

### Footer Message:
- "Smart Queue: Winners vs Winners, Losers vs Losers"

---

## Files

| File | Purpose |
|------|---------|
| `src/lib/smartQueue.ts` | Core smart queue logic |
| `src/store/sessionStore.ts` | State management, integrates smart queue |
| `src/types/index.ts` | Player and Session type definitions |
| `src/components/PlayerQueue.tsx` | Queue UI with stack indicators |

---

## Debug Logging

When "Start Game" is clicked, check browser console for:
```
[SmartQueue] Stack sizes: {
  winners: 6,
  losers: 6,
  waiting: 2,
  winnerIds: [...],
  loserIds: [...],
  waitingIds: [...]
}
```

This helps diagnose why certain players are being selected.
