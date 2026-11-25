import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useSessionStore } from '@/store/sessionStore';
import { useThemeClasses } from '@/store/themeStore';
import { SessionHeader } from './SessionHeader';
import { CourtView } from './CourtView';
import { PlayerQueue } from './PlayerQueue';
import { DoublesQueue } from './DoublesQueue';
import { PlayerList } from './PlayerList';
import { ActivityLog } from './ActivityLog';
import { LeaderboardPanel } from './LeaderboardPanel';
import { PlayerStatsModal } from './PlayerStatsModal';
import { Plus, Layers, Users, LayoutGrid, ScrollText, Trophy, Play } from 'lucide-react';

type Section = 'courts' | 'queue' | 'leaderboard' | 'players' | 'log';
type BottomTab = 'leaderboard' | 'players' | 'log';

/** Phones: everything stacked in this order, with a bottom nav that scrolls to each section. */
const MOBILE_TABS: { id: Section; label: string; icon: React.ReactNode }[] = [
  { id: 'courts',  label: 'Courts',  icon: <LayoutGrid className="w-5 h-5" /> },
  { id: 'queue',   label: 'Queue',   icon: <Layers className="w-5 h-5" /> },
  { id: 'leaderboard', label: 'Rankings', icon: <Trophy className="w-5 h-5" /> },
  { id: 'players', label: 'Players', icon: <Users className="w-5 h-5" /> },
  { id: 'log',     label: 'Log',     icon: <ScrollText className="w-5 h-5" /> },
];

/** Tablet and up: Courts on top, Queue in the middle, these three as tabs at the bottom. */
const BOTTOM_TABS: { id: BottomTab; label: string; icon: React.ReactNode }[] = [
  { id: 'leaderboard', label: 'Rankings', icon: <Trophy className="w-4 h-4" /> },
  { id: 'players', label: 'Players', icon: <Users className="w-4 h-4" /> },
  { id: 'log', label: 'Log', icon: <ScrollText className="w-4 h-4" /> },
];

const LARGE_QUERY = '(min-width: 768px)';
const BOTTOM_TAB_KEY = 'kb-bottom-tab';

function useIsLargeScreen(): boolean {
  const [isLarge, setIsLarge] = useState(() => window.matchMedia(LARGE_QUERY).matches);
  useEffect(() => {
    const mq = window.matchMedia(LARGE_QUERY);
    const onChange = () => setIsLarge(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return isLarge;
}

function loadBottomTab(): BottomTab {
  try {
    const saved = localStorage.getItem(BOTTOM_TAB_KEY);
    if (saved === 'leaderboard' || saved === 'players' || saved === 'log') return saved;
  } catch { /* storage unavailable */ }
  return 'leaderboard';
}

interface SessionViewPageProps {
  onAdminClick: () => void;
}

export function SessionViewPage({ onAdminClick }: SessionViewPageProps) {
  const { session, addCourt, startAllReadyCourts } = useSessionStore();
  const theme = useThemeClasses();
  const isLarge = useIsLargeScreen();
  const [activeTab, setActiveTab] = useState<Section>('courts');
  const [bottomTab, setBottomTabState] = useState<BottomTab>(loadBottomTab);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);

  if (!session) return <Navigate to="/create-session" replace />;
  const selectedPlayer = selectedPlayerId ? session.players.find(p => p.id === selectedPlayerId) : undefined;
  const readyCourtCount = session.courts.filter(c => c.status === 'ready').length;

  const setBottomTab = (t: BottomTab) => {
    setBottomTabState(t);
    try { localStorage.setItem(BOTTOM_TAB_KEY, t); } catch { /* storage unavailable */ }
  };

  const scrollTo = (id: Section) => {
    setActiveTab(id);
    document.getElementById(`section-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const courtsPanel = (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
        <h2 className="font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
          <LayoutGrid className="w-4 h-4 text-blue-500" />
          Courts ({session.courts.length})
        </h2>
        <button
          onClick={addCourt}
          className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium ${theme.textButton} ${theme.bgButton} rounded-lg transition`}
        >
          <Plus className="w-4 h-4" />
          Add Court
        </button>
      </div>
      <div className="p-3 md:p-4">
        {readyCourtCount > 0 && (
          <button
            onClick={startAllReadyCourts}
            className={`w-full mb-3 md:mb-4 inline-flex items-center justify-center gap-2 py-3 text-base font-bold text-white ${theme.bg600} rounded-xl shadow-sm hover:opacity-90 transition`}
          >
            <Play className="w-5 h-5" />
            Start {readyCourtCount} ready court{readyCourtCount !== 1 ? 's' : ''}
          </button>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
          {session.courts.map((court) => (
            <CourtView key={court.id} court={court} />
          ))}
        </div>
      </div>
    </div>
  );

  const queuePanel = session.rotationMode === 'doubles' ? <DoublesQueue /> : <PlayerQueue wide={isLarge} />;
  const leaderboardPanel = <LeaderboardPanel session={session} onSelectPlayer={setSelectedPlayerId} />;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <SessionHeader onAdminClick={onAdminClick} />

      {isLarge ? (
        <main className="mx-auto w-full max-w-[1600px] px-6 py-6 space-y-6">
          {courtsPanel}
          {queuePanel}

          {/* Bottom: tabbed Rankings / Players / Log */}
          <section>
            <div role="tablist" aria-label="Session details" className="flex gap-1 mb-3 p-1 bg-slate-200/70 dark:bg-slate-800 rounded-xl w-fit">
              {BOTTOM_TABS.map(t => (
                <button
                  key={t.id}
                  role="tab"
                  aria-selected={bottomTab === t.id}
                  onClick={() => setBottomTab(t.id)}
                  className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition ${
                    bottomTab === t.id
                      ? `bg-white dark:bg-slate-700 shadow-sm ${theme.text}`
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                  }`}
                >
                  {t.icon}
                  {t.label}
                </button>
              ))}
            </div>
            <div role="tabpanel">
              {bottomTab === 'leaderboard' && leaderboardPanel}
              {bottomTab === 'players' && <PlayerList />}
              {bottomTab === 'log' && <ActivityLog />}
            </div>
          </section>
        </main>
      ) : (
        <>
          <main className="container mx-auto px-4 py-6 pb-24 space-y-4">
            <div id="section-courts" className="scroll-mt-20">{courtsPanel}</div>
            <div id="section-queue" className="scroll-mt-20">{queuePanel}</div>
            <div id="section-leaderboard" className="scroll-mt-20">{leaderboardPanel}</div>
            <div id="section-players" className="scroll-mt-20"><PlayerList /></div>
            <div id="section-log" className="scroll-mt-20"><ActivityLog /></div>
          </main>

          {/* Mobile bottom tab nav */}
          <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 z-20">
            <div className="flex">
              {MOBILE_TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => scrollTo(tab.id)}
                  className={`flex-1 flex flex-col items-center gap-0.5 py-2 text-xs font-medium transition ${
                    activeTab === tab.id ? `${theme.text}` : 'text-slate-400 dark:text-slate-500'
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </div>
          </nav>
        </>
      )}

      {selectedPlayer && (
        <PlayerStatsModal
          player={selectedPlayer}
          session={session}
          onClose={() => setSelectedPlayerId(null)}
        />
      )}
    </div>
  );
}
