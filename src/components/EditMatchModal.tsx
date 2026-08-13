import { useState } from 'react';
import type { Game, Player } from '@/types';
import { X } from 'lucide-react';
import { useSessionStore } from '@/store/sessionStore';
import { useThemeClasses } from '@/store/themeStore';

interface EditMatchModalProps {
  game: Game;
  players: Player[];
  onClose: () => void;
}

export function EditMatchModal({ game, players, onClose }: EditMatchModalProps) {
  const { editCompletedGame } = useSessionStore();
  const theme = useThemeClasses();
  const nameById = new Map(players.map(p => [p.id, p.name]));
  const getNames = (ids: string[]) => ids.map(id => nameById.get(id) || 'Unknown').join(' & ');

  const [team1Score, setTeam1Score] = useState(game.score?.team1 ?? 0);
  const [team2Score, setTeam2Score] = useState(game.score?.team2 ?? 0);
  const [winner, setWinner] = useState<'team1' | 'team2'>(game.winner ?? 'team1');

  const handleSave = () => {
    editCompletedGame(game.id, { score: { team1: team1Score, team2: team2Score }, winner });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">Edit Match</h2>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* Team 1 */}
          <button
            onClick={() => setWinner('team1')}
            className={`w-full flex items-center justify-between p-3 rounded-lg border transition ${
              winner === 'team1' ? 'border-green-400 bg-green-50 dark:bg-green-900/20' : 'border-slate-200 dark:border-slate-600'
            }`}
          >
            <span className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">{getNames(game.team1)}</span>
            {winner === 'team1' && <span className="text-xs font-semibold text-green-600 dark:text-green-400 shrink-0 ml-2">Winner</span>}
          </button>
          <input
            type="number"
            min={0}
            value={team1Score}
            onChange={(e) => setTeam1Score(Number(e.target.value))}
            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            placeholder="Team 1 score"
          />

          {/* Team 2 */}
          <button
            onClick={() => setWinner('team2')}
            className={`w-full flex items-center justify-between p-3 rounded-lg border transition ${
              winner === 'team2' ? 'border-green-400 bg-green-50 dark:bg-green-900/20' : 'border-slate-200 dark:border-slate-600'
            }`}
          >
            <span className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">{getNames(game.team2)}</span>
            {winner === 'team2' && <span className="text-xs font-semibold text-green-600 dark:text-green-400 shrink-0 ml-2">Winner</span>}
          </button>
          <input
            type="number"
            min={0}
            value={team2Score}
            onChange={(e) => setTeam2Score(Number(e.target.value))}
            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            placeholder="Team 2 score"
          />
        </div>

        <div className="px-5 py-4 border-t border-slate-100 dark:border-slate-700 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className={`flex-1 px-4 py-2 text-sm font-medium text-white ${theme.bg600} rounded-lg hover:opacity-90 transition`}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
