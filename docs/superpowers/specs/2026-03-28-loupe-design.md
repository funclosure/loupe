# Loupe — Design Spec

A zen writing PWA where floating AI lenses offer different perspectives on your text.

## Concept

Loupe is a distraction-free markdown writing app built around a single metaphor: a **loupe** — a small magnifying lens you hold up to your text to see it differently. Each lens embodies a persona (Heidegger), a thinking framework (Intuition Pump), or a practical role (Copy Editor). Lenses float alongside your writing as autonomous companions — they read your document, think independently, and request your attention when they have something to say.

The interaction model has three context levels:
1. **Full document** — the lens always has the complete text
2. **Focused paragraph** — the user highlights or selects a passage to narrow the lens's attention
3. **Follow-up** — conversational continuity ("what do you think now?" after edits)

Lenses appear as floating bubbles in the margins, like Figma's multiplayer cursors but with AI sessions instead of people.

## Architecture

### Overview

Client + thin Bun server. One process, two roles: Bun serves the Vite-built static files AND manages lens sessions. No database. The file on disk is the source of truth.

```
loupe/
├── src/
│   ├── server/                 # Bun backend
│   │   ├── index.ts            # Bun.serve entry point
│   │   ├── lens-manager.ts     # Orchestrates multiple lens sessions
│   │   ├── lens-session.ts     # Single lens conversation (Anthropic SDK)
│   │   ├── document.ts         # Holds latest document state in memory
│   │   └── routes.ts           # SSE + REST endpoints
│   ├── client/                 # React SPA (Vite)
│   │   ├── editor/             # Milkdown editor setup + plugins
│   │   ├── lenses/             # Lens bubble UI components
│   │   ├── chrome/             # Top bar, lens picker, settings
│   │   ├── themes/             # CSS variable theme system
│   │   └── App.tsx
│   └── shared/                 # Types shared between server & client
│       ├── types.ts            # Lens, Document, Message types
│       └── lens-presets.ts     # Built-in lens definitions
├── lenses/                     # User-created lens definitions
│   └── heidegger/
│       └── LENS.md             # Frontmatter + system prompt
├── public/
├── vite.config.ts
├── package.json
└── cli.ts                      # `loupe` command entry
```

### Tech Stack

| Layer | Choice | Rationale |
|-------|--------|-----------|
| Runtime | Bun | Fast, TypeScript-native, single binary feel |
| Frontend | React + Vite | Proven SPA tooling, hot reload |
| Editor | Milkdown (ProseMirror) | Markdown-native, composable plugins, full ProseMirror access for future diff/suggestion features |
| AI | Anthropic SDK | Claude API, each lens is an independent conversation |
| Styling | Tailwind + CSS variables | Utility classes + theme system |
| PWA | VitePWA (Workbox) | Offline app shell, installable |
| File I/O | File System Access API | Direct read/write to local `.md` files |

## Data Flow

### Three channels

**1. Document sync (Client → Server)**

Editor content auto-saves to disk on every change (debounced ~1s via File System Access API). Simultaneously, the client posts the latest state to the server so lenses have current context.

```
Editor onChange → debounce 1s → POST /api/document { content, cursor, selection? }
                              → write to file handle (auto-save)
```

No manual save. The file on disk is always in sync.

**2. Lens triggers (Client → Server)**

Three actions that start lens thinking:

| Action | Endpoint | When |
|--------|----------|------|
| Focus paragraph | `POST /api/lens/:id/focus` | User selects/clicks a paragraph |
| Ask | `POST /api/lens/:id/ask` | User types in the lens chat |
| Rethink | `POST /api/lens/:id/rethink` | User hits re-evaluate button |

**3. Lens responses (Server → Client via SSE)**

Single SSE connection carries all lens activity:

```
GET /api/events →

event: lens:thinking     { lensId, status: "thinking" }
event: lens:bubble       { lensId, preview: "Your notion of..." }
event: lens:attention    { lensId, message: "I noticed something..." }
event: lens:message      { lensId, content: "...", streaming: true }
event: lens:done         { lensId }
```

### What the server holds in memory

- Latest document content + cursor position
- Per-lens: conversation history, current state (idle/thinking/waiting), focal paragraph
- Lens definitions loaded from `lenses/` directory

No database. Lens conversations are ephemeral — close the session, they reset.

## Editor

### Milkdown WYSIWYG

WYSIWYG-ish markdown editing like Slack — type markdown syntax and it renders inline. Markdown is the file format under the hood.

**Phase 1 formatting support:**
- Headings (`#` → rendered heading)
- Bold / italic (inline render)
- Lists (bullet + numbered)
- Blockquotes
- Code blocks (syntax highlighting via Shiki)
- Links

No tables, images, or embeds in Phase 1. Text-first.

### Writing surface

- Centered content column (~720px max-width, like Notion)
- Generous margin space on both sides — this is where lens bubbles live
- Monochrome UI — lenses bring the only color accents

