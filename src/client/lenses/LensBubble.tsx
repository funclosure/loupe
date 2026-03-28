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
    <div className="flex flex-col items-end gap-1.5 max-w-[240px] group">
      {/* Avatar row */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] opacity-70" style={{ color: definition.color }}>
          {definition.name}
        </span>
        <button
          onClick={onClick}
          className="w-8 h-8 rounded-full flex items-center justify-center text-sm
                     transition-all cursor-pointer"
          style={{
            background: `${definition.color}22`,
            border: `1.5px solid ${definition.color}55`,
            color: definition.color,
            boxShadow: status === "thinking"
              ? `0 0 12px ${definition.color}40`
              : "none",
            animation: status === "thinking" ? "pulse 2s infinite" : "none",
          }}
        >
          {definition.icon}
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDismiss(); }}
          className="opacity-0 group-hover:opacity-60 text-xs transition-opacity cursor-pointer"
          style={{ color: "var(--loupe-text-muted)" }}
        >
          x
        </button>
      </div>

      {/* Preview bubble */}
      {preview && status === "idle" && (
        <button
          onClick={onClick}
          className="text-left rounded-xl px-3 py-2 text-xs leading-relaxed cursor-pointer
                     transition-opacity hover:opacity-90 max-w-full"
          style={{
            background: `${definition.color}12`,
            border: `1px solid ${definition.color}20`,
            color: `${definition.color}cc`,
          }}
        >
          {preview.length > 100 ? preview.slice(0, 100) + "..." : preview}
        </button>
      )}

      {/* Thinking indicator */}
      {status === "thinking" && (
        <div
          className="rounded-xl px-3 py-2 text-[9px] uppercase tracking-wider"
          style={{
            background: `${definition.color}12`,
            border: `1px solid ${definition.color}20`,
            color: definition.color,
          }}
        >
          thinking...
        </div>
      )}

      {/* Error state */}
      {status === "error" && (
        <button
          onClick={onClick}
          className="text-left rounded-xl px-3 py-2 text-xs leading-relaxed cursor-pointer
                     transition-opacity hover:opacity-90 max-w-full"
          style={{
            background: "rgba(220, 38, 38, 0.08)",
            border: "1px solid rgba(220, 38, 38, 0.25)",
            color: "rgba(220, 38, 38, 0.85)",
          }}
        >
          <span className="block mb-1 text-[10px] uppercase tracking-wider opacity-70">error</span>
          <span>Something went wrong — click to retry</span>
        </button>
      )}
    </div>
  );
}
