import { useState, useEffect, Component, type ErrorInfo, type ReactNode } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useSessionStore } from '@/store/sessionStore';
import { useAuthStore } from '@/store/authStore';
import { LoginPage } from '@/components/LoginPage';
import { AdminPage } from '@/components/AdminPage';
import { SessionSetupPage } from '@/components/SessionSetupPage';
import { SessionViewPage } from '@/components/SessionViewPage';
import { SharedSessionView } from '@/components/SharedSessionView';
import { SharedScoreboard } from '@/components/SharedScoreboard';
import { SessionTransferredModal } from '@/components/SessionTransferModal';
import { getShareCodeFromUrl, clearShareCodeFromUrl, subscribeToSession, onSessionChange } from '@/lib/firebase';
import type { Session } from '@/types';

// Error boundary to catch render errors in shared session view
class ShareViewErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[SHARE DEBUG] ErrorBoundary caught render error:', error.message);
    console.error('[SHARE DEBUG] ErrorBoundary component stack:', errorInfo.componentStack);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-6 max-w-md text-center">
            <h2 className="text-xl font-bold text-red-600 mb-2">Share View Error</h2>
            <p className="text-slate-600 mb-2">Something went wrong rendering the shared session.</p>
            <pre className="text-xs text-left bg-slate-100 p-3 rounded overflow-auto max-h-40 mb-4">{this.state.error?.message}</pre>
            <p className="text-xs text-slate-500">Check browser console for [SHARE DEBUG] logs</p>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function App() {
  const { session, shareCode, syncToFirebase } = useSessionStore();
  const { isAuthenticated, isAccessValid, isAdmin, updateActivity, checkSessionTimeout, validateAndCleanupSession, currentUser, sessionId, logout, initializeAuth } = useAuthStore();
  const [sharedSession, setSharedSession] = useState<Session | null>(null);
  // Initialize synchronously so first render already knows we're in share mode
  // (prevents flash of SessionViewPage with corrupted localStorage data)
  const [viewingShareCode, setViewingShareCode] = useState<string | null>(() => getShareCodeFromUrl());
  const [sessionExpired, setSessionExpired] = useState(false);
  const [sessionTransferred, setSessionTransferred] = useState(false);

  // Initialize Firebase Auth listener on mount
  useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);

  // Session timeout check and validation - runs every minute
  useEffect(() => {
    if (!isAuthenticated) return;
    
    const checkTimeout = async () => {
      // First check if session is still valid (not force logged out by admin)
      await validateAndCleanupSession();
      
      // Then check for timeout
      const timedOut = await checkSessionTimeout();
      if (timedOut) {
        setSessionExpired(true);
      }
    };
    
    // Check immediately
    checkTimeout();
    
    // Check every minute
    const interval = setInterval(checkTimeout, 60 * 1000);
    
    return () => clearInterval(interval);
  }, [isAuthenticated, checkSessionTimeout, validateAndCleanupSession]);

  // Firebase Auth handles session management automatically
  // No need for manual session transfer detection

  // Update activity on user interactions
  useEffect(() => {
    if (!isAuthenticated) return;
    
    const handleActivity = () => {
      updateActivity();
    };
    
    // Track various user activities
    window.addEventListener('click', handleActivity);
    window.addEventListener('keydown', handleActivity);
    window.addEventListener('scroll', handleActivity);
    window.addEventListener('mousemove', handleActivity);
    
    // Initial activity update
    updateActivity();
    
    return () => {
      window.removeEventListener('click', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      window.removeEventListener('scroll', handleActivity);
      window.removeEventListener('mousemove', handleActivity);
    };
  }, [isAuthenticated, updateActivity]);

  // Subscribe to real-time updates when viewing a shared session
  useEffect(() => {
    console.log('[SHARE DEBUG] Share subscription effect - viewingShareCode:', viewingShareCode);
    if (viewingShareCode) {
      const unsubscribe = subscribeToSession(viewingShareCode, (sessionData) => {
        console.log('[SHARE DEBUG] subscribeToSession callback - sessionData:', sessionData ? 'received' : 'null', sessionData ? { id: sessionData.id, name: sessionData.name } : null);
        setSharedSession(sessionData);
      });
      return () => unsubscribe();
    }
  }, [viewingShareCode]);

  // Sync to Firebase whenever session changes (if sharing is active)
  useEffect(() => {
    if (shareCode && session) {
      syncToFirebase();
    }
  }, [session, shareCode, syncToFirebase]);

  // If viewing a shared session, show read-only view (bypass login)
  if (sharedSession || viewingShareCode) {
    console.log('[SHARE DEBUG] Rendering share view - sharedSession:', !!sharedSession, 'viewingShareCode:', viewingShareCode);
    if (!sharedSession) {
      // Loading state while fetching from Firebase
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center">
          <div className="text-center">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-slate-600">Loading session...</p>
          </div>
        </div>
      );
    }
    // Session ended — show scoreboard only
    if (sharedSession.isActive === false) {
      return (
        <ShareViewErrorBoundary>
          <SharedScoreboard session={sharedSession} />
        </ShareViewErrorBoundary>
      );
    }

    return (
      <ShareViewErrorBoundary>
        <SharedSessionView
          session={sharedSession}
          onExit={() => {
            setSharedSession(null);
            setViewingShareCode(null);
            clearShareCodeFromUrl();
          }}
        />
      </ShareViewErrorBoundary>
    );
  }

  // Reset session transferred state when user logs out
  useEffect(() => {
    if (!isAuthenticated && sessionTransferred) {
      setSessionTransferred(false);
    }
  }, [isAuthenticated, sessionTransferred]);

  // Show login if not authenticated
  if (!isAuthenticated) {
    return <LoginPage />;
  }

  // Show session expired message
  if (sessionExpired) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-slate-800 rounded-xl p-6 max-w-md text-center">
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">Session Expired</h2>
          <p className="text-slate-600 dark:text-slate-400 mb-4">
            Your session has expired due to inactivity. Please log in again.
          </p>
          <button
            onClick={async () => {
              setSessionExpired(false);
              await useAuthStore.getState().logout();
            }}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition"
          >
            Log In Again
          </button>
        </div>
      </div>
    );
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
            onClick={async () => await useAuthStore.getState().logout()}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition"
          >
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  // Main app with routing
  return (
    <>
      <Routes>
        {/* Admin route - protected, only accessible by admin users */}
        <Route path="/admin" element={
          isAdmin() ? <AdminPage onBack={() => window.history.back()} /> : <Navigate to="/session" replace />
        } />
        
        {/* Create session route */}
        <Route path="/create-session" element={<SessionSetupPage />} />
        
        {/* Active session route */}
        <Route path="/session" element={<SessionViewPage onAdminClick={() => window.location.href = '/admin'} />} />
        
        {/* Default route - redirect based on session state */}
        <Route path="/" element={
          session ? <Navigate to="/session" replace /> : <Navigate to="/create-session" replace />
        } />
      </Routes>

      {/* Session Transferred Modal */}
      {sessionTransferred && (
        <SessionTransferredModal
          onClose={async () => {
            setSessionTransferred(false);
            await logout();
          }}
        />
      )}
    </>
  );
}

export default App;
