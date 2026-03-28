# Lens UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign lens UI with loupe-shaped bubble, warm glass chat card, and drag-to-inspect interaction.

**Architecture:** Three layers — (1) new loupe bubble visual with CSS-only shape construction, (2) warm glass chat card with click-outside-to-collapse and overflow menu, (3) drag-to-inspect hook using pointer events and ProseMirror `posAtCoords()` for hit-testing. Each layer is independently committable.

**Tech Stack:** React 19, ProseMirror (via Milkdown), CSS (in index.css), pointer events API

**Spec:** `docs/superpowers/specs/2026-03-28-lens-ui-redesign.md`

---

## File Structure

```
src/client/lenses/
├── LensBubble.tsx          # REWRITE — loupe shape, drag source
├── LensChat.tsx            # MODIFY — warm glass, overflow menu, click-outside
├── LensLayer.tsx           # MODIFY — single-expand, drag highlight overlay
src/client/hooks/
├── use-lenses.ts           # MODIFY — single-expand logic
├── use-lens-drag.ts        # CREATE — pointer event drag + PM hit-testing
src/client/editor/
├── Editor.tsx              # MODIFY — expose editorView ref
src/client/
├── App.tsx                 # MODIFY — wire drag focus, pass editorRef to LensLayer
├── index.css               # MODIFY — loupe bubble, warm glass chat, drag highlight
```

---

### Task 1: Loupe Bubble CSS + Component

**Files:**
- Modify: `src/client/index.css`
- Rewrite: `src/client/lenses/LensBubble.tsx`

- [ ] **Step 1: Add loupe bubble CSS to index.css**

Add after the code block styles section:

```css
/* -- Loupe bubble ------------------------------------------- */
.loupe-bubble {
  position: relative;
  width: 44px;
  height: 44px;
  cursor: grab;
}

.loupe-bubble:active {
  cursor: grabbing;
}

/* Tail — behind circle, points left */
.loupe-bubble-tail {
  position: absolute;
  top: -2px;
  left: -8px;
  width: 44px;
  height: 44px;
  border-radius: 50% 50% 50% 10px;
  transform: rotate(0deg);
  pointer-events: none;
}

/* Circle — main body */
.loupe-bubble-circle {
  position: relative;
  z-index: 1;
  width: 40px;
  height: 40px;
  left: 2px;
  top: 0;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 15px;
  font-weight: 600;
  background: rgba(0, 0, 0, 0.15);
}

/* Thinking pulse on bubble */
.loupe-bubble.thinking .loupe-bubble-circle {
  animation: loupe-pulse 1.5s ease-in-out infinite;
}

.loupe-bubble.thinking .loupe-bubble-tail {
  animation: loupe-pulse 1.5s ease-in-out infinite;
}

/* Dismiss button — appears on hover */
.loupe-bubble-dismiss {
  position: absolute;
  top: -6px;
  right: -10px;
  z-index: 2;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: none;
  background: var(--loupe-surface);
  color: var(--loupe-text-tertiary);
  font-size: 12px;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.15s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.loupe-bubble-wrap:hover .loupe-bubble-dismiss {
  opacity: 0.6;
}

.loupe-bubble-dismiss:hover {
  opacity: 1 !important;
  background: var(--loupe-elevated);
}

/* Name label — appears on hover */
.loupe-bubble-name {
  font-size: 11px;
  color: var(--loupe-text-tertiary);
  opacity: 0;
  transition: opacity 0.15s;
  white-space: nowrap;
}

.loupe-bubble-wrap:hover .loupe-bubble-name {
  opacity: 0.6;
}

/* Preview snippet */
.loupe-bubble-preview {
  background: var(--loupe-surface);
  border-radius: 10px;
  padding: 8px 12px;
  max-width: 220px;
  font-size: 12px;
  line-height: 1.5;
  color: var(--loupe-text-secondary);
  cursor: pointer;
  transition: opacity 0.15s;
}

.loupe-bubble-preview:hover {
  opacity: 0.8;
}
```

