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
