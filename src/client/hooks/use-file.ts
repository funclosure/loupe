import { useState, useRef, useCallback, useEffect } from "react";

interface UseFileReturn {
  filename: string;
  content: string;
  saveState: "saved" | "saving" | "unsaved" | "unavailable";
  openFile: () => Promise<void>;
  saveFileAs: () => Promise<void>;
  updateContent: (newContent: string) => void;
  isSupported: boolean;
}

export function useFile(): UseFileReturn {
  const isSupported = "showOpenFilePicker" in window;
  const [filename, setFilename] = useState("Untitled");
  const [content, setContent] = useState("");
  const [saveState, setSaveState] = useState<UseFileReturn["saveState"]>(isSupported ? "unsaved" : "unavailable");
  const fileHandleRef = useRef<FileSystemFileHandle | null>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestContentRef = useRef(content);

  const writeToHandle = useCallback(async (handle: FileSystemFileHandle, text: string) => {
    try {
      setSaveState("saving");
      const writable = await handle.createWritable();
      await writable.write(text);
      await writable.close();
      setSaveState("saved");
    } catch { setSaveState("unavailable"); }
  }, []);

  const updateContent = useCallback((newContent: string) => {
    latestContentRef.current = newContent;
    setContent(newContent);
    if (!fileHandleRef.current) return;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      if (fileHandleRef.current) writeToHandle(fileHandleRef.current, latestContentRef.current);
    }, 1000);
  }, [writeToHandle]);

  const openFile = useCallback(async () => {
    if (!isSupported) {
      const input = document.createElement("input");
      input.type = "file"; input.accept = ".md,.txt";
      input.onchange = async () => {
        const file = input.files?.[0]; if (!file) return;
        const text = await file.text();
        setFilename(file.name); setContent(text); latestContentRef.current = text;
      };
      input.click(); return;
    }
    try {
      const [handle] = await (window as any).showOpenFilePicker({ types: [{ description: "Markdown files", accept: { "text/markdown": [".md"], "text/plain": [".txt"] } }] });
      fileHandleRef.current = handle;
      const file = await handle.getFile();
      const text = await file.text();
      setFilename(file.name); setContent(text); latestContentRef.current = text; setSaveState("saved");
    } catch { /* User cancelled */ }
  }, [isSupported]);

  const saveFileAs = useCallback(async () => {
    if (!isSupported) {
      const blob = new Blob([latestContentRef.current], { type: "text/markdown" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url;
      a.download = filename === "Untitled" ? "untitled.md" : filename;
      a.click(); URL.revokeObjectURL(url); return;
    }
    try {
      const handle = await (window as any).showSaveFilePicker({ suggestedName: filename === "Untitled" ? "untitled.md" : filename, types: [{ description: "Markdown files", accept: { "text/markdown": [".md"] } }] });
      fileHandleRef.current = handle; setFilename(handle.name);
      await writeToHandle(handle, latestContentRef.current);
    } catch { /* User cancelled */ }
  }, [isSupported, filename, writeToHandle]);

  useEffect(() => { return () => { if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current); }; }, []);

  return { filename, content, saveState, openFile, saveFileAs, updateContent, isSupported };
}
