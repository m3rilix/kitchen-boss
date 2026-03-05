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
    console.error('Firebase updateSharedSession error:', error);
    throw error;
  }
}

// Get session from Firebase by share code
export async function getSharedSession(shareCode: string): Promise<Session | null> {
  const sessionRef = ref(database, `sessions/${shareCode}`);
  const snapshot = await get(sessionRef);
  
  if (snapshot.exists()) {
    return snapshot.val() as Session;
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
      callback(snapshot.val() as Session);
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
  ipAddress?: string;
}

// Store active session in Firebase
export async function storeActiveSession(userId: string, sessionData: ActiveSession): Promise<void> {
  const sessionRef = ref(database, `activeSessions/${userId}`);
  try {
    await set(sessionRef, sessionData);
  } catch (error) {
    console.error('Firebase storeActiveSession error:', error);
    throw error;
  }
}

// Get active session from Firebase
export async function getActiveSession(userId: string): Promise<ActiveSession | null> {
  const sessionRef = ref(database, `activeSessions/${userId}`);
  try {
    const snapshot = await get(sessionRef);
    return snapshot.exists() ? snapshot.val() as ActiveSession : null;
  } catch (error) {
    console.error('Firebase getActiveSession error:', error);
    return null;
  }
}

// Remove active session from Firebase
export async function removeActiveSession(userId: string): Promise<void> {
  const sessionRef = ref(database, `activeSessions/${userId}`);
  try {
    console.log('Removing session from Firebase path:', `activeSessions/${userId}`);
    
    // Use set(null) instead of remove() - sometimes works better with Firebase rules
    await set(sessionRef, null);
    console.log('Firebase set(null) operation completed');
    
    // Verify removal by checking if it still exists
    const snapshot = await get(sessionRef);
    if (snapshot.exists()) {
      console.error('Session still exists after set(null) attempt:', snapshot.val());
      
      // Try remove() as fallback
      console.log('Trying remove() as fallback...');
      await remove(sessionRef);
      
      // Check again
      const snapshot2 = await get(sessionRef);
      if (snapshot2.exists()) {
        console.error('Session still exists after remove() fallback:', snapshot2.val());
      } else {
        console.log('Session successfully removed with remove() fallback');
      }
    } else {
      console.log('Session successfully removed from Firebase with set(null)');
    }
  } catch (error) {
    console.error('Firebase removeActiveSession error:', error);
    throw error;
  }
}

// Get all active sessions (for admin)
export async function getAllActiveSessions(): Promise<Record<string, ActiveSession>> {
  const sessionsRef = ref(database, 'activeSessions');
  try {
    const snapshot = await get(sessionsRef);
    return snapshot.exists() ? snapshot.val() : {};
  } catch (error) {
    console.error('Firebase getAllActiveSessions error:', error);
    return {};
  }
}

// Update session activity
export async function updateSessionActivity(userId: string): Promise<void> {
  const sessionRef = ref(database, `activeSessions/${userId}/lastActivity`);
  try {
    await set(sessionRef, Date.now());
  } catch (error) {
    console.error('Firebase updateSessionActivity error:', error);
    // Don't throw error for activity updates to avoid disrupting user experience
  }
}
