import { useEffect, useState } from 'react';
import { LayoutGrid, Rows, Table2, Plus, Play, X, RotateCcw, SkipForward, Wrench, Check, Timer, ArrowDownUp } from 'lucide-react';
import type { Court, Session } from '@/types';
import { useSessionStore } from '@/store/sessionStore';
import { useThemeClasses } from '@/store/themeStore';
import { canPullNextStack, courtState, useElapsed, type CourtState } from '@/lib/courtFlow';
import { CourtView } from './CourtView';
import { ScoreEntryModal } from './ScoreEntryModal';

type CourtLayout = 'grid' | 'compact' | 'table';
type CourtOrder = 'default' | 'active';

const LAYOUT_KEY = 'kb-court-layout';
const ORDER_KEY = 'kb-court-order';
const STATE_RANK: Record<CourtState, number> = { active: 0, ready: 1, waiting: 2, maintenance: 3 };

function readPref<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
  } catch {
    return fallback;
  }
}
function writePref(key: string, value: string) {
  try { localStorage.setItem(key, value); } catch { /* storage unavailable */ }
}

function useIsWide(): boolean {
  const query = '(min-width: 768px)';
  const [wide, setWide] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setWide(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return wide;
}

// ── Small shared bits ────────────────────────────────────────────────────────

function CourtTimer({ court }: { court: Court }) {
  const active = courtState(court) === 'active';
  const elapsed = useElapsed(active ? court.currentGame?.startedAt : undefined);
  if (!active) return <span className="text-xs text-slate-400 dark:text-slate-500 tabular-nums">—</span>;
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 dark:text-slate-300 tabular-nums">
      <Timer className="w-3.5 h-3.5 text-slate-400" />{elapsed}
    </span>
  );
}

function StateBadge({ court, withTimer = true }: { court: Court; withTimer?: boolean }) {
  const state = courtState(court);
  if (state === 'active') {
    return (
      <span className="inline-flex items-center gap-1.5">
        <span className="px-2 py-0.5 text-[11px] font-bold bg-red-600 text-white rounded-full inline-flex items-center gap-1">
          <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />LIVE
        </span>
        {withTimer && <CourtTimer court={court} />}
      </span>
    );
  }
  if (state === 'ready') {
    return <span className="px-2 py-0.5 text-[11px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border border-amber-300 dark:border-amber-700 rounded-full">READY</span>;
  }
  if (state === 'maintenance') {
    return <span className="px-2 py-0.5 text-[11px] font-medium bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300 rounded-full inline-flex items-center gap-1"><Wrench className="w-3 h-3" />Maintenance</span>;
  }
  return <span className="px-2 py-0.5 text-[11px] font-medium bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-300 rounded-full">Waiting</span>;
}

function Matchup({ court, session }: { court: Court; session: Session }) {
  const g = court.currentGame;
  if (!g) return <span className="text-sm text-slate-400 dark:text-slate-500">—</span>;
  const name = (id: string) => (id ? session.players.find(p => p.id === id)?.name ?? '?' : 'Empty');
  return (
    <span className="text-sm min-w-0">
      <span className="font-medium text-blue-700 dark:text-blue-300">{g.team1.map(name).join(' & ')}</span>
      <span className="mx-1.5 text-xs font-bold text-slate-400">vs</span>
      <span className="font-medium text-red-700 dark:text-red-300">{g.team2.map(name).join(' & ')}</span>
    </span>
  );
}

