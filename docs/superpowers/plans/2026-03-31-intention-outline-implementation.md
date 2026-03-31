# Intention Outline Panel Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a togglable left panel (Cmd+E) for capturing writer intentions, with inline chat for refinement, stored as a sidecar `.outline.md` file. Lenses receive the outline as context.

**Architecture:** Server adds outline read/write/chat endpoints using the active file path to derive the sidecar path. Client adds OutlinePanel component and use-outline hook. buildSystemPrompt includes outline content when available.

**Tech Stack:** Bun server, React 19, Vitest

**Spec:** `docs/superpowers/specs/2026-03-31-intention-outline-design.md`

---

## Chunk 1: Server — Outline Endpoints

### Task 1: Add outline read/write endpoints + sidecar path helper

**Files:**
- Modify: `src/server/routes.ts`
- Modify: `src/server/file-store.ts`
- Test: `tests/server/outline.test.ts`

The sidecar path is derived from the active file path: replace `.md`/`.mdx` with `.outline.md`.

Add to `FileStore`:
```typescript
get outlinePath(): string | null {
  if (!this.path) return null;
  return this.path.replace(/\.(mdx?)$/, ".outline.md");
}
```

Add routes:
- `GET /api/outline` — read sidecar, return `{ content }`, return `{ content: "" }` if no file
- `POST /api/outline` — write `{ content }` to sidecar, create if needed

### Task 2: Add outline chat endpoint

**Files:**
- Modify: `src/server/routes.ts`

`POST /api/outline/chat` — SSE stream. Accepts `{ message, outline }`. Uses a one-shot Agent SDK query (not multi-turn) with a system prompt that has the outline as context and instructions to help refine it.

### Task 3: Include outline in lens buildSystemPrompt

**Files:**
- Modify: `src/server/lens-session.ts`
- Modify: `src/server/routes.ts` (streamLensResponse reads outline)

Update `buildSystemPrompt` to accept optional `outlineContent`:
```typescript
buildSystemPrompt(documentContent: string, focusedParagraph?: string, outlineContent?: string): string {
```

If outlineContent is provided and non-empty, append after document:
```
The writer's stated intention for this piece:

[outlineContent]

Check if the writing aligns with this intention.
```

In `streamLensResponse`, read the outline sidecar from FileStore and pass it.

---

## Chunk 2: Client — Outline Panel + Hook

### Task 4: Create use-outline hook

**Files:**
- Create: `src/client/hooks/use-outline.ts`

```typescript
interface UseOutlineReturn {
  content: string;
  setContent: (content: string) => void;
  messages: ChatMessage[];
  isThinking: boolean;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  load: () => Promise<void>;
  chat: (message: string) => Promise<void>;
}
```

- `load()` — `GET /api/outline`, sets content
- `setContent()` — updates local state, debounces `POST /api/outline` (1s)
- `chat()` — SSE stream from `POST /api/outline/chat`, appends to messages
- `isOpen` — persisted to localStorage (`loupe-outline-open`)

### Task 5: Create OutlinePanel component

**Files:**
- Create: `src/client/outline/OutlinePanel.tsx`

Layout:
- Header: "Intention" label
- Textarea: editable, auto-grows, styled to match editor theme
- Chat messages area (scrollable)
- Chat input at bottom with ↵ hint
- Width: 280px

### Task 6: Wire into App.tsx

**Files:**
- Modify: `src/client/App.tsx`

- Import OutlinePanel, useOutline
- Add Cmd+E to keyboard shortcuts (toggle `outline.isOpen`)
- Load outline when file changes (alongside document load)
- Render OutlinePanel when open, adjust layout
- Add Cmd+E to shortcuts overlay

---

## Chunk 3: Styling + Verification

### Task 7: CSS + layout adjustments

**Files:**
- Modify: `src/client/index.css`

- Outline panel styles (background, text, chat)
- Layout: when outline is open, editor-surface uses flex with outline panel on left
- Transition for panel show/hide

### Task 8: Integration verification

- Full test suite
- Build
- Smoke test: Cmd+E toggles panel, type outline, chat works, lenses see outline
