export type AccessTier = '30_days' | '60_days' | 'infinite';
export type UserRole = 'user' | 'admin';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  accessTier: AccessTier;
  accessStartDate: string; // ISO date string
  accessEndDate: string | null; // null for infinite
  createdAt: string;
  lastLoginAt: string;
  isActive: boolean;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

// For admin user management
export interface UserListItem {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  accessTier: AccessTier;
  accessEndDate: string | null;
  daysRemaining: number | null; // null for infinite
  isActive: boolean;
  lastLoginAt: string;
}
