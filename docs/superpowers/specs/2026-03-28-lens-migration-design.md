# Lens Communication Migration — Design Spec

Migrate Loupe's lens AI layer from persistent EventSource + direct Anthropic SDK to pace's per-request fetch streaming + Claude Agent SDK.

## Motivation

The current persistent SSE approach (`GET /api/events` + `EventSource`) doesn't work with Bun.serve — causes `ERR_INCOMPLETE_CHUNKED_ENCODING` errors. The direct Anthropic SDK requires a separate `ANTHROPIC_API_KEY`. Pace's proven pattern solves both: per-request SSE streams work reliably with Bun, and the Agent SDK authenticates through Claude Code (no API key needed).

## Changes

### Server

**`src/server/lens-session.ts`** — rewrite:
- Replace `@anthropic-ai/sdk` with `@anthropic-ai/claude-agent-sdk`
- Use pace's `MessageChannel` pattern (async iterable that keeps the query alive for multi-turn)
- Use `query()` from Agent SDK with `permissionMode: "bypassPermissions"` and `disallowedTools` to restrict to text-only responses
- `start(initialMessage)` — creates the query with lens system prompt + document context
- `send(message)` — pushes into the channel for follow-up turns
- `receiveWeb()` — async generator yielding `{ type: "text", text }` deltas, modeled on pace's pattern
- Manual `.next()` iteration on the query iterator (not `for await...of`) to keep the transport alive
- `close()` — closes the query
- Keep existing `buildSystemPrompt()`, `status`, `preview`, `history` tracking
- No API key in code — Agent SDK reads from environment or Claude Code session

**`src/server/routes.ts`** — rewrite SSE:
- Remove `GET /api/events` endpoint and all SSE client management (`sseClients`, `broadcast()`)
- `POST /api/lens/:id/ask` — start or send message, return `ReadableStream` SSE response with text deltas, close when done
- `POST /api/lens/:id/focus` — same pattern, sends focus message
- `POST /api/lens/:id/rethink` — same pattern, sends rethink message
- Each response streams `data: {"text":"..."}\n\n` chunks, then `data: {"done":true}\n\n`, then `controller.close()`
- Errors: `data: {"error":"..."}\n\n`

**`src/server/index.ts`** — add `idleTimeout: 120` to `Bun.serve()` (lens tool calls can idle the stream)

**`package.json`** — replace `@anthropic-ai/sdk` with `@anthropic-ai/claude-agent-sdk` + `zod`

### Client

**Delete `src/client/hooks/use-sse.ts`** — no more persistent SSE connection

**`src/client/hooks/use-lenses.ts`** — replace SSE event handling:
- Remove `handleSSEEvent` callback
- `ask()`, `focus()`, `rethink()` become async functions that:
  1. Set lens status to "thinking"
  2. `fetch()` the endpoint (POST)
  3. Read response body with `res.body.getReader()`
  4. Parse SSE lines (`data: {...}\n\n`), accumulate text into `streamingContent`
  5. On `done`, move `streamingContent` into `messages`, set status to "idle"
  6. On `error`, set status to "error"
- Extract the streaming reader logic into a shared helper (`streamLensResponse()`)

**`src/client/App.tsx`** — remove `useSSE` import and call (no more `useSSE(lens.handleSSEEvent, ...)`)

### Unchanged

- All UI components (`LensBubble`, `LensChat`, `LensLayer`, `LensPicker`, `TopBar`)
- `DocumentStore`, `LensManager`, `lens-loader.ts`
- `lens-presets.ts`, `types.ts` (remove SSEEvent type)
- Editor, file handling, zen mode
- Tests for DocumentStore, lens-loader, lens-presets (still pass)
- LensManager tests (still pass — doesn't touch session internals)

### SSE Protocol (per-request)

Each lens interaction is a POST that returns an SSE stream:

```
POST /api/lens/:id/ask  { message: "..." }
POST /api/lens/:id/focus  { paragraphText: "..." }
POST /api/lens/:id/rethink  {}

Response: Content-Type: text/event-stream

data: {"text":"The writer's "}
data: {"text":"notion of..."}
data: {"done":true}

(or on error)
data: {"error":"Connection failed"}
```

Client reads with `fetch()` + `res.body.getReader()` (not EventSource — supports POST).
