import Anthropic from "@anthropic-ai/sdk";
import type { LensDefinition, LensStatus, ChatMessage } from "@shared/types";

export class LensSession {
  readonly definition: LensDefinition;
  readonly model: string;
  status: LensStatus = "idle";
  history: ChatMessage[] = [];
  preview: string | null = null;
  private client: Anthropic | null = null;

  constructor(definition: LensDefinition, defaultModel: string) {
    this.definition = definition;
    this.model = definition.model || defaultModel;
  }

  buildSystemPrompt(documentContent: string, focusedParagraph?: string): string {
    let prompt = this.definition.systemPrompt;
    prompt += `\n\nYou are reading the following document:\n\n${documentContent}`;
    if (focusedParagraph) {
      prompt += `\n\nThe writer is currently focused on this passage:\n\n${focusedParagraph}`;
    }
    return prompt;
  }

  addToHistory(role: "user" | "lens", content: string): void {
    this.history.push({ role, content });
  }

  reset(): void {
    this.history = [];
    this.status = "idle";
    this.preview = null;
  }

  private getClient(): Anthropic {
    if (!this.client) this.client = new Anthropic();
    return this.client;
  }

  async *stream(
    documentContent: string,
    userMessage: string,
    focusedParagraph?: string,
  ): AsyncGenerator<
    | { type: "delta"; text: string }
    | { type: "done" }
    | { type: "error"; error: string }
  > {
    this.status = "thinking";
    try {
      const client = this.getClient();
      const systemPrompt = this.buildSystemPrompt(documentContent, focusedParagraph);
      const messages: Anthropic.MessageParam[] = this.history.map((msg) => ({
        role: msg.role === "lens" ? ("assistant" as const) : ("user" as const),
        content: msg.content,
      }));
      messages.push({ role: "user", content: userMessage });

      const stream = client.messages.stream({
        model: this.model,
        max_tokens: 1024,
        system: systemPrompt,
        messages,
      });

      let fullResponse = "";
      for await (const event of stream) {
        if (
          event.type === "content_block_delta" &&
          event.delta.type === "text_delta"
        ) {
          fullResponse += event.delta.text;
          yield { type: "delta", text: event.delta.text };
        }
      }
      this.addToHistory("user", userMessage);
      this.addToHistory("lens", fullResponse);
      this.preview = fullResponse.slice(0, 120);
      this.status = "idle";
      yield { type: "done" };
    } catch (err) {
      this.status = "error";
      yield {
        type: "error",
        error: err instanceof Error ? err.message : "Unknown error",
      };
    }
  }
}
