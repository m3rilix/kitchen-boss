# Round Robin Mode - Logic Documentation

## Overview

Round Robin mode uses a simplified 3-array system to manage player rotation. This document defines the exact logic for all operations.

---

## Data Structures

### Arrays Used (Round Robin Only)

| Array | Type | Purpose |
|-------|------|---------|
| `roundRobinStacks` | `string[][]` | Pre-built stacks of 4 player IDs, ready to play |
| `waitingStack` | `string[]` | Player IDs waiting to be assigned to a stack |
| `customStacks` | `string[][]` | User-created stacks (preserved during reorder) |

### In-Play Tracking

Players currently in games are tracked via:
- `court.currentGame.team1: [string, string]`
- `court.currentGame.team2: [string, string]`

### Player State

Each player has `waitingSince`:
- `> 0` = timestamp when started waiting (in waiting or stack)
- `= 0` = currently in a game
- `= -1` = removed from queue (sitting out)

---

## Core Operations

### 1. ADD PLAYER

**Trigger:** New player joins session

**Logic:**
```
1. Create player with waitingSince = Date.now()
2. Add player ID to end of waitingStack
3. Call buildNewStacksIfNeeded()
```

**Rules:**
- New players always go to waiting first
- Never directly add to existing stacks

---

### 2. REMOVE PLAYER

**Trigger:** Player leaves session

**Logic:**
```
1. Remove player ID from waitingStack (if present)
2. Remove player ID from all roundRobinStacks
3. For each stack that now has < 4 players:
   - Dissolve stack: move remaining players back to waitingStack
4. Call buildNewStacksIfNeeded()
```

**Rules:**
- Incomplete stacks are dissolved, not patched

---

### 3. START GAME

**Trigger:** User clicks "Start Game" on a court

**Logic:**
```
1. Get stack to use:
   - If customStacks[0] exists → use it, remove from customStacks
   - Else if roundRobinStacks[0] exists → use it, remove from roundRobinStacks
   - Else → cannot start (not enough players)
2. Assign 4 players to court.currentGame (team1, team2)
3. Set all 4 players' waitingSince = 0
4. Call buildNewStacksIfNeeded()
```

**Rules:**
- Custom stacks have priority over auto-built stacks
- Always use first stack in array (FIFO)

---

### 4. END GAME

**Trigger:** User ends a game (declares winner)

**Logic:**
```
1. Get 4 players from court.currentGame
2. Clear court.currentGame
3. Set all 4 players' waitingSince = Date.now()
4. Add all 4 player IDs to END of waitingStack
5. Call buildNewStacksIfNeeded()
```

**Rules:**
- All players go to waiting regardless of win/lose
- Players go to END of waiting (longest wait = front)

---

### 5. CANCEL GAME

**Trigger:** User cancels an in-progress game

**Logic:**
```
1. Get 4 players from court.currentGame
2. Clear court.currentGame
3. Set all 4 players' waitingSince = Date.now()
4. Add all 4 player IDs to FRONT of waitingStack
5. Call buildNewStacksIfNeeded()
```

**Rules:**
- Cancelled players get priority (front of waiting)

---

### 6. BUILD NEW STACKS IF NEEDED

**Trigger:** Called after most operations

**Logic:**
```
1. Count available courts (status = 'available')
2. Count existing stacks (roundRobinStacks.length + customStacks.length)
3. stacksNeeded = availableCourts - existingStacks
4. If stacksNeeded <= 0 → return (no action)
5. Get players available for stacking:
   - In waitingStack
   - NOT in any roundRobinStacks
   - NOT in any customStacks
   - NOT in any game
6. For each stack needed (while availablePlayers >= 4):
   - Build stack using Round Robin algorithm
   - Add to roundRobinStacks
   - Remove used players from availablePlayers
```

