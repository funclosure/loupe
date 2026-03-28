import type { LensDefinition, LensStatus } from "@shared/types";

interface LensBubbleProps {
  lensId: string;
  definition: LensDefinition;
  status: LensStatus;
  preview: string | null;
  onClick: () => void;
  onDismiss: () => void;
}

export function LensBubble({
  definition,
  status,
  preview,
  onClick,
  onDismiss,
}: LensBubbleProps) {
  return (
    <div className="flex flex-col items-end gap-2 max-w-[260px] group">
      {/* Avatar row */}
      <div className="flex items-center gap-2">
        <span
          className="text-[11px] opacity-0 group-hover:opacity-60 transition-opacity"
          style={{ color: "var(--loupe-text-tertiary)" }}
        >
          {definition.name}
        </span>
        <button
          onClick={onClick}
          className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold
                     transition-all cursor-pointer"
          style={{
            background: `${definition.color}18`,
            border: `1.5px solid ${definition.color}40`,
            color: definition.color,
            boxShadow: status === "thinking"
              ? `0 0 16px ${definition.color}30`
              : "none",
            animation: status === "thinking" ? "loupe-pulse 1.5s ease-in-out infinite" : "none",
          }}
        >
          {definition.icon}
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDismiss(); }}
          className="w-4 opacity-0 group-hover:opacity-40 hover:!opacity-80
                     text-xs transition-opacity cursor-pointer"
          style={{ color: "var(--loupe-text-tertiary)" }}
        >
          &times;
        </button>
      </div>

      {/* Preview */}
      {preview && status === "idle" && (
        <button
          onClick={onClick}
          className="text-left rounded-lg px-3 py-2 text-[13px] leading-[1.6] cursor-pointer
                     transition-opacity hover:opacity-80 max-w-full"
          style={{
            background: "var(--loupe-surface)",
            borderLeft: `2px solid ${definition.color}`,
            color: "var(--loupe-text)",
          }}
        >
          {preview.length > 100 ? preview.slice(0, 100) + "..." : preview}
        </button>
      )}

      {/* Thinking */}
      {status === "thinking" && (
        <div
          className="rounded-lg px-3 py-1.5 text-[11px] uppercase tracking-[0.1em]"
          style={{
            color: definition.color,
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
          className="text-left rounded-lg px-3 py-2 text-[13px] leading-relaxed cursor-pointer max-w-full"
          style={{
            background: "rgba(220, 38, 38, 0.06)",
            borderLeft: "2px solid rgba(220, 38, 38, 0.5)",
            color: "var(--loupe-text-secondary)",
          }}
        >
          Something went wrong — click to retry
        </button>
      )}
    </div>
  );
}
