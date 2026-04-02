# Loupe

A zen writing PWA where floating AI lenses offer different perspectives on your text.

## Commands

```bash
loupe                  # Start server + open file picker (requires `bun link` first)
loupe draft.md         # Open with a file pre-loaded
loupe .                # Same as loupe (browse current directory)
bun run start          # Start Bun server (port 4460)
bun run build          # Build client via Vite
bun run dev            # Vite dev server (proxies /api to :4460)
bunx vitest run        # Run tests (48 tests)
```

## Tech Stack

* **Runtime:** Bun

* **Frontend:** React 19 + Vite + Tailwind CSS

* **Editor:** Milkdown (ProseMirror-based WYSIWYG markdown)

* **AI:** `@anthropic-ai/claude-agent-sdk` — authenticates through Claude Code session, no API key needed

* **Testing:** Vitest

* **PWA:** VitePWA (currently `selfDestroying: true` for dev — re-enable for production)

## Architecture

Client + thin Bun server in one process. Bun serves Vite-built static files AND manages lens sessions.

```
src/
├── server/
│   ├── index.ts            # Bun.serve entry (port 4460, idleTimeout: 120)
│   ├── routes.ts           # REST + SSE streaming, file I/O, outline, lens, image upload/serve, config
│   ├── document.ts         # In-memory document store (version-gated)
│   ├── file-store.ts       # Active file path tracking + outline sidecar path
│   ├── lens-manager.ts     # Activates/deactivates lens sessions (max 5, system lenses exempt)
│   ├── lens-session.ts     # Agent SDK query() with MessageChannel for multi-turn
│   └── lens-loader.ts      # Parses LENS.md files, writes new lenses
├── client/
│   ├── App.tsx             # Main shell — wires editor, lenses, outline, file handling
│   ├── editor/
│   │   ├── Editor.tsx      # React wrapper with placeholder, click-to-focus, image paste
│   │   └── milkdown-setup.ts  # Milkdown plugins: commonmark, listener, trailing, clipboard
│   ├── hooks/
│   │   ├── use-file.ts     # Server-backed file I/O, frontmatter stripping, localStorage backup
│   │   ├── use-lenses.ts   # Lens state + per-request fetch streaming, lens creator
│   │   ├── use-outline.ts  # Outline content, inline chat, sidecar persistence
│   │   ├── use-zen-mode.ts # Cmd+. toggle, persisted to localStorage
│   │   └── use-paragraph-focus.ts  # 2s dwell detection for auto-suggest
│   ├── chrome/
│   │   ├── TopBar.tsx      # App menu (hamburger), outline toggle, filename, image folder dialog
│   │   ├── LensPicker.tsx  # Modal with presets + user lenses + lens creator input
│   │   ├── FilePicker.tsx  # File browser — open, create, delete (soft)
│   │   └── FrontmatterBar.tsx  # Bottom-right metadata display + editor
│   ├── outline/
│   │   └── OutlinePanel.tsx # Intention editor (Milkdown) + inline chat + draggable divider
│   └── lenses/
│       ├── LensLayer.tsx   # Positions bubbles/chats in right margin
│       ├── LensBubble.tsx  # Collapsed: avatar + preview (react-markdown)
│       ├── LensChat.tsx    # Expanded: messages + input + proposal detection
│       ├── LensProposalCard.tsx  # Lens Creator proposal preview + create button
│       └── LoupeIcon.tsx   # Loupe-shaped icon component
└── shared/
    ├── types.ts            # LensDefinition, DocumentState, ChatMessage, etc.
    └── lens-presets.ts     # 5 built-in lenses + Lens Creator (system)
```

## Conventions

* Use `Bun.serve()` for the server, `fs` (readFileSync/writeFileSync) for file I/O

