# Kitchen Boss 🏓

A web application for managing paddle stacking during pickleball open play sessions. "Kitchen Boss" refers to the non-volley zone (the "kitchen") in pickleball - and this app helps you boss the queue!

## Live Demo

🚀 **[kitchenboss.vercel.app](https://kitchenboss.vercel.app)** (coming soon)

## What is Paddle Stacking?

In pickleball open play, "paddle stacking" is the system used to manage player rotation when there are more players than available court spots. Players place their paddles in a queue, and when a game ends, the next players in line get to play.

## Pickleball Game Format

| Format | Players | Description |
|--------|---------|-------------|
| **Doubles** | 4 players (2v2) | Most common format for open play |
| **Singles** | 2 players (1v1) | Less common in open play |

### Standard Rules
- Games played to **11 points**, win by 2
- Tournament games may be 15 or 21 points
- Only serving team can score (traditional scoring)
- Rally scoring variant: point scored after every rally

## Features

### Core Functionality
- **Flexible Court Management** - Configure N number of courts per session
- **Player Check-in/Check-out** - Players can join or leave at any time
- **Paddle Queue** - Fair FIFO queue for waiting players
- **Game Tracking** - Track games played per player for fairness

### Rotation Modes
1. **Winners Stay** - Winning team stays on court, losers go to back of queue
2. **Full Rotation** - All 4 players rotate out after each game
3. **King of the Court** - Winners stay until they lose
4. **Skill-Based** - Balance teams based on skill ratings

### Session Management
- Create new sessions with custom settings
- Add/remove courts during active session
- View real-time court status and queue
- Session history and statistics

## Tech Stack

- **Frontend**: React + TypeScript + Vite
- **Styling**: TailwindCSS + shadcn/ui
- **State Management**: React Context / Zustand
- **Icons**: Lucide React
- **Storage**: Local Storage (MVP) / Supabase (future)

## Project Structure

```
pickleball-stacking/
├── src/
│   ├── components/       # React components
│   │   ├── ui/          # shadcn/ui components
│   │   ├── Court.tsx    # Court display component
│   │   ├── Queue.tsx    # Paddle queue component
│   │   └── Session.tsx  # Session management
│   ├── hooks/           # Custom React hooks
│   ├── lib/             # Utility functions
│   ├── types/           # TypeScript types
│   │   └── index.ts     # Core type definitions
│   ├── store/           # State management
│   ├── App.tsx          # Main app component
│   └── main.tsx         # Entry point
├── public/
├── package.json
├── tailwind.config.js
├── tsconfig.json
└── vite.config.ts
```

## Data Models

### Player
```typescript
interface Player {
  id: string;
  name: string;
  skillLevel?: number;      // Optional 1-5 rating
  gamesPlayed: number;
  gamesWon: number;
  checkedInAt: Date;
  isActive: boolean;
}
```

### Court
```typescript
interface Court {
  id: string;
  name: string;             // "Court 1", "Court 2", etc.
  status: 'available' | 'in_game' | 'maintenance';
  currentGame?: Game;
}
```

### Game
```typescript
interface Game {
  id: string;
  courtId: string;
  team1: [Player, Player];  // For doubles
  team2: [Player, Player];
  startedAt: Date;
  endedAt?: Date;
  score?: { team1: number; team2: number };
  winner?: 'team1' | 'team2';
}
```

### Session
```typescript
interface Session {
  id: string;
  name: string;
  courts: Court[];
  players: Player[];
  queue: string[];          // Player IDs in queue order
  rotationMode: RotationMode;
  gamesCompleted: Game[];
  createdAt: Date;
  isActive: boolean;
}
```

## Getting Started

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

## Usage

1. **Create a Session** - Set number of courts and rotation mode
2. **Add Players** - Players check in with their name
3. **Start Games** - System assigns players to courts from queue
4. **Record Results** - Mark games as complete with winner
5. **Auto-Rotate** - System moves players based on rotation mode

## Future Enhancements

- [ ] Player profiles with persistent stats
- [ ] QR code check-in
- [ ] Real-time sync across devices
- [ ] Tournament bracket mode
- [ ] Skill-based matchmaking
- [ ] Push notifications when it's your turn
- [ ] Court reservation system
