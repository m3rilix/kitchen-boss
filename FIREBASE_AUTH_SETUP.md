# Firebase Authentication Setup Guide

## Overview
This application now uses **Firebase Authentication** for production-grade security with automatic cross-browser login support.

## What Changed
- ✅ Migrated from localStorage-based auth to Firebase Auth
- ✅ User data now synced via Firestore (works across browsers)
- ✅ Passwords hashed with bcrypt (handled by Firebase)
- ✅ Sessions managed automatically (no manual tracking needed)
- ✅ Ready for email verification and password reset flows
- ✅ Supports MFA in the future

## Setup Steps (5 minutes)

### 1. Enable Firestore in Firebase Console

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project: **kitchen-boss-df506**
3. In the left menu, click **Build → Firestore Database**
4. Click **Create Database**
5. Select region: **asia-southeast1** (to match your existing DB)
6. Click **Create**

### 2. Deploy Firestore Security Rules

1. In Firebase Console, go to **Firestore Database → Rules**
2. Click **Edit rules**
3. Replace the existing rules with the content from `firestore.rules` in your repo:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Users can only read/write their own user document
    match /users/{uid} {
      allow read, write: if request.auth.uid == uid;
    }

    // Admins can read all users
    match /users/{document=**} {
      allow read: if isAdmin();
    }

    // Helper function to check if user is admin
    function isAdmin() {
      let user = get(/databases/$(database)/documents/users/$(request.auth.uid));
      return user.data.role == 'admin';
    }
  }
}
```

4. Click **Publish**

### 3. Verify Email/Password Auth is Enabled

1. In Firebase Console, go to **Build → Authentication**
2. Click **Sign-in method**
3. Make sure **Email/Password** is enabled (toggle on)
4. Make sure **Email link (passwordless sign-in)** is disabled

### 4. Test Cross-Browser Login

#### Browser A:
1. Open the app in one browser
2. Click "Create Account"
3. Register: `testuser@example.com` / `password123` / `Test User`
4. You should be logged in

#### Browser B:
1. Open the app in a different browser (or incognito window)
2. Click "Sign In"
3. Login with the same credentials: `testuser@example.com` / `password123`
4. ✅ Should login successfully!

## Optional: Initialize Demo Accounts

To recreate demo accounts in Firestore:

### Via Firebase Console:

1. Create documents manually in Firestore:
   - Path: `users/demo1`
   - Document ID: `demo1` (this becomes the user UID)

2. For each demo account, add these fields:
   ```
   id: "demo1"
   email: "demo1@kitchenboss.app"
   name: "Demo User 1"
   role: "user"
   accessTier: "30_days"
   accessStartDate: (today's date)
   accessEndDate: (30 days from today)
   createdAt: (today's date)
   lastLoginAt: (today's date)
   isActive: true
   ```

### Via Firebase Auth:

1. Go to **Authentication → Users**
2. Click **Add User**
3. Create:
   - demo1@kitchenboss.app / Kb7xP2m
   - demo2@kitchenboss.app / Qw9Tn4k
   - demo3@kitchenboss.app / Ry5Hj8s
   - demo4@kitchenboss.app / Lm3Vb6p
   - admin@kitchenboss.app / admin123!!

4. Then create corresponding Firestore documents (from step above)

## Features Now Available

✅ **Cross-Browser Login**
- Register in one browser, login in another ✓

✅ **Email Verification** (ready to implement)
- Code: `await sendVerificationEmail()`
- Check: `isEmailVerified()`

✅ **Password Reset** (ready to implement)
- Code: `await sendPasswordResetEmail(email)`

✅ **Account Management**
- Admins can update access tiers
- Admins can extend access
- Auto-logout when access expires

✅ **Session Timeout**
- 1 hour inactivity timeout
- Automatic cleanup

## Troubleshooting

### Users can register but can't login from different browser

**Problem:** User doesn't exist in Firestore
**Solution:** 
- Make sure Firestore has been created (see Step 1)
- Check that registration successfully created the user doc in Firestore
- In Firebase Console → Firestore → Collection `users`, verify the document exists

### "Access has expired" error

**Solution:** The user's `accessEndDate` is in the past. Update it:
1. Go to Firestore
2. Find the user document
3. Set `accessEndDate` to a future date (30+ days out)

### "User not found" error

**Problem:** User exists in Firebase Auth but not in Firestore
**Solution:**
1. Go to Firebase Console → Firestore
2. Create a new document in the `users` collection with the user's UID
3. Fill in the same fields as the demo accounts above

### Firestore "Permission denied" errors

**Problem:** Security rules are wrong
**Solution:**
1. Go back to Step 2 and verify the rules were published correctly
2. Make sure the user is authenticated (signed in)
3. Check that the user document has the correct UID

## Admin Functions Available

In the Admin Panel, you can now:

- **View all users** - See list of all registered accounts
- **Update Access Tier** - Change from 30_days to 60_days to infinite
- **Extend Access** - Add more days to a user's access
- **Set Custom Expiry** - Pick any specific end date
- **Toggle User Active** - Deactivate/reactivate accounts
- **Delete User** - Permanently remove a user
- **View Active Sessions** - See who's logged in and from where

## Security Checklist

- ✅ Passwords hashed with bcrypt + salt (Firebase)
- ✅ Encryption at rest (Firebase AES-256)
- ✅ Encryption in transit (TLS 1.2+)
- ✅ Rate limiting on login (Firebase built-in)
- ✅ Account lockout after failures (Firebase)
- ✅ GDPR compliant (Google-managed)
- ✅ No credentials in localStorage
- ✅ Sessions managed by Firebase

## Cost (Covers Your Scale)

- **Firebase Auth:** Free for 50k users/month
- **Firestore:** Free for first 1GB (easily covers user metadata)
- **Total:** ~$0/month until 100k+ users

## Next Steps

1. Complete the setup above (5 minutes)
2. Test cross-browser login
3. (Optional) Implement email verification
4. (Optional) Implement password reset flow
5. (Future) Add MFA when needed

## Support

If you encounter issues:

1. Check [Firebase Documentation](https://firebase.google.com/docs/auth)
2. Check [Firestore Documentation](https://firebase.google.com/docs/firestore)
3. Open Firebase Console to inspect user data in real-time

---

**Deployment Note:** Your Vercel build has been deployed with Firebase Auth integrated. The app is ready to use once you complete the setup steps above!
