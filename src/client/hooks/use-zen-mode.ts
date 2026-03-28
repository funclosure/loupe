import { useState, useEffect, useCallback } from "react";

export function useZenMode() {
  const [zenMode, setZenMode] = useState(() => localStorage.getItem("loupe-zen-mode") === "true");
  const toggle = useCallback(() => {
    setZenMode((prev) => { const next = !prev; localStorage.setItem("loupe-zen-mode", String(next)); return next; });
  }, []);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key === ".") { e.preventDefault(); toggle(); } };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [toggle]);
  return { zenMode, toggle };
}
