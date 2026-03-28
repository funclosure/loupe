# Code Block Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Shuttle-style code blocks to the Milkdown editor — Shiki syntax highlighting, language selector, copy button, wrap toggle.

**Architecture:** Custom ProseMirror node view for `code_block` nodes, rendered via Milkdown's `$view` API. Shiki highlights code in a background overlay; the editable ProseMirror content sits on top with transparent text and a visible caret. A plain-DOM toolbar provides language selection, wrap toggle, and copy.

**Tech Stack:** Shiki (syntax highlighting), Milkdown `$view` + ProseMirror NodeView, plain DOM toolbar (no Radix)

---

## File Structure

```
src/client/editor/
├── milkdown-setup.ts      # MODIFY — register codeBlockView plugin
├── Editor.tsx              # NO CHANGES
├── shiki.ts                # CREATE — Shiki singleton, highlightCode()
└── code-block-view.ts      # CREATE — ProseMirror NodeView class + $view plugin
src/client/index.css         # MODIFY — code block toolbar + overlay styles
tests/client/shiki.test.ts   # CREATE — unit tests for shiki utility
package.json                 # MODIFY — add shiki dependency
```

---

### Task 1: Install Shiki

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install shiki**

```bash
bun add shiki
```

- [ ] **Step 2: Verify installation**

```bash
bun run build
```

Expected: Build succeeds (shiki is tree-shakeable, no config needed)

---

### Task 2: Shiki Utility — Tests First

**Files:**
- Create: `tests/client/shiki.test.ts`
- Create: `src/client/editor/shiki.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/client/shiki.test.ts
import { describe, it, expect } from "vitest";
import { highlightCode } from "../../src/client/editor/shiki";

describe("highlightCode", () => {
  it("returns HTML with <pre> and <code> tags", async () => {
    const html = await highlightCode('const x = 1', 'javascript');
    expect(html).toContain("<pre");
    expect(html).toContain("<code");
    expect(html).toContain("const");
  });
  it("falls back to plaintext for unknown languages", async () => {
    const html = await highlightCode("hello", "notalanguage");
    expect(html).toContain("hello");
  });
  it("handles plaintext language", async () => {
    const html = await highlightCode("hello world", "plaintext");
    expect(html).toContain("hello world");
  });
  it("returns valid HTML for empty code", async () => {
    const html = await highlightCode("", "javascript");
    expect(html).toContain("<pre");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
bunx vitest run tests/client/shiki.test.ts
```

Expected: FAIL — module not found

- [ ] **Step 3: Implement shiki.ts**

Port from Shuttle's `shiki.ts`, simplified for Loupe (dark-only `github-dark` theme, no line highlighting):

