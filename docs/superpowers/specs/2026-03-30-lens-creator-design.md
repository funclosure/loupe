# Lens Creator Design — Conversational Lens Creation

## Overview

A special built-in "Lens Creator" lens that creates other lenses through conversation. The writer describes what kind of thinking companion they want, the AI asks follow-ups, then proposes a lens definition. The writer approves, and it's saved to `.loupe/lenses/`.

## Flow

1. Writer opens lens picker → sees **"Create your own..."** at the bottom of the list
2. Clicking activates the **Lens Creator** — appears in the sidebar as a regular lens chat
3. Lens Creator opens with: *"What kind of thinking companion do you want? Describe how it should help you."*
4. 2-3 turns of natural conversation — the AI understands intent, asks about focus, tone, style
5. When ready, the AI outputs a structured lens proposal (JSON block in its response)
6. Client detects the proposal and renders it as a **preview card** in the chat — showing name, icon, color, description, and system prompt
7. Writer clicks **"Create"** → client sends to `POST /api/lenses/create` → saved to `.loupe/lenses/<id>/LENS.md`
8. Lens list refreshes, new lens appears in the picker. Lens Creator dismisses.

## Changes

### 1. Lens Storage Migration

Move user lens directory from `lenses/` to `.loupe/lenses/` in CWD. This makes lenses project-scoped.

**Files:**
- `src/server/index.ts` — change `LENSES_DIR` from `join(process.cwd(), "lenses")` to `join(process.cwd(), ".loupe", "lenses")`
- `src/server/lens-loader.ts` — no changes (already takes directory as param)

### 2. Lens Creator Preset

A new entry in `lens-presets.ts` with `source: "system"` (not shown in the regular "Built-in" section of the picker — it's a tool, not a perspective lens).

**System prompt** for the Lens Creator:

```
You help writers create custom thinking companions (called "lenses") for their writing.

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
```

**Files:**
- `src/shared/lens-presets.ts` — add Lens Creator entry
- `src/shared/types.ts` — add `"system"` to `LensDefinition.source` union

### 3. Lens Picker — "Create your own..." Button

Add a button at the bottom of the lens picker that activates the Lens Creator lens and closes the picker.

**Files:**
- `src/client/chrome/LensPicker.tsx` — add "Create your own..." button after user lenses section

### 4. LensChat — Lens Proposal Detection + Preview Card

When a lens chat message contains a `:::lens-proposal ... :::` block, parse the JSON and render it as a preview card instead of raw text.

**Preview card shows:**
- LoupeIcon with the proposed color and icon
- Name and description
- System prompt (collapsed by default, expandable)
- **"Create"** button

**Files:**
- `src/client/lenses/LensChat.tsx` — detect proposal blocks, render preview card
- New: `src/client/lenses/LensProposalCard.tsx` — the preview card component

### 5. Server — Create Lens Endpoint

`POST /api/lenses/create` — accepts `{ name, description, icon, color, systemPrompt }`, generates an ID (slugified name), writes LENS.md to `.loupe/lenses/<id>/LENS.md`, creates directory if needed, reloads lens definitions, returns the new lens definition.

**Files:**
- `src/server/routes.ts` — add create endpoint
- `src/server/lens-manager.ts` — add method to reload/add user lenses
- `src/server/lens-loader.ts` — may need a single-lens write helper (`writeLensMd`)

### 6. Refresh After Creation

After the server creates the lens, the client:
1. Fetches updated lens list (`GET /api/lenses`)
2. Dismisses the Lens Creator chat
3. New lens appears in the picker immediately

**Files:**
- `src/client/hooks/use-lenses.ts` — handle post-creation refresh

## What Stays the Same

- All existing lens UI, activation, chat, streaming
- LENS.md format (frontmatter + system prompt body)
- Preset lenses unchanged
- Drag-to-inspect, dwell detection, bubble states

## Out of Scope

- Editing existing lenses through the UI (edit the LENS.md directly for now)
- Lens deletion from UI (use file picker or filesystem)
- Lens sharing/export
- Lens versioning