- [ ] **Step 2: Rewrite LensBubble.tsx**

```tsx
// src/client/lenses/LensBubble.tsx
import Markdown from "react-markdown";
import type { LensDefinition, LensStatus } from "@shared/types";

interface LensBubbleProps {
  lensId: string;
  definition: LensDefinition;
  status: LensStatus;
  preview: string | null;
  onClick: () => void;
  onDismiss: () => void;
  onDragStart?: (e: React.PointerEvent) => void;
  isDragging?: boolean;
}

export function LensBubble({
  definition,
  status,
  preview,
  onClick,
  onDismiss,
  onDragStart,
  isDragging,
}: LensBubbleProps) {
  const color = definition.color;

  return (
    <div className="loupe-bubble-wrap flex flex-col items-end gap-2" style={{ opacity: isDragging ? 0.3 : 1 }}>
      {/* Avatar row */}
      <div className="flex items-center gap-2">
        <span className="loupe-bubble-name">{definition.name}</span>

        <div
          className={`loupe-bubble ${status === "thinking" ? "thinking" : ""}`}
          onClick={onClick}
          onPointerDown={(e) => {
            // Only start drag on primary button, after a small move threshold
            if (e.button !== 0) return;
            onDragStart?.(e);
          }}
        >
          <div
            className="loupe-bubble-tail"
            style={{ background: `${color}25` }}
          />
          <div
            className="loupe-bubble-circle"
            style={{
              background: `${color}15`,
              color: `${color}99`,
              boxShadow: status === "thinking" ? `0 0 20px ${color}20` : "none",
            }}
          >
            {definition.icon}
          </div>
        </div>

        <button
          className="loupe-bubble-dismiss"
          onClick={(e) => { e.stopPropagation(); onDismiss(); }}
        >
          &times;
        </button>
      </div>

      {/* Preview */}
      {preview && status === "idle" && (
        <button onClick={onClick} className="loupe-bubble-preview text-left">
          <Markdown className="lens-markdown" components={{
            p: ({ children }) => <span>{children} </span>,
            h1: ({ children }) => <span>{children} </span>,
            h2: ({ children }) => <span>{children} </span>,
            h3: ({ children }) => <span>{children} </span>,
            ul: ({ children }) => <span>{children}</span>,
            ol: ({ children }) => <span>{children}</span>,
            li: ({ children }) => <span>{children} </span>,
            blockquote: ({ children }) => <span>{children}</span>,
            pre: () => null,
            hr: () => null,
          }}>
            {preview.length > 120 ? preview.slice(0, 120) + "..." : preview}
          </Markdown>
        </button>
      )}

      {/* Thinking */}
      {status === "thinking" && (
        <div
          className="text-[11px] uppercase tracking-[0.1em]"
          style={{
            color: color,
            opacity: 0.7,
            animation: "loupe-pulse 1.5s ease-in-out infinite",
          }}
        >
          thinking...
        </div>
      )}

      {/* Error */}
      {status === "error" && (
        <button
          onClick={onClick}
          className="text-left rounded-lg px-3 py-2 text-[12px] cursor-pointer"
          style={{
            background: "rgba(220, 38, 38, 0.06)",
            color: "var(--loupe-text-secondary)",
          }}
        >
          Something went wrong — click to retry
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Build and verify**

```bash
bun run build
```

Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add src/client/lenses/LensBubble.tsx src/client/index.css
git commit -m "feat: new loupe-shaped bubble with layered fill design"
```

---

### Task 2: Chat Card Warm Glass Styling

**Files:**
- Modify: `src/client/lenses/LensChat.tsx`
- Modify: `src/client/index.css`

- [ ] **Step 1: Add warm glass chat CSS to index.css**

