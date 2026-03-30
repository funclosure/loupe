import { query, type Query } from "@anthropic-ai/claude-agent-sdk";
import type { LensDefinition, LensStatus, ChatMessage } from "@shared/types";

type SDKMessage = {
  type: string;
  event?: {
    type?: string;
    delta?: { type?: string; text?: string };
  };
  [key: string]: unknown;
};

type UserMessage = {
  type: "user";
  message: { role: "user"; content: string };
  parent_tool_use_id: null;
  session_id: string;
};

// Async channel that keeps the query alive for multi-turn conversation
// (same pattern as pace)
class MessageChannel {
  private queue: UserMessage[] = [];
  private waiting: ((msg: UserMessage) => void) | null = null;

  push(content: string) {
    const msg: UserMessage = {
      type: "user",
      message: { role: "user", content },
      parent_tool_use_id: null,
      session_id: "default",
    };
    if (this.waiting) {
      const resolve = this.waiting;
      this.waiting = null;
      resolve(msg);
    } else {
      this.queue.push(msg);
    }
  }

  async *[Symbol.asyncIterator](): AsyncGenerator<UserMessage> {
    while (true) {
      if (this.queue.length > 0) {
        yield this.queue.shift()!;
      } else {
        yield await new Promise<UserMessage>((resolve) => {
          this.waiting = resolve;
        });
      }
    }
  }
}

export class LensSession {
  readonly definition: LensDefinition;
  readonly model: string;
  status: LensStatus = "idle";
  history: ChatMessage[] = [];
  preview: string | null = null;

  private q: Query | null = null;
  private iter: AsyncIterator<SDKMessage> | null = null;
  private channel = new MessageChannel();
  private started = false;

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
    prompt += `\n\nRead the full document to understand the writer's voice and intent.\nFocus your response on the passage they're working on.\nHelp them think — don't give answers, ask the question they haven't asked yet.\n1–3 sentences unless they ask for more.`;
    return prompt;
  }

  async start(documentContent: string, initialMessage: string, focusedParagraph?: string): Promise<void> {
    const systemPrompt = this.buildSystemPrompt(documentContent, focusedParagraph);

    this.channel.push(initialMessage);

    this.q = query({
      prompt: this.channel as any,
      options: {
        systemPrompt,
        model: this.model,
        permissionMode: "bypassPermissions",
        allowDangerouslySkipPermissions: true,
        allowedTools: [],
        disallowedTools: [
          "Bash", "Read", "Write", "Edit", "Glob", "Grep",
          "Agent", "WebFetch", "WebSearch", "NotebookEdit",
        ],
        includePartialMessages: true,
      },
    }) as Query;

    this.iter = (this.q as AsyncIterable<SDKMessage>)[Symbol.asyncIterator]();
    this.started = true;
  }

  send(message: string): void {
    if (!this.q) throw new Error("Session not started");
    this.channel.push(message);
  }

  async *receive(): AsyncGenerator<{ type: "text"; text: string } | { type: "done" } | { type: "error"; error: string }> {
    if (!this.iter) return;

    this.status = "thinking";
    let fullResponse = "";

    try {
      while (true) {
        const { value: msg, done } = await this.iter.next();
        if (done || !msg) break;

        if (msg.type === "stream_event" && msg.event) {
          const delta = msg.event.delta;
          if (
            msg.event.type === "content_block_delta" &&
            delta?.type === "text_delta" &&
            delta.text
          ) {
            fullResponse += delta.text;
            yield { type: "text", text: delta.text };
          }
        }

        if (msg.type === "result") {
          break;
        }
      }

      this.addToHistory("user", ""); // placeholder — actual message already in channel
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

  get isStarted(): boolean {
    return this.started;
  }

  addToHistory(role: "user" | "lens", content: string): void {
    this.history.push({ role, content });
  }

  reset(): void {
    this.close();
    this.history = [];
    this.status = "idle";
    this.preview = null;
    this.started = false;
    this.channel = new MessageChannel();
  }

  close(): void {
    if (this.q) {
      this.q.close();
      this.q = null;
      this.iter = null;
    }
  }
}
