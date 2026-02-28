import { useState, useRef, useEffect } from 'react';
import { useSessionStore } from '@/store/sessionStore';
import { useThemeClasses } from '@/store/themeStore';
import type { Court } from '@/types';
import { Play, Trophy, X, Users, Clock, Wrench, GripVertical, Pencil, Check, UserPlus, UserMinus } from 'lucide-react';

interface CourtViewProps {
  court: Court;
}

interface DragData {
  courtId: string;
  team: 'team1' | 'team2';
  index: number;
  playerId: string;
}

export function CourtView({ court }: CourtViewProps) {
  const { 
    session, 
    getPlayerById, 
    endGame, 
    cancelGame,
    autoAssignNextGame,
    setCourtStatus,
    removeCourt,
    swapPlayers,
    renameCourt,
    removePlayerFromGame,
    pullPlayerToGame
  } = useSessionStore();
  const theme = useThemeClasses();
  
  const [showEndGame, setShowEndGame] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [showMaintenanceMenu, setShowMaintenanceMenu] = useState(false);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [dragOver, setDragOver] = useState<{ team: 'team1' | 'team2'; index: number } | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(court.name);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when editing starts
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  if (!session) return null;

  const isInGame = court.status === 'in_game' && court.currentGame;
  const isMaintenance = court.status === 'maintenance';

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

  const handleDragStart = (e: React.DragEvent, team: 'team1' | 'team2', index: number, playerId: string) => {
    const dragData: DragData = { courtId: court.id, team, index, playerId };
    e.dataTransfer.setData('application/json', JSON.stringify(dragData));
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, team: 'team1' | 'team2', index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOver({ team, index });
  };

  const handleDragLeave = () => {
    setDragOver(null);
  };

  const handleDrop = (e: React.DragEvent, toTeam: 'team1' | 'team2', toIndex: number) => {
    e.preventDefault();
    setDragOver(null);
    
    try {
      const dragData: DragData = JSON.parse(e.dataTransfer.getData('application/json'));
      
      // Only allow swaps within the same court
      if (dragData.courtId !== court.id) return;
      
      // Don't swap with self
      if (dragData.team === toTeam && dragData.index === toIndex) return;
      
      swapPlayers(court.id, dragData.team, dragData.index, toTeam, toIndex);
    } catch {
      // Invalid drag data
    }
  };

  const team1Players = court.currentGame?.team1.map(id => getPlayerById(id));
  const team2Players = court.currentGame?.team2.map(id => getPlayerById(id));

  const canStartGame = session.queue.length >= 4;

  const handleStartGame = () => {
    autoAssignNextGame(court.id);
  };

  const handleEndGame = (winner: 'team1' | 'team2') => {
    endGame(court.id, winner);
    setShowEndGame(false);
  };

  return (
    <div className={`bg-white dark:bg-slate-800 rounded-xl border-2 transition-all ${
      isInGame ? `${theme.border}` : 
      isMaintenance ? 'border-orange-300 bg-orange-50 dark:bg-orange-900/20' :
      'border-slate-200 dark:border-slate-700'
    }`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-100">
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
                className="px-2 py-1 text-sm font-semibold border border-orange-300 rounded focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none bg-white"
                style={{ width: `${Math.max(editName.length, 8)}ch` }}
              />
              <button
                onClick={handleSaveName}
                className="p-1 text-green-600 hover:text-green-700"
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
            <span className={`px-2 py-0.5 text-xs font-medium ${theme.badgeBg} ${theme.badgeText} rounded-full flex items-center gap-1`}>
              <Clock className="w-3 h-3" />
              In Game
            </span>
          )}
          {isMaintenance && (
            <span className="px-2 py-0.5 text-xs font-medium bg-orange-100 text-orange-700 rounded-full flex items-center gap-1">
              <Wrench className="w-3 h-3" />
              Maintenance
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {/* Maintenance button - only show when not in game */}
          {!isMaintenance && !isInGame && (
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
          {session.courts.length > 1 && !isInGame && (
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
      <div className="p-4">
        {isInGame && team1Players && team2Players ? (
          <div className="space-y-4">
            {/* Maintenance Mode Toggle */}
            {maintenanceMode && (
              <div className="text-xs text-center text-orange-600 bg-orange-50 py-1 px-2 rounded-lg border border-orange-200">
                Maintenance Mode: Remove or add players
              </div>
            )}
            
            {/* Teams Display */}
            <div className="grid grid-cols-2 gap-4">
              {/* Team 1 */}
              <div className="space-y-2">
                <div className="text-xs font-medium text-slate-500 uppercase tracking-wide">Team 1</div>
                {court.currentGame?.team1.map((playerId, i) => {
                  const player = playerId ? getPlayerById(playerId) : null;
                  const isEmpty = !playerId || playerId === '';
                  
                  if (isEmpty) {
                    // Empty slot - show pull from queue button
                    return (
                      <div
                        key={i}
                        className="flex items-center justify-center gap-2 p-2 bg-slate-100 rounded-lg border-2 border-dashed border-slate-300"
                      >
                        {session && session.queue.length > 0 ? (
                          <button
                            onClick={() => pullPlayerToGame(court.id, 'team1', i)}
                            className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium"
                          >
                            <UserPlus className="w-4 h-4" />
                            Pull from queue
                          </button>
                        ) : (
                          <span className="text-xs text-slate-400">Empty slot</span>
                        )}
                      </div>
                    );
                  }
                  
                  return (
                    <div
                      key={i}
                      draggable={!maintenanceMode}
                      onDragStart={(e) => !maintenanceMode && handleDragStart(e, 'team1', i, playerId)}
                      onDragOver={(e) => handleDragOver(e, 'team1', i)}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDrop(e, 'team1', i)}
                      className={`flex items-center gap-2 p-2 bg-blue-50 rounded-lg transition-all ${
                        maintenanceMode ? '' : 'cursor-grab active:cursor-grabbing'
                      } ${
                        dragOver?.team === 'team1' && dragOver?.index === i
                          ? 'ring-2 ring-blue-400 ring-offset-1 bg-blue-100'
                          : 'hover:bg-blue-100'
                      }`}
                    >
                      {!maintenanceMode && <GripVertical className="w-4 h-4 text-blue-300 flex-shrink-0" />}
                      <div className="w-8 h-8 bg-blue-200 rounded-full flex items-center justify-center text-blue-700 font-semibold text-sm flex-shrink-0">
                        {player?.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-sm font-medium text-slate-700 truncate flex-1">{player?.name}</span>
                      {maintenanceMode && (
                        <button
                          onClick={() => removePlayerFromGame(court.id, 'team1', i)}
                          className="p-1 text-red-400 hover:text-red-600 hover:bg-red-100 rounded transition"
                          title="Remove player"
                        >
                          <UserMinus className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Team 2 */}
              <div className="space-y-2">
                <div className="text-xs font-medium text-slate-500 uppercase tracking-wide">Team 2</div>
                {court.currentGame?.team2.map((playerId, i) => {
                  const player = playerId ? getPlayerById(playerId) : null;
                  const isEmpty = !playerId || playerId === '';
                  
                  if (isEmpty) {
                    // Empty slot - show pull from queue button
                    return (
                      <div
                        key={i}
                        className="flex items-center justify-center gap-2 p-2 bg-slate-100 rounded-lg border-2 border-dashed border-slate-300"
                      >
                        {session && session.queue.length > 0 ? (
                          <button
                            onClick={() => pullPlayerToGame(court.id, 'team2', i)}
                            className="flex items-center gap-1 text-xs text-red-600 hover:text-red-700 font-medium"
                          >
                            <UserPlus className="w-4 h-4" />
                            Pull from queue
                          </button>
                        ) : (
                          <span className="text-xs text-slate-400">Empty slot</span>
                        )}
                      </div>
                    );
                  }
                  
                  return (
                    <div
                      key={i}
                      draggable={!maintenanceMode}
                      onDragStart={(e) => !maintenanceMode && handleDragStart(e, 'team2', i, playerId)}
                      onDragOver={(e) => handleDragOver(e, 'team2', i)}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDrop(e, 'team2', i)}
                      className={`flex items-center gap-2 p-2 bg-red-50 rounded-lg transition-all ${
                        maintenanceMode ? '' : 'cursor-grab active:cursor-grabbing'
                      } ${
                        dragOver?.team === 'team2' && dragOver?.index === i
                          ? 'ring-2 ring-red-400 ring-offset-1 bg-red-100'
                          : 'hover:bg-red-100'
                      }`}
                    >
                      {!maintenanceMode && <GripVertical className="w-4 h-4 text-red-300 flex-shrink-0" />}
                      <div className="w-8 h-8 bg-red-200 rounded-full flex items-center justify-center text-red-700 font-semibold text-sm flex-shrink-0">
                        {player?.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-sm font-medium text-slate-700 truncate flex-1">{player?.name}</span>
                      {maintenanceMode && (
                        <button
                          onClick={() => removePlayerFromGame(court.id, 'team2', i)}
                          className="p-1 text-red-400 hover:text-red-600 hover:bg-red-100 rounded transition"
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

            {/* Game Controls */}
            {!showEndGame && !showCancelConfirm && !showMaintenanceMenu ? (
              <div className="flex gap-2">
                <button
                  onClick={() => setShowEndGame(true)}
                  className="flex-1 py-2 text-sm font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition"
                >
                  End Game
                </button>
                <button
                  onClick={() => setShowMaintenanceMenu(true)}
                  className="px-3 py-2 text-sm font-medium text-orange-600 bg-orange-50 rounded-lg hover:bg-orange-100 transition"
                  title="Maintenance options"
                >
                  <Wrench className="w-4 h-4" />
                </button>
              </div>
            ) : showMaintenanceMenu ? (
              <div className="space-y-2 p-3 bg-orange-50 rounded-lg border border-orange-100">
                <p className="text-sm text-center text-orange-700 font-medium">
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
                        className="flex-1 px-3 py-2 text-sm border border-orange-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
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
                      className="w-full py-2 text-sm font-medium text-orange-700 bg-white border border-orange-200 rounded-lg hover:bg-orange-100 transition flex items-center justify-center gap-2"
                    >
                      <Pencil className="w-4 h-4" />
                      Rename Court
                    </button>
                  )
                )}
                
                {/* Toggle Maintenance Mode - Add/Remove Players */}
                <button
                  onClick={() => {
                    const newMode = !maintenanceMode;
                    setMaintenanceMode(newMode);
                    // Only close menu when exiting player edit mode
                    if (!newMode) {
                      setShowMaintenanceMenu(false);
                    }
                  }}
                  className={`w-full py-2 text-sm font-medium rounded-lg transition flex items-center justify-center gap-2 ${
                    maintenanceMode 
                      ? 'text-white bg-orange-500 hover:bg-orange-600' 
                      : 'text-orange-700 bg-white border border-orange-200 hover:bg-orange-100'
                  }`}
                >
                  <UserMinus className="w-4 h-4" />
                  {maintenanceMode ? 'Exit Player Edit Mode' : 'Add/Remove Players'}
                </button>

                {/* Cancel Game - hide while in player edit mode */}
                {!maintenanceMode && (
                  <button
                    onClick={() => {
                      setShowMaintenanceMenu(false);
                      setShowCancelConfirm(true);
                    }}
                    className="w-full py-2 text-sm font-medium text-red-700 bg-white border border-red-200 rounded-lg hover:bg-red-50 transition flex items-center justify-center gap-2"
                  >
                    <X className="w-4 h-4" />
                    Cancel Game
                  </button>
                )}
                
                {!maintenanceMode && (
                  <button
                    onClick={() => {
                      setShowMaintenanceMenu(false);
                      setIsEditing(false);
                    }}
                    className="w-full py-1 text-xs text-slate-500 hover:text-slate-700"
                  >
                    Back
                  </button>
                )}
              </div>
            ) : showCancelConfirm ? (
              <div className="space-y-2 p-3 bg-red-50 rounded-lg border border-red-100">
                <p className="text-sm text-center text-red-700 font-medium">Cancel this game?</p>
                <p className="text-xs text-center text-red-600">Players will be moved back to the front of the queue</p>
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
                    className="py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition"
                  >
                    No, Continue
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-center text-slate-600">Who won?</p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleEndGame('team1')}
                    className="flex items-center justify-center gap-2 py-2 text-sm font-medium text-blue-700 bg-blue-100 rounded-lg hover:bg-blue-200 transition"
                  >
                    <Trophy className="w-4 h-4" />
                    Team 1
                  </button>
                  <button
                    onClick={() => handleEndGame('team2')}
                    className="flex items-center justify-center gap-2 py-2 text-sm font-medium text-red-700 bg-red-100 rounded-lg hover:bg-red-200 transition"
                  >
                    <Trophy className="w-4 h-4" />
                    Team 2
                  </button>
                </div>
                <button
                  onClick={() => setShowEndGame(false)}
                  className="w-full py-1 text-xs text-slate-500 hover:text-slate-700"
                >
                  Back
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-6">
            {isMaintenance ? (
              <div className="space-y-2">
                <Wrench className="w-8 h-8 text-orange-400 mx-auto" />
                <p className="text-sm text-orange-600">Court under maintenance</p>
              </div>
            ) : canStartGame ? (
              <button
                onClick={handleStartGame}
                className={`inline-flex items-center gap-2 px-6 py-3 ${theme.bg600} text-white font-medium rounded-lg hover:opacity-90 transition`}
              >
                <Play className="w-5 h-5" />
                Start Game
              </button>
            ) : (
              <div className="space-y-2">
                <Users className="w-8 h-8 text-slate-300 mx-auto" />
                <p className="text-sm text-slate-500">
                  Need {4 - session.queue.length} more players in queue
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
