import { useState } from 'react';
import { useSessionStore } from '@/store/sessionStore';
import { useAuthStore } from '@/store/authStore';
import { useThemeClasses } from '@/store/themeStore';
import type { RotationMode } from '@/types';
import { Users, RotateCcw, MapPin, Calendar, Clock, Shield, LogOut } from 'lucide-react';
import { PickleballIcon } from './PickleballIcon';
import { SettingsDropdown } from './SettingsDropdown';

interface SessionSetupProps {
  onAdminClick?: () => void;
}

const rotationModes: { value: RotationMode; label: string; description: string }[] = [
  {
    value: 'winners_stay',
    label: 'Winners Stay',
    description: 'Winning team stays on court, losers go to back of queue',
  },
  {
    value: 'full_rotation',
    label: 'Full Rotation',
    description: 'All 4 players rotate out after each game',
  },
  {
    value: 'king_of_court',
    label: 'King of the Court',
    description: 'Winners stay until they lose',
  },
  {
    value: 'skill_based',
    label: 'Skill-Based',
    description: 'Balance teams based on skill ratings',
  },
];

// Get today's date in YYYY-MM-DD format
const getTodayDate = () => {
  const today = new Date();
  return today.toISOString().split('T')[0];
};

// Get current time in HH:MM format
const getCurrentTime = () => {
  const now = new Date();
  return now.toTimeString().slice(0, 5);
};

export function SessionSetup({ onAdminClick }: SessionSetupProps) {
  const { createSession } = useSessionStore();
  const { currentUser, logout, getDaysRemaining } = useAuthStore();
  const theme = useThemeClasses();
  const [name, setName] = useState('Open Play Session');
  const [location, setLocation] = useState('');
  const [date, setDate] = useState(getTodayDate());
  const [time, setTime] = useState(getCurrentTime());
  const [courtCount, setCourtCount] = useState(2);
  const [rotationMode, setRotationMode] = useState<RotationMode>('full_rotation');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createSession({ name, location, date, time, courtCount, rotationMode });
  };

  const daysRemaining = getDaysRemaining();

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-900 flex items-center justify-center p-4 transition-colors">
      {/* Top Bar */}
      <div className="fixed top-0 left-0 right-0 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-4 py-3">
        <div className="container mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 ${theme.bg100} rounded-full flex items-center justify-center`}>
              <PickleballIcon className={`w-5 h-5 ${theme.text}`} />
            </div>
            <span className="font-semibold text-slate-800">Kitchen Boss</span>
          </div>
          <div className="flex items-center gap-3">
            {/* User Info */}
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{currentUser?.name}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {daysRemaining === null ? 'Unlimited access' : `${daysRemaining} days remaining`}
              </p>
            </div>
            {/* Admin Button */}
            {onAdminClick && (
              <button
                onClick={onAdminClick}
                className={`p-2 ${theme.bgButton} rounded-lg transition`}
                title="Admin Panel"
              >
                <Shield className={`w-5 h-5 ${theme.text}`} />
              </button>
            )}
            {/* Theme */}
            <SettingsDropdown />
            {/* Logout */}
            <button
              onClick={logout}
              className="p-2 text-slate-500 hover:text-red-500 transition"
              title="Sign Out"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-8 w-full max-w-lg mt-16">
        <div className="text-center mb-8">
          <div className={`inline-flex items-center justify-center w-16 h-16 ${theme.bg100} rounded-full mb-4`}>
            <PickleballIcon className={`w-10 h-10 ${theme.text}`} />
          </div>
          <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100">New Session</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-2">Set up your open play session</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Session Name */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Session Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
              placeholder="e.g., Saturday Morning Open Play"
            />
          </div>

          {/* Location */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              <MapPin className="w-4 h-4 inline mr-2" />
              Location / Venue
            </label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
              placeholder="e.g., Community Center, Park Name"
            />
          </div>

          {/* Date and Time */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                <Calendar className="w-4 h-4 inline mr-2" />
                Date
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                <Clock className="w-4 h-4 inline mr-2" />
                Start Time
              </label>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
              />
            </div>
          </div>

          {/* Court Count */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              <Users className="w-4 h-4 inline mr-2" />
              Number of Courts
            </label>
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => setCourtCount(Math.max(1, courtCount - 1))}
                className="w-12 h-12 rounded-lg border border-slate-300 text-xl font-bold hover:bg-slate-50 transition"
              >
                -
              </button>
              <span className="text-3xl font-bold text-slate-800 w-12 text-center">
                {courtCount}
              </span>
              <button
                type="button"
                onClick={() => setCourtCount(Math.min(10, courtCount + 1))}
                className="w-12 h-12 rounded-lg border border-slate-300 text-xl font-bold hover:bg-slate-50 transition"
              >
                +
              </button>
            </div>
          </div>

          {/* Rotation Mode */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              <RotateCcw className="w-4 h-4 inline mr-2" />
              Rotation Mode
            </label>
            <div className="space-y-2">
              {rotationModes.map((mode) => (
                <label
                  key={mode.value}
                  className={`flex items-start p-3 border rounded-lg cursor-pointer transition ${
                    rotationMode === mode.value
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="rotationMode"
                    value={mode.value}
                    checked={rotationMode === mode.value}
                    onChange={(e) => setRotationMode(e.target.value as RotationMode)}
                    className="mt-1 text-blue-600 focus:ring-blue-500"
                  />
                  <div className="ml-3">
                    <span className="font-medium text-slate-800">{mode.label}</span>
                    <p className="text-sm text-slate-500">{mode.description}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            className={`w-full py-4 ${theme.bg600} text-white font-semibold rounded-lg hover:opacity-90 transition`}
          >
            Start Session
          </button>
        </form>
      </div>
    </div>
  );
}
