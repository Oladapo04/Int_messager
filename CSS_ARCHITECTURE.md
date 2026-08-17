# Int-Messager CSS Architecture — v4.11.4

## Global CSS layers

Keep global CSS in this order:

1. **Foundation**
   - `Version3.css`
   - `layout-v474.css`
   - `premium-v474.css`
   - `themes.css`

2. **Feature CSS**
   - messaging / group chat
   - attachments
   - chat info
   - presence
   - contacts / privacy
   - calls
   - disappearing messages
   - scheduled messages
   - reactions

3. **Current theme system**
   - `unified-theme-system-v4117.css`
   - `dark-mode-professional-v4120.css`
   - `dark-mode-premium-v4121.css`
   - `mobile-conversation-premium-v4122.css`
   - `light-mode-premium-v4123.css`

4. **Premium responsive product layer**
   - `premium-experience-v4110.css`
   - `mobile-chats-premium-v4111.css`
   - `desktop-premium-v4112.css`
   - `desktop-chat-filters-v4112a.css`
   - `performance-loading-v4113.css`

## Retired global dark-mode layers

These are intentionally no longer imported by `App.jsx`:

- `dark-mode-v491.css`
- `dark-mode-visibility-v4113.css`
- `dark-mode-contrast-v4114.css`
- `dark-mode-critical-text-v4115.css`
- `dark-mode-settings-chat-v4116.css`

Do not re-add them. Their responsibilities have been superseded by the current premium theme stack.

## Lazy CSS

The Admin Dashboard is already a lazy React chunk. Its two stylesheets now live with `AdminDashboard.jsx`, so they are downloaded only when the dashboard is opened:

- `admin-dashboard-v490.css`
- `admin-dashboard-v493.css`

This keeps Admin styling out of the initial app CSS bundle.
