import { describe, it, expect } from "vitest";
import { parseLensMd } from "../../src/server/lens-loader";

describe("parseLensMd", () => {
  it("parses valid LENS.md with all fields", () => {
    const raw = `---
name: Heidegger
icon: H
color: "#7c3aed"
description: Phenomenological perspective
model: claude-haiku-4-5-20251001
---

You are Heidegger. Think about being.`;

    const result = parseLensMd(raw, "heidegger");
    expect(result).not.toBeNull();
    expect(result!.name).toBe("Heidegger");
    expect(result!.icon).toBe("H");
    expect(result!.color).toBe("#7c3aed");
    expect(result!.description).toBe("Phenomenological perspective");
    expect(result!.model).toBe("claude-haiku-4-5-20251001");
    expect(result!.systemPrompt).toBe("You are Heidegger. Think about being.");
    expect(result!.source).toBe("user");
    expect(result!.id).toBe("heidegger");
  });

  it("uses defaults for optional fields", () => {
    const raw = `---
name: Zen Master
description: Minimal wisdom
---

Be still.`;

    const result = parseLensMd(raw, "zen-master");
    expect(result).not.toBeNull();
    expect(result!.icon).toBe("Z");
    expect(result!.color).toMatch(/^#[0-9a-f]{6}$/);
    expect(result!.model).toBeUndefined();
  });

  it("returns null for missing required fields", () => {
    const raw = `---
name: Incomplete
---

No description.`;
    expect(parseLensMd(raw, "incomplete")).toBeNull();
  });

  it("returns null for missing frontmatter", () => {
    expect(parseLensMd("Just text, no frontmatter.", "bad")).toBeNull();
  });
});