/** The per-court action buttons for the Compact and Table views. */
function CourtActions({ court, session }: { court: Court; session: Session }) {
  const { autoAssignNextGame, startCourtGame, returnToReady, cancelGame, setCourtStatus } = useSessionStore();
  const theme = useThemeClasses();
  const [scoring, setScoring] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const state = courtState(court);
  const btn = 'inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg transition whitespace-nowrap';

  if (confirmCancel) {
    return (
      <span className="inline-flex items-center gap-1.5">
        <span className="text-xs text-red-700 dark:text-red-300 font-medium">{state === 'ready' ? 'Clear court?' : 'Cancel game?'}</span>
        <button onClick={() => { cancelGame(court.id); setConfirmCancel(false); }} className={`${btn} bg-red-600 text-white hover:bg-red-700`}>Yes</button>
        <button onClick={() => setConfirmCancel(false)} className={`${btn} bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-200`}>No</button>
      </span>
    );
  }

  const cancelBtn = (
    <button onClick={() => setConfirmCancel(true)} className={`${btn} text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/40`} title="Cancel: no result, players go back to the front of the queue">
      <X className="w-3.5 h-3.5" />Cancel
    </button>
  );

  return (
    <span className="inline-flex items-center gap-1.5 flex-wrap justify-end">
      {state === 'waiting' && (
        <>
          <button
            onClick={() => autoAssignNextGame(court.id)}
            disabled={!canPullNextStack(session)}
            title={canPullNextStack(session) ? 'Bring the next stack on court' : 'No stack ready'}
            className={`${btn} ${theme.bg600} text-white hover:opacity-90 disabled:opacity-40`}
          >
            <SkipForward className="w-3.5 h-3.5" />Next
          </button>
          <button onClick={() => setCourtStatus(court.id, 'maintenance')} className={`${btn} text-orange-600 bg-orange-50 dark:bg-orange-900/20 dark:text-orange-300 hover:bg-orange-100 dark:hover:bg-orange-900/40`} title="Mark maintenance">
            <Wrench className="w-3.5 h-3.5" />
          </button>
        </>
      )}
      {state === 'ready' && (
        <>
          <button onClick={() => startCourtGame(court.id)} className={`${btn} ${theme.bg600} text-white hover:opacity-90`}>
            <Play className="w-3.5 h-3.5" />Start
          </button>
          {cancelBtn}
        </>
      )}
      {state === 'active' && (
        <>
          <button onClick={() => setScoring(true)} className={`${btn} bg-slate-800 text-white dark:bg-slate-100 dark:text-slate-900 hover:opacity-90`}>
            End
          </button>
          <button onClick={() => returnToReady(court.id)} className={`${btn} text-amber-700 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/40`} title="Return to Ready: keep players, reset the timer">
            <RotateCcw className="w-3.5 h-3.5" />Ready
          </button>
          {cancelBtn}
        </>
      )}
      {state === 'maintenance' && (
        <button onClick={() => setCourtStatus(court.id, 'available')} className={`${btn} text-green-700 bg-green-50 dark:bg-green-900/20 dark:text-green-300 hover:bg-green-100 dark:hover:bg-green-900/40`}>
          <Check className="w-3.5 h-3.5" />Available
        </button>
      )}
      {scoring && <ScoreEntryModal court={court} onClose={() => setScoring(false)} />}
    </span>
  );
}

// ── Board ────────────────────────────────────────────────────────────────────

/**
 * Court View: counts, ordering and a Grid / Compact / Table toggle above the courts, with the
 * "Start N ready courts" button between the controls and the courts. Player swaps and court
 * renaming stay on the Grid cards.
 */
