import { useState, useEffect } from 'react';
import { useSessionStore } from '@/store/sessionStore';
import { useThemeClasses } from '@/store/themeStore';
import { shareSession, generateShareUrlWithCode, generateQRCodeUrl } from '@/lib/firebase';
import { X, Copy, Check, QrCode, Wifi, Loader2 } from 'lucide-react';

interface ShareSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ShareSessionModal({ isOpen, onClose }: ShareSessionModalProps) {
  const { session, shareCode, setShareCode } = useSessionStore();
  const theme = useThemeClasses();
  const [copied, setCopied] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [shareUrl, setShareUrl] = useState<string>('');

  // Generate or use existing share code
  useEffect(() => {
    if (isOpen && session && !shareCode) {
      setIsSharing(true);
      shareSession(session)
        .then((code) => {
          setShareCode(code);
          setShareUrl(generateShareUrlWithCode(code));
          setIsSharing(false);
        })
        .catch((err) => {
          console.error('Failed to share session:', err);
          setIsSharing(false);
        });
    } else if (shareCode) {
      setShareUrl(generateShareUrlWithCode(shareCode));
    }
  }, [isOpen, session, shareCode, setShareCode]);

  if (!isOpen || !session) return null;

  const qrCodeUrl = shareUrl ? generateQRCodeUrl(shareUrl, 250) : '';

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
          <h3 className="font-semibold text-slate-800">Share Session</h3>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Loading State */}
          {isSharing ? (
            <div className="flex items-center justify-center gap-3 p-6">
              <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
              <span className="text-slate-600">Creating share link...</span>
            </div>
          ) : (
            <>
          {/* Info */}
          <div className="flex items-start gap-3 p-3 bg-green-50 rounded-lg">
            <Wifi className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-green-700">
              <p className="font-medium">Real-Time Sync</p>
              <p className="text-green-600 mt-0.5">
                Viewers will see live updates as games progress. No need to re-share!
              </p>
            </div>
          </div>

          {/* URL */}
          <div>
            <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">
              Share Link
            </label>
            <div className="mt-2 flex gap-2">
              <input
                type="text"
                value={shareUrl}
                readOnly
                className="flex-1 px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-600 truncate"
              />
              <button
                onClick={handleCopy}
                className={`px-3 py-2 rounded-lg transition flex items-center gap-2 ${
                  copied
                    ? 'bg-green-500 text-white'
                    : `${theme.bg600} text-white hover:opacity-90`
                }`}
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    Copy
                  </>
                )}
              </button>
            </div>
          </div>

          {/* QR Code Toggle */}
          <div>
            <button
              onClick={() => setShowQR(!showQR)}
              className="flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-800 transition"
            >
              <QrCode className="w-4 h-4" />
              {showQR ? 'Hide QR Code' : 'Show QR Code'}
            </button>

            {showQR && (
              <div className="mt-3 flex justify-center p-4 bg-white border border-slate-200 rounded-lg">
                <img
                  src={qrCodeUrl}
                  alt="Session QR Code"
                  className="w-[250px] h-[250px]"
                />
              </div>
            )}
          </div>

          {/* Session Info */}
          <div className="pt-3 border-t border-slate-100">
            <p className="text-xs text-slate-500">
              Session: <span className="font-medium text-slate-700">{session.name}</span>
            </p>
            <p className="text-xs text-slate-500 mt-1">
              {session.players.length} players • {session.courts.length} courts
            </p>
            {shareCode && (
              <p className="text-xs text-slate-500 mt-1">
                Code: <span className="font-mono font-medium text-slate-700">{shareCode}</span>
              </p>
            )}
          </div>
          </>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 bg-slate-50 border-t border-slate-100">
          <button
            onClick={onClose}
            className="w-full py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