* Use Vite for frontend build (NOT Bun's HTML imports)

* Use Vitest for tests (NOT `bun test`)

* `@shared/*` path alias → `src/shared/*` (configured in tsconfig, vite, vitest)

* AI uses `@anthropic-ai/claude-agent-sdk` with `query()` + `MessageChannel` pattern

* Per-request SSE: each lens interaction is POST → stream response → close (NOT persistent EventSource)

* Client reads SSE with `fetch()` + `res.body.getReader()` (NOT EventSource API)

* Milkdown injects `prose`/`milkdown-theme-nord` classes — use MutationObserver to strip them

* Frontmatter stripped from editor on load, preserved in memory, re-attached on save (supports `---` and `***` delimiters)

* `fileLoadedRef` guard prevents stale localStorage from overwriting files on launch

* Service worker disabled during dev (`selfDestroying: true` in vite.config.ts)

* Server sends `Cache-Control: no-cache` on all static files during dev

## File I/O

All file I/O goes through the server (no browser File System Access API):

* `GET /api/file?path=...` — read file, set as active

* `POST /api/file` — write to active path (or new path via `{ content, path }`)

* `GET /api/files` — list `.md`/`.mdx` files in CWD

* `DELETE /api/file?path=...` — soft delete to `.recently-deleted/`

* `GET /api/outline` / `POST /api/outline` — read/write `.outline.md` sidecar

* `POST /api/outline/chat` — SSE stream for outline refinement

* `POST /api/lenses/create` — create user lens in `.loupe/lenses/`

* `GET /api/cwd` — current working directory + project root

* `POST /api/open-finder` — open CWD in macOS Finder

* `GET /api/config` / `POST /api/config` — read/write `.loupe/config.json`

* `POST /api/pick-folder` — native macOS folder picker via osascript

* `POST /api/image` — upload image (paste), save to configured imageDir

* `POST /api/image/detect` — auto-detect image folder from document content

* `{imagePrefix}/*` — serves images from configured imageDir

## Creating Lenses

**Through the app:** Cmd+L → type a description → Lens Creator guides you through conversation.

**Manually:** Create `.loupe/lenses/my-lens/LENS.md`:

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

User lenses stored in `.loupe/lenses/` (project-scoped). Legacy `lenses/` directory also scanned.

## Image Folder

Configure via hamburger menu → Image folder. Settings stored in `.loupe/config.json`:

* `imageDir` — where images live on disk (relative to project root, or absolute)
* `imagePrefix` — what path to use in markdown `![](prefix/file.png)`

Three ways to set it:
* **Auto-detect** — scans document for `![](path)` refs, finds matching dir under project root (`public/`, `static/`, etc.)
* **Browse** — native macOS folder picker (osascript), auto-derives prefix
* **Manual** — type paths directly

When configured, pasting an image in the editor uploads it to imageDir and inserts markdown. Images are served by the server matching the prefix.

Project root is auto-detected by walking up from CWD to find `package.json` or `.git`.

## Intention Outline

Sidecar file: `essay.md` → `essay.outline.md`. Toggled via Cmd+Shift+E or TopBar button. The outline panel has a Milkdown editor + inline chat for refinement. Lenses automatically receive the outline as context and check writing alignment.

## Design

* **Theme:** "Warm Ink" — amber-tinted dark (`#1a1816` bg), warm white text (`#ede8e3`)

* **Editor:** Georgia serif, 17px, centered 680px column, 50vh bottom padding

* **Lenses:** monochrome UI, lens color only on avatar and action buttons

* **Outline:** fixed left panel (360px), Milkdown editor + chat below draggable divider

* **Frontmatter:** bottom-right bar showing fields, click info icon to edit

* **Zen mode:** Cmd+. fades chrome, hover to reveal

## Specs & Plans

* Original spec: `docs/superpowers/specs/2026-03-28-loupe-design.md`

* Implementation plan: `docs/superpowers/plans/2026-03-28-loupe-implementation.md`

* Lens migration spec: `docs/superpowers/specs/2026-03-28-lens-migration-design.md`

* Phase 1.6+1.7 spec: `docs/superpowers/specs/2026-03-29-phase-1.6-1.7-design.md`

* Lens Creator spec: `docs/superpowers/specs/2026-03-30-lens-creator-design.md`

* Intention outline spec: `docs/superpowers/specs/2026-03-31-intention-outline-design.md`

## Known Issues

* Milkdown's nord theme injects unwanted CSS classes — stripped via MutationObserver but occasionally flickers

* ProseMirror `white-space` warning in console (cosmetic, doesn't affect behavior)

* Heading level input rule bug: typing `##` inside an existing heading stacks levels instead of replacing

