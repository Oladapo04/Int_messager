# Int-Messager v4.11.3 — Performance & Code Splitting

This release reduces the amount of JavaScript required for the initial app shell.

## Required files

Replace:
- `client/src/App.jsx`

Add:
- `client/src/styles/performance-loading-v4113.css`

## What is now lazy-loaded

The following code is no longer part of the first UI render unless it is actually needed:

- Admin Dashboard
- Status / Updates
- Signed-in devices
- Conversation view
- Message list
- Composer
- Attachment renderer

The Chats shell can therefore render before these feature modules are downloaded/evaluated.

## Optional Vite 8 vendor splitting

The package also contains:

- `VITE_8_CODE_SPLITTING_SNIPPET.js`

If your existing Vite configuration is already customized, **do not replace it**. Merge only the `build` section from the snippet into your existing `vite.config.js`.

This separates React, Socket.IO, and remaining dependencies into cacheable vendor chunks.

## Build

```bash
npm run validate
cd client
npm run build
cd ..
node server.js
```

After the build, `dist/assets` should contain multiple JavaScript files rather than one large application chunk.

## Notes

- No backend or MongoDB migration is required.
- Existing feature behaviour is unchanged.
- Small loading states are shown only when a lazy feature is being fetched for the first time.
- Subsequent opens are normally served from browser cache.
