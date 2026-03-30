import type { DocumentSyncBody, LensFocusBody, LensAskBody, LensDefinition } from "@shared/types";
import { DocumentStore } from "./document";
import { LensManager } from "./lens-manager";
import type { LensSession } from "./lens-session";
import { FileStore } from "./file-store";
import { writeLensMd } from "./lens-loader";
import { resolve, basename } from "path";
import { readdirSync, readFileSync, writeFileSync, mkdirSync, renameSync, existsSync } from "fs";

export class RouteHandler {
  constructor(
    private document: DocumentStore,
    private lensManager: LensManager,
    private fileStore: FileStore,
    private cwd: string = process.cwd(),
  ) {}

  async handle(req: Request): Promise<Response | null> {
    const url = new URL(req.url);

    // Load file by path (for CLI `loupe file.md`)
    if (url.pathname === "/api/file" && req.method === "GET") {
      const filePath = url.searchParams.get("path");
      if (!filePath) return Response.json({ error: "path required" }, { status: 400 });
      try {
        const resolved = resolve(this.cwd, filePath);
        const text = readFileSync(resolved, "utf8");
        this.fileStore.setActive(resolved);
        return Response.json({ content: text, filename: basename(resolved), path: resolved });
      } catch {
        return Response.json({ error: "File not found" }, { status: 404 });
      }
    }

    // Write file
    if (url.pathname === "/api/file" && req.method === "POST") {
      const body = await req.json();
      const { content, path: newPath } = body;

      let targetPath = this.fileStore.activePath;
      if (newPath) {
        targetPath = resolve(this.cwd, newPath);
        this.fileStore.setActive(targetPath);
      }
      if (!targetPath) {
        return Response.json({ error: "No active file. Provide a path." }, { status: 400 });
      }

      try {
        writeFileSync(targetPath, content, "utf8");
        return Response.json({ ok: true, path: targetPath, filename: basename(targetPath) });
      } catch {
        return Response.json({ error: "Write failed" }, { status: 500 });
      }
    }

    // List markdown files in CWD
    if (url.pathname === "/api/files" && req.method === "GET") {
      try {
        const entries = readdirSync(this.cwd);
        const mdFiles = entries
          .filter((f: string) => f.endsWith(".md") || f.endsWith(".mdx"))
          .sort()
          .map((name: string) => ({ name, path: name }));
        return Response.json({ files: mdFiles });
      } catch {
        return Response.json({ files: [] });
      }
    }

    // Delete file (soft — moves to .recently-deleted/)
    if (url.pathname === "/api/file" && req.method === "DELETE") {
      const filePath = url.searchParams.get("path");
      if (!filePath) return Response.json({ error: "path required" }, { status: 400 });
      try {
        const resolved = resolve(this.cwd, filePath);
        const trashDir = resolve(this.cwd, ".recently-deleted");
        mkdirSync(trashDir, { recursive: true });
        renameSync(resolved, resolve(trashDir, basename(resolved)));
        // Clear active path if we just deleted the active file
        if (this.fileStore.activePath === resolved) this.fileStore.clear();
        return Response.json({ ok: true });
      } catch {
        return Response.json({ error: "Delete failed" }, { status: 500 });
      }
    }

    // Create lens
    if (url.pathname === "/api/lenses/create" && req.method === "POST") {
      const body = await req.json();
      const { name, description, icon, color, systemPrompt } = body;
      if (!name || !systemPrompt) {
        return Response.json({ error: "name and systemPrompt required" }, { status: 400 });
      }

      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      const lensesDir = resolve(this.cwd, ".loupe", "lenses");

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
          source: "user" as const,
        };
        this.lensManager.addDefinitions([lensDef]);
        return Response.json({ ok: true, lens: lensDef }, { status: 201 });
      } catch {
        return Response.json({ error: "Failed to create lens" }, { status: 500 });
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
