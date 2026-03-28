import { describe, it, expect } from "vitest";
import { highlightCode } from "../../src/client/editor/shiki";

describe("highlightCode", () => {
  it("returns HTML with <pre> and <code> tags", async () => {
    const html = await highlightCode("const x = 1", "javascript");
    expect(html).toContain("<pre");
    expect(html).toContain("<code");
    expect(html).toContain("const");
  });
  it("falls back to plaintext for unknown languages", async () => {
    const html = await highlightCode("hello", "notalanguage");
    expect(html).toContain("hello");
  });
  it("handles plaintext language", async () => {
    const html = await highlightCode("hello world", "plaintext");
    expect(html).toContain("hello world");
  });
  it("returns valid HTML for empty code", async () => {
    const html = await highlightCode("", "javascript");
    expect(html).toContain("<pre");
  });
});
