# Lens Creator Design — Conversational Lens Creation

## Overview

A special built-in "Lens Creator" lens that creates other lenses through conversation. The writer describes what kind of thinking companion they want, the AI asks follow-ups, then proposes a lens definition. The writer approves, and it's saved to `.loupe/lenses/`.

## Flow

1. Writer opens lens picker → sees **"Create your own..."** at the bottom of the list
2. Clicking activates the **Lens Creator** — appears in the sidebar as a regular lens chat
3. Activation auto-sends an initial message ("I want to create a new lens"), which prompts the Lens Creator to respond with its opening question. This reuses the existing `ask` flow — no special client behavior.
4. 2-3 turns of natural conversation — the AI understands intent, asks about focus, tone, style
5. When ready, the AI outputs a structured lens proposal (JSON block in its response)
6. Client detects the proposal and renders it as a **preview card** in the chat — showing name, icon, color, description, and system prompt
7. Writer clicks **"Create"** → client sends to `POST /api/lenses/create` → saved to `.loupe/lenses/<id>/LENS.md`
8. Lens list refreshes, new lens appears in the picker. Lens Creator dismisses.
9. If the writer doesn't like the proposal, they can type feedback ("make it more challenging") — the AI revises and outputs a new proposal. Only the latest proposal card has a "Create" button.

## Changes

### 1. Lens Storage Migration

Move user lens directory from `lenses/` to `.loupe/lenses/` in CWD. This makes lenses project-scoped.

- Check `lenses/` first as fallback for backward compatibility — load from both, prefer `.loupe/lenses/` for writes
- Add `.loupe/` to `.gitignore`

**Files:**
- `src/server/index.ts` — change `LENSES_DIR`, add fallback scan of `lenses/`
- `.gitignore` — add `.loupe/`

### 2. Lens Creator Preset

A new entry in `lens-presets.ts` with `source: "system"` (not shown in the regular "Built-in" section of the picker — it's a tool, not a perspective lens).

**Skip document context:** The Lens Creator's `LensDefinition` gets a `skipDocumentContext: true` flag. `LensSession.buildSystemPrompt()` checks this flag — if true, uses the system prompt verbatim without appending document content or the shared behavioral instructions. This is necessary because the Creator is not analyzing writing.

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

If the writer wants changes after seeing the proposal, revise and output a new :::lens-proposal block.
```

**Files:**
- `src/shared/lens-presets.ts` — add Lens Creator entry
- `src/shared/types.ts` — add `"system"` to `LensDefinition.source` union, add optional `skipDocumentContext` flag

### 3. Lens Picker — "Create your own..." Button

Add a button at the bottom of the lens picker that activates the Lens Creator lens and closes the picker. The Lens Creator is exempt from the 5-lens limit (it's a temporary tool, not a perspective lens).

**Files:**
- `src/client/chrome/LensPicker.tsx` — add "Create your own..." button after user lenses section

### 4. LensChat — Lens Proposal Detection + Preview Card

When a lens chat message contains a `:::lens-proposal ... :::` block, parse the JSON and render it as a preview card instead of raw text.

**Parsing:** Extract the first `:::lens-proposal\n{...}\n:::` match via regex. If JSON parsing fails or required fields (`name`, `systemPrompt`) are missing, fall back to rendering the raw text as markdown. No error toast — the writer can ask the AI to try again.

**Multiple proposals:** If the conversation has multiple proposals (writer asked for revisions), only the latest proposal card shows a "Create" button. Earlier ones are rendered as static previews (no button).

**Preview card shows:**
- LoupeIcon with the proposed color and icon
- Name and description
- System prompt (collapsed by default, expandable)
- **"Create"** button (latest proposal only)

**Files:**
- `src/client/lenses/LensChat.tsx` — detect proposal blocks, render preview card
- New: `src/client/lenses/LensProposalCard.tsx` — the preview card component

### 5. Server — Create Lens Endpoint

`POST /api/lenses/create`

**Request:** `{ name, description, icon, color, systemPrompt }`

**Behavior:**
1. Slugify the name for the directory ID (lowercase, replace spaces with hyphens, strip non-alphanumeric)
2. If slug collides with an existing directory in `.loupe/lenses/`, append `-2`, `-3`, etc.
3. Create `.loupe/lenses/<id>/LENS.md` with frontmatter + system prompt body
4. Hot-reload the lens into `LensManager`'s available definitions
5. Return `{ ok: true, lens: LensDefinition }` with status 201

**Errors:**
- 400 — missing required fields (`name`, `systemPrompt`)
- 500 — filesystem write failure

**Files:**
- `src/server/routes.ts` — add create endpoint
- `src/server/lens-manager.ts` — add method to hot-add a lens definition
- `src/server/lens-loader.ts` — add `writeLensMd(dir, definition)` helper

### 6. Refresh After Creation

After the server returns success, the client:
1. Calls `fetchLenses()` to refresh the available lens list
2. Deactivates the Lens Creator session
3. New lens appears in the picker immediately

Ordering: fetch first, then deactivate — so the new lens is visible before the Creator disappears.

**Files:**
- `src/client/hooks/use-lenses.ts` — handle post-creation refresh

### 7. buildSystemPrompt — skipDocumentContext

Modify `LensSession.buildSystemPrompt()` to check `this.definition.skipDocumentContext`. If true, return the system prompt as-is without appending document content or shared behavioral instructions.

**Files:**
- `src/server/lens-session.ts` — conditional in `buildSystemPrompt()`

## Edge Cases

- **Dismiss mid-conversation:** Session is destroyed, writer starts over next time. No draft saving.
- **AI outputs bad format:** Falls back to raw markdown rendering. Writer can ask "try again."
- **Name collision on disk:** Server appends numeric suffix (`-2`, `-3`) to slug.
- **5-lens limit:** Lens Creator is exempt (system source). Checked during activation.
- **`model` field:** Not included in proposals — user-created lenses use the default model.

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
- Editable fields on the preview card (writer refines via conversation instead)
