import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set, get, onValue, remove } from 'firebase/database';
import type { Session } from '@/types';

const firebaseConfig = {
  apiKey: "AIzaSyBabSf3Ks_ArGPjQSK-kNRoojUSBW3FzDA",
  authDomain: "kitchen-boss-df506.firebaseapp.com",
  projectId: "kitchen-boss-df506",
  storageBucket: "kitchen-boss-df506.firebasestorage.app",
  messagingSenderId: "543015650850",
  appId: "1:543015650850:web:03dcb808c18a93937dec7b",
  measurementId: "G-P2LTH550YL",
  databaseURL: "https://kitchen-boss-df506-default-rtdb.asia-southeast1.firebasedatabase.app"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

// Generate a short share code (6 characters)
export function generateShareCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed confusing chars (0, O, 1, I)
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Save session to Firebase with a share code
export async function shareSession(session: Session): Promise<string> {
  const shareCode = generateShareCode();
  const sessionRef = ref(database, `sessions/${shareCode}`);
  
  try {
    // Session has Date objects that need to be serialized
    const sessionData = JSON.parse(JSON.stringify(session));
    await set(sessionRef, {
      ...sessionData,
      sharedAt: Date.now(),
      lastUpdated: Date.now()
    });
    return shareCode;
  } catch (error) {
    console.error('Firebase shareSession error:', error);
    throw error;
  }
}

// Update shared session in Firebase
export async function updateSharedSession(shareCode: string, session: Session): Promise<void> {
  const sessionRef = ref(database, `sessions/${shareCode}`);
  try {
    const sessionData = JSON.parse(JSON.stringify(session));
    await set(sessionRef, {
      ...sessionData,
      lastUpdated: Date.now()
    });
  } catch (error) {
    // Don't throw - sync failures shouldn't break the app
    console.warn('Firebase updateSharedSession error (non-critical):', (error as Error).message);
  }
}

// Firebase Realtime Database can convert arrays to objects with numeric keys.
// This function recursively converts them back to proper arrays.
function firebaseToArray(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(firebaseToArray);
  
  const keys = Object.keys(obj as Record<string, unknown>);
  // Check if this object is actually an array (all keys are sequential integers starting from 0)
  const isArrayLike = keys.length > 0 && keys.every((k, i) => String(i) === k || /^\d+$/.test(k));
  if (isArrayLike) {
    // Convert to array, filling gaps with undefined, then filter nulls
    const maxIndex = Math.max(...keys.map(Number));
    const arr: unknown[] = [];
    for (let i = 0; i <= maxIndex; i++) {
      arr.push(firebaseToArray((obj as Record<string, unknown>)[String(i)]));
    }
    return arr.filter(item => item !== undefined && item !== null);
  }
  
  // Regular object - recurse into values
  const result: Record<string, unknown> = {};
  for (const key of keys) {
    result[key] = firebaseToArray((obj as Record<string, unknown>)[key]);
  }
  return result;
}

// Helper: ensure a value is an array, defaulting to []
function ensureArray<T>(val: unknown): T[] {
  return Array.isArray(val) ? val : [];
}

// Helper: ensure a value is a [string, string] tuple
function ensureTuple(val: unknown): [string, string] {
  const arr = ensureArray<string>(val);
  return [arr[0] || '', arr[1] || ''] as [string, string];
}

// Helper: ensure nested string[][] — each inner element must be an array
function ensureNestedArrays(val: unknown): string[][] {
  const outer = ensureArray<unknown>(val);
  return outer.map(inner => ensureArray<string>(inner));
}

// Sanitize session data from Firebase to ensure all arrays are proper arrays.
// Firebase Realtime DB drops empty arrays entirely and converts arrays to
// objects with numeric keys. This function restores correct types.
function sanitizeSessionFromFirebase(data: unknown): Session | null {
  if (!data || typeof data !== 'object') {
    console.warn('[SHARE DEBUG] sanitize received falsy/non-object data:', typeof data, data);
    return null;
  }
  try {
    console.log('[SHARE DEBUG] Raw Firebase data keys:', Object.keys(data as Record<string, unknown>));
    console.log('[SHARE DEBUG] Raw Firebase data:', JSON.stringify(data).substring(0, 500));
    const sanitized = firebaseToArray(data) as Session;
    console.log('[SHARE DEBUG] After firebaseToArray - players type:', typeof sanitized.players, Array.isArray(sanitized.players), 'courts type:', typeof sanitized.courts, Array.isArray(sanitized.courts));
    console.log('[SHARE DEBUG] After firebaseToArray - queue type:', typeof sanitized.queue, Array.isArray(sanitized.queue));
    console.log('[SHARE DEBUG] After firebaseToArray - activityLog type:', typeof sanitized.activityLog, Array.isArray(sanitized.activityLog));

    // --- Top-level arrays (Firebase drops empty [] so these may be undefined) ---
    sanitized.players = ensureArray(sanitized.players);
    sanitized.courts = ensureArray(sanitized.courts);
    sanitized.queue = ensureArray(sanitized.queue);
    sanitized.activityLog = ensureArray(sanitized.activityLog);
    sanitized.gamesCompleted = ensureArray(sanitized.gamesCompleted);
    sanitized.winnerStack = ensureArray(sanitized.winnerStack);
    sanitized.loserStack = ensureArray(sanitized.loserStack);
    sanitized.waitingStack = ensureArray(sanitized.waitingStack);
    sanitized.matchHistory = ensureArray(sanitized.matchHistory);

    // --- Nested string[][] arrays ---
    sanitized.winnerStacks = ensureNestedArrays(sanitized.winnerStacks);
    sanitized.loserStacks = ensureNestedArrays(sanitized.loserStacks);
    sanitized.waitingStacks = ensureNestedArrays(sanitized.waitingStacks);
    sanitized.customStacks = ensureNestedArrays(sanitized.customStacks);
    sanitized.roundRobinStacks = ensureNestedArrays(sanitized.roundRobinStacks);

    // --- Courts: ensure team tuples in currentGame ---
    sanitized.courts = sanitized.courts.map(court => {
      if (court.currentGame) {
        court.currentGame.team1 = ensureTuple(court.currentGame.team1);
        court.currentGame.team2 = ensureTuple(court.currentGame.team2);
      }
      return court;
    });

    // --- Games completed: ensure team tuples ---
    sanitized.gamesCompleted = sanitized.gamesCompleted.map(game => ({
      ...game,
      team1: ensureTuple(game.team1),
      team2: ensureTuple(game.team2),
    }));

    // --- Players: ensure nested arrays ---
    sanitized.players = sanitized.players.map(player => ({
      ...player,
      lastPartners: ensureArray<string>(player.lastPartners),
      lastOpponents: ensureArray<string>(player.lastOpponents),
    }));

    // --- Activity log: ensure details arrays ---
    sanitized.activityLog = sanitized.activityLog.map(entry => {
      if (entry.details) {
        entry.details = {
          ...entry.details,
          playerIds: entry.details.playerIds ? ensureArray<string>(entry.details.playerIds) : undefined,
          playerNames: entry.details.playerNames ? ensureArray<string>(entry.details.playerNames) : undefined,
          team1Names: entry.details.team1Names ? ensureArray<string>(entry.details.team1Names) : undefined,
          team2Names: entry.details.team2Names ? ensureArray<string>(entry.details.team2Names) : undefined,
        };
      }
      return entry;
    });

    // --- Match history: ensure team tuples ---
    sanitized.matchHistory = sanitized.matchHistory.map(match => ({
      ...match,
      team1: ensureTuple(match.team1),
      team2: ensureTuple(match.team2),
    }));

    console.log('[SHARE DEBUG] Sanitized session summary:', {
      id: sanitized.id,
      name: sanitized.name,
      playersCount: sanitized.players?.length,
      courtsCount: sanitized.courts?.length,
      queueCount: sanitized.queue?.length,
      activityLogCount: sanitized.activityLog?.length,
      playersIsArray: Array.isArray(sanitized.players),
      courtsIsArray: Array.isArray(sanitized.courts),
      queueIsArray: Array.isArray(sanitized.queue),
      activityLogIsArray: Array.isArray(sanitized.activityLog),
    });
    // Log first player to check for object-as-child issues
    if (sanitized.players?.length > 0) {
      const p = sanitized.players[0];
      console.log('[SHARE DEBUG] First player sample:', { name: p.name, id: p.id, checkedInAt: p.checkedInAt, checkedInAtType: typeof p.checkedInAt });
    }
    // Log first activity entry
    if (sanitized.activityLog?.length > 0) {
      const e = sanitized.activityLog[0];
      console.log('[SHARE DEBUG] First activity entry:', { id: e.id, type: e.type, message: e.message, messageType: typeof e.message, timestamp: e.timestamp, timestampType: typeof e.timestamp });
    }
    return sanitized;
  } catch (e) {
    console.error('[SHARE DEBUG] Error sanitizing session from Firebase:', e);
    return data as Session;
  }
}

// Get session from Firebase by share code
export async function getSharedSession(shareCode: string): Promise<Session | null> {
  const sessionRef = ref(database, `sessions/${shareCode}`);
  const snapshot = await get(sessionRef);
  
  if (snapshot.exists()) {
    return sanitizeSessionFromFirebase(snapshot.val());
  }
  return null;
}

// Subscribe to real-time session updates
export function subscribeToSession(
  shareCode: string, 
  callback: (session: Session | null) => void
): () => void {
  const sessionRef = ref(database, `sessions/${shareCode}`);
  
  const unsubscribe = onValue(sessionRef, (snapshot) => {
    if (snapshot.exists()) {
      callback(sanitizeSessionFromFirebase(snapshot.val()));
    } else {
      callback(null);
    }
  });
  
  return unsubscribe;
}

// Delete shared session
export async function deleteSharedSession(shareCode: string): Promise<void> {
  const sessionRef = ref(database, `sessions/${shareCode}`);
  await remove(sessionRef);
}

// Generate share URL with code
export function generateShareUrlWithCode(shareCode: string): string {
  return `${window.location.origin}?code=${shareCode}`;
}

// Get share code from URL
export function getShareCodeFromUrl(): string | null {
  const params = new URLSearchParams(window.location.search);
  return params.get('code');
}

// Clear share code from URL
export function clearShareCodeFromUrl(): void {
  const url = new URL(window.location.href);
  url.searchParams.delete('code');
  window.history.replaceState({}, '', url.pathname);
}

// Generate QR code URL (using QR code API)
export function generateQRCodeUrl(shareUrl: string, size: number = 200): string {
  const encoded = encodeURIComponent(shareUrl);
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encoded}`;
}

// Session management for cross-browser login prevention
export interface ActiveSession {
  sessionId: string;
  lastActivity: number;
  userAgent?: string;
  deviceInfo?: string;
  loginTime?: number;
}

// Store active session in Firebase
export async function storeActiveSession(userId: string, sessionData: ActiveSession): Promise<void> {
  const sessionRef = ref(database, `activeSessions/${userId}`);
  try {
    await set(sessionRef, sessionData);
  } catch (error) {
    console.warn('Could not store active session (non-critical):', (error as Error).message);
  }
}

// Get active session from Firebase
export async function getActiveSession(userId: string): Promise<ActiveSession | null> {
  const sessionRef = ref(database, `activeSessions/${userId}`);
  try {
    const snapshot = await get(sessionRef);
    return snapshot.exists() ? snapshot.val() as ActiveSession : null;
  } catch (error) {
    console.warn('Could not get active session (non-critical):', (error as Error).message);
    return null;
  }
}

// Remove active session from Firebase
export async function removeActiveSession(userId: string): Promise<void> {
  const sessionRef = ref(database, `activeSessions/${userId}`);
  try {
    await remove(sessionRef);
  } catch (error) {
    // Don't throw - this is a cleanup operation that shouldn't break the logout flow
    // PERMISSION_DENIED is common when Firebase rules restrict access
    console.warn('Could not remove active session (non-critical):', (error as Error).message);
  }
}

// Get all active sessions (for admin)
export async function getAllActiveSessions(): Promise<Record<string, ActiveSession>> {
  const sessionsRef = ref(database, 'activeSessions');
  try {
    const snapshot = await get(sessionsRef);
    return snapshot.exists() ? snapshot.val() : {};
  } catch (error) {
    console.warn('Could not get active sessions (non-critical):', (error as Error).message);
    return {};
  }
}

// Update session activity
export async function updateSessionActivity(userId: string): Promise<void> {
  const sessionRef = ref(database, `activeSessions/${userId}/lastActivity`);
  try {
    await set(sessionRef, Date.now());
  } catch (error) {
    console.warn('Could not update session activity (non-critical):', (error as Error).message);
  }
}

// Listen for session changes (for detecting session transfers)
export function onSessionChange(userId: string, callback: (session: ActiveSession | null) => void): () => void {
  const sessionRef = ref(database, `activeSessions/${userId}`);
  const unsubscribe = onValue(sessionRef, (snapshot) => {
    const session = snapshot.exists() ? snapshot.val() as ActiveSession : null;
    callback(session);
  }, (error) => {
    console.warn('Could not listen for session changes (non-critical):', error.message);
  });
  return unsubscribe;
}

// Get device/browser info for display
export function getDeviceInfo(): string {
  const ua = navigator.userAgent;
  let browser = 'Unknown Browser';
  let os = 'Unknown OS';
  
  // Detect browser
  if (ua.indexOf('Chrome') > -1 && ua.indexOf('Edg') === -1) browser = 'Chrome';
  else if (ua.indexOf('Safari') > -1 && ua.indexOf('Chrome') === -1) browser = 'Safari';
  else if (ua.indexOf('Firefox') > -1) browser = 'Firefox';
  else if (ua.indexOf('Edg') > -1) browser = 'Edge';
  
  // Detect OS
  if (ua.indexOf('Win') > -1) os = 'Windows';
  else if (ua.indexOf('Mac') > -1) os = 'macOS';
  else if (ua.indexOf('Linux') > -1) os = 'Linux';
  else if (ua.indexOf('Android') > -1) os = 'Android';
  else if (ua.indexOf('iOS') > -1 || ua.indexOf('iPhone') > -1 || ua.indexOf('iPad') > -1) os = 'iOS';
  
  return `${browser} on ${os}`;
}
