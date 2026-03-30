import { describe, it, expect, beforeEach } from "vitest";
import { LensManager } from "../../src/server/lens-manager";
import { LENS_PRESETS } from "../../src/shared/lens-presets";

describe("LensManager", () => {
  let manager: LensManager;
  beforeEach(() => { manager = new LensManager(LENS_PRESETS, "claude-sonnet-4-6"); });

  it("lists available lenses (presets + user)", () => {
    expect(manager.availableLenses()).toHaveLength(6);
  });
  it("activates a lens and returns session id", () => {
    const id = manager.activate("devils-advocate");
    expect(id).toBeTruthy();
    expect(manager.activeSessions()).toHaveLength(1);
  });
  it("refuses to activate more than 5 lenses", () => {
    manager.activate("devils-advocate"); manager.activate("intuition-pump");
    manager.activate("first-principles"); manager.activate("empathetic-reader");
    manager.activate("copy-editor");
    expect(() => manager.activate("devils-advocate")).toThrow("Maximum 5 concurrent lenses");
  });
  it("deactivates a lens", () => {
    const id = manager.activate("devils-advocate");
    manager.deactivate(id);
    expect(manager.activeSessions()).toHaveLength(0);
  });
  it("throws on unknown lens definition", () => {
    expect(() => manager.activate("nonexistent")).toThrow();
  });
  it("resets all sessions", () => {
    manager.activate("devils-advocate"); manager.activate("intuition-pump");
    manager.resetAll();
    expect(manager.activeSessions()).toHaveLength(0);
  });
});
