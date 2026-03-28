# Loupe Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a zen writing PWA where floating AI lenses offer different perspectives on your text.

**Architecture:** Client + thin Bun server. Bun serves the Vite-built React SPA and manages lens sessions (Anthropic SDK). Milkdown (ProseMirror) provides WYSIWYG markdown editing. File System Access API handles local file I/O with auto-save. SSE streams lens activity to the client.

**Tech Stack:** Bun, React 19, Vite, TypeScript, Milkdown, Anthropic SDK, Tailwind CSS, VitePWA

**Spec:** `docs/superpowers/specs/2026-03-28-loupe-design.md`

---

## File Map

```
loupe/
├── cli.ts                              # CLI entry: parse args, start server, open browser
├── package.json                        # Bun project, scripts, dependencies
├── tsconfig.json                       # TypeScript config (shared)
├── tsconfig.server.json                # Server-specific TS config
├── vite.config.ts                      # Vite + Tailwind + PWA plugin config
├── vitest.config.ts                    # Vitest config with path aliases
├── index.html                          # Vite SPA entry (loads src/client/main.tsx)
├── public/
│   └── favicon.svg                     # Loupe icon
├── src/
│   ├── shared/
│   │   ├── types.ts                    # LensDefinition, LensState, DocumentState, SSE event types
│   │   └── lens-presets.ts             # 5 built-in lens definitions (no LENS.md files needed)
│   ├── server/
│   │   ├── index.ts                    # Bun.serve: static files + API routes
│   │   ├── routes.ts                   # Route handler: REST endpoints + SSE
│   │   ├── document.ts                 # In-memory document store (content, version, cursor)
│   │   ├── lens-manager.ts             # Create/remove/list lens sessions, dispatch triggers
│   │   ├── lens-session.ts             # Single lens: Anthropic conversation, streaming, state
│   │   └── lens-loader.ts             # Parse LENS.md files from lenses/ directory
│   └── client/
│       ├── main.tsx                    # React root, mount App
│       ├── App.tsx                     # Layout shell: top bar + editor + lens layer
│       ├── index.css                   # Tailwind directives + CSS variables (monochrome theme)
│       ├── hooks/
│       │   ├── use-file.ts             # File System Access API: open, save, auto-save
│       │   ├── use-sse.ts              # SSE connection with auto-reconnect
│       │   ├── use-lenses.ts           # Lens state management: activate, dismiss, trigger
│       │   └── use-zen-mode.ts         # Zen mode toggle with localStorage persistence
│       ├── editor/
│       │   ├── Editor.tsx              # Milkdown React wrapper component
│       │   └── milkdown-setup.ts       # Milkdown plugins: commonmark, listener, keymaps
│       ├── chrome/
│       │   ├── TopBar.tsx              # Filename, save indicator, lens count, "+" button
│       │   └── LensPicker.tsx          # Modal: list presets + user lenses, activate button
│       └── lenses/
│           ├── LensLayer.tsx           # Positions all lens bubbles in the margins
│           ├── LensBubble.tsx          # Collapsed bubble: avatar, state, preview
│           └── LensChat.tsx            # Expanded chat: messages, input, action buttons
├── lenses/                             # User-created (empty by default, gitignored)
│   └── .gitkeep
└── tests/
    ├── server/
    │   ├── document.test.ts            # Document store unit tests
    │   ├── lens-loader.test.ts         # LENS.md parsing tests
    │   ├── lens-session.test.ts        # Lens session logic tests
    │   └── lens-manager.test.ts        # Lens manager orchestration tests
    └── shared/
        └── lens-presets.test.ts        # Preset validation tests
```

---

## Chunk 1: Project Scaffolding & Editor

### Task 1: Initialize Bun project with dependencies

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `tsconfig.server.json`

- [ ] **Step 1: Initialize project and install dependencies**

```bash
cd /Users/victor/Documents/Workspace/Projects/loupe
bun init -y
```

- [ ] **Step 2: Install production dependencies**

```bash
bun add react react-dom @anthropic-ai/sdk @milkdown/kit @milkdown/core @milkdown/ctx @milkdown/preset-commonmark @milkdown/plugin-listener @milkdown/theme-nord @prosemirror/model @prosemirror/state @prosemirror/view nanoid
```

- [ ] **Step 3: Install dev dependencies**

```bash
bun add -d @types/react @types/react-dom typescript vite @vitejs/plugin-react tailwindcss @tailwindcss/vite postcss autoprefixer vite-plugin-pwa vitest @testing-library/react @testing-library/dom jsdom
```

- [ ] **Step 4: Configure TypeScript**

`tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "paths": {
      "@shared/*": ["./src/shared/*"]
    }
  },
  "include": ["src/**/*", "cli.ts"],
  "exclude": ["node_modules"]
}
```

`tsconfig.server.json`:
```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "types": ["bun-types"]
  },
  "include": ["src/server/**/*", "src/shared/**/*", "cli.ts"]
}
```

- [ ] **Step 5: Commit scaffolding**

```bash
echo "node_modules\ndist\n.superpowers\nlenses/*\n!lenses/.gitkeep" > .gitignore
mkdir -p lenses && touch lenses/.gitkeep
git add package.json tsconfig.json tsconfig.server.json bun.lock .gitignore lenses/.gitkeep
git commit -m "feat: initialize Bun project with dependencies"
```

---

### Task 2: Vite + Tailwind + PWA configuration

**Files:**
- Create: `vite.config.ts`
- Create: `vitest.config.ts`
- Create: `index.html`
- Create: `public/favicon.svg`

- [ ] **Step 1: Create Vite config**

`vite.config.ts`:
```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "prompt",
      includeAssets: ["favicon.svg"],
      manifest: {
        name: "Loupe",
        short_name: "Loupe",
        description: "A zen writing app with AI lenses",
        theme_color: "#1a1a1f",
        background_color: "#1a1a1f",
        display: "standalone",
        start_url: "/",
        file_handlers: [
          {
            action: "/",
            accept: { "text/markdown": [".md"] },
          },
        ],
        icons: [
          { src: "favicon.svg", sizes: "any", type: "image/svg+xml" },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      "@shared": path.resolve(__dirname, "src/shared"),
    },
  },
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:4460",
        changeOrigin: true,
      },
    },
  },
});
```

- [ ] **Step 2: Create index.html**

`index.html`:
```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Loupe</title>
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
  </head>
  <body class="bg-neutral-950 text-neutral-200">
    <div id="root"></div>
    <script type="module" src="/src/client/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 3: Create favicon**

`public/favicon.svg` — a minimal loupe icon (circle with handle):
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none" stroke="#d4d4d8" stroke-width="2">
  <circle cx="14" cy="14" r="9"/>
  <line x1="20.5" y1="20.5" x2="28" y2="28" stroke-linecap="round"/>
</svg>
```

- [ ] **Step 4: Create vitest config**

`vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@shared": path.resolve(__dirname, "src/shared"),
    },
  },
  test: {
    environment: "node",
  },
});
```

- [ ] **Step 5: Commit config**

```bash
git add vite.config.ts vitest.config.ts index.html public/favicon.svg
git commit -m "feat: add Vite, Tailwind, PWA, and vitest configuration"
```

---

### Task 3: Shared types

**Files:**
- Create: `src/shared/types.ts`

- [ ] **Step 1: Write shared type definitions**

`src/shared/types.ts`:
```ts
// -- Lens definition (parsed from LENS.md or built-in preset) --

export interface LensDefinition {
  id: string; // directory name or preset key
  name: string;
  icon: string; // single char or emoji
  color: string; // hex color
  description: string;
  systemPrompt: string;
  model?: string; // optional per-lens model override
  source: "preset" | "user";
}

// -- Document state --

export interface DocumentState {
  content: string;
  version: number;
  cursor?: number;
  selection?: { from: number; to: number };
}

// -- Lens session state --

export type LensStatus = "idle" | "thinking" | "error";

export interface ActiveLens {
  lensId: string;
  definitionId: string;
  status: LensStatus;
  preview: string | null; // latest bubble preview text
  error: string | null;
}

// -- SSE events (server → client) --

export type SSEEvent =
  | { type: "lens:thinking"; lensId: string }
  | { type: "lens:bubble"; lensId: string; preview: string }
  | { type: "lens:message"; lensId: string; delta: string; done: boolean }
  | { type: "lens:error"; lensId: string; error: string }
  | { type: "lens:removed"; lensId: string };

// -- API request bodies --

export interface DocumentSyncBody {
  content: string;
  version: number;
  cursor?: number;
  selection?: { from: number; to: number };
}

export interface LensFocusBody {
  paragraphText: string;
  version: number;
}

export interface LensAskBody {
  message: string;
}

// -- Chat messages (for expanded lens chat) --

export interface ChatMessage {
  role: "user" | "lens";
  content: string;
}
```

- [ ] **Step 2: Commit types**

```bash
mkdir -p src/shared
git add src/shared/types.ts
git commit -m "feat: add shared type definitions"
```

---

### Task 4: Built-in lens presets

**Files:**
- Create: `src/shared/lens-presets.ts`
- Create: `tests/shared/lens-presets.test.ts`

- [ ] **Step 1: Write test for presets**

`tests/shared/lens-presets.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { LENS_PRESETS } from "../../src/shared/lens-presets";

describe("LENS_PRESETS", () => {
  it("has 5 built-in presets", () => {
    expect(LENS_PRESETS).toHaveLength(5);
  });

  it("each preset has required fields", () => {
    for (const preset of LENS_PRESETS) {
      expect(preset.id).toBeTruthy();
      expect(preset.name).toBeTruthy();
      expect(preset.icon).toHaveLength(1);
      expect(preset.color).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(preset.description).toBeTruthy();
      expect(preset.systemPrompt).toBeTruthy();
      expect(preset.source).toBe("preset");
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
bunx vitest run tests/shared/lens-presets.test.ts
```
Expected: FAIL — module not found

- [ ] **Step 3: Write presets**

