import { useEffect, useCallback, useRef, useState } from "react";
import { Editor } from "./editor/Editor";
import { TopBar } from "./chrome/TopBar";
import { LensLayer } from "./lenses/LensLayer";
import { LensPicker } from "./chrome/LensPicker";
import { useFile } from "./hooks/use-file";
import { useZenMode } from "./hooks/use-zen-mode";
import { useLenses } from "./hooks/use-lenses";
import { useLensDrag } from "./hooks/use-lens-drag";
import { LoupeIcon } from "./lenses/LoupeIcon";
import type { MilkdownInstance } from "./editor/milkdown-setup";

export function App() {
  const editorRef = useRef<MilkdownInstance | null>(null);
  const versionRef = useRef(0);
  const syncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { filename, initialContent, saveState, openFile, saveFileAs, updateContent, persistFilename } = useFile();
  const { zenMode } = useZenMode();
  const lens = useLenses();
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const { drag, highlight, snapBack, handleDragStart } = useLensDrag({
    editorRef,
    definitions: lens.available,
    lenses: lens.lenses,
    onFocus: (lensId, text, version) => lens.focus(lensId, text, version),
    versionRef,
  });

  // Fetch available lenses on mount
  useEffect(() => { lens.fetchLenses(); }, []);

  // Load file from ?file= query param (CLI: `loupe sample.md`)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const filePath = params.get("file");
    if (!filePath) return;

    // Clear query param immediately so refresh uses localStorage
    window.history.replaceState({}, "", "/");

    fetch(`/api/file?path=${encodeURIComponent(filePath)}`)
      .then((r) => r.json())
      .then((data) => {
        if (!data.content) return;
        updateContent(data.content);
        if (data.filename) persistFilename(data.filename);

        // Wait for editor to mount, then load content
        function tryLoad() {
          if (editorRef.current) {
            editorRef.current.setMarkdown(data.content);
          } else {
            setTimeout(tryLoad, 100);
          }
        }
        tryLoad();
      })
      .catch(() => {});
  }, []);

  // Sync document to server (debounced)
  const syncToServer = useCallback((content: string) => {
    if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    syncTimeoutRef.current = setTimeout(() => {
      versionRef.current++;
      fetch("/api/document", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, version: versionRef.current }),
      }).catch(() => {});
    }, 1000);
  }, []);

  // Editor change handler: save to file + sync to server
  const handleEditorChange = useCallback((markdown: string) => {
    updateContent(markdown);
    syncToServer(markdown);
  }, [updateContent, syncToServer]);

  // Open file and load content into editor
  const handleOpenFile = useCallback(async () => {
    const text = await openFile();
    if (text != null && editorRef.current) {
      editorRef.current.setMarkdown(text);
    }
    // Reset all active lens conversations for new document context
    for (const [lensId] of lens.lenses) {
      await lens.resetLens(lensId);
    }
  }, [openFile, lens.lenses, lens.resetLens]);

  // Keyboard shortcuts (centralized — useZenMode handles Cmd+. internally)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key === "l") {
        e.preventDefault();
        lens.setPickerOpen((prev) => !prev);
      } else if (mod && e.key === "o") {
        e.preventDefault();
        handleOpenFile();
      } else if (mod && e.key === "s") {
        e.preventDefault();
        saveFileAs();
      } else if (mod && e.key === "/") {
        e.preventDefault();
        setShortcutsOpen((prev) => !prev);
      } else if (e.key === "Escape") {
        if (shortcutsOpen) {
          setShortcutsOpen(false);
        } else if (lens.pickerOpen) {
          lens.setPickerOpen(false);
        } else {
          for (const [lensId, state] of lens.lenses) {
            if (state.expanded) { lens.toggleExpanded(lensId); break; }
          }
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleOpenFile, saveFileAs, lens.pickerOpen, lens.lenses, shortcutsOpen]);

  return (
    <div className={zenMode ? "zen h-full flex flex-col" : "h-full flex flex-col"}>
      <TopBar
        filename={filename}
        activeLensCount={lens.lenses.size}
        saveState={saveState}
        onOpenLensPicker={() => lens.setPickerOpen(true)}
        onOpenFile={handleOpenFile}
      />

      <div
        className="editor-surface relative"
        onClick={(e) => {
          // Click on empty space focuses the editor
          if (e.target === e.currentTarget) {
            const view = editorRef.current?.getEditorView();
            if (view) view.focus();
          }
        }}
      >
        <div className="editor-column">
          <Editor
            defaultValue={initialContent}
            onChange={handleEditorChange}
            editorRef={editorRef}
          />
        </div>

        <LensLayer
          lenses={lens.lenses}
          definitions={lens.available}
          onToggleExpanded={lens.toggleExpanded}
          onDismiss={lens.deactivate}
          onAsk={lens.ask}
          onRethink={lens.rethink}
          onReset={lens.resetLens}
          onBubbleDragStart={handleDragStart}
          draggingLensId={drag?.lensId ?? null}
        />
      </div>

      {/* Paragraph highlight during drag */}
      {highlight && (
        <div
          style={{
            position: "fixed",
            top: highlight.rect.top,
            left: highlight.rect.left,
            width: highlight.rect.width,
            height: highlight.rect.height,
            background: `${highlight.color}15`,
            borderRadius: "6px",
            pointerEvents: "none",
            zIndex: 50,
            transition: "top 0.08s, height 0.08s",
          }}
        />
      )}

      {/* Floating loupe during drag */}
      {drag && (
        <div className="loupe-drag-overlay" style={{ left: drag.x, top: drag.y }}>
          <LoupeIcon
            size={62}
            color={drag.definition.color}
            icon={drag.definition.icon}
            glow
          />
        </div>
      )}

      {/* Snap-back animation */}
      {snapBack && (
        <div
          className="loupe-drag-overlay"
          style={{
            left: snapBack.toX,
            top: snapBack.toY,
            transition: "left 0.25s ease-out, top 0.25s ease-out, transform 0.25s ease-out, opacity 0.25s",
            opacity: 0.4,
            transform: "translate(-50%, -50%) scale(0.7)",
          }}
        >
          <LoupeIcon
            size={44}
            color={snapBack.definition.color}
            icon={snapBack.definition.icon}
          />
        </div>
      )}

      {lens.pickerOpen && (
        <LensPicker
          available={lens.available}
          activeLensCount={lens.lenses.size}
          onActivate={lens.activate}
          onClose={() => lens.setPickerOpen(false)}
        />
      )}

      {/* Keyboard shortcuts overlay */}
      {shortcutsOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          onClick={() => setShortcutsOpen(false)}
        >
          <div
            className="rounded-xl p-6 max-w-xs w-full"
            style={{
              background: "var(--loupe-elevated)",
              border: "1px solid var(--loupe-border-strong)",
              boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-semibold mb-4" style={{ color: "var(--loupe-text)" }}>
              Keyboard Shortcuts
            </h3>
            <div className="space-y-2.5 text-[12.5px]" style={{ color: "var(--loupe-text-secondary)" }}>
              {[
                ["Cmd + L", "Open lens picker"],
                ["Cmd + O", "Open file"],
                ["Cmd + S", "Save file"],
                ["Cmd + .", "Toggle zen mode"],
                ["Cmd + Z", "Undo"],
                ["Cmd + Shift + Z", "Redo"],
                ["Cmd + /", "This overlay"],
                ["Escape", "Close / collapse"],
              ].map(([key, desc]) => (
                <div key={key} className="flex justify-between gap-4">
                  <span style={{ color: "var(--loupe-text-tertiary)" }}>{desc}</span>
                  <kbd className="font-mono text-[11px] px-1.5 py-0.5 rounded" style={{
                    background: "var(--loupe-surface)",
                    color: "var(--loupe-text)",
                  }}>{key}</kbd>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