```typescript
// src/client/editor/shiki.ts
import {
  createHighlighter,
  type Highlighter,
  type BundledLanguage,
} from "shiki";

let instance: Highlighter | null = null;
let pending: Promise<Highlighter> | null = null;

const LANGUAGES: BundledLanguage[] = [
  "javascript", "typescript", "jsx", "tsx",
  "json", "html", "css", "scss",
  "python", "java", "c", "cpp", "csharp",
  "go", "rust", "php", "ruby",
  "bash", "shell", "powershell",
  "yaml", "xml", "markdown", "sql",
  "graphql", "docker", "swift", "kotlin",
];

export async function getHighlighter(): Promise<Highlighter> {
  if (instance) return instance;
  if (pending) return pending;
  pending = createHighlighter({
    themes: ["github-dark"],
    langs: LANGUAGES,
  }).then((h) => {
    instance = h;
    return h;
  });
  return pending;
}

export function disposeHighlighter(): void {
  if (instance) {
    instance.dispose();
    instance = null;
    pending = null;
  }
}

export async function highlightCode(
  code: string,
  lang: string
): Promise<string> {
  try {
    const highlighter = await getHighlighter();
    const loaded = highlighter.getLoadedLanguages();
    // Map "plaintext" to "text" which Shiki understands
    const normalized = lang === "plaintext" ? "text" : lang;
    const safeLang = loaded.includes(normalized as BundledLanguage) ? normalized : "text";
    return highlighter.codeToHtml(code, {
      lang: safeLang,
      theme: "github-dark",
    });
  } catch {
    // Fallback — plain <pre><code>
    const escaped = code
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    return `<pre><code>${escaped}</code></pre>`;
  }
}

// Language options for the selector dropdown
export const LANGUAGE_OPTIONS = [
  { value: "plaintext", label: "Plain Text" },
  { value: "bash", label: "Bash" },
  { value: "c", label: "C" },
  { value: "cpp", label: "C++" },
  { value: "csharp", label: "C#" },
  { value: "css", label: "CSS" },
  { value: "docker", label: "Docker" },
  { value: "go", label: "Go" },
  { value: "graphql", label: "GraphQL" },
  { value: "html", label: "HTML" },
  { value: "java", label: "Java" },
  { value: "javascript", label: "JavaScript" },
  { value: "json", label: "JSON" },
  { value: "jsx", label: "JSX" },
  { value: "kotlin", label: "Kotlin" },
  { value: "markdown", label: "Markdown" },
  { value: "php", label: "PHP" },
  { value: "powershell", label: "PowerShell" },
  { value: "python", label: "Python" },
  { value: "ruby", label: "Ruby" },
  { value: "rust", label: "Rust" },
  { value: "scss", label: "SCSS" },
  { value: "shell", label: "Shell" },
  { value: "sql", label: "SQL" },
  { value: "swift", label: "Swift" },
  { value: "tsx", label: "TSX" },
  { value: "typescript", label: "TypeScript" },
  { value: "xml", label: "XML" },
  { value: "yaml", label: "YAML" },
];
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
bunx vitest run tests/client/shiki.test.ts
```

Expected: All 4 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/client/editor/shiki.ts tests/client/shiki.test.ts
git commit -m "feat: add Shiki syntax highlighting utility for code blocks"
```

---

### Task 3: ProseMirror Code Block Node View

**Files:**
- Create: `src/client/editor/code-block-view.ts`

This is the core of the feature. A ProseMirror `NodeView` class that renders:
1. A toolbar with language selector, wrap toggle, copy button
2. A code container with Shiki overlay (highlighted) + editable contentDOM (transparent text)

- [ ] **Step 1: Create the node view**

```typescript
// src/client/editor/code-block-view.ts
import { $view } from "@milkdown/kit/utils";
import { codeBlockSchema } from "@milkdown/kit/preset/commonmark";
import type { EditorView } from "@milkdown/kit/prose/view";
import type { Node } from "@milkdown/kit/prose/model";
import { highlightCode, LANGUAGE_OPTIONS } from "./shiki";

const WRAP_KEY = "loupe-code-wrap";

class CodeBlockNodeView {
  dom: HTMLElement;
  contentDOM: HTMLElement;
  private toolbar: HTMLElement;
  private highlightPre: HTMLElement;
  private langBtn: HTMLButtonElement;
  private copyBtn: HTMLButtonElement;
  private wrapBtn: HTMLButtonElement;
  private dropdown: HTMLElement | null = null;
  private outsideClickHandler: ((e: MouseEvent) => void) | null = null;
  private node: Node;
  private view: EditorView;
  private getPos: () => number | undefined;
  private isWrapped: boolean;
  private highlightGen = 0;

  constructor(node: Node, view: EditorView, getPos: () => number | undefined) {
    this.node = node;
    this.view = view;
    this.getPos = getPos;
    this.isWrapped = localStorage.getItem(WRAP_KEY) === "true";

    // --- DOM structure ---
    // <div.loupe-code-block>
    //   <div.loupe-code-toolbar> ... </div>
    //   <div.loupe-code-container>  (CSS Grid — both children in same cell)
    //     <pre.loupe-code-highlight> (Shiki overlay) </pre>
    //     <pre.loupe-code-editable><code contentDOM/></pre>
    //   </div>
    // </div>

    this.dom = document.createElement("div");
    this.dom.className = "loupe-code-block";
    if (this.isWrapped) this.dom.classList.add("wrapped");

    // Toolbar
    this.toolbar = this.createToolbar();
    this.dom.appendChild(this.toolbar);

    // Code container — CSS Grid stacks both layers in same cell
    // so they share a single scroll context (no desync)
    const container = document.createElement("div");
    container.className = "loupe-code-container";

    // Shiki overlay (background layer)
    this.highlightPre = document.createElement("pre");
    this.highlightPre.className = "loupe-code-highlight";
    this.highlightPre.setAttribute("aria-hidden", "true");
    container.appendChild(this.highlightPre);

    // Editable layer (foreground) — ProseMirror contentDOM
    const editablePre = document.createElement("pre");
    editablePre.className = "loupe-code-editable";
    this.contentDOM = document.createElement("code");
    editablePre.appendChild(this.contentDOM);
    container.appendChild(editablePre);

    this.dom.appendChild(container);

    // Initial highlight
    this.highlight();
  }

