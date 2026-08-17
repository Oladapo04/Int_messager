# Int-Messager v4.11.5 — Unified Theme Architecture

Apply on top of **v4.11.4**.

## Fixes included

- Dark home/title dashboard
- Dark top conversation header
- Dark bottom composer/Send area
- Readable input placeholder/icons in dark mode
- Readable Settings/title text
- Removes the conversation-header X button
- Adds a final semantic theme authority layer so layout CSS cannot override appearance colours

## Files

Replace:
- `client/src/App.jsx`

Add:
- `client/src/styles/theme-authority-v4115.css`
- `scripts/audit-theme-v4115.mjs`

Reference:
- `THEME_ARCHITECTURE_V4115.md`

## Install

```bash
npm run validate
node scripts/audit-theme-v4115.mjs

cd client
npm run build
cd ..

node server.js
```

## Smoke test

Dark mode:
1. Home/title screen
2. Conversation header
3. Conversation composer + Send
4. Settings
5. Recent chats
6. Mobile conversation

Light mode:
1. Home/title screen
2. Conversation header/composer
3. Settings
4. Mobile Chats
