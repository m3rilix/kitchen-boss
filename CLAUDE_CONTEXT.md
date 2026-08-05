# Kitchen Boss - Pickleball Queue Management System

## Overview
Kitchen Boss is a web application for managing player queues and court rotations during pickleball open play sessions. The name references the "kitchen" (non-volley zone) in pickleball.

**Live App**: https://kitchen-boss.vercel.app  
**Tech Stack**: React + TypeScript + Vite + TailwindCSS + Zustand + Firebase Realtime Database

---

## Core Concepts

### User Roles
1. **Session Manager** - Creates and manages sessions, controls courts, starts/ends games
2. **Shared View Users** - View-only access via share code, see real-time queue and court status

### Session Sharing
- Manager can generate a share code (6-character alphanumeric)
- Share URL: `https://kitchen-boss.vercel.app/?code=ABC123`
- Shared sessions sync in real-time via Firebase Realtime Database
- Share view is read-only, shows queue, courts, and activity log

---

## Rotation Modes

### 1. Winners Stay
- Winning team stays on court
- Losing team goes to back of queue
- Next 2 players from queue join winners

### 2. Full Rotation
- All 4 players rotate out after each game
- Next 4 players from queue take the court

### 3. Round Robin
- **Pre-built stacks of 4 players** optimized for variety
- Avoids recent partners/opponents using match history
- Stacks are built in advance and displayed in queue
- Manager can start games directly from stacks
- Algorithm: `buildRoundRobinStack()` in `src/lib/roundRobinAlgorithm.ts`

### 4. Win-Lose Stack (Primary Mode)
- **Three stack types**: Winner (green), Loser (red), Regular/Waiting (blue)
- **Stack lifecycle**:
  - New players → Regular forming stack (blue)
  - Game winners → Winner forming stack (green)
  - Game losers → Loser forming stack (red)
  - Stacks become "ready" when they have 4 players
- **Priority order**: Regular ready → Loser ready → Winner ready → Regular forming → Loser forming → Winner forming
- **Stack consolidation**: After player removal, incomplete stacks merge (e.g., 3/4 + 1/4 → 4/4)
- **Key functions**:
  - `buildWinLoseStacks()` - Initial build from waiting players
  - `addNewWinLoseStacks()` - Add new players to forming stacks
  - Stack arrays: `winnerStacks[][]`, `loserStacks[][]`, `waitingStacks[][]`

### 5. King of Court
- Winners stay until they lose
- Tracks win streaks

### 6. Skill-Based
- Balances teams based on skill ratings (1-5)

---

## Data Models

### Player
```typescript
interface Player {
  id: string;
  name: string;
  skillLevel?: number;        // 1-5 rating
  gamesPlayed: number;
  gamesWon: number;
  checkedInAt: Date;
  isActive: boolean;
  winStreak: number;
  loseStreak: number;
  lastPartners: string[];     // Last 2-3 partner IDs
  lastOpponents: string[];    // Last 2-3 opponent IDs
  waitingSince: number;       // Timestamp when entered queue (0 = in game, -1 = removed)
  lastGameResult?: 'won' | 'lost' | null;
}
```

### Session
```typescript
interface Session {
  id: string;
  name: string;
  location?: string;
  date?: string;
  time?: string;
  courts: Court[];
  players: Player[];
  queue: string[];            // Legacy FIFO queue (player IDs)
  rotationMode: RotationMode;
  gamesCompleted: Game[];
  activityLog: ActivityLogEntry[];
  createdAt: Date;
  isActive: boolean;
  shareCode?: string;
  
  // Stack arrays (Win-Lose & Round Robin modes)
  waitingStack: string[];     // Players waiting for stack assignment
  winnerStacks: string[][];   // Win-Lose: winner stacks
  loserStacks: string[][];    // Win-Lose: loser stacks
  waitingStacks: string[][];  // Win-Lose: regular/blue stacks
  roundRobinStacks: string[][]; // Round Robin: pre-built stacks
  customStacks: string[][];   // Manager-created custom stacks
  
  // Deprecated (kept for backward compatibility)
  winnerStack: string[];
  loserStack: string[];
  
  // Tracking
  matchHistory: MatchHistoryEntry[];
  stackCounter: number;
  lastStackType?: 'winner' | 'loser' | 'regular';
  useSmartQueue: boolean;
}
```

