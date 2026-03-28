import { describe, it, expect, beforeEach } from "vitest";
import { DocumentStore } from "../../src/server/document";

describe("DocumentStore", () => {
  let store: DocumentStore;
  beforeEach(() => { store = new DocumentStore(); });

  it("starts with empty content and version 0", () => {
    expect(store.get().content).toBe("");
    expect(store.get().version).toBe(0);
  });

  it("updates content and version", () => {
    store.update({ content: "hello", version: 1 });
    expect(store.get().content).toBe("hello");
    expect(store.get().version).toBe(1);
  });

  it("rejects stale updates (version <= current)", () => {
    store.update({ content: "v1", version: 1 });
    store.update({ content: "stale", version: 1 });
    expect(store.get().content).toBe("v1");
  });

  it("stores cursor and selection", () => {
    store.update({ content: "text", version: 1, cursor: 4, selection: { from: 0, to: 4 } });
    const state = store.get();
    expect(state.cursor).toBe(4);
    expect(state.selection).toEqual({ from: 0, to: 4 });
  });
});
