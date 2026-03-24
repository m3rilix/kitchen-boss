# Win-Lose Stack Mode - Implementation Summary

## Date: March 18, 2026

## Backup Location
`backup-20260318-093013/`

## Overview
Implemented proper stack-based logic for Win-Lose mode, similar to Round Robin but with different stack creation rules.

---

## Data Structure Changes

### New Arrays Added to Session Type

```typescript
// Win-Lose Stack mode - Pre-built stacks
winnerStacks: string[][];  // Array of winner stacks (4 players each)
loserStacks: string[][];   // Array of loser stacks (4 players each)
waitingStacks: string[][]; // Array of waiting stacks (4 players each, last may be forming)
```

### Deprecated Arrays (kept for backward compatibility)
```typescript
winnerStack: string[];  // DEPRECATED
loserStack: string[];   // DEPRECATED
```

---

## Core Logic

### 1. Player Addition (`addPlayer`)
- Players added to `waitingStack` (flat array)
- Calls `addNewWinLoseStacks()` to build stacks of 4 (FIFO order)
- Only builds stacks for available courts

### 2. Game Start (`startGame`)
- Pulls from pre-built stacks in priority order:
  1. Custom stacks (if any)
  2. Winner stacks
  3. Loser stacks
  4. Waiting stacks
- Removes used stack from appropriate array
- Fallback to deprecated flat arrays if no stacks found

### 3. Game End (`endGame`) - **CRITICAL LOGIC**

Priority order for placing players after game:

1. **Fill Forming Stack First**
   - If a forming stack exists (< 4 players), fill it with:
     - Losers first
     - Then winners
   - Overflow goes to loser/winner stacks

2. **Create Loser Stacks**
   - If no forming stack, create loser stacks
   - Fill last incomplete loser stack first
   - Create new loser stack if needed

3. **Create Winner Stacks**
   - Fill last incomplete winner stack first
   - Create new winner stack if needed

### 4. Auto Assign Next Game (`autoAssignNextGame`)
- For Win-Lose mode, pulls from stacks in order:
  1. Custom stacks (highest priority)
  2. Winner stacks
  3. Loser stacks
  4. Waiting stacks
- Takes first available stack with 4 players not in game

---

## New Functions

### `buildWinLoseStacks()`
- Builds stacks from `waitingStack` in FIFO order
- Creates stacks of 4, last may be forming
- Replaces all `waitingStacks`

### `addNewWinLoseStacks()`
- Adds new stacks without touching existing ones
- Only builds for available courts
- Respects existing ready stacks count

---

## Mode Detection

Functions check `rotationMode` to determine behavior:
- `'round_robin'` → Use Round Robin logic
- `'win_lose_stack'` or `'full_rotation'` → Use Win-Lose logic
- Other modes → Use legacy logic

---

## Testing Scenarios

### Scenario 1: Initial Setup (8 players, 2 courts)
1. Add 8 players
2. System creates 2 waiting stacks of 4
3. Start Court 1 → Uses waiting stack #1
4. Start Court 2 → Uses waiting stack #2

### Scenario 2: Game End with Forming Stack (7 players waiting)
1. 1 forming stack (3 players) + 1 ready stack (4 players)
2. Game ends: 2 winners, 2 losers
3. Forming stack filled with 1 loser (now 4 players)
4. Remaining 1 loser → creates new loser stack
5. 2 winners → creates new winner stack

### Scenario 3: Game End without Forming Stack
1. All stacks are complete (4 players each)
2. Game ends: 2 winners, 2 losers
3. Losers → create new loser stack (2 players)
4. Winners → create new winner stack (2 players)

### Scenario 4: Priority Pull Order
1. Winner stack #1 (4 players)
2. Loser stack #1 (4 players)
3. Waiting stack #1 (4 players)
4. Click "Start Game" → Pulls from Winner stack #1

---

## Files Modified

1. **src/types/index.ts**
   - Added `winnerStacks`, `loserStacks`, `waitingStacks`

2. **src/store/sessionStore.ts**
   - Added `buildWinLoseStacks()` and `addNewWinLoseStacks()`
   - Updated `addPlayer()` to call appropriate function
   - Updated `startGame()` to remove from Win-Lose stacks
   - Updated `endGame()` with priority logic
   - Updated `autoAssignNextGame()` to pull from Win-Lose stacks
   - Updated `resetSession()` to clear Win-Lose stacks

3. **src/components/PlayerQueue.tsx**
   - TO DO: Update UI to display Win-Lose stacks

---

## Pending Work

1. **Update PlayerQueue UI** to display Win-Lose stacks:
   - Show Winner stacks (green)
   - Show Loser stacks (orange)
   - Show Waiting stacks (gray)
   - Show forming stack indicator

2. **Test both modes** independently:
   - Round Robin should still work
   - Win-Lose should use new stack logic

---

## Backward Compatibility

- Old flat arrays (`winnerStack`, `loserStack`) still updated for compatibility
- Fallback logic in `autoAssignNextGame` uses flat arrays if no stacks found
- Existing sessions will continue to work (arrays initialize as empty)

---

## Key Differences from Round Robin

| Feature | Round Robin | Win-Lose |
|---------|-------------|----------|
| Stack Creation | Balanced algorithm | FIFO order |
| After Game | All to waiting | Winners/Losers separated |
| Priority | First ready stack | Winners → Losers → Waiting |
| Forming Stack | No special handling | Filled first after game |