`src/shared/lens-presets.ts`:
```ts
import type { LensDefinition } from "./types";

export const LENS_PRESETS: LensDefinition[] = [
  {
    id: "devils-advocate",
    name: "Devil's Advocate",
    icon: "D",
    color: "#dc2626",
    description: "Challenges assumptions, finds weak arguments",
    source: "preset",
    systemPrompt: `You are a Devil's Advocate lens. Your role is to challenge the writer's assumptions, find weak arguments, and identify logical gaps. Be constructive but unflinching — point out what doesn't hold up and why. Keep responses concise and focused on the specific text.`,
  },
  {
    id: "intuition-pump",
    name: "Intuition Pump",
    icon: "I",
    color: "#0891b2",
    description: "Dennett-style thought experiments, reframes the problem",
    source: "preset",
    systemPrompt: `You are an Intuition Pump lens, inspired by Daniel Dennett's philosophical method. Your role is to offer thought experiments, analogies, and reframings that help the writer see their ideas from unexpected angles. Ask "what if" questions. Propose scenarios that test the boundaries of the writer's claims. Keep it playful and generative.`,
  },
  {
    id: "first-principles",
    name: "First Principles",
    icon: "F",
    color: "#ca8a04",
    description: "Strips to fundamentals, asks 'why' recursively",
    source: "preset",
    systemPrompt: `You are a First Principles lens. Your role is to strip the writer's ideas down to their most fundamental assumptions. Ask "why" recursively until you reach bedrock truths. Identify which claims are derived and which are foundational. Help the writer see what they're taking for granted.`,
  },
  {
    id: "empathetic-reader",
    name: "Empathetic Reader",
    icon: "E",
    color: "#16a34a",
    description: "How would a general audience feel reading this?",
    source: "preset",
    systemPrompt: `You are an Empathetic Reader lens. Your role is to represent the general audience — someone intelligent but not expert in the topic. Share how the text makes you feel, where you get lost, what resonates, and what falls flat. Focus on emotional impact, clarity, and engagement. Be honest about where attention wanders.`,
  },
  {
    id: "copy-editor",
    name: "Copy Editor",
    icon: "C",
    color: "#9333ea",
    description: "Clarity, concision, grammar",
    source: "preset",
    systemPrompt: `You are a Copy Editor lens. Your role is to improve the craft of the writing — clarity, concision, rhythm, grammar, word choice. Suggest specific edits. Flag awkward phrasing, unnecessary words, passive voice, and unclear references. Be precise and practical. Don't rewrite whole paragraphs — point to specific issues.`,
  },
];
```

- [ ] **Step 4: Run test to verify it passes**

```bash
bunx vitest run tests/shared/lens-presets.test.ts
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/shared/lens-presets.ts tests/shared/lens-presets.test.ts
git commit -m "feat: add 5 built-in lens presets"
```

---

### Task 5: Milkdown editor component

**Files:**
- Create: `src/client/editor/milkdown-setup.ts`
- Create: `src/client/editor/Editor.tsx`

- [ ] **Step 1: Create Milkdown setup**

`src/client/editor/milkdown-setup.ts` — configures the Milkdown editor with commonmark preset and change listener. Exposes the ProseMirror `EditorView` for future Phase 2 access.

```ts
import {
  Editor,
  rootCtx,
  defaultValueCtx,
  editorViewCtx,
} from "@milkdown/kit/core";
import { commonmark } from "@milkdown/kit/preset/commonmark";
import { listener, listenerCtx } from "@milkdown/kit/plugin/listener";
import { nord } from "@milkdown/theme-nord";

export interface MilkdownInstance {
  editor: Editor;
  getMarkdown: () => string;
  setMarkdown: (md: string) => void;
}

export async function createEditor(
  root: HTMLElement,
  defaultValue: string,
  onChange: (markdown: string) => void
): Promise<MilkdownInstance> {
  const editor = await Editor.make()
    .config((ctx) => {
      ctx.set(rootCtx, root);
      ctx.set(defaultValueCtx, defaultValue);
      ctx.set(listenerCtx, {
        markdown: [(getMarkdown) => {
          const md = getMarkdown();
          onChange(md);
        }],
      });
    })
    .config(nord)
    .use(commonmark)
    .use(listener)
    .create();

  return {
    editor,
    getMarkdown: () => {
      // Access ProseMirror view to get current markdown
      const view = editor.ctx.get(editorViewCtx);
      return view.state.doc.textContent;
    },
    setMarkdown: (md: string) => {
      // Will be implemented when needed for file open
      editor.action((ctx) => {
        // Replace editor content
      });
    },
  };
}
```

Note: The exact Milkdown API may need adjustment during implementation — the plugin and context APIs evolve between versions. The implementer should consult the Milkdown docs at https://milkdown.dev for the installed version. The key requirement is: commonmark preset, change listener that emits markdown, and access to the ProseMirror `EditorView`.

- [ ] **Step 2: Create Editor React component**

`src/client/editor/Editor.tsx`:
```tsx
import { useRef, useEffect, useCallback } from "react";
import { createEditor, type MilkdownInstance } from "./milkdown-setup";

interface EditorProps {
  defaultValue: string;
  onChange: (markdown: string) => void;
  editorRef?: React.MutableRefObject<MilkdownInstance | null>;
}

export function Editor({ defaultValue, onChange, editorRef }: EditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<MilkdownInstance | null>(null);

  const handleChange = useCallback(
    (md: string) => {
      onChange(md);
    },
    [onChange]
  );

  useEffect(() => {
    if (!containerRef.current) return;

    let mounted = true;

    createEditor(containerRef.current, defaultValue, handleChange).then(
      (instance) => {
        if (!mounted) {
          instance.editor.destroy();
          return;
        }
        instanceRef.current = instance;
        if (editorRef) editorRef.current = instance;
      }
    );

    return () => {
      mounted = false;
      instanceRef.current?.editor.destroy();
      instanceRef.current = null;
      if (editorRef) editorRef.current = null;
    };
  }, []); // Mount once

  return (
    <div
      ref={containerRef}
      className="prose prose-invert prose-neutral max-w-none
                 [&_.milkdown]:outline-none [&_.milkdown]:min-h-[80vh]"
    />
  );
}
```

- [ ] **Step 3: Commit editor component**

```bash
mkdir -p src/client/editor
git add src/client/editor/milkdown-setup.ts src/client/editor/Editor.tsx
git commit -m "feat: add Milkdown editor component with commonmark and change listener"
```

---

### Task 6: CSS theme and global styles

**Files:**
- Create: `src/client/index.css`

- [ ] **Step 1: Create monochrome theme with CSS variables**

`src/client/index.css`:
```css
@import "tailwindcss";

:root {
  /* Monochrome palette — dark mode default */
  --loupe-bg: #1a1a1f;
  --loupe-surface: #232329;
  --loupe-border: rgba(255, 255, 255, 0.06);
  --loupe-text: #d4d4d8;
  --loupe-text-muted: #71717a;
  --loupe-text-dim: #3f3f46;

  /* Chrome (top bar) */
  --loupe-chrome-bg: #232329;
  --loupe-chrome-opacity: 1;

  /* Save indicator */
  --loupe-save-color: #52525b;

  /* Editor */
  --loupe-editor-font: Georgia, "Times New Roman", serif;
  --loupe-editor-max-width: 720px;

  /* Transitions */
  --loupe-fade-duration: 0.3s;
}

/* Light mode */
.light {
  --loupe-bg: #fafafa;
  --loupe-surface: #f5f5f5;
  --loupe-border: rgba(0, 0, 0, 0.06);
  --loupe-text: #27272a;
  --loupe-text-muted: #71717a;
  --loupe-text-dim: #d4d4d8;
  --loupe-chrome-bg: #f5f5f5;
  --loupe-save-color: #a1a1aa;
}

/* Zen mode — chrome fades out */
.zen .chrome {
  opacity: 0;
  transition: opacity var(--loupe-fade-duration) ease;
}
.zen .chrome:hover {
  opacity: 1;
}

/* Global resets */
body {
  background: var(--loupe-bg);
  color: var(--loupe-text);
  font-family: system-ui, -apple-system, sans-serif;
  margin: 0;
  overflow: hidden;
  height: 100vh;
}

#root {
  height: 100vh;
  display: flex;
  flex-direction: column;
}

/* Editor container */
.editor-surface {
  flex: 1;
  overflow-y: auto;
  display: flex;
  justify-content: center;
  padding: 48px 24px;
}

.editor-column {
  width: 100%;
  max-width: var(--loupe-editor-max-width);
  font-family: var(--loupe-editor-font);
  font-size: 16px;
  line-height: 1.8;
}

/* Milkdown overrides for zen feel */
.editor-column .milkdown {
  outline: none;
}

.editor-column .milkdown h1 {
  font-size: 28px;
  font-weight: 600;
  margin-bottom: 24px;
  color: var(--loupe-text);
}

.editor-column .milkdown h2 {
  font-size: 22px;
  font-weight: 600;
  margin-top: 32px;
  margin-bottom: 16px;
}

.editor-column .milkdown p {
  margin-bottom: 16px;
  color: var(--loupe-text);
}

.editor-column .milkdown blockquote {
  border-left: 2px solid var(--loupe-border);
  padding-left: 16px;
  color: var(--loupe-text-muted);
}

/* Scrollbar */
.editor-surface::-webkit-scrollbar {
  width: 6px;
}
.editor-surface::-webkit-scrollbar-track {
  background: transparent;
}
.editor-surface::-webkit-scrollbar-thumb {
  background: var(--loupe-text-dim);
  border-radius: 3px;
}
```

- [ ] **Step 2: Commit styles**

```bash
mkdir -p src/client
git add src/client/index.css
git commit -m "feat: add monochrome CSS theme with zen mode and editor styles"
```

---

### Task 7: App shell and main entry

**Files:**
- Create: `src/client/main.tsx`
- Create: `src/client/App.tsx`
- Create: `src/client/chrome/TopBar.tsx`

- [ ] **Step 1: Create main entry**

`src/client/main.tsx`:
```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
```

- [ ] **Step 2: Create TopBar component**

`src/client/chrome/TopBar.tsx`:
```tsx
interface TopBarProps {
  filename: string;
  activeLensCount: number;
  saveState: "saved" | "saving" | "unsaved" | "unavailable";
  onOpenLensPicker: () => void;
  onOpenFile: () => void;
}

