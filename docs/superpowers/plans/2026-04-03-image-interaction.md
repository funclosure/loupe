# Image Interaction Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add tap-to-fullscreen and hover-to-edit interactions to images in the Milkdown editor.

**Architecture:** A custom ProseMirror NodeView (`ImageNodeView`) wraps each image in a `div.image-wrapper` with a hoverable pencil edit button. Clicking the image fires a React state setter that opens a fullscreen `ImageLightbox`; clicking the pencil fires a setter that opens an `ImageEditPopup` where src and alt can be edited and dispatched back via `setNodeMarkup`.

**Tech Stack:** Milkdown `$view` plugin, ProseMirror NodeView, React 19 useState, Tailwind CSS, TypeScript

---

## Chunk 1: NodeView + CSS

### Task 1: Add image-wrapper CSS to index.css

**Files:**
- Modify: `src/client/index.css`

- [ ] **Step 1: Add styles after existing image rules**

Find the existing `img` rules in `src/client/index.css` (around the `.ProseMirror img` block) and add after them:

```css
/* Image interaction wrapper */
.image-wrapper {
  position: relative;
  display: inline-block;
  cursor: zoom-in;
  border-radius: 4px;
}

.image-wrapper img {
  display: block;
  cursor: zoom-in;
}

.image-edit-btn {
  position: absolute;
  top: 8px;
  right: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  border: none;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.15s ease;
  background: rgba(0, 0, 0, 0.6);
  color: rgba(255, 255, 255, 0.9);
  pointer-events: auto;
}

.image-wrapper:hover .image-edit-btn {
  opacity: 1;
}

.image-edit-btn:hover {
  background: rgba(0, 0, 0, 0.8);
}
```

- [ ] **Step 2: Verify by running the dev server**

Run: `bun run start` (or check that Vite picks up the change via `bun run dev`)  
Expected: No CSS errors in console.

- [ ] **Step 3: Commit**

```bash
git add src/client/index.css
git commit -m "feat: add image-wrapper and image-edit-btn styles"
```

---

### Task 2: Create ImageNodeView

**Files:**
- Create: `src/client/editor/image-view.ts`

This mirrors the pattern in `src/client/editor/code-block-view.ts` exactly.

- [ ] **Step 1: Create the file**

