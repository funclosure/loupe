# Loupe — Design Spec

A zen writing PWA where floating AI lenses offer different perspectives on your text.

## Concept

Loupe is a distraction-free markdown writing app built around a single metaphor: a **loupe** — a small magnifying lens you hold up to your text to see it differently. Each lens embodies a persona (Heidegger), a thinking framework (Intuition Pump), or a practical role (Copy Editor). Lenses float alongside your writing as companions that respond when summoned and offer thoughts when you shift focus to a new passage. In Phase 2, lenses become fully autonomous — thinking independently and conversing with each other.

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

Editor content auto-saves to disk on every change (debounced ~1s via File System Access API). Simultaneously, the client posts the latest state to the server so lenses have current context. Each document update carries an incrementing version counter. The server is the secondary copy — the file on disk is always authoritative.

```
Editor onChange → debounce 1s → POST /api/document { content, cursor, selection?, version }
                              → write to file handle (auto-save)
```

No manual save. The file on disk is always in sync.

**2. Lens triggers (Client → Server)**

Three user actions that start lens thinking:

| Action | Endpoint | When |
|--------|----------|------|
| Focus paragraph | `POST /api/lens/:id/focus { paragraphRange, version }` | User selects text or clicks into a paragraph |
| Ask | `POST /api/lens/:id/ask { message }` | User types in the expanded lens chat |
| What now? | `POST /api/lens/:id/rethink` | User presses "What now?" — lens re-reads the latest document and responds in the context of the ongoing conversation |

Additionally, when a user focuses a new paragraph and a lens is active, the lens **auto-suggests**: after a ~2s dwell time, the server sends the focused passage to each active lens. If a lens has something to say, it surfaces a preview bubble. Only one auto-suggest per paragraph focus (no repeated firing). This is the "auto-suggest on paragraph focus" behavior.

**3. Lens responses (Server → Client via SSE)**

Single SSE connection carries all lens activity:

```
GET /api/events →

event: lens:thinking     { lensId }                          # lens started processing
event: lens:bubble       { lensId, preview: "..." }          # short preview for collapsed bubble (auto-suggest result)
event: lens:message      { lensId, delta: "...", done: false } # streaming chunk for expanded chat
event: lens:message      { lensId, delta: "", done: true }    # stream complete
event: lens:error        { lensId, error: "..." }             # API failure, shown in bubble
```

Streaming uses incremental deltas — each `lens:message` event contains a text chunk appended to the running response. The client accumulates chunks per `lensId`.

### What the server holds in memory

- Latest document content + cursor position
- Per-lens: conversation history, current state (idle/thinking/waiting), focal paragraph
- Lens definitions loaded from `lenses/` directory

No database. Lens conversations are ephemeral — close the session, they reset.

### Configuration

API key via environment variable: `ANTHROPIC_API_KEY`. The CLI reads it from the environment (same pattern as pace). No settings UI for the key in Phase 1.

Optional: `~/.loupe/config.json` for preferences (default model, theme). The CLI can also accept `--model` flag.

### Model selection

Default model: `claude-sonnet-4-6` (good balance of speed and quality for streaming into bubbles). Configurable globally via config or per-lens in `LENS.md` frontmatter with an optional `model` field. Haiku for fast/cheap lenses, Opus for deep analysis lenses.

### Error handling

- **Missing API key**: server starts but lens activation shows an inline error with setup instructions
- **API errors (rate limit, 500)**: lens bubble shows error state with a retry button; other lenses unaffected
- **SSE disconnection**: client auto-reconnects with exponential backoff; lens bubbles show "reconnecting..." state
- **File System Access API permission revoked**: editor content preserved in memory, top bar shows "save unavailable" warning, user can re-grant or use download fallback

### Resource limits

Maximum **5 concurrent lenses** in Phase 1. The lens picker disables activation beyond the limit with a note. Each lens carries the full document in context, so cost scales with `document_length x active_lenses`.

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

**Architecture note for Phase 2**: The Milkdown plugin setup must preserve direct access to ProseMirror's `EditorView` and transaction system. This is needed for the future diff/suggestion feature where lenses propose tracked changes as ProseMirror decorations. Avoid abstractions that hide the ProseMirror layer.

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
- Three context actions:
  - **"Focus here"** — sends the currently selected/focused paragraph to this lens (same as the `focus` trigger)
  - **"What now?"** — asks the lens to re-read the latest document and respond (the `rethink` trigger)
  - **"Reset"** — clears the conversation history and starts the lens fresh with the current document
- Close to collapse back to bubble

### Lens picker

`Cmd+L` or clicking the "+" button opens a modal overlay listing available lenses:

- **Built-in presets** section (always present)
- **User lenses** section (from `lenses/` directory, if any exist)
- Each entry shows: icon, name, description, and an "Activate" button
- Grayed out with a note when 5 lenses are already active
- No preview or configuration — just pick and go

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
model: claude-sonnet-4-6    # optional, overrides global default
---

You are a lens embodying Martin Heidegger's philosophical perspective.
When examining text, consider it through the framework of...
```

**Required fields**: `name`, `description`
**Optional fields**: `icon` (single character or emoji, defaults to first letter of name), `color` (hex, defaults to a generated muted tone), `model` (overrides global default)

Frontmatter provides UI metadata (bubble color, icon, label). Body is the system prompt (plain text, not rendered as markdown). Malformed LENS.md files (missing frontmatter delimiters, missing required fields) are skipped with a console warning.

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

**Context window management**: When a lens conversation approaches the context limit, the server summarizes the earlier exchanges into a condensed context block and resets the conversation with the summary + current document. The user sees a subtle "lens refreshed" indicator but the conversation continues naturally.

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
- **New file**: app opens with an empty untitled document. The first `Cmd+S` triggers `showSaveFilePicker()` to choose location and filename. After that, auto-save takes over.
- **Switching files**: `Cmd+O` while a file is open replaces the current document. All active lens conversations reset (they start fresh with the new document context).
- Filename displayed in top bar
- **Fallback** (Firefox, Safari): no File System Access API. The editor works in-memory. "Open" uses a standard `<input type="file">`. "Save" triggers a `.md` download. Auto-save is disabled — top bar shows a "download to save" hint. The writing and lens experience is otherwise identical.

### PWA configuration

- `display: standalone` — no browser chrome
- Service worker caches app shell for offline launch
- Register `.md` file handler in manifest
- **Offline**: editor works fully offline. Lens bubbles show "offline" state (dimmed, no interaction). When connection restores, lenses resume automatically.

### Distribution model

Loupe is a **local web app** that uses PWA features for polish. The Bun server must be running for lenses to work (it manages AI sessions). The PWA manifest provides: standalone display (no browser chrome), app shell caching (fast reload), and `.md` file handler registration. It is not a hosted SaaS — the user runs `loupe` locally.

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
