import { useState, useRef, useEffect, useCallback } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { LensDefinition, ChatMessage } from "@shared/types";
import { LoupeIcon } from "./LoupeIcon";
import { parseLensProposal, stripProposalBlock, LensProposalCard } from "./LensProposalCard";

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
  onCreateLens?: (proposal: { name: string; description: string; icon: string; color: string; systemPrompt: string }) => void;
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
  onCreateLens,
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
          <LoupeIcon size={26} color={color} icon={definition.icon} />
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
        {messages.map((msg, i) => {
          if (msg.role === "user") {
            return (
              <div key={i} className="loupe-chat-user-msg">
                <div>{msg.content}</div>
              </div>
            );
          }

          const proposal = parseLensProposal(msg.content);
          const textWithoutProposal = proposal ? stripProposalBlock(msg.content) : msg.content;
          const isLatestProposal = proposal && !messages.slice(i + 1).some(
            (m) => m.role === "lens" && parseLensProposal(m.content)
          );

          return (
            <div key={i} className="loupe-chat-lens-msg">
              {textWithoutProposal && (
                <div className="lens-markdown"><Markdown remarkPlugins={[remarkGfm]}>{textWithoutProposal}</Markdown></div>
              )}
              {proposal && (
                <LensProposalCard
                  proposal={proposal}
                  isLatest={!!isLatestProposal}
                  onCreate={(p) => onCreateLens?.(p)}
                />
              )}
            </div>
          );
        })}

        {streamingContent && (
          <div className="loupe-chat-lens-msg">
            <div className="lens-markdown"><Markdown remarkPlugins={[remarkGfm]}>{streamingContent}</Markdown></div>
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