**Rules:**
- Never touch existing stacks
- Only build NEW stacks from waiting players
- Respect court count (don't over-build)

---

### 7. REORDER (By Waiting Time / By Games Played / Smart Stack)

**Trigger:** User clicks reorder button

**Logic:**
```
1. Collect all players from:
   - waitingStack
   - All roundRobinStacks (flatten)
   - (NOT customStacks - these are preserved)
   - (NOT players in games)
2. Sort collected players by selected criteria:
   - Waiting Time: sort by waitingSince ascending (oldest first)
   - Games Played: sort by gamesPlayed ascending (least first)
   - Smart Stack: weighted score (games, waiting, streaks)
3. Clear roundRobinStacks = []
4. Set waitingStack = sorted player IDs
5. Build stacks for all available courts:
   - Use Round Robin algorithm on sorted waitingStack
   - Add each stack to roundRobinStacks
   - Remove used players from waitingStack
```

**Rules:**
- Custom stacks are NEVER affected by reorder
- All auto-built stacks are rebuilt from scratch
- Respects the sorted order when building

---

### 8. SWAP PLAYER (In Play ↔ Stack)

**Trigger:** User drags player between game and stack

**Logic:**
```
Swap playerA (in game) with playerB (in stack):
1. Find which court/team playerA is in
2. Find which stack playerB is in
3. Replace playerA with playerB in court.currentGame
4. Replace playerB with playerA in the stack
5. Update waitingSince:
   - playerA.waitingSince = Date.now() (now waiting)
   - playerB.waitingSince = 0 (now in game)
```

**Rules:**
- Stack remains intact (just different player)
- No stack rebuilding needed

---

### 9. SWAP PLAYER (In Play ↔ Waiting)

**Trigger:** User drags player between game and waiting

**Logic:**
```
Swap playerA (in game) with playerB (in waiting):
1. Find which court/team playerA is in
2. Find playerB's position in waitingStack
3. Replace playerA with playerB in court.currentGame
4. Replace playerB with playerA in waitingStack (same position)
5. Update waitingSince:
   - playerA.waitingSince = Date.now()
   - playerB.waitingSince = 0
```

---

### 10. SWAP PLAYER (Stack ↔ Stack)

**Trigger:** User drags player between stacks

**Logic:**
```
Swap playerA (in stackX) with playerB (in stackY):
1. Find playerA's position in stackX
2. Find playerB's position in stackY
3. Replace playerA with playerB in stackX
4. Replace playerB with playerA in stackY
```

**Rules:**
- Both stacks remain intact
- No waitingSince changes needed

---

### 11. SWAP PLAYER (Stack ↔ Waiting)

**Trigger:** User drags player between stack and waiting

**Logic:**
```
Swap playerA (in stack) with playerB (in waiting):
1. Find playerA's position in stack
2. Find playerB's position in waitingStack
3. Replace playerA with playerB in stack
4. Replace playerB with playerA in waitingStack
```

---

### 12. CREATE CUSTOM STACK

**Trigger:** User manually creates a stack

**Logic:**
```
1. Validate: exactly 4 players selected
2. Remove all 4 players from waitingStack
3. Remove all 4 players from any roundRobinStacks
4. For any roundRobinStack that now has < 4 players:
   - Dissolve: move remaining to waitingStack
5. Add new custom stack to customStacks
6. Call buildNewStacksIfNeeded()
```

---

### 13. REMOVE CUSTOM STACK

**Trigger:** User deletes a custom stack

**Logic:**
```
1. Get players from customStacks[index]
2. Remove customStacks[index]
3. Add all 4 players to waitingStack
4. Call buildNewStacksIfNeeded()
```

---

## Round Robin Algorithm (Stack Building)

When building a new stack from waiting players:

```
1. Score all waiting players:
   - Waiting time (40%): longer wait = higher priority
   - Games played (30%): fewer games = higher priority
   - Partner variety (15%): less repeated partners = higher priority
   - Opponent variety (15%): less repeated opponents = higher priority

2. Select Player 1: highest score

3. Select Player 2 (Partner for P1):
   - Minimize partner repeat count with P1
   - Avoid recent teams (last 2 games)

4. Select Players 3 & 4 (Opponents):
   - Minimize opponent repeat count with P1 & P2
   - Avoid recent matchups (last 3 games)
   - Also consider P3-P4 partner variety

5. Return [P1, P2, P3, P4]
```

---

## State Diagram

```
                    ┌─────────────┐
                    │   WAITING   │
                    │ waitingStack│
                    └──────┬──────┘
                           │
            buildNewStacksIfNeeded()
                           │
                           ▼
                    ┌─────────────┐
                    │   STACKS    │
                    │roundRobin   │
                    │Stacks[][]   │
                    └──────┬──────┘
                           │
                     startGame()
                           │
                           ▼
                    ┌─────────────┐
                    │   IN PLAY   │
                    │court.current│
                    │Game         │
                    └──────┬──────┘
                           │
                      endGame()
                           │
                           ▼
                    ┌─────────────┐
                    │   WAITING   │◄─── (cycle repeats)
                    └─────────────┘
```

---

## UI Display

### Queue Panel (Round Robin Mode)

```
┌─────────────────────────────────┐
│ Queue                    [Re-order ▼] [+ Custom Stack] │
├─────────────────────────────────┤
│ ▶ Stack #1 (Ready)              │  ← roundRobinStacks[0]
│   Player A, Player B            │
│   vs                            │
│   Player C, Player D            │
├─────────────────────────────────┤
│ ▶ Stack #2 (Ready)              │  ← roundRobinStacks[1]
│   Player E, Player F            │
│   vs                            │
│   Player G, Player H            │
├─────────────────────────────────┤
│ ★ Custom Stack                  │  ← customStacks[0]
│   Player I, Player J            │
│   vs                            │
│   Player K, Player L            │
├─────────────────────────────────┤
│ ○ Waiting (3 players)           │  ← waitingStack
│   Player M, Player N, Player O  │
└─────────────────────────────────┘
```

---

## Testing Scenarios

### Scenario 1: 2 Courts, 12 Players
1. Initial: Stack #1, Stack #2 built (8 players), 4 in waiting
2. Start Court 1: Stack #1 used → Stack #3 built from waiting
3. Start Court 2: Stack #2 used → No new stack (0 in waiting)
4. End Court 1: 4 players → waiting → Stack #4 built
5. Stack #3 unchanged throughout ✓

### Scenario 2: Reorder
1. Stack #1, #2 exist, 4 in waiting
2. Click "By Games Played"
3. All 12 players sorted by games
4. Stack #1, #2 rebuilt with new order
5. Custom stack unchanged ✓

### Scenario 3: Swap In-Play with Waiting
1. Player A in game, Player B in waiting
2. Swap A ↔ B
3. Player B now in game, Player A in waiting (same position)
4. No stack changes ✓

---

## File References

- Store: `src/store/sessionStore.ts`
- Algorithm: `src/lib/roundRobin.ts`
- UI: `src/components/PlayerQueue.tsx`
- Types: `src/types/index.ts`

---

## Implementation Status

### Completed Functions:

| Function | Status | Description |
|----------|--------|-------------|
| `addNewRoundRobinStacks()` | ✅ Done | Adds new stacks from waitingStack without touching existing stacks |
| `rebuildRoundRobinStacks()` | ✅ Done | Full rebuild - collects from stacks + waiting, rebuilds all |
| `reshuffleByWaitingTime()` | ✅ Done | Collects all players, sorts by waiting time, triggers rebuild |
| `reshuffleByGamesPlayed()` | ✅ Done | Collects all players, sorts by games played, triggers rebuild |
| `smartRebuildStacks()` | ✅ Done | Collects all players, sorts by weighted score, rebuilds |

### Pending Functions:

| Function | Status | Description |
|----------|--------|-------------|
| `swapPlayerInPlay()` | ⏳ Pending | Swap player in game with player in stack/waiting |
| `swapPlayerInStack()` | ⏳ Pending | Swap player in stack with another stack/waiting |

---

## Version History

| Date | Change |
|------|--------|
| 2026-03-18 | Initial documentation |
| 2026-03-18 | Implemented reorder functions with proper Round Robin logic |
| 2026-03-18 | Fixed: `buildRoundRobinStack` now accepts `respectOrder` param to use sorted input order |
| 2026-03-18 | Fixed: `addPlayer` no longer clears `roundRobinStacks` - preserves existing stacks |
