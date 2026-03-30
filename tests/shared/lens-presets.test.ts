import { describe, it, expect } from "vitest";
import { LENS_PRESETS } from "../../src/shared/lens-presets";

describe("LENS_PRESETS", () => {
  it("has 6 built-in presets", () => {
    expect(LENS_PRESETS).toHaveLength(6);
  });

  it("each preset has required fields", () => {
    for (const preset of LENS_PRESETS) {
      expect(preset.id).toBeTruthy();
      expect(preset.name).toBeTruthy();
      expect(preset.icon).toHaveLength(1);
      expect(preset.color).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(preset.description).toBeTruthy();
      expect(preset.systemPrompt).toBeTruthy();
      expect(["preset", "system"]).toContain(preset.source);
    }
  });
});
