interface TopBarProps {
  filename: string;
  activeLensCount: number;
  saveState: "saved" | "saving" | "unsaved" | "unavailable";
  onOpenLensPicker: () => void;
  onOpenFile: () => void;
}

export function TopBar({ filename, activeLensCount, saveState, onOpenLensPicker, onOpenFile }: TopBarProps) {
  return (
    <div className="chrome flex items-center justify-between px-6 py-3 border-b"
         style={{ borderColor: "var(--loupe-border)", background: "var(--loupe-chrome-bg)" }}>
      <button onClick={onOpenFile} className="text-sm hover:opacity-80 transition-opacity" style={{ color: "var(--loupe-text-muted)" }}>
        {filename}
      </button>
      <div className="text-xs transition-opacity duration-1000" style={{ color: "var(--loupe-save-color)", opacity: saveState === "saving" ? 1 : saveState === "saved" ? 0 : 1 }}>
        {saveState === "saving" && "saving..."}
        {saveState === "unavailable" && "download to save"}
      </div>
      <div className="flex items-center gap-3">
        {activeLensCount > 0 && (
          <span className="text-xs" style={{ color: "var(--loupe-text-dim)" }}>{activeLensCount} lens{activeLensCount !== 1 ? "es" : ""}</span>
        )}
        <button onClick={onOpenLensPicker} className="w-7 h-7 rounded-full flex items-center justify-center text-sm border transition-colors hover:opacity-80"
          style={{ borderColor: "var(--loupe-border)", color: "var(--loupe-text-muted)", background: "var(--loupe-surface)" }}>+</button>
      </div>
    </div>
  );
}
