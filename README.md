<p align="center">
  <img src="public/favicon.svg" width="80" alt="Loupe" />
</p>

<h1 align="center">Loupe</h1>

<p align="center">
  A zen writing app where floating AI lenses offer different perspectives on your text.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/runtime-Bun-f472b6" alt="Bun" />
  <img src="https://img.shields.io/badge/React-19-61dafb" alt="React 19" />
  <img src="https://img.shields.io/badge/AI-Claude-cc785c" alt="Claude" />
</p>

## What is it?

Loupe is a distraction-free markdown editor with a twist: **AI lenses** float alongside your writing like small magnifying glasses. Each lens embodies a persona or thinking framework — a Devil's Advocate that challenges your assumptions, a Copy Editor that tightens your prose, a First Principles thinker that strips to fundamentals.

You write. Lenses watch. Drag one onto a paragraph to focus its attention. It responds in the margins, never interrupting your flow.

## Features

- **WYSIWYG markdown editing** — Milkdown/ProseMirror with warm ink theme
- **AI lenses** — 5 built-in + create your own with a simple markdown file
- **Drag-to-inspect** — drag a lens onto any paragraph to start a conversation
- **Syntax highlighting** — Shiki-powered code blocks with language selector, copy, wrap
- **Zen mode** — Cmd+. fades all chrome, hover to reveal
- **Undo/redo** — full history with Cmd+Z / Cmd+Shift+Z
- **File handling** — File System Access API for native open/save, localStorage persistence
- **No API key needed** — authenticates through Claude Code session

## Quick Start

Requires [Bun](https://bun.sh) and [Claude Code](https://docs.anthropic.com/en/docs/claude-code).

```bash
# Install dependencies
bun install

# Build and run
bun run build && bun run start

# Open http://localhost:4460
```

Or use the CLI:

```bash
bun link          # Register the CLI globally (once)
loupe             # Start server + open browser
loupe draft.md    # Open with a file pre-loaded
```

## Creating Lenses

Drop a `LENS.md` file in the `lenses/` directory:

```
lenses/my-lens/LENS.md
```

```markdown
---
name: My Lens
description: What this lens does
icon: M
color: "#7c3aed"
---

Your system prompt here. The lens sees the full document
and responds based on this persona.
```

See `lenses/README.md` for details.

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd + L` | Open lens picker |
| `Cmd + O` | Open file |
| `Cmd + S` | Save file |
| `Cmd + .` | Toggle zen mode |
| `Cmd + Z` | Undo |
| `Cmd + Shift + Z` | Redo |
| `Cmd + /` | Shortcuts overlay |
| `Escape` | Close / collapse |

## Tech Stack

- **Runtime:** [Bun](https://bun.sh)
- **Frontend:** React 19 + Vite + Tailwind CSS
- **Editor:** [Milkdown](https://milkdown.dev) (ProseMirror-based)
- **Syntax:** [Shiki](https://shiki.style) (28 languages, github-dark theme)
- **AI:** Claude Agent SDK — multi-turn conversations via SSE streaming
- **Testing:** Vitest

## Architecture

Client + thin Bun server in one process. Bun serves Vite-built static files and manages lens sessions.

```
src/
├── server/          # Bun.serve, REST + SSE routes, lens sessions
├── client/
│   ├── editor/      # Milkdown setup, Shiki code blocks
│   ├── lenses/      # LoupeIcon, LensBubble, LensChat, LensLayer
│   ├── hooks/       # useLenses, useLensDrag, useFile, useZenMode
│   └── chrome/      # TopBar, LensPicker
└── shared/          # Types, lens presets
```

## License

MIT
