import { useState } from 'react';
import { useSessionStore } from '@/store/sessionStore';
import { useThemeClasses } from '@/store/themeStore';
import { useAuthStore } from '@/store/authStore';
import { SessionSetup } from '@/components/SessionSetup';
import { CourtView } from '@/components/CourtView';
import { PlayerQueue } from '@/components/PlayerQueue';
import { PlayerList } from '@/components/PlayerList';
import { SessionHeader } from '@/components/SessionHeader';
import { ActivityLog } from '@/components/ActivityLog';
import { LoginPage } from '@/components/LoginPage';
import { AdminPage } from '@/components/AdminPage';
import { Plus } from 'lucide-react';

function App() {
  const { session, addCourt } = useSessionStore();
  const { isAuthenticated, isAccessValid, isAdmin } = useAuthStore();
  const theme = useThemeClasses();
  const [showAdmin, setShowAdmin] = useState(false);

  // Show login if not authenticated
  if (!isAuthenticated) {
    return <LoginPage />;
  }

  // Check if access is still valid
  if (!isAccessValid()) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-slate-800 rounded-xl p-6 max-w-md text-center">
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">Access Expired</h2>
          <p className="text-slate-600 dark:text-slate-400 mb-4">
            Your access has expired. Please contact an administrator to renew your subscription.
          </p>
          <button
            onClick={() => useAuthStore.getState().logout()}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition"
          >
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  // Show admin page if requested
  if (showAdmin && isAdmin()) {
    return <AdminPage onBack={() => setShowAdmin(false)} />;
  }

  if (!session) {
    return <SessionSetup onAdminClick={isAdmin() ? () => setShowAdmin(true) : undefined} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors">
      <SessionHeader onAdminClick={isAdmin() ? () => setShowAdmin(true) : undefined} />
      
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

export default App;
