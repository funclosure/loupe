import { useState, useRef, useEffect, useCallback } from "react";
import Markdown from "react-markdown";
import type { ChatMessage } from "@shared/types";

interface OutlinePanelProps {
  content: string;
  onContentChange: (content: string) => void;
  messages: ChatMessage[];
  streamingContent: string;
  isThinking: boolean;
  onChat: (message: string) => void;
}

export function OutlinePanel({
  content,
  onContentChange,
  messages,
  streamingContent,
  isThinking,
  onChat,
}: OutlinePanelProps) {
  const [chatInput, setChatInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll chat on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streamingContent]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = textareaRef.current.scrollHeight + "px";
    }
  }, [content]);

  const handleChatSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || isThinking) return;
    onChat(chatInput.trim());
    setChatInput("");
  }, [chatInput, isThinking, onChat]);

  // Strip :::outline-update blocks from displayed messages
  const stripUpdateBlock = (text: string) =>
    text.replace(/:::outline-update\s*\n[\s\S]*?\n:::/g, "").trim();

  return (
    <div className="outline-panel">
      {/* Header */}
      <div className="outline-header">
        <span className="outline-label">Intention</span>
      </div>

      {/* Outline text */}
      <div className="outline-content">
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => onContentChange(e.target.value)}
          placeholder="What are you trying to convey?"
          className="outline-textarea"
        />
      </div>

      {/* Chat area */}
      {(messages.length > 0 || streamingContent) && (
        <div ref={scrollRef} className="outline-chat-messages">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={msg.role === "user" ? "outline-chat-user" : "outline-chat-ai"}
            >
              {msg.role === "user" ? (
                msg.content
              ) : (
                <Markdown className="lens-markdown">{stripUpdateBlock(msg.content)}</Markdown>
              )}
            </div>
          ))}
          {streamingContent && (
            <div className="outline-chat-ai">
              <Markdown className="lens-markdown">{stripUpdateBlock(streamingContent)}</Markdown>
            </div>
          )}
          {isThinking && !streamingContent && (
            <div
              className="text-[10px] uppercase tracking-[0.1em] py-1"
              style={{ color: "var(--loupe-text-ghost)", animation: "loupe-pulse 1.5s ease-in-out infinite" }}
            >
              thinking...
            </div>
          )}
        </div>
      )}

      {/* Chat input */}
      <form onSubmit={handleChatSubmit} className="outline-chat-input-wrap">
        <input
          value={chatInput}
          onChange={(e) => setChatInput(e.target.value)}
          placeholder="Refine your outline..."
          disabled={isThinking}
          className="outline-chat-input"
        />
        <span className="text-[10px]" style={{ color: "var(--loupe-text-ghost)" }}>&#x21B5;</span>
      </form>
    </div>
  );
}