```css
/* -- Lens chat — warm glass --------------------------------- */
.loupe-chat {
  background: rgba(30, 28, 26, 0.92);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 245, 230, 0.06);
  border-radius: 14px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.45);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  max-height: 70vh;
}

.loupe-chat-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
}

.loupe-chat-separator {
  height: 1px;
  background: rgba(255, 245, 230, 0.04);
  margin: 0 14px;
}

.loupe-chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 14px;
}

/* Lens message — no background, primary text */
.loupe-chat-lens-msg {
  font-size: 13px;
  line-height: 1.8;
  color: #d4cec8;
  letter-spacing: 0.005em;
  margin-bottom: 16px;
}

.loupe-chat-lens-msg:last-child {
  margin-bottom: 0;
}

/* User message — subtle bg, secondary */
.loupe-chat-user-msg {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 16px;
}

.loupe-chat-user-msg > div {
  background: rgba(255, 245, 230, 0.035);
  border: 1px solid rgba(255, 245, 230, 0.04);
  border-radius: 12px;
  padding: 8px 12px;
  font-size: 12.5px;
  line-height: 1.6;
  color: #8b8580;
  max-width: 85%;
}

/* Input area */
.loupe-chat-input-wrap {
  padding: 8px 14px 12px;
}

.loupe-chat-input {
  display: flex;
  align-items: center;
  border: 1px solid rgba(255, 245, 230, 0.05);
  border-radius: 10px;
  padding: 0 12px;
  transition: border-color 0.15s;
}

.loupe-chat-input:focus-within {
  border-color: rgba(255, 245, 230, 0.12);
}

.loupe-chat-input input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  font-size: 13px;
  color: var(--loupe-text);
  padding: 9px 0;
}

.loupe-chat-input input::placeholder {
  color: rgba(255, 245, 230, 0.15);
}

/* Close button */
.loupe-chat-close {
  width: 26px;
  height: 26px;
  border-radius: 7px;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 245, 230, 0.04);
  color: var(--loupe-text-tertiary);
  font-size: 15px;
  cursor: pointer;
  transition: background 0.15s;
}

.loupe-chat-close:hover {
  background: rgba(255, 245, 230, 0.08);
  color: var(--loupe-text-secondary);
}

/* Overflow menu (···) */
.loupe-chat-overflow-btn {
  width: 26px;
  height: 26px;
  border-radius: 7px;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  color: var(--loupe-text-tertiary);
  font-size: 16px;
  cursor: pointer;
  letter-spacing: 1px;
  transition: background 0.15s;
}

.loupe-chat-overflow-btn:hover {
  background: rgba(255, 245, 230, 0.06);
}

.loupe-chat-overflow-menu {
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 4px;
  background: var(--loupe-elevated);
  border: 1px solid var(--loupe-border-strong);
  border-radius: 8px;
  padding: 4px 0;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
  z-index: 50;
  min-width: 140px;
}

.loupe-chat-overflow-item {
  display: block;
  width: 100%;
  padding: 6px 12px;
  text-align: left;
  border: none;
  background: none;
  color: var(--loupe-text-secondary);
  font-size: 12px;
  cursor: pointer;
  font-family: system-ui, -apple-system, sans-serif;
  transition: background 0.1s;
}

.loupe-chat-overflow-item:hover {
  background: rgba(255, 245, 230, 0.06);
}

.loupe-chat-overflow-item.danger {
  color: #b85c5c;
}
```

- [ ] **Step 2: Rewrite LensChat.tsx**

