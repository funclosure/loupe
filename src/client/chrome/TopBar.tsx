import { LoupeIcon } from "../lenses/LoupeIcon";

interface TopBarProps {
  filename: string;
  activeLensCount: number;
  saveState: "saved" | "saving" | "unsaved";
  outlineOpen: boolean;
  onToggleOutline: () => void;
  onOpenLensPicker: () => void;
  onOpenFile: () => void;
}

function OutlineIcon({ active }: { active: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor"
      strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"
      style={{ opacity: active ? 1 : 0.4 }}>
      <rect x="2" y="1" width="12" height="14" rx="1.5" />
      <line x1="5" y1="4.5" x2="11" y2="4.5" />
      <line x1="5" y1="7.5" x2="11" y2="7.5" />
      <line x1="5" y1="10.5" x2="9" y2="10.5" />
    </svg>
  );
}

export function TopBar({
  filename,
  activeLensCount,
  saveState,
  outlineOpen,
  onToggleOutline,
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
      {/* Left: outline toggle + filename + sync dot */}
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleOutline}
          className="transition-opacity cursor-pointer hover:opacity-80"
          style={{ color: "var(--loupe-text-tertiary)" }}
          title="Toggle outline (⇧⌘E)"
        >
          <OutlineIcon active={outlineOpen} />
        </button>

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
      </div>

      {/* Right: add lens */}
      <div className="flex items-center gap-3">
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
    </div>
  );
}
