import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, AccessTier, UserRole } from '@/types/user';
import {
  registerUser,
  loginUser,
  logoutUser,
  getUserData,
  updateUserData,
  getAllUsers,
  deleteUserData,
  onAuthStateChangeListener,
  sendPasswordReset,
  sendVerificationEmail,
  isEmailVerified,
  signInWithGoogle,
  updateSessionActivity
} from '@/lib/firebase';

// Calculate end date based on access tier
const calculateEndDate = (tier: AccessTier, startDate: Date = new Date()): string | null => {
  if (tier === 'infinite') return null;
  let days: number;
  if (tier === '5_days') days = 5;
  else if (tier === '30_days') days = 30;
  else if (tier === '60_days') days = 60;
  else days = 30; // default fallback

  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + days);
  return endDate.toISOString();
};

// Check if access is still valid
const isAccessValid = (user: User): boolean => {
  if (!user.isActive) return false;
  if (user.accessEndDate === null) return true;
  return new Date(user.accessEndDate) > new Date();
};

// Calculate days remaining
const getDaysRemaining = (endDate: string | null): number | null => {
  if (endDate === null) return null;
  const end = new Date(endDate);
  const now = new Date();
  const diff = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(0, diff);
};

// Get time remaining as formatted string
const getTimeRemaining = (endDate: string | null): string | null => {
  if (endDate === null) return null;
  const end = new Date(endDate);
  const now = new Date();
  const diffMs = end.getTime() - now.getTime();

  if (diffMs <= 0) return '0 hours';

  const hours = Math.ceil(diffMs / (1000 * 60 * 60));

  if (hours < 24) {
    return `${hours} hour${hours !== 1 ? 's' : ''}`;
  }

  const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  return `${days} day${days !== 1 ? 's' : ''}`;
};

// Session timeout in milliseconds (1 hour)
const SESSION_TIMEOUT_MS = 60 * 60 * 1000;

// Unique token for this browser's login — written to the user's Firestore doc on
// every login so a newer login elsewhere can be detected and this session logged out.
function generateSessionId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

interface AuthStore {
  // State
  currentUser: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  lastActivityAt: number | null;
  emailVerified: boolean;
  mySessionId: string | null;

  // Auth actions
  login: (email: string, password: string) => Promise<boolean>;
  register: (email: string, password: string, name: string) => Promise<boolean>;
  loginWithGoogle: () => Promise<boolean>;
  logout: () => Promise<void>;
  loginAsGuest: () => void;
  isGuest: () => boolean;

  // Session management
  updateActivity: () => Promise<void>;
  checkSessionTimeout: () => Promise<boolean>;
  isSessionValid: () => boolean;
  validateAndCleanupSession: () => Promise<void>;

  // User management (admin)
  getAllUsers: () => Promise<User[]>;
  updateUserAccess: (userId: string, tier: AccessTier) => Promise<void>;
  updateUserRole: (userId: string, role: UserRole) => Promise<void>;
  toggleUserActive: (userId: string) => Promise<void>;
  deleteUser: (userId: string) => Promise<void>;
  extendAccess: (userId: string, days: number) => Promise<void>;
  setCustomExpiryDate: (userId: string, date: string) => Promise<void>;
  forceLogoutUser: (userId: string) => Promise<void>;

  // Email verification
  sendVerificationEmail: () => Promise<void>;
  checkEmailVerification: () => void;

  // Password reset
  sendPasswordResetEmail: (email: string) => Promise<void>;

  // Initialization
  initializeAuth: () => void;

  // Helpers
  isAccessValid: () => boolean;
  getDaysRemaining: () => number | null;
  getTimeRemaining: () => string | null;
  isAdmin: () => boolean;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      currentUser: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      lastActivityAt: null,
      emailVerified: false,
      mySessionId: null,

      login: async (email: string, password: string) => {
        set({ isLoading: true, error: null });

        try {
          const user = await loginUser(email, password);

          if (!user) {
            set({
              isLoading: false,
              error: 'Failed to load user data'
            });
            return false;
          }

          if (!isAccessValid(user)) {
            set({
              isLoading: false,
              error: 'Access has expired'
            });
            return false;
          }

          const sessionId = generateSessionId();
          await updateUserData(user.id, { activeSessionId: sessionId });

          set({
            currentUser: { ...user, activeSessionId: sessionId },
            isAuthenticated: true,
            isLoading: false,
            error: null,
            lastActivityAt: Date.now(),
            emailVerified: isEmailVerified(),
            mySessionId: sessionId
          });

          return true;
        } catch (error) {
          const errorMessage = (error as Error).message;
          set({
            isLoading: false,
            error: errorMessage.includes('user-not-found')
              ? 'User not found'
              : errorMessage.includes('wrong-password')
                ? 'Invalid password'
                : errorMessage
          });
          return false;
        }
      },