## UI

### Zen chrome

Minimal top bar with three elements, all fade on idle and reappear on hover (Shuttle's zen mode pattern):

- **Left**: filename (from file handle, or "Untitled")
- **Center**: empty space
- **Right**: lens count + "+" button to summon a new lens

Top bar shows a subtle "saved" indicator that fades after auto-save.

### Lens bubbles

Float in the margins alongside the content column. Each bubble has:

- Small avatar circle (icon + color from `LENS.md` frontmatter)
- State indicator: idle (dim), thinking (pulsing), wants-attention (gentle glow)
- Preview text (truncated thought)
- Click to expand into chat
- Drag to reposition vertically
- "x" to dismiss/deactivate

### Expanded lens chat

Clicking a bubble opens a floating card (~280px wide):

- Lens name + avatar at top
- Scrollable message thread
- Text input at bottom
- Three context actions: "Re-read full doc" / "Focus here" / "What now?"
- Close to collapse back to bubble

### Color system

- **Main UI**: Monochrome (dark mode default, light mode available)
- **Lenses**: Each lens brings its own accent color via `LENS.md` frontmatter
- Lenses are the only color in the interface — they stand out against the monochrome writing surface

### Keyboard shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd+.` | Toggle zen mode (fade all chrome) |
| `Cmd+L` | Open lens picker |
| `Cmd+O` | Open file |
| `Escape` | Collapse open lens chat |

## Lens System

### LENS.md format

Each lens lives in its own directory under `lenses/`:

```
lenses/
├── heidegger/
│   └── LENS.md
├── intuition-pump/
│   └── LENS.md
├── devils-advocate/
│   └── LENS.md
└── stoic-sage/
    └── LENS.md
```

LENS.md format:

```markdown
---
name: Heidegger
icon: H
color: "#7c3aed"
description: Phenomenological perspective on being and time
---

You are a lens embodying Martin Heidegger's philosophical perspective.
When examining text, consider it through the framework of...
```

Frontmatter provides UI metadata (bubble color, icon, label). Body is the system prompt.

### Lens lifecycle

1. User opens lens picker (`Cmd+L` or "+" button)
2. Picker shows available lenses from `lenses/` directory + built-in presets
3. User activates a lens → server creates a `LensSession` with the system prompt + current document
4. Lens appears as a floating bubble on the canvas
5. Lens remains active until dismissed or session ends

### Lens session on the server

Each active lens is an independent Anthropic conversation:

```
System prompt: [LENS.md body]
Context: "You are reading the following document:\n\n{full document}"
Focus (when set): "The writer is currently focused on this passage:\n\n{selection}"
```

The conversation accumulates — the lens remembers prior exchanges. This is what makes "what do you think now?" meaningful: the lens can compare its previous reading to the updated document.

### Built-in presets

Ship with the app, no `lenses/` directory needed:

- **Devil's Advocate** — challenges assumptions, finds weak arguments
- **Intuition Pump** — Dennett-style thought experiments, reframes the problem
- **First Principles** — strips to fundamentals, asks "why" recursively
- **Empathetic Reader** — how would a general audience feel reading this?
- **Copy Editor** — clarity, concision, grammar

### Phase 2 (architecture supports, not built yet)

- **Lens-to-lens**: server routes one lens's output as input to another
- **Auto-trigger**: server watches document changes and nudges lenses to re-evaluate
- **Lens memory**: persist conversation to disk so lenses survive session restarts
- **Diff suggestions**: lens proposes tracked changes via ProseMirror transactions

## PWA & File Handling

### File System Access API

- `Cmd+O` → `showOpenFilePicker()` → read content into editor
- Auto-save on change (debounced ~1s) → write back to same file handle
- New file: empty untitled document, first save triggers `showSaveFilePicker()`
- Filename displayed in top bar
- Fallback for unsupported browsers: download/upload pattern

### PWA configuration

- `display: standalone` — no browser chrome
- Service worker caches app shell for offline launch
- Register `.md` file handler in manifest
- Offline: editor works fully offline, lens features require network

### CLI entry

```bash
loupe              # starts Bun server, opens browser to localhost
loupe draft.md     # starts server, opens file pre-loaded
```

`cli.ts` starts `Bun.serve()` and calls `open` on the URL.

## Design Inspirations

| Source | What to learn from it |
|--------|-----------------------|
| Shuttle zen mode | Chrome fades on idle, reappears on hover, monochrome surface |
| Shuttle color themes | CSS variable-based theme system (adopt for light/dark + future themes) |
| Figma multiplayer | Floating presences alongside content — the lens bubble UX |
| Notion | Centered content column with generous margins |
| Slack editor | WYSIWYG markdown that renders inline as you type |
| Claude Code skills | `LENS.md` convention mirrors `SKILL.md` — directory-based, frontmatter + prompt body |
| Pace | Bun + Anthropic SDK setup, CLI entry that starts server + opens browser |
