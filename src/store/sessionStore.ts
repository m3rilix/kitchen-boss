import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import type { Session, Player, Court, Game, SessionConfig, ActivityLogEntry, ActivityType } from '@/types';

// Helper to generate share code
const generateShareCode = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

// Helper to create activity log entry
const createLogEntry = (
  type: ActivityType,
  message: string,
  details?: ActivityLogEntry['details']
): ActivityLogEntry => ({
  id: uuidv4(),
  type,
  timestamp: new Date(),
  message,
  details,
});

interface SessionState {
  session: Session | null;
  
  // Session actions
  createSession: (config: SessionConfig) => void;
  endSession: () => void;
  
  // Court actions
  addCourt: () => void;
  removeCourt: (courtId: string) => void;
  setCourtStatus: (courtId: string, status: Court['status']) => void;
  renameCourt: (courtId: string, name: string) => void;
  
  // Player actions
  addPlayer: (name: string, skillLevel?: number, moveToFront?: boolean) => void;
  removePlayer: (playerId: string) => void;
  togglePlayerActive: (playerId: string) => void;
  
  // Queue actions
  addToQueue: (playerId: string) => void;
  removeFromQueue: (playerId: string) => void;
  moveInQueue: (playerId: string, direction: 'up' | 'down') => void;
  moveToFrontOfQueue: (playerId: string) => void;
  
  // Validation
  isNameDuplicate: (name: string) => boolean;
  
  // Game actions
  startGame: (courtId: string, team1: [string, string], team2: [string, string]) => void;
  endGame: (courtId: string, winner: 'team1' | 'team2', score?: { team1: number; team2: number }) => void;
  cancelGame: (courtId: string) => void;
  autoAssignNextGame: (courtId: string) => void;
  swapPlayers: (courtId: string, fromTeam: 'team1' | 'team2', fromIndex: number, toTeam: 'team1' | 'team2', toIndex: number) => void;
  
  // Maintenance actions (during game)
  removePlayerFromGame: (courtId: string, team: 'team1' | 'team2', index: number) => void;
  pullPlayerToGame: (courtId: string, team: 'team1' | 'team2', index: number) => void;
  
