import type { LensDefinition } from "@shared/types";
import { readdir } from "fs/promises";
import { join } from "path";

export function parseLensMd(raw: string, id: string): LensDefinition | null {
  const fmMatch = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!fmMatch) return null;

  const frontmatter = fmMatch[1];
  const body = fmMatch[2].trim();

  const fields: Record<string, string> = {};
  for (const line of frontmatter.split("\n")) {
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    const value = line.slice(colonIdx + 1).trim().replace(/^["']|["']$/g, "");
    fields[key] = value;
  }

  if (!fields.name || !fields.description) return null;

  const defaultColor = "#" + Array.from(id)
    .reduce((hash, char) => ((hash << 5) - hash + char.charCodeAt(0)) | 0, 0)
    .toString(16).slice(-6).padStart(6, "8");

  return {
    id,
    name: fields.name,
    icon: fields.icon || fields.name[0],
    color: fields.color || defaultColor,
    description: fields.description,
    systemPrompt: body,
    model: fields.model || undefined,
    source: "user",
  };
}

export async function loadUserLenses(lensesDir: string): Promise<LensDefinition[]> {
  const lenses: LensDefinition[] = [];
  try {
    const entries = await readdir(lensesDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const lensPath = join(lensesDir, entry.name, "LENS.md");
      try {
        const raw = await Bun.file(lensPath).text();
        const lens = parseLensMd(raw, entry.name);
        if (lens) lenses.push(lens);
        else console.warn(`Skipping malformed LENS.md: ${lensPath}`);
      } catch {
        /* No LENS.md — skip */
      }
    }
  } catch {
    /* lenses/ directory doesn't exist */
  }
  return lenses;
}
