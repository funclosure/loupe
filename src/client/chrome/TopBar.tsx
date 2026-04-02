import { useState, useEffect, useRef } from "react";
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

function HamburgerIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor"
      strokeWidth="1.4" strokeLinecap="round">
      <line x1="2.5" y1="4" x2="13.5" y2="4" />
      <line x1="2.5" y1="8" x2="13.5" y2="8" />
      <line x1="2.5" y1="12" x2="13.5" y2="12" />
    </svg>
  );
}

function FolderIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor"
      strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 3.5A1.5 1.5 0 0 1 3.5 2H6l1.5 2H12.5A1.5 1.5 0 0 1 14 5.5v7a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 2 12.5z" />
    </svg>
  );
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

function AppMenu({ cwdName, onClose }: { cwdName: string; onClose: () => void }) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose();
    };
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [onClose]);

  const openFinder = () => {
    fetch("/api/open-finder", { method: "POST" }).catch(() => {});
    onClose();
  };

  return (
    <div
      ref={menuRef}
      className="absolute top-full left-0 mt-1 min-w-[200px] py-1 rounded-lg z-50"
      style={{
        background: "var(--loupe-elevated)",
        border: "1px solid var(--loupe-border-strong)",
        boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
      }}
    >
      <button
        onClick={openFinder}
        className="w-full flex items-center gap-2.5 px-3 py-2 text-left text-[13px]
                   cursor-pointer hover:bg-white/[0.05] transition-colors"
        style={{ color: "var(--loupe-text-secondary)" }}
      >
        <FolderIcon />
        <span className="flex-1">Open in Finder</span>
        <span className="text-[11px]" style={{ color: "var(--loupe-text-ghost)" }}>
          {cwdName}
        </span>
      </button>
    </div>
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
  const [cwdName, setCwdName] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    fetch("/api/cwd").then(r => r.json()).then(d => setCwdName(d.name)).catch(() => {});
  }, []);

  return (
    <div
      className="chrome flex items-center justify-between px-6 h-11 shrink-0"
      style={{
        background: "var(--loupe-chrome-bg)",
        borderBottom: "1px solid var(--loupe-border)",
      }}
    >
      {/* Left: menu + outline toggle + filename + sync dot */}
      <div className="flex items-center gap-3">
        <div className="relative">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="transition-opacity cursor-pointer hover:opacity-80"
            style={{ color: "var(--loupe-text-tertiary)", opacity: 0.5 }}
          >
            <HamburgerIcon />
          </button>
          {menuOpen && <AppMenu cwdName={cwdName} onClose={() => setMenuOpen(false)} />}
        </div>

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