  private createToolbar(): HTMLElement {
    const bar = document.createElement("div");
    bar.className = "loupe-code-toolbar";

    // Language button
    this.langBtn = document.createElement("button");
    this.langBtn.className = "loupe-code-lang-btn";
    this.langBtn.type = "button";
    this.updateLangLabel();
    this.langBtn.addEventListener("mousedown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.toggleDropdown();
    });
    bar.appendChild(this.langBtn);

    // Right actions
    const actions = document.createElement("div");
    actions.className = "loupe-code-actions";

    // Wrap toggle
    this.wrapBtn = document.createElement("button");
    this.wrapBtn.className = "loupe-code-wrap-btn";
    this.wrapBtn.type = "button";
    this.wrapBtn.title = this.isWrapped ? "Wrap: On" : "Wrap: Off";
    this.wrapBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="6" x2="21" y2="6"/><path d="M3 12h15a3 3 0 1 1 0 6h-4"/><polyline points="16 16 14 18 16 20"/><line x1="3" y1="18" x2="10" y2="18"/></svg>`;
    this.wrapBtn.addEventListener("mousedown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.toggleWrap();
    });
    actions.appendChild(this.wrapBtn);

    // Copy button
    this.copyBtn = document.createElement("button");
    this.copyBtn.className = "loupe-code-copy-btn";
    this.copyBtn.type = "button";
    this.copyBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg><span>Copy</span>`;
    this.copyBtn.addEventListener("mousedown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.copyCode();
    });
    actions.appendChild(this.copyBtn);

    bar.appendChild(actions);
    return bar;
  }

  private updateLangLabel(): void {
    const lang = this.node.attrs.language || "plaintext";
    const opt = LANGUAGE_OPTIONS.find((o) => o.value === lang);
    const label = opt?.label || lang;
    this.langBtn.innerHTML = `<span>${label}</span><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>`;
  }

  private toggleDropdown(): void {
    if (this.dropdown) {
      this.closeDropdown();
      return;
    }

    this.dropdown = document.createElement("div");
    this.dropdown.className = "loupe-code-dropdown";

    // Search input
    const searchWrap = document.createElement("div");
    searchWrap.className = "loupe-code-dropdown-search";
    const searchInput = document.createElement("input");
    searchInput.type = "text";
    searchInput.placeholder = "Search...";
    searchInput.addEventListener("input", () => {
      this.filterDropdown(searchInput.value);
    });
    searchInput.addEventListener("mousedown", (e) => e.stopPropagation());
    searchInput.addEventListener("keydown", (e) => {
      e.stopPropagation(); // Prevent ProseMirror from capturing keys
      if (e.key === "Escape") this.closeDropdown();
    });
    searchWrap.appendChild(searchInput);
    this.dropdown.appendChild(searchWrap);

    // Options list
    const list = document.createElement("div");
    list.className = "loupe-code-dropdown-list";
    const currentLang = this.node.attrs.language || "plaintext";

    for (const opt of LANGUAGE_OPTIONS) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "loupe-code-dropdown-item";
      if (opt.value === currentLang) btn.classList.add("active");
      btn.textContent = opt.label;
      btn.dataset.value = opt.value;
      btn.addEventListener("mousedown", (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.setLanguage(opt.value);
        this.closeDropdown();
      });
      list.appendChild(btn);
    }
    this.dropdown.appendChild(list);

    this.toolbar.appendChild(this.dropdown);

    // Focus search after render
    requestAnimationFrame(() => searchInput.focus());

    // Close on click outside (next mousedown anywhere else)
    this.outsideClickHandler = (e: MouseEvent) => {
      if (this.dropdown && !this.dropdown.contains(e.target as HTMLElement)) {
        this.closeDropdown();
      }
    };
    // Defer so this click doesn't immediately close it
    requestAnimationFrame(() => {
      if (this.outsideClickHandler) {
        document.addEventListener("mousedown", this.outsideClickHandler);
      }
    });
  }

  private filterDropdown(query: string): void {
    if (!this.dropdown) return;
    const items = this.dropdown.querySelectorAll(".loupe-code-dropdown-item");
    const q = query.toLowerCase();
    items.forEach((item) => {
      const el = item as HTMLElement;
      const match =
        el.textContent!.toLowerCase().includes(q) ||
        (el.dataset.value || "").toLowerCase().includes(q);
      el.style.display = match ? "" : "none";
    });
  }

  private closeDropdown(): void {
    if (this.dropdown) {
      this.dropdown.remove();
      this.dropdown = null;
    }
    if (this.outsideClickHandler) {
      document.removeEventListener("mousedown", this.outsideClickHandler);
      this.outsideClickHandler = null;
    }
  }

  private setLanguage(lang: string): void {
    const pos = this.getPos();
    if (pos === undefined) return;
    const tr = this.view.state.tr.setNodeMarkup(pos, undefined, {
      ...this.node.attrs,
      language: lang,
    });
    this.view.dispatch(tr);
  }

  private toggleWrap(): void {
    this.isWrapped = !this.isWrapped;
    localStorage.setItem(WRAP_KEY, String(this.isWrapped));
    this.dom.classList.toggle("wrapped", this.isWrapped);
    this.wrapBtn.title = this.isWrapped ? "Wrap: On" : "Wrap: Off";
  }

  private async copyCode(): Promise<void> {
    const code = this.node.textContent;
    await navigator.clipboard.writeText(code);
    this.copyBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg><span>Copied!</span>`;
    this.copyBtn.classList.add("copied");
    setTimeout(() => {
      this.copyBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg><span>Copy</span>`;
      this.copyBtn.classList.remove("copied");
    }, 2000);
  }

  private async highlight(): Promise<void> {
    const gen = ++this.highlightGen;
    const code = this.node.textContent;
    const lang = this.node.attrs.language || "plaintext";
    const html = await highlightCode(code, lang);
    if (gen !== this.highlightGen) return; // Stale — newer highlight in flight
    // Extract inner content from Shiki's <pre><code>...</code></pre>
    // and put it into our overlay <pre>
    const temp = document.createElement("div");
    temp.innerHTML = html;
    const shikiPre = temp.querySelector("pre");
    if (shikiPre) {
      // Copy Shiki's inline styles (background, etc.)
      this.highlightPre.style.cssText = shikiPre.style.cssText;
      // Clear background — we set our own
      this.highlightPre.style.background = "transparent";
      this.highlightPre.style.margin = "0";
      this.highlightPre.style.padding = "";
      const shikiCode = shikiPre.querySelector("code");
      if (shikiCode) {
        this.highlightPre.innerHTML = shikiCode.innerHTML;
      }
    }
  }

  update(node: Node): boolean {
    if (node.type !== this.node.type) return false;
    this.node = node;
    this.updateLangLabel();
    this.highlight();
    return true;
  }

  selectNode(): void {
    this.dom.classList.add("selected");
  }

  deselectNode(): void {
    this.dom.classList.remove("selected");
  }

  stopEvent(event: Event): boolean {
    // Let ProseMirror handle keyboard events inside code
    // but stop toolbar button events from propagating
    const target = event.target as HTMLElement;
    if (this.toolbar.contains(target) || this.dropdown?.contains(target)) {
      return true;
    }
    return false;
  }

  ignoreMutation(mutation: MutationRecord | { type: "selection"; target: Element }): boolean {
    // Ignore mutations in the highlight overlay
    if (this.highlightPre.contains(mutation.target)) return true;
    // Ignore mutations in the toolbar
    if (this.toolbar.contains(mutation.target)) return true;
    return false;
  }

  destroy(): void {
    this.closeDropdown();
  }
}

