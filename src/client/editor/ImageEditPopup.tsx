import { useEffect, useState } from "react";

interface Props {
  src: string;
  alt: string;
  onSave: (src: string, alt: string) => void;
  onClose: () => void;
}

export function ImageEditPopup({ src, alt, onSave, onClose }: Props) {
  const [srcValue, setSrcValue] = useState(src);
  const [altValue, setAltValue] = useState(alt);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation(); // Prevent App.tsx global Escape handler from also firing
        onClose();
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const handleSave = () => {
    onSave(srcValue, altValue);
    // onClose() removed — parent's onSave handler is responsible for closing
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center"
      onClick={onClose}
    >
      <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.6)" }} />
      <div
        className="relative w-[360px] flex flex-col rounded-lg p-5 gap-4"
        style={{
          background: "var(--loupe-elevated)",
          border: "1px solid var(--loupe-border-strong)",
          boxShadow: "0 16px 48px rgba(0,0,0,0.5)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3
          className="text-sm font-medium"
          style={{ color: "var(--loupe-text)" }}
        >
          Edit image
        </h3>

        <div className="flex flex-col gap-1">
          <label
            className="text-xs"
            style={{ color: "var(--loupe-text-secondary)" }}
          >
            URL
          </label>
          <input
            type="text"
            value={srcValue}
            onChange={(e) => setSrcValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleSave(); }}
            className="w-full rounded px-3 py-2 text-sm outline-none"
            style={{
              background: "var(--loupe-surface)",
              border: "1px solid var(--loupe-border)",
              color: "var(--loupe-text)",
            }}
            autoFocus
          />
        </div>

        <div className="flex flex-col gap-1">
          <label
            className="text-xs"
            style={{ color: "var(--loupe-text-secondary)" }}
          >
            Caption
          </label>
          <input
            type="text"
            value={altValue}
            onChange={(e) => setAltValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSave();
            }}
            className="w-full rounded px-3 py-2 text-sm outline-none"
            style={{
              background: "var(--loupe-surface)",
              border: "1px solid var(--loupe-border)",
              color: "var(--loupe-text)",
            }}
          />
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded text-sm"
            style={{ color: "var(--loupe-text-secondary)" }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-3 py-1.5 rounded text-sm font-medium"
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
  );
}
