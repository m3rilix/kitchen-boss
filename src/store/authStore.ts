import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, AccessTier, UserRole } from '@/types/user';

// Generate unique ID
const generateId = () => Math.random().toString(36).substring(2, 15);

// Calculate end date based on access tier
const calculateEndDate = (tier: AccessTier, startDate: Date = new Date()): string | null => {
  if (tier === 'infinite') return null;
  const days = tier === '30_days' ? 30 : 60;
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + days);
  return endDate.toISOString();
};

// Check if access is still valid
const isAccessValid = (user: User): boolean => {
  if (!user.isActive) return false;
  if (user.accessEndDate === null) return true; // infinite
  return new Date(user.accessEndDate) > new Date();
};

// Calculate days remaining
const getDaysRemaining = (endDate: string | null): number | null => {
  if (endDate === null) return null; // infinite
  const end = new Date(endDate);
  const now = new Date();
  const diff = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(0, diff);
};

// Session timeout in milliseconds (1 hour)
const SESSION_TIMEOUT_MS = 60 * 60 * 1000;

// Generate a unique session ID
const generateSessionId = () => `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

interface AuthStore {
  // State
  currentUser: User | null;
  users: User[];
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  lastActivityAt: number | null;
  sessionId: string | null;

  // Auth actions
  login: (email: string, password: string) => Promise<boolean>;
  register: (email: string, password: string, name: string) => Promise<boolean>;
  loginAsGuest: () => void;
  logout: () => Promise<void>;
  isGuest: () => boolean;
  
  // Session management
  updateActivity: () => Promise<void>;
  checkSessionTimeout: () => Promise<boolean>;
  isSessionValid: () => Promise<boolean>;
  validateAndCleanupSession: () => Promise<void>;
  
  // User management (admin)
  getAllUsers: () => User[];
  updateUserAccess: (userId: string, tier: AccessTier) => void;
  updateUserRole: (userId: string, role: UserRole) => void;
  toggleUserActive: (userId: string) => void;
  deleteUser: (userId: string) => void;
  extendAccess: (userId: string, days: number) => void;
  forceLogoutUser: (userId: string) => Promise<void>;
  
  // Helpers
  isAccessValid: () => boolean;
  getDaysRemaining: () => number | null;
  isAdmin: () => boolean;
}

// Simple password storage (in production, use proper hashing)
interface StoredCredentials {
  [email: string]: string;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      currentUser: null,
      users: [
        // Default admin user
        {
          id: 'admin-001',
          email: 'admin@kitchenboss.app',
          name: 'Admin',
          role: 'admin' as UserRole,
          accessTier: 'infinite' as AccessTier,
          accessStartDate: new Date().toISOString(),
          accessEndDate: null,
          createdAt: new Date().toISOString(),
          lastLoginAt: new Date().toISOString(),
          isActive: true,
        },
        // Demo accounts (always available for login, but hidden in prod UI)
        {
          id: 'demo-001',
          email: 'demo1@kitchenboss.app',
          name: 'Demo User 1',
          role: 'user' as UserRole,
          accessTier: '30_days' as AccessTier,
          accessStartDate: new Date().toISOString(),
          accessEndDate: calculateEndDate('30_days'),
          createdAt: new Date().toISOString(),
          lastLoginAt: new Date().toISOString(),
          isActive: true,
        },
        {
          id: 'demo-002',
          email: 'demo2@kitchenboss.app',
          name: 'Demo User 2',
          role: 'user' as UserRole,
          accessTier: '30_days' as AccessTier,
          accessStartDate: new Date().toISOString(),
          accessEndDate: calculateEndDate('30_days'),
          createdAt: new Date().toISOString(),
          lastLoginAt: new Date().toISOString(),
          isActive: true,
        },
        {
          id: 'demo-003',
          email: 'demo3@kitchenboss.app',
          name: 'Demo User 3',
          role: 'user' as UserRole,
          accessTier: '60_days' as AccessTier,
          accessStartDate: new Date().toISOString(),
          accessEndDate: calculateEndDate('60_days'),
          createdAt: new Date().toISOString(),
          lastLoginAt: new Date().toISOString(),
          isActive: true,
        },
        {
          id: 'demo-004',
          email: 'demo4@kitchenboss.app',
          name: 'Demo User 4',
          role: 'user' as UserRole,
          accessTier: '60_days' as AccessTier,
          accessStartDate: new Date().toISOString(),
          accessEndDate: calculateEndDate('60_days'),
          createdAt: new Date().toISOString(),
          lastLoginAt: new Date().toISOString(),
          isActive: true,
        },
      ],
      isAuthenticated: false,
      isLoading: false,
      error: null,
      lastActivityAt: null,
      sessionId: null,

      login: async (email: string, password: string) => {
        set({ isLoading: true, error: null });
        
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const { users } = get();
        const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());
        
        if (!user) {
          set({ isLoading: false, error: 'User not found' });
          return false;
        }

        // Check if user is already logged in elsewhere (single session enforcement)
        try {
          const { getActiveSession } = await import('@/lib/firebase');
          const existingSession = await getActiveSession(user.id);
          
          if (existingSession) {
            // Check if the existing session is still active (within timeout)
            const timeSinceActivity = Date.now() - existingSession.lastActivity;
            if (timeSinceActivity < SESSION_TIMEOUT_MS) {
              set({ isLoading: false, error: 'This account is already logged in on another device/browser. Please wait for that session to expire or log out from there.' });
              return false;
            }
          }
        } catch (error) {
          console.error('Error checking active session:', error);
          // Continue with login if Firebase check fails
        }

        // Get stored credentials
        const storedCreds = JSON.parse(localStorage.getItem('kitchenboss-credentials') || '{}') as StoredCredentials;
        
        // Default passwords for built-in accounts
        const defaultPasswords: Record<string, string> = {
          'admin@kitchenboss.app': 'admin123!!',
          'demo1@kitchenboss.app': 'Kb7xP2m',
          'demo2@kitchenboss.app': 'Qw9Tn4k',
          'demo3@kitchenboss.app': 'Ry5Hj8s',
          'demo4@kitchenboss.app': 'Lm3Vb6p',
        };
        
        // Check password (use stored or default)
        const storedPassword = storedCreds[email.toLowerCase()] || defaultPasswords[email.toLowerCase()] || null;
        
        if (storedPassword !== password) {
          set({ isLoading: false, error: 'Invalid password' });
          return false;
        }

        if (!user.isActive) {
          set({ isLoading: false, error: 'Account is deactivated' });
          return false;
        }

        if (!isAccessValid(user)) {
          set({ isLoading: false, error: 'Access has expired' });
          return false;
        }

        // Update last login
        const updatedUser = { ...user, lastLoginAt: new Date().toISOString() };
        const updatedUsers = users.map(u => u.id === user.id ? updatedUser : u);

        // Create new session
        const newSessionId = generateSessionId();
        const now = Date.now();
        
        // Store active session in Firebase
        try {
          const { storeActiveSession } = await import('@/lib/firebase');
          await storeActiveSession(user.id, {
            sessionId: newSessionId,
            lastActivity: now,
            userAgent: navigator.userAgent
          });
        } catch (error) {
          console.error('Error storing active session:', error);
          // Continue with login even if Firebase storage fails
        }

        set({ 
          currentUser: updatedUser, 
          users: updatedUsers,
          isAuthenticated: true, 
          isLoading: false,
          error: null,
          sessionId: newSessionId,
          lastActivityAt: now
        });
        
        return true;
      },

      register: async (email: string, password: string, name: string) => {
        set({ isLoading: true, error: null });
        
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const { users } = get();
        
        // Check if email exists
        if (users.some(u => u.email.toLowerCase() === email.toLowerCase())) {
          set({ isLoading: false, error: 'Email already registered' });
          return false;
        }

        // Create new user with 30-day trial
        const now = new Date();
        const newUser: User = {
          id: generateId(),
          email: email.toLowerCase(),
          name,
          role: 'user',
          accessTier: '30_days',
          accessStartDate: now.toISOString(),
          accessEndDate: calculateEndDate('30_days', now),
          createdAt: now.toISOString(),
          lastLoginAt: now.toISOString(),
          isActive: true,
        };

        // Store password
        const storedCreds = JSON.parse(localStorage.getItem('kitchenboss-credentials') || '{}') as StoredCredentials;
        storedCreds[email.toLowerCase()] = password;
        localStorage.setItem('kitchenboss-credentials', JSON.stringify(storedCreds));

        set({ 
          users: [...users, newUser],
          currentUser: newUser,
          isAuthenticated: true,
          isLoading: false,
          error: null
        });

        return true;
      },

      loginAsGuest: () => {
        const guestUser: User = {
          id: 'guest-' + generateId(),
          email: 'guest@local',
          name: 'Guest',
          role: 'user',
          accessTier: 'infinite',
          accessStartDate: new Date().toISOString(),
          accessEndDate: null,
          createdAt: new Date().toISOString(),
          lastLoginAt: new Date().toISOString(),
          isActive: true,
        };
        
        set({ 
          currentUser: guestUser,
          isAuthenticated: true,
          error: null
        });
      },

      logout: async () => {
        const { currentUser } = get();
        
        // Remove active session from Firebase
        if (currentUser) {
          try {
            const { removeActiveSession } = await import('@/lib/firebase');
            await removeActiveSession(currentUser.id);
          } catch (error) {
            console.error('Error removing active session:', error);
          }
        }
        
        set({ 
          currentUser: null, 
          isAuthenticated: false, 
          error: null,
          sessionId: null,
          lastActivityAt: null
        });
      },

      isGuest: () => {
        const { currentUser } = get();
        return currentUser?.email === 'guest@local';
      },
      
      // Session management
      updateActivity: async () => {
        const { currentUser, sessionId } = get();
        if (!currentUser || !sessionId) return;
        
        const now = Date.now();
        
        // Update local state
        set({ lastActivityAt: now });
        
        // Update Firebase session activity
        try {
          const { updateSessionActivity } = await import('@/lib/firebase');
          await updateSessionActivity(currentUser.id);
        } catch (error) {
          console.error('Error updating session activity:', error);
          // Don't throw error to avoid disrupting user experience
        }
      },
      
      checkSessionTimeout: async () => {
        const { lastActivityAt, isAuthenticated, logout } = get();
        
        if (!isAuthenticated || !lastActivityAt) return false;
        
        const timeSinceActivity = Date.now() - lastActivityAt;
        if (timeSinceActivity >= SESSION_TIMEOUT_MS) {
          await logout();
          return true; // Session timed out
        }
        return false;
      },
      
      isSessionValid: async () => {
        const { currentUser, sessionId, lastActivityAt } = get();
        
        if (!currentUser || !sessionId) return false;
        
        // Check timeout
        if (lastActivityAt) {
          const timeSinceActivity = Date.now() - lastActivityAt;
          if (timeSinceActivity >= SESSION_TIMEOUT_MS) return false;
        }
        
        // Check if this session is still the active one in Firebase
        try {
          const { getActiveSession } = await import('@/lib/firebase');
          const storedSession = await getActiveSession(currentUser.id);
          
          if (!storedSession || storedSession.sessionId !== sessionId) {
            return false; // Session was invalidated (logged in elsewhere)
          }
        } catch (error) {
          console.error('Error validating session:', error);
          // Return true if Firebase check fails to avoid disrupting user experience
        }
        
        return true;
      },

      validateAndCleanupSession: async () => {
        const { isAuthenticated, currentUser, logout } = get();
        
        if (!isAuthenticated || !currentUser) return;
        
        // Check if session is still valid
        const isValid = await get().isSessionValid();
        
        if (!isValid) {
          // Session is no longer valid (force logged out by admin), logout user
          await logout();
        }
      },

      getAllUsers: () => {
        return get().users;
      },

      updateUserAccess: (userId: string, tier: AccessTier) => {
        const { users } = get();
        const now = new Date();
        const updatedUsers = users.map(u => 
          u.id === userId 
            ? { 
                ...u, 
                accessTier: tier,
                accessStartDate: now.toISOString(),
                accessEndDate: calculateEndDate(tier, now)
              } 
            : u
        );
        set({ users: updatedUsers });
        
        // Update current user if it's the same
        const { currentUser } = get();
        if (currentUser?.id === userId) {
          const updated = updatedUsers.find(u => u.id === userId);
          if (updated) set({ currentUser: updated });
        }
      },

      updateUserRole: (userId: string, role: UserRole) => {
        const { users } = get();
        const updatedUsers = users.map(u => 
          u.id === userId ? { ...u, role } : u
        );
        set({ users: updatedUsers });
        
        const { currentUser } = get();
        if (currentUser?.id === userId) {
          const updated = updatedUsers.find(u => u.id === userId);
          if (updated) set({ currentUser: updated });
        }
      },

      toggleUserActive: (userId: string) => {
        const { users, currentUser } = get();
        
        // Prevent deactivating yourself
        if (currentUser?.id === userId) return;
        
        const updatedUsers = users.map(u => 
          u.id === userId ? { ...u, isActive: !u.isActive } : u
        );
        set({ users: updatedUsers });
      },

      deleteUser: (userId: string) => {
        const { users, currentUser } = get();
        
        // Prevent deleting yourself
        if (currentUser?.id === userId) return;
        
        const updatedUsers = users.filter(u => u.id !== userId);
        set({ users: updatedUsers });
        
        // Remove credentials
        const user = users.find(u => u.id === userId);
        if (user) {
          const storedCreds = JSON.parse(localStorage.getItem('kitchenboss-credentials') || '{}') as StoredCredentials;
          delete storedCreds[user.email.toLowerCase()];
          localStorage.setItem('kitchenboss-credentials', JSON.stringify(storedCreds));
        }
      },

      extendAccess: (userId: string, days: number) => {
        const { users } = get();
        const user = users.find(u => u.id === userId);
        if (!user) return;

        let newEndDate: Date;
        if (user.accessEndDate === null) {
          // Already infinite, no change needed
          return;
        } else {
          const currentEnd = new Date(user.accessEndDate);
          const now = new Date();
          // Extend from current end date or now, whichever is later
          const baseDate = currentEnd > now ? currentEnd : now;
          newEndDate = new Date(baseDate);
          newEndDate.setDate(newEndDate.getDate() + days);
        }

        const updatedUsers = users.map(u => 
          u.id === userId 
            ? { ...u, accessEndDate: newEndDate.toISOString() } 
            : u
        );
        set({ users: updatedUsers });
        
        const { currentUser } = get();
        if (currentUser?.id === userId) {
          const updated = updatedUsers.find(u => u.id === userId);
          if (updated) set({ currentUser: updated });
        }
      },

      forceLogoutUser: async (userId: string) => {
        try {
          const { removeActiveSession } = await import('@/lib/firebase');
          await removeActiveSession(userId);
        } catch (error) {
          console.error('Error force logging out user:', error);
          throw error;
        }
      },

      isAccessValid: () => {
        const { currentUser } = get();
        if (!currentUser) return false;
        return isAccessValid(currentUser);
      },

      getDaysRemaining: () => {
        const { currentUser } = get();
        if (!currentUser) return null;
        return getDaysRemaining(currentUser.accessEndDate);
      },

      isAdmin: () => {
        const { currentUser } = get();
        return currentUser?.role === 'admin';
      },
    }),
    {
      name: 'kitchenboss-auth',
      merge: (persistedState: unknown, currentState: AuthStore) => {
        const persisted = persistedState as Partial<AuthStore> | undefined;
        
        // Default users that should always exist
        const defaultUsers: User[] = [
          {
            id: 'admin-001',
            email: 'admin@kitchenboss.app',
            name: 'Admin',
            role: 'admin' as UserRole,
            accessTier: 'infinite' as AccessTier,
            accessStartDate: new Date().toISOString(),
            accessEndDate: null,
            createdAt: new Date().toISOString(),
            lastLoginAt: new Date().toISOString(),
            isActive: true,
          },
          {
            id: 'demo-001',
            email: 'demo1@kitchenboss.app',
            name: 'Demo User 1',
            role: 'user' as UserRole,
            accessTier: '30_days' as AccessTier,
            accessStartDate: new Date().toISOString(),
            accessEndDate: calculateEndDate('30_days'),
            createdAt: new Date().toISOString(),
            lastLoginAt: new Date().toISOString(),
            isActive: true,
          },
          {
            id: 'demo-002',
            email: 'demo2@kitchenboss.app',
            name: 'Demo User 2',
            role: 'user' as UserRole,
            accessTier: '30_days' as AccessTier,
            accessStartDate: new Date().toISOString(),
            accessEndDate: calculateEndDate('30_days'),
            createdAt: new Date().toISOString(),
            lastLoginAt: new Date().toISOString(),
            isActive: true,
          },
          {
            id: 'demo-003',
            email: 'demo3@kitchenboss.app',
            name: 'Demo User 3',
            role: 'user' as UserRole,
            accessTier: '60_days' as AccessTier,
            accessStartDate: new Date().toISOString(),
            accessEndDate: calculateEndDate('60_days'),
            createdAt: new Date().toISOString(),
            lastLoginAt: new Date().toISOString(),
            isActive: true,
          },
          {
            id: 'demo-004',
            email: 'demo4@kitchenboss.app',
            name: 'Demo User 4',
            role: 'user' as UserRole,
            accessTier: '60_days' as AccessTier,
            accessStartDate: new Date().toISOString(),
            accessEndDate: calculateEndDate('60_days'),
            createdAt: new Date().toISOString(),
            lastLoginAt: new Date().toISOString(),
            isActive: true,
          },
        ];
        
        // Merge persisted users with default users (ensure defaults always exist)
        const persistedUsers = persisted?.users || [];
        const mergedUsers = [...defaultUsers];
        
        // Add any non-default users from persisted state
        persistedUsers.forEach(user => {
          if (!defaultUsers.some(d => d.id === user.id)) {
            mergedUsers.push(user);
          }
        });
        
        return {
          ...currentState,
          ...persisted,
          users: mergedUsers,
        };
      },
    }
  )
);