// Milkdown $view plugin
export const codeBlockView = $view(
  codeBlockSchema.node,
  () => {
    return (node: Node, view: EditorView, getPos: () => number | undefined) => {
      return new CodeBlockNodeView(node, view, getPos);
    };
  }
);
```

> **Note:** If `$view` is not exported from `@milkdown/kit/utils`, try importing from `@milkdown/utils` directly.

- [ ] **Step 2: Verify file compiles**

```bash
bun run build
```

Expected: Build succeeds (even without CSS, the code should compile)

---

### Task 4: CSS for Code Block

**Files:**
- Modify: `src/client/index.css`

- [ ] **Step 1: Add code block styles**

Add after the existing code block CSS (around line 251), replacing the old `pre` styles:

```css
/* -- Code block — enhanced with Shiki highlighting ---------- */
.loupe-code-block {
  position: relative;
  border-radius: 8px;
  border: 1px solid rgba(255, 245, 230, 0.06);
  background: #1e1c1a;
  margin: 4px 0 24px 0;
  overflow: hidden;
}

.loupe-code-block.selected {
  border-color: rgba(255, 245, 230, 0.15);
}

/* Toolbar */
.loupe-code-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 8px;
  border-bottom: 1px solid rgba(255, 245, 230, 0.06);
  position: relative;
}

