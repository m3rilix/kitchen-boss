# Testing Guide: Session Transfer & Routing Features

## Branch: `feature/session-transfer-routing`

## Features Implemented

### 1. Session Transfer Notification System
**User Story**: When a user logs in on a second device, they see a confirmation dialog. If they proceed, the first device shows a "Session Transferred" modal with 10-second countdown before closing.

**Implementation**:
- Login shows modal if existing session detected
- Modal displays device info (e.g., "Chrome on Windows")
- User can confirm transfer or cancel
- Old device receives real-time notification via Firebase listener
- 10-second countdown with auto-close (or redirect if close fails)

### 2. React Router with Dedicated URLs
**User Story**: Users can access specific pages via direct URLs for better navigation and bookmarking.

**Routes**:
- `/` - Root (redirects to `/session` if active session, else `/create-session`)
- `/admin` - Admin panel
- `/create-session` - Session setup page
- `/session` - Active session view

---

## Testing Checklist

### Session Transfer Feature

#### Test 1: Login with Existing Session
1. **Browser A**: Login as demo1
2. **Browser B**: Try to login as demo1
3. **Expected**: Browser B shows modal: "Existing session detected on [Chrome on Windows]"
4. **Options**: "Cancel" or "Continue"

#### Test 2: Cancel Transfer
1. Follow Test 1 steps 1-3
2. Click "Cancel" on Browser B
3. **Expected**: 
   - Browser B returns to login screen
   - Browser A remains logged in

#### Test 3: Confirm Transfer
1. Follow Test 1 steps 1-3
2. Click "Continue" on Browser B
3. **Expected**:
   - Browser B logs in successfully
   - Browser A shows "Session Transferred" modal
   - Countdown from 10 seconds
   - Browser A window closes or redirects to login

#### Test 4: Session Transfer Real-Time Detection
1. **Browser A**: Login as demo2
2. **Browser B**: Login as demo2 and confirm transfer
3. **Expected**: Browser A detects transfer within 1-2 seconds (Firebase real-time listener)

#### Test 5: Multiple Rapid Transfers
1. Login demo3 on Browser A
2. Transfer to Browser B
3. Immediately transfer to Browser C
4. **Expected**: Each browser correctly shows transfer modal

---

### Routing Feature

#### Test 6: Direct URL Access - Admin
1. Navigate to `http://localhost:5173/admin`
2. **Expected**: Admin panel loads directly

#### Test 7: Direct URL Access - Create Session
1. Navigate to `http://localhost:5173/create-session`
2. **Expected**: Session setup page loads

#### Test 8: Direct URL Access - Active Session
1. Create a session first
2. Navigate to `http://localhost:5173/session`
3. **Expected**: Active session view loads

#### Test 9: Root Redirect - No Session
1. Logout (no active session)
2. Navigate to `http://localhost:5173/`
3. **Expected**: Redirects to `/create-session`

#### Test 10: Root Redirect - With Session
1. Create a session
2. Navigate to `http://localhost:5173/`
3. **Expected**: Redirects to `/session`

#### Test 11: Browser Back/Forward
1. Navigate: `/create-session` → Create session → `/session` → `/admin`
2. Click browser back button
3. **Expected**: Returns to `/session`
4. Click forward button
5. **Expected**: Returns to `/admin`

#### Test 12: URL Sharing
1. Copy URL from `/session` page
2. Open in new tab
3. **Expected**: Same session view loads (if authenticated)

---

### Integration Tests

#### Test 13: Session Transfer + Routing
1. Browser A at `/session`
2. Browser B login and transfer session
3. **Expected**:
   - Browser A shows transfer modal
   - After 10s, Browser A redirects to login
   - Browser B remains at current route

#### Test 14: Admin Force Logout + Routing
1. User at `/session`
2. Admin force logs out user
3. **Expected**: User redirected to login page

#### Test 15: Session Timeout + Routing
1. User at `/session`
2. Wait for session timeout (or manually trigger)
3. **Expected**: Session expired modal shows, then redirects to login

---

## Known Issues / Edge Cases

### Session Transfer
- Window.close() may not work in all browsers (fallback to redirect implemented)
- Countdown timer continues even if user switches tabs

### Routing
- Shared session URLs (`?share=xxx`) bypass routing (by design)
- Direct navigation to `/session` without active session redirects to `/create-session`

---

## Rollback Plan

If issues are found:
```bash
git checkout main
git branch -D feature/session-transfer-routing
```

The main branch remains untouched and functional.

---

## Deployment Steps (After Testing)

1. Test all scenarios above ✅
2. Merge to main:
   ```bash
   git checkout main
   git merge feature/session-transfer-routing
   ```
3. Push to production:
   ```bash
   git push origin main
   ```
4. Monitor for issues in first 24 hours

---

## Dev Server

To test locally:
```bash
npm run dev
```

Access at: `http://localhost:5173`

---

## Questions/Issues

Report any issues found during testing before merging to main.
