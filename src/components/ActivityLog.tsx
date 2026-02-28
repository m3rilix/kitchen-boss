import { useSessionStore } from '@/store/sessionStore';
import { useThemeClasses } from '@/store/themeStore';
import { History, Trophy, UserPlus, ChevronsUp, ChevronUp, ChevronDown, UserMinus, Play } from 'lucide-react';
import type { ActivityType } from '@/types';

const getActivityIcon = (type: ActivityType) => {
  switch (type) {
    case 'game_started':
      return <Play className="w-3.5 h-3.5 text-blue-500" />;
    case 'game_ended':
      return <Trophy className="w-3.5 h-3.5 text-amber-500" />;
    case 'player_added':
      return <UserPlus className="w-3.5 h-3.5 text-green-500" />;
    case 'player_moved_front':
      return <ChevronsUp className="w-3.5 h-3.5 text-purple-500" />;
    case 'player_moved_up':
      return <ChevronUp className="w-3.5 h-3.5 text-slate-500" />;
    case 'player_moved_down':
      return <ChevronDown className="w-3.5 h-3.5 text-slate-500" />;
    case 'player_removed':
      return <UserMinus className="w-3.5 h-3.5 text-red-500" />;
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
  const theme = useThemeClasses();

  if (!session) return null;

  // Handle sessions created before activityLog was added
  const activityLog = session.activityLog || [];
  const recentActivities = activityLog.slice(0, 50); // Show last 50 activities

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="p-4 border-b border-slate-100 bg-slate-50">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-slate-800 flex items-center gap-2">
            <History className={`w-4 h-4 ${theme.text}`} />
            Activity Log
          </h3>
          <span className="text-sm text-slate-500">{activityLog.length} events</span>
        </div>
      </div>

      <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
        {recentActivities.length === 0 ? (
          <div className="p-6 text-center text-slate-500">
            <p className="text-sm">No activity yet</p>
          </div>
        ) : (
          recentActivities.map((activity) => (
            <div
              key={activity.id}
              className={`flex items-start gap-3 p-3 hover:bg-slate-50 transition ${
                activity.type === 'game_ended' ? 'bg-amber-50/50' : ''
              }`}
            >
              <div className="mt-0.5 flex-shrink-0">
                {getActivityIcon(activity.type)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-slate-700">{activity.message}</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {formatTime(activity.timestamp)}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
