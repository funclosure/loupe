import { useEffect, useCallback, useRef } from "react";
import { Editor } from "./editor/Editor";
import { TopBar } from "./chrome/TopBar";
import { LensLayer } from "./lenses/LensLayer";
import { LensPicker } from "./chrome/LensPicker";
import { useFile } from "./hooks/use-file";
import { useZenMode } from "./hooks/use-zen-mode";
import { useLenses } from "./hooks/use-lenses";
import type { MilkdownInstance } from "./editor/milkdown-setup";

export function App() {
  const editorRef = useRef<MilkdownInstance | null>(null);
  const versionRef = useRef(0);
  const syncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { filename, initialContent, saveState, openFile, saveFileAs, updateContent } = useFile();
  const { zenMode } = useZenMode();
  const lens = useLenses();

  // Fetch available lenses on mount
  useEffect(() => { lens.fetchLenses(); }, []);

  // Load file from ?file= query param (CLI: `loupe sample.md`)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const filePath = params.get("file");
    if (!filePath) return;

    fetch(`/api/file?path=${encodeURIComponent(filePath)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.content && editorRef.current) {
          editorRef.current.setMarkdown(data.content);
          updateContent(data.content);
        }
      })
      .catch(() => {});
    // Clear the query param so refresh doesn't re-load over localStorage
    window.history.replaceState({}, "", "/");
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
      } else if (e.key === "Escape") {
        // Close picker or collapse any expanded lens
        if (lens.pickerOpen) {
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
  }, [handleOpenFile, saveFileAs, lens.pickerOpen, lens.lenses]);

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
          onFocus={(lensId) => {
            // Get current selection text from editor
            const selection = window.getSelection()?.toString() || "";
            lens.focus(lensId, selection, versionRef.current);
          }}
          onRethink={lens.rethink}
          onReset={lens.resetLens}
        />
      </div>

      {lens.pickerOpen && (
        <LensPicker
          available={lens.available}
          activeLensCount={lens.lenses.size}
          onActivate={lens.activate}
          onClose={() => lens.setPickerOpen(false)}
        />
      )}
    </div>
  );
}
