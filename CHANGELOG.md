# Changelog

All notable changes to Kitchen Boss will be documented in this file.

## [Unreleased]

### Added
- Session transfer notification system with 10-second countdown
- React Router with dedicated URLs (`/admin`, `/create-session`, `/session`)
- Session transfer confirmation dialog showing device info
- Real-time session change detection via Firebase
- Protected admin routes (admin-only access)
- Comprehensive testing guide for new features

### Changed
- Login now shows confirmation dialog when existing session detected
- Old device receives transfer notification and auto-closes/redirects
- Password validation now happens before session existence check
- Session transfer modal only shows when session is actually transferred
- Admin button now hidden from non-admin users

### Fixed
- Admin button visibility (now only shows for admin users)
- Session transfer logout bug (new device stays logged in, old device logs out)
- React warning about setState during render in SessionViewPage
- Session transfer modal showing on normal logout
- Transfer modal appearing with incorrect password
- Start Session button not navigating to session page

---

## [0.2.0] - 2026-03-05

### Added
- Cross-browser session management with Firebase
- Admin force logout functionality
- Online status indicator in admin panel
- Last activity tracking for users
- Session timeout (1 hour of inactivity)
- Session validation and cleanup

### Changed
- Logout now properly removes Firebase session
- Admin panel shows real-time online/offline status
- Session timeout check runs every minute

### Fixed
- Users staying logged in after force logout
- Firebase session not being removed on logout
- Admin dropdown menu visibility (z-index issue)
- Session persistence across browser refreshes

---

## [0.1.0] - Initial Release

### Added
- User authentication system
- Session setup with court configuration
- Win-Lose Stack rotation mode
- Player queue management
- Court management with drag-and-drop
- Activity log
- Dark mode support
- Session sharing with QR codes
- Admin panel for user management
- Guest mode
- Time-limited access (30/60 day subscriptions)

### Features
- **Authentication**: Login, register, guest mode
- **Session Management**: Create, configure, and manage pickleball sessions
- **Player Management**: Add players, manage queue, track activity
- **Court Management**: Multiple courts, drag-and-drop players
- **Rotation Modes**: Win-Lose Stack (winners vs winners, losers vs losers)
- **Admin Panel**: User management, access control, force logout
- **Sharing**: QR code generation for read-only session viewing
- **Themes**: Light and dark mode with multiple color schemes

---

## Version History

- **v0.2.0**: Session management & admin features
- **v0.1.0**: Initial release with core functionality
- **Unreleased**: Session transfer & routing features

---

## Upcoming Features

- [ ] Manual expiry date setting for admin
- [ ] Beta indicator with access time remaining
- [ ] Session state transfer between devices
- [ ] Fix player drag-and-drop in lowest stack
- [ ] Mobile user info display improvements
- [ ] Custom share icons
- [ ] Distinct end session and logout icons
