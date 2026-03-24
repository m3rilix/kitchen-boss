# Win-Lose Stack Mode - CORRECTED Implementation

## Date: March 18, 2026 - 10:15 AM

## Critical Fix
The initial implementation was COMPLETELY WRONG. This document describes the CORRECT logic.

---

## Stack Types

1. **Regular Stack** (Blue/Waiting) - `waitingStacks[][]`
   - New players with no game history
   - Created at session start

2. **Winner Stack** - `winnerStacks[][]`
   - Players who won their last game

3. **Loser Stack** - `loserStacks[][]`
   - Players who lost their last game

**Each type can have:**
- Multiple ready stacks (4 players)
- Multiple forming stacks (< 4 players)

---

## Core Logic

### 1. Adding New Players (`addNewWinLoseStacks`)

**Priority for filling:**
1. Regular forming stack
2. Loser forming stack
3. Winner forming stack
4. Create new Regular forming stack

**Key Point:** New players CAN be mixed into winner/loser forming stacks!

### 2. Starting a Game (`autoAssignNextGame`)

**FIFO Priority:**
1. Custom stacks
2. **Regular stacks (FIRST)**
3. **Loser stacks (SECOND)**
4. **Winner stacks (LAST)**

Only full stacks (4 players) can be selected.

### 3. Ending a Game (`endGame`)

**Process in order:**
1. Add LOSERS first
2. Add WINNERS second

**For each player, priority:**
1. Check for forming stack of SAME type
2. Check for ANY forming stack (to prevent incomplete stacks)
3. Create new forming stack of player's type

---

## Example Scenarios

### Scenario 1: Adding 5 Players
1. Player 1 → Regular forming (1/4)
2. Player 2 → Regular forming (2/4)
3. Player 3 → Regular forming (3/4)
4. Player 4 → Regular forming (4/4) → becomes Regular Stack #1
5. Player 5 → Regular forming (1/4)

### Scenario 2: Game Ends with Forming Stacks
**Before game:**
- Regular forming (2/4)
- Loser forming (3/4)

**Game ends:** Team A wins, Team B loses

**Process:**
1. Add Loser 1 → Loser forming (4/4) → becomes Loser Stack #1
2. Add Loser 2 → Create new Loser forming (1/4)
3. Add Winner 1 → Regular forming (3/4) ← Fills ANY forming
4. Add Winner 2 → Regular forming (4/4) → becomes Regular Stack #1

**After game:**
- Loser Stack #1 (ready)
- Loser forming (1/4)

### Scenario 3: Adding Player Mid-Session
**Current state:**
- Winner forming (2/4)
- Loser forming (1/4)

**Add new player:**
- Goes to Regular forming? NO!
- Goes to Loser forming (2/4) ← Fills ANY forming stack

---

## Key Differences from Initial (Wrong) Implementation

| Aspect | Wrong Implementation | Correct Implementation |
|--------|---------------------|----------------------|
| New player priority | Only Regular stacks | ANY forming stack (Regular → Loser → Winner) |
| Game start priority | Winner → Loser → Regular | **Regular → Loser → Winner** |
| After game priority | Fill forming first | Same type → Any forming → Create new |
| Forming stacks | One per session | Multiple per type |

---

## Files Modified

1. **src/types/index.ts**
   - Updated comments for clarity

2. **src/store/sessionStore.ts**
   - `addNewWinLoseStacks()` - Completely rewritten
   - `autoAssignNextGame()` - Fixed priority order
   - `endGame()` - Completely rewritten with helper function

3. **src/components/PlayerQueue.tsx**
   - No changes needed (already displays stacks correctly)

---

## Testing Checklist

- [ ] Add 5 players → Should create 1 ready + 1 forming
- [ ] Add player to session with winner forming → Should fill winner forming
- [ ] Start game → Should pull Regular stack first (not Winner)
- [ ] End game with loser forming → Losers should fill loser forming first
- [ ] End game with no forming → Should create loser forming, then winner forming
