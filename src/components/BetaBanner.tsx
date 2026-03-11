import { useAuthStore } from '@/store/authStore';
import { AlertCircle } from 'lucide-react';

export function BetaBanner() {
  const { getTimeRemaining } = useAuthStore();
  const timeRemaining = getTimeRemaining();

  if (timeRemaining === null) return null; // Don't show for unlimited access

  return (
    <div className="fixed top-0 left-0 right-0 bg-red-600 text-white px-4 py-1.5 text-center text-xs font-medium flex items-center justify-center gap-2 z-50">
      <AlertCircle className="w-3.5 h-3.5" />
      <span>
        <strong>BETA</strong> • Access expires in {timeRemaining}
      </span>
    </div>
  );
}
