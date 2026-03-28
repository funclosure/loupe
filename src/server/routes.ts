import type { DocumentSyncBody, LensFocusBody, LensAskBody } from "@shared/types";
import { DocumentStore } from "./document";
import { LensManager } from "./lens-manager";
import type { LensSession } from "./lens-session";

export class RouteHandler {
  constructor(
    private document: DocumentStore,
    private lensManager: LensManager
  ) {}

  async handle(req: Request): Promise<Response | null> {
    const url = new URL(req.url);

    // Load file by path (for CLI `loupe file.md`)
    if (url.pathname === "/api/file" && req.method === "GET") {
      const filePath = url.searchParams.get("path");
      if (!filePath) return Response.json({ error: "path required" }, { status: 400 });
      try {
        const resolved = require("path").resolve(filePath);
        const text = await Bun.file(resolved).text();
        const name = require("path").basename(resolved);
        return Response.json({ content: text, filename: name });
      } catch {
        return Response.json({ error: "File not found" }, { status: 404 });
      }
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
      const session = this.lensManager.getSession(deactivateMatch[1]);
      if (session) session.close();
      this.lensManager.deactivate(deactivateMatch[1]);
      return Response.json({ ok: true });
    }

    // Lens ask — returns SSE stream
    const askMatch = url.pathname.match(/^\/api\/lens\/([^/]+)\/ask$/);
    if (askMatch && req.method === "POST") {
      const body: LensAskBody = await req.json();
      const session = this.lensManager.getSession(askMatch[1]);
      if (!session) return Response.json({ error: "Lens not found" }, { status: 404 });

      return this.streamLensResponse(session, body.message);
    }

    // Lens focus — returns SSE stream
    const focusMatch = url.pathname.match(/^\/api\/lens\/([^/]+)\/focus$/);
    if (focusMatch && req.method === "POST") {
      const body: LensFocusBody = await req.json();
      const session = this.lensManager.getSession(focusMatch[1]);
      if (!session) return Response.json({ error: "Lens not found" }, { status: 404 });

      return this.streamLensResponse(
        session,
        "Please share your thoughts on this passage.",
        body.paragraphText
      );
    }

    // Lens rethink — returns SSE stream
    const rethinkMatch = url.pathname.match(/^\/api\/lens\/([^/]+)\/rethink$/);
    if (rethinkMatch && req.method === "POST") {
      const session = this.lensManager.getSession(rethinkMatch[1]);
      if (!session) return Response.json({ error: "Lens not found" }, { status: 404 });

      return this.streamLensResponse(
        session,
        "I've updated the document. What do you think now?"
      );
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

  /**
   * Stream a lens response as SSE (per-request, like pace).
   * Each request starts or continues a conversation, streams the response, then closes.
   */
  private streamLensResponse(
    session: LensSession,
    message: string,
    focusedParagraph?: string
  ): Response {
    const doc = this.document.get();

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();

        try {
          // Start or continue the session
          if (!session.isStarted) {
            await session.start(doc.content, message, focusedParagraph);
          } else {
            // For follow-up turns, update context by prepending document state
            const contextMessage = focusedParagraph
              ? `[Current document context updated]\n\nFocused passage:\n${focusedParagraph}\n\n${message}`
              : message;
            session.send(contextMessage);
          }

          // Stream the response
          for await (const event of session.receive()) {
            if (event.type === "text") {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ text: event.text })}\n\n`)
              );
            } else if (event.type === "done") {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`)
              );
            } else if (event.type === "error") {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ error: event.error })}\n\n`)
              );
            }
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ error: msg })}\n\n`)
          );
        }

        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  }
}
