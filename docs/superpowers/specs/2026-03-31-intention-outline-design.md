# Intention Outline Panel Design

## Overview

A togglable left panel (Cmd+E) where the writer captures what they intend to convey. Free-form text editor at top, inline chat at bottom for refining the outline with the model. Stored as a sidecar file alongside the document. Lenses automatically receive the outline as context.

## Storage

Sidecar file: `essay.md` → `essay.outline.md`. Derived from the active file path by replacing the extension. If no sidecar exists, the panel starts empty and creates it on first save.

## Panel Layout

- **Header:** "Intention" label
- **Top:** Editable textarea — writer types intentions freely (plain text)
- **Bottom:** Chat input for refining with the model ("help me focus this", "what am I missing?")
- **Toggle:** Cmd+E shows/hides. Editor column shifts right when panel is open. State persisted to localStorage.

## Lens Integration

When the outline sidecar exists, `buildSystemPrompt` includes it after the document content:

```
The writer's stated intention for this piece:

[outline content]

Check if the writing aligns with this intention.
```

This is automatic — no per-lens changes needed. The `skipDocumentContext` lenses (like Lens Creator) skip this too.

## Server Endpoints

| Endpoint | Method | Behavior |
|---|---|---|
| `GET /api/outline` | GET | Read sidecar file for the active file. Returns `{ content }`. Returns `{ content: "" }` if no sidecar exists. |
| `POST /api/outline` | POST | Write `{ content }` to the sidecar file. Creates if needed. |
| `POST /api/outline/chat` | POST | SSE stream. Accepts `{ message }`. Model has the outline as context, helps refine it. Response can include updated outline text. |

Sidecar path derived from `FileStore.activePath`: replace `.md`/`.mdx` extension with `.outline.md`.

## Client Components

### `src/client/outline/OutlinePanel.tsx`

The panel component:
- Textarea for the outline text (auto-saves on debounce, 1s)
- Chat messages area (model responses)
- Chat input at the bottom
- Width: ~280px, fixed left side

### `src/client/hooks/use-outline.ts`

Hook managing:
- `content` — the outline text
- `load()` — fetch from `GET /api/outline`
- `save(content)` — debounced POST to `POST /api/outline`
- `chat(message)` — SSE stream from `POST /api/outline/chat`
- `messages` — chat history (client-side only, not persisted)
- `isOpen` — panel visibility, persisted to localStorage

### App.tsx Changes

- Cmd+E toggles `outline.isOpen`
- When open, layout shifts: outline panel on left, editor column adjusts
- Load outline when file changes (alongside document load)
- Add to keyboard shortcuts overlay

### lens-session.ts Changes

- `buildSystemPrompt` accepts optional `outlineContent` parameter
- If provided and not empty, appends after document content
- Routes pass outline content from a new outline store or by reading the sidecar

### Server Route Changes

- `routes.ts` — add three outline endpoints
- Outline chat uses a lightweight session (no multi-turn needed — each message is independent with the full outline as context)

## Edge Cases

- No active file → outline panel shows empty, saves disabled
- File switch → load new outline (or empty if none)
- Sidecar file doesn't exist → create on first save
- Outline empty → lenses skip the intention context (don't inject empty string)

## Out of Scope

- Structured outline (section-by-section) — free-form text only for v1
- Outline version history
- Multiple outline files per document
- Outline in frontmatter (sidecar approach chosen)
