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
      className="w-[300px] rounded-xl overflow-hidden flex flex-col max-h-[450px]"
      style={{
        background: "var(--loupe-bg)",
        border: `1px solid var(--loupe-border)`,
        boxShadow: `0 8px 32px rgba(0,0,0,0.4)`,
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-2.5"
        style={{ borderBottom: `1px solid var(--loupe-border)` }}
      >
        <div className="flex items-center gap-2.5">
          <span
            className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium"
            style={{ background: `${definition.color}25`, color: definition.color }}
          >
            {definition.icon}
          </span>
          <span className="text-sm font-medium" style={{ color: "var(--loupe-text)" }}>
            {definition.name}
          </span>
        </div>
        <button
          onClick={onClose}
          className="w-6 h-6 flex items-center justify-center rounded-full
                     opacity-50 hover:opacity-100 transition-opacity cursor-pointer
                     hover:bg-white/10 text-base leading-none"
          style={{ color: "var(--loupe-text-muted)" }}
        >
          &times;
        </button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`text-[13px] leading-relaxed ${
              msg.role === "user" ? "text-right" : ""
            }`}
          >
            {msg.role === "user" ? (
              <span
                className="inline-block rounded-lg px-3 py-2 max-w-[85%] text-left"
                style={{
                  background: "var(--loupe-surface)",
                  color: "var(--loupe-text)",
                }}
              >
                {msg.content}
              </span>
            ) : (
              <span
                className="inline-block rounded-lg px-3 py-2 max-w-[95%] text-left"
                style={{
                  background: `${definition.color}10`,
                  color: "var(--loupe-text)",
                  borderLeft: `2px solid ${definition.color}60`,
                }}
              >
                {msg.content}
              </span>
            )}
          </div>
        ))}

        {/* Streaming content */}
        {streamingContent && (
          <div className="text-[13px] leading-relaxed">
            <span
              className="inline-block rounded-lg px-3 py-2 max-w-[95%]"
              style={{
                background: `${definition.color}10`,
                color: "var(--loupe-text)",
                borderLeft: `2px solid ${definition.color}60`,
              }}
            >
              {streamingContent}
            </span>
          </div>
        )}

        {isThinking && !streamingContent && (
          <div
            className="text-xs uppercase tracking-wider opacity-70"
            style={{ color: definition.color }}
          >
            thinking...
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div
        className="flex gap-2 px-4 py-2"
        style={{ borderTop: `1px solid var(--loupe-border)` }}
      >
        <button
          onClick={onFocus}
          className="text-xs px-2.5 py-1 rounded cursor-pointer transition-opacity hover:opacity-80"
          style={{ background: `${definition.color}20`, color: definition.color }}
        >
          Focus here
        </button>
        <button
          onClick={onRethink}
          className="text-xs px-2.5 py-1 rounded cursor-pointer transition-opacity hover:opacity-80"
          style={{ background: `${definition.color}20`, color: definition.color }}
        >
          What now?
        </button>
        <button
          onClick={onReset}
          className="text-xs px-2.5 py-1 rounded cursor-pointer transition-opacity hover:opacity-80"
          style={{ background: "var(--loupe-surface)", color: "var(--loupe-text-muted)" }}
        >
          Reset
        </button>
      </div>

      {/* Input */}
      <form
        onSubmit={handleSubmit}
        className="px-4 py-2.5"
        style={{ borderTop: `1px solid var(--loupe-border)` }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask this lens..."
          disabled={isThinking}
          className="w-full text-[13px] bg-transparent outline-none placeholder:opacity-30"
          style={{ color: "var(--loupe-text)" }}
        />
      </form>
    </div>
  );
}