```tsx
// src/client/lenses/LensChat.tsx
import { useState, useRef, useEffect, useCallback } from "react";
import Markdown from "react-markdown";
import type { LensDefinition, ChatMessage } from "@shared/types";

interface LensChatProps {
  lensId: string;
  definition: LensDefinition;
  messages: ChatMessage[];
  streamingContent: string;
  isThinking: boolean;
  onAsk: (message: string) => void;
  onRethink: () => void;
  onReset: () => void;
  onClose: () => void;
}

export function LensChat({
  definition,
  messages,
  streamingContent,
  isThinking,
  onAsk,
  onRethink,
  onReset,
  onClose,
}: LensChatProps) {
  const [input, setInput] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Auto-scroll on new content
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streamingContent]);

  // Click outside to collapse
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    // Defer to avoid closing on the click that opened it
    const timer = setTimeout(() => {
      document.addEventListener("mousedown", handler);
    }, 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handler);
    };
  }, [onClose]);

  // Escape key to collapse
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (menuOpen) setMenuOpen(false);
        else onClose();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose, menuOpen]);

  // Close overflow menu on click outside
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isThinking) return;
    onAsk(input.trim());
    setInput("");
  }, [input, isThinking, onAsk]);

  const color = definition.color;

  return (
    <div ref={cardRef} className="loupe-chat w-full">
      {/* Header */}
      <div className="loupe-chat-header">
        <div className="flex items-center gap-2.5">
          {/* Mini loupe icon */}
          <div className="relative" style={{ width: 24, height: 24 }}>
            <div
              className="absolute"
              style={{
                top: -1, left: -4,
                width: 24, height: 24,
                borderRadius: "50% 50% 50% 6px",
                background: `${color}20`,
              }}
            />
            <div
              className="relative z-10 flex items-center justify-center"
              style={{
                width: 22, height: 22,
                left: 1,
                borderRadius: "50%",
                background: `${color}12`,
                color: `${color}80`,
                fontSize: 10, fontWeight: 600,
              }}
            >
              {definition.icon}
            </div>
          </div>
          <span className="text-[12.5px] font-medium" style={{ color: "var(--loupe-text-secondary)" }}>
            {definition.name}
          </span>
        </div>

        <div className="flex items-center gap-1 relative">
          {/* Overflow menu */}
          <button
            className="loupe-chat-overflow-btn"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            ···
          </button>
          {menuOpen && (
            <div ref={menuRef} className="loupe-chat-overflow-menu">
              <button
                className="loupe-chat-overflow-item"
                onClick={() => { onRethink(); setMenuOpen(false); }}
              >
                Rethink
              </button>
              <button
                className="loupe-chat-overflow-item danger"
                onClick={() => { onReset(); setMenuOpen(false); }}
              >
                Reset conversation
              </button>
            </div>
          )}

          {/* Close */}
          <button className="loupe-chat-close" onClick={onClose}>
            &times;
          </button>
        </div>
      </div>

      <div className="loupe-chat-separator" />

      {/* Messages */}
      <div ref={scrollRef} className="loupe-chat-messages">
        {messages.map((msg, i) => (
          msg.role === "user" ? (
            <div key={i} className="loupe-chat-user-msg">
              <div>{msg.content}</div>
            </div>
          ) : (
            <div key={i} className="loupe-chat-lens-msg">
              <Markdown className="lens-markdown">{msg.content}</Markdown>
            </div>
          )
        ))}

        {streamingContent && (
          <div className="loupe-chat-lens-msg">
            <Markdown className="lens-markdown">{streamingContent}</Markdown>
          </div>
        )}

        {isThinking && !streamingContent && (
          <div
            className="text-[11px] uppercase tracking-[0.1em] py-1"
            style={{
              color: color,
              opacity: 0.7,
              animation: "loupe-pulse 1.5s ease-in-out infinite",
            }}
          >
            thinking...
          </div>
        )}
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="loupe-chat-input-wrap">
        <div className="loupe-chat-input" style={{ caretColor: color }}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask something..."
            disabled={isThinking}
          />
          <span className="text-[11px]" style={{ color: "var(--loupe-text-ghost)" }}>↵</span>
        </div>
      </form>
    </div>
  );
}
```

- [ ] **Step 3: Build and verify**

```bash
bun run build
```

- [ ] **Step 4: Commit**

```bash
git add src/client/lenses/LensChat.tsx src/client/index.css
git commit -m "feat: warm glass chat card with overflow menu and click-outside-to-collapse"
```

---

