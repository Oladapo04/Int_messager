# Int-Messager Theme Architecture — v4.11.5

## Core rule

**Layout owns geometry. Theme owns colour.**

`client/src/styles/theme-authority-v4115.css` is the final global stylesheet and must stay last.

## Semantic tokens

- `--ui-app-bg`
- `--ui-sidebar-bg`
- `--ui-header-bg`
- `--ui-panel`
- `--ui-panel-2`
- `--ui-panel-3`
- `--ui-text`
- `--ui-text-strong`
- `--ui-muted`
- `--ui-soft`
- `--ui-border`
- `--ui-border-strong`
- `--ui-control-bg`
- `--ui-composer-bg`
- `--ui-input-bg`
- `--ui-accent`

Light and dark appearances change these tokens. Layout CSS should not hard-code white/black surfaces.

## Critical ownership

Theme authority now controls:
- app/background colour
- top conversation header
- bottom composer tray
- message input
- Send button contrast
- home/title dashboard
- recent chat cards
- settings/title readability

## Chat close control

The conversation-header **X / Close chat** button is removed from JSX. Mobile still has Back/More controls; desktop users can switch conversations from the sidebar.

## Future rule

Do not introduce `background: #fff`, `background: white`, or hard-coded dark text into layout CSS. Consume semantic tokens instead.
