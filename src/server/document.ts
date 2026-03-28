import type { DocumentState, DocumentSyncBody } from "@shared/types";

export class DocumentStore {
  private state: DocumentState = { content: "", version: 0 };

  get(): DocumentState {
    return { ...this.state };
  }

  update(body: DocumentSyncBody): boolean {
    if (body.version <= this.state.version) return false;
    this.state = {
      content: body.content,
      version: body.version,
      cursor: body.cursor,
      selection: body.selection,
    };
    return true;
  }

  reset(): void {
    this.state = { content: "", version: 0 };
  }
}
