import { useState } from 'react';
import { useSessionStore } from '@/store/sessionStore';
import { useThemeClasses } from '@/store/themeStore';
import { useAuthStore } from '@/store/authStore';
import { LogOut, Users, Clock, Shield, QrCode } from 'lucide-react';
import { PickleballIcon } from './PickleballIcon';
import { SettingsDropdown } from './SettingsDropdown';
import { ShareSessionModal } from './ShareSessionModal';

interface SessionHeaderProps {
  onAdminClick?: () => void;
}

export function SessionHeader({ onAdminClick }: SessionHeaderProps) {
  const { session, endSession } = useSessionStore();
  const { currentUser, logout, getDaysRemaining, isAdmin } = useAuthStore();
  const theme = useThemeClasses();
  const [showShareModal, setShowShareModal] = useState(false);
  const daysRemaining = getDaysRemaining();

  if (!session) return null;

  const playersInGame = session.courts.reduce((count, court) => {
    return count + (court.currentGame ? 4 : 0);
  }, 0);

  // Format date for display
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  // Format time for display
  const formatTime = (timeStr?: string) => {
    if (!timeStr) return '';
    const [hours, minutes] = timeStr.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

  return (
    <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-10 transition-colors">
      <div className="container mx-auto px-4 py-3">
        {/* Main Row */}
        <div className="flex items-center justify-between gap-4">
          {/* Left: Logo + Title */}
          <div className="flex items-center gap-3 min-w-0">
            <div className={`w-10 h-10 ${theme.bg100} rounded-full flex items-center justify-center flex-shrink-0`}>
              <PickleballIcon className={`w-6 h-6 ${theme.text}`} />
            </div>
            <div className="min-w-0">
              <h1 className="font-bold text-slate-800 dark:text-slate-100 truncate">{session.name}</h1>
              {(session.location || session.date) && (
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                  {session.location && <span>{session.location}</span>}
                  {session.location && session.date && <span> • </span>}
                  {session.date && <span>{formatDate(session.date)} {formatTime(session.time)}</span>}
                </p>
              )}
            </div>
          </div>

          {/* Center: Stats (desktop only) */}
          <div className="hidden md:flex items-center gap-4 px-4 py-2 bg-slate-100 dark:bg-slate-700/50 rounded-lg">
            <div className="flex items-center gap-2 text-sm">
              <Users className={`w-4 h-4 ${theme.text}`} />
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">Playing</p>
                <p className="font-semibold text-slate-800 dark:text-slate-100">{playersInGame}</p>
              </div>
            </div>
            <div className="w-px h-8 bg-slate-200 dark:bg-slate-600" />
            <div className="flex items-center gap-2 text-sm">
              <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">Waiting</p>
                <p className="font-semibold text-slate-800 dark:text-slate-100">{session.queue.length}</p>
              </div>
            </div>
            <div className="w-px h-8 bg-slate-200 dark:bg-slate-600" />
            <div className="text-sm">
              <p className="text-xs text-slate-500 dark:text-slate-400">Courts</p>
              <p className="font-semibold text-slate-800 dark:text-slate-100">{session.courts.length}</p>
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-2">
            {/* Share Session */}
            <button
              onClick={() => setShowShareModal(true)}
              className={`p-2 ${theme.bgButton} rounded-lg transition`}
              title="Share Session"
            >
              <QrCode className={`w-4 h-4 ${theme.text}`} />
            </button>

            {/* Admin */}
            {isAdmin() && onAdminClick && (
              <button
                onClick={onAdminClick}
                className={`p-2 ${theme.bgButton} rounded-lg transition`}
                title="Admin Panel"
              >
                <Shield className={`w-4 h-4 ${theme.text}`} />
              </button>
            )}

            {/* Settings */}
            <SettingsDropdown />

            {/* User Info (desktop) */}
            <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 bg-slate-100 dark:bg-slate-700 rounded-lg">
              <div className="text-right">
                <p className="text-xs font-medium text-slate-700 dark:text-slate-200">{currentUser?.name}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {daysRemaining === null ? '∞' : `${daysRemaining}d`}
                </p>
              </div>
              <button
                onClick={logout}
                className="p-1 text-slate-400 hover:text-red-500 transition"
                title="Sign Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>

            {/* End Session */}
            <button
              onClick={() => {
                if (confirm('End this session? All data will be lost.')) {
                  endSession();
                }
              }}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/30 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/50 transition"
              title="End Session"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden lg:inline">End</span>
            </button>
          </div>
        </div>

        {/* Mobile Stats Row */}
        <div className="flex md:hidden items-center justify-around mt-3 pt-3 border-t border-slate-100 dark:border-slate-700">
          <div className="flex items-center gap-2 text-sm">
            <Users className={`w-4 h-4 ${theme.text}`} />
            <span className="text-slate-600 dark:text-slate-400">
              <span className="font-semibold text-slate-800 dark:text-slate-100">{playersInGame}</span> playing
            </span>
          </div>
          <div className="w-px h-4 bg-slate-200 dark:bg-slate-600" />
          <div className="flex items-center gap-2 text-sm">
            <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <span className="text-slate-600 dark:text-slate-400">
              <span className="font-semibold text-slate-800 dark:text-slate-100">{session.queue.length}</span> waiting
            </span>
          </div>
          <div className="w-px h-4 bg-slate-200 dark:bg-slate-600" />
          <div className="text-sm text-slate-600 dark:text-slate-400">
            <span className="font-semibold text-slate-800 dark:text-slate-100">{session.courts.length}</span> courts
          </div>
        </div>
      </div>

      {/* Share Modal */}
      <ShareSessionModal 
        isOpen={showShareModal} 
        onClose={() => setShowShareModal(false)} 
      />
    </header>
  );
}
