# Lens Creator Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a conversational "Lens Creator" that lets writers create custom lenses through chat, saved to `.loupe/lenses/`.

**Architecture:** The Lens Creator is a special built-in lens with `source: "system"` and `skipDocumentContext: true`. It uses the existing LensChat UI but detects `:::lens-proposal` blocks in AI responses and renders them as preview cards with a "Create" button. The server writes LENS.md files to `.loupe/lenses/` via a new endpoint.

**Tech Stack:** Bun server, React 19, Vitest

**Spec:** `docs/superpowers/specs/2026-03-30-lens-creator-design.md`

---

## Chunk 1: Server-side Foundation

### Task 1: Update types — add `skipDocumentContext` and `"system"` source

**Files:**
- Modify: `src/shared/types.ts`

- [ ] **Step 1: Update LensDefinition type**

Add `skipDocumentContext` flag and `"system"` to source union:

```typescript
export interface LensDefinition {
  id: string;
  name: string;
  icon: string;
  color: string;
  description: string;
  systemPrompt: string;
  model?: string;
  source: "preset" | "user" | "system";
  skipDocumentContext?: boolean;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/shared/types.ts
git commit -m "feat: add skipDocumentContext and system source to LensDefinition"
```

---

### Task 2: Update `buildSystemPrompt` to respect `skipDocumentContext`

**Files:**
- Modify: `src/server/lens-session.ts:72-80`
- Modify: `tests/server/lens-session.test.ts`

- [ ] **Step 1: Add test for skipDocumentContext**

Add to `tests/server/lens-session.test.ts`:

```typescript
it("skips document context when skipDocumentContext is true", () => {
  const metaLens = {
    ...testLens,
    skipDocumentContext: true,
    systemPrompt: "You help create lenses.",
  };
  const metaSession = new LensSession(metaLens, "claude-sonnet-4-6");
  const system = metaSession.buildSystemPrompt("Some document text.");
  expect(system).toBe("You help create lenses.");
  expect(system).not.toContain("Some document text");
  expect(system).not.toContain("Help them think");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bunx vitest run tests/server/lens-session.test.ts`
Expected: FAIL — system prompt still contains document text

- [ ] **Step 3: Update buildSystemPrompt**

In `src/server/lens-session.ts`, replace `buildSystemPrompt`:

```typescript
buildSystemPrompt(documentContent: string, focusedParagraph?: string): string {
  if (this.definition.skipDocumentContext) {
    return this.definition.systemPrompt;
  }
  let prompt = this.definition.systemPrompt;
  prompt += `\n\nYou are reading the following document:\n\n${documentContent}`;
  if (focusedParagraph) {
    prompt += `\n\nThe writer is currently focused on this passage:\n\n${focusedParagraph}`;
  }
  prompt += `\n\nRead the full document to understand the writer's voice and intent.\nFocus your response on the passage they're working on.\nHelp them think — don't give answers, ask the question they haven't asked yet.\n1–3 sentences unless they ask for more.`;
  return prompt;
}
```

- [ ] **Step 4: Run tests**

Run: `bunx vitest run tests/server/lens-session.test.ts`
Expected: All pass

- [ ] **Step 5: Commit**

```bash
git add src/server/lens-session.ts tests/server/lens-session.test.ts
git commit -m "feat: skipDocumentContext flag for meta-lenses"
```

---

### Task 3: Add Lens Creator preset

**Files:**
- Modify: `src/shared/lens-presets.ts`

- [ ] **Step 1: Add the Lens Creator entry**

Add to the end of the `LENS_PRESETS` array:

```typescript
{
  id: "lens-creator",
  name: "Lens Creator",
  icon: "+",
  color: "#6b7280",
  description: "Create a custom thinking companion",
  source: "system",
  skipDocumentContext: true,
  systemPrompt: `You help writers create custom thinking companions (called "lenses") for their writing.

Your job is to understand what kind of lens the writer wants through brief conversation. Ask about:
- What should this lens focus on? (structure, voice, argument, emotion, domain expertise?)
- What tone? (supportive, challenging, analytical, playful?)
- Any specific perspective? (a reader type, a discipline, a role?)

Keep it to 2-3 questions max. Be conversational, not formulaic.

When you have enough to create the lens, output a lens proposal in this exact format:

:::lens-proposal
{
  "name": "Lens Name",
  "description": "One-line description",
  "icon": "X",
  "color": "#hex",
  "systemPrompt": "The full system prompt for this lens..."
}
:::

