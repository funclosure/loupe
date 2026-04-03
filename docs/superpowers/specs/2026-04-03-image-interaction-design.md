# Image Interaction: Fullscreen Lightbox + Edit Popup

**Date:** 2026-04-03  
**Status:** Approved

## Context

Images in the Loupe editor are currently rendered as plain `<img>` elements via Milkdown's default commonmark plugin with no interaction. Users need two capabilities:

1. **Tap to view fullscreen** — click an image to open a lightbox
2. **Edit image** — hover reveals a pencil button that opens a popup to edit the URL (src) and caption (alt)

## Architecture

### Custom ProseMirror NodeView

A custom NodeView is registered for Milkdown's `image` node type (via `$view`, matching the existing `codeBlockView` pattern in `milkdown-setup.ts`). It replaces the default `<img>` rendering with a wrapper structure:

```
div.image-wrapper (position: relative, display: inline-block)
├── img (cursor: zoom-in)
└── button.image-edit-btn (pencil icon, absolute top-right)
```

CSS controls visibility: `.image-edit-btn` is `opacity: 0` by default, `opacity: 1` on `.image-wrapper:hover`. The edit button uses `pointer-events: auto` so it can be clicked independently from the image.

**Click behavior:**
- Click `img` → calls `onImageClick(src, alt)`
- Click `.image-edit-btn` → calls `onImageEdit(src, alt, getPos)` where `getPos` is the NodeView's `getPos` function (not a resolved integer — called at save time to avoid stale positions if the document is edited while the popup is open)

**Event handling:**
- `stopEvent()` returns `true` for clicks targeting the edit button, so ProseMirror does not process those events (prevents cursor movement or node selection)
- `ignoreMutation()` returns `true` for all mutations inside the wrapper so hover state DOM changes don't trigger unnecessary ProseMirror reconciliation

The NodeView is registered via the `$view` factory in `milkdown-setup.ts`. The two callbacks are passed as parameters to `createEditor()` (the actual export name — not `milkdownSetup`).

**Callbacks must be stable references** — pass React `useState` setter functions directly, not derived closures that close over component state.

### State in Editor.tsx

```typescript
const [lightbox, setLightbox] = useState<{ src: string; alt: string } | null>(null);
const [editTarget, setEditTarget] = useState<{ src: string; alt: string; getPos: () => number } | null>(null);
```

These are passed as callbacks into `createEditor`:
- `onImageClick` → sets `lightbox`
- `onImageEdit` → sets `editTarget` (storing `getPos` function, not a resolved position)

The editor view ref (`editorViewRef`) must be accessible in `Editor.tsx` so the edit save handler can dispatch a ProseMirror transaction.

### ImageLightbox Component

**File:** `src/client/editor/ImageLightbox.tsx`

- Overlay: `fixed inset-0 z-[100] bg-black/90 flex items-center justify-center`
- Image: `max-w-[90vw] max-h-[90vh] object-contain`
- Caption: shown below image in `--loupe-text-secondary` if `alt` is non-empty
- Close: click backdrop or Escape key
- No edit controls inside lightbox — editing is editor-only

### ImageEditPopup Component

**File:** `src/client/editor/ImageEditPopup.tsx`

Modal matching the existing `ImageFolderDialog` pattern from `TopBar.tsx`:
- Background: `--loupe-elevated`, border: `--loupe-border-strong`, shadow: `0 16px 48px rgba(0,0,0,0.5)`
- Width: `w-[360px]`
- Two labeled fields: **URL** (src) and **Caption** (alt)
- Footer: **Cancel** (dismiss) + **Save** (apply changes)

**Save handler:**
```typescript
const pos = editTarget.getPos();
view.dispatch(view.state.tr.setNodeMarkup(pos, null, { src: newSrc, alt: newAlt }))
```

Calling `getPos()` at save time (not at popup-open time) avoids stale positions if the document is edited while the popup is open. This updates the image node attributes in-place, triggering Milkdown's change listener and propagating to the auto-save hook.

**Escape key:** The lightbox and edit popup both listen for `keydown` on `document` (not the overlay div, which won't receive keyboard events without `tabIndex`). Handlers are removed on unmount.

## Files Modified

| File | Change |
|------|--------|
| `src/client/editor/milkdown-setup.ts` | Add custom image NodeView, accept `onImageClick`/`onImageEdit` callbacks |
| `src/client/editor/Editor.tsx` | Add lightbox/editTarget state, pass callbacks to setup, expose view ref for edit save, render new components |
| `src/client/index.css` | Add `.image-wrapper` and `.image-edit-btn` styles |

## New Files

| File | Purpose |
|------|---------|
| `src/client/editor/ImageLightbox.tsx` | Fullscreen image overlay |
| `src/client/editor/ImageEditPopup.tsx` | Edit popup for src + alt |

## Verification

1. Open a markdown file with images in the editor
2. Hover an image — pencil button appears top-right
3. Click pencil → edit popup opens with current src and alt pre-filled; clicking the pencil does NOT move the cursor or select the image node
4. Edit URL or caption, click Save → image updates in editor; Milkdown change listener fires and auto-save triggers; re-open file to confirm persisted src/alt
5. Open edit popup, type text elsewhere in the document, then click Save — confirms stale-pos is not an issue
6. Click image body → lightbox opens, showing full image
7. Caption appears below if alt is set; no caption element shown if alt is empty
8. Click backdrop or press Escape → lightbox closes
9. Edit popup: Cancel closes without changes; Escape also dismisses
10. Test with a pre-existing markdown image using a relative path (e.g. `images/foo.png`) — note expected behavior (served via imagePrefix or broken image)