      register: async (email: string, password: string, name: string) => {
        set({ isLoading: true, error: null });

        try {
          // NOTE: registerUser in firebase.ts creates users with 5_days access
          const user = await registerUser(email, password, name);

          const sessionId = generateSessionId();
          await updateUserData(user.id, { activeSessionId: sessionId });

          set({
            currentUser: { ...user, activeSessionId: sessionId },
            isAuthenticated: true,
            isLoading: false,
            error: null,
            lastActivityAt: Date.now(),
            emailVerified: false,
            mySessionId: sessionId
          });

          return true;
        } catch (error) {
          const errorMessage = (error as Error).message;
          set({
            isLoading: false,
            error: errorMessage.includes('email-already-in-use')
              ? 'Email already registered'
              : errorMessage.includes('weak-password')
                ? 'Password must be at least 6 characters'
                : errorMessage
          });
          return false;
        }
      },

      logout: async () => {
        try {
          await logoutUser();
        } catch (error) {
          console.error('Logout error:', error);
        }

        set({
          currentUser: null,
          isAuthenticated: false,
          error: null,
          lastActivityAt: null,
          emailVerified: false,
          mySessionId: null
        });
      },

      loginWithGoogle: async () => {
        set({ isLoading: true, error: null });

        try {
          const user = await signInWithGoogle();

          if (!user) {
            set({
              isLoading: false,
              error: 'Failed to load user data'
            });
            return false;
          }

          if (!isAccessValid(user)) {
            set({
              isLoading: false,
              error: 'Access has expired'
            });
            return false;
          }

          const sessionId = generateSessionId();
          await updateUserData(user.id, { activeSessionId: sessionId });

          set({
            currentUser: { ...user, activeSessionId: sessionId },
            isAuthenticated: true,
            isLoading: false,
            error: null,
            lastActivityAt: Date.now(),
            mySessionId: sessionId,
            emailVerified: true // Google accounts are pre-verified
          });

          return true;
        } catch (error) {
          const errorMessage = (error as Error).message;
          set({
            isLoading: false,
            error: errorMessage.includes('popup-closed')
              ? 'Sign-in cancelled'
              : errorMessage
          });
          return false;
        }
      },

      loginAsGuest: () => {
        const guestUser: User = {
          id: 'guest-' + Math.random().toString(36).substring(2, 15),
          email: 'guest@local',
          name: 'Guest',
          role: 'user',
          accessTier: 'infinite',
          accessStartDate: new Date().toISOString(),
          accessEndDate: null,
          createdAt: new Date().toISOString(),
          lastLoginAt: new Date().toISOString(),
          isActive: true
        };

        set({
          currentUser: guestUser,
          isAuthenticated: true,
          error: null,
          lastActivityAt: Date.now()
        });
      },

      isGuest: () => {
        const { currentUser } = get();
        return currentUser?.email === 'guest@local';
      },

      updateActivity: async () => {
        const { currentUser } = get();
        if (!currentUser || currentUser.email === 'guest@local') return;

        const now = Date.now();
        set({ lastActivityAt: now });

        // Update last activity in Firestore and Realtime Database (non-critical)
        try {
          await updateUserData(currentUser.id, {
            lastLoginAt: new Date().toISOString()
          });
          await updateSessionActivity(currentUser.id);
        } catch (error) {
          console.error('Error updating activity:', error);
        }
      },

      checkSessionTimeout: async () => {
        const { lastActivityAt, isAuthenticated, logout } = get();

        if (!isAuthenticated || !lastActivityAt) return false;

        const timeSinceActivity = Date.now() - lastActivityAt;
        if (timeSinceActivity >= SESSION_TIMEOUT_MS) {
          await logout();
          return true;
        }
        return false;
      },

      isSessionValid: () => {
        const { lastActivityAt, isAuthenticated } = get();

        if (!isAuthenticated || !lastActivityAt) return false;

        const timeSinceActivity = Date.now() - lastActivityAt;
        return timeSinceActivity < SESSION_TIMEOUT_MS;
      },

      validateAndCleanupSession: async () => {
        const { isAuthenticated, currentUser, mySessionId, logout } = get();

        if (!isAuthenticated || !currentUser) return;

        // Re-fetch user data from Firestore to check for admin changes (access expiry, etc.)
        try {
          const freshUserData = await getUserData(currentUser.id);

          // If user was deleted or access is no longer valid, logout
          if (!freshUserData || !isAccessValid(freshUserData)) {
            await logout();
            return;
          }

          // If a newer login (this account, another browser/device) has claimed the
          // session, this browser is stale — log out rather than keep two sessions alive.
          if (mySessionId && freshUserData.activeSessionId && freshUserData.activeSessionId !== mySessionId) {
            await logout();
            set({ error: 'Signed out — this account was signed in on another device.' });
            return;
          }

          // Update currentUser with fresh data if anything changed
          if (freshUserData.accessEndDate !== currentUser.accessEndDate) {
            set({ currentUser: freshUserData });
          }
        } catch (error) {
          console.error('Error validating session:', error);
          // Don't logout on network errors, just skip validation
        }
      },

