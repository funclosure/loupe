import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { RouteHandler } from "../../src/server/routes";
import { DocumentStore } from "../../src/server/document";
import { LensManager } from "../../src/server/lens-manager";
import { FileStore } from "../../src/server/file-store";
import { LENS_PRESETS } from "../../src/shared/lens-presets";
import { join } from "path";
import { mkdirSync, rmSync, existsSync, readFileSync } from "fs";

const TMP = join(import.meta.dirname, "__tmp_lenses__");

describe("POST /api/lenses/create", () => {
  let handler: RouteHandler;
  let lensManager: LensManager;

  beforeEach(() => {
    mkdirSync(TMP, { recursive: true });
    lensManager = new LensManager([...LENS_PRESETS], "claude-sonnet-4-6");
    handler = new RouteHandler(new DocumentStore(), lensManager, new FileStore(), TMP);
  });

  afterEach(() => {
    rmSync(TMP, { recursive: true, force: true });
  });

  it("creates a lens and returns the definition", async () => {
    const req = new Request("http://localhost/api/lenses/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Test Lens",
        description: "A test",
        icon: "T",
        color: "#ff0000",
        systemPrompt: "You are a test lens.",
      }),
    });
    const res = await handler.handle(req);
    expect(res!.status).toBe(201);
    const body = await res!.json();
    expect(body.ok).toBe(true);
    expect(body.lens.name).toBe("Test Lens");
    expect(body.lens.id).toBe("test-lens");
    expect(body.lens.source).toBe("user");

    const lensPath = join(TMP, ".loupe", "lenses", "test-lens", "LENS.md");
    expect(existsSync(lensPath)).toBe(true);
    const content = readFileSync(lensPath, "utf8");
    expect(content).toContain("name: Test Lens");
    expect(content).toContain("You are a test lens.");
  });

  it("handles slug collisions by appending suffix", async () => {
    await handler.handle(new Request("http://localhost/api/lenses/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "My Lens", description: "First", icon: "M",
        color: "#000", systemPrompt: "First.",
      }),
    }));

    const res = await handler.handle(new Request("http://localhost/api/lenses/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "My Lens", description: "Second", icon: "M",
        color: "#000", systemPrompt: "Second.",
      }),
    }));
    const body = await res!.json();
    expect(body.lens.id).toBe("my-lens-2");
  });

  it("returns 400 for missing required fields", async () => {
    const req = new Request("http://localhost/api/lenses/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "No Prompt" }),
    });
    const res = await handler.handle(req);
    expect(res!.status).toBe(400);
  });
});