.loupe-code-toolbar button {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  border-radius: 4px;
  border: none;
  background: transparent;
  color: var(--loupe-text-tertiary);
  font-size: 12px;
  font-family: system-ui, -apple-system, sans-serif;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}

.loupe-code-toolbar button:hover {
  background: rgba(255, 245, 230, 0.06);
  color: var(--loupe-text-secondary);
}

.loupe-code-toolbar .loupe-code-copy-btn.copied {
  color: #6b9e6b;
}

.loupe-code-toolbar .loupe-code-wrap-btn {
  padding: 3px 6px;
}

.loupe-code-block.wrapped .loupe-code-wrap-btn {
  color: var(--loupe-text-secondary);
}

.loupe-code-actions {
  display: flex;
  align-items: center;
  gap: 2px;
}

/* Language dropdown */
.loupe-code-dropdown {
  position: absolute;
  top: 100%;
  left: 4px;
  z-index: 50;
  background: var(--loupe-elevated);
  border: 1px solid var(--loupe-border-strong);
  border-radius: 8px;
  width: 180px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
  padding: 4px 0;
}

.loupe-code-dropdown-search {
  padding: 4px 8px;
}

.loupe-code-dropdown-search input {
  width: 100%;
  padding: 4px 8px;
  border-radius: 4px;
  border: 1px solid var(--loupe-border-strong);
  background: var(--loupe-surface);
  color: var(--loupe-text);
  font-size: 12px;
  outline: none;
}

.loupe-code-dropdown-search input:focus {
  border-color: rgba(255, 245, 230, 0.2);
}

.loupe-code-dropdown-list {
  max-height: 250px;
  overflow-y: auto;
}

.loupe-code-dropdown-item {
  display: block;
  width: 100%;
  padding: 5px 12px;
  text-align: left;
  border: none;
  background: none;
  color: var(--loupe-text-secondary);
  font-size: 12px;
  cursor: pointer;
  font-family: system-ui, -apple-system, sans-serif;
  transition: background 0.1s;
}

.loupe-code-dropdown-item:hover {
  background: rgba(255, 245, 230, 0.06);
}

.loupe-code-dropdown-item.active {
  color: var(--loupe-text);
  font-weight: 500;
}

/* Code container — CSS Grid stacks overlay + editable in same cell.
   Both children share one scroll context, preventing horizontal scroll desync. */
.loupe-code-container {
  display: grid;
  grid-template: 1fr / 1fr;
  overflow-x: auto;
}

.loupe-code-block.wrapped .loupe-code-container {
  overflow-x: visible;
}

.loupe-code-highlight,
.loupe-code-editable {
  grid-area: 1 / 1;
  margin: 0 !important;
  padding: 16px !important;
  font-family: "SF Mono", "Fira Code", ui-monospace, monospace !important;
  font-size: 14px !important;
  line-height: 1.6 !important;
  white-space: pre !important;
  border: none !important;
  background: transparent !important;
  border-radius: 0 !important;
  outline: none !important;
  box-shadow: none !important;
}