### Task 3: Single-Expand + LensLayer Wiring

**Files:**
- Modify: `src/client/hooks/use-lenses.ts`
- Modify: `src/client/lenses/LensLayer.tsx`
- Modify: `src/client/App.tsx`

- [ ] **Step 1: Update toggleExpanded to collapse others (use-lenses.ts)**

Replace the current `toggleExpanded` callback:

```typescript
const toggleExpanded = useCallback((lensId: string) => {
  setLenses((prev) => {
    const next = new Map(prev);
    const lens = next.get(lensId);
    if (!lens) return next;
    const willExpand = !lens.expanded;
    // Collapse all others when expanding one
    if (willExpand) {
      for (const [id, l] of next) {
        if (id !== lensId && l.expanded) l.expanded = false;
      }
    }
    lens.expanded = willExpand;
    return next;
  });
}, []);
```

- [ ] **Step 2: Update LensLayer props — remove onFocus (replaced by drag)**

In `LensLayer.tsx`, remove `onFocus` from the interface and from the `LensChat` rendering. The `LensChat` no longer has a `onFocus` prop. Keep `onRethink` and `onReset` — these flow through the overflow menu.

Also add the `onDragStart` prop passthrough to `LensBubble`:

```tsx
// src/client/lenses/LensLayer.tsx
import type { LensDefinition } from "@shared/types";
import { LensBubble } from "./LensBubble";
import { LensChat } from "./LensChat";

interface LensState {
  lensId: string;
  definitionId: string;
  status: "idle" | "thinking" | "error";
  preview: string | null;
  messages: { role: "user" | "lens"; content: string }[];
  streamingContent: string;
  expanded: boolean;
}

interface LensLayerProps {
  lenses: Map<string, LensState>;
  definitions: LensDefinition[];
  onToggleExpanded: (lensId: string) => void;
  onDismiss: (lensId: string) => void;
  onAsk: (lensId: string, message: string) => void;
  onRethink: (lensId: string) => void;
  onReset: (lensId: string) => void;
  onBubbleDragStart?: (lensId: string, e: React.PointerEvent) => void;
  draggingLensId?: string | null;
}

export function LensLayer({
  lenses,
  definitions,
  onToggleExpanded,
  onDismiss,
  onAsk,
  onRethink,
  onReset,
  onBubbleDragStart,
  draggingLensId,
}: LensLayerProps) {
  const entries = Array.from(lenses.entries());
  if (entries.length === 0) return null;

  return (
    <div className="fixed right-4 top-14 bottom-4 w-[320px] max-w-[35vw] flex flex-col gap-4 pointer-events-none z-10 overflow-y-auto overflow-x-hidden">
      {entries.map(([lensId, state]) => {
        const def = definitions.find((d) => d.id === state.definitionId);
        if (!def) return null;

        return (
          <div key={lensId} className="pointer-events-auto">
            {state.expanded ? (
              <LensChat
                lensId={lensId}
                definition={def}
                messages={state.messages}
                streamingContent={state.streamingContent}
                isThinking={state.status === "thinking"}
                onAsk={(msg) => onAsk(lensId, msg)}
                onRethink={() => onRethink(lensId)}
                onReset={() => onReset(lensId)}
                onClose={() => onToggleExpanded(lensId)}
              />
            ) : (
              <LensBubble
                lensId={lensId}
                definition={def}
                status={state.status}
                preview={state.preview}
                onClick={() => onToggleExpanded(lensId)}
                onDismiss={() => onDismiss(lensId)}
                onDragStart={(e) => onBubbleDragStart?.(lensId, e)}
                isDragging={draggingLensId === lensId}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 3: Update App.tsx — remove onFocus from LensLayer**

In `App.tsx`, remove the `onFocus` prop from the `<LensLayer>` component (lines 145-148). Keep `onRethink` and `onReset`. Add a placeholder `onBubbleDragStart` that we'll wire up in Task 5.

```tsx
<LensLayer
  lenses={lens.lenses}
  definitions={lens.available}
  onToggleExpanded={lens.toggleExpanded}
  onDismiss={lens.deactivate}
  onAsk={lens.ask}
  onRethink={lens.rethink}
  onReset={lens.resetLens}
