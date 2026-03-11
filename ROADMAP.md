# Kitchen Boss - Feature Roadmap

## 🐛 Bug Fixes (Priority)

### 1. Waiting Time Issues
- [x] **Player swapped out keeps waiting time**: When a player starts a game but is swapped out, their waiting time should NOT reset
- [x] **Removed players negative waiting time**: When a player is removed from queue, show negative waiting time (or exclude from waiting time calculations)

### 2. Stack Management Issues
- [x] **Swapping player in stack not working**: Fix the ability to swap players who are already in a stack

---

## 🚀 Feature Improvements

### 1. Custom Stack Creation
- [x] Ability to manually create a custom stack of 4 players
- [x] Custom stack can be placed alongside pre-built stacks
- [x] Custom stacks show at top with purple styling
- [x] Players in game shown with [Playing] marker and blur effect
- [ ] Option to skip next pre-built stack to put custom stack into play immediately

### 2. Reshuffle Based on Waiting Time
- [x] Button to re-order stacks based on waiting time (clock icon)
- [x] Prioritize players who have been waiting longest

---

## 🔄 Round Robin Mode (Dev Only Initially)

### Overview
Unlike Win-Lose Stack where stacks are pre-built based on queue size, Round Robin creates stacks based on available courts while other players wait. The system prepares the next stack of 4 players according to Round Robin rules while games are in play.

### Key Differences from Win-Lose Stack
| Feature | Win-Lose Stack | Round Robin |
|---------|---------------|-------------|
| Stack Building | Based on queue size | Based on court count |
| Win/Lose Separation | Yes | No |
| Partner Variety | Limited | Maximized |
| Opponent Variety | Limited | Maximized |

### Player Selection Priority (in order)
1. **Longest waiting time** - Players waiting longest get priority
2. **Least games played** - Balance total games across all players
3. **New partner combinations** - Maximize partner variety
4. **New opponent combinations** - Maximize opponent variety

### Core Rules
- [x] No win-lose stack separation
- [x] Players get to play with everyone
- [x] Avoid repeating exact teams consecutively
- [x] Avoid repeating exact matchups consecutively
- [ ] Maintain balanced play time for all players
- [ ] Ensure fair wait time distribution

### Stack Building Logic
- [x] Calculate stacks based on number of available courts (not queue size)
- [x] While game is in play, prepare next stack of 4 players
- [x] Remaining players stay in waiting list
- [x] Dynamic update when courts are added/removed
- [x] Record match history for tracking

### Manager Controls
- [x] Add/remove courts at any time (stacks update dynamically)
- [x] Create custom stack alongside pre-built stacks
- [ ] Skip next pre-built stack to prioritize custom stack
- [x] Manual player swapping within stacks
- [x] Reshuffle based on waiting time

### Handle Mid-Session Changes
- [x] Players joining mid-session
- [x] Players leaving mid-session
- [x] Court count changes

### Constraints
- Maximize partner and opponent variety
- Ensure fair wait time
- Avoid repeating exact teams or matchups consecutively
- Maintain balanced play time for all players

---

## 📊 Data Tracking Required for Round Robin

To implement Round Robin properly, we need to track:

### Per Player
- `waitingSince`: Timestamp when player started waiting
- `gamesPlayed`: Total games played in session
- `partners`: Array of player IDs they've partnered with
- `opponents`: Array of player IDs they've played against
- `lastGameTime`: When they last played

### Per Session
- `matchHistory`: Array of past matchups `{ team1: [id, id], team2: [id, id], timestamp }`
- `partnerHistory`: Map of `playerId -> [partnerId, partnerId, ...]`
- `opponentHistory`: Map of `playerId -> [opponentId, opponentId, ...]`

---

## 🔧 Implementation Plan

### Phase 1: Bug Fixes
1. Fix waiting time reset on swap-out
2. Fix negative waiting time for removed players
3. Fix player swapping in stacks

### Phase 2: Stack Improvements
1. Implement custom stack creation
2. Implement reshuffle based on waiting time
3. Add skip pre-built stack option

### Phase 3: Round Robin (Dev Mode)
1. Add data tracking (partner/opponent history)
2. Implement Round Robin stack building algorithm
3. Implement player selection priority logic
4. Add court-based stack calculation
5. Enable in dev mode only

### Phase 4: Round Robin Polish
1. UI for Round Robin mode
2. Testing and balancing
3. Production release

---

## 📝 Notes

- Round Robin should be enabled in dev mode first for testing
- Win-Lose Stack remains the default mode
- Both modes share: custom stack, reshuffle, manager controls
