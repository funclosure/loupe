import { useState, useRef, useCallback, useEffect } from "react";

const STORAGE_KEY_CONTENT = "loupe-draft";
const STORAGE_KEY_FILENAME = "loupe-filename";

interface UseFileReturn {
  filename: string;
  initialContent: string; // For editor mount — read once
  saveState: "saved" | "saving" | "unsaved" | "unavailable";
  openFile: () => Promise<string | null>;
  saveFileAs: () => Promise<void>;
  updateContent: (newContent: string) => void;
  isSupported: boolean;
}

export function useFile(): UseFileReturn {
  const isSupported = "showOpenFilePicker" in window;

  // Restore from localStorage on mount
  const [filename, setFilename] = useState(
    () => localStorage.getItem(STORAGE_KEY_FILENAME) || "Untitled"
  );
  const [initialContent] = useState(
    () => localStorage.getItem(STORAGE_KEY_CONTENT) || ""
  );
  const [saveState, setSaveState] = useState<UseFileReturn["saveState"]>(
    isSupported ? "unsaved" : "unavailable"
  );

  const fileHandleRef = useRef<FileSystemFileHandle | null>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const localSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestContentRef = useRef(initialContent);

  const writeToHandle = useCallback(async (handle: FileSystemFileHandle, text: string) => {
    try {
      setSaveState("saving");
      const writable = await handle.createWritable();
      await writable.write(text);
      await writable.close();
      setSaveState("saved");
    } catch {
      setSaveState("unavailable");
    }
  }, []);

  const updateContent = useCallback((newContent: string) => {
    latestContentRef.current = newContent;

    // Always save to localStorage (survives refresh)
    if (localSaveTimeoutRef.current) clearTimeout(localSaveTimeoutRef.current);
    localSaveTimeoutRef.current = setTimeout(() => {
      localStorage.setItem(STORAGE_KEY_CONTENT, newContent);
    }, 500);

    // Save to file handle if available
    if (!fileHandleRef.current) return;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      if (fileHandleRef.current) writeToHandle(fileHandleRef.current, latestContentRef.current);
    }, 1000);
  }, [writeToHandle]);

  const persistFilename = useCallback((name: string) => {
    setFilename(name);
    localStorage.setItem(STORAGE_KEY_FILENAME, name);
  }, []);

  const openFile = useCallback(async (): Promise<string | null> => {
    if (!isSupported) {
      return new Promise((resolve) => {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = ".md,.txt";
        input.onchange = async () => {
          const file = input.files?.[0];
          if (!file) { resolve(null); return; }
          const text = await file.text();
          persistFilename(file.name);
          latestContentRef.current = text;
          localStorage.setItem(STORAGE_KEY_CONTENT, text);
          resolve(text);
        };
        input.click();
      });
    }
    try {
      const [handle] = await (window as any).showOpenFilePicker({
        types: [{ description: "Markdown files", accept: { "text/markdown": [".md"], "text/plain": [".txt"] } }],
      });
      fileHandleRef.current = handle;
      const file = await handle.getFile();
      const text = await file.text();
      persistFilename(file.name);
      latestContentRef.current = text;
      localStorage.setItem(STORAGE_KEY_CONTENT, text);
      setSaveState("saved");
      return text;
    } catch {
      return null;
    }
  }, [isSupported, persistFilename]);

  const saveFileAs = useCallback(async () => {
    if (!isSupported) {
      const blob = new Blob([latestContentRef.current], { type: "text/markdown" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename === "Untitled" ? "untitled.md" : filename;
      a.click();
      URL.revokeObjectURL(url);
      return;
    }
    try {
      const handle = await (window as any).showSaveFilePicker({
        suggestedName: filename === "Untitled" ? "untitled.md" : filename,
        types: [{ description: "Markdown files", accept: { "text/markdown": [".md"] } }],
      });
      fileHandleRef.current = handle;
      persistFilename(handle.name);
      await writeToHandle(handle, latestContentRef.current);
    } catch {
      /* User cancelled */
    }
  }, [isSupported, filename, writeToHandle, persistFilename]);

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      if (localSaveTimeoutRef.current) clearTimeout(localSaveTimeoutRef.current);
    };
  }, []);

  return { filename, initialContent, saveState, openFile, saveFileAs, updateContent, persistFilename, isSupported };
}