### Court
```typescript
interface Court {
  id: string;
  name: string;              // "Court 1", "Court 2", etc.
  status: 'available' | 'in_game' | 'maintenance';
  currentGame?: Game;
}
```

### Game
```typescript
interface Game {
  id: string;
  courtId: string;
  team1: [string, string];   // Player IDs
  team2: [string, string];
  startedAt: Date;
  endedAt?: Date;
  score?: { team1: number; team2: number };
  winner?: 'team1' | 'team2';
}
```

---

## State Management (Zustand)

### Session Store (`src/store/sessionStore.ts`)
Main store for session state with persistence middleware.

**Key Actions**:
- `createSession(config)` - Create new session
- `addPlayer(name)` - Add player to session
- `removePlayer(playerId)` - Remove player completely
- `addToQueue(playerId)` - Add player to queue
- `removeFromQueue(playerId)` - Remove from queue (consolidates stacks in Win-Lose mode)
- `startGame(courtId, team1, team2)` - Start game on court
- `endGame(courtId, winner, score)` - End game, rotate players
- `buildWinLoseStacks()` - Build Win-Lose stacks from waiting players
- `addNewWinLoseStacks()` - Add new players to forming stacks
- `addNewRoundRobinStacks()` - Build Round Robin stacks
- `syncToFirebase()` - Sync session to Firebase (called after state changes)

**Important**: After queue operations (`addToQueue`, `removeFromQueue`, `removePlayer`), the store calls mode-specific stack builders:
```typescript
const mode = get().session?.rotationMode;
if (mode === 'round_robin') {
  get().addNewRoundRobinStacks();
} else if (mode === 'win_lose_stack' || mode === 'full_rotation') {
  get().addNewWinLoseStacks();
}
```

### Auth Store (`src/store/authStore.ts`)
Manages user authentication and active sessions.

### Theme Store (`src/store/themeStore.ts`)
Manages dark/light theme preference.

---

## Firebase Integration

### Database Structure
```
/sharedSessions/
  /{shareCode}/
    - session: Session object (sanitized)
    - lastUpdated: timestamp
/activeSessions/
  /{userId}/
    - sessionId: string
    - shareCode: string
    - timestamp: number
```

### Key Functions (`src/lib/firebase.ts`)
- `shareSession(session)` - Create/update shared session, returns share code
- `getSharedSession(shareCode)` - Fetch session by share code
- `subscribeToSession(shareCode, callback)` - Real-time subscription
- `updateSharedSession(shareCode, session)` - Update shared session
- `sanitizeSessionFromFirebase(data)` - Convert Firebase objects back to arrays

**Data Sanitization**: Firebase stores arrays as objects `{0: 'a', 1: 'b'}`. The sanitize function converts them back to proper arrays for nested structures like `winnerStacks[][]`, `team1`, `team2`, etc.

---

## Key Components

### Manager View
- `SessionViewPage.tsx` - Main manager interface
- `PlayerQueue.tsx` - Queue and stack display with drag-drop
- `CourtGrid.tsx` - Court status and game controls
- `PlayerList.tsx` - Player management
- `SessionSetup.tsx` - Session creation wizard

### Shared View
- `SharedSessionView.tsx` - Read-only view for shared sessions
- Shows queue, courts, activity log
- Real-time updates via Firebase subscription

### UI Components (shadcn/ui)
Located in `src/components/ui/`:
- `button.tsx`, `card.tsx`, `dialog.tsx`, `input.tsx`, `select.tsx`, etc.

---

## Critical Algorithms

### Round Robin Stack Building (`src/lib/roundRobinAlgorithm.ts`)
```typescript
buildRoundRobinStack(
  availablePlayers: Player[],
  matchHistory: MatchHistoryEntry[],
  respectOrder: boolean = false
): string[] | null
```
- Builds optimal 4-player stacks avoiding recent partners/opponents
- Uses match history to maximize variety
- Returns `null` if unable to build valid stack

