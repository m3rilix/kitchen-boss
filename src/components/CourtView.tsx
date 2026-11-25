import { useState, useRef, useEffect } from 'react';
import { useSessionStore } from '@/store/sessionStore';
import { useThemeClasses } from '@/store/themeStore';
import type { Court, Player } from '@/types';
import { isSkillBased, skillOf } from '@/lib/skill';
import { canPullNextStack, useElapsed } from '@/lib/courtFlow';
import { ScoreEntryModal } from './ScoreEntryModal';
import { pickBalancedTeamSplit } from '@/lib/roundRobin';
import { StarRating } from './StarRating';
import { Play, X, Users, Wrench, Pencil, Check, UserPlus, UserMinus, ChevronDown, Timer, RotateCcw, SkipForward, ArrowLeftRight } from 'lucide-react';


interface CourtViewProps {
  court: Court;
}

interface StackDragData {
  source: 'stack';
  playerIds: string[];
  stackLabel: string;
}

export function CourtView({ court }: CourtViewProps) {
  const {
    session,
    getPlayerById,
    cancelGame,
    autoAssignNextGame,
    setCourtStatus,
    removeCourt,
    renameCourt,
    removePlayerFromGame,
    replacePlayerInGame,
    swapPlayers,
    assignGame,
    startCourtGame,
    returnToReady,
  } = useSessionStore();
  const theme = useThemeClasses();
  
  const [draggedPlayer, setDraggedPlayer] = useState<{ team: 'team1' | 'team2'; index: number } | null>(null);
  // Tap-to-swap: touch devices can't do HTML5 drag-and-drop, so tap one player then
  // tap another to swap them — mirrors the desktop drag-and-drop swap behavior.
  const [selectedSlot, setSelectedSlot] = useState<{ team: 'team1' | 'team2'; index: number } | null>(null);
  const [showEndGame, setShowEndGame] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [showMaintenanceMenu, setShowMaintenanceMenu] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [maintenanceMode, _setMaintenanceMode] = useState(false); // Coming soon feature
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(court.name);
  const [courtDragOver, setCourtDragOver] = useState(false);
  const [showPlayerDropdown, setShowPlayerDropdown] = useState<{ team: 'team1' | 'team2'; index: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Get available players from queue (sorted by queue order)
  const availableQueuePlayers = session?.queue
    .map(id => session.players.find(p => p.id === id))
    .filter((p): p is NonNullable<typeof p> => p !== undefined && p.isActive) ?? [];

  // Focus input when editing starts
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  // Live elapsed-time ticker — ticks every second while a game is in progress
  const elapsedTime = useElapsed(court.currentGame?.startedAt);

  const isInGame = court.status === 'in_game' && !!court.currentGame;
  const isReady = court.status === 'ready' && !!court.currentGame;
  const hasMatchup = isInGame || isReady;
  const isMaintenance = court.status === 'maintenance';
  // Swaps are allowed before the game starts (Ready), or mid-game only from the
  // wrench (maintenance) menu — never by accident while a game is being played.
  const isDoubles = session?.rotationMode === 'doubles';
  const canSwap = !isDoubles && (isReady || (isInGame && showMaintenanceMenu));

  // Clear a pending tap-to-swap selection when this court's game changes (new game,
  // ended, or cancelled) or swapping gets locked, so a stale highlight doesn't linger.
  useEffect(() => {
    setSelectedSlot(null);
  }, [court.currentGame?.id, canSwap]);

  if (!session) return null;

  const handleSaveName = () => {
    const trimmedName = editName.trim();
    if (trimmedName && trimmedName !== court.name) {
      renameCourt(court.id, trimmedName);
    } else {
      setEditName(court.name); // Reset if empty
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveName();
    } else if (e.key === 'Escape') {
      setEditName(court.name);
      setIsEditing(false);
    }
  };


  const team1Players = court.currentGame?.team1.map(id => getPlayerById(id));
  const team2Players = court.currentGame?.team2.map(id => getPlayerById(id));

  const skillMode   = isSkillBased(session.rotationMode);
  const teamSkill = (players?: (Player | undefined)[]) =>
    (players ?? []).reduce((sum, p) => sum + (p ? skillOf(p) : 0), 0);

  // Same check the Next button relies on (Win-Lose: the shared play order)
  const canPullNext = canPullNextStack(session);

  /** Next: pull the next queued stack onto this court as Ready (clock not running yet). */
  const handleNext = () => {
    autoAssignNextGame(court.id);
  };

  // Players who could be swapped in from the queue/stacks: active, available, not on any court
  const playersOnCourts = new Set(
    session.courts.flatMap(c => (c.currentGame ? [...c.currentGame.team1, ...c.currentGame.team2] : []))
  );
  const queueOrder = new Map(session.queue.map((id, i) => [id, i]));
  const replacementCandidates = session.players
    .filter(p => p.isActive && !p.unavailable && !playersOnCourts.has(p.id))
    .sort((a, b) => (queueOrder.get(a.id) ?? Infinity) - (queueOrder.get(b.id) ?? Infinity));
  const selectedPlayerId = selectedSlot && court.currentGame ? court.currentGame[selectedSlot.team][selectedSlot.index] : undefined;
  const selectedPlayer = selectedPlayerId ? getPlayerById(selectedPlayerId) : undefined;

  const handleOpenEndGame = () => setShowEndGame(true);

  // Tap-to-swap fallback for touch devices (HTML5 drag-and-drop doesn't fire on touch).
  // First tap selects a player; a second tap on a different slot swaps them; tapping
  // the same slot again deselects it.
  const handleSlotTap = (team: 'team1' | 'team2', index: number) => {
    if (!canSwap) return;
    if (!selectedSlot) {
      setSelectedSlot({ team, index });
      return;
    }
    if (selectedSlot.team === team && selectedSlot.index === index) {
      setSelectedSlot(null);
      return;
    }
    swapPlayers(court.id, selectedSlot.team, selectedSlot.index, team, index);
    setSelectedSlot(null);
  };

  return (
    <div className={`bg-white dark:bg-slate-800 rounded-xl border-2 transition-all ${
      isInGame ? `border-[3px] ${theme.border} ring-4 ${theme.badgeRing} shadow-lg` :
      isReady ? 'border-amber-300 dark:border-amber-600' :
      isMaintenance ? 'border-orange-300 bg-orange-50 dark:bg-orange-900/20' :
      'border-slate-200 dark:border-slate-700'
    }`}>
      {/* Header */}
      <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-slate-100 dark:border-slate-700">
        <div className="flex items-center gap-2">
          {isMaintenance && isEditing ? (
            <div className="flex items-center gap-1">
              <input
                ref={inputRef}
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={handleKeyDown}
                onBlur={handleSaveName}
                className="px-2 py-1 text-sm font-semibold border border-orange-300 rounded focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none bg-white dark:border-orange-800 dark:bg-slate-800"
                style={{ width: `${Math.max(editName.length, 8)}ch` }}
              />
              <button
                onClick={handleSaveName}
                className="p-1 text-green-600 hover:text-green-700 dark:text-green-300"
                title="Save"
              >
                <Check className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1">
              <h3 className="font-semibold text-slate-800 dark:text-slate-100">{court.name}</h3>
              {isMaintenance && (
                <button
                  onClick={() => {
                    setEditName(court.name);
                    setIsEditing(true);
                  }}
                  className="p-1 text-slate-400 hover:text-orange-500 transition"
                  title="Rename court"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}
          {isInGame && (
            <>
              <span className="px-2 py-0.5 text-xs font-bold bg-red-600 text-white border border-red-700 rounded-full flex items-center gap-1 animate-pulse">
                <span className="w-2 h-2 bg-white rounded-full" />
                LIVE
              </span>
              <span className="flex items-center gap-1 text-xs font-semibold text-slate-600 dark:text-slate-300 tabular-nums">
                <Timer className="w-3.5 h-3.5 text-slate-400" />
                {elapsedTime}
              </span>
            </>
          )}
          {isReady && (
            <span className="px-2 py-0.5 text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border border-amber-300 dark:border-amber-700 rounded-full">
              READY
            </span>
          )}
          {isMaintenance && (
            <span className="px-2 py-0.5 text-xs font-medium bg-orange-100 text-orange-700 rounded-full flex items-center gap-1 dark:bg-orange-900/30 dark:text-orange-300">
              <Wrench className="w-3 h-3" />
              Maintenance
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {/* Maintenance button - only when the court is empty */}
          {!isMaintenance && !hasMatchup && (
            <button
              onClick={() => setCourtStatus(court.id, 'maintenance')}
              className="p-1.5 text-slate-400 hover:text-orange-500 transition"
              title="Mark Maintenance"
            >
              <Wrench className="w-4 h-4" />
            </button>
          )}
          {isMaintenance && (
            <button
              onClick={() => setCourtStatus(court.id, 'available')}
              className="p-1.5 text-green-500 hover:text-green-600 transition"
              title="Mark Available"
            >
              <Check className="w-4 h-4" />
            </button>
          )}
          {session.courts.length > 1 && !hasMatchup && (
            <button
              onClick={() => removeCourt(court.id)}
              className="p-1.5 text-slate-400 hover:text-red-500 transition"
              title="Remove Court"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-3">
        {hasMatchup && team1Players && team2Players ? (
          <div className="space-y-2">
            {/* Maintenance Mode Toggle */}
            {maintenanceMode && (
              <div className="text-xs text-center text-orange-600 bg-orange-50 py-1 px-2 rounded-lg border border-orange-200 dark:text-orange-300 dark:bg-orange-900/20 dark:border-orange-800">
                Maintenance Mode: Remove or add players
              </div>
            )}
            
            {/* Teams Display */}
            <div className="grid grid-cols-2 gap-2">
              {/* Team 1 */}
              <div className="space-y-1">
                <div className="text-[10px] font-medium text-slate-500 uppercase tracking-wide dark:text-slate-400">
                  Team 1{skillMode && <span className="ml-1 normal-case text-amber-600 dark:text-amber-300">★ {teamSkill(team1Players)}</span>}
                </div>
                {court.currentGame?.team1.map((playerId, i) => {
                  const player = playerId ? getPlayerById(playerId) : null;
                  const isEmpty = !playerId || playerId === '';
                  
                  if (isEmpty) {
                    // Empty slot - show dropdown to select player
                    const isDropdownOpen = showPlayerDropdown?.team === 'team1' && showPlayerDropdown?.index === i;
                    return (
                      <div
                        key={i}
                        className="relative flex items-center gap-1.5 p-1 bg-slate-100 rounded-lg border-2 border-dashed border-slate-300 min-h-[34px] dark:bg-slate-700 dark:border-slate-600"
                      >
                        {availableQueuePlayers.length > 0 ? (
                          <>
                            <div className="w-6 h-6 bg-slate-200 rounded-full flex items-center justify-center text-slate-400 flex-shrink-0 border-2 border-dashed border-slate-300 dark:bg-slate-600 dark:border-slate-600">
                              <UserPlus className="w-3.5 h-3.5" />
                            </div>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setShowPlayerDropdown(isDropdownOpen ? null : { team: 'team1', index: i });
                              }}
                              className="flex-1 flex items-center justify-between text-xs text-blue-600 hover:text-blue-700 font-medium dark:text-blue-300"
                            >
                              <span>Select player</span>
                              <ChevronDown className={`w-4 h-4 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
                            </button>
                            {isDropdownOpen && (
                              <div 
                                ref={dropdownRef} 
                                className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 z-[100] max-h-48 overflow-y-auto"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {availableQueuePlayers.map((player) => (
                                  <button
                                    type="button"
                                    key={player.id}
                                    onMouseDown={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      replacePlayerInGame(court.id, 'team1', i, player.id);
                                      setShowPlayerDropdown(null);
                                    }}
                                    className="w-full px-3 py-2 text-left text-sm hover:bg-blue-50 dark:hover:bg-slate-700 flex items-center gap-2 cursor-pointer"
                                  >
                                    <div className="w-8 h-8 bg-blue-200 rounded-full flex items-center justify-center text-blue-700 font-semibold text-sm dark:bg-blue-800/50 dark:text-blue-300">
                                      {player.name.charAt(0).toUpperCase()}
                                    </div>
                                    <span className="truncate">{player.name}</span>
                                  </button>
                                ))}
                              </div>
                            )}
                          </>
                        ) : (
                          <>
                            <div className="w-6 h-6 bg-slate-200 rounded-full flex items-center justify-center text-slate-400 flex-shrink-0 border-2 border-dashed border-slate-300 dark:bg-slate-600 dark:border-slate-600">
                              <UserPlus className="w-3.5 h-3.5" />
                            </div>
                            <span className="text-xs text-slate-400">Empty slot</span>
                          </>
                        )}
                      </div>
                    );
                  }
                  
                  const isDragTarget = draggedPlayer !== null && !(draggedPlayer.team === 'team1' && draggedPlayer.index === i);
                  const isSelected = selectedSlot?.team === 'team1' && selectedSlot?.index === i;
                  return (
                    <div
                      key={i}
                      draggable={canSwap}
                      onDragStart={() => canSwap && setDraggedPlayer({ team: 'team1', index: i })}
                      onDragEnd={() => setDraggedPlayer(null)}
                      onDragOver={(e) => { if (canSwap && isDragTarget) e.preventDefault(); }}
                      onDrop={(e) => {
                        e.preventDefault();
                        if (canSwap && draggedPlayer) {
                          swapPlayers(court.id, draggedPlayer.team, draggedPlayer.index, 'team1', i);
                          setDraggedPlayer(null);
                        }
                      }}
                      onClick={() => handleSlotTap('team1', i)}
                      className={`flex items-center gap-1.5 p-1 rounded-lg transition-all ${
                        isSelected ? 'bg-blue-200 ring-2 ring-blue-500 dark:bg-blue-800/50' :
                        isDragTarget && draggedPlayer ? 'bg-blue-100 ring-2 ring-blue-300 dark:bg-blue-900/30' : 'bg-blue-50 dark:bg-blue-900/20'
                      } ${canSwap ? 'cursor-pointer active:cursor-grabbing' : ''}`}
                      title={canSwap ? 'Tap to select, then tap another player to swap or pick a replacement' : undefined}
                    >
                      <div className="w-6 h-6 bg-blue-200 rounded-full flex items-center justify-center text-blue-700 font-semibold text-[10px] flex-shrink-0 dark:bg-blue-800/50 dark:text-blue-300">
                        {player?.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-xs font-medium text-slate-700 dark:text-slate-200 truncate flex-1">{player?.name}</span>
                      {skillMode && player && <StarRating value={skillOf(player)} size="xs" />}
                      {maintenanceMode && (
                        <button
                          onClick={(e) => { e.stopPropagation(); removePlayerFromGame(court.id, 'team1', i); }}
                          className="p-0.5 text-red-400 hover:text-red-600 hover:bg-red-100 rounded transition dark:hover:bg-red-900/40"
                          title="Remove player"
                        >
                          <UserMinus className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Team 2 */}
              <div className="space-y-1">
                <div className="text-[10px] font-medium text-slate-500 uppercase tracking-wide dark:text-slate-400">
                  Team 2{skillMode && <span className="ml-1 normal-case text-amber-600 dark:text-amber-300">★ {teamSkill(team2Players)}</span>}
                </div>
                {court.currentGame?.team2.map((playerId, i) => {
                  const player = playerId ? getPlayerById(playerId) : null;
                  const isEmpty = !playerId || playerId === '';
                  
                  if (isEmpty) {
                    // Empty slot - show dropdown to select player
                    const isDropdownOpen = showPlayerDropdown?.team === 'team2' && showPlayerDropdown?.index === i;
                    return (
                      <div
                        key={i}
                        className="relative flex items-center gap-1.5 p-1 bg-slate-100 rounded-lg border-2 border-dashed border-slate-300 min-h-[34px] dark:bg-slate-700 dark:border-slate-600"
                      >
                        {availableQueuePlayers.length > 0 ? (
                          <>
                            <div className="w-6 h-6 bg-slate-200 rounded-full flex items-center justify-center text-slate-400 flex-shrink-0 border-2 border-dashed border-slate-300 dark:bg-slate-600 dark:border-slate-600">
                              <UserPlus className="w-3.5 h-3.5" />
                            </div>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setShowPlayerDropdown(isDropdownOpen ? null : { team: 'team2', index: i });
                              }}
                              className="flex-1 flex items-center justify-between text-xs text-red-600 hover:text-red-700 font-medium dark:text-red-300"
                            >
                              <span>Select player</span>
                              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
                            </button>
                            {isDropdownOpen && (
                              <div 
                                ref={dropdownRef} 
                                className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 z-[100] max-h-48 overflow-y-auto"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {availableQueuePlayers.map((player) => (
                                  <button
                                    type="button"
                                    key={player.id}
                                    onMouseDown={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      replacePlayerInGame(court.id, 'team2', i, player.id);
                                      setShowPlayerDropdown(null);
                                    }}
                                    className="w-full px-2 py-1.5 text-left text-xs hover:bg-red-50 dark:hover:bg-slate-700 flex items-center gap-2 cursor-pointer"
                                  >
                                    <div className="w-6 h-6 bg-red-200 rounded-full flex items-center justify-center text-red-700 font-semibold text-[10px] dark:bg-red-800/50 dark:text-red-300">
                                      {player.name.charAt(0).toUpperCase()}
                                    </div>
                                    <span className="truncate">{player.name}</span>
                                  </button>
                                ))}
                              </div>
                            )}
                          </>
                        ) : (
                          <>
                            <div className="w-6 h-6 bg-slate-200 rounded-full flex items-center justify-center text-slate-400 flex-shrink-0 border-2 border-dashed border-slate-300 dark:bg-slate-600 dark:border-slate-600">
                              <UserPlus className="w-3.5 h-3.5" />
                            </div>
                            <span className="text-xs text-slate-400">Empty slot</span>
                          </>
                        )}
                      </div>
                    );
                  }
                  
                  const isDragTarget = draggedPlayer !== null && !(draggedPlayer.team === 'team2' && draggedPlayer.index === i);
                  const isSelected = selectedSlot?.team === 'team2' && selectedSlot?.index === i;
                  return (
                    <div
                      key={i}
                      draggable={canSwap}
                      onDragStart={() => canSwap && setDraggedPlayer({ team: 'team2', index: i })}
                      onDragEnd={() => setDraggedPlayer(null)}
                      onDragOver={(e) => { if (canSwap && isDragTarget) e.preventDefault(); }}
                      onDrop={(e) => {
                        e.preventDefault();
                        if (canSwap && draggedPlayer) {
                          swapPlayers(court.id, draggedPlayer.team, draggedPlayer.index, 'team2', i);
                          setDraggedPlayer(null);
                        }
                      }}
                      onClick={() => handleSlotTap('team2', i)}
                      className={`flex items-center gap-1.5 p-1 rounded-lg transition-all ${
                        isSelected ? 'bg-red-200 ring-2 ring-red-500 dark:bg-red-800/50' :
                        isDragTarget && draggedPlayer ? 'bg-red-100 ring-2 ring-red-300 dark:bg-red-900/30' : 'bg-red-50 dark:bg-red-900/20'
                      } ${canSwap ? 'cursor-pointer active:cursor-grabbing' : ''}`}
                      title={canSwap ? 'Tap to select, then tap another player to swap or pick a replacement' : undefined}
                    >
                      <div className="w-6 h-6 bg-red-200 rounded-full flex items-center justify-center text-red-700 font-semibold text-[10px] flex-shrink-0 dark:bg-red-800/50 dark:text-red-300">
                        {player?.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-xs font-medium text-slate-700 dark:text-slate-200 truncate flex-1">{player?.name}</span>
                      {skillMode && player && <StarRating value={skillOf(player)} size="xs" />}
                      {maintenanceMode && (
                        <button
                          onClick={(e) => { e.stopPropagation(); removePlayerFromGame(court.id, 'team2', i); }}
                          className="p-0.5 text-red-400 hover:text-red-600 hover:bg-red-100 rounded transition dark:hover:bg-red-900/40"
                          title="Remove player"
                        >
                          <UserMinus className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Swap hint / replace-from-queue picker */}
            {canSwap && (
              selectedPlayer ? (
                <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600">
                  <ArrowLeftRight className="w-4 h-4 text-slate-400 shrink-0" />
                  <select
                    value=""
                    onChange={(e) => {
                      if (!e.target.value || !selectedSlot) return;
                      replacePlayerInGame(court.id, selectedSlot.team, selectedSlot.index, e.target.value);
                      setSelectedSlot(null);
                    }}
                    disabled={replacementCandidates.length === 0}
                    aria-label={`Replace ${selectedPlayer.name} with a waiting player`}
                    className="flex-1 min-w-0 py-1.5 px-2 text-xs rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200"
                  >
                    <option value="">
                      {replacementCandidates.length === 0 ? 'No waiting players' : `Replace ${selectedPlayer.name} with…`}
                    </option>
                    {replacementCandidates.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
              ) : (
                <p className="text-[11px] text-center text-slate-400">
                  Tap a player to swap positions or replace them from the queue
                </p>
              )
            )}

            {/* Game Controls */}
            {!showCancelConfirm && !showMaintenanceMenu ? (
              isReady ? (
                <div className="flex gap-2">
                  <button
                    onClick={() => startCourtGame(court.id)}
                    disabled={[...court.currentGame!.team1, ...court.currentGame!.team2].some(id => !id)}
                    className={`flex-1 inline-flex items-center justify-center gap-2 py-2 text-sm font-semibold text-white ${theme.bg600} rounded-lg hover:opacity-90 transition disabled:opacity-40`}
                  >
                    <Play className="w-4 h-4" />
                    Start
                  </button>
                  <button
                    onClick={() => setShowCancelConfirm(true)}
                    className="px-3 py-2 text-sm font-medium text-red-600 bg-red-50 dark:bg-red-900/20 rounded-lg hover:bg-red-100 transition inline-flex items-center gap-1 dark:text-red-300 dark:hover:bg-red-900/40"
                    title="Cancel: send these players back to the front of the queue"
                  >
                    <X className="w-4 h-4" />
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="flex gap-1.5">
                  <button
                    onClick={handleOpenEndGame}
                    className="flex-1 py-2 text-sm font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition dark:text-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600"
                  >
                    End Game
                  </button>
                  <button
                    onClick={() => returnToReady(court.id)}
                    className="px-2.5 py-2 text-xs font-medium text-amber-700 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-300 rounded-lg hover:bg-amber-100 transition inline-flex items-center gap-1 dark:hover:bg-amber-900/40"
                    title="Return to Ready: stop the game, keep these players, reset the timer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Ready
                  </button>
                  <button
                    onClick={() => setShowCancelConfirm(true)}
                    className="px-2.5 py-2 text-xs font-medium text-red-600 bg-red-50 dark:bg-red-900/20 rounded-lg hover:bg-red-100 transition inline-flex items-center gap-1 dark:text-red-300 dark:hover:bg-red-900/40"
                    title="Cancel Game: no result, players go back to the front of the queue"
                  >
                    <X className="w-3.5 h-3.5" />
                    Cancel
                  </button>
                  <button
                    onClick={() => setShowMaintenanceMenu(true)}
                    className="px-2.5 py-2 text-sm font-medium text-orange-600 bg-orange-50 rounded-lg hover:bg-orange-100 transition dark:text-orange-300 dark:bg-orange-900/20 dark:hover:bg-orange-900/40"
                    title="Maintenance: rename court, swap players"
                  >
                    <Wrench className="w-4 h-4" />
                  </button>
                </div>
              )
            ) : showMaintenanceMenu ? (
              <div className="space-y-2 p-3 bg-orange-50 rounded-lg border border-orange-100 dark:bg-orange-900/20 dark:border-orange-800">
                <p className="text-sm text-center text-orange-700 font-medium dark:text-orange-300">
                  {maintenanceMode ? 'Player Edit Mode Active' : 'Maintenance Options'}
                </p>
                
                {/* Edit Court Name - hide while in player edit mode */}
                {!maintenanceMode && (
                  isEditing ? (
                    <div className="flex items-center gap-2">
                      <input
                        ref={inputRef}
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={handleKeyDown}
                        className="flex-1 px-3 py-2 text-sm border border-orange-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none dark:border-orange-800"
                        placeholder="Court name"
                      />
                      <button
                        onClick={() => {
                          handleSaveName();
                          setShowMaintenanceMenu(false);
                        }}
                        className="px-3 py-2 text-sm font-medium text-white bg-orange-500 rounded-lg hover:bg-orange-600 transition"
                      >
                        Save
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        setEditName(court.name);
                        setIsEditing(true);
                      }}
                      className="w-full py-2 text-sm font-medium text-orange-700 bg-white border border-orange-200 rounded-lg hover:bg-orange-100 transition flex items-center justify-center gap-2 dark:text-orange-300 dark:bg-slate-800 dark:border-orange-800 dark:hover:bg-orange-900/40"
                    >
                      <Pencil className="w-4 h-4" />
                      Rename Court
                    </button>
                  )
                )}
                
                {/* Toggle Maintenance Mode - Add/Remove Players (Coming Soon) */}
                <button
                  disabled
                  className="w-full py-2 text-sm font-medium rounded-lg transition flex items-center justify-center gap-2 text-slate-400 bg-slate-100 border border-slate-200 cursor-not-allowed dark:bg-slate-700 dark:border-slate-700"
                  title="Coming soon"
                >
                  <UserMinus className="w-4 h-4" />
                  Add/Remove Players
                  <span className="text-xs">(Soon)</span>
                </button>

                {!isDoubles && (
                  <p className="text-xs text-center text-orange-700/80">Player swapping is unlocked while this menu is open</p>
                )}

                {!maintenanceMode && (
                  <button
                    onClick={() => {
                      setShowMaintenanceMenu(false);
                      setIsEditing(false);
                    }}
                    className="w-full py-1 text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400"
                  >
                    Done
                  </button>
                )}
              </div>
            ) : showCancelConfirm ? (
              <div className="space-y-2 p-3 bg-red-50 rounded-lg border border-red-100 dark:bg-red-900/20 dark:border-red-800">
                <p className="text-sm text-center text-red-700 font-medium dark:text-red-300">{isReady ? 'Clear this court?' : 'Cancel this game?'}</p>
                <p className="text-xs text-center text-red-600 dark:text-red-300">No result is recorded. Players go back to the front of the queue.</p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      cancelGame(court.id);
                      setShowCancelConfirm(false);
                    }}
                    className="py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition"
                  >
                    Yes, Cancel
                  </button>
                  <button
                    onClick={() => setShowCancelConfirm(false)}
                    className="py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition dark:text-slate-300 dark:bg-slate-800 dark:border-slate-700 dark:hover:bg-slate-700"
                  >
                    No, Continue
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="text-center py-4">
            {isMaintenance ? (
              <div className="space-y-1">
                <Wrench className="w-6 h-6 text-orange-400 mx-auto" />
                <p className="text-sm text-orange-600 dark:text-orange-300">Court under maintenance</p>
              </div>
            ) : canPullNext ? (
              <div 
                className={`space-y-2 p-3 rounded-lg transition-all ${
                  courtDragOver ? 'bg-blue-50 dark:bg-blue-900/20 ring-2 ring-blue-400' : ''
                }`}
                onDragOver={(e) => {
                  e.preventDefault();
                  const data = e.dataTransfer.types.includes('application/json');
                  if (data) setCourtDragOver(true);
                }}
                onDragLeave={() => setCourtDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setCourtDragOver(false);
                  try {
                    const data = JSON.parse(e.dataTransfer.getData('application/json'));
                    if (data.source === 'stack' && data.playerIds?.length === 4) {
                      const stackData = data as StackDragData;
                      let ids = stackData.playerIds;
                      if (skillMode) {
                        const four = ids.map(id => getPlayerById(id)).filter((p): p is Player => !!p);
                        if (four.length === 4) {
                          ids = pickBalancedTeamSplit(four as [Player, Player, Player, Player], session.matchHistory);
                        }
                      }
                      assignGame(
                        court.id,
                        [ids[0], ids[1]] as [string, string],
                        [ids[2], ids[3]] as [string, string]
                      );
                    }
                  } catch {
                    // Invalid data
                  }
                }}
              >
                {/* Next: pull the next stack onto this court as Ready */}
                <button
                  onClick={handleNext}
                  className={`w-full inline-flex items-center justify-center gap-2 px-4 py-2 ${theme.bg600} text-white font-medium rounded-lg hover:opacity-90 transition text-sm`}
                >
                  <SkipForward className="w-5 h-5" />
                  Next
                </button>

                {/* Drag hint */}
                <p className="text-xs text-center text-slate-400">
                  Brings the next stack on court, or drag a stack here
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <Users className="w-8 h-8 text-slate-300 mx-auto" />
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  No stack ready
                </p>
                <p className="text-xs text-slate-400">
                  Add players to form a stack of 4
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Score entry pop-up */}
      {showEndGame && court.currentGame && (
        <ScoreEntryModal court={court} onClose={() => setShowEndGame(false)} />
      )}
    </div>
  );
}
