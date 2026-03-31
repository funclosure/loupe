import { useState, useCallback, useRef } from "react";
import type { ChatMessage } from "@shared/types";

const STORAGE_KEY = "loupe-outline-open";

interface UseOutlineReturn {
  content: string;
  setContent: (content: string) => void;
  messages: ChatMessage[];
  streamingContent: string;
  isThinking: boolean;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  load: () => Promise<void>;
  chat: (message: string) => Promise<void>;
}

export function useOutline(): UseOutlineReturn {
  const [content, setContentState] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streamingContent, setStreamingContent] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [isOpen, setIsOpenState] = useState(
    () => localStorage.getItem(STORAGE_KEY) === "true"
  );
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setIsOpen = useCallback((open: boolean) => {
    setIsOpenState(open);
    localStorage.setItem(STORAGE_KEY, String(open));
  }, []);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/outline");
      const data = await res.json();
      setContentState(data.content || "");
      setMessages([]);
    } catch {
      setContentState("");
    }
  }, []);

  const setContent = useCallback((newContent: string) => {
    setContentState(newContent);
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      fetch("/api/outline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: newContent }),
      }).catch(() => {});
    }, 1000);
  }, []);

  const chat = useCallback(async (message: string) => {
    setMessages((prev) => [...prev, { role: "user", content: message }]);
    setIsThinking(true);
    setStreamingContent("");

    try {
      const res = await fetch("/api/outline/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, outline: content }),
      });

      if (!res.ok || !res.body) {
        setIsThinking(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let fullResponse = "";

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
            if (data.text) {
              fullResponse += data.text;
              setStreamingContent(fullResponse);
            }
            if (data.done) {
              // Check for :::outline-update block
              const updateMatch = fullResponse.match(/:::outline-update\s*\n([\s\S]*?)\n:::/);
              if (updateMatch) {
                setContent(updateMatch[1].trim());
              }
              setMessages((prev) => [...prev, { role: "lens", content: fullResponse }]);
              setStreamingContent("");
              setIsThinking(false);
            }
            if (data.error) {
              setIsThinking(false);
            }
          } catch {}
        }
      }
    } catch {
      setIsThinking(false);
    }
  }, [content, setContent]);

  return {
    content, setContent, messages, streamingContent, isThinking,
    isOpen, setIsOpen, load, chat,
  };
}
