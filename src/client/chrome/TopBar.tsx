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

function ImageIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor"
      strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1.5" y="2.5" width="13" height="11" rx="1.5" />
      <circle cx="5" cy="6" r="1.5" />
      <path d="M1.5 11l3.5-3.5 2.5 2.5 2-2L14.5 11" />
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

function ImageFolderDialog({ onClose }: { onClose: () => void }) {
  const [imageDir, setImageDir] = useState("");
  const [imagePrefix, setImagePrefix] = useState("");
  const [projectRoot, setProjectRoot] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/config").then(r => r.json()),
      fetch("/api/cwd").then(r => r.json()),
    ]).then(([config, cwd]) => {
      setImageDir(config.imageDir || "");
      setImagePrefix(config.imagePrefix || "");
      setProjectRoot(cwd.projectRoot || cwd.path || "");
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const handleDirChange = (dir: string, prefix: string) => {
    setImageDir(dir);
    setImagePrefix(prefix);
  };

  const handleDirInput = (val: string) => {
    setImageDir(val);
    const publicIdx = val.indexOf("public/");
    if (publicIdx !== -1) {
      setImagePrefix("/" + val.slice(publicIdx + 7));
    } else if (val && !imagePrefix) {
      setImagePrefix("/" + val.split("/").pop());
    }
  };

  const handleBrowse = async () => {
    const res = await fetch("/api/pick-folder", { method: "POST" });
    const data = await res.json();
    if (data.cancelled) return;
    handleDirChange(data.path, data.prefix);
  };

  const [detecting, setDetecting] = useState(false);
  const handleDetect = async () => {
    setDetecting(true);
    try {
      const res = await fetch("/api/image/detect", { method: "POST" });
      const data = await res.json();
      if (data.imageDir && data.imagePrefix) {
        handleDirChange(data.imageDir, data.imagePrefix);
      }
    } catch {}
    setDetecting(false);
  };

  const handleSave = () => {
    fetch("/api/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageDir, imagePrefix }),
    }).then(() => window.location.reload()).catch(() => {});
  };

  const handleReset = () => {
    fetch("/api/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageDir: "", imagePrefix: "" }),
    }).then(() => { setImageDir(""); setImagePrefix(""); }).catch(() => {});
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60" />
      <div
        className="relative w-[380px] flex flex-col rounded-lg p-5"
        style={{
          background: "var(--loupe-elevated)",
          border: "1px solid var(--loupe-border-strong)",
          boxShadow: "0 16px 48px rgba(0,0,0,0.5)",
        }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[14px] font-medium" style={{ color: "var(--loupe-text)" }}>
            Image Folder
          </h2>
          <button
            onClick={handleDetect}
            disabled={detecting}
            className="text-[11px] px-2 py-1 rounded cursor-pointer hover:opacity-80 disabled:opacity-40"
            style={{
              color: "var(--loupe-text-secondary)",
              background: "var(--loupe-surface)",
              border: "1px solid var(--loupe-border)",
            }}
          >
            {detecting ? "Scanning..." : "Auto-detect"}
          </button>
        </div>

        {loading ? (
          <p className="text-[13px] py-2" style={{ color: "var(--loupe-text-tertiary)" }}>Loading...</p>
        ) : (
          <div className="space-y-3">
            {projectRoot && (
              <p className="text-[11px] -mt-1 break-all" style={{ color: "var(--loupe-text-ghost)" }}>
                Project root: {projectRoot}
              </p>
            )}
            <div>
              <label className="block text-[11px] mb-1 tracking-wide"
                style={{ color: "var(--loupe-text-ghost)" }}>
                Directory
              </label>
              <div className="flex gap-2">
                <input
                  value={imageDir}
                  onChange={e => handleDirInput(e.target.value)}
                  placeholder="public/images/my-project"
                  className="flex-1 min-w-0 bg-transparent text-[13px] px-2.5 py-1.5 rounded outline-none"
                  style={{
                    color: "var(--loupe-text)",
                    border: "1px solid var(--loupe-border-strong)",
                    background: "var(--loupe-surface)",
                  }}
                  onKeyDown={e => { if (e.key === "Escape") onClose(); if (e.key === "Enter") handleSave(); }}
                />
                <button
                  onClick={handleBrowse}
                  className="shrink-0 text-[12px] px-2.5 py-1.5 rounded cursor-pointer hover:opacity-80"
                  style={{
                    color: "var(--loupe-text-secondary)",
                    background: "var(--loupe-surface)",
                    border: "1px solid var(--loupe-border)",
                  }}
                >
                  Browse...
                </button>
              </div>
            </div>
            <div>
              <label className="block text-[11px] mb-1 tracking-wide"
                style={{ color: "var(--loupe-text-ghost)" }}>
                Markdown path prefix
              </label>
              <input
                value={imagePrefix}
                onChange={e => setImagePrefix(e.target.value)}
                placeholder="/images/my-project"
                className="w-full bg-transparent text-[13px] px-2.5 py-1.5 rounded outline-none"
                style={{
                  color: "var(--loupe-text)",
                  border: "1px solid var(--loupe-border-strong)",
                  background: "var(--loupe-surface)",
                }}
                onKeyDown={e => { if (e.key === "Escape") onClose(); if (e.key === "Enter") handleSave(); }}
              />
            </div>
            <div className="flex items-center justify-between pt-1">
              <button
                onClick={handleReset}
                className="text-[12px] px-2 py-1.5 rounded cursor-pointer hover:opacity-80"
                style={{ color: "var(--loupe-text-ghost)" }}
              >
                Reset
              </button>
              <div className="flex gap-2">
                <button
                  onClick={onClose}
                  className="text-[12px] px-3 py-1.5 rounded cursor-pointer hover:opacity-80"
                  style={{ color: "var(--loupe-text-tertiary)" }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  className="text-[12px] px-3 py-1.5 rounded cursor-pointer hover:opacity-80"
                  style={{
                    color: "var(--loupe-text)",
                    background: "var(--loupe-surface)",
                    border: "1px solid var(--loupe-border)",
                  }}
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function AppMenu({ cwdName, onClose, onOpenImageFolder }: { cwdName: string; onClose: () => void; onOpenImageFolder: () => void }) {
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
      <button
        onClick={() => { onOpenImageFolder(); onClose(); }}
        className="w-full flex items-center gap-2.5 px-3 py-2 text-left text-[13px]
                   cursor-pointer hover:bg-white/[0.05] transition-colors"
        style={{ color: "var(--loupe-text-secondary)" }}
      >
        <ImageIcon />
        <span className="flex-1">Image folder...</span>
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
  const [imageDialogOpen, setImageDialogOpen] = useState(false);

  useEffect(() => {
    fetch("/api/cwd").then(r => r.json()).then(d => setCwdName(d.name)).catch(() => {});
  }, []);

  // Open image folder dialog when editor tries to paste without config
  useEffect(() => {
    const handler = () => setImageDialogOpen(true);
    window.addEventListener("loupe-configure-images", handler);
    return () => window.removeEventListener("loupe-configure-images", handler);
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
          {menuOpen && <AppMenu cwdName={cwdName} onClose={() => setMenuOpen(false)} onOpenImageFolder={() => setImageDialogOpen(true)} />}
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
      {imageDialogOpen && (
        <ImageFolderDialog onClose={() => setImageDialogOpen(false)} />
      )}
    </div>
  );
}
