import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { LensDefinition, LensStatus } from "@shared/types";
import { LoupeIcon } from "./LoupeIcon";

interface LensBubbleProps {
  lensId: string;
  definition: LensDefinition;
  status: LensStatus;
  preview: string | null;
  onClick: () => void;
  onDismiss: () => void;
  onDragStart?: (e: React.PointerEvent) => void;
  isDragging?: boolean;
}

export function LensBubble({
  definition,
  status,
  preview,
  onClick,
  onDismiss,
  onDragStart,
  isDragging,
}: LensBubbleProps) {
  const color = definition.color;

  return (
    <div className="loupe-bubble-wrap flex flex-col items-end gap-2" style={{ opacity: isDragging ? 0.3 : 1 }}>
      {/* Avatar row */}
      <div className="flex items-center gap-2">
        <span className="loupe-bubble-name">{definition.name}</span>

        <div
          className="loupe-bubble"
          onClick={onClick}
          onPointerDown={(e) => {
            if (e.button !== 0) return;
            onDragStart?.(e);
          }}
          style={status === "thinking" ? { animation: "loupe-pulse 1.5s ease-in-out infinite" } : undefined}
        >
          <LoupeIcon
            size={44}
            color={color}
            icon={definition.icon}
            glow={status === "thinking"}
          />
        </div>

        <button
          className="loupe-bubble-dismiss"
          onClick={(e) => { e.stopPropagation(); onDismiss(); }}
        >
          &times;
        </button>
      </div>

      {/* Preview */}
      {preview && status === "idle" && (
        <button onClick={onClick} className="loupe-bubble-preview text-left lens-markdown">
          <Markdown remarkPlugins={[remarkGfm]} components={{
            p: ({ children }) => <span>{children} </span>,
            h1: ({ children }) => <span>{children} </span>,
            h2: ({ children }) => <span>{children} </span>,
            h3: ({ children }) => <span>{children} </span>,
            ul: ({ children }) => <span>{children}</span>,
            ol: ({ children }) => <span>{children}</span>,
            li: ({ children }) => <span>{children} </span>,
            blockquote: ({ children }) => <span>{children}</span>,
            pre: () => null,
            hr: () => null,
          }}>
            {preview.length > 120 ? preview.slice(0, 120) + "..." : preview}
          </Markdown>
        </button>
      )}

      {/* Thinking */}
      {status === "thinking" && (
        <div
          className="text-[11px] uppercase tracking-[0.1em]"
          style={{
            color: color,
            opacity: 0.7,
            animation: "loupe-pulse 1.5s ease-in-out infinite",
          }}
        >
          thinking...
        </div>
      )}

      {/* Error */}
      {status === "error" && (
        <button
          onClick={onClick}
          className="text-left rounded-lg px-3 py-2 text-[12px] cursor-pointer"
          style={{
            background: "rgba(220, 38, 38, 0.06)",
            color: "var(--loupe-text-secondary)",
          }}
        >
          Something went wrong — click to retry
        </button>
      )}
    </div>
  );
}
