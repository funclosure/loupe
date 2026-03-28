import { useEffect, useRef } from "react";
import type { SSEEvent } from "@shared/types";

export function useSSE(onEvent: (event: SSEEvent | { type: "init"; active: any[] }) => void) {
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  const eventSourceRef = useRef<EventSource | null>(null);
  const retriesRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const maxRetries = 10;

    function connect() {
      // Clean up any pending retry
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }

      const es = new EventSource("/api/events");

      es.onmessage = (e) => {
        try {
          const event = JSON.parse(e.data);
          onEventRef.current(event);
          retriesRef.current = 0;
        } catch {
          // Ignore parse errors
        }
      };

      es.onerror = () => {
        es.close();
        eventSourceRef.current = null;

        if (retriesRef.current < maxRetries) {
          const delay = Math.min(1000 * 2 ** retriesRef.current, 30000);
          retriesRef.current++;
          retryTimerRef.current = setTimeout(connect, delay);
        }
      };

      eventSourceRef.current = es;
    }

    connect();

    return () => {
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      eventSourceRef.current?.close();
      eventSourceRef.current = null;
    };
  }, []); // Empty deps — connect once, use ref for callback
}
