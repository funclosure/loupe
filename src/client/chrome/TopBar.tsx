interface TopBarProps {
  filename: string;
  activeLensCount: number;
  saveState: "saved" | "saving" | "unsaved";
  onOpenLensPicker: () => void;
  onOpenFile: () => void;
}

export function TopBar({
  filename,
  activeLensCount,
  saveState,
  onOpenLensPicker,
  onOpenFile,
}: TopBarProps) {
  return (
    <div
      className="chrome flex items-center justify-between px-6 h-11 shrink-0"
      style={{
        background: "var(--loupe-chrome-bg)",
        borderBottom: "1px solid var(--loupe-border)",
      }}
    >
      {/* Left: filename */}
      <button
        onClick={onOpenFile}
        className="text-[13px] tracking-wide hover:opacity-70 transition-opacity cursor-pointer"
        style={{ color: "var(--loupe-text-tertiary)" }}
      >
        {filename}
      </button>

      {/* Center: save indicator */}
      <div
        className="text-[11px] transition-opacity duration-[2s]"
        style={{
          color: "var(--loupe-save-color)",
          opacity: saveState === "saving" ? 1 : saveState === "saved" ? 0.6 : 0,
        }}
      >
        {saveState === "saving" && "saving..."}
        {saveState === "saved" && "saved"}
      </div>

      {/* Right: lens count + add button */}
      <div className="flex items-center gap-3">
        {activeLensCount > 0 && (
          <span
            className="text-[11px]"
            style={{ color: "var(--loupe-text-ghost)" }}
          >
            {activeLensCount} lens{activeLensCount !== 1 ? "es" : ""}
          </span>
        )}
        <button
          onClick={onOpenLensPicker}
          className="w-6 h-6 rounded-full flex items-center justify-center text-xs
                     transition-all cursor-pointer hover:opacity-80"
          style={{
            border: "1px solid var(--loupe-border-strong)",
            color: "var(--loupe-text-tertiary)",
            background: "transparent",
          }}
        >
          +
        </button>
      </div>
    </div>
  );
}
