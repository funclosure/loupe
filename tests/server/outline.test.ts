import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { RouteHandler } from "../../src/server/routes";
import { DocumentStore } from "../../src/server/document";
import { LensManager } from "../../src/server/lens-manager";
import { FileStore } from "../../src/server/file-store";
import { LENS_PRESETS } from "../../src/shared/lens-presets";
import { join } from "path";
import { mkdirSync, writeFileSync, rmSync, readFileSync, existsSync } from "fs";

const TMP = join(import.meta.dirname, "__tmp_outline__");

describe("Outline API", () => {
  let handler: RouteHandler;
  let fileStore: FileStore;

  beforeEach(() => {
    mkdirSync(TMP, { recursive: true });
    fileStore = new FileStore();
    handler = new RouteHandler(
      new DocumentStore(),
      new LensManager([...LENS_PRESETS], "claude-sonnet-4-6"),
      fileStore,
      TMP
    );
  });

  afterEach(() => {
    rmSync(TMP, { recursive: true, force: true });
  });

  it("GET /api/outline returns empty when no active file", async () => {
    const res = await handler.handle(new Request("http://localhost/api/outline"));
    const body = await res!.json();
    expect(body.content).toBe("");
  });

  it("GET /api/outline returns empty when no sidecar exists", async () => {
    writeFileSync(join(TMP, "test.md"), "content");
    await handler.handle(new Request("http://localhost/api/file?path=test.md"));
    const res = await handler.handle(new Request("http://localhost/api/outline"));
    const body = await res!.json();
    expect(body.content).toBe("");
  });

  it("POST /api/outline writes sidecar, GET reads it back", async () => {
    writeFileSync(join(TMP, "test.md"), "content");
    await handler.handle(new Request("http://localhost/api/file?path=test.md"));

    await handler.handle(new Request("http://localhost/api/outline", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: "Core thesis: time is presence." }),
    }));

    expect(existsSync(join(TMP, "test.outline.md"))).toBe(true);

    const res = await handler.handle(new Request("http://localhost/api/outline"));
    const body = await res!.json();
    expect(body.content).toBe("Core thesis: time is presence.");
  });

  it("FileStore.outlinePath derives from active path", () => {
    fileStore.setActive("/tmp/essay.md");
    expect(fileStore.outlinePath).toBe("/tmp/essay.outline.md");

    fileStore.setActive("/tmp/post.mdx");
    expect(fileStore.outlinePath).toBe("/tmp/post.outline.md");
  });

  it("FileStore.outlinePath is null when no active file", () => {
    expect(fileStore.outlinePath).toBeNull();
  });
});
