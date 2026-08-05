import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { useThemeClasses } from '@/store/themeStore';
import { PickleballIcon } from './PickleballIcon';
import { LogIn, UserPlus, Mail, Lock, User, AlertCircle } from 'lucide-react';
import { SettingsDropdown } from './SettingsDropdown';

export function LoginPage() {
  const navigate = useNavigate();
  const { login, register, loginWithGoogle, isLoading, error } = useAuthStore();
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

    let success = false;
    if (isRegister) {
      success = await register(email, password, name);
    } else {
      success = await login(email, password);
    }

    if (success) {
      navigate('/create-session');
    }
  };

  const displayError = localError || error;

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <img 
            src="/kitchen-boss-logo.png" 
            alt="Kitchen Boss Logo" 
            className="w-32 h-32 mx-auto mb-4"
            onError={(e) => {
              // Fallback to icon if image not found
              e.currentTarget.style.display = 'none';
              e.currentTarget.nextElementSibling?.classList.remove('hidden');
            }}
          />
          <div className={`hidden w-20 h-20 ${theme.bg100} rounded-full flex items-center justify-center mx-auto mb-4`}>
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
                  placeholder="user@kitchenboss.app"
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

          {/* Google Sign-In */}
          <button
            onClick={async () => {
              setLocalError('');
              const success = await loginWithGoogle();
              if (success) {
                navigate('/create-session');
              }
            }}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-2 py-2.5 border border-slate-300 rounded-lg hover:bg-slate-50 transition disabled:opacity-50 font-medium"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Sign in with Google
          </button>

          {/* Guest Button — hidden */}

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

        {/* Demo credentials - only show in development */}
        {import.meta.env.DEV && (
          <div className="mt-4 p-3 bg-slate-100 rounded-lg border border-slate-200 space-y-2">
            <p className="text-xs text-slate-600 text-center font-medium">Demo Accounts</p>
            <div className="grid grid-cols-2 gap-2 text-xs text-slate-500">
              <div className="text-center">
                <p className="font-medium">demo1@kitchenboss.app</p>
                <p className="text-slate-400">Kb7xP2m (30 days)</p>
              </div>
              <div className="text-center">
                <p className="font-medium">demo2@kitchenboss.app</p>
                <p className="text-slate-400">Qw9Tn4k (30 days)</p>
              </div>
              <div className="text-center">
                <p className="font-medium">demo3@kitchenboss.app</p>
                <p className="text-slate-400">Ry5Hj8s (60 days)</p>
              </div>
              <div className="text-center">
                <p className="font-medium">demo4@kitchenboss.app</p>
                <p className="text-slate-400">Lm3Vb6p (60 days)</p>
              </div>
            </div>
            {/* Admin credentials */}
            <div className="pt-2 border-t border-slate-200 text-center">
              <p className="text-xs text-orange-600">
                <span className="font-medium">Dev Admin:</span> admin@kitchenboss.app / admin123!!
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Settings button (top right) */}
      <div className="fixed top-4 right-4">
        <SettingsDropdown />
      </div>
    </div>
  );
}