The system prompt you write should:
- Address the lens in second person ("You are a...")
- Be 2-4 sentences — concise, opinionated, with a clear voice
- Focus on what the lens DOES, not what it IS
- End with a behavior instruction (e.g., "Push back when the argument gets lazy")

Do NOT include the shared base instructions (brevity, document context) — those are added automatically.

If the writer wants changes after seeing the proposal, revise and output a new :::lens-proposal block.`,
},
```

- [ ] **Step 2: Commit**

```bash
git add src/shared/lens-presets.ts
git commit -m "feat: add Lens Creator system preset"
```

---

### Task 4: Migrate lens storage to `.loupe/lenses/` + create lens endpoint

**Files:**
- Modify: `src/server/index.ts`
- Modify: `src/server/lens-loader.ts`
- Modify: `src/server/lens-manager.ts`
- Modify: `src/server/routes.ts`
- Modify: `.gitignore`
- Test: `tests/server/lens-creator.test.ts`

- [ ] **Step 1: Write tests for the create endpoint**

```typescript
// tests/server/lens-creator.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { RouteHandler } from "../../src/server/routes";
import { DocumentStore } from "../../src/server/document";
import { LensManager } from "../../src/server/lens-manager";
import { FileStore } from "../../src/server/file-store";
import { LENS_PRESETS } from "../../src/shared/lens-presets";
import { join } from "path";
import { mkdirSync, rmSync, existsSync, readFileSync } from "fs";

const TMP = join(import.meta.dirname, "__tmp_lenses__");

describe("POST /api/lenses/create", () => {
  let handler: RouteHandler;
  let lensManager: LensManager;

  beforeEach(() => {
    mkdirSync(TMP, { recursive: true });
    lensManager = new LensManager([...LENS_PRESETS], "claude-sonnet-4-6");
    handler = new RouteHandler(new DocumentStore(), lensManager, new FileStore(), TMP);
  });

  afterEach(() => {
    rmSync(TMP, { recursive: true, force: true });
  });

  it("creates a lens and returns the definition", async () => {
    const req = new Request("http://localhost/api/lenses/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Test Lens",
        description: "A test",
        icon: "T",
        color: "#ff0000",
        systemPrompt: "You are a test lens.",
      }),
    });
    const res = await handler.handle(req);
    expect(res!.status).toBe(201);
    const body = await res!.json();
    expect(body.ok).toBe(true);
    expect(body.lens.name).toBe("Test Lens");
    expect(body.lens.id).toBe("test-lens");
    expect(body.lens.source).toBe("user");

    // File written to disk
    const lensPath = join(TMP, ".loupe", "lenses", "test-lens", "LENS.md");
    expect(existsSync(lensPath)).toBe(true);
    const content = readFileSync(lensPath, "utf8");
    expect(content).toContain("name: Test Lens");
    expect(content).toContain("You are a test lens.");
  });

  it("handles slug collisions by appending suffix", async () => {
    // Create first lens
    await handler.handle(new Request("http://localhost/api/lenses/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "My Lens", description: "First", icon: "M",
        color: "#000", systemPrompt: "First.",
      }),
    }));

    // Create second with same name
    const res = await handler.handle(new Request("http://localhost/api/lenses/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "My Lens", description: "Second", icon: "M",
        color: "#000", systemPrompt: "Second.",
      }),
    }));
    const body = await res!.json();
    expect(body.lens.id).toBe("my-lens-2");
  });

  it("returns 400 for missing required fields", async () => {
    const req = new Request("http://localhost/api/lenses/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "No Prompt" }),
    });
    const res = await handler.handle(req);
    expect(res!.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bunx vitest run tests/server/lens-creator.test.ts`
Expected: FAIL

- [ ] **Step 3: Add `writeLensMd` to lens-loader.ts**

```typescript
// Add to src/server/lens-loader.ts
import { mkdirSync, writeFileSync } from "fs";

export function writeLensMd(
  lensesDir: string,
  id: string,
  definition: { name: string; description: string; icon: string; color: string; systemPrompt: string }
): void {
  const dir = join(lensesDir, id);
  mkdirSync(dir, { recursive: true });
  const content = `---
name: ${definition.name}
description: ${definition.description}
icon: ${definition.icon}
color: "${definition.color}"
---

${definition.systemPrompt}
`;
  writeFileSync(join(dir, "LENS.md"), content, "utf8");
}
```

- [ ] **Step 4: Update LensManager — exempt system lenses from limit**

In `src/server/lens-manager.ts`, update `activate()`:

