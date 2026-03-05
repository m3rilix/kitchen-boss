import { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';

interface SessionTransferModalProps {
  deviceInfo: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function SessionTransferModal({ deviceInfo, onConfirm, onCancel }: SessionTransferModalProps) {

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-8 max-w-md w-full shadow-2xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 bg-orange-100 dark:bg-orange-900/30 rounded-full">
            <AlertTriangle className="w-6 h-6 text-orange-600 dark:text-orange-400" />
          </div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">
            Existing Session Detected
          </h2>
        </div>

        <p className="text-slate-600 dark:text-slate-300 mb-6">
          This account is currently logged in on:
        </p>

        <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-4 mb-6">
          <p className="font-medium text-slate-800 dark:text-slate-100">
            {deviceInfo}
          </p>
        </div>

        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
          Do you want to continue? The existing session will be transferred to this device.
        </p>

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 px-4 py-2 text-sm font-medium text-white bg-orange-600 rounded-lg hover:bg-orange-700 transition"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}

interface SessionTransferredModalProps {
  onClose?: () => void;
}

export function SessionTransferredModal({ onClose }: SessionTransferredModalProps) {
  const [countdown, setCountdown] = useState(10);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          // Try to close window, fallback to redirect
          try {
            window.close();
            // If window.close() doesn't work (most browsers block it), redirect
            setTimeout(() => {
              if (onClose) onClose();
              window.location.href = '/';
            }, 500);
          } catch (error) {
            if (onClose) onClose();
            window.location.href = '/';
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [onClose]);

  return (
    <div className="fixed inset-0 bg-slate-900 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-8 max-w-md w-full shadow-2xl text-center">
        <div className="inline-flex p-4 bg-orange-100 dark:bg-orange-900/30 rounded-full mb-4">
          <AlertTriangle className="w-12 h-12 text-orange-600 dark:text-orange-400" />
        </div>

        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-4">
          Session Transferred
        </h2>

        <p className="text-slate-600 dark:text-slate-300 mb-6">
          Your session has been transferred to another device.
        </p>

        <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-6 mb-6">
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">
            This window will close in
          </p>
          <p className="text-4xl font-bold text-orange-600 dark:text-orange-400">
            {countdown}
          </p>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
            seconds
          </p>
        </div>

        <button
          onClick={() => {
            try {
              window.close();
              setTimeout(() => {
                if (onClose) onClose();
                window.location.href = '/';
              }, 500);
            } catch (error) {
              if (onClose) onClose();
              window.location.href = '/';
            }
          }}
          className="px-6 py-2 text-sm font-medium text-white bg-slate-600 rounded-lg hover:bg-slate-700 transition"
        >
          Close Now
        </button>
      </div>
    </div>
  );
}
