import { Navigate } from 'react-router-dom';
import { useSessionStore } from '@/store/sessionStore';
import { useThemeClasses } from '@/store/themeStore';
import { SessionHeader } from './SessionHeader';
import { CourtView } from './CourtView';
import { PlayerQueue } from './PlayerQueue';
import { PlayerList } from './PlayerList';
import { ActivityLog } from './ActivityLog';
import { Plus } from 'lucide-react';

interface SessionViewPageProps {
  onAdminClick: () => void;
}

export function SessionViewPage({ onAdminClick }: SessionViewPageProps) {
  const { session, addCourt } = useSessionStore();
  const theme = useThemeClasses();

  if (!session) {
    return <Navigate to="/create-session" replace />;
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <SessionHeader onAdminClick={onAdminClick} />
      
      <main className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Courts Section */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100">Courts</h2>
              <button
                onClick={addCourt}
                className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium ${theme.textButton} ${theme.bgButton} rounded-lg transition`}
              >
                <Plus className="w-4 h-4" />
                Add Court
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {session.courts.map((court) => (
                <CourtView key={court.id} court={court} />
              ))}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <PlayerQueue />
            <PlayerList />
            <ActivityLog />
          </div>
        </div>
      </main>
    </div>
  );
}