/>
```

- [ ] **Step 4: Build and verify**

```bash
bun run build
```

- [ ] **Step 5: Run all tests**

```bash
bunx vitest run
```

Expected: All 26 tests pass

- [ ] **Step 6: Commit**

```bash
git add src/client/hooks/use-lenses.ts src/client/lenses/LensLayer.tsx src/client/lenses/LensChat.tsx src/client/App.tsx
git commit -m "feat: single-expand behavior, remove Focus action, wire overflow menu"
```

---

### Task 4: Drag-to-Inspect Hook

**Files:**
- Create: `src/client/hooks/use-lens-drag.ts`
- Modify: `src/client/editor/Editor.tsx`

- [ ] **Step 1: Expose editorView ref from Editor.tsx**

The current `Editor.tsx` exposes `editorRef` which gives a `MilkdownInstance`. The drag hook needs the ProseMirror `EditorView` for `posAtCoords()`. The `MilkdownInstance` already has `getEditorView()`, so no change is actually needed — we'll call `editorRef.current?.getEditorView()` in the drag hook. However, we need to pass this ref to the drag hook from App.tsx.

No code change to Editor.tsx needed.

- [ ] **Step 2: Create use-lens-drag.ts**

```typescript
// src/client/hooks/use-lens-drag.ts
import { useState, useCallback, useRef } from "react";
import type { MilkdownInstance } from "../editor/milkdown-setup";
import type { LensDefinition } from "@shared/types";

interface DragState {
  lensId: string;
  definition: LensDefinition;
  x: number;
  y: number;
}

interface HighlightState {
  /** DOM element of the highlighted block */
  element: HTMLElement;
  /** Text content of the block */
  text: string;
  /** Lens color for the highlight */
  color: string;
}

interface UseLensDragOptions {
  editorRef: React.RefObject<MilkdownInstance | null>;
  definitions: LensDefinition[];
  lenses: Map<string, { definitionId: string; status: string }>;
  onFocus: (lensId: string, text: string, version: number) => void;
  versionRef: React.RefObject<number>;
}