export function CourtBoard() {
  const { session, addCourt, startAllReadyCourts } = useSessionStore();
  const theme = useThemeClasses();
  const isWide = useIsWide();
  const [layout, setLayoutState] = useState<CourtLayout>(() => readPref(LAYOUT_KEY, ['grid', 'compact', 'table'] as const, 'grid'));
  const [order, setOrderState] = useState<CourtOrder>(() => readPref(ORDER_KEY, ['default', 'active'] as const, 'default'));
  if (!session) return null;

  const setLayout = (l: CourtLayout) => { setLayoutState(l); writePref(LAYOUT_KEY, l); };
  const setOrder = (o: CourtOrder) => { setOrderState(o); writePref(ORDER_KEY, o); };
  // Table needs room; phones fall back to Compact
  const effectiveLayout: CourtLayout = layout === 'table' && !isWide ? 'compact' : layout;

  const counts = { active: 0, ready: 0, waiting: 0, maintenance: 0 };
  session.courts.forEach(c => { counts[courtState(c)]++; });

  const courts = order === 'active'
    ? session.courts
        .map((c, i) => ({ c, i }))
        .sort((a, b) => STATE_RANK[courtState(a.c)] - STATE_RANK[courtState(b.c)] || a.i - b.i)
        .map(x => x.c)
    : session.courts;

  const layoutOptions: { id: CourtLayout; label: string; icon: React.ReactNode }[] = [
    { id: 'grid', label: 'Grid', icon: <LayoutGrid className="w-3.5 h-3.5" /> },
    { id: 'compact', label: 'Compact', icon: <Rows className="w-3.5 h-3.5" /> },
    ...(isWide ? [{ id: 'table' as const, label: 'Table', icon: <Table2 className="w-3.5 h-3.5" /> }] : []),
  ];

  const chip = (n: number, label: string, cls: string) => (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${cls}`}>
      <span className="tabular-nums">{n}</span>{label}
    </span>
  );

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
      {/* Court View panel */}
      <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700 space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <LayoutGrid className={`w-4 h-4 ${theme.text}`} />
            Courts ({session.courts.length})
          </h2>
          <button
            onClick={addCourt}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium ${theme.textButton} ${theme.bgButton} rounded-lg transition`}
          >
            <Plus className="w-4 h-4" />
            Add Court
          </button>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5" aria-label="Court counts">
            {chip(counts.active, 'active', 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300')}
            {chip(counts.ready, 'ready', 'bg-amber-50 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300')}
            {chip(counts.waiting, 'waiting', 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300')}
            {counts.maintenance > 0 && chip(counts.maintenance, 'maintenance', 'bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300')}
          </div>
          <div className="flex items-center gap-2">
            <label className="inline-flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
              <ArrowDownUp className="w-3.5 h-3.5" />
              <select
                value={order}
                onChange={(e) => setOrder(e.target.value as CourtOrder)}
                aria-label="Order courts"
                className="bg-transparent text-xs font-semibold text-slate-700 dark:text-slate-200 outline-none cursor-pointer"
              >
                <option value="default">Default order</option>
                <option value="active">Active first</option>
              </select>
            </label>
            <div role="radiogroup" aria-label="Court view" className="flex p-0.5 bg-slate-100 dark:bg-slate-700 rounded-lg">
              {layoutOptions.map(o => (
                <button
                  key={o.id}
                  role="radio"
                  aria-checked={effectiveLayout === o.id}
                  onClick={() => setLayout(o.id)}
                  className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-md transition ${
                    effectiveLayout === o.id
                      ? `bg-white dark:bg-slate-800 shadow-sm ${theme.text}`
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                  }`}
                >
                  {o.icon}{o.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="p-3 md:p-4">
        {counts.ready > 0 && (
          <button
            onClick={startAllReadyCourts}
            className={`w-full mb-3 md:mb-4 inline-flex items-center justify-center gap-2 py-3 text-base font-bold text-white ${theme.bg600} rounded-xl shadow-sm hover:opacity-90 transition`}
          >
            <Play className="w-5 h-5" />
            Start {counts.ready} ready court{counts.ready !== 1 ? 's' : ''}
          </button>
        )}

        {effectiveLayout === 'grid' && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
            {courts.map(court => <CourtView key={court.id} court={court} />)}
          </div>
        )}

        {effectiveLayout === 'compact' && (
          <div className="divide-y divide-slate-100 dark:divide-slate-700 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
            {courts.map(court => (
              <div key={court.id} className={`px-3 py-2.5 flex flex-col sm:flex-row sm:items-center gap-2 ${courtState(court) === 'active' ? 'bg-white dark:bg-slate-800' : 'bg-slate-50/60 dark:bg-slate-800/60'}`}>
                <div className="flex items-center gap-2 sm:w-56 shrink-0">
                  <span className="font-semibold text-sm text-slate-800 dark:text-slate-100 truncate">{court.name}</span>
                  <StateBadge court={court} />
                </div>
                <div className="flex-1 min-w-0 truncate"><Matchup court={court} session={session} /></div>
                <div className="sm:ml-auto"><CourtActions court={court} session={session} /></div>
              </div>
            ))}
          </div>
        )}

        {effectiveLayout === 'table' && (
          <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
            <table className="w-full text-left">
              <thead className="bg-slate-50 dark:bg-slate-700/50 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="px-3 py-2 font-semibold">Court</th>
                  <th className="px-3 py-2 font-semibold">Status</th>
                  <th className="px-3 py-2 font-semibold">Match-up</th>
                  <th className="px-3 py-2 font-semibold">Timer</th>
                  <th className="px-3 py-2 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {courts.map(court => (
                  <tr key={court.id} className="bg-white dark:bg-slate-800">
                    <td className="px-3 py-2.5 text-sm font-semibold text-slate-800 dark:text-slate-100 whitespace-nowrap">{court.name}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap"><StateBadge court={court} withTimer={false} /></td>
                    <td className="px-3 py-2.5"><Matchup court={court} session={session} /></td>
                    <td className="px-3 py-2.5 whitespace-nowrap"><CourtTimer court={court} /></td>
                    <td className="px-3 py-2.5 text-right"><CourtActions court={court} session={session} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {effectiveLayout !== 'grid' && (
          <p className="mt-2 text-[11px] text-slate-400 dark:text-slate-500">Switch to Grid to swap players or rename a court.</p>
        )}
      </div>
    </div>
  );
}
