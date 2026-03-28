import { useState, useCallback } from "react";
import type { LensDefinition, ActiveLens, ChatMessage, SSEEvent } from "@shared/types";

interface LensUIState extends ActiveLens {
  messages: ChatMessage[];
  streamingContent: string;
  expanded: boolean;
}

export function useLenses() {
  const [available, setAvailable] = useState<LensDefinition[]>([]);
  const [lenses, setLenses] = useState<Map<string, LensUIState>>(new Map());
  const [pickerOpen, setPickerOpen] = useState(false);

  const fetchLenses = useCallback(async () => {
    const res = await fetch("/api/lenses");
    const data = await res.json();
    setAvailable(data.available);
  }, []);

  const activate = useCallback(async (definitionId: string) => {
    const res = await fetch("/api/lenses/activate", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ definitionId }),
    });
    const { lensId, error } = await res.json();
    if (error) return;
    const def = available.find((d) => d.id === definitionId);
    if (!def) return;
    setLenses((prev) => {
      const next = new Map(prev);
      next.set(lensId, {
        lensId, definitionId, status: "idle", preview: null, error: null,
        messages: [], streamingContent: "", expanded: false,
      });
      return next;
    });
  }, [available]);

  const deactivate = useCallback(async (lensId: string) => {
    await fetch(`/api/lens/${lensId}/deactivate`, { method: "POST" });
    setLenses((prev) => { const next = new Map(prev); next.delete(lensId); return next; });
  }, []);

  const ask = useCallback(async (lensId: string, message: string) => {
    setLenses((prev) => {
      const next = new Map(prev);
      const lens = next.get(lensId);
      if (lens) { lens.messages = [...lens.messages, { role: "user", content: message }]; lens.streamingContent = ""; }
      return next;
    });
    await fetch(`/api/lens/${lensId}/ask`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });
  }, []);

  const focus = useCallback(async (lensId: string, paragraphText: string, version: number) => {
    await fetch(`/api/lens/${lensId}/focus`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paragraphText, version }),
    });
  }, []);

  const rethink = useCallback(async (lensId: string) => {
    await fetch(`/api/lens/${lensId}/rethink`, { method: "POST" });
  }, []);

  const resetLens = useCallback(async (lensId: string) => {
    await fetch(`/api/lens/${lensId}/reset`, { method: "POST" });
    setLenses((prev) => {
      const next = new Map(prev);
      const lens = next.get(lensId);
      if (lens) { lens.messages = []; lens.streamingContent = ""; lens.preview = null; lens.status = "idle"; }
      return next;
    });
  }, []);

  const toggleExpanded = useCallback((lensId: string) => {
    setLenses((prev) => {
      const next = new Map(prev);
      const lens = next.get(lensId);
      if (lens) lens.expanded = !lens.expanded;
      return next;
    });
  }, []);

  const handleSSEEvent = useCallback((event: SSEEvent | { type: "init"; active: any[] }) => {
    if (event.type === "init") return;
    setLenses((prev) => {
      const next = new Map(prev);
      const lens = next.get(event.lensId);
      if (!lens) return prev;
      switch (event.type) {
        case "lens:thinking": lens.status = "thinking"; lens.streamingContent = ""; break;
        case "lens:bubble": lens.preview = event.preview; lens.status = "idle"; break;
        case "lens:message":
          if (event.done) {
            if (lens.streamingContent) {
              lens.messages = [...lens.messages, { role: "lens", content: lens.streamingContent }];
              lens.preview = lens.streamingContent.slice(0, 120);
            }
            lens.streamingContent = ""; lens.status = "idle";
          } else { lens.streamingContent += event.delta; }
          break;
        case "lens:error": lens.status = "error"; lens.error = event.error; break;
        case "lens:removed": next.delete(event.lensId); break;
      }
      return next;
    });
  }, []);

  return {
    available, lenses, pickerOpen, setPickerOpen, fetchLenses, activate,
    deactivate, ask, focus, rethink, resetLens, toggleExpanded, handleSSEEvent,
  };
}
