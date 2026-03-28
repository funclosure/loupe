import { useState, useRef, useEffect, useCallback } from "react";
import Markdown from "react-markdown";
import type { LensDefinition, ChatMessage } from "@shared/types";

interface LensChatProps {
  lensId: string;
  definition: LensDefinition;
  messages: ChatMessage[];
  streamingContent: string;
  isThinking: boolean;
  onAsk: (message: string) => void;
  onRethink: () => void;
  onReset: () => void;
  onClose: () => void;
}

export function LensChat({
  definition,
  messages,
  streamingContent,
  isThinking,
  onAsk,
  onRethink,
  onReset,
  onClose,
}: LensChatProps) {
  const [input, setInput] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Auto-scroll on new content
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streamingContent]);

  // Escape key to collapse (or close menu first)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (menuOpen) setMenuOpen(false);
        else onClose();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose, menuOpen]);

  // Click outside to collapse
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const timer = setTimeout(() => {
      document.addEventListener("mousedown", handler);
    }, 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handler);
    };
  }, [onClose]);

  // Close overflow menu on click outside
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isThinking) return;
    onAsk(input.trim());
    setInput("");
  }, [input, isThinking, onAsk]);

  const color = definition.color;

  return (
    <div ref={cardRef} className="loupe-chat w-full">
      {/* Header */}
      <div className="loupe-chat-header">
        <div className="flex items-center gap-2.5">
          {/* Mini loupe icon */}
          <div className="relative" style={{ width: 24, height: 24 }}>
            <div
              className="absolute"
              style={{
                top: -1, left: -4,
                width: 24, height: 24,
                borderRadius: "50% 50% 50% 6px",
                background: `${color}20`,
              }}
            />
            <div
              className="relative z-10 flex items-center justify-center"
              style={{
                width: 22, height: 22,
                left: 1,
                borderRadius: "50%",
                background: `${color}12`,
                color: `${color}80`,
                fontSize: 10, fontWeight: 600,
              }}
            >
              {definition.icon}
            </div>
          </div>
          <span className="text-[12.5px] font-medium" style={{ color: "var(--loupe-text-secondary)" }}>
            {definition.name}
          </span>
        </div>

        <div className="flex items-center gap-1 relative">
          {/* Overflow menu */}
          <button
            className="loupe-chat-overflow-btn"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            ···
          </button>
          {menuOpen && (
            <div ref={menuRef} className="loupe-chat-overflow-menu">
              <button
                className="loupe-chat-overflow-item"
                onClick={() => { onRethink(); setMenuOpen(false); }}
              >
                Rethink
              </button>
              <button
                className="loupe-chat-overflow-item danger"
                onClick={() => { onReset(); setMenuOpen(false); }}
              >
                Reset conversation
              </button>
            </div>
          )}

          {/* Close */}
          <button className="loupe-chat-close" onClick={onClose}>
            &times;
          </button>
        </div>
      </div>

      <div className="loupe-chat-separator" />

      {/* Messages */}
      <div ref={scrollRef} className="loupe-chat-messages">
        {messages.map((msg, i) => (
          msg.role === "user" ? (
            <div key={i} className="loupe-chat-user-msg">
              <div>{msg.content}</div>
            </div>
          ) : (
            <div key={i} className="loupe-chat-lens-msg">
              <Markdown className="lens-markdown">{msg.content}</Markdown>
            </div>
          )
        ))}

        {streamingContent && (
          <div className="loupe-chat-lens-msg">
            <Markdown className="lens-markdown">{streamingContent}</Markdown>
          </div>
        )}

        {isThinking && !streamingContent && (
          <div
            className="text-[11px] uppercase tracking-[0.1em] py-1"
            style={{
              color: color,
              opacity: 0.7,
              animation: "loupe-pulse 1.5s ease-in-out infinite",
            }}
          >
            thinking...
          </div>
        )}
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="loupe-chat-input-wrap">
        <div className="loupe-chat-input" style={{ caretColor: color }}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask something..."
            disabled={isThinking}
          />
          <span className="text-[11px]" style={{ color: "var(--loupe-text-ghost)" }}>↵</span>
        </div>
      </form>
    </div>
  );
}
