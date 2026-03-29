import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { RouteHandler } from "../../src/server/routes";
import { DocumentStore } from "../../src/server/document";
import { LensManager } from "../../src/server/lens-manager";
import { FileStore } from "../../src/server/file-store";
import { join } from "path";
import { mkdirSync, writeFileSync, readFileSync, rmSync } from "fs";

const TMP = join(import.meta.dirname, "__tmp_files__");

describe("File API routes", () => {
  let handler: RouteHandler;
  let fileStore: FileStore;

  beforeEach(() => {
    mkdirSync(TMP, { recursive: true });
    fileStore = new FileStore();
    handler = new RouteHandler(new DocumentStore(), new LensManager([], "claude-sonnet-4-6"), fileStore, TMP);
  });

  afterEach(() => {
    rmSync(TMP, { recursive: true, force: true });
  });

  describe("GET /api/file", () => {
    it("reads existing file and sets active path", async () => {
      writeFileSync(join(TMP, "test.md"), "# Hello");
      const req = new Request(`http://localhost/api/file?path=${encodeURIComponent("test.md")}`);
      const res = await handler.handle(req);
      const body = await res!.json();
      expect(body.content).toBe("# Hello");
      expect(body.filename).toBe("test.md");
      expect(body.path).toBeDefined();
      expect(fileStore.activePath).toContain("test.md");
    });

    it("returns 404 for missing file", async () => {
      const req = new Request("http://localhost/api/file?path=nope.md");
      const res = await handler.handle(req);
      expect(res!.status).toBe(404);
    });
  });

  describe("POST /api/file", () => {
    it("writes to active path", async () => {
      writeFileSync(join(TMP, "doc.md"), "old");
      await handler.handle(new Request(`http://localhost/api/file?path=doc.md`));

      const req = new Request("http://localhost/api/file", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: "new content" }),
      });
      const res = await handler.handle(req);
      const body = await res!.json();
      expect(body.ok).toBe(true);

      const onDisk = readFileSync(join(TMP, "doc.md"), "utf8");
      expect(onDisk).toBe("new content");
    });

    it("creates new file when path provided", async () => {
      const req = new Request("http://localhost/api/file", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: "fresh", path: "new.md" }),
      });
      const res = await handler.handle(req);
      const body = await res!.json();
      expect(body.ok).toBe(true);
      expect(body.filename).toBe("new.md");

      const onDisk = readFileSync(join(TMP, "new.md"), "utf8");
      expect(onDisk).toBe("fresh");
      expect(fileStore.activePath).toContain("new.md");
    });

    it("returns 400 when no active path and no path given", async () => {
      const req = new Request("http://localhost/api/file", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: "orphan" }),
      });
      const res = await handler.handle(req);
      expect(res!.status).toBe(400);
    });
  });

  describe("GET /api/files", () => {
    it("lists .md files in CWD alphabetically", async () => {
      writeFileSync(join(TMP, "beta.md"), "");
      writeFileSync(join(TMP, "alpha.md"), "");
      writeFileSync(join(TMP, "ignore.txt"), "");

      const req = new Request("http://localhost/api/files");
      const res = await handler.handle(req);
      const body = await res!.json();
      expect(body.files).toHaveLength(2);
      expect(body.files[0].name).toBe("alpha.md");
      expect(body.files[1].name).toBe("beta.md");
    });

    it("returns empty array when no md files", async () => {
      const req = new Request("http://localhost/api/files");
      const res = await handler.handle(req);
      const body = await res!.json();
      expect(body.files).toEqual([]);
    });
  });
});
