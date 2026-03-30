import type { LensDefinition, ActiveLens } from "@shared/types";
import { LensSession } from "./lens-session";
import { nanoid } from "nanoid";

const MAX_LENSES = 5;

export class LensManager {
  private definitions: Map<string, LensDefinition>;
  private sessions: Map<string, LensSession> = new Map();
  private defaultModel: string;

  constructor(lenses: LensDefinition[], defaultModel: string) {
    this.definitions = new Map(lenses.map((l) => [l.id, l]));
    this.defaultModel = defaultModel;
  }

  addDefinitions(lenses: LensDefinition[]): void {
    for (const lens of lenses) this.definitions.set(lens.id, lens);
  }

  availableLenses(): LensDefinition[] {
    return Array.from(this.definitions.values());
  }

  activate(definitionId: string): string {
    const definition = this.definitions.get(definitionId);
    if (!definition) throw new Error(`Unknown lens: ${definitionId}`);
    if (definition.source !== "system" && this.sessions.size >= MAX_LENSES)
      throw new Error("Maximum 5 concurrent lenses");
    const lensId = nanoid(8);
    this.sessions.set(lensId, new LensSession(definition, this.defaultModel));
    return lensId;
  }

  deactivate(lensId: string): void {
    this.sessions.delete(lensId);
  }

  getSession(lensId: string): LensSession | undefined {
    return this.sessions.get(lensId);
  }

  activeSessions(): ActiveLens[] {
    return Array.from(this.sessions.entries()).map(([lensId, session]) => ({
      lensId,
      definitionId: session.definition.id,
      status: session.status,
      preview: session.preview,
      error: null,
    }));
  }

  resetAll(): void {
    this.sessions.clear();
  }
}