```typescript
activate(definitionId: string): string {
  const definition = this.definitions.get(definitionId);
  if (!definition) throw new Error(`Unknown lens: ${definitionId}`);
  // System lenses (like Lens Creator) exempt from limit
  if (definition.source !== "system" && this.sessions.size >= MAX_LENSES)
    throw new Error("Maximum 5 concurrent lenses");
  const lensId = nanoid(8);
  this.sessions.set(lensId, new LensSession(definition, this.defaultModel));
  return lensId;
}
```

- [ ] **Step 5: Add create endpoint to routes.ts**

Add to `src/server/routes.ts` (before the document sync route). Also add a `lensesDir` property passed from index.ts:

Update constructor:
```typescript
constructor(
  private document: DocumentStore,
  private lensManager: LensManager,
  private fileStore: FileStore,
  private cwd: string = process.cwd(),
) {}
```

Add the route:
```typescript
// Create lens
if (url.pathname === "/api/lenses/create" && req.method === "POST") {
  const body = await req.json();
  const { name, description, icon, color, systemPrompt } = body;
  if (!name || !systemPrompt) {
    return Response.json({ error: "name and systemPrompt required" }, { status: 400 });
  }

  // Slugify name
  let slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const lensesDir = resolve(this.cwd, ".loupe", "lenses");

  // Handle collisions
  const { existsSync } = require("fs");
  let finalSlug = slug;
  let suffix = 2;
  while (existsSync(resolve(lensesDir, finalSlug))) {
    finalSlug = `${slug}-${suffix++}`;
  }

  const def = {
    name,
    description: description || name,
    icon: icon || name[0],
    color: color || "#6b7280",
    systemPrompt,
  };

  try {
    writeLensMd(lensesDir, finalSlug, def);
    const lensDef: LensDefinition = {
      id: finalSlug,
      ...def,
      source: "user",
    };
    this.lensManager.addDefinitions([lensDef]);
    return Response.json({ ok: true, lens: lensDef }, { status: 201 });
  } catch {
    return Response.json({ error: "Failed to create lens" }, { status: 500 });
  }
}
```

Import `writeLensMd` and `LensDefinition` at top of routes.ts:
```typescript
import { writeLensMd } from "./lens-loader";
import type { LensDefinition } from "@shared/types";
```

- [ ] **Step 6: Update index.ts — load from both directories**

```typescript
const LENSES_DIR = join(process.cwd(), ".loupe", "lenses");
const LEGACY_LENSES_DIR = join(process.cwd(), "lenses");

// Load user lenses from both .loupe/lenses/ and legacy lenses/
const userLenses = [
  ...(await loadUserLenses(LENSES_DIR)),
  ...(await loadUserLenses(LEGACY_LENSES_DIR)),
];
```

- [ ] **Step 7: Update .gitignore**

Add `.loupe/` to `.gitignore`:

```
# Loupe
.superpowers
.loupe/
lenses/*
!lenses/.gitkeep
!lenses/README.md
```

- [ ] **Step 8: Run tests**

Run: `bunx vitest run tests/server/lens-creator.test.ts`
Expected: All 3 tests pass

- [ ] **Step 9: Run full test suite**

Run: `bunx vitest run`
Expected: All pass

- [ ] **Step 10: Commit**

```bash
git add src/server/routes.ts src/server/index.ts src/server/lens-loader.ts src/server/lens-manager.ts .gitignore tests/server/lens-creator.test.ts
git commit -m "feat: lens create endpoint, .loupe/lenses storage, slug collision handling"
```

---

## Chunk 2: Client — Lens Picker + Proposal Card + Wiring

### Task 5: Add "Create your own..." button to LensPicker

**Files:**
- Modify: `src/client/chrome/LensPicker.tsx`

- [ ] **Step 1: Update LensPicker**

Add an `onCreateLens` prop and a "Create your own..." button at the bottom of the modal:

```typescript
interface LensPickerProps {
  available: LensDefinition[];
  activeLensCount: number;
  onActivate: (definitionId: string) => void;
  onCreateLens: () => void;  // new
  onClose: () => void;
}
```

Filter out system lenses from the display:

```typescript
const presets = available.filter((l) => l.source === "preset");
const userLenses = available.filter((l) => l.source === "user");
```

Add after the user lenses section (before the closing `</div>` of the modal content):

```tsx
<div className="mt-4 pt-3" style={{ borderTop: "1px solid var(--loupe-border)" }}>
  <button
    onClick={() => { onCreateLens(); onClose(); }}
    className="w-full text-left px-3 py-2.5 rounded-lg text-[13px]
               transition-colors cursor-pointer hover:bg-white/[0.03]"
    style={{ color: "var(--loupe-text-tertiary)" }}
  >
    + Create your own...
  </button>
</div>
```

