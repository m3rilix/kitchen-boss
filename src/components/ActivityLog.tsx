import { useState } from 'react';
import { useSessionStore } from '@/store/sessionStore';
import { History, Trophy, UserPlus, ChevronsUp, ChevronUp, ChevronDown, UserMinus, Play, Copy, Check, Rocket, ScrollText } from 'lucide-react';
import type { ActivityType, Game } from '@/types';
import { MatchLogList } from './MatchLogList';
import { EditMatchModal } from './EditMatchModal';

const isDev = import.meta.env.DEV;

const getActivityIcon = (type: ActivityType) => {
  switch (type) {
    case 'court_ready':
      return <Play className="w-3.5 h-3.5 text-amber-400" />;
    case 'game_started':
      return <Play className="w-3.5 h-3.5 text-blue-500" />;
    case 'game_ended':
      return <Trophy className="w-3.5 h-3.5 text-amber-500" />;
    case 'player_added':
      return <UserPlus className="w-3.5 h-3.5 text-green-500" />;
    case 'player_moved_front':
      return <ChevronsUp className="w-3.5 h-3.5 text-purple-500" />;
    case 'player_moved_up':
      return <ChevronUp className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />;
    case 'player_moved_down':
      return <ChevronDown className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />;
    case 'player_removed':
      return <UserMinus className="w-3.5 h-3.5 text-red-500" />;
    case 'stack_skipped':
      return <Rocket className="w-3.5 h-3.5 text-purple-500" />;
    default:
      return <History className="w-3.5 h-3.5 text-slate-400" />;
  }
};

const formatTime = (date: Date) => {
  const d = new Date(date);
  return d.toLocaleTimeString('en-US', { 
    hour: 'numeric', 
    minute: '2-digit',
    hour12: true 
  });
};

export function ActivityLog() {
  const { session } = useSessionStore();
  const [showCount, setShowCount] = useState(20);
  const [copied, setCopied] = useState(false);
  const [tab, setTab] = useState<'activity' | 'matches'>('activity');
  const [editingGame, setEditingGame] = useState<Game | null>(null);

  if (!session) return null;

  // Handle sessions created before activityLog was added
  const activityLog = session.activityLog || [];
  const recentActivities = activityLog.slice(0, showCount);
  const hasMore = activityLog.length > showCount;

  const handleCopyLog = () => {
    const logText = activityLog
      .map(a => `${formatTime(a.timestamp)} - ${a.message}`)
      .join('\n');
    navigator.clipboard.writeText(logText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleLoadMore = () => {
    setShowCount(prev => Math.min(prev + 20, activityLog.length));
  };

  const handleShowAll = () => {
    setShowCount(activityLog.length);
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden dark:bg-slate-800 dark:border-slate-700">
      <div className="p-4 border-b border-slate-100 bg-slate-50 dark:border-slate-700 dark:bg-slate-700/50">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1 bg-slate-200/60 dark:bg-slate-700/60 rounded-lg p-0.5">
            <button
              onClick={() => setTab('activity')}
              className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-md transition ${
                tab === 'activity' ? 'bg-white text-slate-800 shadow-sm dark:bg-slate-800 dark:text-slate-100' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              Activity Log
            </button>
            <button
              onClick={() => setTab('matches')}
              className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-md transition ${
                tab === 'matches' ? 'bg-white text-slate-800 shadow-sm dark:bg-slate-800 dark:text-slate-100' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
              }`}
            >
              <ScrollText className="w-3.5 h-3.5" />
              Match Log
            </button>
          </div>
          <div className="flex items-center gap-2">
            {isDev && tab === 'activity' && (
              <button
                onClick={handleCopyLog}
                className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded transition dark:text-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600"
                title="Copy log to clipboard"
              >
                {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                {copied ? 'Copied!' : 'Copy'}
              </button>
            )}
            <span className="text-sm text-slate-500 dark:text-slate-400">
              {tab === 'activity' ? `${activityLog.length} events` : `${session.gamesCompleted.length} games`}
            </span>
          </div>
        </div>
      </div>

      {tab === 'matches' ? (
        <div className="p-2">
          <MatchLogList
            gamesCompleted={session.gamesCompleted}
            players={session.players}
            editable
            onEdit={(game) => setEditingGame(game)}
          />
        </div>
      ) : (
        <>
          <div className="divide-y divide-slate-100 dark:divide-slate-700 max-h-96 overflow-y-auto">
            {recentActivities.length === 0 ? (
              <div className="p-6 text-center text-slate-500 dark:text-slate-400">
                <p className="text-sm">No activity yet</p>
              </div>
            ) : (
              recentActivities.map((activity) => (
                <div
                  key={activity.id}
                  className={`flex items-start gap-3 p-3 hover:bg-slate-50 transition dark:hover:bg-slate-700 ${
                    activity.type === 'game_ended' ? 'bg-amber-50/50 dark:bg-amber-900/10' : ''
                  }`}
                >
                  <div className="mt-0.5 flex-shrink-0">
                    {getActivityIcon(activity.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-700 dark:text-slate-200">{activity.message}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {formatTime(activity.timestamp)}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Load More / Show All */}
          {hasMore && (
            <div className="p-3 border-t border-slate-100 bg-slate-50 flex items-center justify-center gap-3 dark:border-slate-700 dark:bg-slate-700/50">
              <button
                onClick={handleLoadMore}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium dark:text-blue-300"
              >
                Load More ({activityLog.length - showCount} remaining)
              </button>
              <span className="text-slate-300">|</span>
              <button
                onClick={handleShowAll}
                className="text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400"
              >
                Show All
              </button>
            </div>
          )}
        </>
      )}

      {editingGame && (
        <EditMatchModal
          game={editingGame}
          players={session.players}
          onClose={() => setEditingGame(null)}
        />
      )}
    </div>
  );
}