export function useLensDrag({
  editorRef,
  definitions,
  lenses,
  onFocus,
  versionRef,
}: UseLensDragOptions) {
  const [drag, setDrag] = useState<DragState | null>(null);
  const [highlight, setHighlight] = useState<HighlightState | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const highlightRef = useRef<HighlightState | null>(null);
  const startPosRef = useRef<{ x: number; y: number } | null>(null);
  const isDraggingRef = useRef(false);

  /**
   * Resolve screen coordinates to the nearest block-level element and its text.
   */
  const resolveBlock = useCallback((x: number, y: number): { element: HTMLElement; text: string } | null => {
    const view = editorRef.current?.getEditorView();
    if (!view) return null;

    const posInfo = view.posAtCoords({ left: x, top: y });
    if (!posInfo) return null;

    // Use `inside` (the innermost node position) to find the block
    const pos = posInfo.inside >= 0 ? posInfo.inside : posInfo.pos;
    const resolved = view.state.doc.resolve(pos);

    // Walk up depth to find block-level node
    for (let depth = resolved.depth; depth >= 1; depth--) {
      const node = resolved.node(depth);
      if (node.isBlock) {
        // Use `before(depth)` — the node position, not the content position
        const nodePos = resolved.before(depth);
        const dom = view.nodeDOM(nodePos);
        if (dom instanceof HTMLElement) {
          return { element: dom, text: node.textContent };
        }
      }
    }
    return null;
  }, [editorRef]);

  const handleDragStart = useCallback((lensId: string, e: React.PointerEvent) => {
    const lensState = lenses.get(lensId);
    if (!lensState || lensState.status === "thinking") return;

    const def = definitions.find((d) => d.id === lensState.definitionId);
    if (!def) return;

    startPosRef.current = { x: e.clientX, y: e.clientY };

    // Suppress ProseMirror native drag-and-drop during lens drag
    const editorDom = editorRef.current?.getEditorView()?.dom;
    const suppressDrag = (ev: Event) => ev.preventDefault();

    const onMove = (me: PointerEvent) => {
      const start = startPosRef.current;
      if (!start) return;

      // Require 5px movement before starting drag (distinguishes click from drag)
      if (!isDraggingRef.current) {
        const dx = me.clientX - start.x;
        const dy = me.clientY - start.y;
        if (Math.sqrt(dx * dx + dy * dy) < 5) return;
        isDraggingRef.current = true;
        // Suppress text selection and ProseMirror DnD during drag
        document.body.style.userSelect = "none";
        if (editorDom) {
          editorDom.addEventListener("dragover", suppressDrag);
          editorDom.addEventListener("drop", suppressDrag);
        }
      }

      const state: DragState = { lensId, definition: def, x: me.clientX, y: me.clientY };
      dragRef.current = state;
      setDrag(state);

      // Hit-test for block highlight
      const block = resolveBlock(me.clientX, me.clientY);
      if (block && block.text.trim().length >= 10) {
        if (highlightRef.current?.element !== block.element) {
          // Clear old highlight
          if (highlightRef.current) {
            highlightRef.current.element.style.borderLeft = "";
            highlightRef.current.element.style.background = "";
          }
          // Apply new highlight
          block.element.style.borderLeft = `3px solid ${def.color}80`;
          block.element.style.background = `${def.color}08`;
          const hl: HighlightState = { ...block, color: def.color };
          highlightRef.current = hl;
          setHighlight(hl);
        }
      } else {
        // Clear highlight when not over valid block
        if (highlightRef.current) {
          highlightRef.current.element.style.borderLeft = "";
          highlightRef.current.element.style.background = "";
          highlightRef.current = null;
          setHighlight(null);
        }
      }
    };

    const onUp = () => {
      document.body.style.userSelect = "";
      if (editorDom) {
        editorDom.removeEventListener("dragover", suppressDrag);
        editorDom.removeEventListener("drop", suppressDrag);
      }
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);

      const wasDragging = isDraggingRef.current;
      isDraggingRef.current = false;
      startPosRef.current = null;

      // Clear highlight styling
      if (highlightRef.current) {
        const el = highlightRef.current.element;
        const text = highlightRef.current.text;
        el.style.borderLeft = "";
        el.style.background = "";

        // If we were dragging and have a valid target, trigger focus
        if (wasDragging && text.trim().length >= 10) {
          // Leave a fading accent
          el.style.borderLeft = `2px solid ${def.color}40`;
          el.style.transition = "border-left-color 2s";
          setTimeout(() => {
            el.style.borderLeft = "";
            el.style.transition = "";
          }, 2000);

          onFocus(lensId, text, versionRef.current);
        }

        highlightRef.current = null;
        setHighlight(null);
      }

      dragRef.current = null;
      setDrag(null);
    };

    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
  }, [lenses, definitions, resolveBlock, onFocus, versionRef]);

  return { drag, highlight, handleDragStart };
}
```

- [ ] **Step 3: Build and verify**

```bash
bun run build
```

- [ ] **Step 4: Commit**

```bash
git add src/client/hooks/use-lens-drag.ts
git commit -m "feat: drag-to-inspect hook with ProseMirror hit-testing"
```

---

### Task 5: Wire Drag into App + Floating Loupe

**Files:**
- Modify: `src/client/App.tsx`
- Modify: `src/client/lenses/LensLayer.tsx`
- Modify: `src/client/index.css`

- [ ] **Step 1: Add drag overlay CSS**

```css
/* -- Drag overlay — floating loupe follows cursor ----------- */
.loupe-drag-overlay {
  position: fixed;
  z-index: 200;
  pointer-events: none;
  transform: translate(-50%, -50%);
  transition: opacity 0.15s;
}
```

- [ ] **Step 2: Wire drag hook in App.tsx**

Add import and hook usage in `App.tsx`. The drag hook needs `editorRef`, `definitions`, `lenses`, `onFocus`, and `versionRef`.

After the existing `const lens = useLenses();` line, add:

```typescript
import { useLensDrag } from "./hooks/use-lens-drag";

