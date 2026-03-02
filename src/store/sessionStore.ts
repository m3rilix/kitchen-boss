import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import type { Session, Player, Court, Game, SessionConfig, ActivityLogEntry, ActivityType } from '@/types';
import { updateSharedSession } from '@/lib/firebase';
import { getNextGamePlayers } from '@/lib/smartQueue';

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
  resetSession: () => void; // Dev only - resets games/queues but keeps players
  updateSessionName: (name: string) => void;
  
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
  movePlayerToPosition: (playerId: string, newIndex: number) => void;
  moveStackToFront: (playerIds: string[]) => void;
  movePlayerToStack: (playerId: string, targetStack: 'winner' | 'loser' | 'waiting') => void;
  
  // Next stack selection (for manual override) - stores player IDs of the selected stack
  nextStackPlayerIds: string[] | null;
  setNextStackPlayerIds: (playerIds: string[] | null) => void;
  
  // Validation
  isNameDuplicate: (name: string) => boolean;
  
  // Game actions
  startGame: (courtId: string, team1: [string, string], team2: [string, string], skippedQueue?: boolean) => void;
  endGame: (courtId: string, winner: 'team1' | 'team2', score?: { team1: number; team2: number }) => void;
  cancelGame: (courtId: string) => void;
  autoAssignNextGame: (courtId: string) => void;
  swapPlayers: (courtId: string, fromTeam: 'team1' | 'team2', fromIndex: number, toTeam: 'team1' | 'team2', toIndex: number) => void;
  
  // Maintenance actions (during game)
  removePlayerFromGame: (courtId: string, team: 'team1' | 'team2', index: number) => void;
  pullPlayerToGame: (courtId: string, team: 'team1' | 'team2', index: number) => void;
  replacePlayerInGame: (courtId: string, team: 'team1' | 'team2', index: number, newPlayerId: string) => void;
  
  // Utility
  getPlayerById: (playerId: string) => Player | undefined;
  getPlayersInQueue: () => Player[];
  getAvailablePlayers: () => Player[];
  
  // Firebase sync
  shareCode: string | null;
  setShareCode: (code: string | null) => void;
  syncToFirebase: () => Promise<void>;
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set, get) => ({
      session: null,
      nextStackPlayerIds: null,
      
      setNextStackPlayerIds: (playerIds) => set({ nextStackPlayerIds: playerIds }),

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
                                                              
            winnerStack: [],
            loserStack: [],
            waitingStack: [],
            useSmartQueue: true, // Enable smart queue by default
            stackCounter: 0, // Tracks total stacks played
          },
        });
      },

      endSession: () => {
        set({ session: null });
      },

      updateSessionName: (name) => {
        set((state) => {
          if (!state.session) return state;
          return {
            session: {
              ...state.session,
              name: name.trim(),
            },
          };
        });
      },

      resetSession: () => {
        set((state) => {
          if (!state.session) return state;
          
          // Reset all players to initial state (including status/colors)
          const resetPlayers = state.session.players.map(p => ({
            ...p,
            gamesPlayed: 0,
            gamesWon: 0,
            isActive: true,
            currentCourtId: undefined,
            waitingSince: Date.now(),
            winStreak: 0,
            loseStreak: 0,
            lastGameResult: undefined, // Reset win/lose status (color icons)
            lastPartners: [],
            lastOpponents: [],
          }));
          
          // Put all players in waiting stack
          const allPlayerIds = resetPlayers.map(p => p.id);
          
          // Reset courts
          const resetCourts = state.session.courts.map(c => ({
            ...c,
            status: 'available' as const,
            currentGame: undefined,
          }));
          
          return {
            nextStackPlayerIds: null, // Reset next stack selection
            session: {
              ...state.session,
              players: resetPlayers,
              courts: resetCourts,
              queue: allPlayerIds,
              gamesCompleted: [],
              winnerStack: [],
              loserStack: [],
              waitingStack: allPlayerIds,
              stackCounter: 0,
              activityLog: [
                createLogEntry('player_added', `Session reset - ${resetPlayers.length} players ready`),
              ],
            },
          };
        });
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
            // Smart queue fields
            winStreak: 0,
            loseStreak: 0,
            lastPartners: [],
            lastOpponents: [],
            waitingSince: Date.now(),
          };
          
          // Legacy FIFO queue
          const newQueue = moveToFront 
            ? [newPlayer.id, ...state.session.queue]
            : [...state.session.queue, newPlayer.id];
          
          // Smart queue: new players go to waiting stack (with defensive check)
          const currentWaitingStack = state.session.waitingStack ?? [];
          const newWaitingStack = moveToFront
            ? [newPlayer.id, ...currentWaitingStack]
            : [...currentWaitingStack, newPlayer.id];
          
          const logMessage = moveToFront 
            ? `${name} added and moved to front of queue`
            : `${name} joined the session`;
          
          return {
            session: {
              ...state.session,
              players: [...state.session.players, newPlayer],
              queue: newQueue,
              waitingStack: newWaitingStack,
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
              // Also remove from smart queue stacks
              winnerStack: state.session.winnerStack.filter((id) => id !== playerId),
              loserStack: state.session.loserStack.filter((id) => id !== playerId),
              waitingStack: state.session.waitingStack.filter((id) => id !== playerId),
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
          
          // Also move in the appropriate smart queue stack
          const moveInStack = (stack: string[]): string[] => {
            const newStack = [...stack];
            const stackIndex = newStack.indexOf(playerId);
            if (stackIndex === -1) return stack;
            const newStackIndex = direction === 'up' ? stackIndex - 1 : stackIndex + 1;
            if (newStackIndex < 0 || newStackIndex >= newStack.length) return stack;
            [newStack[stackIndex], newStack[newStackIndex]] = [newStack[newStackIndex], newStack[stackIndex]];
            return newStack;
          };
          
          return {
            session: {
              ...state.session,
              queue,
              winnerStack: moveInStack(state.session.winnerStack ?? []),
              loserStack: moveInStack(state.session.loserStack ?? []),
              waitingStack: moveInStack(state.session.waitingStack ?? []),
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
          
          // Also move to front in the appropriate smart queue stack
          const moveToFrontInStack = (stack: string[]): string[] => {
            const newStack = stack.filter(id => id !== playerId);
            if (stack.includes(playerId)) {
              newStack.unshift(playerId);
            }
            return newStack;
          };
          
          return {
            session: {
              ...state.session,
              queue,
              winnerStack: moveToFrontInStack(state.session.winnerStack ?? []),
              loserStack: moveToFrontInStack(state.session.loserStack ?? []),
              waitingStack: moveToFrontInStack(state.session.waitingStack ?? []),
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

      movePlayerToPosition: (playerId, newIndex) => {
        set((state) => {
          if (!state.session) return state;
          
          const queue = [...state.session.queue];
          const currentIndex = queue.indexOf(playerId);
          if (currentIndex === -1 || currentIndex === newIndex) return state;
          
          // Remove from current position
          queue.splice(currentIndex, 1);
          // Insert at new position
          queue.splice(newIndex, 0, playerId);
          
          const player = state.session.players.find(p => p.id === playerId);
          
          // Also update in the appropriate stack
          const moveInStack = (stack: string[]): string[] => {
            const newStack = stack.filter(id => id !== playerId);
            if (stack.includes(playerId)) {
              // Calculate relative position in stack
              const stackCurrentIdx = stack.indexOf(playerId);
              const diff = newIndex - currentIndex;
              const newStackIdx = Math.max(0, Math.min(newStack.length, stackCurrentIdx + diff));
              newStack.splice(newStackIdx, 0, playerId);
            }
            return newStack;
          };
          
          return {
            session: {
              ...state.session,
              queue,
              winnerStack: moveInStack(state.session.winnerStack ?? []),
              loserStack: moveInStack(state.session.loserStack ?? []),
              waitingStack: moveInStack(state.session.waitingStack ?? []),
              activityLog: [
                createLogEntry(
                  'player_moved',
                  `${player?.name || 'Player'} moved to position ${newIndex + 1}`,
                  { playerNames: [player?.name || ''] }
                ),
                ...state.session.activityLog,
              ],
            },
          };
        });
      },

      moveStackToFront: (playerIds) => {
        set((state) => {
          if (!state.session || playerIds.length === 0) return state;
          
          // Remove these players from queue and add to front
          const queue = state.session.queue.filter(id => !playerIds.includes(id));
          const newQueue = [...playerIds, ...queue];
          
          // Also move in the appropriate stacks
          const moveToFrontInStack = (stack: string[]): string[] => {
            const inStack = playerIds.filter(id => stack.includes(id));
            const rest = stack.filter(id => !playerIds.includes(id));
            return [...inStack, ...rest];
          };
          
          const playerNames = playerIds.map(id => 
            state.session!.players.find(p => p.id === id)?.name || ''
          ).filter(Boolean);
          
          return {
            session: {
              ...state.session,
              queue: newQueue,
              winnerStack: moveToFrontInStack(state.session.winnerStack ?? []),
              loserStack: moveToFrontInStack(state.session.loserStack ?? []),
              waitingStack: moveToFrontInStack(state.session.waitingStack ?? []),
              activityLog: [
                createLogEntry(
                  'stack_moved',
                  `Stack moved to front: ${playerNames.join(', ')}`,
                  { playerNames }
                ),
                ...state.session.activityLog,
              ],
            },
          };
        });
      },

      movePlayerToStack: (playerId, targetStack) => {
        set((state) => {
          if (!state.session) return state;
          
          const player = state.session.players.find(p => p.id === playerId);
          if (!player) return state;
          
          // Remove from all stacks
          let newWinnerStack = state.session.winnerStack.filter(id => id !== playerId);
          let newLoserStack = state.session.loserStack.filter(id => id !== playerId);
          let newWaitingStack = state.session.waitingStack.filter(id => id !== playerId);
          
          // Add to target stack
          if (targetStack === 'winner') {
            newWinnerStack = [...newWinnerStack, playerId];
          } else if (targetStack === 'loser') {
            newLoserStack = [...newLoserStack, playerId];
          } else {
            newWaitingStack = [...newWaitingStack, playerId];
          }
          
          const stackName = targetStack === 'winner' ? 'Winners' : targetStack === 'loser' ? 'Losers' : 'Free';
          
          return {
            session: {
              ...state.session,
              winnerStack: newWinnerStack,
              loserStack: newLoserStack,
              waitingStack: newWaitingStack,
              activityLog: [
                createLogEntry(
                  'player_moved',
                  `${player.name} moved to ${stackName} stack`,
                  { playerNames: [player.name] }
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

      startGame: (courtId, team1, team2, skippedQueue = false) => {
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
          const allNames = [...team1Names, ...team2Names];

          // Remove players from queue and all stacks
          const allPlayerIds = [...team1, ...team2];
          const newQueue = state.session.queue.filter(
            (id) => !allPlayerIds.includes(id)
          );
          
          // Remove from smart queue stacks and update waitingSince to 0 (in game)
          const newWinnerStack = state.session.winnerStack.filter(id => !allPlayerIds.includes(id));
          const newLoserStack = state.session.loserStack.filter(id => !allPlayerIds.includes(id));
          const newWaitingStack = state.session.waitingStack.filter(id => !allPlayerIds.includes(id));
          
          // Update players' waitingSince to 0 (they're in a game now)
          const updatedPlayers = state.session.players.map(p => 
            allPlayerIds.includes(p.id) ? { ...p, waitingSince: 0 } : p
          );

          // Build activity log entries
          const logEntries: ActivityLogEntry[] = [
            createLogEntry(
              'game_started',
              `Game started on ${court?.name}: ${team1Names.join(' & ')} vs ${team2Names.join(' & ')}`,
              { courtId, courtName: court?.name, team1Names, team2Names }
            ),
          ];
          
          // Add "skipped the queue" entry if applicable
          if (skippedQueue) {
            logEntries.unshift(
              createLogEntry(
                'stack_skipped',
                `${allNames.join(', ')} skipped the queue`,
                { playerNames: allNames }
              )
            );
          }

          return {
            session: {
              ...state.session,
              courts: state.session.courts.map((c) =>
                c.id === courtId
                  ? { ...c, status: 'in_game', currentGame: game }
                  : c
              ),
              players: updatedPlayers,
              queue: newQueue,
              winnerStack: newWinnerStack,
              loserStack: newLoserStack,
              waitingStack: newWaitingStack,
              stackCounter: (state.session.stackCounter ?? 0) + 1, // Increment stack counter
              activityLog: [
                ...logEntries,
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

          // Determine winners and losers
          const winningTeam = winner === 'team1' ? court.currentGame.team1 : court.currentGame.team2;
          const losingTeam = winner === 'team1' ? court.currentGame.team2 : court.currentGame.team1;
          const allPlayerIds = [...court.currentGame.team1, ...court.currentGame.team2];

          // Update player stats with smart queue tracking
          const updatedPlayers = state.session.players.map((p) => {
            if (!allPlayerIds.includes(p.id)) return p;
            
            const isWinner = winningTeam.includes(p.id);
            const partnerId = isWinner
              ? winningTeam.find(id => id !== p.id)!
              : losingTeam.find(id => id !== p.id)!;
            const opponentIds = isWinner ? losingTeam : winningTeam;
            
            return {
              ...p,
              gamesPlayed: p.gamesPlayed + 1,
              gamesWon: isWinner ? p.gamesWon + 1 : p.gamesWon,
              // Smart queue fields
              winStreak: isWinner ? p.winStreak + 1 : 0,
              loseStreak: isWinner ? 0 : p.loseStreak + 1,
              lastPartners: [partnerId, ...p.lastPartners].slice(0, 3),
              lastOpponents: [...opponentIds, ...p.lastOpponents].slice(0, 4),
              waitingSince: Date.now(),
              lastGameResult: (isWinner ? 'won' : 'lost') as 'won' | 'lost',
            };
          });

          // Handle rotation based on mode - ALL players go back to queue (legacy)
          let newQueue = [...state.session.queue];
          const rotationMode = state.session.rotationMode;

          if (rotationMode === 'winners_stay' || rotationMode === 'king_of_court') {
            newQueue = [...newQueue, ...losingTeam, ...winningTeam];
          } else if (rotationMode === 'full_rotation' || rotationMode === 'skill_based') {
            newQueue = [...newQueue, ...allPlayerIds];
          } else {
            newQueue = [...newQueue, ...allPlayerIds];
          }

          // Smart queue: update stacks
          // Remove all 4 players from all stacks first
          let newWinnerStack = state.session.winnerStack.filter(id => !allPlayerIds.includes(id));
          let newLoserStack = state.session.loserStack.filter(id => !allPlayerIds.includes(id));
          let newWaitingStack = state.session.waitingStack.filter(id => !allPlayerIds.includes(id));
          
          // Add winners to winner stack
          newWinnerStack = [...newWinnerStack, ...winningTeam];
          // Add losers to loser stack
          newLoserStack = [...newLoserStack, ...losingTeam];

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
              // Smart queue stacks
              winnerStack: newWinnerStack,
              loserStack: newLoserStack,
              waitingStack: newWaitingStack,
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

          // Add players back to front of queue (legacy)
          const newQueue = [...allPlayerIds, ...state.session.queue];
          
          // Add players back to front of waiting stack (smart queue)
          // They go to waitingStack since the game was cancelled (no win/loss)
          const currentWaitingStack = state.session.waitingStack ?? [];
          const newWaitingStack = [...allPlayerIds, ...currentWaitingStack];
          
          // Update players' waitingSince to now (they're back in queue)
          const updatedPlayers = state.session.players.map(p => 
            allPlayerIds.includes(p.id) ? { ...p, waitingSince: Date.now() } : p
          );

          return {
            session: {
              ...state.session,
              players: updatedPlayers,
              courts: state.session.courts.map((c) =>
                c.id === courtId
                  ? { ...c, status: 'available', currentGame: undefined }
                  : c
              ),
              queue: newQueue,
              waitingStack: newWaitingStack,
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

        let team1: [string, string] | null = null;
        let team2: [string, string] | null = null;

        // Use smart queue if enabled
        if (state.session.useSmartQueue) {
          // Check if user manually selected specific players for next game
          const nextStackPlayerIds = state.nextStackPlayerIds;
          
          if (nextStackPlayerIds && nextStackPlayerIds.length === 4) {
            // Verify all players are still available (not in a game)
            const playersInGames = new Set<string>();
            state.session.courts.forEach((c) => {
              if (c.currentGame) {
                c.currentGame.team1.forEach((id) => playersInGames.add(id));
                c.currentGame.team2.forEach((id) => playersInGames.add(id));
              }
            });
            
            const availablePlayers = nextStackPlayerIds.filter(id => !playersInGames.has(id));
            if (availablePlayers.length === 4) {
              team1 = [availablePlayers[0], availablePlayers[1]];
              team2 = [availablePlayers[2], availablePlayers[3]];
              // Reset the manual selection after use
              set({ nextStackPlayerIds: null });
            }
          }
          
          // If no manual selection or it failed, use auto selection
          if (!team1 || !team2) {
            const nextGame = getNextGamePlayers(state.session);
            if (nextGame) {
              team1 = nextGame.team1;
              team2 = nextGame.team2;
            }
          }
        } else {
          // Legacy FIFO queue logic
          const availableInQueue = state.session.queue.filter((id) => {
            const player = state.session?.players.find((p) => p.id === id);
            return player?.isActive;
          });

          // For winners_stay mode, check if there are winners on this court
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

      // Remove a player from an active game and put them at bottom of queue
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

          // Add player to END of queue (bottom of stack)
          const newQueue = state.session.queue.filter(id => id !== playerId);
          newQueue.push(playerId);
          
          // Add player to END of waiting stack (smart queue)
          const currentWaitingStack = state.session.waitingStack ?? [];
          const newWaitingStack = currentWaitingStack.filter(id => id !== playerId);
          newWaitingStack.push(playerId);
          
          // Update player's waitingSince
          const updatedPlayers = state.session.players.map(p => 
            p.id === playerId ? { ...p, waitingSince: Date.now() } : p
          );

          // Create log entry
          const logEntry = createLogEntry(
            'player_removed',
            `${player?.name || 'Player'} removed from ${court.name} and moved to bottom of queue`
          );

          return {
            session: {
              ...state.session,
              players: updatedPlayers,
              queue: newQueue,
              waitingStack: newWaitingStack,
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

      // Replace a player in game with a specific player from queue
      replacePlayerInGame: (courtId, team, index, newPlayerId) => {
        set((state) => {
          if (!state.session) return state;

          const court = state.session.courts.find((c) => c.id === courtId);
          if (!court?.currentGame) return state;

          const game = court.currentGame;
          const newPlayer = state.session.players.find(p => p.id === newPlayerId);
          
          // Get the player being replaced
          const oldPlayerId = team === 'team1' ? game.team1[index] : game.team2[index];
          const oldPlayer = state.session.players.find(p => p.id === oldPlayerId);
          
          if (!newPlayer || !oldPlayerId) return state;

          // Create new team arrays
          const newTeam1 = [...game.team1] as [string, string];
          const newTeam2 = [...game.team2] as [string, string];
          
          if (team === 'team1') {
            newTeam1[index] = newPlayerId;
          } else {
            newTeam2[index] = newPlayerId;
          }

          // Remove new player from queue and all stacks
          const newQueue = state.session.queue.filter(id => id !== newPlayerId);
          const newWinnerStack = state.session.winnerStack.filter(id => id !== newPlayerId);
          const newLoserStack = state.session.loserStack.filter(id => id !== newPlayerId);
          const newWaitingStack = state.session.waitingStack.filter(id => id !== newPlayerId);
          
          // Add old player to bottom of waiting stack
          const updatedWaitingStack = [...newWaitingStack, oldPlayerId];
          const updatedQueue = [...newQueue, oldPlayerId];

          // Update waitingSince for both players
          const updatedPlayers = state.session.players.map(p => {
            if (p.id === newPlayerId) {
              return { ...p, waitingSince: 0 }; // In game now
            }
            if (p.id === oldPlayerId) {
              return { ...p, waitingSince: Date.now() }; // Back in queue
            }
            return p;
          });

          return {
            session: {
              ...state.session,
              queue: updatedQueue,
              winnerStack: newWinnerStack,
              loserStack: newLoserStack,
              waitingStack: updatedWaitingStack,
              players: updatedPlayers,
              activityLog: [
                createLogEntry(
                  'player_moved',
                  `${newPlayer.name} replaced ${oldPlayer?.name || 'player'} on ${court.name}`,
                  { playerNames: [newPlayer.name, oldPlayer?.name || ''] }
                ),
                ...state.session.activityLog,
              ],
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

      // Firebase sync
      shareCode: null,
      
      setShareCode: (code) => set({ shareCode: code }),
      
      syncToFirebase: async () => {
        const state = get();
        if (state.shareCode && state.session) {
          try {
            await updateSharedSession(state.shareCode, state.session);
          } catch (error) {
            console.error('Failed to sync to Firebase:', error);
          }
        }
      },
    }),
    {
      name: 'kitchenboss-session',
      partialize: (state) => ({ session: state.session, shareCode: state.shareCode }),
    }
  )
);
