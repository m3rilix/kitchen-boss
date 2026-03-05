# Known Issues & Limitations

## 🐛 Active Bugs

### 1. Player Drag-and-Drop in Lowest Stack
**Status**: Open  
**Severity**: Medium  
**Description**: Players in the lowest queue stack cannot be moved to other stacks or the player list. Only players in stacks above can be dragged.

**Scenario**:
- 2 courts, 8 players
- After playing 1 game: 2 winners, 2 losers
- Players in loser stack sometimes cannot be dragged to player list or other stacks

**Workaround**: Move players from higher stacks first, or manually edit the queue order.

---

## ⚠️ Known Limitations

### 1. User Accounts Not Stored in Firebase
**Status**: By Design (requires backend implementation)  
**Description**: Newly created user accounts are stored in browser localStorage, not Firebase. Accounts created on Browser 1 cannot be accessed on Browser 2.

**Why**: User registration stores credentials in localStorage (Zustand persist). There's no backend database to sync accounts across devices.

**Current Behavior**:
- ✅ Built-in accounts (admin, demo1-4) work on all browsers
- ❌ New registered accounts only exist on the browser where they were created
- ❌ Accounts don't sync between devices

**To Fix**: Would require:
1. Backend API for user registration
2. Database to store user accounts (Firebase Auth or custom backend)
3. Server-side authentication instead of client-side localStorage

**Workaround**: Use the built-in demo accounts for testing across multiple devices.

---

### 2. Session State Not Transferred Between Devices
**Status**: By Design (requires architectural change)  
**Description**: When transferring a session to a new device, only authentication transfers. The game state (courts, players, queue) does not transfer.

**Why**: Session data is stored in browser localStorage. When logging in on a different device, that device doesn't have access to the first device's localStorage.

**Current Behavior**:
- ✅ Authentication transfers (you stay logged in)
- ❌ Game state doesn't transfer (new device starts fresh)

**To Fix**: Would require storing active session data in Firebase and syncing in real-time (major architectural change).

---

### 2. Session Sharing vs Session Transfer
**Description**: These are two different features:
- **Session Sharing** (QR code): Read-only view for spectators
- **Session Transfer**: Moving your login to a different device

Session sharing works correctly. Session transfer only transfers authentication, not game state.

---

## 📱 Mobile Limitations

### 1. User Info Hidden on Mobile
**Status**: Fixed (pending)  
**Description**: Account name and expiration date are hidden on mobile devices.

**Fix**: Moving to a smaller section below the header on mobile.

---

## 🔄 Recently Fixed

### ✅ Admin Button Visible to Demo Users
**Fixed**: 2026-03-06  
**Description**: Admin button was showing for all users.  
**Solution**: Added `isAdmin()` check to SessionSetup component.

### ✅ Session Transfer Modal on Normal Logout
**Fixed**: 2026-03-06  
**Description**: Session transferred modal was showing when logging out normally.  
**Solution**: Only show modal when session is actually transferred to another device.

### ✅ Transfer Modal with Incorrect Password
**Fixed**: 2026-03-06  
**Description**: Session transfer modal showed even with wrong password.  
**Solution**: Moved password validation before session existence check.

### ✅ React Warning: setState During Render
**Fixed**: 2026-03-06  
**Description**: Console warning about updating BrowserRouter during SessionViewPage render.  
**Solution**: Changed from `navigate()` call to `<Navigate>` component.

---

## 📝 Feature Requests

### 1. Manual Expiry Date Setting
**Status**: Planned  
**Description**: Admin should be able to set custom expiry dates, not just +30/+7 days presets.

### 2. Beta Indicator
**Status**: Planned  
**Description**: Add "BETA" indicator with access time remaining.

---

## 🔍 Reporting Issues

Found a bug? Please document:
1. Steps to reproduce
2. Expected behavior
3. Actual behavior
4. Browser/device info
5. Screenshots if applicable
