import { useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import { useThemeClasses } from '@/store/themeStore';
import type { AccessTier, UserRole } from '@/types/user';
import { 
  Users, Shield, Clock, Infinity, Calendar, 
  MoreVertical, Trash2, UserCog, ArrowLeft,
  CheckCircle, XCircle, Plus
} from 'lucide-react';
import { SettingsDropdown } from './SettingsDropdown';

interface AdminPageProps {
  onBack: () => void;
}

export function AdminPage({ onBack }: AdminPageProps) {
  const { 
    getAllUsers, 
    updateUserAccess, 
    updateUserRole, 
    toggleUserActive, 
    deleteUser,
    extendAccess,
    currentUser 
  } = useAuthStore();
  const theme = useThemeClasses();
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [showExtendModal, setShowExtendModal] = useState<string | null>(null);
  const [extendDays, setExtendDays] = useState(30);

  const users = getAllUsers();

  const getDaysRemaining = (endDate: string | null): number | null => {
    if (endDate === null) return null;
    const end = new Date(endDate);
    const now = new Date();
    const diff = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return Math.max(0, diff);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getAccessBadge = (tier: AccessTier, endDate: string | null) => {
    const daysLeft = getDaysRemaining(endDate);
    
    if (tier === 'infinite') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 text-xs font-medium rounded-full">
          <Infinity className="w-3 h-3" />
          Unlimited
        </span>
      );
    }
    
    if (daysLeft === null || daysLeft <= 0) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 text-xs font-medium rounded-full">
          <XCircle className="w-3 h-3" />
          Expired
        </span>
      );
    }
    
    if (daysLeft <= 7) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 text-xs font-medium rounded-full">
          <Clock className="w-3 h-3" />
          {daysLeft}d left
        </span>
      );
    }
    
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 ${theme.badgeBg} ${theme.badgeText} text-xs font-medium rounded-full`}>
        <Calendar className="w-3 h-3" />
        {daysLeft}d left
      </span>
    );
  };

  const handleExtendAccess = (userId: string) => {
    extendAccess(userId, extendDays);
    setShowExtendModal(null);
    setExtendDays(30);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors">
      {/* Header */}
      <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={onBack}
                className="p-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className={`w-10 h-10 ${theme.bg100} rounded-full flex items-center justify-center`}>
                <Shield className={`w-5 h-5 ${theme.text}`} />
              </div>
              <div>
                <h1 className="font-bold text-slate-800 dark:text-slate-100">Admin Panel</h1>
                <p className="text-xs text-slate-500 dark:text-slate-400">Manage users and access</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-slate-600 dark:text-slate-400 flex items-center gap-2">
                <Users className="w-4 h-4" />
                {users.length} users
              </span>
              <SettingsDropdown />
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="container mx-auto px-4 py-6">
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          {/* Table Header */}
          <div className="grid grid-cols-12 gap-4 p-4 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            <div className="col-span-3">User</div>
            <div className="col-span-2">Role</div>
            <div className="col-span-2">Access</div>
            <div className="col-span-2">Status</div>
            <div className="col-span-2">Last Login</div>
            <div className="col-span-1">Actions</div>
          </div>

          {/* User Rows */}
          <div className="divide-y divide-slate-100 dark:divide-slate-700">
            {users.map((user) => (
              <div 
                key={user.id} 
                className={`grid grid-cols-12 gap-4 p-4 items-center hover:bg-slate-50 dark:hover:bg-slate-700/50 transition ${
                  !user.isActive ? 'opacity-60' : ''
                }`}
              >
                {/* User Info */}
                <div className="col-span-3">
                  <p className="font-medium text-slate-800 dark:text-slate-100 truncate">{user.name}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{user.email}</p>
                </div>

                {/* Role */}
                <div className="col-span-2">
                  <select
                    value={user.role}
                    onChange={(e) => updateUserRole(user.id, e.target.value as UserRole)}
                    disabled={user.id === currentUser?.id}
                    className="text-sm px-2 py-1 border border-slate-200 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 disabled:opacity-50"
                  >
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>

                {/* Access */}
                <div className="col-span-2">
                  <div className="flex flex-col gap-1">
                    {getAccessBadge(user.accessTier, user.accessEndDate)}
                    <select
                      value={user.accessTier}
                      onChange={(e) => updateUserAccess(user.id, e.target.value as AccessTier)}
                      className="text-xs px-2 py-1 border border-slate-200 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                    >
                      <option value="30_days">30 Days</option>
                      <option value="60_days">60 Days</option>
                      <option value="infinite">Unlimited</option>
                    </select>
                  </div>
                </div>

                {/* Status */}
                <div className="col-span-2">
                  <button
                    onClick={() => toggleUserActive(user.id)}
                    disabled={user.id === currentUser?.id}
                    className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full transition ${
                      user.isActive
                        ? 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-900'
                        : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600'
                    } disabled:cursor-not-allowed`}
                  >
                    {user.isActive ? (
                      <>
                        <CheckCircle className="w-3 h-3" />
                        Active
                      </>
                    ) : (
                      <>
                        <XCircle className="w-3 h-3" />
                        Inactive
                      </>
                    )}
                  </button>
                </div>

                {/* Last Login */}
                <div className="col-span-2 text-sm text-slate-600 dark:text-slate-400">
                  {formatDate(user.lastLoginAt)}
                </div>

                {/* Actions */}
                <div className="col-span-1 relative">
                  <button
                    onClick={() => setSelectedUser(selectedUser === user.id ? null : user.id)}
                    className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition"
                  >
                    <MoreVertical className="w-4 h-4" />
                  </button>

                  {/* Dropdown Menu */}
                  {selectedUser === user.id && (
                    <div className="absolute right-0 top-8 w-48 bg-white dark:bg-slate-700 rounded-lg border border-slate-200 dark:border-slate-600 shadow-lg z-10">
                      <button
                        onClick={() => {
                          setShowExtendModal(user.id);
                          setSelectedUser(null);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-600 transition"
                      >
                        <Plus className="w-4 h-4" />
                        Extend Access
                      </button>
                      <button
                        onClick={() => {
                          updateUserRole(user.id, user.role === 'admin' ? 'user' : 'admin');
                          setSelectedUser(null);
                        }}
                        disabled={user.id === currentUser?.id}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-600 transition disabled:opacity-50"
                      >
                        <UserCog className="w-4 h-4" />
                        Toggle Admin
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`Delete user ${user.name}?`)) {
                            deleteUser(user.id);
                          }
                          setSelectedUser(null);
                        }}
                        disabled={user.id === currentUser?.id}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 transition disabled:opacity-50"
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete User
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Extend Access Modal */}
      {showExtendModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-800 rounded-xl p-6 w-full max-w-sm mx-4">
            <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-4">
              Extend Access
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Days to add
                </label>
                <select
                  value={extendDays}
                  onChange={(e) => setExtendDays(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100"
                >
                  <option value={7}>7 days</option>
                  <option value={14}>14 days</option>
                  <option value={30}>30 days</option>
                  <option value={60}>60 days</option>
                  <option value={90}>90 days</option>
                  <option value={365}>1 year</option>
                </select>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowExtendModal(null)}
                  className="flex-1 px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleExtendAccess(showExtendModal)}
                  className={`flex-1 px-4 py-2 text-sm font-medium text-white ${theme.bg600} rounded-lg hover:opacity-90 transition`}
                >
                  Extend
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
