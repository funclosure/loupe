import { LoupeIcon } from "../lenses/LoupeIcon";

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
      {/* Left: filename + sync dot */}
      <button
        onClick={onOpenFile}
        className="flex items-center gap-2 hover:opacity-70 transition-opacity cursor-pointer"
        style={{ color: "var(--loupe-text-tertiary)" }}
      >
        <span className="text-[13px] tracking-wide">{filename}</span>
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: saveState === "saving"
              ? "var(--loupe-save-color)"
              : saveState === "unsaved"
                ? "var(--loupe-save-color)"
                : "var(--loupe-text-ghost)",
            opacity: saveState === "saving" ? 1 : saveState === "unsaved" ? 0.6 : 0,
            transition: saveState === "saved" ? "opacity 1.5s ease-out 0.3s" : "opacity 0.15s ease-in",
            animation: saveState === "saving" ? "loupe-pulse 1s ease-in-out infinite" : "none",
          }}
        />
      </button>

      {/* Right: add lens button */}
      <button
        onClick={onOpenLensPicker}
        className="relative transition-opacity cursor-pointer hover:opacity-80"
        style={{ opacity: 0.6 }}
      >
        <LoupeIcon
          size={24}
          color="#9ca3af"
          icon="+"
        />
        {activeLensCount > 0 && (
          <span
            className="absolute -top-1 -right-1 text-[9px] min-w-[14px] h-[14px]
                       flex items-center justify-center rounded-full font-medium"
            style={{
              background: "var(--loupe-surface)",
              color: "var(--loupe-text-tertiary)",
              border: "1px solid var(--loupe-border)",
            }}
          >
            {activeLensCount}
          </span>
        )}
      </button>
    </div>
  );
}