- [ ] **Step 2: Commit**

```bash
git add src/client/chrome/LensPicker.tsx
git commit -m "feat: add Create your own button to LensPicker"
```

---

### Task 6: Create LensProposalCard component

**Files:**
- Create: `src/client/lenses/LensProposalCard.tsx`

- [ ] **Step 1: Create the component**

```tsx
// src/client/lenses/LensProposalCard.tsx
import { useState } from "react";
import { LoupeIcon } from "./LoupeIcon";

interface LensProposal {
  name: string;
  description: string;
  icon: string;
  color: string;
  systemPrompt: string;
}

interface LensProposalCardProps {
  proposal: LensProposal;
  isLatest: boolean;
  onCreate: (proposal: LensProposal) => void;
}

export function parseLensProposal(text: string): LensProposal | null {
  const match = text.match(/:::lens-proposal\s*\n([\s\S]*?)\n:::/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[1]);
    if (!parsed.name || !parsed.systemPrompt) return null;
    return {
      name: parsed.name,
      description: parsed.description || parsed.name,
      icon: parsed.icon || parsed.name[0],
      color: parsed.color || "#6b7280",
      systemPrompt: parsed.systemPrompt,
    };
  } catch {
    return null;
  }
}

export function stripProposalBlock(text: string): string {
  return text.replace(/:::lens-proposal\s*\n[\s\S]*?\n:::/, "").trim();
}

export function LensProposalCard({ proposal, isLatest, onCreate }: LensProposalCardProps) {
  const [showPrompt, setShowPrompt] = useState(false);

  return (
    <div
      className="rounded-lg p-3 mt-2"
      style={{
        background: "var(--loupe-surface)",
        border: "1px solid var(--loupe-border)",
      }}
    >
      <div className="flex items-center gap-2.5 mb-2">
        <LoupeIcon size={28} color={proposal.color} icon={proposal.icon} />
        <div>
          <div className="text-[13px] font-medium" style={{ color: "var(--loupe-text)" }}>
            {proposal.name}
          </div>
          <div className="text-[11px]" style={{ color: "var(--loupe-text-tertiary)" }}>
            {proposal.description}
          </div>
        </div>
      </div>

      <button
        onClick={() => setShowPrompt(!showPrompt)}
        className="text-[11px] mb-2 cursor-pointer hover:opacity-80"
        style={{ color: "var(--loupe-text-ghost)" }}
      >
        {showPrompt ? "Hide prompt ▴" : "Show prompt ▾"}
      </button>

      {showPrompt && (
        <div
          className="text-[11px] p-2 rounded mb-2 whitespace-pre-wrap"
          style={{
            background: "var(--loupe-chrome-bg)",
            color: "var(--loupe-text-secondary)",
            maxHeight: 120,
            overflowY: "auto",
          }}
        >
          {proposal.systemPrompt}
        </div>
      )}

      {isLatest && (
        <button
          onClick={() => onCreate(proposal)}
          className="w-full text-[12px] py-1.5 rounded cursor-pointer
                     transition-opacity hover:opacity-90 font-medium"
          style={{
            background: proposal.color + "33",
            color: proposal.color,
            border: `1px solid ${proposal.color}44`,
          }}
        >
          Create this lens
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/client/lenses/LensProposalCard.tsx
git commit -m "feat: add LensProposalCard component with proposal parsing"
```

---

### Task 7: Integrate proposal detection into LensChat

**Files:**
- Modify: `src/client/lenses/LensChat.tsx`

- [ ] **Step 1: Update LensChat to detect and render proposals**

Add `onCreateLens` prop:

```typescript
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
  onCreateLens?: (proposal: { name: string; description: string; icon: string; color: string; systemPrompt: string }) => void;
}
```

Import the proposal helpers at top:
```typescript
import { parseLensProposal, stripProposalBlock, LensProposalCard } from "./LensProposalCard";
```

In the messages rendering section, replace the lens message block. Find the last message index that has a proposal (for `isLatest`):

```tsx
{messages.map((msg, i) => {
  if (msg.role === "user") {
    return (
      <div key={i} className="loupe-chat-user-msg">
        <div>{msg.content}</div>
      </div>
    );
  }

  const proposal = parseLensProposal(msg.content);
  const textWithoutProposal = proposal ? stripProposalBlock(msg.content) : msg.content;
  // Find if this is the latest proposal in the conversation
  const isLatestProposal = proposal && !messages.slice(i + 1).some(
    (m) => m.role === "lens" && parseLensProposal(m.content)
  );

  return (
    <div key={i} className="loupe-chat-lens-msg">
      {textWithoutProposal && (
        <Markdown className="lens-markdown">{textWithoutProposal}</Markdown>
      )}
      {proposal && (
        <LensProposalCard
          proposal={proposal}
          isLatest={!!isLatestProposal}
          onCreate={(p) => onCreateLens?.(p)}
        />
      )}
    </div>
  );
})}
```

