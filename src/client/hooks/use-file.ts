import { useState, useRef, useCallback, useEffect } from "react";

const STORAGE_KEY_CONTENT = "loupe-draft";
const STORAGE_KEY_FILENAME = "loupe-filename";

interface UseFileReturn {
  filename: string;
  initialContent: string;
  saveState: "saved" | "saving" | "unsaved";
  save: () => Promise<void>;
  saveAs: (path: string) => Promise<void>;
  updateContent: (content: string) => void;
  filePath: string | null;
  setFilePath: (path: string | null) => void;
  persistFilename: (name: string) => void;
  loadFromServer: (path: string) => Promise<string | null>;
}

export function useFile(): UseFileReturn {
  const [filename, setFilename] = useState(
    () => localStorage.getItem(STORAGE_KEY_FILENAME) || "Untitled"
  );
  const [initialContent] = useState(
    () => localStorage.getItem(STORAGE_KEY_CONTENT) || ""
  );
  const [saveState, setSaveState] = useState<UseFileReturn["saveState"]>("unsaved");
  const [filePath, setFilePath] = useState<string | null>(null);

  const latestContentRef = useRef(initialContent);
  const localSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const serverSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const persistFilename = useCallback((name: string) => {
    setFilename(name);
    localStorage.setItem(STORAGE_KEY_FILENAME, name);
  }, []);

  const writeToServer = useCallback(async (content: string, path?: string): Promise<boolean> => {
    try {
      setSaveState("saving");
      const body: Record<string, string> = { content };
      if (path) body.path = path;
      const res = await fetch("/api/file", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) { setSaveState("unsaved"); return false; }
      const data = await res.json();
      if (data.filename) persistFilename(data.filename);
      if (data.path) setFilePath(data.path);
      setSaveState("saved");
      return true;
    } catch {
      setSaveState("unsaved");
      return false;
    }
  }, [persistFilename]);

  const save = useCallback(async () => {
    if (serverSaveTimeoutRef.current) {
      clearTimeout(serverSaveTimeoutRef.current);
      serverSaveTimeoutRef.current = null;
    }
    await writeToServer(latestContentRef.current);
  }, [writeToServer]);

  const saveAs = useCallback(async (path: string) => {
    if (serverSaveTimeoutRef.current) {
      clearTimeout(serverSaveTimeoutRef.current);
      serverSaveTimeoutRef.current = null;
    }
    await writeToServer(latestContentRef.current, path);
  }, [writeToServer]);

  const updateContent = useCallback((newContent: string) => {
    latestContentRef.current = newContent;

    if (localSaveTimeoutRef.current) clearTimeout(localSaveTimeoutRef.current);
    localSaveTimeoutRef.current = setTimeout(() => {
      localStorage.setItem(STORAGE_KEY_CONTENT, newContent);
    }, 500);

    if (filePath) {
      if (serverSaveTimeoutRef.current) clearTimeout(serverSaveTimeoutRef.current);
      serverSaveTimeoutRef.current = setTimeout(() => {
        writeToServer(newContent);
      }, 1000);
    }
  }, [filePath, writeToServer]);

  const loadFromServer = useCallback(async (path: string): Promise<string | null> => {
    try {
      const res = await fetch(`/api/file?path=${encodeURIComponent(path)}`);
      if (!res.ok) return null;
      const data = await res.json();
      if (data.path) setFilePath(data.path);
      if (data.filename) persistFilename(data.filename);
      latestContentRef.current = data.content;
      localStorage.setItem(STORAGE_KEY_CONTENT, data.content);
      setSaveState("saved");
      return data.content;
    } catch {
      return null;
    }
  }, [persistFilename]);

  useEffect(() => {
    return () => {
      if (localSaveTimeoutRef.current) clearTimeout(localSaveTimeoutRef.current);
      if (serverSaveTimeoutRef.current) clearTimeout(serverSaveTimeoutRef.current);
    };
  }, []);

  return {
    filename, initialContent, saveState, save, saveAs, updateContent,
    filePath, setFilePath, persistFilename, loadFromServer,
  };
}
