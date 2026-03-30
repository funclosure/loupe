import { describe, it, expect, beforeEach } from "vitest";
import { LensSession } from "../../src/server/lens-session";
import type { LensDefinition } from "../../src/shared/types";

const testLens: LensDefinition = {
  id: "test", name: "Test Lens", icon: "T", color: "#ff0000",
  description: "A test lens", systemPrompt: "You are a test lens.", source: "preset",
};

describe("LensSession", () => {
  let session: LensSession;
  beforeEach(() => { session = new LensSession(testLens, "claude-sonnet-4-6"); });

  it("starts idle with empty history", () => {
    expect(session.status).toBe("idle");
    expect(session.history).toHaveLength(0);
  });

  it("builds system prompt from lens definition", () => {
    const system = session.buildSystemPrompt("Hello world document.");
    expect(system).toContain("You are a test lens.");
    expect(system).toContain("Hello world document.");
  });

  it("builds system prompt with focus", () => {
    const system = session.buildSystemPrompt("Full doc.", "Focused paragraph.");
    expect(system).toContain("Full doc.");
    expect(system).toContain("Focused paragraph.");
  });

  it("builds system prompt with thinking companion instruction", () => {
    const system = session.buildSystemPrompt("Hello world document.");
    expect(system).toContain("Help them think");
    expect(system).toContain("the question they haven't asked yet");
    expect(system).toContain("1–3 sentences unless they ask for more");
  });

  it("resets history and state", () => {
    session.addToHistory("user", "hello");
    session.addToHistory("lens", "hi back");
    expect(session.history).toHaveLength(2);
    session.reset();
    expect(session.history).toHaveLength(0);
    expect(session.status).toBe("idle");
  });

  it("starts as not started", () => {
    expect(session.isStarted).toBe(false);
  });

  it("tracks the effective model (per-lens or default)", () => {
    expect(session.model).toBe("claude-sonnet-4-6");
    const lensWithModel = { ...testLens, model: "claude-haiku-4-5-20251001" };
    const session2 = new LensSession(lensWithModel, "claude-sonnet-4-6");
    expect(session2.model).toBe("claude-haiku-4-5-20251001");
  });

  it("skips document context when skipDocumentContext is true", () => {
    const metaLens = {
      ...testLens,
      skipDocumentContext: true,
      systemPrompt: "You help create lenses.",
    };
    const metaSession = new LensSession(metaLens, "claude-sonnet-4-6");
    const system = metaSession.buildSystemPrompt("Some document text.");
    expect(system).toBe("You help create lenses.");
    expect(system).not.toContain("Some document text");
    expect(system).not.toContain("Help them think");
  });
});
