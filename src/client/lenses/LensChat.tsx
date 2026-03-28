import { useState, useRef, useEffect } from "react";
import type { LensDefinition, ChatMessage } from "@shared/types";

interface LensChatProps {
  lensId: string;
  definition: LensDefinition;
  messages: ChatMessage[];
  streamingContent: string;
  isThinking: boolean;
  onAsk: (message: string) => void;
  onFocus: () => void;
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
  onFocus,
  onRethink,
  onReset,
  onClose,
}: LensChatProps) {
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streamingContent]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isThinking) return;
    onAsk(input.trim());
    setInput("");
  };

  return (
    <div
      className="w-[280px] rounded-xl overflow-hidden flex flex-col max-h-[400px]"
      style={{
        background: "var(--loupe-surface)",
        border: `1px solid ${definition.color}30`,
        boxShadow: `0 4px 24px rgba(0,0,0,0.3)`,
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-2 border-b"
        style={{ borderColor: `${definition.color}20` }}
      >
        <div className="flex items-center gap-2">
          <span
            className="w-6 h-6 rounded-full flex items-center justify-center text-xs"
            style={{ background: `${definition.color}22`, color: definition.color }}
          >
            {definition.icon}
          </span>
          <span className="text-sm font-medium" style={{ color: definition.color }}>
            {definition.name}
          </span>
        </div>
        <button
          onClick={onClose}
          className="w-6 h-6 flex items-center justify-center rounded-full
                     opacity-60 hover:opacity-100 transition-opacity cursor-pointer
                     hover:bg-white/5 text-sm leading-none"
          style={{ color: "var(--loupe-text-muted)" }}
        >
          &times;
        </button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`text-xs leading-relaxed ${
              msg.role === "user" ? "text-right" : ""
            }`}
          >
            <span
              className="inline-block rounded-lg px-2.5 py-1.5 max-w-[90%]"
              style={
                msg.role === "user"
                  ? { background: "var(--loupe-border)", color: "var(--loupe-text)" }
                  : { background: `${definition.color}12`, color: `${definition.color}cc` }
              }
            >
              {msg.content}
            </span>
          </div>
        ))}

        {/* Streaming content */}
        {streamingContent && (
          <div className="text-xs leading-relaxed">
            <span
              className="inline-block rounded-lg px-2.5 py-1.5"
              style={{ background: `${definition.color}12`, color: `${definition.color}cc` }}
            >
              {streamingContent}
            </span>
          </div>
        )}

        {isThinking && !streamingContent && (
          <div className="text-[10px] uppercase tracking-wider" style={{ color: definition.color }}>
            thinking...
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex gap-1.5 px-3 py-1.5 border-t" style={{ borderColor: "var(--loupe-border)" }}>
        <button
          onClick={onFocus}
          className="text-[10px] px-2 py-1 rounded cursor-pointer hover:opacity-80"
          style={{ background: `${definition.color}15`, color: `${definition.color}aa` }}
        >
          Focus here
        </button>
        <button
          onClick={onRethink}
          className="text-[10px] px-2 py-1 rounded cursor-pointer hover:opacity-80"
          style={{ background: `${definition.color}15`, color: `${definition.color}aa` }}
        >
          What now?
        </button>
        <button
          onClick={onReset}
          className="text-[10px] px-2 py-1 rounded cursor-pointer hover:opacity-80"
          style={{ background: "var(--loupe-border)", color: "var(--loupe-text-muted)" }}
        >
          Reset
        </button>
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="px-3 py-2 border-t" style={{ borderColor: "var(--loupe-border)" }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask this lens..."
          disabled={isThinking}
          className="w-full text-xs bg-transparent outline-none placeholder:opacity-40"
          style={{ color: "var(--loupe-text)" }}
        />
      </form>
    </div>
  );
}
