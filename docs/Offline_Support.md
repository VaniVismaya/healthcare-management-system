# MediCare Pro Offline Support

## What is now supported

### Web
- Last successful `GET` responses are cached locally and shown back when the device is offline.
- Supported JSON write actions are queued locally when internet is unavailable.
- Queued changes auto-sync when internet returns or after login.
- A service worker caches the app shell so previously opened screens can reopen offline.
- A global banner shows:
  - offline mode
  - pending sync count
  - syncing state
- Module-level drafts:
  - doctor prescription form
  - doctor profile text form
  - doctor lab order assignment form
  - patient profile text form
  - patient insurance text form
  - pharmacy profile text form
  - pharmacy medicine add form
  - pharmacy stock update form
  - receptionist walk-in notes and vitals form
  - lab report summary form

### Mobile
- Auth session is stored locally and restored after app relaunch.
- Last successful `GET` responses are cached locally and reused offline.
- Supported JSON write actions are queued locally if the network drops.
- Pending actions auto-sync in the background every 20 seconds when connectivity comes back.
- A global banner shows:
  - offline mode
  - pending sync count
  - syncing state
- Module-level drafts:
  - doctor prescription form
  - doctor profile text form
  - doctor lab order assignment form
  - patient profile text form
  - patient insurance text form
  - pharmacy profile text form
  - pharmacy medicine add form
  - lab report upload form
- Receptionist walk-in form now restores:
  - patient details
  - selected date/session
  - priority
- Queue action updates now show `saved offline and queued for sync` when the network drops.

## Safely queued actions
- Prescription creation and similar JSON save/update actions
- Doctor schedule and leave updates
- Status/vitals style updates
- Handover notes and other standard JSON forms
- Pharmacy stock updates and similar non-payment write actions

## Still online-only
- Login / registration / OTP
- Payments
- File uploads
- Live booking that depends on real-time slot validation
- QR check-in endpoints
- Video consultation

## File upload limitation
- Forms can save their text locally while offline.
- Any file field such as:
  - profile photo
  - doctor certificate
  - insurance KYC document
  - report PDF/image
  still needs internet and may need to be reattached after reconnecting.

## Real-world behavior
- Offline actions are saved locally first.
- Other users do **not** receive them until sync completes.
- Once internet returns, queued changes are pushed to the server automatically.

## Important note
- Offline support is intentionally conservative for actions that need live server validation.
- This keeps queue numbers, payments, and identity flows from going out of sync.
