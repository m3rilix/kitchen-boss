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

interface AuthStore {
  // State
  currentUser: User | null;
  users: User[];
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  // Auth actions
  login: (email: string, password: string) => Promise<boolean>;
  register: (email: string, password: string, name: string) => Promise<boolean>;
  loginAsGuest: () => void;
  logout: () => void;
  isGuest: () => boolean;
  
  // User management (admin)
  getAllUsers: () => User[];
  updateUserAccess: (userId: string, tier: AccessTier) => void;
  updateUserRole: (userId: string, role: UserRole) => void;
  toggleUserActive: (userId: string) => void;
  deleteUser: (userId: string) => void;
  extendAccess: (userId: string, days: number) => void;
  
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
        }
      ],
      isAuthenticated: false,
      isLoading: false,
      error: null,

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

        // Get stored credentials
        const storedCreds = JSON.parse(localStorage.getItem('kitchenboss-credentials') || '{}') as StoredCredentials;
        
        // Check password (default admin password is 'admin123')
        const storedPassword = storedCreds[email.toLowerCase()] || (email.toLowerCase() === 'admin@kitchenboss.app' ? 'admin123' : null);
        
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

        set({ 
          currentUser: updatedUser, 
          users: updatedUsers,
          isAuthenticated: true, 
          isLoading: false,
          error: null
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

      logout: () => {
        set({ currentUser: null, isAuthenticated: false, error: null });
      },

      isGuest: () => {
        const { currentUser } = get();
        return currentUser?.email === 'guest@local';
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
    }
  )
);
