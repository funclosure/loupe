import type { DocumentSyncBody, LensFocusBody, LensAskBody, LensDefinition } from "@shared/types";
import { DocumentStore } from "./document";
import { LensManager } from "./lens-manager";
import type { LensSession } from "./lens-session";
import { FileStore } from "./file-store";
import { writeLensMd } from "./lens-loader";
import { resolve, basename, dirname } from "path";
import { readdirSync, readFileSync, writeFileSync, mkdirSync, renameSync, existsSync } from "fs";
import { spawn, execSync } from "child_process";

export class RouteHandler {
  constructor(
    private document: DocumentStore,
    private lensManager: LensManager,
    private fileStore: FileStore,
    private cwd: string = process.cwd(),
  ) {}

  private get configPath() {
    return resolve(this.cwd, ".loupe", "config.json");
  }

  private readConfig(): { imageDir?: string; imagePrefix?: string } {
    try {
      return JSON.parse(readFileSync(this.configPath, "utf8"));
    } catch {
      return {};
    }
  }

  private writeConfig(config: Record<string, any>) {
    const dir = resolve(this.cwd, ".loupe");
    mkdirSync(dir, { recursive: true });
    writeFileSync(this.configPath, JSON.stringify(config, null, 2), "utf8");
  }

  private get projectRoot(): string {
    let dir = this.cwd;
    while (dir !== dirname(dir)) {
      if (existsSync(resolve(dir, "package.json")) || existsSync(resolve(dir, ".git"))) {
        return dir;
      }
      dir = dirname(dir);
    }
    return this.cwd;
  }

  private resolveImageDir(imageDir: string): string {
    if (imageDir.startsWith("/")) return imageDir;
    return resolve(this.projectRoot, imageDir);
  }

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

    // Get CWD info
    if (url.pathname === "/api/cwd" && req.method === "GET") {
      return Response.json({ path: this.cwd, name: basename(this.cwd), projectRoot: this.projectRoot });
    }

    // Open CWD in Finder
    if (url.pathname === "/api/open-finder" && req.method === "POST") {
      spawn("open", [this.cwd]);
      return Response.json({ ok: true });
    }

    // Read config
    if (url.pathname === "/api/config" && req.method === "GET") {
      return Response.json(this.readConfig());
    }

    // Native folder picker (macOS)
    if (url.pathname === "/api/pick-folder" && req.method === "POST") {
      try {
        const root = this.projectRoot;
        const result = execSync(
          `osascript -e 'POSIX path of (choose folder with prompt "Select image folder" default location POSIX file "${root}")'`,
          { encoding: "utf8", timeout: 60000 }
        ).trim().replace(/\/$/, "");

        // Make relative to project root if inside it
        const dir = result.startsWith(root + "/") ? result.slice(root.length + 1) : result;

        // Auto-derive prefix: strip up to and including "public" if present
        const publicIdx = result.indexOf("/public/");
        const prefix = publicIdx !== -1
          ? result.slice(publicIdx + "/public".length)
          : "/" + basename(result);

        return Response.json({ path: dir, prefix });
      } catch {
        // User cancelled the dialog
        return Response.json({ cancelled: true });
      }
    }

    // Write config
    if (url.pathname === "/api/config" && req.method === "POST") {
      const body = await req.json();
      const existing = this.readConfig();
      this.writeConfig({ ...existing, ...body });
      return Response.json({ ok: true });
    }

