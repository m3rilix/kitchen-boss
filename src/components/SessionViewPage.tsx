import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useSessionStore } from '@/store/sessionStore';
import { useThemeClasses } from '@/store/themeStore';
import { SessionHeader } from './SessionHeader';
import { CourtView } from './CourtView';
import { PlayerQueue } from './PlayerQueue';
import { DoublesQueue } from './DoublesQueue';
import { PlayerList } from './PlayerList';
import { ActivityLog } from './ActivityLog';
import { Plus, Layers, Users, LayoutGrid, ScrollText } from 'lucide-react';

type MobileSection = 'courts' | 'queue' | 'players' | 'log';

const MOBILE_TABS: { id: MobileSection; label: string; icon: React.ReactNode }[] = [
  { id: 'courts',  label: 'Courts',  icon: <LayoutGrid className="w-5 h-5" /> },
  { id: 'queue',   label: 'Queue',   icon: <Layers className="w-5 h-5" /> },
  { id: 'players', label: 'Players', icon: <Users className="w-5 h-5" /> },
  { id: 'log',     label: 'Log',     icon: <ScrollText className="w-5 h-5" /> },
];

interface SessionViewPageProps {
  onAdminClick: () => void;
}

export function SessionViewPage({ onAdminClick }: SessionViewPageProps) {
  const { session, addCourt } = useSessionStore();
  const theme = useThemeClasses();
  const [activeTab, setActiveTab] = useState<MobileSection>('courts');

  if (!session) {
    return <Navigate to="/create-session" replace />;
  }

  const scrollTo = (id: MobileSection) => {
    setActiveTab(id);
    document.getElementById(`section-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <SessionHeader onAdminClick={onAdminClick} />

      <main className="container mx-auto px-4 py-6 pb-24 lg:pb-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Courts Section */}
          <div id="section-courts" className="lg:col-span-2 space-y-4 scroll-mt-20">
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
            <div id="section-queue" className="scroll-mt-20">
              {session.rotationMode === 'doubles' ? <DoublesQueue /> : <PlayerQueue />}
            </div>
            <div id="section-players" className="scroll-mt-20"><PlayerList /></div>
            <div id="section-log" className="scroll-mt-20"><ActivityLog /></div>
          </div>
        </div>
      </main>

      {/* Mobile bottom tab nav */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 z-20">
        <div className="flex">
          {MOBILE_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => scrollTo(tab.id)}
              className={`flex-1 flex flex-col items-center gap-0.5 py-2 text-xs font-medium transition ${
                activeTab === tab.id
                  ? `${theme.text}`
                  : 'text-slate-400 dark:text-slate-500'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
