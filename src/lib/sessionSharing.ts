import type { Session } from '@/types';
import pako from 'pako';

// Compress and encode session to URL-safe string
export function encodeSession(session: Session): string {
  try {
    const json = JSON.stringify(session);
    const compressed = pako.deflate(json);
    const base64 = btoa(String.fromCharCode(...compressed));
    // Make URL safe
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  } catch (error) {
    console.error('Failed to encode session:', error);
    return '';
  }
}

// Decode URL string back to session
export function decodeSession(encoded: string): Session | null {
  try {
    // Restore base64 characters
    let base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
    // Add padding if needed
    while (base64.length % 4) {
      base64 += '=';
    }
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const decompressed = pako.inflate(bytes, { to: 'string' });
    return JSON.parse(decompressed) as Session;
  } catch (error) {
    console.error('Failed to decode session:', error);
    return null;
  }
}

// Generate shareable URL
export function generateShareUrl(session: Session): string {
  const encoded = encodeSession(session);
  const baseUrl = window.location.origin;
  return `${baseUrl}?session=${encoded}`;
}

// Check URL for shared session
export function getSessionFromUrl(): Session | null {
  const params = new URLSearchParams(window.location.search);
  const encoded = params.get('session');
  if (!encoded) return null;
  return decodeSession(encoded);
}

// Clear session from URL without reload
export function clearSessionFromUrl(): void {
  const url = new URL(window.location.href);
  url.searchParams.delete('session');
  window.history.replaceState({}, '', url.pathname);
}

// Generate QR code URL (using QR code API)
export function generateQRCodeUrl(shareUrl: string, size: number = 200): string {
  const encoded = encodeURIComponent(shareUrl);
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encoded}`;
}
