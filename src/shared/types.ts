// -- Lens definition (parsed from LENS.md or built-in preset) --

export interface LensDefinition {
  id: string; // directory name or preset key
  name: string;
  icon: string; // single char or emoji
  color: string; // hex color
  description: string;
  systemPrompt: string;
  model?: string; // optional per-lens model override
  source: "preset" | "user";
}

// -- Document state --

export interface DocumentState {
  content: string;
  version: number;
  cursor?: number;
  selection?: { from: number; to: number };
}

// -- Lens session state --

export type LensStatus = "idle" | "thinking" | "error";

export interface ActiveLens {
  lensId: string;
  definitionId: string;
  status: LensStatus;
  preview: string | null; // latest bubble preview text
  error: string | null;
}

// -- API request bodies --

export interface DocumentSyncBody {
  content: string;
  version: number;
  cursor?: number;
  selection?: { from: number; to: number };
}

export interface LensFocusBody {
  paragraphText: string;
  version: number;
}

export interface LensAskBody {
  message: string;
}

// -- Chat messages (for expanded lens chat) --

export interface ChatMessage {
  role: "user" | "lens";
  content: string;
}