### Win-Lose Stack Consolidation
After removing a player from queue, incomplete stacks are merged:
```typescript
const consolidateStacks = (stacks: string[][]): string[][] => {
  const complete = stacks.filter(s => s.length >= 4);
  const incompletePlayers = stacks.filter(s => s.length > 0 && s.length < 4).flat();
  const rechunked: string[][] = [];
  for (let i = 0; i < incompletePlayers.length; i += 4) {
    rechunked.push(incompletePlayers.slice(i, i + 4));
  }
  return [...complete, ...rechunked];
};
```

---

## Known Issues & Recent Fixes

### Fixed: Win-Lose Queue UI Update (Apr 2026)
**Problem**: Removing a player from queue updated Firebase (share view) but not local manager UI.

**Root Causes**:
1. `addToQueue` and `removeFromQueue` only called `addNewRoundRobinStacks()`, never `addNewWinLoseStacks()`
2. Players added to `waitingStack` (singular) but never moved to `waitingStacks` (plural) that UI reads
3. After removal, incomplete stacks weren't consolidated (3/4 + 1/4 stayed separate instead of merging to 4/4)

**Solution**:
- Added mode-aware stack builder calls to `addToQueue`, `removeFromQueue`, `removePlayer`
- Added `consolidateStacks()` helper in `removeFromQueue` to merge incomplete stacks

### Diagnostic Logs (to be removed)
- `firebase.ts` - Share flow tracing
- `App.tsx` - Share code URL parsing

---

## Development

### Local Development
```bash
npm install
npm run dev          # http://localhost:5173
```

### Build & Deploy
```bash
npm run build
npx vercel --prod    # Deploy to Vercel
```

### Project Structure
```
src/
├── components/
│   ├── ui/              # shadcn/ui components
│   ├── PlayerQueue.tsx  # Queue/stack display
│   ├── CourtGrid.tsx    # Court management
│   ├── SessionViewPage.tsx  # Manager view
│   └── SharedSessionView.tsx # Share view
├── store/
│   ├── sessionStore.ts  # Main session state
│   ├── authStore.ts     # User auth
│   └── themeStore.ts    # Theme preference
├── lib/
│   ├── firebase.ts      # Firebase integration
│   ├── roundRobinAlgorithm.ts  # RR stack builder
│   └── utils.ts         # Utilities
├── types/
│   └── index.ts         # TypeScript types
└── App.tsx              # Main router
```

---

## Dependencies

### Core
- `react` ^18.2.0
- `react-dom` ^18.2.0
- `typescript` ^5.2.2
- `vite` ^5.0.8

### UI & Styling
- `tailwindcss` ^3.3.6
- `lucide-react` ^0.294.0 (icons)
- `class-variance-authority` ^0.7.0
- `clsx` ^2.0.0
- `tailwind-merge` ^2.1.0

### State & Data
- `zustand` ^4.4.7 (state management)
- `firebase` ^12.10.0 (real-time database)
- `react-router-dom` ^7.13.1 (routing)
- `uuid` ^9.0.1 (ID generation)
- `pako` ^2.1.0 (compression)

---

## Common Tasks

### Adding a New Rotation Mode
1. Add mode to `RotationMode` type in `src/types/index.ts`
2. Add mode option in `SessionSetup.tsx`
3. Implement stack builder function in `sessionStore.ts`
4. Update `endGame()` logic to handle new mode
5. Update `PlayerQueue.tsx` to display stacks correctly

### Debugging Queue Issues
1. Check browser console for state logs
2. Verify `useMemo` dependencies in `PlayerQueue.tsx` include all relevant session arrays
3. Check if mode-specific stack builder is called after queue operations
4. Verify Firebase sanitization for nested arrays

### Testing Share Functionality
1. Create session in manager view
2. Click "Share Session" to get share code
3. Open share URL in incognito: `?code=ABC123`
4. Verify real-time sync by making changes in manager view
5. Check Firebase console for data structure

---

## Future Enhancements
- Player profiles with persistent stats
- QR code check-in
- Tournament bracket mode
- Advanced skill-based matchmaking
- Push notifications for queue position
- Court reservation system
- Mobile app (React Native)
