# Lens UI Redesign — Loupe Bubble + Drag-to-Inspect

## Goal

Redesign the lens UI to embody the loupe metaphor physically: lenses are draggable magnifying tools you place over text to examine it. Replace the generic chat-bubble aesthetic with a warm, layered, glass-like design.

## What Changes

Three interconnected pieces:

1. **New loupe bubble** — filled, layered shape replacing the current outlined circle
2. **Drag-to-inspect** — drag a lens onto text to focus it on the nearest paragraph
3. **Chat card polish** — warm glass aesthetic, better hierarchy, click-outside-to-collapse

## 1. Loupe Bubble (Resting State)

The bubble is a filled circle with a rounded tail behind it, creating a magnifying-glass / speech-bubble hybrid. The tail always points left (toward the editor).

**Shape construction (two nested divs):**
- **Outer layer (tail):** A 44×44px div behind the circle. `border-radius: 50% 50% 50% 10px` (bottom-left corner is squared to form the tail pointing left). Filled with `{lensColor}15` (15% opacity). Offset: positioned so the squared corner extends ~6px left and ~6px above the circle center.
- **Inner layer (circle):** A 36×36px circle centered over the tail. `border-radius: 50%`. Filled with `{lensColor}0D` (~5% opacity) on a base of `rgba(0,0,0,0.15)` — creating a slightly darker glass look than the tail.
- **Letter:** The lens icon character (D, I, F, E, C) centered in the circle. Color: `{lensColor}99` (~60% opacity). `font-size: 15px; font-weight: 600`.

**Visual feel:** Concentric, warm, glass-like. The layers create depth without using borders or outlines. Think of it as a tinted lens sitting on a surface. No stroke/outline — the color difference between layers provides the edge.

**States:**
- **Idle with preview:** Bubble + text snippet below (current 120-char preview, rendered as markdown)
- **Idle without preview:** Bubble only, no preview text
- **Thinking:** Bubble pulses gently (current `loupe-pulse` animation), "thinking..." text below
- **Error:** Bubble + "Something went wrong" text, clickable to retry

**Interactions:**
- **Click:** Expands to chat card
- **Drag:** Initiates drag-to-inspect flow (see section 2)
- **Hover:** Shows lens name to the left, dismiss button (×) to the right. Dismiss button should be a proper sized target (24×24px minimum)

**Layout:** Bubbles remain in the right sidebar (`fixed right-4`), stacked vertically. Right-aligned with tail pointing toward editor.

## 2. Drag-to-Inspect

The core new interaction. Users drag a lens from the sidebar onto editor text to start a focused conversation.

### Flow

1. **Grab:** User mousedown/pointerdown on the bubble and starts dragging
2. **Drag:** A larger version of the loupe follows the cursor. The original bubble position shows a ghost/placeholder. The lens grows ~1.4× and gains a subtle glow in the lens color.
3. **Hover over text:** As the loupe passes over editor content, the nearest block-level element (paragraph, heading, list item, blockquote, code block) gets a highlight: a subtle left border + background tint in the lens color. The highlight snaps between blocks as the cursor moves — no in-between states.
4. **Drop:** On mouseup/pointerup over the editor:
   - The dragged loupe animates back to its sidebar position (snap-back)
   - The highlighted paragraph's text is sent to the lens via the existing `/api/lens/:id/focus` endpoint
   - The lens starts thinking and the bubble shows "thinking..." state
   - The editor paragraph keeps a faint left-border accent momentarily to show what was focused
5. **Cancel:** If dropped outside the editor, or if the user presses Escape, the drag cancels and the lens returns to its resting position. No focus action occurs.

### Technical approach

- Use pointer events (`pointerdown`, `pointermove`, `pointerup`) with `setPointerCapture()` on the bubble element during `pointerdown`. This ensures `pointerup` is always received even if the cursor leaves the browser window.
- During drag, render a floating clone of the bubble at the cursor position (CSS `position: fixed`, `z-index: 200` — above lens layer z-10 and modals z-50). Transformed to follow pointer coordinates.
- **ProseMirror event suppression:** While a lens drag is active, add a `dragover` and `drop` event listener on the editor DOM that calls `event.preventDefault()` to prevent ProseMirror's native drag-and-drop behavior. Also prevent text selection changes by adding `user-select: none` to the editor surface during drag.
- **Hit-testing:** Use `view.posAtCoords({ left: x, top: y })` which returns `{ pos, inside }`. Use the `inside` field (the position of the innermost node the coords fall in) and resolve with `view.state.doc.resolve(inside)` to find the enclosing block-level node. Walk up the resolved position's depth to find the first block node (paragraph, heading, list_item, blockquote, code_block).
- Extract the block node's `textContent` and the current document version for the `/api/lens/:id/focus` API call.
- **Snap-back animation:** The floating clone is a portal element (appended to `document.body`). On drop, capture the resting bubble's position via `getBoundingClientRect()`, then CSS-transition the clone's `transform` to that position over 200ms. On `transitionend`, remove the clone and update React state. This avoids conflicts with React re-renders during the animation.

### Edge cases

- **Lens is thinking:** Disable drag while lens is already processing (cursor: default, no pointerdown handler)
- **Drop on non-text areas** (toolbar, lens layer, outside editor): Treat as cancel — snap back without triggering focus
- **Multiple lenses:** Only one drag at a time. Other lenses remain in place.
- **Mobile/touch:** Drag-to-inspect is desktop-only for now. On touch devices, tapping the bubble opens the chat card. Focus can be triggered by typing in the chat input (e.g., "look at paragraph 2"). Touch drag support can be added later.
- **`posAtCoords` returns null:** If coordinates are outside the editable area, treat as hovering outside — no highlight shown, drop treated as cancel.

