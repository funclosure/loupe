import { useState, useRef, useEffect } from "react";
import Markdown from "react-markdown";
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

function LensMessage({ content, color }: { content: string; color: string }) {
  return (
    <div
      className="text-[13px] leading-[1.7] rounded-lg px-3 py-2.5"
      style={{
        color: "var(--loupe-text)",
        background: "var(--loupe-surface)",
      }}
    >
      <Markdown className="lens-markdown">{content}</Markdown>
    </div>
  );
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
      className="w-full rounded-lg overflow-hidden flex flex-col max-h-[70vh]"
      style={{
        background: "var(--loupe-elevated)",
        border: "1px solid var(--loupe-border-strong)",
        boxShadow: "0 12px 40px rgba(0,0,0,0.4), 0 2px 8px rgba(0,0,0,0.2)",
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 h-10 shrink-0"
        style={{ borderBottom: "1px solid var(--loupe-border)" }}
      >
        <div className="flex items-center gap-2.5">
          <span
            className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-semibold"
            style={{ background: `${definition.color}20`, color: definition.color }}
          >
            {definition.icon}
          </span>
          <span className="text-[13px] font-medium" style={{ color: "var(--loupe-text)" }}>
            {definition.name}
          </span>
        </div>
        <button
          onClick={onClose}
          className="w-5 h-5 flex items-center justify-center rounded
                     opacity-40 hover:opacity-80 transition-opacity cursor-pointer text-sm"
          style={{ color: "var(--loupe-text-secondary)" }}
        >
          &times;
        </button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.map((msg, i) => (
          <div key={i} className={msg.role === "user" ? "flex justify-end" : ""}>
            {msg.role === "user" ? (
              <div
                className="text-[13px] leading-relaxed rounded-lg px-3 py-2 max-w-[85%]"
                style={{
                  background: "var(--loupe-surface)",
                  color: "var(--loupe-text)",
                }}
              >
                {msg.content}
              </div>
            ) : (
              <LensMessage content={msg.content} color={definition.color} />
            )}
          </div>
        ))}

        {streamingContent && (
          <LensMessage content={streamingContent} color={definition.color} />
        )}

        {isThinking && !streamingContent && (
          <div
            className="text-[11px] uppercase tracking-[0.1em] py-1"
            style={{
              color: definition.color,
              animation: "loupe-pulse 1.5s ease-in-out infinite",
            }}
          >
            thinking...
          </div>
        )}
      </div>

      {/* Actions */}
      <div
        className="flex gap-1.5 px-4 py-2 shrink-0"
        style={{ borderTop: "1px solid var(--loupe-border)" }}
      >
        {[
          { label: "Focus here", onClick: onFocus, accent: true },
          { label: "What now?", onClick: onRethink, accent: true },
          { label: "Reset", onClick: onReset, accent: false },
        ].map(({ label, onClick, accent }) => (
          <button
            key={label}
            onClick={onClick}
            className="text-[11px] px-2.5 py-1 rounded cursor-pointer transition-opacity hover:opacity-70"
            style={{
              background: accent ? `${definition.color}15` : "var(--loupe-surface)",
              color: accent ? definition.color : "var(--loupe-text-tertiary)",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Input */}
      <form
        onSubmit={handleSubmit}
        className="px-4 py-2.5 shrink-0"
        style={{ borderTop: "1px solid var(--loupe-border)" }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask this lens..."
          disabled={isThinking}
          className="w-full text-[13px] bg-transparent outline-none placeholder:opacity-30"
          style={{
            color: "var(--loupe-text)",
            caretColor: definition.color,
          }}
        />
      </form>
    </div>
  );
}
