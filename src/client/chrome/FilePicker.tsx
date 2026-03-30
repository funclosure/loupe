import { useState, useEffect, useRef } from "react";

interface FilePickerProps {
  onSelect: (path: string) => void;
  onCreate: (path: string) => void;
  onClose: () => void;
}

export function FilePicker({ onSelect, onCreate, onClose }: FilePickerProps) {
  const [files, setFiles] = useState<{ name: string; path: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/files")
      .then((r) => r.json())
      .then((data) => { setFiles(data.files || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (creating && inputRef.current) inputRef.current.focus();
  }, [creating]);

  const handleCreate = () => {
    const name = newName.trim();
    if (!name) return;
    const filename = name.endsWith(".md") ? name : `${name}.md`;
    onCreate(filename);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/60" />

      <div
        className="relative w-[360px] max-h-[420px] overflow-y-auto rounded-lg p-5"
        style={{
          background: "var(--loupe-elevated)",
          border: "1px solid var(--loupe-border-strong)",
          boxShadow: "0 16px 48px rgba(0,0,0,0.5)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2
            className="text-base font-medium"
            style={{ color: "var(--loupe-text)" }}
          >
            Open File
          </h2>
          <button
            onClick={onClose}
            className="w-6 h-6 flex items-center justify-center rounded
                       opacity-40 hover:opacity-80 cursor-pointer text-base"
            style={{ color: "var(--loupe-text-secondary)" }}
          >
            &times;
          </button>
        </div>

        {loading ? (
          <p
            className="text-[13px] py-4 text-center"
            style={{ color: "var(--loupe-text-tertiary)" }}
          >
            Loading...
          </p>
        ) : (
          <div className="space-y-0.5">
            {files.map((file) => (
              <button
                key={file.path}
                onClick={() => { onSelect(file.path); onClose(); }}
                className="w-full text-left px-3 py-2 rounded-lg text-[13px]
                           transition-colors cursor-pointer hover:bg-white/[0.03]"
                style={{ color: "var(--loupe-text)" }}
              >
                {file.name}
              </button>
            ))}

            {/* Create new file */}
            {creating ? (
              <form
                className="flex items-center gap-2 px-3 py-2"
                onSubmit={(e) => { e.preventDefault(); handleCreate(); }}
              >
                <input
                  ref={inputRef}
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="filename.md"
                  className="flex-1 bg-transparent text-[13px] outline-none"
                  style={{
                    color: "var(--loupe-text)",
                    borderBottom: "1px solid var(--loupe-border-strong)",
                    paddingBottom: 2,
                  }}
                  onKeyDown={(e) => { if (e.key === "Escape") setCreating(false); }}
                />
                <button
                  type="submit"
                  className="text-[12px] px-2 py-0.5 rounded cursor-pointer hover:opacity-80"
                  style={{
                    color: "var(--loupe-text-secondary)",
                    background: "var(--loupe-surface)",
                  }}
                >
                  Create
                </button>
              </form>
            ) : (
              <button
                onClick={() => setCreating(true)}
                className="w-full text-left px-3 py-2 rounded-lg text-[13px]
                           transition-colors cursor-pointer hover:bg-white/[0.03]"
                style={{ color: "var(--loupe-text-tertiary)" }}
              >
                + New file...
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
