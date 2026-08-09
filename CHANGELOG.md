# v4.9.0

## Admin Dashboard

- Added server-side `user` / `admin` roles.
- Added account status (`active` / `suspended`).
- Added `ADMIN_EMAILS` administrator bootstrap configuration.
- Added protected `/api/admin/*` routes.
- Added dashboard statistics and searchable user management.
- Added per-user account/device/activity details.
- Added suspend/reactivate controls.
- Added forced session revocation.
- Suspended accounts are denied login and normal profile access.
- Added responsive admin UI integrated into the existing Int-Messager Settings area.
- Private message content is not exposed through the Admin Dashboard.
