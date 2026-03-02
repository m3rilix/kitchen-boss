import { useState } from 'react';
import { useSessionStore } from '@/store/sessionStore';
import { useThemeClasses } from '@/store/themeStore';
import { useAuthStore } from '@/store/authStore';
import { LogOut, Users, Clock, Shield, QrCode, RotateCcw, Pencil, Check, X } from 'lucide-react';
import { PickleballIcon } from './PickleballIcon';
import { SettingsDropdown } from './SettingsDropdown';
import { ShareSessionModal } from './ShareSessionModal';

interface SessionHeaderProps {
  onAdminClick?: () => void;
}

export function SessionHeader({ onAdminClick }: SessionHeaderProps) {
  const { session, endSession, resetSession, updateSessionName } = useSessionStore();
  const { currentUser, logout, getDaysRemaining, isAdmin } = useAuthStore();
  const theme = useThemeClasses();
  const [showShareModal, setShowShareModal] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editName, setEditName] = useState('');
  const [showResetModal, setShowResetModal] = useState(false);
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
              {isEditingName ? (
                <div className="flex items-center gap-1">
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        updateSessionName(editName);
                        setIsEditingName(false);
                      } else if (e.key === 'Escape') {
                        setIsEditingName(false);
                      }
                    }}
                    className="px-2 py-0.5 text-sm font-bold border border-slate-300 dark:border-slate-600 rounded focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100"
                    autoFocus
                  />
                  <button
                    onClick={() => {
                      updateSessionName(editName);
                      setIsEditingName(false);
                    }}
                    className="p-1 text-green-600 hover:text-green-700"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setIsEditingName(false)}
                    className="p-1 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1 group">
                  <h1 className="font-bold text-slate-800 dark:text-slate-100 truncate">{session.name}</h1>
                  <button
                    onClick={() => {
                      setEditName(session.name);
                      setIsEditingName(true);
                    }}
                    className="p-1 text-slate-300 hover:text-slate-500 dark:text-slate-600 dark:hover:text-slate-400 opacity-0 group-hover:opacity-100 transition"
                    title="Edit session name"
                  >
                    <Pencil className="w-3 h-3" />
                  </button>
                </div>
              )}
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
            {/* Dev Reset Session */}
            {import.meta.env.DEV && (
              <button
                onClick={() => setShowResetModal(true)}
                className="p-2 bg-red-100 hover:bg-red-200 dark:bg-red-900/30 dark:hover:bg-red-900/50 rounded-lg transition"
                title="Reset Session (Dev)"
              >
                <RotateCcw className="w-4 h-4 text-red-600 dark:text-red-400" />
              </button>
            )}

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

      {/* Reset Modal */}
      {showResetModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-800 rounded-xl p-6 max-w-sm mx-4 shadow-xl">
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-4">
              Reset Session
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
              Choose what to reset:
            </p>
            <div className="space-y-2">
              <button
                onClick={() => {
                  resetSession();
                  setShowResetModal(false);
                }}
                className="w-full px-4 py-3 text-left bg-amber-50 dark:bg-amber-900/20 hover:bg-amber-100 dark:hover:bg-amber-900/30 rounded-lg border border-amber-200 dark:border-amber-800 transition"
              >
                <p className="font-medium text-amber-800 dark:text-amber-200">Reset Stats Only</p>
                <p className="text-xs text-amber-600 dark:text-amber-400">Clear games, reset player stats, keep all players</p>
              </button>
              <button
                onClick={() => {
                  if (confirm('This will delete ALL players. Are you sure?')) {
                    endSession();
                    setShowResetModal(false);
                  }
                }}
                className="w-full px-4 py-3 text-left bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg border border-red-200 dark:border-red-800 transition"
              >
                <p className="font-medium text-red-800 dark:text-red-200">Delete Everything</p>
                <p className="text-xs text-red-600 dark:text-red-400">End session and remove all players</p>
              </button>
            </div>
            <button
              onClick={() => setShowResetModal(false)}
              className="w-full mt-4 px-4 py-2 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
