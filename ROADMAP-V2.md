# Kitchen Boss - Roadmap V2

_Last updated: 2026-11-26_

## 🔧 Build Order

| Phase | Feature | Depends on | Status |
|-------|---------|------------|--------|
| 1 | Court Play Flow (A) | — | ✅ Live |
| 2 | Court Controls (F) | Phase 1 (same court states) | ✅ Live |
| 3 | Score Pop-up & Court Border (E) | Phase 2 | ✅ Live |
| 4 | Player Ranking Card (C) | — (can run in parallel with Phases 1–3) | ✅ Live |
| 5 | Large-Screen 3-Panel Layout (B) | Phases 1–3 | ✅ Live |
| 6 | Court Board / Court View (G) | Phase 5 (builds on the new court panel) | 🧪 Built locally |
| 7 | Dark Mode & Color Themes (D) | Last, so it covers all new panels | 🧪 Built locally |
| 8 | Re-order Stacks by Wins / Losses | — | 💭 Planning |

---

## 🗺️ Features

### 1. Court Play Flow (A) ✅
Flow: end game → court in waiting mode → click **Next** on court OR **Play / Skip** in queue → switch players if needed → click **Start** or **Start N ready courts**
- [x] When a game finishes, the court goes into waiting mode
- [x] **Next** button on the court pulls the next queued stack into it (instead of auto-filling an empty court)
- [x] Court waits for manager to click **Start**, so players can still be switched from stack or queue
- [x] **Play / Skip** button in queue list sends a stack to the open court (as **Ready**, then Start)
- [x] Big **Start N ready courts** button above all courts

Built as a new **Ready** court state (amber border, READY badge, no timer). The timer, match history entry and "Game started" log start at **Start**. The share view shows **READY · starting soon**.

### 2. Court Controls (F) ✅
- [x] **Return to Ready** function: puts an in-play court back to ready and resets the timer to zero
- [x] Disable swapping players while a game is in play; swapping only allowed in **Maintenance** (wrench menu open) or **Ready**
- [x] **Start** button to start the game
- [x] Move **Cancel Game** out of maintenance mode; place it between **End Game** and **Maintenance** buttons

Extra: tapping a player on a swappable court offers **Replace [name] with…** (any waiting player, from a stack or the queue). Swaps and replacements now keep match history (variety / health stats) in sync.

### 3. Score Pop-up & Court Border (E) ✅
- [x] After a game ends, enter scores in a pop-up instead of inline in the court layout
- [x] Pop-up shows Team A (player names) vs Team B (player names)
- [x] In-play court: stronger, more noticeable border

### 4. Player Ranking Card (C) ✅
Clicking a player in rankings (manager and share view) opens a card that looks good for screenshots on mobile ("proud moments"):
- [x] Session name
- [x] Player name
- [x] Stars (if skill-based mode is on)
- [x] Ranking number out of N players, with ranking medal if possible
- [x] Wins, losses, win %, and +/-
- [x] Date and day
- [x] Location
- [x] "kitchen-boss" branding
- [x] Partners and opponents: always shown in manager view; behind a button in share view

Final shape: card is always centered. A round chevron button expands partners, opponents and match history (open by default for managers, closed in the share view). Also opens from the final results page after a session ends.

### 5. Large-Screen 3-Panel Layout (B) ✅
On computer / laptop / tablet (768px and wider, manager view), the layout uses only 3 panels:
- [x] **Top — Courts**: laid out nicely across the screen (2 / 3 / 4 columns by width)
- [x] **Middle — Queue**: queued stacks in bigger, larger fonts; players not in stacks and still waiting shown below the stacks
- [x] **Bottom — Multi-tab panel**: cycles between Session Ranking, Players, and Logs (remembers the last tab)
- [x] Maximize space while keeping enough margins; nicer-looking buttons
- [x] Enlarge the Check-in button

Final shape: queue stacks are compact cards in a wrapping grid (4 per row on a laptop, 2 on a tablet). Panel drag-to-rearrange was removed. Phones keep the stacked layout with bottom tabs.

### 6. Court Board / Court View (G) 🧪
Add a **[Court View]** panel above the courts that controls how the court panel is displayed. **Start N ready courts** button sits between this panel and the courts.
- [x] Show counts: N courts active, ready, waiting
- [x] Order courts by: active or default
- [x] Court view toggle:
  - [x] **Grid** — default (current layout)
  - [x] **Compact** — courts in rows with compact info instead of a grid
  - [x] **Table** — columns: court, status, match-up players, timer, actions (Start, End, Return to Ready, Cancel Game)
- [x] **Maintenance** remains a per-court control (each court keeps its own Maintenance button)
- [x] Add court

Built: counts also show maintenance courts when any exist; view and order are remembered per device; Table is tablet+ (phones fall back to Compact); Compact/Table rows also have **Next** and **Maintenance / Available**; swapping players and renaming stay on the Grid cards.

### 7. Dark Mode & Color Themes (D) 🧪
- [x] Theme button to toggle dark mode, making sure all panels work fine
- [x] 4 selectable color themes: Blue and Green (existing) plus White and Purple (new)

Built: the palette button (and the header menu) offers Light / Dark / Auto (follows the device) and Blue / Green / White / Purple. White is monochrome (near-black accents in light mode, white accents in dark mode).

### 8. Re-order Stacks by Wins / Losses 💭 (planning)
Add **By Wins** and **By Losses** to the queue's **Re-order** menu. When the manager clicks one, waiting players are regrouped into stacks sorted by their session record, so players with similar records play together.
- [ ] **By Wins**: most wins first (ties → fewer games played, then longest wait)
- [ ] **By Losses**: most losses first (same tie-breaks)
- [ ] Works in every stack mode; players on court and custom stacks are left alone
- [ ] Log entry: "Stacks reordered by wins / losses"

Open questions:
- Sort by total wins/losses, or by win rate (fairer when players have played different numbers of games)?
- In Win-Lose, regroup only within the Winner / Loser / Regular groups, or merge them into Regular stacks like the existing Re-order options do?
- Should the share view show that a re-order happened?

---

## ✅ Also shipped (not in the original list)

- **Win-Lose mode re-enabled**.
- **Win-Lose queue order**: one shared play order (Regular first, then Winner/Loser alternating) drives the court's Next button, the manager queue and the share view, so the top stack is always the one Next starts. The share view now shows the manager's exact stacks, with a **Next** badge and Winners / Losers tags.
- **Win-Lose queue fixes**: Cancel Game returns the same four to the front of the queue as a full stack; removing a player no longer drops the rest of the stack; a safety net re-queues anyone who falls out of every stack.
- **Empty slots**: removing a player from a formed stack keeps the stack in its place with a dashed **empty slot**. Tap it to fill from waiting players (those not in the queue first, then other stacks). Next skips a stack with an open slot until it's filled.
- **Leaderboard**: narrower W / L / Win% / SOM / GP columns so names fit on phones; Rankings panel added to the manager view (Courts → Queue → Rankings → Players → Log).
- **Skill-Based mode disabled** for new sessions (shows "Under Maintenance"; running sessions unaffected).

## 🧭 Backlog / decisions pending

- **Smart Stack in Win-Lose**: currently does nothing there (it only works in Round Robin / Skill-Based). Decide: hide it in Win-Lose, or build a Win-Lose version.
- **Session Health repeat partners**: counts games still in play. Option: count only finished games so it matches player history.
- **Mode architecture**: before adding new modes or mid-session mode switching, move every mode onto one shared queue format (each mode = one module: build stacks, pick next, handle game end / cancel / remove) and add automated tests for queue logic.
- **Re-enable Skill-Based** once reviewed.
