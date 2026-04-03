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
- **AI lenses** — 5 built-in perspectives + create your own through conversation
- **Lens Creator** — describe the lens you want, the AI builds it for you
- **Intention outline** — a left panel to capture what you're trying to convey; lenses check alignment
- **Drag-to-inspect** — drag a lens onto any paragraph to start a conversation
- **Syntax highlighting** — Shiki-powered code blocks with language selector, copy, wrap
- **Image paste & folder config** — paste images directly into the editor; auto-detect, browse, or manually set image folder
- **Image viewer** — tap any image to view fullscreen; hover to reveal edit button for URL and caption
- **Frontmatter handling** — YAML frontmatter hidden from editor, editable via bottom-right bar (`---` and `***` delimiters)
- **Server-side file I/O** — open, save, create, delete files through the server
- **App menu** — hamburger menu with Open in Finder, image folder settings
- **Zen mode** — Cmd+. fades all chrome, hover to reveal
- **Undo/redo** — full history with Cmd+Z / Cmd+Shift+Z
- **No API key needed** — authenticates through Claude Code session

## Quick Start

Requires [Bun](https://bun.sh) and [Claude Code](https://docs.anthropic.com/en/docs/claude-code).

```bash
bun install       # Install dependencies
bun link          # Register the CLI globally (once)
loupe             # Builds if needed, starts server, opens browser
```

## Creating Lenses

**Through the app:** Open the lens picker (Cmd+L), type a description at the bottom, and the Lens Creator will guide you through building it via conversation. Saved to `.loupe/lenses/`.

**Manually:** Drop a `LENS.md` file in `.loupe/lenses/` (or `lenses/` for legacy):

```
.loupe/lenses/my-lens/LENS.md
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

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd + L` | Open lens picker |
| `Cmd + Shift + E` | Toggle intention outline |
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
├── server/          # Bun.serve, REST + SSE routes, lens sessions, file I/O
├── client/
│   ├── editor/      # Milkdown setup, Shiki code blocks, image NodeView + lightbox
│   ├── lenses/      # LoupeIcon, LensBubble, LensChat, LensLayer, LensProposalCard
│   ├── outline/     # OutlinePanel — intention editor with inline chat
│   ├── hooks/       # useLenses, useLensDrag, useFile, useOutline, useZenMode
│   └── chrome/      # TopBar (app menu), LensPicker, FilePicker, FrontmatterBar
└── shared/          # Types, lens presets
```

## License

MIT
