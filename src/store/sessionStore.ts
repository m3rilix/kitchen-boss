import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import type { Session, Player, Court, Game, SessionConfig, ActivityLogEntry, ActivityType } from '@/types';
import { updateSharedSession } from '@/lib/firebase';
import { getNextGamePlayers } from '@/lib/smartQueue';
import { buildRoundRobinStack } from '@/lib/roundRobin';

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
  
  // Custom stack management
  createCustomStack: (playerIds: string[]) => void;
  removeCustomStack: (index: number) => void;
  reshuffleByWaitingTime: () => void;
  reshuffleByGamesPlayed: () => void;
  rebuildRoundRobinStacks: () => void;
  addNewRoundRobinStacks: () => void;
  smartRebuildStacks: () => void;
  // Win-Lose Stack functions
  buildWinLoseStacks: () => void;
  addNewWinLoseStacks: () => void;
  
  // Validation
  isNameDuplicate: (name: string) => boolean;
  
  // Game actions
  startGame: (courtId: string, team1: [string, string], team2: [string, string], skippedQueue?: boolean, customStackIndex?: number) => void;
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
                                                              
            winnerStack: [], // DEPRECATED
            loserStack: [], // DEPRECATED
            waitingStack: [],
            useSmartQueue: true, // Enable smart queue by default
            stackCounter: 0, // Tracks total stacks played
            // Win-Lose Stack mode - Pre-built stacks
            winnerStacks: [],
            loserStacks: [],
            waitingStacks: [],
            // Round Robin tracking
            matchHistory: [],
            customStacks: [],
            roundRobinStacks: [], // Pre-built stacks for Round Robin mode
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
          
          // Build initial stacks for Win-Lose mode
          const rotationMode = state.session.rotationMode;
          let initialWaitingStacks: string[][] = [];
          
          if (rotationMode === 'win_lose_stack' || rotationMode === 'full_rotation') {
            // Build stacks of 4 from all players
            for (let i = 0; i < allPlayerIds.length; i += 4) {
              const stack = allPlayerIds.slice(i, i + 4);
              initialWaitingStacks.push(stack);
            }
          }
          
          return {
            nextStackPlayerIds: null, // Reset next stack selection
            session: {
              ...state.session,
              players: resetPlayers,
              courts: resetCourts,
              queue: allPlayerIds,
              gamesCompleted: [],
              winnerStack: [], // DEPRECATED
              loserStack: [], // DEPRECATED
              waitingStack: allPlayerIds,
              stackCounter: 0,
              matchHistory: [], // Reset match history
              // Win-Lose stacks - build initial stacks
              winnerStacks: [],
              loserStacks: [],
              waitingStacks: initialWaitingStacks,
              lastStackType: undefined, // Reset alternating tracker
              // Round Robin stacks
              roundRobinStacks: [],
              customStacks: [],
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
              // DO NOT clear roundRobinStacks - existing stacks should be preserved
              activityLog: [
                createLogEntry('player_added', logMessage, { playerNames: [name] }),
                ...state.session.activityLog,
              ],
            },
          };
        });
        // Build new stacks based on mode
        const mode = get().session?.rotationMode;
        if (mode === 'round_robin') {
          get().addNewRoundRobinStacks();
        } else if (mode === 'win_lose_stack' || mode === 'full_rotation') {
          get().addNewWinLoseStacks();
        }
      },

      removePlayer: (playerId) => {
        set((state) => {
          if (!state.session) return state;
          
          // Helper to remove player from stack arrays
          const removeFromStacks = (stacks: string[][]): string[][] => {
            return stacks
              .map(stack => stack.filter(id => id !== playerId))
              .filter(stack => stack.length > 0); // Remove empty stacks
          };
          
          // Remove from all stack types
          const newRoundRobinStacks = removeFromStacks(state.session.roundRobinStacks || []);
          const newWinnerStacks = removeFromStacks(state.session.winnerStacks || []);
          const newLoserStacks = removeFromStacks(state.session.loserStacks || []);
          const newWaitingStacks = removeFromStacks(state.session.waitingStacks || []);
          const newCustomStacks = removeFromStacks(state.session.customStacks || []);
          
          return {
            session: {
              ...state.session,
              players: state.session.players.filter((p) => p.id !== playerId),
              queue: state.session.queue.filter((id) => id !== playerId),
              // Remove from deprecated flat arrays
              winnerStack: state.session.winnerStack.filter((id) => id !== playerId),
              loserStack: state.session.loserStack.filter((id) => id !== playerId),
              waitingStack: state.session.waitingStack.filter((id) => id !== playerId),
              // Remove from all stack arrays
              roundRobinStacks: newRoundRobinStacks,
              winnerStacks: newWinnerStacks,
              loserStacks: newLoserStacks,
              waitingStacks: newWaitingStacks,
              customStacks: newCustomStacks,
            },
          };
        });
        // Add new stacks without touching existing ones
        get().addNewRoundRobinStacks();
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
          
          // Also add to waitingStack if not already in any stack
          const inWinnerStack = state.session.winnerStack.includes(playerId);
          const inLoserStack = state.session.loserStack.includes(playerId);
          const inWaitingStack = state.session.waitingStack.includes(playerId);
          
          // Update player's waitingSince timestamp
          const updatedPlayers = state.session.players.map(p => 
            p.id === playerId ? { ...p, waitingSince: Date.now() } : p
          );
          
          return {
            session: {
              ...state.session,
              queue: [...state.session.queue, playerId],
              // Add to waitingStack if not in any stack
              waitingStack: (!inWinnerStack && !inLoserStack && !inWaitingStack) 
                ? [...state.session.waitingStack, playerId]
                : state.session.waitingStack,
              players: updatedPlayers,
              // Clear roundRobinStacks so they get rebuilt with new player
              roundRobinStacks: [],
            },
          };
        });
        // Add new stacks without touching existing ones
        get().addNewRoundRobinStacks();
      },

      removeFromQueue: (playerId) => {
        console.log('[removeFromQueue] START - playerId:', playerId);
        set((state) => {
          if (!state.session) return state;
          
          const playerName = state.session.players.find(p => p.id === playerId)?.name;
          console.log('[removeFromQueue] Removing:', playerName, '(', playerId, ')');
          console.log('[removeFromQueue] BEFORE - queue:', state.session.queue.length, 'waitingStack:', state.session.waitingStack.length);
          console.log('[removeFromQueue] BEFORE - winnerStacks:', JSON.stringify(state.session.winnerStacks?.map(s => s.length)));
          console.log('[removeFromQueue] BEFORE - loserStacks:', JSON.stringify(state.session.loserStacks?.map(s => s.length)));
          console.log('[removeFromQueue] BEFORE - waitingStacks:', JSON.stringify(state.session.waitingStacks?.map(s => s.length)));
          
          // Set waitingSince to -1 to indicate player was removed from queue
          // This helps distinguish "not waiting" from "in game" (which is 0)
          const updatedPlayers = state.session.players.map(p =>
            p.id === playerId ? { ...p, waitingSince: -1 } : p
          );
          
          // Helper to remove player from nested string[][] stacks
          const removeFromNestedStacks = (stacks: string[][]) =>
            stacks.map(stack => stack.filter(id => id !== playerId));
          
          // Also remove from roundRobinStacks
          const newRoundRobinStacks = removeFromNestedStacks(state.session.roundRobinStacks || [])
            .filter(stack => stack.length === 4); // Remove incomplete stacks
          
          const newWinnerStacks = removeFromNestedStacks(state.session.winnerStacks || []);
          const newLoserStacks = removeFromNestedStacks(state.session.loserStacks || []);
          const newWaitingStacks = removeFromNestedStacks(state.session.waitingStacks || []);
          const newCustomStacks = removeFromNestedStacks(state.session.customStacks || []);
          const newQueue = state.session.queue.filter((id) => id !== playerId);
          
          console.log('[removeFromQueue] AFTER - queue:', newQueue.length);
          console.log('[removeFromQueue] AFTER - winnerStacks:', JSON.stringify(newWinnerStacks.map(s => s.length)));
          console.log('[removeFromQueue] AFTER - loserStacks:', JSON.stringify(newLoserStacks.map(s => s.length)));
          console.log('[removeFromQueue] AFTER - waitingStacks:', JSON.stringify(newWaitingStacks.map(s => s.length)));
          
          return {
            session: {
              ...state.session,
              queue: newQueue,
              // Remove from deprecated singular stacks
              winnerStack: state.session.winnerStack.filter((id) => id !== playerId),
              loserStack: state.session.loserStack.filter((id) => id !== playerId),
              waitingStack: state.session.waitingStack.filter((id) => id !== playerId),
              // Remove from active plural stacks (used by Win-Lose UI)
              winnerStacks: newWinnerStacks,
              loserStacks: newLoserStacks,
              waitingStacks: newWaitingStacks,
              customStacks: newCustomStacks,
              roundRobinStacks: newRoundRobinStacks,
              players: updatedPlayers,
            },
          };
        });
        // Add new stacks without touching existing ones
        get().addNewRoundRobinStacks();
        
        // Debug: verify state after all updates
        const afterState = get().session;
        if (afterState) {
          console.log('[removeFromQueue] FINAL STATE - queue:', afterState.queue.length,
            'winnerStacks:', afterState.winnerStacks?.map(s => s.length),
            'loserStacks:', afterState.loserStacks?.map(s => s.length),
            'waitingStacks:', afterState.waitingStacks?.map(s => s.length));
        }
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
          
          // Remove from all flat stacks (deprecated)
          let newWinnerStack = state.session.winnerStack.filter(id => id !== playerId);
          let newLoserStack = state.session.loserStack.filter(id => id !== playerId);
          let newWaitingStack = state.session.waitingStack.filter(id => id !== playerId);
          
          // Remove from all Win-Lose stacks
          const removeFromStacks = (stacks: string[][]): string[][] => {
            return stacks
              .map(stack => stack.filter(id => id !== playerId))
              .filter(stack => stack.length > 0);
          };
          
          let newWinnerStacks = removeFromStacks(state.session.winnerStacks || []);
          let newLoserStacks = removeFromStacks(state.session.loserStacks || []);
          let newWaitingStacks = removeFromStacks(state.session.waitingStacks || []);
          let newRoundRobinStacks = removeFromStacks(state.session.roundRobinStacks || []);
          let newCustomStacks = removeFromStacks(state.session.customStacks || []);
          
          // Add to target stack (find forming stack or create new one)
          if (targetStack === 'winner') {
            newWinnerStack = [...newWinnerStack, playerId];
            const formingIdx = newWinnerStacks.findIndex(s => s.length < 4);
            if (formingIdx !== -1) {
              newWinnerStacks[formingIdx] = [...newWinnerStacks[formingIdx], playerId];
            } else {
              newWinnerStacks.push([playerId]);
            }
          } else if (targetStack === 'loser') {
            newLoserStack = [...newLoserStack, playerId];
            const formingIdx = newLoserStacks.findIndex(s => s.length < 4);
            if (formingIdx !== -1) {
              newLoserStacks[formingIdx] = [...newLoserStacks[formingIdx], playerId];
            } else {
              newLoserStacks.push([playerId]);
            }
          } else {
            newWaitingStack = [...newWaitingStack, playerId];
            const formingIdx = newWaitingStacks.findIndex(s => s.length < 4);
            if (formingIdx !== -1) {
              newWaitingStacks[formingIdx] = [...newWaitingStacks[formingIdx], playerId];
            } else {
              newWaitingStacks.push([playerId]);
            }
          }
          
          const stackName = targetStack === 'winner' ? 'Winners' : targetStack === 'loser' ? 'Losers' : 'Free';
          
          return {
            session: {
              ...state.session,
              winnerStack: newWinnerStack,
              loserStack: newLoserStack,
              waitingStack: newWaitingStack,
              winnerStacks: newWinnerStacks,
              loserStacks: newLoserStacks,
              waitingStacks: newWaitingStacks,
              roundRobinStacks: newRoundRobinStacks,
              customStacks: newCustomStacks,
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

      createCustomStack: (playerIds) => {
        set((state) => {
          if (!state.session) return state;
          if (playerIds.length !== 4) return state;
          
          // Remove players from their current flat stacks (deprecated)
          const newWinnerStack = state.session.winnerStack.filter(id => !playerIds.includes(id));
          const newLoserStack = state.session.loserStack.filter(id => !playerIds.includes(id));
          const newWaitingStack = state.session.waitingStack.filter(id => !playerIds.includes(id));
          
          // Remove players from Win-Lose stacks
          const removePlayersFromStacks = (stacks: string[][]): string[][] => {
            return stacks
              .map(stack => stack.filter(id => !playerIds.includes(id)))
              .filter(stack => stack.length > 0);
          };
          
          const newWinnerStacks = removePlayersFromStacks(state.session.winnerStacks || []);
          const newLoserStacks = removePlayersFromStacks(state.session.loserStacks || []);
          const newWaitingStacks = removePlayersFromStacks(state.session.waitingStacks || []);
          const newRoundRobinStacks = removePlayersFromStacks(state.session.roundRobinStacks || []);
          
          // Add to custom stacks
          const newCustomStacks = [...(state.session.customStacks || []), playerIds];
          
          // Get player names for log
          const playerNames = playerIds
            .map(id => state.session?.players.find(p => p.id === id)?.name || 'Unknown')
            .join(', ');
          
          return {
            session: {
              ...state.session,
              winnerStack: newWinnerStack,
              loserStack: newLoserStack,
              waitingStack: newWaitingStack,
              winnerStacks: newWinnerStacks,
              loserStacks: newLoserStacks,
              waitingStacks: newWaitingStacks,
              roundRobinStacks: newRoundRobinStacks,
              customStacks: newCustomStacks,
              activityLog: [
                createLogEntry(
                  'stack_moved',
                  `Custom stack created: ${playerNames}`,
                  { playerNames: playerNames.split(', ') }
                ),
                ...state.session.activityLog,
              ],
            },
          };
        });
      },

      removeCustomStack: (index) => {
        set((state) => {
          if (!state.session) return state;
          if (!state.session.customStacks || index >= state.session.customStacks.length) return state;
          
          const stackToRemove = state.session.customStacks[index];
          const newCustomStacks = state.session.customStacks.filter((_, i) => i !== index);
          
          // Get players currently in a game
          const playersInGame = new Set<string>();
          state.session.courts.forEach((court) => {
            if (court.currentGame) {
              court.currentGame.team1.forEach((id) => playersInGame.add(id));
              court.currentGame.team2.forEach((id) => playersInGame.add(id));
            }
          });
          
          // Only add players back to waiting stack if they're not in a game
          const playersToReturn = stackToRemove.filter(id => !playersInGame.has(id));
          const newWaitingStack = [...state.session.waitingStack, ...playersToReturn];
          
          return {
            session: {
              ...state.session,
              customStacks: newCustomStacks,
              waitingStack: newWaitingStack,
              activityLog: [
                createLogEntry(
                  'stack_moved',
                  `Custom stack removed, ${playersToReturn.length} players returned to queue`,
                  {}
                ),
                ...state.session.activityLog,
              ],
            },
          };
        });
      },

      // ROUND ROBIN: Reorder by waiting time - collects all players and sorts
      reshuffleByWaitingTime: () => {
        set((state) => {
          if (!state.session) return state;
          
          const isRoundRobin = state.session.rotationMode === 'round_robin';
          
          if (isRoundRobin) {
            // ROUND ROBIN MODE: Collect from roundRobinStacks + waitingStack
            const playersInGames = new Set<string>();
            state.session.courts.forEach((c) => {
              if (c.currentGame) {
                c.currentGame.team1.forEach((id) => playersInGames.add(id));
                c.currentGame.team2.forEach((id) => playersInGames.add(id));
              }
            });
            
            const customStackPlayerIds = new Set((state.session.customStacks || []).flat());
            const playersInStacks = (state.session.roundRobinStacks || []).flat();
            const playersInWaiting = state.session.waitingStack || [];
            
            // Combine all available player IDs (dedupe)
            const allAvailableIds = [...new Set([...playersInStacks, ...playersInWaiting])];
            
            // Get player objects and sort by waiting time (longest first = lowest timestamp)
            const sortedPlayers = allAvailableIds
              .map(id => state.session!.players.find(p => p.id === id))
              .filter((p): p is Player => 
                p !== undefined && 
                p.isActive && 
                p.waitingSince > 0 && 
                !playersInGames.has(p.id) &&
                !customStackPlayerIds.has(p.id)
              )
              .sort((a, b) => a.waitingSince - b.waitingSince); // Lower timestamp = waiting longer
            
            console.log('[reshuffleByWaitingTime] sorted players:', sortedPlayers.map(p => `${p.name}(${p.waitingSince})`));
            
            // Put ALL sorted players into waitingStack (stacks will be rebuilt)
            const newWaitingStack = sortedPlayers.map(p => p.id);
            
            return {
              session: {
                ...state.session,
                waitingStack: newWaitingStack,
                roundRobinStacks: [], // Clear - will be rebuilt by rebuildRoundRobinStacks
                activityLog: [
                  createLogEntry(
                    'stack_moved',
                    `Stacks reordered by waiting time (${sortedPlayers.length} players)`,
                    {}
                  ),
                  ...state.session.activityLog,
                ],
              },
            };
          } else {
            // WIN-LOSE MODE: Collect from all Win-Lose stacks and rebuild
            const playersInGames = new Set<string>();
            state.session.courts.forEach((c) => {
              if (c.currentGame) {
                c.currentGame.team1.forEach((id) => playersInGames.add(id));
                c.currentGame.team2.forEach((id) => playersInGames.add(id));
              }
            });
            
            const customStackPlayerIds = new Set((state.session.customStacks || []).flat());
            
            // Collect all players from Win-Lose stacks
            const playersInWinnerStacks = (state.session.winnerStacks || []).flat();
            const playersInLoserStacks = (state.session.loserStacks || []).flat();
            const playersInWaitingStacks = (state.session.waitingStacks || []).flat();
            
            const allAvailableIds = [...new Set([
              ...playersInWinnerStacks,
              ...playersInLoserStacks,
              ...playersInWaitingStacks
            ])];
            
            // Get player objects and sort by waiting time (longest first = lowest timestamp)
            const sortedPlayers = allAvailableIds
              .map(id => state.session!.players.find(p => p.id === id))
              .filter((p): p is Player => 
                p !== undefined && 
                p.isActive && 
                !playersInGames.has(p.id) &&
                !customStackPlayerIds.has(p.id)
              )
              .sort((a, b) => a.waitingSince - b.waitingSince); // Lower timestamp = waiting longer
            
            // Build new waiting stacks (all players go to regular stacks after reorder)
            const newWaitingStacks: string[][] = [];
            for (let i = 0; i < sortedPlayers.length; i += 4) {
              const stack = sortedPlayers.slice(i, i + 4).map(p => p.id);
              newWaitingStacks.push(stack);
            }
            
            return {
              session: {
                ...state.session,
                queue: sortedPlayers.map(p => p.id),
                winnerStack: [],
                loserStack: [],
                waitingStack: sortedPlayers.map(p => p.id),
                // Clear winner/loser stacks, put all in waiting stacks
                winnerStacks: [],
                loserStacks: [],
                waitingStacks: newWaitingStacks,
                lastStackType: undefined, // Reset alternating
                activityLog: [
                  createLogEntry(
                    'stack_moved',
                    `Stacks reordered by waiting time (${sortedPlayers.length} players)`,
                    {}
                  ),
                  ...state.session.activityLog,
                ],
              },
            };
          }
        });
        // Rebuild Round Robin stacks after reorder (only for Round Robin mode)
        const state = get();
        if (state.session?.rotationMode === 'round_robin') {
          get().rebuildRoundRobinStacks();
        }
      },

      // ROUND ROBIN: Reorder by games played - collects all players and sorts
      reshuffleByGamesPlayed: () => {
        set((state) => {
          if (!state.session) return state;
          
          const isRoundRobin = state.session.rotationMode === 'round_robin';
          
          if (isRoundRobin) {
            // ROUND ROBIN MODE: Collect from roundRobinStacks + waitingStack
            const playersInGames = new Set<string>();
            state.session.courts.forEach((c) => {
              if (c.currentGame) {
                c.currentGame.team1.forEach((id) => playersInGames.add(id));
                c.currentGame.team2.forEach((id) => playersInGames.add(id));
              }
            });
            
            const customStackPlayerIds = new Set((state.session.customStacks || []).flat());
            const playersInStacks = (state.session.roundRobinStacks || []).flat();
            const playersInWaiting = state.session.waitingStack || [];
            
            // Combine all available player IDs (dedupe)
            const allAvailableIds = [...new Set([...playersInStacks, ...playersInWaiting])];
            
            // Get player objects and sort by games played (least games first)
            const sortedPlayers = allAvailableIds
              .map(id => state.session!.players.find(p => p.id === id))
              .filter((p): p is Player => 
                p !== undefined && 
                p.isActive && 
                p.waitingSince > 0 && 
                !playersInGames.has(p.id) &&
                !customStackPlayerIds.has(p.id)
              )
              .sort((a, b) => a.gamesPlayed - b.gamesPlayed); // Fewer games = higher priority
            
            console.log('[reshuffleByGamesPlayed] sorted players:', sortedPlayers.map(p => `${p.name}(g:${p.gamesPlayed})`));
            
            // Put ALL sorted players into waitingStack (stacks will be rebuilt)
            const newWaitingStack = sortedPlayers.map(p => p.id);
            
            return {
              session: {
                ...state.session,
                waitingStack: newWaitingStack,
                roundRobinStacks: [], // Clear - will be rebuilt by rebuildRoundRobinStacks
                activityLog: [
                  createLogEntry(
                    'stack_moved',
                    `Stacks reordered by games played (${sortedPlayers.length} players)`,
                    {}
                  ),
                  ...state.session.activityLog,
                ],
              },
            };
          } else {
            // WIN-LOSE MODE: Collect from all Win-Lose stacks and rebuild
            const playersInGames = new Set<string>();
            state.session.courts.forEach((c) => {
              if (c.currentGame) {
                c.currentGame.team1.forEach((id) => playersInGames.add(id));
                c.currentGame.team2.forEach((id) => playersInGames.add(id));
              }
            });
            
            const customStackPlayerIds = new Set((state.session.customStacks || []).flat());
            
            // Collect all players from Win-Lose stacks
            const playersInWinnerStacks = (state.session.winnerStacks || []).flat();
            const playersInLoserStacks = (state.session.loserStacks || []).flat();
            const playersInWaitingStacks = (state.session.waitingStacks || []).flat();
            
            const allAvailableIds = [...new Set([
              ...playersInWinnerStacks,
              ...playersInLoserStacks,
              ...playersInWaitingStacks
            ])];
            
            // Get player objects and sort by games played (fewest first)
            const sortedPlayers = allAvailableIds
              .map(id => state.session!.players.find(p => p.id === id))
              .filter((p): p is Player => 
                p !== undefined && 
                p.isActive && 
                !playersInGames.has(p.id) &&
                !customStackPlayerIds.has(p.id)
              )
              .sort((a, b) => a.gamesPlayed - b.gamesPlayed); // Fewer games = higher priority
            
            // Build new waiting stacks (all players go to regular stacks after reorder)
            const newWaitingStacks: string[][] = [];
            for (let i = 0; i < sortedPlayers.length; i += 4) {
              const stack = sortedPlayers.slice(i, i + 4).map(p => p.id);
              newWaitingStacks.push(stack);
            }
            
            return {
              session: {
                ...state.session,
                queue: sortedPlayers.map(p => p.id),
                winnerStack: [],
                loserStack: [],
                waitingStack: sortedPlayers.map(p => p.id),
                // Clear winner/loser stacks, put all in waiting stacks
                winnerStacks: [],
                loserStacks: [],
                waitingStacks: newWaitingStacks,
                lastStackType: undefined, // Reset alternating
                activityLog: [
                  createLogEntry(
                    'stack_moved',
                    `Stacks reordered by games played (${sortedPlayers.length} players)`,
                    {}
                  ),
                  ...state.session.activityLog,
                ],
              },
            };
          }
        });
        // Rebuild Round Robin stacks after reorder (only for Round Robin mode)
        const state = get();
        if (state.session?.rotationMode === 'round_robin') {
          get().rebuildRoundRobinStacks();
        }
      },

      // ROUND ROBIN: Full rebuild of stacks from waitingStack
      // Called by: reorder functions (By Waiting Time, By Games Played, Smart Stack)
      // This REPLACES all roundRobinStacks (but preserves customStacks)
      rebuildRoundRobinStacks: () => {
        set((state) => {
          if (!state.session) return state;
          if (state.session.rotationMode !== 'round_robin') return state;
          
          // Get players currently in games (exclude from rebuild)
          const playersInGames = new Set<string>();
          state.session.courts.forEach((c) => {
            if (c.currentGame) {
              c.currentGame.team1.forEach((id) => playersInGames.add(id));
              c.currentGame.team2.forEach((id) => playersInGames.add(id));
            }
          });
          
          // Collect ALL available players:
          // 1. Players in current roundRobinStacks
          // 2. Players in waitingStack
          // (NOT players in customStacks - those are preserved)
          const customStackPlayerIds = new Set((state.session.customStacks || []).flat());
          const playersInCurrentStacks = (state.session.roundRobinStacks || []).flat();
          const playersInWaiting = state.session.waitingStack || [];
          
          // Combine and dedupe
          const allAvailableIds = [...new Set([...playersInCurrentStacks, ...playersInWaiting])];
          
          // Get player objects, respecting waitingStack order for priority
          // Use waitingStack order as the primary sort (it was sorted by reorder function)
          const waitingStackOrder = new Map(playersInWaiting.map((id, idx) => [id, idx]));
          const stackOrder = new Map(playersInCurrentStacks.map((id, idx) => [id, idx + 1000])); // Lower priority
          
          const availablePlayers = allAvailableIds
            .map(id => state.session!.players.find(p => p.id === id))
            .filter((p): p is Player => 
              p !== undefined && 
              p.isActive && 
              p.waitingSince > 0 && 
              !playersInGames.has(p.id) &&
              !customStackPlayerIds.has(p.id)
            )
            .sort((a, b) => {
              const orderA = waitingStackOrder.get(a.id) ?? stackOrder.get(a.id) ?? 9999;
              const orderB = waitingStackOrder.get(b.id) ?? stackOrder.get(b.id) ?? 9999;
              return orderA - orderB;
            });
          
          console.log('[rebuildRoundRobinStacks] availablePlayers (sorted):', availablePlayers.length, availablePlayers.map(p => p.name));
          
          // Get number of available courts to determine how many stacks to build
          const availableCourts = state.session.courts.filter(c => c.status === 'available').length;
          const stacksNeeded = Math.max(1, availableCourts);
          
          console.log('[rebuildRoundRobinStacks] availableCourts:', availableCourts, 'stacksNeeded:', stacksNeeded);
          
          // Build stacks using the Round Robin algorithm
          const newStacks: string[][] = [];
          let remainingPlayers = [...availablePlayers];
          const usedPlayerIds: string[] = [];
          
          for (let i = 0; i < stacksNeeded && remainingPlayers.length >= 4; i++) {
            // Use respectOrder: true to take players in the sorted order from reorder functions
            const stack = buildRoundRobinStack(remainingPlayers, state.session.matchHistory || [], true);
            console.log('[rebuildRoundRobinStacks] built stack:', stack);
            if (stack) {
              newStacks.push(stack);
              usedPlayerIds.push(...stack);
              const usedIds = new Set(stack);
              remainingPlayers = remainingPlayers.filter(p => !usedIds.has(p.id));
            } else {
              break;
            }
          }
          
          // Remaining players go back to waitingStack
          const newWaitingStack = remainingPlayers.map(p => p.id);
          
          console.log('[rebuildRoundRobinStacks] final stacks:', newStacks.length, 'remaining waiting:', newWaitingStack.length);
          
          return {
            session: {
              ...state.session,
              roundRobinStacks: newStacks,
              waitingStack: newWaitingStack,
            },
          };
        });
      },

      // ROUND ROBIN: Add new stacks from waitingStack without touching existing stacks
      // Called after: startGame, endGame, cancelGame, addPlayer, removePlayer
      addNewRoundRobinStacks: () => {
        set((state) => {
          if (!state.session) return state;
          if (state.session.rotationMode !== 'round_robin') return state;
          
          // Get players already in existing stacks (these are untouchable)
          const playersInStacks = new Set((state.session.roundRobinStacks || []).flat());
          const customStackPlayerIds = new Set((state.session.customStacks || []).flat());
          
          // Get players from waitingStack who are NOT in any stack
          // waitingStack is the source of truth for available players
          const waitingPlayerIds = (state.session.waitingStack || []).filter(id => 
            !playersInStacks.has(id) && 
            !customStackPlayerIds.has(id)
          );
          
          // Get player objects for those IDs
          const availablePlayers = waitingPlayerIds
            .map(id => state.session!.players.find(p => p.id === id))
            .filter((p): p is Player => p !== undefined && p.isActive && p.waitingSince > 0);
          
          console.log('[addNewRoundRobinStacks] availablePlayers from waitingStack:', availablePlayers.length, availablePlayers.map(p => p.name));
          
          // If we don't have 4 players available, don't create new stacks
          if (availablePlayers.length < 4) {
            console.log('[addNewRoundRobinStacks] Not enough players to create new stack');
            return state;
          }
          
          // Calculate how many NEW stacks we need
          // Custom stacks should NOT count toward court allocation
          const existingRoundRobinStackCount = (state.session.roundRobinStacks || []).length;
          const availableCourts = state.session.courts.filter(c => c.status === 'available').length;
          const totalStacksNeeded = Math.max(1, availableCourts);
          const newStacksNeeded = Math.max(0, totalStacksNeeded - existingRoundRobinStackCount);
          
          console.log('[addNewRoundRobinStacks] existingRoundRobinStacks:', existingRoundRobinStackCount, 'newStacksNeeded:', newStacksNeeded);
          
          if (newStacksNeeded <= 0) {
            console.log('[addNewRoundRobinStacks] No new stacks needed');
            return state;
          }
          
          // Build only NEW stacks from available players
          const newStacks: string[][] = [];
          let remainingPlayers = [...availablePlayers];
          const usedPlayerIds: string[] = [];
          
          for (let i = 0; i < newStacksNeeded && remainingPlayers.length >= 4; i++) {
            // Use respectOrder: true to simply take first 4 players (they're already in waitingStack order)
            const stack = buildRoundRobinStack(remainingPlayers, state.session.matchHistory || [], true);
            console.log('[addNewRoundRobinStacks] built new stack:', stack);
            if (stack) {
              newStacks.push(stack);
              usedPlayerIds.push(...stack);
              const usedIds = new Set(stack);
              remainingPlayers = remainingPlayers.filter(p => !usedIds.has(p.id));
            } else {
              break;
            }
          }
          
          // Update roundRobinStacks (append new stacks)
          const updatedStacks = [...(state.session.roundRobinStacks || []), ...newStacks];
          
          // Remove used players from waitingStack (they're now in stacks)
          const usedSet = new Set(usedPlayerIds);
          const updatedWaitingStack = (state.session.waitingStack || []).filter(id => !usedSet.has(id));
          
          console.log('[addNewRoundRobinStacks] final stacks:', updatedStacks.length, 'remaining waiting:', updatedWaitingStack.length);
          
          return {
            session: {
              ...state.session,
              roundRobinStacks: updatedStacks,
              waitingStack: updatedWaitingStack,
            },
          };
        });
      },

      // ROUND ROBIN: Smart rebuild - uses weighted algorithm considering games played, waiting time, match history
      // Collects ALL players from roundRobinStacks + waitingStack, sorts by smart score, rebuilds
      smartRebuildStacks: () => {
        set((state) => {
          if (!state.session) return state;
          if (state.session.rotationMode !== 'round_robin') return state;
          
          // Get players currently in games
          const playersInGames = new Set<string>();
          state.session.courts.forEach((c) => {
            if (c.currentGame) {
              c.currentGame.team1.forEach((id) => playersInGames.add(id));
              c.currentGame.team2.forEach((id) => playersInGames.add(id));
            }
          });
          
          // Collect ALL available players from roundRobinStacks + waitingStack
          const customStackPlayerIds = new Set((state.session.customStacks || []).flat());
          const playersInStacks = (state.session.roundRobinStacks || []).flat();
          const playersInWaiting = state.session.waitingStack || [];
          
          // Combine all available player IDs (dedupe)
          const allAvailableIds = [...new Set([...playersInStacks, ...playersInWaiting])];
          
          // Get player objects
          const availablePlayers = allAvailableIds
            .map(id => state.session!.players.find(p => p.id === id))
            .filter((p): p is Player => 
              p !== undefined && 
              p.isActive && 
              p.waitingSince > 0 && 
              !playersInGames.has(p.id) &&
              !customStackPlayerIds.has(p.id)
            );
          
          console.log('[smartRebuildStacks] availablePlayers:', availablePlayers.length);
          
          // Sort players by smart priority score (lower = higher priority)
          // Factors: games played (fairness), waiting time (prevent starvation), win streak (balance)
          const now = Date.now();
          const scoredPlayers = availablePlayers.map(p => {
            const waitingMinutes = (now - p.waitingSince) / 60000;
            const gamesScore = p.gamesPlayed * 10; // Fewer games = higher priority
            const waitingScore = -waitingMinutes * 2; // Longer wait = higher priority (negative to invert)
            const streakScore = (p.winStreak || 0) * 3; // Win streak = lower priority (let others play)
            
            return {
              player: p,
              score: gamesScore + waitingScore + streakScore,
            };
          }).sort((a, b) => a.score - b.score); // Lower score = higher priority
          
          const sortedPlayers = scoredPlayers.map(sp => sp.player);
          
          console.log('[smartRebuildStacks] sorted by smart score:', sortedPlayers.map(p => `${p.name}(g:${p.gamesPlayed})`));
          
          // Get number of available courts
          const availableCourts = state.session.courts.filter(c => c.status === 'available').length;
          const stacksNeeded = Math.max(1, availableCourts);
          
          // Build stacks using Round Robin algorithm with smart-sorted players
          const newStacks: string[][] = [];
          let remainingPlayers = [...sortedPlayers];
          
          for (let i = 0; i < stacksNeeded && remainingPlayers.length >= 4; i++) {
            // Use respectOrder: true to take players in the smart-sorted order
            const stack = buildRoundRobinStack(remainingPlayers, state.session.matchHistory || [], true);
            console.log('[smartRebuildStacks] built stack:', stack);
            if (stack) {
              newStacks.push(stack);
              const usedIds = new Set(stack);
              remainingPlayers = remainingPlayers.filter(p => !usedIds.has(p.id));
            } else {
              break;
            }
          }
          
          // Remaining players go to waitingStack
          const newWaitingStack = remainingPlayers.map(p => p.id);
          
          console.log('[smartRebuildStacks] final stacks:', newStacks.length, 'remaining waiting:', newWaitingStack.length);
          
          return {
            session: {
              ...state.session,
              waitingStack: newWaitingStack,
              roundRobinStacks: newStacks,
            },
          };
        });
      },

      // ============================================
      // WIN-LOSE STACK FUNCTIONS
      // ============================================

      /**
       * Build Win-Lose stacks from waiting players (FIFO order)
       * Creates stacks of 4, last stack may be forming (<4 players)
       */
      buildWinLoseStacks: () => {
        set((state) => {
          if (!state.session) return state;
          
          
          // Get players in waiting (not in games, not in existing stacks)
          const playersInGames = new Set<string>();
          state.session.courts.forEach((c) => {
            if (c.currentGame) {
              c.currentGame.team1.forEach((id) => playersInGames.add(id));
              c.currentGame.team2.forEach((id) => playersInGames.add(id));
            }
          });
          
          // Get players already in stacks
          const playersInStacks = new Set<string>();
          [...state.session.winnerStacks, ...state.session.loserStacks, ...state.session.waitingStacks].flat().forEach(id => playersInStacks.add(id));
          
          // Available players from waitingStack (FIFO order)
          const availablePlayers = state.session.waitingStack.filter(id => 
            !playersInGames.has(id) && !playersInStacks.has(id)
          );
          
          
          // Build stacks of 4
          const newWaitingStacks: string[][] = [];
          for (let i = 0; i < availablePlayers.length; i += 4) {
            const stack = availablePlayers.slice(i, i + 4);
            newWaitingStacks.push(stack);
          }
          
          
          return {
            session: {
              ...state.session,
              waitingStacks: newWaitingStacks,
            },
          };
        });
      },

      /**
       * Add new Win-Lose stacks - adds new players to forming stacks
       * Priority: Regular forming → Loser forming → Winner forming
       */
      addNewWinLoseStacks: () => {
        set((state) => {
          if (!state.session) return state;
          
          // Only for Win-Lose mode
          if (state.session.rotationMode !== 'win_lose_stack' && state.session.rotationMode !== 'full_rotation') {
            return state;
          }
          
          
          // Get players in games
          const playersInGames = new Set<string>();
          state.session.courts.forEach((c) => {
            if (c.currentGame) {
              c.currentGame.team1.forEach((id) => playersInGames.add(id));
              c.currentGame.team2.forEach((id) => playersInGames.add(id));
            }
          });
          
          // Get players already in stacks
          const playersInStacks = new Set<string>();
          [...state.session.winnerStacks, ...state.session.loserStacks, ...state.session.waitingStacks].flat().forEach(id => playersInStacks.add(id));
          
          // Available players from waitingStack (FIFO order)
          const availablePlayers = state.session.waitingStack.filter(id => 
            !playersInGames.has(id) && !playersInStacks.has(id)
          );
          
          if (availablePlayers.length === 0) {
            return state;
          }
          
          let updatedWaitingStacks = [...state.session.waitingStacks];
          let updatedLoserStacks = [...state.session.loserStacks];
          let updatedWinnerStacks = [...state.session.winnerStacks];
          
          // Process each player
          for (const playerId of availablePlayers) {
            // Priority 1: Check for Regular forming stack
            const regularFormingIdx = updatedWaitingStacks.findIndex(s => s.length < 4);
            if (regularFormingIdx !== -1) {
              updatedWaitingStacks[regularFormingIdx] = [...updatedWaitingStacks[regularFormingIdx], playerId];
              continue;
            }
            
            // Priority 2: Check for Loser forming stack
            const loserFormingIdx = updatedLoserStacks.findIndex(s => s.length < 4);
            if (loserFormingIdx !== -1) {
              updatedLoserStacks[loserFormingIdx] = [...updatedLoserStacks[loserFormingIdx], playerId];
              continue;
            }
            
            // Priority 3: Check for Winner forming stack
            const winnerFormingIdx = updatedWinnerStacks.findIndex(s => s.length < 4);
            if (winnerFormingIdx !== -1) {
              updatedWinnerStacks[winnerFormingIdx] = [...updatedWinnerStacks[winnerFormingIdx], playerId];
              continue;
            }
            
            // No forming stack exists - create new Regular forming stack
            updatedWaitingStacks.push([playerId]);
          }
          
          return {
            session: {
              ...state.session,
              waitingStacks: updatedWaitingStacks,
              loserStacks: updatedLoserStacks,
              winnerStacks: updatedWinnerStacks,
            },
          };
        });
      },

      startGame: (courtId, team1, team2, skippedQueue = false, customStackIndex) => {
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
          
          // For Round Robin: remove the used stack from roundRobinStacks (don't rebuild yet)
          const newRoundRobinStacks = (state.session.roundRobinStacks || []).filter(stack => {
            // Keep stacks that don't contain all the used players
            const stackPlayerSet = new Set(stack);
            const overlap = allPlayerIds.filter(id => stackPlayerSet.has(id));
            return overlap.length < 4; // Only remove if all 4 players match
          });
          
          // Remove custom stack if customStackIndex was provided
          const newCustomStacks = customStackIndex !== undefined
            ? (state.session.customStacks || []).filter((_, idx) => idx !== customStackIndex)
            : state.session.customStacks || [];
          
          // For Win-Lose mode: remove the used stack from winnerStacks/loserStacks/waitingStacks
          const removeStackWithPlayers = (stacks: string[][], playerIds: string[]) => {
            return stacks.filter(stack => {
              const stackPlayerSet = new Set(stack);
              const overlap = playerIds.filter(id => stackPlayerSet.has(id));
              return overlap.length < 4; // Keep stacks that don't have all 4 players
            });
          };
          
          // Determine which stack type these players came from (for alternating)
          let stackTypeUsed: 'winner' | 'loser' | 'regular' | undefined;
          const playerSet = new Set(allPlayerIds);
          
          // Check winner stacks
          for (const stack of state.session.winnerStacks || []) {
            if (stack.length === 4 && stack.every(id => playerSet.has(id))) {
              stackTypeUsed = 'winner';
              break;
            }
          }
          // Check loser stacks
          if (!stackTypeUsed) {
            for (const stack of state.session.loserStacks || []) {
              if (stack.length === 4 && stack.every(id => playerSet.has(id))) {
                stackTypeUsed = 'loser';
                break;
              }
            }
          }
          // Check regular/waiting stacks
          if (!stackTypeUsed) {
            for (const stack of state.session.waitingStacks || []) {
              if (stack.length === 4 && stack.every(id => playerSet.has(id))) {
                stackTypeUsed = 'regular';
                break;
              }
            }
          }
          
          const newWinnerStacks = removeStackWithPlayers(state.session.winnerStacks || [], allPlayerIds);
          const newLoserStacks = removeStackWithPlayers(state.session.loserStacks || [], allPlayerIds);
          const newWaitingStacks = removeStackWithPlayers(state.session.waitingStacks || [], allPlayerIds);
          
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

          // Record match history for Round Robin tracking
          const matchEntry = {
            team1: team1 as [string, string],
            team2: team2 as [string, string],
            timestamp: Date.now(),
            courtId,
          };
          const newMatchHistory = [...(state.session.matchHistory || []), matchEntry];

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
              // Win-Lose stacks
              winnerStacks: newWinnerStacks,
              loserStacks: newLoserStacks,
              waitingStacks: newWaitingStacks,
              lastStackType: stackTypeUsed, // Track for alternating win-lose selection
              // Round Robin stacks
              roundRobinStacks: newRoundRobinStacks, // Remove used stack
              customStacks: newCustomStacks, // Remove used custom stack
              matchHistory: newMatchHistory,
              stackCounter: (state.session.stackCounter ?? 0) + 1, // Increment stack counter
              activityLog: [
                ...logEntries,
                ...state.session.activityLog,
              ],
            },
          };
        });
        // Add new stacks without touching existing ones (players moved out of waiting)
        get().addNewRoundRobinStacks();
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
          
          // Remove all 4 players from Win-Lose stacks first (IMPORTANT for balance!)
          const removePlayersFromStacks = (stacks: string[][]): string[][] => {
            return stacks
              .map(stack => stack.filter(id => !allPlayerIds.includes(id)))
              .filter(stack => stack.length > 0); // Remove empty stacks
          };
          
          // For Round Robin mode, add all players back to waiting stack (no win/lose separation)
          // For Win-Lose Stack mode, create winner/loser stacks with priority logic
          let newWinnerStacks = removePlayersFromStacks(state.session.winnerStacks || []);
          let newLoserStacks = removePlayersFromStacks(state.session.loserStacks || []);
          let newWaitingStacks = removePlayersFromStacks(state.session.waitingStacks || []);
          
          if (rotationMode === 'round_robin') {
            // Round Robin: all players go back to waiting stack at the END (lowest priority)
            newWaitingStack = [...newWaitingStack, ...allPlayerIds];
          } else if (rotationMode === 'win_lose_stack' || rotationMode === 'full_rotation') {
            // Win-Lose Stack: Add losers FIRST, then winners
            // Priority for each player: Same type forming → Any forming → Create new
            
            // Helper function to add player to stacks
            const addPlayerToStacks = (playerId: string, playerType: 'loser' | 'winner') => {
              // Priority 1: Check for forming stack of SAME type
              if (playerType === 'loser') {
                const loserFormingIdx = newLoserStacks.findIndex(s => s.length < 4);
                if (loserFormingIdx !== -1) {
                  newLoserStacks[loserFormingIdx].push(playerId);
                  return;
                }
              } else {
                const winnerFormingIdx = newWinnerStacks.findIndex(s => s.length < 4);
                if (winnerFormingIdx !== -1) {
                  newWinnerStacks[winnerFormingIdx].push(playerId);
                  return;
                }
              }
              
              // Priority 2: Check for Regular forming stack (neutral - can mix with anyone)
              const regularFormingIdx = newWaitingStacks.findIndex(s => s.length < 4);
              if (regularFormingIdx !== -1) {
                newWaitingStacks[regularFormingIdx].push(playerId);
                return;
              }
              
              // Priority 3: Create new forming stack of player's type
              if (playerType === 'loser') {
                newLoserStacks.push([playerId]);
              } else {
                newWinnerStacks.push([playerId]);
              }
            };
            
            // Add LOSERS first
            for (const loserId of losingTeam) {
              addPlayerToStacks(loserId, 'loser');
            }
            
            // Add WINNERS second
            for (const winnerId of winningTeam) {
              addPlayerToStacks(winnerId, 'winner');
            }
            
            // IMPORTANT: Move newly completed stacks to the END of their arrays
            // This maintains FIFO order - stacks that were ready BEFORE should play BEFORE
            const moveCompletedToEnd = (stacks: string[][]): string[][] => {
              const forming = stacks.filter(s => s.length < 4);
              const ready = stacks.filter(s => s.length === 4);
              // Ready stacks stay in their original order, forming stacks at the end
              return [...ready, ...forming];
            };
            
            newWinnerStacks = moveCompletedToEnd(newWinnerStacks);
            newLoserStacks = moveCompletedToEnd(newLoserStacks);
            newWaitingStacks = moveCompletedToEnd(newWaitingStacks);
            
            // DEPRECATED: Also update flat arrays for backward compatibility
            newWinnerStack = [...newWinnerStack, ...winningTeam];
            newLoserStack = [...newLoserStack, ...losingTeam];
          } else {
            // Other modes: add to waiting
            newWaitingStack = [...newWaitingStack, ...allPlayerIds];
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
              // Smart queue stacks (DEPRECATED)
              winnerStack: newWinnerStack,
              loserStack: newLoserStack,
              waitingStack: newWaitingStack,
              // Win-Lose stacks
              winnerStacks: newWinnerStacks,
              loserStacks: newLoserStacks,
              waitingStacks: newWaitingStacks,
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
        // Add new stacks based on mode
        const mode = get().session?.rotationMode;
        if (mode === 'round_robin') {
          get().addNewRoundRobinStacks();
        } else if (mode === 'win_lose_stack' || mode === 'full_rotation') {
          get().addNewWinLoseStacks();
        }
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
        // Add new stacks without touching existing ones (players returned to waiting)
        get().addNewRoundRobinStacks();
      },

      autoAssignNextGame: (courtId) => {
        const state = get();
        if (!state.session) return;

        const court = state.session.courts.find((c) => c.id === courtId);
        if (!court || court.status !== 'available') return;

        let team1: [string, string] | null = null;
        let team2: [string, string] | null = null;
        
        // Get players currently in games
        const playersInGames = new Set<string>();
        state.session.courts.forEach((c) => {
          if (c.currentGame) {
            c.currentGame.team1.forEach((id) => playersInGames.add(id));
            c.currentGame.team2.forEach((id) => playersInGames.add(id));
          }
        });

        // Check if user manually selected specific players for next game
        const nextStackPlayerIds = state.nextStackPlayerIds;
        
        if (nextStackPlayerIds && nextStackPlayerIds.length === 4) {
          // Verify all players are still available (not in a game)
          const availablePlayers = nextStackPlayerIds.filter(id => !playersInGames.has(id));
          if (availablePlayers.length === 4) {
            team1 = [availablePlayers[0], availablePlayers[1]];
            team2 = [availablePlayers[2], availablePlayers[3]];
            // Reset the manual selection after use
            set({ nextStackPlayerIds: null });
          }
        }
        
        // If no manual selection, check rotation mode
        if (!team1 || !team2) {
          const rotationMode = state.session.rotationMode;
          
          // For Round Robin: IGNORE custom stacks, use pre-built roundRobinStacks
          // For other modes: check custom stacks first
          if (rotationMode === 'round_robin') {
            // Round Robin: pull from pre-built roundRobinStacks (first available stack)
            const roundRobinStacks = state.session.roundRobinStacks || [];
            
            for (const stack of roundRobinStacks) {
              // Check if all 4 players in this stack are available
              const allAvailable = stack.every(id => !playersInGames.has(id));
              if (allAvailable && stack.length === 4) {
                team1 = [stack[0], stack[1]];
                team2 = [stack[2], stack[3]];
                break;
              }
            }
          } else if (rotationMode === 'win_lose_stack' || rotationMode === 'full_rotation') {
            // Win-Lose Stack: Regular → Alternating (Win/Lose)
            // NOTE: Custom stacks are IGNORED by autoAssignNextGame - they must be manually started
            
            // Priority 1: Regular stacks (always first before win/lose)
            const regularStacks = state.session.waitingStacks.filter(s => s.length === 4);
            for (const stack of regularStacks) {
              const allAvailable = stack.every(id => !playersInGames.has(id));
              if (allAvailable) {
                team1 = [stack[0], stack[1]];
                team2 = [stack[2], stack[3]];
                break;
              }
            }
            
            // Priority 2: Alternate between Winner and Loser stacks
            if (!team1 || !team2) {
              const lastType = state.session.lastStackType;
              const winnerStacks = state.session.winnerStacks.filter(s => s.length === 4);
              const loserStacks = state.session.loserStacks.filter(s => s.length === 4);
              
              // Helper to find first available stack
              const findAvailableStack = (stacks: string[][]) => {
                for (const stack of stacks) {
                  const allAvailable = stack.every(id => !playersInGames.has(id));
                  if (allAvailable) return stack;
                }
                return null;
              };
              
              // Determine which type to try first based on alternating logic
              // If last was 'loser' or 'regular', try winner first
              // If last was 'winner', try loser first
              // If no last type, try loser first (give losers priority initially)
              const tryWinnerFirst = lastType === 'loser' || lastType === 'regular';
              
              let selectedStack: string[] | null = null;
              
              if (tryWinnerFirst) {
                selectedStack = findAvailableStack(winnerStacks);
                if (!selectedStack) {
                  selectedStack = findAvailableStack(loserStacks);
                }
              } else {
                selectedStack = findAvailableStack(loserStacks);
                if (!selectedStack) {
                  selectedStack = findAvailableStack(winnerStacks);
                }
              }
              
              if (selectedStack) {
                team1 = [selectedStack[0], selectedStack[1]];
                team2 = [selectedStack[2], selectedStack[3]];
              }
            }
          } else {
            // Other modes: check custom stacks first
            const customStacks = state.session.customStacks || [];
            for (const customStack of customStacks) {
              const availableInCustom = customStack.filter(id => !playersInGames.has(id));
              if (availableInCustom.length === 4) {
                team1 = [availableInCustom[0], availableInCustom[1]];
                team2 = [availableInCustom[2], availableInCustom[3]];
                break;
              }
            }
          }
          
          // Fallback to legacy FIFO if no stacks found
          if (!team1 || !team2) {
            if (rotationMode === 'win_lose_stack' || rotationMode === 'full_rotation') {
              // Win-Lose mode: NO FALLBACK - only use pre-built stacks
              // If no ready stack available, game cannot start
              console.log('[autoAssignNextGame] No ready stacks available for Win-Lose mode');
            } else if (state.session.useSmartQueue) {
              // Use smart queue for other modes
              const nextGame = getNextGamePlayers(state.session);
              if (nextGame) {
                team1 = nextGame.team1;
                team2 = nextGame.team2;
              }
            }
          }
        }
        
        // Fallback to legacy FIFO queue logic if still no teams
        if (!team1 || !team2) {
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
          
          // No changes to Win-Lose stacks - player removed from game goes back to waitingStack only
          
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

          // Remove player from queue and all stacks
          const newQueue = state.session.queue.slice(1);
          
          // Remove player from Win-Lose stacks
          const removePlayerFromStacks = (stacks: string[][]): string[][] => {
            return stacks
              .map(stack => stack.filter(id => id !== playerId))
              .filter(stack => stack.length > 0); // Remove empty stacks
          };
          
          const newWinnerStacks = removePlayerFromStacks(state.session.winnerStacks || []);
          const newLoserStacks = removePlayerFromStacks(state.session.loserStacks || []);
          const newWaitingStacks = removePlayerFromStacks(state.session.waitingStacks || []);
          const newRoundRobinStacks = removePlayerFromStacks(state.session.roundRobinStacks || []);
          const newCustomStacks = removePlayerFromStacks(state.session.customStacks || []);
          
          // Remove from flat arrays
          const newWaitingStack = state.session.waitingStack.filter(id => id !== playerId);
          const newWinnerStack = state.session.winnerStack.filter(id => id !== playerId);
          const newLoserStack = state.session.loserStack.filter(id => id !== playerId);
          
          // Update player's waitingSince to 0 (in game)
          const updatedPlayers = state.session.players.map(p => 
            p.id === playerId ? { ...p, waitingSince: 0 } : p
          );

          // Create log entry
          const logEntry = createLogEntry(
            'player_added',
            `${player?.name || 'Player'} pulled from queue to ${court.name}`
          );

          return {
            session: {
              ...state.session,
              queue: newQueue,
              players: updatedPlayers,
              // Flat arrays
              waitingStack: newWaitingStack,
              winnerStack: newWinnerStack,
              loserStack: newLoserStack,
              // Win-Lose stacks
              winnerStacks: newWinnerStacks,
              loserStacks: newLoserStacks,
              waitingStacks: newWaitingStacks,
              // Round Robin stacks
              roundRobinStacks: newRoundRobinStacks,
              customStacks: newCustomStacks,
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

          // SWAP players: Replace new player with old player in stacks
          const swapPlayerInStacks = (stacks: string[][]): string[][] => {
            return stacks.map(stack => 
              stack.map(id => id === newPlayerId ? oldPlayerId : id)
            );
          };
          
          const newWinnerStacks = swapPlayerInStacks(state.session.winnerStacks || []);
          const newLoserStacks = swapPlayerInStacks(state.session.loserStacks || []);
          const newWaitingStacks = swapPlayerInStacks(state.session.waitingStacks || []);
          const newRoundRobinStacks = swapPlayerInStacks(state.session.roundRobinStacks || []);
          const newCustomStacks = swapPlayerInStacks(state.session.customStacks || []);
          
          // Swap in flat arrays
          const newQueue = state.session.queue.map(id => id === newPlayerId ? oldPlayerId : id);
          const newWinnerStack = state.session.winnerStack.map(id => id === newPlayerId ? oldPlayerId : id);
          const newLoserStack = state.session.loserStack.map(id => id === newPlayerId ? oldPlayerId : id);
          const newWaitingStack = state.session.waitingStack.map(id => id === newPlayerId ? oldPlayerId : id);

          // Update waitingSince for both players
          // For swapped-out player: preserve their original waiting time from the new player
          // This ensures they don't lose their queue position unfairly
          const newPlayerWaitingSince = newPlayer.waitingSince;
          const updatedPlayers = state.session.players.map(p => {
            if (p.id === newPlayerId) {
              return { ...p, waitingSince: 0 }; // In game now
            }
            if (p.id === oldPlayerId) {
              // Inherit the waiting time from the player who replaced them
              // This is fair because the swapped-out player was already playing
              return { ...p, waitingSince: newPlayerWaitingSince || Date.now() };
            }
            return p;
          });

          return {
            session: {
              ...state.session,
              queue: newQueue,
              winnerStack: newWinnerStack,
              loserStack: newLoserStack,
              waitingStack: newWaitingStack,
              // Win-Lose stacks
              winnerStacks: newWinnerStacks,
              loserStacks: newLoserStacks,
              waitingStacks: newWaitingStacks,
              // Round Robin stacks
              roundRobinStacks: newRoundRobinStacks,
              customStacks: newCustomStacks,
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
