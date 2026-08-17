# Int-Messager v4.11.4 — CSS Architecture & Performance Cleanup

This release reduces the initial CSS graph without changing the current premium design.

## What changed

### Removed from the global build
The following obsolete dark-mode generations are no longer imported:

- `dark-mode-v491.css`
- `dark-mode-visibility-v4113.css`
- `dark-mode-contrast-v4114.css`
- `dark-mode-critical-text-v4115.css`
- `dark-mode-settings-chat-v4116.css`

These were old repair layers that were being overridden by the current premium theme system.

### Admin CSS is now lazy
`AdminDashboard` is already loaded with React `lazy()`. Its CSS now loads with that feature instead of on every app launch:

- `admin-dashboard-v490.css`
- `admin-dashboard-v493.css`

## Required files

Replace:
- `client/src/App.jsx`
- `client/src/components/admin/AdminDashboard.jsx`

Replace/add:
- `client/src/styles/admin-dashboard-v490.css`
- `client/src/styles/admin-dashboard-v493.css`

Optional developer helper:
- `scripts/audit-css-imports.mjs`

Reference:
- `CSS_ARCHITECTURE.md`

## Install

Apply this on top of **v4.11.3**.

```bash
npm run validate

node scripts/audit-css-imports.mjs

cd client
npm run build
cd ..

node server.js
```

## What to look for in the Vite build output

Your previous global CSS bundle was:

`312.19 kB` (`46.74 kB` gzip)

The new value should be lower. Exact savings depend on Vite/Rolldown minification and how much duplicate CSS it can already eliminate.

The build may also emit an `AdminDashboard-*.css` chunk. That is expected and is a positive result: Admin styling is no longer part of first-load CSS.

## Important

Do not delete the retired CSS files from your project yet. They are simply no longer imported. Keeping them temporarily makes rollback easy while we validate the cleaned build.
