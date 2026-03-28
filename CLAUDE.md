# Loupe

A zen writing PWA where floating AI lenses offer different perspectives on your text.

## Commands

```bash
loupe                  # Start server + open browser (requires `bun link` first)
loupe draft.md         # Open with a file pre-loaded
bun run start          # Start Bun server (port 4460)
bun run build          # Build client via Vite
bun run dev            # Vite dev server (proxies /api to :4460)
bunx vitest run        # Run tests (22 tests)
```

## Tech Stack

- **Runtime:** Bun
- **Frontend:** React 19 + Vite + Tailwind CSS
- **Editor:** Milkdown (ProseMirror-based WYSIWYG markdown)
- **AI:** `@anthropic-ai/claude-agent-sdk` — authenticates through Claude Code session, no API key needed
- **Testing:** Vitest
- **PWA:** VitePWA (currently `selfDestroying: true` for dev — re-enable for production)

## Architecture

Client + thin Bun server in one process. Bun serves Vite-built static files AND manages lens sessions.

```
src/
├── server/
│   ├── index.ts            # Bun.serve entry (port 4460, idleTimeout: 120)
│   ├── routes.ts           # REST + per-request SSE streaming
│   ├── document.ts         # In-memory document store (version-gated)
│   ├── lens-manager.ts     # Activates/deactivates lens sessions (max 5)
│   ├── lens-session.ts     # Agent SDK query() with MessageChannel for multi-turn
│   └── lens-loader.ts      # Parses LENS.md files from lenses/ directory
├── client/
│   ├── App.tsx             # Main shell — wires editor, lenses, file handling
│   ├── editor/
│   │   ├── Editor.tsx      # React wrapper with placeholder + click-to-focus
│   │   └── milkdown-setup.ts  # Milkdown plugins: commonmark, listener, trailing, clipboard
│   ├── hooks/
│   │   ├── use-file.ts     # File System Access API + localStorage persistence
│   │   ├── use-lenses.ts   # Lens state + per-request fetch streaming (pace pattern)
│   │   ├── use-zen-mode.ts # Cmd+. toggle, persisted to localStorage
│   │   └── use-paragraph-focus.ts  # 2s dwell detection for auto-suggest
│   ├── chrome/
│   │   ├── TopBar.tsx      # Filename, save state, lens count, + button
│   │   └── LensPicker.tsx  # Modal with presets + user lenses
│   └── lenses/
│       ├── LensLayer.tsx   # Positions bubbles/chats in right margin
│       ├── LensBubble.tsx  # Collapsed: avatar + preview (react-markdown)
│       └── LensChat.tsx    # Expanded: messages + input (react-markdown)
└── shared/
    ├── types.ts            # LensDefinition, DocumentState, ChatMessage, etc.
    └── lens-presets.ts     # 5 built-in lenses
```

## Conventions

- Use `Bun.serve()` for the server, `Bun.file()` for file I/O
- Use Vite for frontend build (NOT Bun's HTML imports)
- Use Vitest for tests (NOT `bun test`)
- `@shared/*` path alias → `src/shared/*` (configured in tsconfig, vite, vitest)
- AI uses `@anthropic-ai/claude-agent-sdk` with `query()` + `MessageChannel` pattern (from pace)
- Per-request SSE: each lens interaction is POST → stream response → close (NOT persistent EventSource)
- Client reads SSE with `fetch()` + `res.body.getReader()` (NOT EventSource API)
- Milkdown injects `prose`/`milkdown-theme-nord` classes — use MutationObserver to strip them
- Service worker disabled during dev (`selfDestroying: true` in vite.config.ts)
- Server sends `Cache-Control: no-cache` on all static files during dev

## Creating Lenses

```
lenses/my-lens/LENS.md
```

```markdown
---
name: My Lens
description: What this lens does
icon: M          # optional, single char or emoji
color: "#7c3aed" # optional, hex color
model: claude-sonnet-4-6  # optional, overrides default
---

Your system prompt here.
```

Lenses directory is gitignored. See `lenses/README.md` for details.

## Design

- **Theme:** "Warm Ink" — amber-tinted dark (`#1a1816` bg), warm white text (`#ede8e3`)
- **Editor:** Georgia serif, 17px, centered 680px column, 50vh bottom padding
- **Lenses:** monochrome UI, lens color only on avatar and action buttons
- **Zen mode:** Cmd+. fades chrome, hover to reveal

## Specs & Plans

- Original spec: `docs/superpowers/specs/2026-03-28-loupe-design.md`
- Implementation plan: `docs/superpowers/plans/2026-03-28-loupe-implementation.md`
- Lens migration spec: `docs/superpowers/specs/2026-03-28-lens-migration-design.md`

## Known Issues

- Milkdown's nord theme injects unwanted CSS classes — stripped via MutationObserver but occasionally flickers
- ProseMirror `white-space` warning in console (cosmetic, doesn't affect behavior)
- File handle lost on page refresh (browser security) — content persisted via localStorage
