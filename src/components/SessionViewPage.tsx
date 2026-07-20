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
import { Plus, Layers, Users, LayoutGrid, ScrollText, GripVertical } from 'lucide-react';

type MobileSection = 'courts' | 'queue' | 'players' | 'log';
type PanelId = MobileSection;

interface PanelLayout {
  main: PanelId[];
  sidebar: PanelId[];
}

const DEFAULT_LAYOUT: PanelLayout = {
  main: ['courts'],
  sidebar: ['queue', 'players', 'log'],
};

function loadLayout(): PanelLayout {
  try {
    const saved = localStorage.getItem('kb-panel-layout');
    if (!saved) return DEFAULT_LAYOUT;
    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed.main) || !Array.isArray(parsed.sidebar)) return DEFAULT_LAYOUT;
    // Make sure all 4 panels are present (handles schema changes)
    const all: PanelId[] = ['courts', 'queue', 'players', 'log'];
    const found = new Set([...parsed.main, ...parsed.sidebar]);
    if (!all.every(p => found.has(p))) return DEFAULT_LAYOUT;
    return parsed;
  } catch {
    return DEFAULT_LAYOUT;
  }
}

const MOBILE_TABS: { id: MobileSection; label: string; icon: React.ReactNode }[] = [
  { id: 'courts',  label: 'Courts',  icon: <LayoutGrid className="w-5 h-5" /> },
  { id: 'queue',   label: 'Queue',   icon: <Layers className="w-5 h-5" /> },
  { id: 'players', label: 'Players', icon: <Users className="w-5 h-5" /> },
  { id: 'log',     label: 'Log',     icon: <ScrollText className="w-5 h-5" /> },
];

interface DropZoneProps {
  col: 'main' | 'sidebar';
  idx: number;
  dragging: PanelId | null;
  dropTarget: { col: 'main' | 'sidebar'; idx: number } | null;
  setDropTarget: (t: { col: 'main' | 'sidebar'; idx: number } | null) => void;
  onDrop: (col: 'main' | 'sidebar', idx: number) => void;
}

function DropZone({ col, idx, dragging, dropTarget, setDropTarget, onDrop }: DropZoneProps) {
  if (!dragging) return null;
  const isActive = dropTarget?.col === col && dropTarget?.idx === idx;
  return (
    <div
      className={`rounded-lg transition-all duration-150 ${
        isActive
          ? 'h-8 bg-blue-100 dark:bg-blue-900/30 border-2 border-dashed border-blue-400'
          : 'h-2'
      }`}
      onDragOver={(e) => { e.preventDefault(); setDropTarget({ col, idx }); }}
      onDrop={(e) => { e.preventDefault(); onDrop(col, idx); }}
    />
  );
}

interface SessionViewPageProps {
  onAdminClick: () => void;
}

export function SessionViewPage({ onAdminClick }: SessionViewPageProps) {
  const { session, addCourt } = useSessionStore();
  const theme = useThemeClasses();
  const [activeTab, setActiveTab] = useState<MobileSection>('courts');
  const [layout, setLayoutState] = useState<PanelLayout>(loadLayout);
  const [dragging, setDragging] = useState<PanelId | null>(null);
  const [dropTarget, setDropTarget] = useState<{ col: 'main' | 'sidebar'; idx: number } | null>(null);

  if (!session) return <Navigate to="/create-session" replace />;

  const saveLayout = (l: PanelLayout) => {
    setLayoutState(l);
    localStorage.setItem('kb-panel-layout', JSON.stringify(l));
  };

  const handleDrop = (col: 'main' | 'sidebar', idx: number) => {
    if (!dragging) return;
    const newLayout: PanelLayout = {
      main: layout.main.filter(p => p !== dragging),
      sidebar: layout.sidebar.filter(p => p !== dragging),
    };
    newLayout[col] = [
      ...newLayout[col].slice(0, idx),
      dragging,
      ...newLayout[col].slice(idx),
    ];
    saveLayout(newLayout);
    setDragging(null);
    setDropTarget(null);
  };

  const startDrag = (id: PanelId, e: React.DragEvent) => {
    e.dataTransfer.effectAllowed = 'move';
    setDragging(id);
  };

  const endDrag = () => {
    setDragging(null);
    setDropTarget(null);
  };

  const scrollTo = (id: MobileSection) => {
    setActiveTab(id);
    document.getElementById(`section-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const renderPanelContent = (id: PanelId): React.ReactNode => {
    switch (id) {
      case 'courts':
        return (
          <div className="space-y-4">
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
        );
      case 'queue':
        return session.rotationMode === 'doubles' ? <DoublesQueue /> : <PlayerQueue />;
      case 'players':
        return <PlayerList />;
      case 'log':
        return <ActivityLog />;
    }
  };

  const renderColumn = (col: 'main' | 'sidebar', panels: PanelId[]) => {
    const isEmpty = panels.length === 0;
    return (
      <div
        className={`space-y-1 min-h-16 rounded-xl transition-all ${
          dragging && isEmpty
            ? 'border-2 border-dashed border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/40 p-6 flex items-center justify-center'
            : ''
        }`}
        onDragOver={(e) => { if (dragging && isEmpty) { e.preventDefault(); setDropTarget({ col, idx: 0 }); } }}
        onDrop={(e) => { if (dragging && isEmpty) { e.preventDefault(); handleDrop(col, 0); } }}
      >
        {dragging && isEmpty ? (
          <p className="text-sm text-slate-400 select-none">Drop panel here</p>
        ) : (
          <>
            <DropZone col={col} idx={0} dragging={dragging} dropTarget={dropTarget} setDropTarget={setDropTarget} onDrop={handleDrop} />
            {panels.map((panelId, i) => (
              <div key={panelId}>
                <div
                  id={`section-${panelId}`}
                  className={`scroll-mt-20 transition-opacity duration-150 ${dragging === panelId ? 'opacity-30 pointer-events-none' : ''}`}
                >
                  {/* Drag handle strip — desktop only */}
                  <div
                    draggable
                    onDragStart={(e) => startDrag(panelId, e)}
                    onDragEnd={endDrag}
                    className="group hidden lg:flex items-center justify-center h-5 mb-1 rounded cursor-grab active:cursor-grabbing hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    title="Drag to reposition panel"
                  >
                    <GripVertical className="w-4 h-4 text-slate-200 dark:text-slate-700 group-hover:text-slate-400 dark:group-hover:text-slate-400 transition-colors" />
                  </div>
                  {renderPanelContent(panelId)}
                </div>
                <DropZone col={col} idx={i + 1} dragging={dragging} dropTarget={dropTarget} setDropTarget={setDropTarget} onDrop={handleDrop} />
              </div>
            ))}
          </>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <SessionHeader onAdminClick={onAdminClick} />

      <main className="container mx-auto px-4 py-6 pb-24 lg:pb-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            {renderColumn('main', layout.main)}
          </div>
          <div>
            {renderColumn('sidebar', layout.sidebar)}
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