### Drag highlight styling

When hovering over a block during drag:
- Left border: `3px solid {lensColor}50` (50% opacity)
- Background: `{lensColor}08` (very subtle tint)
- `border-radius: 0 4px 4px 0` on the background
- Transition: highlight snaps between blocks (no fade, instant switch)

After drop, the focused block keeps a fading accent:
- Left border: `2px solid {lensColor}30` that fades out over 2 seconds via CSS transition

## 3. Chat Card (Expanded State)

Redesigned with Option B "Warm Glass" aesthetic.

### Layout

```
┌──────────────────────────────┐
│  [loupe-icon] Name         × │  ← header
│──────────────────────────────│
│                              │
│  Lens response text flows    │  ← messages area
│  freely, no background box.  │
│  This is the primary content.│
│                              │
│          [user message box]  │  ← user msgs: subtle bg, right-aligned
│                              │
│  thinking...                 │  ← streaming/thinking state
│                              │
│  ┌────────────────────── ↵┐  │  ← input field
│  │ Ask something...       │  │
│  └────────────────────────┘  │
└──────────────────────────────┘
```

### Styling

- **Background:** Semi-transparent dark (`rgba(30, 28, 26, 0.92)`) with `backdrop-filter: blur(20px)` for glass effect
- **Border:** Subtle warm border (`rgba(255, 245, 230, 0.06)`), `border-radius: 14px`
- **Shadow:** Deep warm shadow (`0 20px 60px rgba(0,0,0,0.45)`)

**Header:**
- Mini loupe icon (same shape as bubble, ~24px) with lens color
- Lens name in `--loupe-text-secondary` weight
- Close button: 26×26px, rounded, subtle background on hover. Collapses (does not dismiss)

**Messages:**
- Lens responses: No background box. Text color `#d4cec8` (warm, readable). 13px, line-height 1.8. Content is the main visual element.
- User messages: Right-aligned, subtle background (`rgba(255,245,230,0.035)`) + faint border. Text color `#8b8580` (clearly secondary). `border-radius: 12px`.
- Streaming content: Same styling as lens messages, renders as it arrives via react-markdown.

**Input:**
- Bordered container (`rgba(255,245,230,0.05)`), `border-radius: 10px`
- Placeholder: "Ask something..." in ghost color
- Enter hint (↵) at right edge in ghost color

**No action buttons in the visible UI.** The drag-to-inspect interaction replaces "Focus here." The "What now?" (rethink) and "Reset" actions are accessible via a small `···` overflow menu in the chat header (next to the close button). This keeps them available without cluttering the card. The overflow menu is a simple dropdown with two items. The architecture should allow lens-specific quick actions to be added to this menu later via the `LensDefinition` type.

### Behavior

- **Click outside:** Collapses the chat back to bubble state (does not dismiss the lens). The click also passes through to the editor (places cursor). Implementation: use a `mousedown` listener on `document` that checks if the target is outside the chat card.
- **Escape key:** Also collapses the expanded chat
- **Expanding one collapses others:** Only one chat card expanded at a time. Expanding a lens collapses any other expanded lens.
- **Max height:** `70vh` with scroll on messages area (current behavior, kept)

## 4. Interaction with Existing Focus Mechanisms

The codebase has two existing focus mechanisms that need to be reconciled:

- **`use-paragraph-focus.ts`** — auto-focuses a lens after 2 seconds of cursor dwell on a paragraph. **Keep this behavior.** It complements drag-to-inspect: dwell is passive/automatic, drag is intentional/explicit. They use the same `/api/lens/:id/focus` endpoint.
- **`App.tsx` focus wiring** — currently uses `window.getSelection()?.toString()` to get focused text. **Change this** to use ProseMirror's document model (same approach as drag hit-testing) for consistency. The dwell hook should resolve the cursor position to a block node and extract its text from the PM doc, not from DOM selection.

When drag-focus and dwell-focus conflict (e.g., user drags to paragraph A, then cursor dwells on paragraph B), the most recent action wins — this is already handled by the server's lens session which just processes whatever focus request comes in.

## 5. Files Affected

```
src/client/lenses/
├── LensBubble.tsx        # REWRITE — new loupe shape, drag source
├── LensChat.tsx          # MODIFY — warm glass styling, overflow menu, click-outside
├── LensLayer.tsx         # MODIFY — handle drag state, paragraph highlighting, single-expand
src/client/hooks/
├── use-lenses.ts         # MODIFY — single-expand logic, drag state tracking
├── use-lens-drag.ts      # CREATE — drag interaction hook (pointer events, hit testing, snap-back)
├── use-paragraph-focus.ts # MODIFY — switch from DOM selection to PM doc position
src/client/editor/
├── Editor.tsx            # MINOR — expose editorView ref for drag hit-testing
src/client/
├── App.tsx               # MODIFY — wire drag focus, update dwell-focus to use PM doc
├── index.css             # MODIFY — loupe bubble styles, chat card styles, drag highlight styles
src/shared/types.ts       # MINOR — optional: add quickActions to LensDefinition for future use
```

Styling approach: new component styles go in `index.css` as named classes (`.loupe-bubble`, `.loupe-chat`, etc.), consistent with the code block approach. Tailwind utilities used for layout/spacing within components.

## 6. What's NOT in Scope

- Pinning expanded cards (mentioned as future)
- Lens-specific quick actions (architecture allows it, not implementing now)
- Drag-to-select text ranges (nearest paragraph only)
- Lens-to-lens dialogue
- Streaming smoothness improvements (token-by-token fade-in can be a follow-up)
- Touch/mobile drag (desktop pointer events only for now)
- Keyboard alternative for drag-to-inspect (users can type focus requests in chat input)