- [ ] **Step 2: Verify build**

Run: `bun run build`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add src/client/lenses/LensChat.tsx
git commit -m "feat: detect lens proposals in chat, render LensProposalCard"
```

---

### Task 8: Wire everything in App.tsx and use-lenses.ts

**Files:**
- Modify: `src/client/App.tsx`
- Modify: `src/client/hooks/use-lenses.ts`
- Modify: `src/client/lenses/LensLayer.tsx`

- [ ] **Step 1: Add createLens function to use-lenses.ts**

Add to the hook's return and implementation:

```typescript
const createLens = useCallback(async (proposal: {
  name: string; description: string; icon: string; color: string; systemPrompt: string;
}) => {
  try {
    const res = await fetch("/api/lenses/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(proposal),
    });
    if (!res.ok) return;
    // Refresh lens list
    await fetchLenses();
  } catch {}
}, [fetchLenses]);
```

Add `createLens` to the hook's return value.

- [ ] **Step 2: Add activateCreator function to use-lenses.ts**

```typescript
const activateCreator = useCallback(async () => {
  const lensId = await activate("lens-creator");
  if (lensId) {
    // Auto-send initial message to start the conversation
    await ask(lensId, "I want to create a new lens.");
    toggleExpanded(lensId);
  }
}, [activate, ask, toggleExpanded]);
```

Add `activateCreator` to the hook's return value.

- [ ] **Step 3: Wire onCreateLens through LensLayer**

Update `LensLayer` props to include `onCreateLens`:

```typescript
interface LensLayerProps {
  // ... existing props
  onCreateLens?: (proposal: { name: string; description: string; icon: string; color: string; systemPrompt: string }) => void;
}
```

Pass it through to `LensChat`:
```tsx
<LensChat
  // ... existing props
  onCreateLens={onCreateLens}
/>
```

- [ ] **Step 4: Wire in App.tsx**

Update LensPicker to pass `onCreateLens`:
```tsx
<LensPicker
  available={lens.available}
  activeLensCount={lens.lenses.size}
  onActivate={lens.activate}
  onCreateLens={lens.activateCreator}
  onClose={() => lens.setPickerOpen(false)}
/>
```

Update LensLayer to pass `onCreateLens`:
```tsx
<LensLayer
  // ... existing props
  onCreateLens={async (proposal) => {
    await lens.createLens(proposal);
    // Deactivate the Lens Creator after successful creation
    for (const [lensId, state] of lens.lenses) {
      if (state.definitionId === "lens-creator") {
        lens.deactivate(lensId);
        break;
      }
    }
  }}
/>
```

- [ ] **Step 5: Verify build**

Run: `bun run build`
Expected: Build succeeds

- [ ] **Step 6: Run full test suite**

Run: `bunx vitest run`
Expected: All pass

- [ ] **Step 7: Commit**

```bash
git add src/client/hooks/use-lenses.ts src/client/App.tsx src/client/lenses/LensLayer.tsx
git commit -m "feat: wire Lens Creator — activateCreator, createLens, proposal flow"
```

---

## Chunk 3: Integration Verification

### Task 9: Full test suite + build + manual smoke test

- [ ] **Step 1: Run full test suite**

Run: `bunx vitest run`
Expected: All tests pass

- [ ] **Step 2: Build production bundle**

Run: `bun run build`
Expected: Build succeeds

- [ ] **Step 3: Manual smoke test — create a lens**

1. `bun run build && bun run start`
2. Open a file with content
3. Cmd+L → "Choose a Lens" → "Create your own..."
4. Lens Creator appears in sidebar with opening question
5. Describe a lens: "I want a lens that reads like a philosophy professor"
6. AI asks 1-2 follow-ups
7. AI proposes a lens with preview card
8. Click "Create this lens"
9. Lens Creator dismisses
10. Cmd+L → new lens appears in "Your Lenses" section
11. Activate it — should work on your document

- [ ] **Step 4: Manual smoke test — edge cases**

1. Create two lenses with the same name → second gets `-2` suffix
2. Dismiss Lens Creator mid-conversation → session lost, start over works
3. Ask AI to revise proposal → new card appears, only latest has Create button

- [ ] **Step 5: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: integration fixes from smoke testing"
```
