import { useState, useEffect, useRef } from "react";

interface FilePickerProps {
  currentFile: string | null;
  onSelect: (path: string) => void;
  onCreate: (path: string) => void;
  onDelete: (path: string) => void;
  onClose: () => void;
}

function TrashIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 4h12M5.33 4V2.67a1.33 1.33 0 0 1 1.34-1.34h2.66a1.33 1.33 0 0 1 1.34 1.34V4M6.67 7.33v4M9.33 7.33v4" />
      <path d="M3.33 4h9.34l-.67 9.33a1.33 1.33 0 0 1-1.33 1.34H5.33A1.33 1.33 0 0 1 4 13.33L3.33 4Z" />
    </svg>
  );
}

export function FilePicker({ currentFile, onSelect, onCreate, onDelete, onClose }: FilePickerProps) {
  const [files, setFiles] = useState<{ name: string; path: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
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
    const filename = (name.endsWith(".md") || name.endsWith(".mdx")) ? name : `${name}.md`;
    onCreate(filename);
    onClose();
  };

  const handleDelete = (path: string) => {
    setFiles((prev) => prev.filter((f) => f.path !== path));
    setConfirmDelete(null);
    onDelete(path);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/60" />

      <div
        className="relative w-[360px] max-h-[70vh] flex flex-col rounded-lg"
        style={{
          background: "var(--loupe-elevated)",
          border: "1px solid var(--loupe-border-strong)",
          boxShadow: "0 16px 48px rgba(0,0,0,0.5)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 pb-3 shrink-0">
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

        <div className="overflow-y-auto px-5 pb-5 min-h-0">
          {loading ? (
            <p
              className="text-[13px] py-4 text-center"
              style={{ color: "var(--loupe-text-tertiary)" }}
            >
              Loading...
            </p>
          ) : (
            <div className="space-y-0.5">
              {files.map((file) => {
                const isCurrent = currentFile === file.name;
                const isConfirming = confirmDelete === file.path;

                return (
                  <div
                    key={file.path}
                    className="group flex items-center rounded-lg transition-colors"
                    style={isCurrent ? {
                      background: "var(--loupe-surface)",
                      border: "1px solid var(--loupe-border)",
                    } : {
                      border: "1px solid transparent",
                    }}
                  >
                    {isConfirming ? (
                      <div className="flex-1 flex items-center justify-between px-3 py-2">
                        <span
                          className="text-[12px]"
                          style={{ color: "var(--loupe-text-secondary)" }}
                        >
                          Delete {file.name}?
                        </span>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleDelete(file.path)}
                            className="text-[11px] px-2 py-0.5 rounded cursor-pointer hover:opacity-80"
                            style={{ color: "#ef4444", background: "rgba(239,68,68,0.1)" }}
                          >
                            Delete
                          </button>
                          <button
                            onClick={() => setConfirmDelete(null)}
                            className="text-[11px] px-2 py-0.5 rounded cursor-pointer hover:opacity-80"
                            style={{ color: "var(--loupe-text-tertiary)" }}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <button
                          onClick={() => { if (!isCurrent) { onSelect(file.path); onClose(); } }}
                          className={`flex-1 text-left px-3 py-2 text-[13px] ${isCurrent ? "cursor-default" : "cursor-pointer hover:bg-white/[0.03]"} rounded-lg`}
                          style={{ color: "var(--loupe-text)" }}
                        >
                          {file.name}
                        </button>
                        {!isCurrent && (
                          <button
                            onClick={() => setConfirmDelete(file.path)}
                            className="shrink-0 w-6 h-6 flex items-center justify-center rounded
                                       opacity-0 group-hover:opacity-40 hover:!opacity-80
                                       cursor-pointer mr-1 transition-opacity"
                            style={{ color: "var(--loupe-text-secondary)" }}
                          >
                            <TrashIcon />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                );
              })}

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
    </div>
  );
}