// Inside App():
const { drag, handleDragStart } = useLensDrag({
  editorRef,
  definitions: lens.available,
  lenses: lens.lenses,
  onFocus: (lensId, text, version) => lens.focus(lensId, text, version),
  versionRef,
});
```

Pass `handleDragStart` to `LensLayer`:

```tsx
<LensLayer
  lenses={lens.lenses}
  definitions={lens.available}
  onToggleExpanded={lens.toggleExpanded}
  onDismiss={lens.deactivate}
  onAsk={lens.ask}
  onRethink={lens.rethink}
  onReset={lens.resetLens}
  onBubbleDragStart={handleDragStart}
  draggingLensId={drag?.lensId ?? null}
/>
```

Add the floating loupe overlay at the end of the JSX (before the closing `</div>`):

```tsx
{/* Floating loupe during drag */}
{drag && (
  <div
    className="loupe-drag-overlay"
    style={{ left: drag.x, top: drag.y }}
  >
    <div className="loupe-bubble" style={{ transform: "scale(1.4)" }}>
      <div
        className="loupe-bubble-tail"
        style={{ background: `${drag.definition.color}30` }}
      />
      <div
        className="loupe-bubble-circle"
        style={{
          background: `${drag.definition.color}20`,
          color: `${drag.definition.color}99`,
          boxShadow: `0 0 30px ${drag.definition.color}25`,
        }}
      >
        {drag.definition.icon}
      </div>
    </div>
  </div>
)}
```

- [ ] **Step 3: Build and verify**

```bash
bun run build
```

- [ ] **Step 4: Run all tests**

```bash
bunx vitest run
```

Expected: All 26 tests pass

- [ ] **Step 5: Commit**

```bash
git add src/client/App.tsx src/client/lenses/LensLayer.tsx src/client/index.css
git commit -m "feat: wire drag-to-inspect with floating loupe overlay"
```

---

### Task 6: Integration Test in Browser

**Files:** None (manual testing)

- [ ] **Step 1: Build and start**

```bash
bun run build && bun run start
```

Open `http://localhost:4460`

- [ ] **Step 2: Test new loupe bubble**

Activate a lens (Cmd+L, pick one). Verify:
- Loupe shape: filled circle with tail pointing left
- Hover shows name + dismiss button
- Click expands to chat card
- Dismiss button removes the lens

- [ ] **Step 3: Test warm glass chat card**

Click a bubble to expand. Verify:
- Semi-transparent glass background
- Mini loupe icon in header
- Overflow menu (···) shows Rethink and Reset
- Close button collapses (doesn't dismiss)
- Click outside the card collapses it
- Escape collapses it
- Expanding one lens collapses any other expanded lens

- [ ] **Step 4: Test drag-to-inspect**

Write some paragraphs in the editor. Then:
- Pointer down on a lens bubble and drag toward text
- After ~5px movement, the floating loupe should appear at cursor (1.4× scale)
- Hovering over a paragraph should highlight it (left border + tint)
- Dropping on a paragraph: loupe snaps away, lens starts thinking about that paragraph
- Dropping outside the editor: drag cancels, no action
- Quick click (no drag): should still open chat card

- [ ] **Step 5: Run all tests**

```bash
bunx vitest run
```

Expected: All 26 tests pass

- [ ] **Step 6: Commit any fixes**

```bash
git add -A && git commit -m "fix: lens UI polish from integration testing"
```
