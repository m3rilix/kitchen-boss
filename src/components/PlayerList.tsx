import { useState } from 'react';
import { useSessionStore } from '@/store/sessionStore';
import { useThemeClasses } from '@/store/themeStore';
import { UserPlus, Trash2, RotateCcw, Trophy, Users, AlertCircle } from 'lucide-react';
import { PickleballIcon } from './PickleballIcon';

export function PlayerList() {
  const { session, addPlayer, removePlayer, addToQueue, isNameDuplicate } = useSessionStore();
  const theme = useThemeClasses();
  const [playerNames, setPlayerNames] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState<string[]>([]);
  const [moveToFront, setMoveToFront] = useState(false);

  if (!session) return null;

  // Parse names and check for duplicates
  const parseNames = (input: string) => {
    return input
      .split(/[\n,;]+/)
      .map(name => name.trim())
      .filter(name => name.length > 0);
  };

  const handleAddPlayers = (e: React.FormEvent) => {
    e.preventDefault();
    const names = parseNames(playerNames);
    
    // Check for duplicates
    const duplicates: string[] = [];
    const newNames: string[] = [];
    
    names.forEach(name => {
      if (isNameDuplicate(name)) {
        duplicates.push(name);
      } else if (!newNames.some(n => n.toLowerCase() === name.toLowerCase())) {
        // Also check for duplicates within the input itself
        newNames.push(name);
      }
    });
    
    if (duplicates.length > 0) {
      setDuplicateWarning(duplicates);
      // Still add the non-duplicate names
      if (newNames.length > 0) {
        // If moving to front, add in reverse order so first name ends up first
        const namesToAdd = moveToFront ? [...newNames].reverse() : newNames;
        namesToAdd.forEach(name => addPlayer(name, undefined, moveToFront));
      }
      return;
    }
    
    if (newNames.length > 0) {
      // If moving to front, add in reverse order so first name ends up first
      const namesToAdd = moveToFront ? [...newNames].reverse() : newNames;
      namesToAdd.forEach(name => addPlayer(name, undefined, moveToFront));
      setPlayerNames('');
      setShowAddForm(false);
      setDuplicateWarning([]);
      setMoveToFront(false);
    }
  };

  const names = parseNames(playerNames);
  const duplicatesInInput = names.filter(name => isNameDuplicate(name));
  const uniqueNewNames = names.filter(name => !isNameDuplicate(name));
  const nameCount = uniqueNewNames.length;

  // Get players currently in a game
  const playersInGame = new Set<string>();
  session.courts.forEach((court) => {
    if (court.currentGame) {
      court.currentGame.team1.forEach((id) => playersInGame.add(id));
      court.currentGame.team2.forEach((id) => playersInGame.add(id));
    }
  });

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="p-4 border-b border-slate-100 bg-slate-50">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-slate-800">All Players</h3>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className={`flex items-center gap-1 px-2 py-1 text-sm font-medium ${theme.textButton} ${theme.bgButton} rounded-lg transition`}
          >
            <UserPlus className="w-4 h-4" />
            Add
          </button>
        </div>
      </div>

      {/* Add Players Form */}
      {showAddForm && (
        <form onSubmit={handleAddPlayers} className="p-3 border-b border-slate-100 bg-slate-50">
          <div className="space-y-2">
            <textarea
              value={playerNames}
              onChange={(e) => {
                setPlayerNames(e.target.value);
                setDuplicateWarning([]);
              }}
              placeholder="Enter player names (one per line, or separated by commas)&#10;&#10;Example:&#10;John&#10;Jane&#10;Mike, Sarah"
              className={`w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none ${
                duplicatesInInput.length > 0 ? 'border-amber-400' : 'border-slate-300'
              }`}
              rows={5}
              autoFocus
            />
            
            {/* Duplicate Warning */}
            {duplicatesInInput.length > 0 && (
              <div className="flex items-start gap-2 p-2 bg-amber-50 border border-amber-200 rounded-lg">
                <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-amber-700">
                  <span className="font-medium">Duplicate names:</span>{' '}
                  {duplicatesInInput.join(', ')}
                  <p className="text-amber-600 mt-0.5">These players already exist and will be skipped.</p>
                </div>
              </div>
            )}
            
            {/* Post-submit warning */}
            {duplicateWarning.length > 0 && (
              <div className="flex items-start gap-2 p-2 bg-amber-50 border border-amber-200 rounded-lg">
                <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-amber-700">
                  <span className="font-medium">Skipped duplicates:</span>{' '}
                  {duplicateWarning.join(', ')}
                  <button
                    type="button"
                    onClick={() => {
                      setDuplicateWarning([]);
                      setPlayerNames('');
                    }}
                    className="ml-2 underline hover:no-underline"
                  >
                    Clear
                  </button>
                </div>
              </div>
            )}
            
            {/* Move to Front Option */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={moveToFront}
                onChange={(e) => setMoveToFront(e.target.checked)}
                className="w-4 h-4 text-purple-600 border-slate-300 rounded focus:ring-purple-500"
              />
              <span className="text-sm text-slate-600">
                Skip to front of queue
              </span>
            </label>
            
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500 flex items-center gap-1">
                <Users className="w-3 h-3" />
                {nameCount} new player{nameCount !== 1 ? 's' : ''} to add
                {duplicatesInInput.length > 0 && (
                  <span className="text-amber-600">
                    ({duplicatesInInput.length} duplicate{duplicatesInInput.length !== 1 ? 's' : ''})
                  </span>
                )}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setPlayerNames('');
                    setShowAddForm(false);
                    setDuplicateWarning([]);
                    setMoveToFront(false);
                  }}
                  className="px-3 py-1.5 text-sm font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={nameCount === 0}
                  className={`px-4 py-1.5 text-sm font-medium text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition ${
                    moveToFront 
                      ? 'bg-purple-600 hover:bg-purple-700' 
                      : `${theme.bg600} hover:opacity-90`
                  }`}
                >
                  Add {nameCount > 0 ? `${nameCount} Player${nameCount !== 1 ? 's' : ''}` : ''}
                  {moveToFront && ' (Front)'}
                </button>
              </div>
            </div>
          </div>
        </form>
      )}

      {/* Player List */}
      <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
        {session.players.length === 0 ? (
          <div className="p-6 text-center text-slate-500">
            <p className="text-sm">No players yet</p>
            <p className="text-xs mt-1">Click "Add" to add players</p>
          </div>
        ) : (
          session.players.map((player) => {
            const isInGame = playersInGame.has(player.id);
            const isInQueue = session.queue.includes(player.id);

            return (
              <div
                key={player.id}
                className={`flex items-center gap-3 p-3 ${
                  isInGame ? 'bg-blue-50' : ''
                }`}
              >
                {/* Avatar */}
                <div className={`w-9 h-9 rounded-full flex items-center justify-center font-semibold text-sm ${
                  isInGame 
                    ? 'bg-blue-200 text-blue-700' 
                    : 'bg-slate-200 text-slate-600'
                }`}>
                  {player.name.charAt(0).toUpperCase()}
                </div>

                {/* Player Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-slate-800 truncate">{player.name}</p>
                    {isInGame && (
                      <span className="px-1.5 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 rounded">
                        Playing
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                      <PickleballIcon className="w-3 h-3" />
                      {player.gamesPlayed} games
                    </span>
                    <span className="flex items-center gap-1">
                      <Trophy className="w-3 h-3" />
                      {player.gamesWon} wins
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1">
                  {!isInGame && !isInQueue && (
                    <button
                      onClick={() => addToQueue(player.id)}
                      className="p-1.5 text-slate-400 hover:text-blue-600 transition"
                      title="Add to queue"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                  )}
                  {!isInGame && (
                    <button
                      onClick={() => {
                        if (confirm(`Remove ${player.name}?`)) {
                          removePlayer(player.id);
                        }
                      }}
                      className="p-1.5 text-slate-400 hover:text-red-500 transition"
                      title="Remove player"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Stats Footer */}
      {session.players.length > 0 && (
        <div className="p-3 bg-slate-50 border-t border-slate-100 text-xs text-slate-500 text-center">
          {session.gamesCompleted.length} games completed this session
        </div>
      )}
    </div>
  );
}