```typescript
import { $view } from "@milkdown/kit/utils";
import { imageSchema } from "@milkdown/kit/preset/commonmark";
import type { EditorView } from "@milkdown/kit/prose/view";
import type { Node } from "@milkdown/kit/prose/model";

const PENCIL_ICON = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;

class ImageNodeView {
  dom: HTMLElement;
  private img: HTMLImageElement;
  private editBtn: HTMLButtonElement;
  private node: Node;
  private view: EditorView;
  private getPos: () => number | undefined;
  private onImageClick: (src: string, alt: string) => void;
  private onImageEdit: (src: string, alt: string, getPos: () => number | undefined) => void;

  constructor(
    node: Node,
    view: EditorView,
    getPos: () => number | undefined,
    onImageClick: (src: string, alt: string) => void,
    onImageEdit: (src: string, alt: string, getPos: () => number | undefined) => void,
  ) {
    this.node = node;
    this.view = view;
    this.getPos = getPos;
    this.onImageClick = onImageClick;
    this.onImageEdit = onImageEdit;

    // Wrapper (leaf node — no contentDOM, no contentEditable needed)
    this.dom = document.createElement("div");
    this.dom.className = "image-wrapper";

    // Image
    this.img = document.createElement("img");
    this.img.src = node.attrs.src ?? "";
    this.img.alt = node.attrs.alt ?? "";
    this.img.title = node.attrs.title ?? "";
    this.img.addEventListener("click", (e) => {
      e.stopPropagation();
      this.onImageClick(this.node.attrs.src ?? "", this.node.attrs.alt ?? "");
    });
    this.dom.appendChild(this.img);

    // Edit button
    this.editBtn = document.createElement("button");
    this.editBtn.className = "image-edit-btn";
    this.editBtn.type = "button";
    this.editBtn.title = "Edit image";
    this.editBtn.innerHTML = PENCIL_ICON;
    this.editBtn.addEventListener("mousedown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.onImageEdit(this.node.attrs.src ?? "", this.node.attrs.alt ?? "", this.getPos);
    });
    this.dom.appendChild(this.editBtn);
  }

  update(node: Node): boolean {
    if (node.type !== this.node.type) return false;
    this.node = node;
    this.img.src = node.attrs.src ?? "";
    this.img.alt = node.attrs.alt ?? "";
    this.img.title = node.attrs.title ?? "";
    return true;
  }

  stopEvent(event: Event): boolean {
    const target = event.target as HTMLElement;
    return this.editBtn.contains(target);
  }

  ignoreMutation(
    _mutation: MutationRecord | { type: "selection"; target: Element }
  ): boolean {
    return true;
  }

  destroy(): void {
    // nothing to clean up
  }
}

export function createImageView(
  onImageClick: (src: string, alt: string) => void,
  onImageEdit: (src: string, alt: string, getPos: () => number | undefined) => void,
) {
  return $view(imageSchema.node, () => {
    return (node: Node, view: EditorView, getPos: () => number | undefined) =>
      new ImageNodeView(node, view, getPos, onImageClick, onImageEdit);
  });
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `bunx tsc --noEmit`  
Expected: No errors from image-view.ts.

- [ ] **Step 3: Commit**

```bash
git add src/client/editor/image-view.ts
git commit -m "feat: add ImageNodeView for image click and edit"
```

---

### Task 3: Register imageView in milkdown-setup.ts

**Files:**
- Modify: `src/client/editor/milkdown-setup.ts`

- [ ] **Step 1: Add import and update createEditor signature**

Add import at the top (after existing imports):
```typescript
import { createImageView } from "./image-view";
```

Update `createEditor` signature to accept optional callbacks:
```typescript
export async function createEditor(
  root: HTMLElement,
  defaultValue: string,
  onChange: (markdown: string) => void,
  onImageClick?: (src: string, alt: string) => void,
  onImageEdit?: (src: string, alt: string, getPos: () => number | undefined) => void,
): Promise<MilkdownInstance>
```

- [ ] **Step 2: Register the imageView plugin**

Inside `Editor.make()`, after `.use(codeBlockView)`, add:

```typescript
    .use(
      onImageClick && onImageEdit
        ? createImageView(onImageClick, onImageEdit)
        : createImageView(() => {}, () => {})
    )
```

Full chain becomes:
```typescript
  const editor = await Editor.make()
    .config((ctx) => { ... })
    .use(commonmark)
    .use(listener)
    .use(trailing)
    .use(clipboard)
    .use(history)
    .use(codeBlockView)
    .use(createImageView(onImageClick ?? (() => {}), onImageEdit ?? (() => {})))
    .create();
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `bunx tsc --noEmit`  
Expected: No errors.

- [ ] **Step 4: Smoke test in browser**

Run: `bun run start`, open a file with an image, hover the image — pencil button should appear. Click the image — nothing happens yet (callbacks not wired). No console errors.

- [ ] **Step 5: Commit**

```bash
git add src/client/editor/milkdown-setup.ts
git commit -m "feat: register image NodeView in milkdown editor"
```

---

## Chunk 2: React Components + Editor Wiring

### Task 4: Create ImageLightbox component

**Files:**
- Create: `src/client/editor/ImageLightbox.tsx`

- [ ] **Step 1: Create the file**