      getAllUsers: async () => {
        try {
          return await getAllUsers();
        } catch (error) {
          console.error('Error getting all users:', error);
          return [];
        }
      },

      updateUserAccess: async (userId: string, tier: AccessTier) => {
        try {
          const now = new Date();
          await updateUserData(userId, {
            accessTier: tier,
            accessStartDate: now.toISOString(),
            accessEndDate: calculateEndDate(tier, now)
          });

          const { currentUser } = get();
          if (currentUser?.id === userId) {
            const updated = await getUserData(userId);
            if (updated) set({ currentUser: updated });
          }
        } catch (error) {
          console.error('Error updating user access:', error);
        }
      },

      updateUserRole: async (userId: string, role: UserRole) => {
        try {
          await updateUserData(userId, { role });

          const { currentUser } = get();
          if (currentUser?.id === userId) {
            const updated = await getUserData(userId);
            if (updated) set({ currentUser: updated });
          }
        } catch (error) {
          console.error('Error updating user role:', error);
        }
      },

      toggleUserActive: async (userId: string) => {
        try {
          const user = await getUserData(userId);
          if (!user) return;

          const { currentUser } = get();
          if (currentUser?.id === userId) return;

          await updateUserData(userId, { isActive: !user.isActive });
        } catch (error) {
          console.error('Error toggling user active status:', error);
        }
      },

      deleteUser: async (userId: string) => {
        try {
          const { currentUser } = get();
          if (currentUser?.id === userId) return;

          await deleteUserData(userId);
        } catch (error) {
          console.error('Error deleting user:', error);
        }
      },

      extendAccess: async (userId: string, days: number) => {
        try {
          const user = await getUserData(userId);
          if (!user) return;

          let newEndDate: Date;
          if (user.accessEndDate === null) {
            return;
          } else {
            const currentEnd = new Date(user.accessEndDate);
            const now = new Date();
            const baseDate = currentEnd > now ? currentEnd : now;
            newEndDate = new Date(baseDate);
            newEndDate.setDate(newEndDate.getDate() + days);
          }

          await updateUserData(userId, {
            accessEndDate: newEndDate.toISOString()
          });

          const { currentUser } = get();
          if (currentUser?.id === userId) {
            const updated = await getUserData(userId);
            if (updated) set({ currentUser: updated });
          }
        } catch (error) {
          console.error('Error extending access:', error);
        }
      },

      setCustomExpiryDate: async (userId: string, date: string) => {
        try {
          const expiryDate = new Date(date);
          expiryDate.setHours(23, 59, 59, 999);

          await updateUserData(userId, {
            accessEndDate: expiryDate.toISOString()
          });

          const { currentUser } = get();
          if (currentUser?.id === userId) {
            const updated = await getUserData(userId);
            if (updated) set({ currentUser: updated });
          }
        } catch (error) {
          console.error('Error setting custom expiry date:', error);
        }
      },

      forceLogoutUser: async (userId: string) => {
        try {
          // Set access end date to now, effectively logging them out
          await updateUserData(userId, {
            accessEndDate: new Date().toISOString()
          });
        } catch (error) {
          console.error('Error force logging out user:', error);
        }
      },

      sendVerificationEmail: async () => {
        try {
          await sendVerificationEmail();
          set({ error: null });
        } catch (error) {
          set({ error: (error as Error).message });
        }
      },

      checkEmailVerification: () => {
        set({ emailVerified: isEmailVerified() });
      },

      sendPasswordResetEmail: async (email: string) => {
        try {
          await sendPasswordReset(email);
          set({ error: null });
        } catch (error) {
          set({ error: (error as Error).message });
        }
      },

      initializeAuth: () => {
        const unsubscribe = onAuthStateChangeListener(async (firebaseUser) => {
          if (firebaseUser) {
            const userData = await getUserData(firebaseUser.uid);
            if (userData && isAccessValid(userData)) {
              set({
                currentUser: userData,
                isAuthenticated: true,
                lastActivityAt: Date.now(),
                emailVerified: firebaseUser.emailVerified
              });
            } else {
              set({
                currentUser: null,
                isAuthenticated: false,
                lastActivityAt: null
              });
            }
          } else {
            set({
              currentUser: null,
              isAuthenticated: false,
              lastActivityAt: null,
              emailVerified: false
            });
          }
        });

        return unsubscribe;
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

      getTimeRemaining: () => {
        const { currentUser } = get();
        if (!currentUser) return null;
        return getTimeRemaining(currentUser.accessEndDate);
      },

      isAdmin: () => {
        const { currentUser } = get();
        return currentUser?.role === 'admin';
      }
    }),
    {
      name: 'kitchenboss-auth'
    }
  )
);
