import { describe, it, expect, beforeEach } from "vitest";
import { FileStore } from "../../src/server/file-store";

describe("FileStore", () => {
  let store: FileStore;
  beforeEach(() => { store = new FileStore(); });

  it("starts with no active path", () => {
    expect(store.activePath).toBeNull();
  });

  it("sets and gets active path", () => {
    store.setActive("/tmp/test.md");
    expect(store.activePath).toBe("/tmp/test.md");
    expect(store.activeFilename).toBe("test.md");
  });

  it("replaces active path on subsequent set", () => {
    store.setActive("/tmp/a.md");
    store.setActive("/tmp/b.md");
    expect(store.activePath).toBe("/tmp/b.md");
    expect(store.activeFilename).toBe("b.md");
  });

  it("clears active path", () => {
    store.setActive("/tmp/test.md");
    store.clear();
    expect(store.activePath).toBeNull();
  });
});