export function TopBar({
  filename,
  activeLensCount,
  saveState,
  onOpenLensPicker,
  onOpenFile,
}: TopBarProps) {
  return (
    <div className="chrome flex items-center justify-between px-6 py-3 border-b"
         style={{ borderColor: "var(--loupe-border)", background: "var(--loupe-chrome-bg)" }}>
      {/* Left: filename */}
      <button
        onClick={onOpenFile}
        className="text-sm hover:opacity-80 transition-opacity"
        style={{ color: "var(--loupe-text-muted)" }}
      >
        {filename}
      </button>

      {/* Center: save indicator */}
      <div className="text-xs transition-opacity duration-1000"
           style={{
             color: "var(--loupe-save-color)",
             opacity: saveState === "saving" ? 1 : saveState === "saved" ? 0 : 1,
           }}>
        {saveState === "saving" && "saving..."}
        {saveState === "unavailable" && "download to save"}
      </div>

      {/* Right: lens count + add button */}
      <div className="flex items-center gap-3">
        {activeLensCount > 0 && (
          <span className="text-xs" style={{ color: "var(--loupe-text-dim)" }}>
            {activeLensCount} lens{activeLensCount !== 1 ? "es" : ""}
          </span>
        )}
        <button
          onClick={onOpenLensPicker}
          className="w-7 h-7 rounded-full flex items-center justify-center text-sm
                     border transition-colors hover:opacity-80"
          style={{
            borderColor: "var(--loupe-border)",
            color: "var(--loupe-text-muted)",
            background: "var(--loupe-surface)",
          }}
        >
          +
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create App shell**

`src/client/App.tsx`:
```tsx
import { useState, useCallback, useRef } from "react";
import { Editor } from "./editor/Editor";
import { TopBar } from "./chrome/TopBar";
import type { MilkdownInstance } from "./editor/milkdown-setup";

export function App() {
  const [filename, setFilename] = useState("Untitled");
  const [content, setContent] = useState("");
  const [zenMode, setZenMode] = useState(false);
  const editorRef = useRef<MilkdownInstance | null>(null);

  const handleEditorChange = useCallback((markdown: string) => {
    setContent(markdown);
  }, []);

  const handleOpenFile = useCallback(() => {
    // Will be implemented in file handling task
  }, []);

  const handleOpenLensPicker = useCallback(() => {
    // Will be implemented in lens picker task
  }, []);

  // Zen mode keyboard shortcut
  // Will be extracted to useZenMode hook

  return (
    <div className={zenMode ? "zen h-full flex flex-col" : "h-full flex flex-col"}>
      <TopBar
        filename={filename}
        activeLensCount={0}
        saveState="unsaved"
        onOpenLensPicker={handleOpenLensPicker}
        onOpenFile={handleOpenFile}
      />

      <div className="editor-surface">
        <div className="editor-column">
          <Editor
            defaultValue=""
            onChange={handleEditorChange}
            editorRef={editorRef}
          />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Verify app renders in dev mode**

```bash
bunx vite --open
```
Expected: browser opens with the monochrome editor surface and top bar showing "Untitled"

- [ ] **Step 5: Commit app shell**

```bash
mkdir -p src/client/chrome
git add src/client/main.tsx src/client/App.tsx src/client/chrome/TopBar.tsx
git commit -m "feat: add App shell with TopBar and Editor components"
```

---

### Task 8: File System Access API hook

**Files:**
- Create: `src/client/hooks/use-file.ts`

- [ ] **Step 1: Implement use-file hook**

`src/client/hooks/use-file.ts`:
```ts
import { useState, useRef, useCallback, useEffect } from "react";

interface UseFileReturn {
  filename: string;
  content: string;
  saveState: "saved" | "saving" | "unsaved" | "unavailable";
  openFile: () => Promise<void>;
  saveFileAs: () => Promise<void>;
  updateContent: (newContent: string) => void;
  isSupported: boolean;
}

export function useFile(): UseFileReturn {
  const isSupported = "showOpenFilePicker" in window;

  const [filename, setFilename] = useState("Untitled");
  const [content, setContent] = useState("");
  const [saveState, setSaveState] = useState<UseFileReturn["saveState"]>(
    isSupported ? "unsaved" : "unavailable"
  );

  const fileHandleRef = useRef<FileSystemFileHandle | null>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestContentRef = useRef(content);

  const writeToHandle = useCallback(async (handle: FileSystemFileHandle, text: string) => {
    try {
      setSaveState("saving");
      const writable = await handle.createWritable();
      await writable.write(text);
      await writable.close();
      setSaveState("saved");
    } catch {
      setSaveState("unavailable");
    }
  }, []);

  const updateContent = useCallback(
    (newContent: string) => {
      latestContentRef.current = newContent;
      setContent(newContent);

      if (!fileHandleRef.current) return;

      // Debounced auto-save
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => {
        if (fileHandleRef.current) {
          writeToHandle(fileHandleRef.current, latestContentRef.current);
        }
      }, 1000);
    },
    [writeToHandle]
  );

  const openFile = useCallback(async () => {
    if (!isSupported) {
      // Fallback: file input
      const input = document.createElement("input");
      input.type = "file";
      input.accept = ".md,.txt";
      input.onchange = async () => {
        const file = input.files?.[0];
        if (!file) return;
        const text = await file.text();
        setFilename(file.name);
        setContent(text);
        latestContentRef.current = text;
      };
      input.click();
      return;
    }

    try {
      const [handle] = await (window as any).showOpenFilePicker({
        types: [
          {
            description: "Markdown files",
            accept: { "text/markdown": [".md"], "text/plain": [".txt"] },
          },
        ],
      });
      fileHandleRef.current = handle;
      const file = await handle.getFile();
      const text = await file.text();
      setFilename(file.name);
      setContent(text);
      latestContentRef.current = text;
      setSaveState("saved");
    } catch {
      // User cancelled
    }
  }, [isSupported]);

  const saveFileAs = useCallback(async () => {
    if (!isSupported) {
      // Fallback: download
      const blob = new Blob([latestContentRef.current], { type: "text/markdown" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename === "Untitled" ? "untitled.md" : filename;
      a.click();
      URL.revokeObjectURL(url);
      return;
    }

    try {
      const handle = await (window as any).showSaveFilePicker({
        suggestedName: filename === "Untitled" ? "untitled.md" : filename,
        types: [
          {
            description: "Markdown files",
            accept: { "text/markdown": [".md"] },
          },
        ],
      });
      fileHandleRef.current = handle;
      setFilename(handle.name);
      await writeToHandle(handle, latestContentRef.current);
    } catch {
      // User cancelled
    }
  }, [isSupported, filename, writeToHandle]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, []);

  return {
    filename,
    content,
    saveState,
    openFile,
    saveFileAs,
    updateContent,
    isSupported,
  };
}
```

- [ ] **Step 2: Commit hook**

```bash
mkdir -p src/client/hooks
git add src/client/hooks/use-file.ts
git commit -m "feat: add useFile hook with File System Access API and auto-save"
```

---

### Task 9: Wire file handling into App + zen mode

**Files:**
- Modify: `src/client/App.tsx`
- Create: `src/client/hooks/use-zen-mode.ts`

- [ ] **Step 1: Create zen mode hook**

`src/client/hooks/use-zen-mode.ts`:
```ts
import { useState, useEffect, useCallback } from "react";

export function useZenMode() {
  const [zenMode, setZenMode] = useState(() => {
    return localStorage.getItem("loupe-zen-mode") === "true";
  });

  const toggle = useCallback(() => {
    setZenMode((prev) => {
      const next = !prev;
      localStorage.setItem("loupe-zen-mode", String(next));
      return next;
    });
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === ".") {
        e.preventDefault();
        toggle();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [toggle]);

  return { zenMode, toggle };
}
```

- [ ] **Step 2: Update App.tsx to use file and zen mode hooks**

Update `src/client/App.tsx` to integrate `useFile` and `useZenMode`. Replace the placeholder state with the real hooks. Wire `Cmd+O` to `openFile`, `Cmd+S` to `saveFileAs` (for untitled) or force-flush. Pass the file's content as `defaultValue` to the Editor. On `onChange`, call `updateContent` which triggers auto-save.

- [ ] **Step 3: Verify file open + save + zen mode work**

```bash
bunx vite --open
```
Expected: Can open a `.md` file, edit it, see auto-save, toggle zen mode with `Cmd+.`

- [ ] **Step 4: Commit**

```bash
git add src/client/App.tsx src/client/hooks/use-zen-mode.ts
git commit -m "feat: wire file handling and zen mode into App"
```

---

## Chunk 2: Bun Server & Lens Backend

### Task 10: Document store

**Files:**
- Create: `src/server/document.ts`
- Create: `tests/server/document.test.ts`

- [ ] **Step 1: Write failing tests**

`tests/server/document.test.ts`:
```ts
import { describe, it, expect, beforeEach } from "vitest";
import { DocumentStore } from "../../src/server/document";

describe("DocumentStore", () => {
  let store: DocumentStore;

  beforeEach(() => {
    store = new DocumentStore();
  });

  it("starts with empty content and version 0", () => {
    expect(store.get().content).toBe("");
    expect(store.get().version).toBe(0);
  });

  it("updates content and version", () => {
    store.update({ content: "hello", version: 1 });
    expect(store.get().content).toBe("hello");
    expect(store.get().version).toBe(1);
  });

  it("rejects stale updates (version <= current)", () => {
    store.update({ content: "v1", version: 1 });
    store.update({ content: "stale", version: 1 });
    expect(store.get().content).toBe("v1");
  });

  it("stores cursor and selection", () => {
    store.update({ content: "text", version: 1, cursor: 4, selection: { from: 0, to: 4 } });
    const state = store.get();
    expect(state.cursor).toBe(4);
    expect(state.selection).toEqual({ from: 0, to: 4 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
bunx vitest run tests/server/document.test.ts
```
Expected: FAIL

- [ ] **Step 3: Implement DocumentStore**

`src/server/document.ts`:
```ts
import type { DocumentState, DocumentSyncBody } from "@shared/types";

export class DocumentStore {
  private state: DocumentState = {
    content: "",
    version: 0,
  };

  get(): DocumentState {
    return { ...this.state };
  }

  update(body: DocumentSyncBody): boolean {
    if (body.version <= this.state.version) return false;

    this.state = {
      content: body.content,
      version: body.version,
      cursor: body.cursor,
      selection: body.selection,
    };
    return true;
  }

  reset(): void {
    this.state = { content: "", version: 0 };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
bunx vitest run tests/server/document.test.ts
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/server/document.ts tests/server/document.test.ts
git commit -m "feat: add DocumentStore with version-gated updates"
```

---

### Task 11: LENS.md parser

**Files:**
- Create: `src/server/lens-loader.ts`
- Create: `tests/server/lens-loader.test.ts`

- [ ] **Step 1: Write failing tests**

`tests/server/lens-loader.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { parseLensMd } from "../../src/server/lens-loader";

describe("parseLensMd", () => {
  it("parses valid LENS.md with all fields", () => {
    const raw = `---
name: Heidegger
icon: H
color: "#7c3aed"
description: Phenomenological perspective
model: claude-haiku-4-5-20251001
---

You are Heidegger. Think about being.`;

    const result = parseLensMd(raw, "heidegger");
    expect(result).not.toBeNull();
    expect(result!.name).toBe("Heidegger");
    expect(result!.icon).toBe("H");
    expect(result!.color).toBe("#7c3aed");
    expect(result!.description).toBe("Phenomenological perspective");
    expect(result!.model).toBe("claude-haiku-4-5-20251001");
    expect(result!.systemPrompt).toBe("You are Heidegger. Think about being.");
    expect(result!.source).toBe("user");
    expect(result!.id).toBe("heidegger");
  });

  it("uses defaults for optional fields", () => {
    const raw = `---
name: Zen Master
description: Minimal wisdom
---

Be still.`;

    const result = parseLensMd(raw, "zen-master");
    expect(result).not.toBeNull();
    expect(result!.icon).toBe("Z"); // first letter of name
    expect(result!.color).toMatch(/^#[0-9a-f]{6}$/);
    expect(result!.model).toBeUndefined();
  });

  it("returns null for missing required fields", () => {
    const raw = `---
name: Incomplete
---

No description.`;

    expect(parseLensMd(raw, "incomplete")).toBeNull();
  });

  it("returns null for missing frontmatter", () => {
    expect(parseLensMd("Just text, no frontmatter.", "bad")).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
bunx vitest run tests/server/lens-loader.test.ts
```
Expected: FAIL

- [ ] **Step 3: Implement lens loader**

`src/server/lens-loader.ts`:
```ts
import type { LensDefinition } from "@shared/types";
import { readdir } from "fs/promises";
import { join } from "path";

export function parseLensMd(raw: string, id: string): LensDefinition | null {
  const fmMatch = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!fmMatch) return null;

  const frontmatter = fmMatch[1];
  const body = fmMatch[2].trim();

  const fields: Record<string, string> = {};
  for (const line of frontmatter.split("\n")) {
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    const value = line.slice(colonIdx + 1).trim().replace(/^["']|["']$/g, "");
    fields[key] = value;
  }

  if (!fields.name || !fields.description) return null;

  // Generate a deterministic muted color from the id
  const defaultColor = "#" + Array.from(id)
    .reduce((hash, char) => ((hash << 5) - hash + char.charCodeAt(0)) | 0, 0)
    .toString(16)
    .slice(-6)
    .padStart(6, "8");

  return {
    id,
    name: fields.name,
    icon: fields.icon || fields.name[0],
    color: fields.color || defaultColor,
    description: fields.description,
    systemPrompt: body,
    model: fields.model || undefined,
    source: "user",
  };
}

export async function loadUserLenses(lensesDir: string): Promise<LensDefinition[]> {
  const lenses: LensDefinition[] = [];

  try {
    const entries = await readdir(lensesDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const lensPath = join(lensesDir, entry.name, "LENS.md");
      try {
        const raw = await Bun.file(lensPath).text();
        const lens = parseLensMd(raw, entry.name);
        if (lens) {
          lenses.push(lens);
        } else {
          console.warn(`Skipping malformed LENS.md: ${lensPath}`);
        }
      } catch {
        // No LENS.md in this directory — skip silently
      }
    }
  } catch {
    // lenses/ directory doesn't exist — that's fine
  }

  return lenses;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
bunx vitest run tests/server/lens-loader.test.ts
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/server/lens-loader.ts tests/server/lens-loader.test.ts
git commit -m "feat: add LENS.md parser and directory loader"
```

---

### Task 12: Lens session (Anthropic SDK conversation)

**Files:**
- Create: `src/server/lens-session.ts`
- Create: `tests/server/lens-session.test.ts`

- [ ] **Step 1: Write failing tests**

`tests/server/lens-session.test.ts` — test the session's message building and state management (mock the Anthropic SDK):
```ts
import { describe, it, expect, beforeEach } from "vitest";
import { LensSession } from "../../src/server/lens-session";
import type { LensDefinition } from "../../src/shared/types";

const testLens: LensDefinition = {
  id: "test",
  name: "Test Lens",
  icon: "T",
  color: "#ff0000",
  description: "A test lens",
  systemPrompt: "You are a test lens.",
  source: "preset",
};

describe("LensSession", () => {
  let session: LensSession;

  beforeEach(() => {
    session = new LensSession(testLens, "claude-sonnet-4-6");
  });

  it("starts idle with empty history", () => {
    expect(session.status).toBe("idle");
    expect(session.history).toHaveLength(0);
  });

  it("builds system prompt from lens definition", () => {
    const system = session.buildSystemPrompt("Hello world document.");
    expect(system).toContain("You are a test lens.");
    expect(system).toContain("Hello world document.");
  });

  it("builds system prompt with focus", () => {
    const system = session.buildSystemPrompt("Full doc.", "Focused paragraph.");
    expect(system).toContain("Full doc.");
    expect(system).toContain("Focused paragraph.");
  });

  it("resets history and state", () => {
    session.addToHistory("user", "hello");
    session.addToHistory("lens", "hi back");
    expect(session.history).toHaveLength(2);

    session.reset();
    expect(session.history).toHaveLength(0);
    expect(session.status).toBe("idle");
  });

  it("tracks the effective model (per-lens or default)", () => {
    expect(session.model).toBe("claude-sonnet-4-6");

    const lensWithModel = { ...testLens, model: "claude-haiku-4-5-20251001" };
    const session2 = new LensSession(lensWithModel, "claude-sonnet-4-6");
    expect(session2.model).toBe("claude-haiku-4-5-20251001");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
bunx vitest run tests/server/lens-session.test.ts
```
Expected: FAIL

- [ ] **Step 3: Implement LensSession**

`src/server/lens-session.ts`:
```ts
import Anthropic from "@anthropic-ai/sdk";
import type { LensDefinition, LensStatus, ChatMessage } from "@shared/types";

export class LensSession {
  readonly definition: LensDefinition;
  readonly model: string;
  status: LensStatus = "idle";
  history: ChatMessage[] = [];
  preview: string | null = null;

  private client: Anthropic | null = null;

  constructor(definition: LensDefinition, defaultModel: string) {
    this.definition = definition;
    this.model = definition.model || defaultModel;
  }

  buildSystemPrompt(documentContent: string, focusedParagraph?: string): string {
    let prompt = this.definition.systemPrompt;
    prompt += `\n\nYou are reading the following document:\n\n${documentContent}`;
    if (focusedParagraph) {
      prompt += `\n\nThe writer is currently focused on this passage:\n\n${focusedParagraph}`;
    }
    return prompt;
  }

  addToHistory(role: "user" | "lens", content: string): void {
    this.history.push({ role, content });
  }

  reset(): void {
    this.history = [];
    this.status = "idle";
    this.preview = null;
  }

  private getClient(): Anthropic {
    if (!this.client) {
      this.client = new Anthropic();
    }
    return this.client;
  }

  async *stream(
    documentContent: string,
    userMessage: string,
    focusedParagraph?: string
  ): AsyncGenerator<{ type: "delta"; text: string } | { type: "done" } | { type: "error"; error: string }> {
    this.status = "thinking";

    try {
      const client = this.getClient();
      const systemPrompt = this.buildSystemPrompt(documentContent, focusedParagraph);

      // Build messages from history + new user message
      const messages: Anthropic.MessageParam[] = this.history.map((msg) => ({
        role: msg.role === "lens" ? "assistant" as const : "user" as const,
        content: msg.content,
      }));
      messages.push({ role: "user", content: userMessage });

      const stream = client.messages.stream({
        model: this.model,
        max_tokens: 1024,
        system: systemPrompt,
        messages,
      });

      let fullResponse = "";

      for await (const event of stream) {
        if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
          fullResponse += event.delta.text;
          yield { type: "delta", text: event.delta.text };
        }
      }

      // Save to history
      this.addToHistory("user", userMessage);
      this.addToHistory("lens", fullResponse);
      this.preview = fullResponse.slice(0, 120);
      this.status = "idle";
      yield { type: "done" };
    } catch (err) {
      this.status = "error";
      const errorMsg = err instanceof Error ? err.message : "Unknown error";
      yield { type: "error", error: errorMsg };
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
bunx vitest run tests/server/lens-session.test.ts
```
Expected: PASS (only state/message-building tests, streaming tests would need SDK mock)

- [ ] **Step 5: Commit**

```bash
git add src/server/lens-session.ts tests/server/lens-session.test.ts
git commit -m "feat: add LensSession with Anthropic SDK streaming"
```

---

### Task 13: Lens manager

**Files:**
- Create: `src/server/lens-manager.ts`
- Create: `tests/server/lens-manager.test.ts`

- [ ] **Step 1: Write failing tests**

`tests/server/lens-manager.test.ts`:
```ts
import { describe, it, expect, beforeEach } from "vitest";
import { LensManager } from "../../src/server/lens-manager";
import { LENS_PRESETS } from "../../src/shared/lens-presets";

describe("LensManager", () => {
  let manager: LensManager;

  beforeEach(() => {
    manager = new LensManager(LENS_PRESETS, "claude-sonnet-4-6");
  });

  it("lists available lenses (presets + user)", () => {
    expect(manager.availableLenses()).toHaveLength(5);
  });

  it("activates a lens and returns session id", () => {
    const id = manager.activate("devils-advocate");
    expect(id).toBeTruthy();
    expect(manager.activeSessions()).toHaveLength(1);
  });

  it("refuses to activate more than 5 lenses", () => {
    manager.activate("devils-advocate");
    manager.activate("intuition-pump");
    manager.activate("first-principles");
    manager.activate("empathetic-reader");
    manager.activate("copy-editor");
    expect(() => manager.activate("devils-advocate")).toThrow("Maximum 5 concurrent lenses");
  });

  it("deactivates a lens", () => {
    const id = manager.activate("devils-advocate");
    manager.deactivate(id);
    expect(manager.activeSessions()).toHaveLength(0);
  });

  it("throws on unknown lens definition", () => {
    expect(() => manager.activate("nonexistent")).toThrow();
  });

  it("resets all sessions", () => {
    manager.activate("devils-advocate");
    manager.activate("intuition-pump");
    manager.resetAll();
    expect(manager.activeSessions()).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
bunx vitest run tests/server/lens-manager.test.ts
```
Expected: FAIL

- [ ] **Step 3: Implement LensManager**

`src/server/lens-manager.ts`:
```ts
import type { LensDefinition, ActiveLens } from "@shared/types";
import { LensSession } from "./lens-session";
import { nanoid } from "nanoid";

const MAX_LENSES = 5;

export class LensManager {
  private definitions: Map<string, LensDefinition>;
  private sessions: Map<string, LensSession> = new Map();
  private defaultModel: string;

  constructor(lenses: LensDefinition[], defaultModel: string) {
    this.definitions = new Map(lenses.map((l) => [l.id, l]));
    this.defaultModel = defaultModel;
  }

  addDefinitions(lenses: LensDefinition[]): void {
    for (const lens of lenses) {
      this.definitions.set(lens.id, lens);
    }
  }

  availableLenses(): LensDefinition[] {
    return Array.from(this.definitions.values());
  }

  activate(definitionId: string): string {
    if (this.sessions.size >= MAX_LENSES) {
      throw new Error("Maximum 5 concurrent lenses");
    }

    const definition = this.definitions.get(definitionId);
    if (!definition) {
      throw new Error(`Unknown lens: ${definitionId}`);
    }

    const lensId = nanoid(8);
    const session = new LensSession(definition, this.defaultModel);
    this.sessions.set(lensId, session);
    return lensId;
  }

  deactivate(lensId: string): void {
    this.sessions.delete(lensId);
  }

  getSession(lensId: string): LensSession | undefined {
    return this.sessions.get(lensId);
  }

  activeSessions(): ActiveLens[] {
    return Array.from(this.sessions.entries()).map(([lensId, session]) => ({
      lensId,
      definitionId: session.definition.id,
      status: session.status,
      preview: session.preview,
      error: null,
    }));
  }

  resetAll(): void {
    this.sessions.clear();
  }
}
```

`nanoid` is already included in Task 1 Step 2 dependencies.

- [ ] **Step 4: Run test to verify it passes**

```bash
bunx vitest run tests/server/lens-manager.test.ts
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/server/lens-manager.ts tests/server/lens-manager.test.ts
git commit -m "feat: add LensManager with activation limits and session lifecycle"
```

---

### Task 14: Server routes and SSE

**Files:**
- Create: `src/server/routes.ts`
- Create: `src/server/index.ts`

- [ ] **Step 1: Create route handler**

`src/server/routes.ts` — handles REST endpoints and SSE. The SSE implementation keeps a set of response writers and broadcasts lens events to all connected clients.

```ts
import type { Server } from "bun";
import type { DocumentSyncBody, LensFocusBody, LensAskBody, SSEEvent } from "@shared/types";
import { DocumentStore } from "./document";
import { LensManager } from "./lens-manager";

export class RouteHandler {
  private sseClients: Set<ReadableStreamDefaultController> = new Set();

  constructor(
    private document: DocumentStore,
    private lensManager: LensManager
  ) {}

  async handle(req: Request): Promise<Response | null> {
    const url = new URL(req.url);

    // SSE endpoint
    if (url.pathname === "/api/events" && req.method === "GET") {
      return this.handleSSE();
    }

    // Document sync
    if (url.pathname === "/api/document" && req.method === "POST") {
      const body: DocumentSyncBody = await req.json();
      this.document.update(body);
      return Response.json({ ok: true });
    }

    // List available lenses
    if (url.pathname === "/api/lenses" && req.method === "GET") {
      return Response.json({
        available: this.lensManager.availableLenses(),
        active: this.lensManager.activeSessions(),
      });
    }

    // Activate lens
    if (url.pathname === "/api/lenses/activate" && req.method === "POST") {
      const { definitionId } = await req.json();
      try {
        const lensId = this.lensManager.activate(definitionId);
        return Response.json({ lensId });
      } catch (err) {
        return Response.json({ error: (err as Error).message }, { status: 400 });
      }
    }

    // Deactivate lens
    const deactivateMatch = url.pathname.match(/^\/api\/lens\/([^/]+)\/deactivate$/);
    if (deactivateMatch && req.method === "POST") {
      this.lensManager.deactivate(deactivateMatch[1]);
      this.broadcast({ type: "lens:removed", lensId: deactivateMatch[1] });
      return Response.json({ ok: true });
    }

    // Lens focus
    const focusMatch = url.pathname.match(/^\/api\/lens\/([^/]+)\/focus$/);
    if (focusMatch && req.method === "POST") {
      const body: LensFocusBody = await req.json();
      this.handleLensStream(focusMatch[1], "Please share your thoughts on this passage.", body.paragraphText);
      return Response.json({ ok: true });
    }

    // Lens ask
    const askMatch = url.pathname.match(/^\/api\/lens\/([^/]+)\/ask$/);
    if (askMatch && req.method === "POST") {
      const body: LensAskBody = await req.json();
      this.handleLensStream(askMatch[1], body.message);
      return Response.json({ ok: true });
    }

    // Lens rethink
    const rethinkMatch = url.pathname.match(/^\/api\/lens\/([^/]+)\/rethink$/);
    if (rethinkMatch && req.method === "POST") {
      this.handleLensStream(rethinkMatch[1], "I've updated the document. What do you think now?");
      return Response.json({ ok: true });
    }

    // Lens reset
    const resetMatch = url.pathname.match(/^\/api\/lens\/([^/]+)\/reset$/);
    if (resetMatch && req.method === "POST") {
      const session = this.lensManager.getSession(resetMatch[1]);
      if (session) session.reset();
      return Response.json({ ok: true });
    }

    return null; // Not an API route
  }

  private handleSSE(): Response {
    const self = this;
    const stream = new ReadableStream({
      start(controller) {
        self.sseClients.add(controller);
        // Send initial active lenses
        const active = self.lensManager.activeSessions();
        const data = JSON.stringify({ type: "init", active });
        controller.enqueue(new TextEncoder().encode(`data: ${data}\n\n`));
      },
      cancel(controller) {
        self.sseClients.delete(controller);
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  }

  private broadcast(event: SSEEvent): void {
    const data = JSON.stringify(event);
    const encoded = new TextEncoder().encode(`data: ${data}\n\n`);
    for (const client of this.sseClients) {
      try {
        client.enqueue(encoded);
      } catch {
        this.sseClients.delete(client);
      }
    }
  }

  private async handleLensStream(lensId: string, userMessage: string, focusedParagraph?: string): Promise<void> {
    const session = this.lensManager.getSession(lensId);
    if (!session) return;

    const doc = this.document.get();
    this.broadcast({ type: "lens:thinking", lensId });

    for await (const chunk of session.stream(doc.content, userMessage, focusedParagraph)) {
      if (chunk.type === "delta") {
        this.broadcast({ type: "lens:message", lensId, delta: chunk.text, done: false });
      } else if (chunk.type === "done") {
        this.broadcast({ type: "lens:message", lensId, delta: "", done: true });
      } else if (chunk.type === "error") {
        this.broadcast({ type: "lens:error", lensId, error: chunk.error });
      }
    }
  }
}
```

- [ ] **Step 2: Create server entry point**

`src/server/index.ts`:
```ts
import { DocumentStore } from "./document";
import { LensManager } from "./lens-manager";
import { RouteHandler } from "./routes";
import { LENS_PRESETS } from "@shared/lens-presets";
import { loadUserLenses } from "./lens-loader";
import { join } from "path";

const PORT = Number(process.env.LOUPE_PORT) || 4460;
const MODEL = process.env.LOUPE_MODEL || "claude-sonnet-4-6";
const LENSES_DIR = join(process.cwd(), "lenses");

export async function startServer() {
  // Load user lenses from lenses/ directory
  const userLenses = await loadUserLenses(LENSES_DIR);
  console.log(`Loaded ${userLenses.length} user lens(es)`);

  const document = new DocumentStore();
  const lensManager = new LensManager([...LENS_PRESETS, ...userLenses], MODEL);
  const router = new RouteHandler(document, lensManager);

  // In production, serve Vite-built static files
  const distDir = join(import.meta.dir, "../../dist");

  const server = Bun.serve({
    port: PORT,
    async fetch(req) {
      // Try API routes first
      const apiResponse = await router.handle(req);
      if (apiResponse) return apiResponse;

      // Serve static files from dist/
      const url = new URL(req.url);
      let filePath = join(distDir, url.pathname === "/" ? "index.html" : url.pathname);

      const file = Bun.file(filePath);
      if (await file.exists()) return new Response(file);

      // SPA fallback
      return new Response(Bun.file(join(distDir, "index.html")));
    },
  });

  console.log(`Loupe server running at http://localhost:${server.port}`);
  return server;
}
```

- [ ] **Step 3: Commit server**

```bash
git add src/server/routes.ts src/server/index.ts
git commit -m "feat: add Bun server with REST routes and SSE broadcasting"
```

---

### Task 15: CLI entry point

**Files:**
- Create: `cli.ts`
- Modify: `package.json` (add `bin` and `scripts`)

- [ ] **Step 1: Create CLI entry**

`cli.ts`:
```ts
import { startServer } from "./src/server/index";

const args = process.argv.slice(2);
const filePath = args.find((a) => !a.startsWith("-"));

const server = await startServer();
const url = `http://localhost:${server.port}${filePath ? `?file=${encodeURIComponent(filePath)}` : ""}`;

// Open browser
const { $ } = await import("bun");
try {
  await $`open ${url}`.quiet();
} catch {
  console.log(`Open ${url} in your browser`);
}

// Keep process alive
process.on("SIGINT", () => {
  console.log("\nLoupe stopped.");
  process.exit(0);
});
```

- [ ] **Step 2: Add scripts and bin to package.json**

Add to `package.json`:
```json
{
  "bin": {
    "loupe": "cli.ts"
  },
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "start": "bun run cli.ts",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

- [ ] **Step 3: Verify full server + client dev flow**

```bash
# Terminal 1: start Bun server (API)
bun run start

# Terminal 2: start Vite dev server (client with proxy)
bun run dev
```

Expected: Vite proxies `/api/*` to Bun. Editor renders. API endpoints respond.

- [ ] **Step 4: Commit**

```bash
git add cli.ts package.json
git commit -m "feat: add CLI entry point and project scripts"
```

---

## Chunk 3: Client-Side Lens Integration

### Task 16: SSE hook

**Files:**
- Create: `src/client/hooks/use-sse.ts`

- [ ] **Step 1: Implement SSE hook with auto-reconnect**

`src/client/hooks/use-sse.ts`:
```ts
import { useEffect, useRef, useCallback } from "react";
import type { SSEEvent } from "@shared/types";

export function useSSE(onEvent: (event: SSEEvent | { type: "init"; active: any[] }) => void) {
  const eventSourceRef = useRef<EventSource | null>(null);
  const retriesRef = useRef(0);
  const maxRetries = 10;

  const connect = useCallback(() => {
    const es = new EventSource("/api/events");

    es.onmessage = (e) => {
      try {
        const event = JSON.parse(e.data);
        onEvent(event);
        retriesRef.current = 0; // Reset on successful message
      } catch {
        // Ignore parse errors
      }
    };

    es.onerror = () => {
      es.close();
      eventSourceRef.current = null;

      if (retriesRef.current < maxRetries) {
        const delay = Math.min(1000 * 2 ** retriesRef.current, 30000);
        retriesRef.current++;
        setTimeout(connect, delay);
      }
    };

    eventSourceRef.current = es;
  }, [onEvent]);

  useEffect(() => {
    connect();
    return () => {
      eventSourceRef.current?.close();
    };
  }, [connect]);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/client/hooks/use-sse.ts
git commit -m "feat: add SSE hook with exponential backoff reconnect"
```

---

### Task 17: Lens state hook

**Files:**
- Create: `src/client/hooks/use-lenses.ts`

- [ ] **Step 1: Implement lens state management hook**

`src/client/hooks/use-lenses.ts` — manages all client-side lens state: active lenses, streaming messages, activation/deactivation, and triggers.

```ts
import { useState, useCallback, useRef } from "react";
import type {
  LensDefinition,
  ActiveLens,
  ChatMessage,
  SSEEvent,
} from "@shared/types";

interface LensUIState extends ActiveLens {
  messages: ChatMessage[];
  streamingContent: string;
  expanded: boolean;
}

export function useLenses() {
  const [available, setAvailable] = useState<LensDefinition[]>([]);
  const [lenses, setLenses] = useState<Map<string, LensUIState>>(new Map());
  const [pickerOpen, setPickerOpen] = useState(false);

  // Fetch available lenses on mount
  const fetchLenses = useCallback(async () => {
    const res = await fetch("/api/lenses");
    const data = await res.json();
    setAvailable(data.available);
  }, []);

  const activate = useCallback(async (definitionId: string) => {
    const res = await fetch("/api/lenses/activate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ definitionId }),
    });
    const { lensId, error } = await res.json();
    if (error) return;

    const def = available.find((d) => d.id === definitionId);
    if (!def) return;

    setLenses((prev) => {
      const next = new Map(prev);
      next.set(lensId, {
        lensId,
        definitionId,
        status: "idle",
        preview: null,
        error: null,
        messages: [],
        streamingContent: "",
        expanded: false,
      });
      return next;
    });
  }, [available]);

  const deactivate = useCallback(async (lensId: string) => {
    await fetch(`/api/lens/${lensId}/deactivate`, { method: "POST" });
    setLenses((prev) => {
      const next = new Map(prev);
      next.delete(lensId);
      return next;
    });
  }, []);

  const ask = useCallback(async (lensId: string, message: string) => {
    // Add user message to local state immediately
    setLenses((prev) => {
      const next = new Map(prev);
      const lens = next.get(lensId);
      if (lens) {
        lens.messages = [...lens.messages, { role: "user", content: message }];
        lens.streamingContent = "";
      }
      return next;
    });

    await fetch(`/api/lens/${lensId}/ask`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });
  }, []);

  const focus = useCallback(async (lensId: string, paragraphText: string, version: number) => {
    await fetch(`/api/lens/${lensId}/focus`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paragraphText, version }),
    });
  }, []);

  const rethink = useCallback(async (lensId: string) => {
    await fetch(`/api/lens/${lensId}/rethink`, { method: "POST" });
  }, []);

  const resetLens = useCallback(async (lensId: string) => {
    await fetch(`/api/lens/${lensId}/reset`, { method: "POST" });
    setLenses((prev) => {
      const next = new Map(prev);
      const lens = next.get(lensId);
      if (lens) {
        lens.messages = [];
        lens.streamingContent = "";
        lens.preview = null;
        lens.status = "idle";
      }
      return next;
    });
  }, []);

  const toggleExpanded = useCallback((lensId: string) => {
    setLenses((prev) => {
      const next = new Map(prev);
      const lens = next.get(lensId);
      if (lens) lens.expanded = !lens.expanded;
      return next;
    });
  }, []);

  // SSE event handler
  const handleSSEEvent = useCallback(
    (event: SSEEvent | { type: "init"; active: any[] }) => {
      if (event.type === "init") return;

      setLenses((prev) => {
        const next = new Map(prev);
        const lens = next.get(event.lensId);
        if (!lens) return prev;

        switch (event.type) {
          case "lens:thinking":
            lens.status = "thinking";
            lens.streamingContent = "";
            break;
          case "lens:bubble":
            lens.preview = event.preview;
            lens.status = "idle";
            break;
          case "lens:message":
            if (event.done) {
              // Finalize: move streaming content to messages
              if (lens.streamingContent) {
                lens.messages = [
                  ...lens.messages,
                  { role: "lens", content: lens.streamingContent },
                ];
                lens.preview = lens.streamingContent.slice(0, 120);
              }
              lens.streamingContent = "";
              lens.status = "idle";
            } else {
              lens.streamingContent += event.delta;
            }
            break;
          case "lens:error":
            lens.status = "error";
            lens.error = event.error;
            break;
          case "lens:removed":
            next.delete(event.lensId);
            break;
        }

        return next;
      });
    },
    []
  );

  return {
    available,
    lenses,
    pickerOpen,
    setPickerOpen,
    fetchLenses,
    activate,
    deactivate,
    ask,
    focus,
    rethink,
    resetLens,
    toggleExpanded,
    handleSSEEvent,
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/client/hooks/use-lenses.ts
git commit -m "feat: add useLenses hook for client-side lens state management"
```

---

### Task 18: Lens bubble and chat components

**Files:**
- Create: `src/client/lenses/LensBubble.tsx`
- Create: `src/client/lenses/LensChat.tsx`
- Create: `src/client/lenses/LensLayer.tsx`

- [ ] **Step 1: Create LensBubble component**

`src/client/lenses/LensBubble.tsx` — collapsed bubble showing avatar, state, and preview. Click to expand. "x" to dismiss.

```tsx
import type { LensDefinition, LensStatus } from "@shared/types";

interface LensBubbleProps {
  lensId: string;
  definition: LensDefinition;
  status: LensStatus;
  preview: string | null;
  onClick: () => void;
  onDismiss: () => void;
}

export function LensBubble({
  definition,
  status,
  preview,
  onClick,
  onDismiss,
}: LensBubbleProps) {
  return (
    <div className="flex flex-col items-end gap-1.5 max-w-[240px] group">
      {/* Avatar row */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] opacity-70" style={{ color: definition.color }}>
          {definition.name}
        </span>
        <button
          onClick={onClick}
          className="w-8 h-8 rounded-full flex items-center justify-center text-sm
                     transition-all cursor-pointer"
          style={{
            background: `${definition.color}22`,
            border: `1.5px solid ${definition.color}55`,
            color: definition.color,
            boxShadow: status === "thinking"
              ? `0 0 12px ${definition.color}40`
              : "none",
            animation: status === "thinking" ? "pulse 2s infinite" : "none",
          }}
        >
          {definition.icon}
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDismiss(); }}
          className="opacity-0 group-hover:opacity-60 text-xs transition-opacity cursor-pointer"
          style={{ color: "var(--loupe-text-muted)" }}
        >
          x
        </button>
      </div>

      {/* Preview bubble */}
      {preview && status === "idle" && (
        <button
          onClick={onClick}
          className="text-left rounded-xl px-3 py-2 text-xs leading-relaxed cursor-pointer
                     transition-opacity hover:opacity-90 max-w-full"
          style={{
            background: `${definition.color}12`,
            border: `1px solid ${definition.color}20`,
            color: `${definition.color}cc`,
          }}
        >
          {preview.length > 100 ? preview.slice(0, 100) + "..." : preview}
        </button>
      )}

      {/* Thinking indicator */}
      {status === "thinking" && (
        <div
          className="rounded-xl px-3 py-2 text-[9px] uppercase tracking-wider"
          style={{
            background: `${definition.color}12`,
            border: `1px solid ${definition.color}20`,
            color: definition.color,
          }}
        >
          thinking...
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create LensChat component**

`src/client/lenses/LensChat.tsx` — expanded floating chat card with message history, streaming, input, and action buttons.

```tsx
import { useState, useRef, useEffect } from "react";
import type { LensDefinition, ChatMessage } from "@shared/types";

interface LensChatProps {
  lensId: string;
  definition: LensDefinition;
  messages: ChatMessage[];
  streamingContent: string;
  isThinking: boolean;
  onAsk: (message: string) => void;
  onFocus: () => void;
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
  onFocus,
  onRethink,
  onReset,
  onClose,
}: LensChatProps) {
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streamingContent]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isThinking) return;
    onAsk(input.trim());
    setInput("");
  };

  return (
    <div
      className="w-[280px] rounded-xl overflow-hidden flex flex-col max-h-[400px]"
      style={{
        background: "var(--loupe-surface)",
        border: `1px solid ${definition.color}30`,
        boxShadow: `0 4px 24px rgba(0,0,0,0.3)`,
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-2 border-b"
        style={{ borderColor: `${definition.color}20` }}
      >
        <div className="flex items-center gap-2">
          <span
            className="w-6 h-6 rounded-full flex items-center justify-center text-xs"
            style={{ background: `${definition.color}22`, color: definition.color }}
          >
            {definition.icon}
          </span>
          <span className="text-sm font-medium" style={{ color: definition.color }}>
            {definition.name}
          </span>
        </div>
        <button
          onClick={onClose}
          className="text-xs opacity-60 hover:opacity-100 transition-opacity cursor-pointer"
          style={{ color: "var(--loupe-text-muted)" }}
        >
          x
        </button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`text-xs leading-relaxed ${
              msg.role === "user" ? "text-right" : ""
            }`}
          >
            <span
              className="inline-block rounded-lg px-2.5 py-1.5 max-w-[90%]"
              style={
                msg.role === "user"
                  ? { background: "var(--loupe-border)", color: "var(--loupe-text)" }
                  : { background: `${definition.color}12`, color: `${definition.color}cc` }
              }
            >
              {msg.content}
            </span>
          </div>
        ))}

        {/* Streaming content */}
        {streamingContent && (
          <div className="text-xs leading-relaxed">
            <span
              className="inline-block rounded-lg px-2.5 py-1.5"
              style={{ background: `${definition.color}12`, color: `${definition.color}cc` }}
            >
              {streamingContent}
            </span>
          </div>
        )}

        {isThinking && !streamingContent && (
          <div className="text-[10px] uppercase tracking-wider" style={{ color: definition.color }}>
            thinking...
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex gap-1.5 px-3 py-1.5 border-t" style={{ borderColor: "var(--loupe-border)" }}>
        <button
          onClick={onFocus}
          className="text-[10px] px-2 py-1 rounded cursor-pointer hover:opacity-80"
          style={{ background: `${definition.color}15`, color: `${definition.color}aa` }}
        >
          Focus here
        </button>
        <button
          onClick={onRethink}
          className="text-[10px] px-2 py-1 rounded cursor-pointer hover:opacity-80"
          style={{ background: `${definition.color}15`, color: `${definition.color}aa` }}
        >
          What now?
        </button>
        <button
          onClick={onReset}
          className="text-[10px] px-2 py-1 rounded cursor-pointer hover:opacity-80"
          style={{ background: "var(--loupe-border)", color: "var(--loupe-text-muted)" }}
        >
          Reset
        </button>
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="px-3 py-2 border-t" style={{ borderColor: "var(--loupe-border)" }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask this lens..."
          disabled={isThinking}
          className="w-full text-xs bg-transparent outline-none placeholder:opacity-40"
          style={{ color: "var(--loupe-text)" }}
        />
      </form>
    </div>
  );
}
```

- [ ] **Step 3: Create LensLayer component**

`src/client/lenses/LensLayer.tsx` — positions all active lens bubbles/chats in the right margin.

```tsx
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
  onFocus: (lensId: string) => void;
  onRethink: (lensId: string) => void;
  onReset: (lensId: string) => void;
}

export function LensLayer({
  lenses,
  definitions,
  onToggleExpanded,
  onDismiss,
  onAsk,
  onFocus,
  onRethink,
  onReset,
}: LensLayerProps) {
  const entries = Array.from(lenses.entries());
  if (entries.length === 0) return null;

  return (
    <div className="fixed right-6 top-20 bottom-6 w-[280px] flex flex-col gap-4 pointer-events-none z-10">
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
                onFocus={() => onFocus(lensId)}
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
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Commit lens UI components**

```bash
mkdir -p src/client/lenses
git add src/client/lenses/LensBubble.tsx src/client/lenses/LensChat.tsx src/client/lenses/LensLayer.tsx
git commit -m "feat: add LensBubble, LensChat, and LensLayer UI components"
```

---

### Task 19: Lens picker modal

**Files:**
- Create: `src/client/chrome/LensPicker.tsx`

- [ ] **Step 1: Create LensPicker component**

`src/client/chrome/LensPicker.tsx`:
```tsx
import type { LensDefinition } from "@shared/types";

interface LensPickerProps {
  available: LensDefinition[];
  activeLensCount: number;
  onActivate: (definitionId: string) => void;
  onClose: () => void;
}

export function LensPicker({ available, activeLensCount, onActivate, onClose }: LensPickerProps) {
  const atLimit = activeLensCount >= 5;
  const presets = available.filter((l) => l.source === "preset");
  const userLenses = available.filter((l) => l.source === "user");

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" />

      {/* Modal */}
      <div
        className="relative w-[400px] max-h-[500px] overflow-y-auto rounded-xl p-6"
        style={{ background: "var(--loupe-surface)", border: "1px solid var(--loupe-border)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-medium" style={{ color: "var(--loupe-text)" }}>
            Choose a Lens
          </h2>
          <button
            onClick={onClose}
            className="text-sm opacity-60 hover:opacity-100 cursor-pointer"
            style={{ color: "var(--loupe-text-muted)" }}
          >
            esc
          </button>
        </div>

        {atLimit && (
          <p className="text-xs mb-4" style={{ color: "var(--loupe-text-muted)" }}>
            Maximum 5 lenses active. Dismiss one to add another.
          </p>
        )}

        {/* Presets */}
        <div className="mb-4">
          <h3 className="text-xs uppercase tracking-wider mb-2" style={{ color: "var(--loupe-text-dim)" }}>
            Built-in
          </h3>
          <div className="space-y-2">
            {presets.map((lens) => (
              <LensEntry
                key={lens.id}
                lens={lens}
                disabled={atLimit}
                onActivate={() => { onActivate(lens.id); onClose(); }}
              />
            ))}
          </div>
        </div>

        {/* User lenses */}
        {userLenses.length > 0 && (
          <div>
            <h3 className="text-xs uppercase tracking-wider mb-2" style={{ color: "var(--loupe-text-dim)" }}>
              Your Lenses
            </h3>
            <div className="space-y-2">
              {userLenses.map((lens) => (
                <LensEntry
                  key={lens.id}
                  lens={lens}
                  disabled={atLimit}
                  onActivate={() => { onActivate(lens.id); onClose(); }}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function LensEntry({
  lens,
  disabled,
  onActivate,
}: {
  lens: LensDefinition;
  disabled: boolean;
  onActivate: () => void;
}) {
  return (
    <div
      className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors"
      style={{
        background: "var(--loupe-bg)",
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <span
        className="w-8 h-8 rounded-full flex items-center justify-center text-sm shrink-0"
        style={{ background: `${lens.color}22`, color: lens.color }}
      >
        {lens.icon}
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium" style={{ color: "var(--loupe-text)" }}>
          {lens.name}
        </div>
        <div className="text-xs truncate" style={{ color: "var(--loupe-text-muted)" }}>
          {lens.description}
        </div>
      </div>
      <button
        onClick={onActivate}
        disabled={disabled}
        className="text-xs px-3 py-1 rounded cursor-pointer hover:opacity-80 disabled:cursor-not-allowed shrink-0"
        style={{ background: `${lens.color}20`, color: lens.color }}
      >
        Activate
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/client/chrome/LensPicker.tsx
git commit -m "feat: add LensPicker modal with presets and user lenses"
```

---

### Task 20: Wire everything together in App.tsx

**Files:**
- Modify: `src/client/App.tsx`

- [ ] **Step 1: Rewrite App.tsx with full integration**

`src/client/App.tsx`:
```tsx
import { useEffect, useCallback, useRef } from "react";
import { Editor } from "./editor/Editor";
import { TopBar } from "./chrome/TopBar";
import { LensLayer } from "./lenses/LensLayer";
import { LensPicker } from "./chrome/LensPicker";
import { useFile } from "./hooks/use-file";
import { useZenMode } from "./hooks/use-zen-mode";
import { useLenses } from "./hooks/use-lenses";
import { useSSE } from "./hooks/use-sse";
import type { MilkdownInstance } from "./editor/milkdown-setup";

export function App() {
  const editorRef = useRef<MilkdownInstance | null>(null);
  const versionRef = useRef(0);
  const syncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { filename, saveState, openFile, saveFileAs, updateContent } = useFile();
  const { zenMode } = useZenMode();
  const lens = useLenses();

  // Connect SSE to lens state
  useSSE(lens.handleSSEEvent);

  // Fetch available lenses on mount
  useEffect(() => { lens.fetchLenses(); }, []);

  // Sync document to server (debounced)
  const syncToServer = useCallback((content: string) => {
    if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    syncTimeoutRef.current = setTimeout(() => {
      versionRef.current++;
      fetch("/api/document", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, version: versionRef.current }),
      }).catch(() => {});
    }, 1000);
  }, []);

  // Editor change handler: save to file + sync to server
  const handleEditorChange = useCallback((markdown: string) => {
    updateContent(markdown);
    syncToServer(markdown);
  }, [updateContent, syncToServer]);

  // Reset lenses when opening a new file
  const handleOpenFile = useCallback(async () => {
    await openFile();
    // Reset all active lens conversations for new document context
    for (const [lensId] of lens.lenses) {
      await lens.resetLens(lensId);
    }
  }, [openFile, lens.lenses, lens.resetLens]);

  // Keyboard shortcuts (centralized — useZenMode handles Cmd+. internally)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key === "l") {
        e.preventDefault();
        lens.setPickerOpen((prev) => !prev);
      } else if (mod && e.key === "o") {
        e.preventDefault();
        handleOpenFile();
      } else if (mod && e.key === "s") {
        e.preventDefault();
        saveFileAs();
      } else if (e.key === "Escape") {
        // Close picker or collapse any expanded lens
        if (lens.pickerOpen) {
          lens.setPickerOpen(false);
        } else {
          for (const [lensId, state] of lens.lenses) {
            if (state.expanded) { lens.toggleExpanded(lensId); break; }
          }
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleOpenFile, saveFileAs, lens.pickerOpen, lens.lenses]);

  return (
    <div className={zenMode ? "zen h-full flex flex-col" : "h-full flex flex-col"}>
      <TopBar
        filename={filename}
        activeLensCount={lens.lenses.size}
        saveState={saveState}
        onOpenLensPicker={() => lens.setPickerOpen(true)}
        onOpenFile={handleOpenFile}
      />

      <div className="editor-surface relative">
        <div className="editor-column">
          <Editor
            defaultValue=""
            onChange={handleEditorChange}
            editorRef={editorRef}
          />
        </div>

        <LensLayer
          lenses={lens.lenses}
          definitions={lens.available}
          onToggleExpanded={lens.toggleExpanded}
          onDismiss={lens.deactivate}
          onAsk={lens.ask}
          onFocus={(lensId) => {
            // Get current selection text from editor
            const selection = window.getSelection()?.toString() || "";
            lens.focus(lensId, selection, versionRef.current);
          }}
          onRethink={lens.rethink}
          onReset={lens.resetLens}
        />
      </div>

      {lens.pickerOpen && (
        <LensPicker
          available={lens.available}
          activeLensCount={lens.lenses.size}
          onActivate={lens.activate}
          onClose={() => lens.setPickerOpen(false)}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Test full integration locally**

```bash
# Build client
bun run build

# Start server (serves built client + API)
bun run start
```

Expected: Full working app — editor, file open/save, lens picker, activate a lens, chat with it, see streaming responses, zen mode toggle. Opening a new file resets all lens conversations.

- [ ] **Step 3: Commit**

```bash
git add src/client/App.tsx
git commit -m "feat: integrate all hooks and components into App shell"
```

---

### Task 21: Document sync to server

Document sync is already integrated in Task 20's `App.tsx` (the `syncToServer` callback with version counter). This task is a verification checkpoint.

**Files:**
- None (already done in Task 20)

- [ ] **Step 1: Verify document sync works**

Start the app, type in the editor, and verify via server logs or network tab that `POST /api/document` fires ~1s after typing stops with an incrementing version.

- [ ] **Step 2: Commit** (skip if nothing changed)

---

## Chunk 4: Polish & PWA

### Task 22: Auto-suggest on paragraph focus

**Files:**
- Create: `src/client/hooks/use-paragraph-focus.ts`
- Modify: `src/server/routes.ts`
- Modify: `src/client/App.tsx`

- [ ] **Step 1: Create paragraph focus detection hook**

`src/client/hooks/use-paragraph-focus.ts`:
```ts
import { useEffect, useRef } from "react";

/**
 * Detects when the user's cursor rests in a paragraph for 2+ seconds.
 * Calls onFocus with the paragraph text. Deduplicates — won't re-fire
 * for the same paragraph until cursor moves elsewhere and returns.
 */
export function useParagraphFocus(
  onFocus: (paragraphText: string) => void
) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastParagraphRef = useRef<string | null>(null);

  useEffect(() => {
    const handler = () => {
      // Clear existing timer on any selection change
      if (timerRef.current) clearTimeout(timerRef.current);

      timerRef.current = setTimeout(() => {
        const selection = window.getSelection();
        if (!selection || !selection.anchorNode) return;

        // Walk up from cursor to find the nearest block element (paragraph)
        let node: Node | null = selection.anchorNode;
        while (node && node.nodeType !== Node.ELEMENT_NODE) {
          node = node.parentNode;
        }
        if (!node) return;

        const element = node as HTMLElement;
        const block = element.closest("p, h1, h2, h3, h4, h5, h6, li, blockquote");
        if (!block) return;

        const text = block.textContent?.trim() || "";
        if (!text || text.length < 10) return; // Skip very short content

        // Deduplicate: don't re-fire for the same paragraph
        if (text === lastParagraphRef.current) return;
        lastParagraphRef.current = text;

        onFocus(text);
      }, 2000);
    };

    document.addEventListener("selectionchange", handler);
    return () => {
      document.removeEventListener("selectionchange", handler);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [onFocus]);
}
```

- [ ] **Step 2: Add auto-suggest endpoint on server**

Add to `src/server/routes.ts` a new method `handleAutoSuggest` that sends the focused paragraph to all active lenses with a short prompt and `max_tokens: 256`:

```ts
// Add to RouteHandler class:

async handleAutoSuggest(paragraphText: string): Promise<void> {
  const doc = this.document.get();
  const sessions = this.lensManager.activeSessions();

  for (const activeLens of sessions) {
    const session = this.lensManager.getSession(activeLens.lensId);
    if (!session || session.status === "thinking") continue;

    // Fire auto-suggest in background (don't await — fire and forget per lens)
    this.runAutoSuggest(activeLens.lensId, session, doc.content, paragraphText);
  }
}

private async runAutoSuggest(
  lensId: string,
  session: LensSession,
  documentContent: string,
  paragraphText: string
): Promise<void> {
  try {
    const client = new Anthropic();
    const systemPrompt = session.buildSystemPrompt(documentContent, paragraphText);

    const response = await client.messages.create({
      model: session.model,
      max_tokens: 256,
      system: systemPrompt,
      messages: [
        { role: "user", content: "Briefly share one observation about this passage — one sentence only. If nothing stands out, reply with just 'nothing'." }
      ],
    });

    const text = response.content[0]?.type === "text" ? response.content[0].text : "";
    if (text && text.toLowerCase() !== "nothing") {
      session.preview = text;
      this.broadcast({ type: "lens:bubble", lensId, preview: text });
    }
  } catch {
    // Auto-suggest failures are silent — non-critical
  }
}
```

Update the focus route handler to also call `handleAutoSuggest`:
```ts
// In the focus route handler, after the existing handleLensStream call:
this.handleAutoSuggest(body.paragraphText);
```

- [ ] **Step 3: Wire paragraph focus into App.tsx**

Add to `App.tsx`:
```tsx
import { useParagraphFocus } from "./hooks/use-paragraph-focus";

// Inside App component:
useParagraphFocus(useCallback((paragraphText: string) => {
  // Trigger auto-suggest for all active lenses
  for (const [lensId] of lens.lenses) {
    lens.focus(lensId, paragraphText, versionRef.current);
  }
}, [lens.lenses, lens.focus]));
```

- [ ] **Step 4: Test auto-suggest flow**

Start the app, activate a lens, write a paragraph, let cursor rest for 2 seconds. Expected: lens bubble shows a short preview thought.

- [ ] **Step 5: Commit**

```bash
git add src/client/hooks/use-paragraph-focus.ts src/server/routes.ts src/client/App.tsx
git commit -m "feat: add auto-suggest on paragraph focus with 2s dwell time"
```

---

### Task 23: Error states and offline handling

**Files:**
- Modify: `src/client/lenses/LensBubble.tsx`
- Modify: `src/client/chrome/TopBar.tsx`

- [ ] **Step 1: Add error state to LensBubble**

When `status === "error"`, show the error message and a "Retry" button. Style the bubble border red.

- [ ] **Step 2: Add offline detection**

Use `navigator.onLine` and `online`/`offline` events. When offline, dim all lens bubbles and show "offline" text. When back online, reconnect SSE (the hook already handles this).

- [ ] **Step 3: Add "save unavailable" state to TopBar**

When `saveState === "unavailable"`, show persistent "download to save" hint that doesn't fade.

- [ ] **Step 4: Commit**

```bash
git add src/client/lenses/LensBubble.tsx src/client/chrome/TopBar.tsx
git commit -m "feat: add error states, retry buttons, and offline handling"
```

---

### Task 24: Final PWA setup and build verification

**Files:**
- Modify: `vite.config.ts` (verify PWA config)
- Modify: `package.json` (verify scripts)
- Create: `.gitignore` update if needed

- [ ] **Step 1: Verify PWA manifest generates correctly**

```bash
bun run build
ls dist/manifest.webmanifest
```

- [ ] **Step 2: Test production build end-to-end**

```bash
bun run build && bun run start
```

Expected: App loads from built files, PWA installable, editor works, lenses work (with `ANTHROPIC_API_KEY` set).

- [ ] **Step 3: Add .gitignore entries**

Ensure `.gitignore` includes:
```
node_modules
dist
.superpowers
lenses/*
!lenses/.gitkeep
```

- [ ] **Step 4: Final commit**

```bash
git add vite.config.ts package.json .gitignore
git commit -m "feat: finalize PWA setup and production build"
```

---

### Task 25: Create sample lens and verify LENS.md loading

**Files:**
- Create: `lenses/heidegger/LENS.md` (for testing, gitignored)

- [ ] **Step 1: Create a sample lens for testing**

```bash
mkdir -p lenses/heidegger
```

`lenses/heidegger/LENS.md`:
```markdown
---
name: Heidegger
icon: H
color: "#7c3aed"
description: Phenomenological perspective on being and time
---

You are a lens embodying Martin Heidegger's philosophical perspective. When examining text, consider it through the framework of Dasein (being-there), temporality, and the question of Being. Notice when the writer touches on themes of authenticity, thrownness, or the concealment/unconcealment of truth. Respond thoughtfully and concisely — you are a companion, not a lecturer.
```

- [ ] **Step 2: Verify it loads in the lens picker**

Start the server, open the app, open lens picker. Expected: "Heidegger" appears under "Your Lenses" section with purple icon.

- [ ] **Step 3: Verify it works as a lens**

Activate Heidegger, write some text about time or existence, click "Focus here." Expected: lens responds through Heidegger's philosophical framework.

- [ ] **Step 4: Document how to create a lens**

The Heidegger lens in `lenses/` is gitignored (user lenses are personal). Add a brief section to the project README (or a `lenses/README.md` that IS tracked) explaining the LENS.md format so users know how to create their own:

```bash
cat > lenses/README.md << 'LENSEOF'
# Creating a Lens

Create a directory under `lenses/` with a `LENS.md` file:

    lenses/my-lens/LENS.md

Format:

    ---
    name: My Lens
    description: What this lens does
    icon: M          # optional, single char or emoji
    color: "#7c3aed" # optional, hex color
    model: claude-sonnet-4-6 # optional
    ---

    Your system prompt here. This defines the lens's perspective.

The lens will appear in the picker next time you start Loupe.
LENSEOF
git add lenses/README.md
git commit -m "docs: add lens creation guide"
```
