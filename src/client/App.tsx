import { useCallback, useEffect, useRef } from "react";
import { Editor } from "./editor/Editor";
import { TopBar } from "./chrome/TopBar";
import { useFile } from "./hooks/use-file";
import { useZenMode } from "./hooks/use-zen-mode";
import type { MilkdownInstance } from "./editor/milkdown-setup";

export function App() {
  const { filename, content, saveState, openFile, saveFileAs, updateContent } = useFile();
  const { zenMode } = useZenMode();
  const editorRef = useRef<MilkdownInstance | null>(null);

  const handleEditorChange = useCallback((markdown: string) => {
    updateContent(markdown);
  }, [updateContent]);

  const handleOpenFile = useCallback(async () => {
    await openFile();
  }, [openFile]);

  const handleOpenLensPicker = useCallback(() => {}, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "o") {
        e.preventDefault();
        openFile();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [openFile]);

  return (
    <div className={zenMode ? "zen h-full flex flex-col" : "h-full flex flex-col"}>
      <TopBar
        filename={filename}
        activeLensCount={0}
        saveState={saveState}
        onOpenLensPicker={handleOpenLensPicker}
        onOpenFile={handleOpenFile}
      />
      <div className="editor-surface">
        <div className="editor-column">
          <Editor defaultValue={content} onChange={handleEditorChange} editorRef={editorRef} />
        </div>
      </div>
    </div>
  );
}