    // Auto-detect image folder from current document
    if (url.pathname === "/api/image/detect" && req.method === "POST") {
      const doc = this.document.get();
      if (!doc.content) return Response.json({ error: "No document content" }, { status: 400 });

      // Extract image paths from markdown: ![alt](path)
      const imgRegex = /!\[[^\]]*\]\(([^)]+)\)/g;
      const paths: string[] = [];
      let match;
      while ((match = imgRegex.exec(doc.content)) !== null) {
        const src = match[1].split(/[?#]/)[0]; // strip query/hash
        if (src && !src.startsWith("http") && !src.startsWith("data:")) {
          paths.push(src);
        }
      }

      if (paths.length === 0) return Response.json({ error: "No local images found in document" }, { status: 404 });

      // Find common prefix directory
      const dirs = paths.map(p => p.split("/").slice(0, -1).join("/"));
      let commonPrefix = dirs[0];
      for (const dir of dirs.slice(1)) {
        while (commonPrefix && !dir.startsWith(commonPrefix)) {
          commonPrefix = commonPrefix.split("/").slice(0, -1).join("/");
        }
      }
      if (!commonPrefix) commonPrefix = dirs[0];

      // Search project root for matching directory
      const root = this.projectRoot;
      const candidates = [
        resolve(root, "public" + commonPrefix),
        resolve(root, "static" + commonPrefix),
        resolve(root, "assets" + commonPrefix),
        resolve(root, commonPrefix.startsWith("/") ? commonPrefix.slice(1) : commonPrefix),
      ];

      let imageDir: string | null = null;
      for (const candidate of candidates) {
        if (existsSync(candidate)) {
          // Make relative to project root
          imageDir = candidate.startsWith(root + "/") ? candidate.slice(root.length + 1) : candidate;
          break;
        }
      }

      if (!imageDir) {
        return Response.json({ error: "Could not find image directory on disk", prefix: commonPrefix }, { status: 404 });
      }

      return Response.json({ imageDir, imagePrefix: commonPrefix });
    }

    // Upload image (paste/drop)
    if (url.pathname === "/api/image" && req.method === "POST") {
      const config = this.readConfig();
      if (!config.imageDir) {
        return Response.json({ error: "Image folder not configured" }, { status: 400 });
      }

      const imageDir = this.resolveImageDir(config.imageDir);
      mkdirSync(imageDir, { recursive: true });

      const contentType = req.headers.get("content-type") || "";
      const ext = contentType.includes("png") ? "png" : contentType.includes("gif") ? "gif" : "jpg";
      const ts = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);
      const filename = `paste-${ts}.${ext}`;

      const buffer = await req.arrayBuffer();
      writeFileSync(resolve(imageDir, filename), Buffer.from(buffer));

      const prefix = config.imagePrefix || `/${config.imageDir}`;
      return Response.json({ ok: true, path: `${prefix}/${filename}`, filename });
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

    // GET /api/outline — read sidecar file
    if (url.pathname === "/api/outline" && req.method === "GET") {
      const outlinePath = this.fileStore.outlinePath;
      if (!outlinePath) return Response.json({ content: "" });
      try {
        const text = readFileSync(outlinePath, "utf8");
        return Response.json({ content: text });
      } catch {
        return Response.json({ content: "" });
      }
    }

    // POST /api/outline — write sidecar file
    if (url.pathname === "/api/outline" && req.method === "POST") {
      const outlinePath = this.fileStore.outlinePath;
      if (!outlinePath) return Response.json({ error: "No active file" }, { status: 400 });
      const body = await req.json();
      try {
        writeFileSync(outlinePath, body.content, "utf8");
        return Response.json({ ok: true });
      } catch {
        return Response.json({ error: "Write failed" }, { status: 500 });
      }
    }

    // POST /api/outline/chat — SSE stream for refining the outline
    if (url.pathname === "/api/outline/chat" && req.method === "POST") {
      const body = await req.json();
      const { message, outline } = body;

      // Also read the current document for context
      const doc = this.document.get();

      const systemPrompt = `You help a writer refine the intention outline for their piece. The outline captures what they want to convey — their thesis, goals for each section, the feeling they want the reader to have.

${doc.content ? `The writer's current document:\n\n${doc.content}\n\n` : ""}Current outline:

${outline || "(empty)"}

Help them sharpen, expand, or restructure their intentions. Be concise and direct. If you suggest changes to the outline, output the updated full outline in a :::outline-update block:

:::outline-update
[the complete updated outline text]
:::

Only include the update block when you're actually changing the outline. For discussion or questions, just respond normally.`;

      const { query } = await import("@anthropic-ai/claude-agent-sdk");

      // Create a one-shot message channel (same pattern as LensSession)
      const userMsg = {
        type: "user" as const,
        message: { role: "user" as const, content: message },
        parent_tool_use_id: null,
        session_id: "outline",
      };
      async function* singleMessage() { yield userMsg; }

      const stream = new ReadableStream({
        async start(controller) {
          const encoder = new TextEncoder();
          try {
            const q = query({
              prompt: singleMessage() as any,
              options: {
                systemPrompt,
                model: process.env.LOUPE_MODEL || "claude-sonnet-4-6",
                permissionMode: "bypassPermissions",
                allowDangerouslySkipPermissions: true,
                allowedTools: [],
                disallowedTools: [
                  "Bash", "Read", "Write", "Edit", "Glob", "Grep",
                  "Agent", "WebFetch", "WebSearch", "NotebookEdit",
                ],
                includePartialMessages: true,
              },
            });

            for await (const msg of q as AsyncIterable<any>) {
              if (msg.type === "stream_event" && msg.event) {
                const delta = msg.event.delta;
                if (
                  msg.event.type === "content_block_delta" &&
                  delta?.type === "text_delta" &&
                  delta.text
                ) {
                  controller.enqueue(
                    encoder.encode(`data: ${JSON.stringify({ text: delta.text })}\n\n`)
                  );
                }
              }
              if (msg.type === "result") break;
            }

            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`));
          } catch (err) {
            const errorMsg = err instanceof Error ? err.message : String(err);
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ error: errorMsg })}\n\n`)
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

    // Serve images from configured image directory
    const config = this.readConfig();
    if (config.imageDir && config.imagePrefix && url.pathname.startsWith(config.imagePrefix + "/")) {
      const relativePath = url.pathname.slice(config.imagePrefix.length + 1);
      const baseDir = this.resolveImageDir(config.imageDir);
      const filePath = resolve(baseDir, relativePath);
      const file = Bun.file(filePath);
      if (await file.exists()) {
        return new Response(file);
      }
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
    let outlineContent = "";
    const outlinePath = this.fileStore.outlinePath;
    if (outlinePath) {
      try { outlineContent = readFileSync(outlinePath, "utf8"); } catch {}
    }

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();

        try {
          // Start or continue the session
          if (!session.isStarted) {
            await session.start(doc.content, message, focusedParagraph, outlineContent);
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
