import type { Game, Player } from '@/types';
import { Pencil } from 'lucide-react';

interface MatchLogListProps {
  gamesCompleted: Game[];
  players: Player[];
  editable?: boolean;
  onEdit?: (game: Game) => void;
  maxHeightClass?: string;
}

function formatGameTime(date?: Date) {
  if (!date) return '';
  return new Date(date).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

export function MatchLogList({ gamesCompleted, players, editable, onEdit, maxHeightClass = 'max-h-96' }: MatchLogListProps) {
  const nameById = new Map(players.map(p => [p.id, p.name]));
  const getNames = (ids: string[]) => ids.map(id => nameById.get(id) || 'Unknown').join(' & ');

  if (gamesCompleted.length === 0) {
    return <p className="text-sm text-slate-500 text-center py-6">No matches played yet</p>;
  }

  // Most recent first
  const rows = [...gamesCompleted].reverse();

  return (
    <div className={`${maxHeightClass} overflow-y-auto`}>
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-white dark:bg-slate-800">
          <tr className="text-xs text-slate-400 dark:text-slate-500 uppercase tracking-wide">
            <th className="text-left font-medium py-1.5 px-2 w-8">#</th>
            <th className="text-left font-medium py-1.5 px-2">Win</th>
            <th className="text-left font-medium py-1.5 px-2">Lose</th>
            <th className="text-right font-medium py-1.5 px-2">Score</th>
            {editable && <th className="w-8"></th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((game, idx) => {
            const winningTeam = game.winner === 'team1' ? game.team1 : game.team2;
            const losingTeam = game.winner === 'team1' ? game.team2 : game.team1;
            const winScore = game.score ? (game.winner === 'team1' ? game.score.team1 : game.score.team2) : undefined;
            const loseScore = game.score ? (game.winner === 'team1' ? game.score.team2 : game.score.team1) : undefined;
            return (
              <tr key={game.id} className={idx % 2 === 0 ? 'bg-slate-50/60 dark:bg-slate-800/30' : ''}>
                <td className="py-1.5 px-2 text-slate-400 dark:text-slate-500">{gamesCompleted.length - idx}</td>
                <td className="py-1.5 px-2">
                  <span className="font-medium text-green-600 dark:text-green-400 truncate">{getNames(winningTeam)}</span>
                  {game.isEdited && <span className="ml-1.5 text-xs text-slate-400 dark:text-slate-500" title={`Edited ${game.editedAt ? new Date(game.editedAt).toLocaleString() : ''}`}>(edited)</span>}
                </td>
                <td className="py-1.5 px-2 text-slate-500 dark:text-slate-400 truncate">{getNames(losingTeam)}</td>
                <td className="py-1.5 px-2 text-right text-slate-600 dark:text-slate-300 font-medium whitespace-nowrap">
                  {winScore !== undefined ? `${winScore}-${loseScore}` : formatGameTime(game.endedAt)}
                </td>
                {editable && (
                  <td className="py-1.5 px-2 text-right">
                    <button
                      onClick={() => onEdit?.(game)}
                      className="p-1 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 rounded transition"
                      title="Edit match"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
