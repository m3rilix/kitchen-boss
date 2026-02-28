import { useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import { useThemeClasses } from '@/store/themeStore';
import { PickleballIcon } from './PickleballIcon';
import { LogIn, UserPlus, Mail, Lock, User, AlertCircle, UserCircle } from 'lucide-react';
import { SettingsDropdown } from './SettingsDropdown';

export function LoginPage() {
  const { login, register, loginAsGuest, isLoading, error } = useAuthStore();
  const theme = useThemeClasses();
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [localError, setLocalError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError('');

    if (!email || !password) {
      setLocalError('Please fill in all required fields');
      return;
    }

    if (isRegister && !name) {
      setLocalError('Please enter your name');
      return;
    }

    if (password.length < 6) {
      setLocalError('Password must be at least 6 characters');
      return;
    }

    if (isRegister) {
      await register(email, password, name);
    } else {
      await login(email, password);
    }
  };

  const displayError = localError || error;

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className={`w-20 h-20 ${theme.bg100} rounded-full flex items-center justify-center mx-auto mb-4`}>
            <PickleballIcon className={`w-12 h-12 ${theme.text}`} />
          </div>
          <h1 className="text-2xl font-bold text-slate-800">
            Kitchen Boss
          </h1>
          <p className="text-slate-500 mt-1">
            {isRegister ? 'Create your account' : 'Sign in to continue'}
          </p>
        </div>

        {/* Form */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {isRegister && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Name
                </label>
                <div className="relative">
                  <User className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name"
                    className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg bg-white text-slate-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Email
              </label>
              <div className="relative">
                <Mail className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg bg-white text-slate-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Password
              </label>
              <div className="relative">
                <Lock className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg bg-white text-slate-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                />
              </div>
            </div>

            {displayError && (
              <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                <p className="text-sm text-red-600">{displayError}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className={`w-full flex items-center justify-center gap-2 py-2.5 ${theme.bg600} text-white font-medium rounded-lg hover:opacity-90 transition disabled:opacity-50`}
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : isRegister ? (
                <>
                  <UserPlus className="w-5 h-5" />
                  Create Account
                </>
              ) : (
                <>
                  <LogIn className="w-5 h-5" />
                  Sign In
                </>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-slate-500">or</span>
            </div>
          </div>

          {/* Guest Button */}
          <button
            onClick={loginAsGuest}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-slate-100 text-slate-700 font-medium rounded-lg hover:bg-slate-200 transition"
          >
            <UserCircle className="w-5 h-5" />
            Continue as Guest
          </button>

          <div className="mt-4 text-center">
            <button
              onClick={() => {
                setIsRegister(!isRegister);
                setLocalError('');
              }}
              className="text-sm text-slate-600 hover:text-slate-800 transition"
            >
              {isRegister ? (
                <>Already have an account? <span className={theme.text}>Sign in</span></>
              ) : (
                <>Don't have an account? <span className={theme.text}>Create one</span></>
              )}
            </button>
          </div>
        </div>

        {/* Demo credentials */}
        <div className="mt-4 p-3 bg-slate-100 rounded-lg border border-slate-200">
          <p className="text-xs text-slate-500 text-center">
            <span className="font-medium">Demo Admin:</span> admin@kitchenboss.app / admin123
          </p>
        </div>
      </div>

      {/* Settings button (top right) */}
      <div className="fixed top-4 right-4">
        <SettingsDropdown />
      </div>
    </div>
  );
}