.loupe-code-block.wrapped .loupe-code-highlight,
.loupe-code-block.wrapped .loupe-code-editable {
  white-space: pre-wrap !important;
  word-break: break-word !important;
}

/* Shiki overlay — behind editable text, no pointer events */
.loupe-code-highlight {
  pointer-events: none;
}

/* Editable layer — transparent text, visible caret */
.loupe-code-editable {
  position: relative; /* above overlay in stacking context */
  color: transparent !important;
  caret-color: var(--loupe-text-secondary) !important;
}

.loupe-code-editable code {
  color: transparent !important;
  background: none !important;
  padding: 0 !important;
  border: none !important;
  font: inherit !important;
}

/* Selection should still be visible */
.loupe-code-editable ::selection {
  background: rgba(255, 245, 230, 0.15);
}
```

- [ ] **Step 2: Scope old `pre` styles to avoid conflicts**

The existing `.loupe-editor div[contenteditable="true"] pre` styles (lines ~212-230 of index.css) target `<pre>` elements inside the editor. Since the new node view wraps code blocks in `.loupe-code-block`, these old styles will also hit the inner `<pre>` elements. Scope them with `:not()`:

```css
/* Change this selector: */
.loupe-editor div[contenteditable="true"] pre { ... }
/* To this: */
.loupe-editor div[contenteditable="true"] pre:not(.loupe-code-highlight):not(.loupe-code-editable) { ... }

/* Same for: */
.loupe-editor div[contenteditable="true"] pre code { ... }
/* To: */
.loupe-editor div[contenteditable="true"] pre:not(.loupe-code-editable) code { ... }
```

This ensures old styles only apply to any standalone `<pre>` blocks not managed by the code block view.

---

### Task 5: Register Node View in Milkdown

**Files:**
- Modify: `src/client/editor/milkdown-setup.ts`

- [ ] **Step 1: Import and register the code block view plugin**

Add import at top:

```typescript
import { codeBlockView } from "./code-block-view";
```

Add `.use(codeBlockView)` to the editor creation chain (after `.use(commonmark)` and before `.create()`):

```typescript
const editor = await Editor.make()
  .config((ctx) => {
    // ... existing config ...
  })
  .use(commonmark)
  .use(listener)
  .use(trailing)
  .use(clipboard)
  .use(codeBlockView)   // <-- add here
  .create();
```

- [ ] **Step 2: Build and verify**

```bash
bun run build
```

Expected: Build succeeds

- [ ] **Step 3: Commit all code block files**

```bash
git add src/client/editor/shiki.ts src/client/editor/code-block-view.ts src/client/editor/milkdown-setup.ts src/client/index.css package.json bun.lockb
git commit -m "feat: add Shiki-powered code blocks with language selector, copy, and wrap toggle"
```

---

### Task 6: Integration Test in Browser

**Files:** None (manual testing)

- [ ] **Step 1: Start the app**

```bash
bun run build && bun run start
```

Open `http://localhost:4460`

- [ ] **Step 2: Test code block creation**

Type three backticks followed by `python` and Enter. Verify:
- Toolbar appears with "Python" language label
- Code typed in the block gets syntax highlighted
- Caret is visible and editing works normally

- [ ] **Step 3: Test language selector**

Click the language label in the toolbar:
- Dropdown appears with search input
- Type "type" — filters to "TypeScript"
- Click "TypeScript" — language changes, code re-highlights
- Dropdown closes

- [ ] **Step 4: Test copy button**

Click "Copy" button:
- Button text changes to "Copied!" with green color
- Paste somewhere — code is in clipboard
- Button reverts after 2 seconds

- [ ] **Step 5: Test wrap toggle**

Click wrap icon:
- Long lines wrap instead of scrolling
- Click again — wrapping disables
- Preference persists across page reload (localStorage)

- [ ] **Step 6: Test with sample.md**

```bash
loupe sample.md
```

Verify any code blocks in the sample render correctly with the new node view.

- [ ] **Step 7: Run all tests**

```bash
bunx vitest run
```

Expected: All existing tests pass (22 + new shiki tests)

- [ ] **Step 8: Fix any issues found, commit fixes**

```bash
git add -A && git commit -m "fix: code block polish from integration testing"
```