```typescript
import { useEffect } from "react";

interface Props {
  src: string;
  alt: string;
  onClose: () => void;
}

export function ImageLightbox({ src, alt, onClose }: Props) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation(); // Prevent App.tsx global Escape handler from also firing
        onClose();
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center"
      style={{ background: "rgba(0,0,0,0.92)" }}
      onClick={onClose}
    >
      <div onClick={(e) => e.stopPropagation()} className="flex flex-col items-center gap-3">
        <img
          src={src}
          alt={alt}
          className="max-w-[90vw] max-h-[85vh] object-contain rounded"
        />
        {alt && (
          <p
            className="text-sm max-w-[60ch] text-center"
            style={{ color: "var(--loupe-text-secondary)" }}
          >
            {alt}
          </p>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `bunx tsc --noEmit`  
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/client/editor/ImageLightbox.tsx
git commit -m "feat: add ImageLightbox fullscreen overlay component"
```

---

### Task 5: Create ImageEditPopup component

**Files:**
- Create: `src/client/editor/ImageEditPopup.tsx`

- [ ] **Step 1: Create the file**

```typescript
import { useEffect, useState } from "react";

interface Props {
  src: string;
  alt: string;
  onSave: (src: string, alt: string) => void;
  onClose: () => void;
}

export function ImageEditPopup({ src, alt, onSave, onClose }: Props) {
  const [srcValue, setSrcValue] = useState(src);
  const [altValue, setAltValue] = useState(alt);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation(); // Prevent App.tsx global Escape handler from also firing
        onClose();
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const handleSave = () => {
    onSave(srcValue, altValue);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center"
      onClick={onClose}
    >
      <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.6)" }} />
      <div
        className="relative w-[360px] flex flex-col rounded-lg p-5 gap-4"
        style={{
          background: "var(--loupe-elevated)",
          border: "1px solid var(--loupe-border-strong)",
          boxShadow: "0 16px 48px rgba(0,0,0,0.5)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3
          className="text-sm font-medium"
          style={{ color: "var(--loupe-text)" }}
        >
          Edit image
        </h3>

        <div className="flex flex-col gap-1">
          <label
            className="text-xs"
            style={{ color: "var(--loupe-text-secondary)" }}
          >
            URL
          </label>
          <input
            type="text"
            value={srcValue}
            onChange={(e) => setSrcValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleSave(); }}
            className="w-full rounded px-3 py-2 text-sm outline-none"
            style={{
              background: "var(--loupe-surface)",
              border: "1px solid var(--loupe-border)",
              color: "var(--loupe-text)",
            }}
            autoFocus
          />
        </div>

        <div className="flex flex-col gap-1">
          <label
            className="text-xs"
            style={{ color: "var(--loupe-text-secondary)" }}
          >
            Caption
          </label>
          <input
            type="text"
            value={altValue}
            onChange={(e) => setAltValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSave();
            }}
            className="w-full rounded px-3 py-2 text-sm outline-none"
            style={{
              background: "var(--loupe-surface)",
              border: "1px solid var(--loupe-border)",
              color: "var(--loupe-text)",
            }}
          />
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded text-sm"
            style={{ color: "var(--loupe-text-secondary)" }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-3 py-1.5 rounded text-sm font-medium"
            style={{
              color: "var(--loupe-text)",
              background: "var(--loupe-surface)",
              border: "1px solid var(--loupe-border)",
            }}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `bunx tsc --noEmit`  
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/client/editor/ImageEditPopup.tsx
git commit -m "feat: add ImageEditPopup modal for editing src and alt"
```

---

### Task 6: Wire up Editor.tsx

**Files:**
- Modify: `src/client/editor/Editor.tsx`

- [ ] **Step 1: Add imports**

Add to top of `src/client/editor/Editor.tsx`:
```typescript
import { ImageLightbox } from "./ImageLightbox";
import { ImageEditPopup } from "./ImageEditPopup";
```

- [ ] **Step 2: Add state and stable callbacks, then update the createEditor call**

The `createEditor` call lives inside a `useEffect(... [])` with empty deps. Callbacks captured by that closure must be stable. Define the state and `useCallback` wrappers **before** the effect, then thread them into `createEditor`.

Replace the existing state declarations and the entire `useEffect` that calls `createEditor` with this:

```typescript
const [lightbox, setLightbox] = useState<{ src: string; alt: string } | null>(null);
const [editTarget, setEditTarget] = useState<{
  src: string;
  alt: string;
  getPos: () => number | undefined;
} | null>(null);

// Stable callbacks — empty deps because setLightbox/setEditTarget are stable React state setters
const handleImageClick = useCallback((src: string, alt: string) => {
  setLightbox({ src, alt });
}, []);

const handleImageEdit = useCallback((src: string, alt: string, getPos: () => number | undefined) => {
  setEditTarget({ src, alt, getPos });
}, []);

useEffect(() => {
  if (!containerRef.current) return;

  let mounted = true;
  let initialized = false;

  createEditor(containerRef.current, defaultValue, (md: string) => {
    if (!initialized) {
      initialized = true;
      if (!defaultValue) return;
    }
    onChangeRef.current(md);
    setIsEmpty(!md || md.replace(/\s/g, "") === "");
  }, handleImageClick, handleImageEdit).then(
    (instance) => {
      if (!mounted) {
        instance.destroy();
        return;
      }
      instanceRef.current = instance;
      if (editorRef) editorRef.current = instance;
    }
  );

  return () => {
    mounted = false;
    instanceRef.current?.destroy();
    instanceRef.current = null;
    if (editorRef) editorRef.current = null;
  };
}, []);
```

- [ ] **Step 4: Add the edit save handler**

```typescript
const handleEditSave = useCallback((newSrc: string, newAlt: string) => {
  if (!editTarget) return;
  const pos = editTarget.getPos();
  if (pos === undefined) return;
  const view = instanceRef.current?.getEditorView();
  if (!view) return;
  const currentNode = view.state.doc.nodeAt(pos);
  view.dispatch(
    view.state.tr.setNodeMarkup(pos, null, {
      ...currentNode?.attrs,
      src: newSrc,
      alt: newAlt,
    })
  );
}, [editTarget]);
```

- [ ] **Step 5: Render the new components**

Update the return statement to include the overlays:

```tsx
return (
  <div ref={wrapperRef} className="loupe-editor" onClick={handleClick}>
    {isEmpty && placeholder && (
      <div className="loupe-placeholder">
        {placeholder}
      </div>
    )}
    <div ref={containerRef} />
    {lightbox && (
      <ImageLightbox
        src={lightbox.src}
        alt={lightbox.alt}
        onClose={() => setLightbox(null)}
      />
    )}
    {editTarget && (
      <ImageEditPopup
        src={editTarget.src}
        alt={editTarget.alt}
        onSave={handleEditSave}
        onClose={() => setEditTarget(null)}
      />
    )}
  </div>
);
```

- [ ] **Step 6: Verify TypeScript compiles**

Run: `bunx tsc --noEmit`  
Expected: No errors.

- [ ] **Step 7: End-to-end smoke test**

Run: `bun run start`, open a markdown file with an image (or paste one in):

1. Hover the image → pencil button appears in top-right corner
2. Click image body → lightbox opens, filling screen; press Escape → closes
3. Click lightbox backdrop → also closes
4. Hover image again, click pencil → edit popup opens with current src/alt prefilled
5. Change the URL field, click Save → image updates in editor
6. Click Cancel → no change
7. Open edit popup, press Escape → closes

- [ ] **Step 8: Commit**

```bash
git add src/client/editor/Editor.tsx
git commit -m "feat: wire image lightbox and edit popup into Editor"
```

---

## Verification Checklist (from spec)

- [ ] Hover image → pencil appears; clicking pencil does NOT move cursor or select the image node
- [ ] Edit popup prefills current src and alt
- [ ] Save updates the image in editor; auto-save triggers; re-open file confirms persisted changes
- [ ] Stale-pos safety: open popup, type text elsewhere, save — works correctly
- [ ] Click image → lightbox opens
- [ ] Caption shown only when alt is non-empty
- [ ] Backdrop click and Escape both close lightbox
- [ ] Cancel and Escape both close edit popup without changes
- [ ] Image with relative src path behaves as expected (served via imagePrefix or shown broken)
