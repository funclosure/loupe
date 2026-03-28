# Loupe

A zen writing PWA where floating AI lenses offer different perspectives on your text.

## Tech Stack

- **Runtime:** Bun
- **Frontend:** React 19 + Vite + Tailwind CSS
- **Editor:** Milkdown (ProseMirror-based)
- **AI:** Anthropic SDK (Claude)
- **Testing:** Vitest (`bunx vitest run`)
- **PWA:** VitePWA (Workbox)

## Commands

- `bun run dev` — Start Vite dev server (client, proxies /api to Bun)
- `bun run start` — Start Bun server (API + serves built static files)
- `bun run build` — Build client for production via Vite
- `bunx vitest run` — Run tests
- `bunx vitest` — Run tests in watch mode

## Architecture

Client + thin Bun server. Bun serves Vite-built static files AND manages lens sessions via Anthropic SDK. No database. File on disk is source of truth.

- `src/server/` — Bun backend (lens sessions, SSE, REST API)
- `src/client/` — React SPA (Milkdown editor, lens UI, chrome)
- `src/shared/` — Types shared between server and client
- `lenses/` — User-created lens definitions (gitignored)

## Conventions

- Use `Bun.serve()` for the server (not express)
- Use `Bun.file()` for file I/O on the server side
- Use Vite for frontend build and dev (NOT Bun's HTML imports)
- Use Vitest for tests (NOT `bun test`)
- `@shared/*` path alias maps to `src/shared/*`

## Spec & Plan

- Spec: `docs/superpowers/specs/2026-03-28-loupe-design.md`
- Plan: `docs/superpowers/plans/2026-03-28-loupe-implementation.md`
