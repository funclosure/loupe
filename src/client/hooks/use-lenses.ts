import { useState, useCallback, useRef } from "react";
import type { LensDefinition, ActiveLens, ChatMessage } from "@shared/types";

interface LensUIState extends ActiveLens {
  messages: ChatMessage[];
  streamingContent: string;
  expanded: boolean;
}

/**
 * Read an SSE stream from a fetch response (pace pattern).
 * Parses `data: {...}\n\n` lines and calls handlers for text/done/error.
 */
async function readStream(
  res: Response,
  onText: (text: string) => void,
  onDone: () => void,
  onError: (error: string) => void
) {
  if (!res.ok || !res.body) {
    onError(`Server error (${res.status})`);
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      try {
        const data = JSON.parse(line.slice(6));
        if (data.text) onText(data.text);
        if (data.done) onDone();
        if (data.error) onError(data.error);
      } catch {
        // Ignore malformed lines
      }
    }
  }
}

export function useLenses() {
  const [available, setAvailable] = useState<LensDefinition[]>([]);
  const [lenses, setLenses] = useState<Map<string, LensUIState>>(new Map());
  const [pickerOpen, setPickerOpen] = useState(false);
  // Track streaming content outside React state for real-time accumulation
  const streamingRef = useRef<Map<string, string>>(new Map());

  const fetchLenses = useCallback(async () => {
    const res = await fetch("/api/lenses");
    const data = await res.json();
    setAvailable(data.available);
  }, []);

  const activate = useCallback(async (definitionId: string) => {
    const res = await fetch("/api/lenses/activate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ definitionId }),
    });
    const { lensId, error } = await res.json();
    if (error) return;
    const def = available.find((d) => d.id === definitionId);
    if (!def) return;
    setLenses((prev) => {
      const next = new Map(prev);
      next.set(lensId, {
        lensId,
        definitionId,
        status: "idle",
        preview: null,
        error: null,
        messages: [],
        streamingContent: "",
        expanded: false,
      });
      return next;
    });
  }, [available]);

  const deactivate = useCallback(async (lensId: string) => {
    await fetch(`/api/lens/${lensId}/deactivate`, { method: "POST" });
    setLenses((prev) => {
      const next = new Map(prev);
      next.delete(lensId);
      return next;
    });
  }, []);

  /**
   * Stream a lens response from a POST endpoint.
   * Updates lens state (thinking → streaming → idle) as data arrives.
   */
  const streamFromEndpoint = useCallback(
    async (lensId: string, url: string, body: object) => {
      // Set thinking state
      setLenses((prev) => {
        const next = new Map(prev);
        const lens = next.get(lensId);
        if (lens) {
          lens.status = "thinking";
          lens.streamingContent = "";
        }
        return next;
      });
      streamingRef.current.set(lensId, "");

      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        await readStream(
          res,
          // onText
          (text) => {
            const accumulated = (streamingRef.current.get(lensId) || "") + text;
            streamingRef.current.set(lensId, accumulated);
            setLenses((prev) => {
              const next = new Map(prev);
              const lens = next.get(lensId);
              if (lens) {
                lens.streamingContent = accumulated;
                lens.status = "thinking";
              }
              return next;
            });
          },
          // onDone
          () => {
            const fullText = streamingRef.current.get(lensId) || "";
            streamingRef.current.delete(lensId);
            setLenses((prev) => {
              const next = new Map(prev);
              const lens = next.get(lensId);
              if (lens) {
                if (fullText) {
                  lens.messages = [...lens.messages, { role: "lens", content: fullText }];
                  lens.preview = fullText.slice(0, 120);
                }
                lens.streamingContent = "";
                lens.status = "idle";
              }
              return next;
            });
          },
          // onError
          (error) => {
            streamingRef.current.delete(lensId);
            setLenses((prev) => {
              const next = new Map(prev);
              const lens = next.get(lensId);
              if (lens) {
                lens.status = "error";
                lens.error = error;
                lens.streamingContent = "";
              }
              return next;
            });
          }
        );
      } catch (err) {
        streamingRef.current.delete(lensId);
        setLenses((prev) => {
          const next = new Map(prev);
          const lens = next.get(lensId);
          if (lens) {
            lens.status = "error";
            lens.error = err instanceof Error ? err.message : "Connection failed";
            lens.streamingContent = "";
          }
          return next;
        });
      }
    },
    []
  );

  const ask = useCallback(
    async (lensId: string, message: string) => {
      // Add user message to local state immediately
      setLenses((prev) => {
        const next = new Map(prev);
        const lens = next.get(lensId);
        if (lens) {
          lens.messages = [...lens.messages, { role: "user", content: message }];
        }
        return next;
      });
      await streamFromEndpoint(lensId, `/api/lens/${lensId}/ask`, { message });
    },
    [streamFromEndpoint]
  );

  const focus = useCallback(
    async (lensId: string, paragraphText: string, version: number) => {
      await streamFromEndpoint(lensId, `/api/lens/${lensId}/focus`, {
        paragraphText,
        version,
      });
    },
    [streamFromEndpoint]
  );

  const rethink = useCallback(
    async (lensId: string) => {
      await streamFromEndpoint(lensId, `/api/lens/${lensId}/rethink`, {});
    },
    [streamFromEndpoint]
  );

  const resetLens = useCallback(async (lensId: string) => {
    await fetch(`/api/lens/${lensId}/reset`, { method: "POST" });
    setLenses((prev) => {
      const next = new Map(prev);
      const lens = next.get(lensId);
      if (lens) {
        lens.messages = [];
        lens.streamingContent = "";
        lens.preview = null;
        lens.status = "idle";
        lens.error = null;
      }
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

  return {
    available,
    lenses,
    pickerOpen,
    setPickerOpen,
    fetchLenses,
    activate,
    deactivate,
    ask,
    focus,
    rethink,
    resetLens,
    toggleExpanded,
  };
}
