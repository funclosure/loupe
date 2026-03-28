import { useState, useCallback, useRef } from "react";
import { Editor } from "./editor/Editor";
import { TopBar } from "./chrome/TopBar";
import type { MilkdownInstance } from "./editor/milkdown-setup";

export function App() {
  const [filename, setFilename] = useState("Untitled");
  const [content, setContent] = useState("");
  const [zenMode, setZenMode] = useState(false);
  const editorRef = useRef<MilkdownInstance | null>(null);
  const handleEditorChange = useCallback((markdown: string) => { setContent(markdown); }, []);
  const handleOpenFile = useCallback(() => {}, []);
  const handleOpenLensPicker = useCallback(() => {}, []);

  return (
    <div className={zenMode ? "zen h-full flex flex-col" : "h-full flex flex-col"}>
      <TopBar filename={filename} activeLensCount={0} saveState="unsaved" onOpenLensPicker={handleOpenLensPicker} onOpenFile={handleOpenFile} />
      <div className="editor-surface">
        <div className="editor-column">
          <Editor defaultValue="" onChange={handleEditorChange} editorRef={editorRef} />
        </div>
      </div>
    </div>
  );
}
