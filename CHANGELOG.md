# Changelog — v4.11.10

## Chat opening
- Conversations now open at the newest/latest message.
- Latest-first positioning runs once when a room is opened.
- It does not rerun on incoming messages, typing changes or uploads.

## Scrolling
- Removed per-chat saved scroll-position persistence.
- Preserved no-forced-scroll behavior while actively reading older messages.
- Preserved the smart ↓ new-message navigation control.
- Preserved explicit search/reply/pinned navigation.

## Read receipts
- Opening at the latest message allows the active visible room to be marked seen.
- If the user later scrolls upward, new messages are not immediately marked seen until the user returns near the bottom.