  // Utility
  getPlayerById: (playerId: string) => Player | undefined;
  getPlayersInQueue: () => Player[];
  getAvailablePlayers: () => Player[];
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set, get) => ({
      session: null,

      createSession: (config) => {
        const courts: Court[] = Array.from({ length: config.courtCount }, (_, i) => ({
          id: uuidv4(),
          name: `Court ${i + 1}`,
          status: 'available',
        }));

        set({
          session: {
            id: uuidv4(),
            name: config.name,
            location: config.location,
            date: config.date,
            time: config.time,
            courts,
            players: [],
            queue: [],
            rotationMode: config.rotationMode,
            gamesCompleted: [],
            activityLog: [createLogEntry('player_added', 'Session started')],
            createdAt: new Date(),
            isActive: true,
            shareCode: generateShareCode(),
          },
        });
      },

      endSession: () => {
        set({ session: null });
      },

      addCourt: () => {
        set((state) => {
          if (!state.session) return state;
          const courtNumber = state.session.courts.length + 1;
          return {
            session: {
              ...state.session,
              courts: [
                ...state.session.courts,
                {
                  id: uuidv4(),
                  name: `Court ${courtNumber}`,
                  status: 'available',
                },
              ],
            },
          };
        });
      },

      removeCourt: (courtId) => {
        set((state) => {
          if (!state.session) return state;
          return {
            session: {
              ...state.session,
              courts: state.session.courts.filter((c) => c.id !== courtId),
            },
          };
        });
      },

      setCourtStatus: (courtId, status) => {
        set((state) => {
          if (!state.session) return state;
          return {
            session: {
              ...state.session,
              courts: state.session.courts.map((c) =>
                c.id === courtId ? { ...c, status } : c
              ),
            },
          };
        });
      },

      renameCourt: (courtId, name) => {
        set((state) => {
          if (!state.session) return state;
          return {
            session: {
              ...state.session,
              courts: state.session.courts.map((c) =>
                c.id === courtId ? { ...c, name } : c
              ),
            },
          };
        });
      },

      addPlayer: (name, skillLevel, moveToFront = false) => {
        set((state) => {
          if (!state.session) return state;
          const newPlayer: Player = {
            id: uuidv4(),
            name,
            skillLevel,
            gamesPlayed: 0,
            gamesWon: 0,
            checkedInAt: new Date(),
            isActive: true,
          };
          const newQueue = moveToFront 
            ? [newPlayer.id, ...state.session.queue]
            : [...state.session.queue, newPlayer.id];
          
          const logMessage = moveToFront 
            ? `${name} added and moved to front of queue`
            : `${name} joined the session`;
          
          return {
            session: {
              ...state.session,
              players: [...state.session.players, newPlayer],
              queue: newQueue,
              activityLog: [
                createLogEntry('player_added', logMessage, { playerNames: [name] }),
                ...state.session.activityLog,
              ],
            },
          };
        });
      },

      removePlayer: (playerId) => {
        set((state) => {
          if (!state.session) return state;
          return {
            session: {
              ...state.session,
              players: state.session.players.filter((p) => p.id !== playerId),
              queue: state.session.queue.filter((id) => id !== playerId),
            },
          };
        });
      },

      togglePlayerActive: (playerId) => {
        set((state) => {
          if (!state.session) return state;
          return {
            session: {
              ...state.session,
              players: state.session.players.map((p) =>
                p.id === playerId ? { ...p, isActive: !p.isActive } : p
              ),
            },
          };
        });
      },

      addToQueue: (playerId) => {
        set((state) => {
          if (!state.session) return state;
          if (state.session.queue.includes(playerId)) return state;
          return {
            session: {
              ...state.session,
              queue: [...state.session.queue, playerId],
            },
          };
        });
      },

      removeFromQueue: (playerId) => {
        set((state) => {
          if (!state.session) return state;
          return {
            session: {
              ...state.session,
              queue: state.session.queue.filter((id) => id !== playerId),
            },
          };
        });
      },

      moveInQueue: (playerId, direction) => {
        set((state) => {
          if (!state.session) return state;
          const queue = [...state.session.queue];
          const index = queue.indexOf(playerId);
          if (index === -1) return state;

          const newIndex = direction === 'up' ? index - 1 : index + 1;
          if (newIndex < 0 || newIndex >= queue.length) return state;

          const player = state.session.players.find(p => p.id === playerId);
          [queue[index], queue[newIndex]] = [queue[newIndex], queue[index]];
          
          return {
            session: {
              ...state.session,
              queue,
              activityLog: [
                createLogEntry(
                  direction === 'up' ? 'player_moved_up' : 'player_moved_down',
                  `${player?.name || 'Player'} moved ${direction} to position ${newIndex + 1}`,
                  { playerNames: [player?.name || ''] }
                ),
                ...state.session.activityLog,
              ],
            },
          };
        });
      },

      moveToFrontOfQueue: (playerId) => {
        set((state) => {
          if (!state.session) return state;
          const queue = [...state.session.queue];
          const index = queue.indexOf(playerId);
          if (index === -1 || index === 0) return state;

          const player = state.session.players.find(p => p.id === playerId);
          
          // Remove from current position and add to front
          queue.splice(index, 1);
          queue.unshift(playerId);
          
          return {
            session: {
              ...state.session,
              queue,
              activityLog: [
                createLogEntry(
                  'player_moved_front',
                  `${player?.name || 'Player'} skipped to front of queue`,
                  { playerNames: [player?.name || ''] }
                ),
                ...state.session.activityLog,
              ],
            },
          };
        });
      },

      isNameDuplicate: (name) => {
        const state = get();
        if (!state.session) return false;
        const normalizedName = name.trim().toLowerCase();
        return state.session.players.some(
          (p) => p.name.trim().toLowerCase() === normalizedName
        );
      },

      startGame: (courtId, team1, team2) => {
        set((state) => {
          if (!state.session) return state;

          const game: Game = {
            id: uuidv4(),
            courtId,
            team1,
            team2,
            startedAt: new Date(),
          };

          const court = state.session.courts.find(c => c.id === courtId);
          const team1Names = team1.map(id => state.session!.players.find(p => p.id === id)?.name || '');
          const team2Names = team2.map(id => state.session!.players.find(p => p.id === id)?.name || '');

          // Remove players from queue
          const allPlayerIds = [...team1, ...team2];
          const newQueue = state.session.queue.filter(
            (id) => !allPlayerIds.includes(id)
          );

          return {
            session: {
              ...state.session,
              courts: state.session.courts.map((c) =>
                c.id === courtId
                  ? { ...c, status: 'in_game', currentGame: game }
                  : c
              ),
              queue: newQueue,
              activityLog: [
                createLogEntry(
                  'game_started',
                  `Game started on ${court?.name}: ${team1Names.join(' & ')} vs ${team2Names.join(' & ')}`,
                  { courtId, courtName: court?.name, team1Names, team2Names }
                ),
                ...state.session.activityLog,
              ],
            },
          };
        });
      },

      endGame: (courtId, winner, score) => {
        set((state) => {
          if (!state.session) return state;

          const court = state.session.courts.find((c) => c.id === courtId);
          if (!court?.currentGame) return state;

          const completedGame: Game = {
            ...court.currentGame,
            endedAt: new Date(),
            winner,
            score,
          };

          // Update player stats
          const winningTeam = winner === 'team1' ? court.currentGame.team1 : court.currentGame.team2;
          const losingTeam = winner === 'team1' ? court.currentGame.team2 : court.currentGame.team1;
          const allPlayerIds = [...court.currentGame.team1, ...court.currentGame.team2];

          const updatedPlayers = state.session.players.map((p) => {
            if (!allPlayerIds.includes(p.id)) return p;
            return {
              ...p,
              gamesPlayed: p.gamesPlayed + 1,
              gamesWon: winningTeam.includes(p.id) ? p.gamesWon + 1 : p.gamesWon,
            };
          });

          // Handle rotation based on mode - ALL players go back to queue
          let newQueue = [...state.session.queue];
          const rotationMode = state.session.rotationMode;

          if (rotationMode === 'winners_stay' || rotationMode === 'king_of_court') {
            // Losers go to back of queue immediately
            // Winners will be handled by autoAssignNextGame (they stay on court)
            // But if no new game starts, winners should also be in queue
            newQueue = [...newQueue, ...losingTeam, ...winningTeam];
          } else if (rotationMode === 'full_rotation' || rotationMode === 'skill_based') {
            // All players go to back of queue
            newQueue = [...newQueue, ...allPlayerIds];
          } else {
            // Default: all players go to queue
            newQueue = [...newQueue, ...allPlayerIds];
          }

          // Get player names for logging
          const winnerNames = winningTeam.map(id => state.session!.players.find(p => p.id === id)?.name || '');
          const loserNames = losingTeam.map(id => state.session!.players.find(p => p.id === id)?.name || '');

          return {
            session: {
              ...state.session,
              courts: state.session.courts.map((c) =>
                c.id === courtId
                  ? { ...c, status: 'available', currentGame: undefined }
                  : c
              ),
              players: updatedPlayers,
              queue: newQueue,
              gamesCompleted: [...state.session.gamesCompleted, completedGame],
              activityLog: [
                createLogEntry(
                  'game_ended',
                  `${court.name}: ${winnerNames.join(' & ')} defeated ${loserNames.join(' & ')}`,
                  { 
                    courtId, 
                    courtName: court.name, 
                    winner,
                    team1Names: court.currentGame.team1.map(id => state.session!.players.find(p => p.id === id)?.name || ''),
                    team2Names: court.currentGame.team2.map(id => state.session!.players.find(p => p.id === id)?.name || ''),
                  }
                ),
                ...state.session.activityLog,
              ],
            },
          };
        });
      },

      cancelGame: (courtId) => {
        set((state) => {
          if (!state.session) return state;

          const court = state.session.courts.find((c) => c.id === courtId);
          if (!court?.currentGame) return state;

          // Get all players from the cancelled game
          const allPlayerIds = [...court.currentGame.team1, ...court.currentGame.team2];
          const playerNames = allPlayerIds.map(id => state.session!.players.find(p => p.id === id)?.name || '');

          // Add players back to front of queue
          const newQueue = [...allPlayerIds, ...state.session.queue];

          return {
            session: {
              ...state.session,
              courts: state.session.courts.map((c) =>
                c.id === courtId
                  ? { ...c, status: 'maintenance', currentGame: undefined }
                  : c
              ),
              queue: newQueue,
              activityLog: [
                createLogEntry(
                  'game_ended',
                  `${court.name}: Game cancelled - ${playerNames.join(', ')} returned to queue`,
                  { courtId, courtName: court.name }
                ),
                ...state.session.activityLog,
              ],
            },
          };
        });
      },

      autoAssignNextGame: (courtId) => {
        const state = get();
        if (!state.session) return;

        const court = state.session.courts.find((c) => c.id === courtId);
        if (!court || court.status !== 'available') return;

        // Get next 4 players from queue
        const availableInQueue = state.session.queue.filter((id) => {
          const player = state.session?.players.find((p) => p.id === id);
          return player?.isActive;
        });

        // For winners_stay mode, check if there are winners on this court
        let team1: [string, string] | null = null;
        let team2: [string, string] | null = null;

        const lastGame = state.session.gamesCompleted
          .filter((g) => g.courtId === courtId)
          .pop();

        if (
          (state.session.rotationMode === 'winners_stay' ||
            state.session.rotationMode === 'king_of_court') &&
          lastGame?.winner
        ) {
          // Winners stay on court
          const winners =
            lastGame.winner === 'team1' ? lastGame.team1 : lastGame.team2;
          
          // Check if winners are still active
          const activeWinners = winners.filter((id) => {
            const player = state.session?.players.find((p) => p.id === id);
            return player?.isActive;
          });

          if (activeWinners.length === 2) {
            team1 = winners as [string, string];
            // Get next 2 from queue for team2
            if (availableInQueue.length >= 2) {
              team2 = [availableInQueue[0], availableInQueue[1]];
            }
          }
        }

        // If no winners staying, get 4 from queue
        if (!team1 && !team2 && availableInQueue.length >= 4) {
          team1 = [availableInQueue[0], availableInQueue[1]];
          team2 = [availableInQueue[2], availableInQueue[3]];
        }

        if (team1 && team2) {
          state.startGame(courtId, team1, team2);
        }
      },

      swapPlayers: (courtId, fromTeam, fromIndex, toTeam, toIndex) => {
        set((state) => {
          if (!state.session) return state;

          const court = state.session.courts.find((c) => c.id === courtId);
          if (!court?.currentGame) return state;

          const game = court.currentGame;
          const newTeam1 = [...game.team1] as [string, string];
          const newTeam2 = [...game.team2] as [string, string];

          // Get the players to swap
          const fromPlayer = fromTeam === 'team1' ? newTeam1[fromIndex] : newTeam2[fromIndex];
          const toPlayer = toTeam === 'team1' ? newTeam1[toIndex] : newTeam2[toIndex];

          // Perform the swap
          if (fromTeam === 'team1') {
            newTeam1[fromIndex] = toPlayer;
          } else {
            newTeam2[fromIndex] = toPlayer;
          }

          if (toTeam === 'team1') {
            newTeam1[toIndex] = fromPlayer;
          } else {
            newTeam2[toIndex] = fromPlayer;
          }

          return {
            session: {
              ...state.session,
              courts: state.session.courts.map((c) =>
                c.id === courtId
                  ? {
                      ...c,
                      currentGame: {
                        ...game,
                        team1: newTeam1,
                        team2: newTeam2,
                      },
                    }
                  : c
              ),
            },
          };
        });
      },

      // Remove a player from an active game and put them 2nd in queue
      removePlayerFromGame: (courtId, team, index) => {
        set((state) => {
          if (!state.session) return state;

          const court = state.session.courts.find((c) => c.id === courtId);
          if (!court?.currentGame) return state;

          const game = court.currentGame;
          const playerId = team === 'team1' ? game.team1[index] : game.team2[index];
          const player = state.session.players.find(p => p.id === playerId);
          
          if (!playerId) return state;

          // Create new team arrays with empty slot
          const newTeam1 = [...game.team1] as [string, string];
          const newTeam2 = [...game.team2] as [string, string];
          
          if (team === 'team1') {
            newTeam1[index] = ''; // Mark as empty
          } else {
            newTeam2[index] = ''; // Mark as empty
          }

          // Add player to 2nd position in queue (after first player)
          const newQueue = [...state.session.queue];
          // Remove if already in queue
          const existingIndex = newQueue.indexOf(playerId);
          if (existingIndex !== -1) {
            newQueue.splice(existingIndex, 1);
          }
          // Insert at position 1 (2nd place)
          newQueue.splice(1, 0, playerId);

          // Create log entry
          const logEntry = createLogEntry(
            'player_removed',
            `${player?.name || 'Player'} removed from ${court.name} and moved to 2nd in queue`
          );

          return {
            session: {
              ...state.session,
              queue: newQueue,
              activityLog: [logEntry, ...state.session.activityLog],
              courts: state.session.courts.map((c) =>
                c.id === courtId
                  ? {
                      ...c,
                      currentGame: {
                        ...game,
                        team1: newTeam1,
                        team2: newTeam2,
                      },
                    }
                  : c
              ),
            },
          };
        });
      },

      // Pull first player from queue to fill empty slot in game
      pullPlayerToGame: (courtId, team, index) => {
        set((state) => {
          if (!state.session) return state;
          if (state.session.queue.length === 0) return state;

          const court = state.session.courts.find((c) => c.id === courtId);
          if (!court?.currentGame) return state;

          const game = court.currentGame;
          
          // Get first player from queue
          const playerId = state.session.queue[0];
          const player = state.session.players.find(p => p.id === playerId);
          
          if (!playerId) return state;

          // Create new team arrays
          const newTeam1 = [...game.team1] as [string, string];
          const newTeam2 = [...game.team2] as [string, string];
          
          if (team === 'team1') {
            newTeam1[index] = playerId;
          } else {
            newTeam2[index] = playerId;
          }

          // Remove player from queue
          const newQueue = state.session.queue.slice(1);

          // Create log entry
          const logEntry = createLogEntry(
            'player_added',
            `${player?.name || 'Player'} pulled from queue to ${court.name}`
          );

          return {
            session: {
              ...state.session,
              queue: newQueue,
              activityLog: [logEntry, ...state.session.activityLog],
              courts: state.session.courts.map((c) =>
                c.id === courtId
                  ? {
                      ...c,
                      currentGame: {
                        ...game,
                        team1: newTeam1,
                        team2: newTeam2,
                      },
                    }
                  : c
              ),
            },
          };
        });
      },

      getPlayerById: (playerId) => {
        const state = get();
        return state.session?.players.find((p) => p.id === playerId);
      },

      getPlayersInQueue: () => {
        const state = get();
        if (!state.session) return [];
        return state.session.queue
          .map((id) => state.session?.players.find((p) => p.id === id))
          .filter((p): p is Player => p !== undefined);
      },

      getAvailablePlayers: () => {
        const state = get();
        if (!state.session) return [];
        
        // Players who are active and not currently in a game
        const playersInGames = new Set<string>();
        state.session.courts.forEach((court) => {
          if (court.currentGame) {
            court.currentGame.team1.forEach((id) => playersInGames.add(id));
            court.currentGame.team2.forEach((id) => playersInGames.add(id));
          }
        });

        return state.session.players.filter(
          (p) => p.isActive && !playersInGames.has(p.id)
        );
      },
    }),
    {
      name: 'kitchenboss-session',
      partialize: (state) => ({ session: state.session }),
    }
  )
);
