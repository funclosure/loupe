import { useEffect, useRef, useCallback } from "react";
import type { SSEEvent } from "@shared/types";

export function useSSE(onEvent: (event: SSEEvent | { type: "init"; active: any[] }) => void) {
  const eventSourceRef = useRef<EventSource | null>(null);
  const retriesRef = useRef(0);
  const maxRetries = 10;

  const connect = useCallback(() => {
    const es = new EventSource("/api/events");
    es.onmessage = (e) => {
      try { const event = JSON.parse(e.data); onEvent(event); retriesRef.current = 0; }
      catch { /* Ignore parse errors */ }
    };
    es.onerror = () => {
      es.close(); eventSourceRef.current = null;
      if (retriesRef.current < maxRetries) {
        const delay = Math.min(1000 * 2 ** retriesRef.current, 30000);
        retriesRef.current++;
        setTimeout(connect, delay);
      }
    };
    eventSourceRef.current = es;
  }, [onEvent]);

  useEffect(() => { connect(); return () => { eventSourceRef.current?.close(); }; }, [connect]);
}
