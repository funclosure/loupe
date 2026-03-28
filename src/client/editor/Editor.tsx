import { useRef, useEffect, useState, useCallback } from "react";
import { createEditor, type MilkdownInstance } from "./milkdown-setup";

interface EditorProps {
  defaultValue: string;
  onChange: (markdown: string) => void;
  editorRef?: React.MutableRefObject<MilkdownInstance | null>;
}

export function Editor({ defaultValue, onChange, editorRef }: EditorProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<MilkdownInstance | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const [isEmpty, setIsEmpty] = useState(true);

  useEffect(() => {
    if (!containerRef.current) return;

    let mounted = true;
    let initialized = false;

    createEditor(containerRef.current, defaultValue, (md: string) => {
      // Skip the initial markdownUpdated call from Milkdown setup
      if (!initialized) {
        initialized = true;
        if (!defaultValue) return; // Don't fire onChange for empty init
      }
      onChangeRef.current(md);
      // Milkdown emits "\n" for empty docs
      setIsEmpty(!md || md.replace(/\s/g, "") === "");
    }).then(
      (instance) => {
        if (!mounted) {
          instance.destroy();
          return;
        }
        instanceRef.current = instance;
        if (editorRef) editorRef.current = instance;
      }
    );

    return () => {
      mounted = false;
      instanceRef.current?.destroy();
      instanceRef.current = null;
      if (editorRef) editorRef.current = null;
    };
  }, []);

  // Click anywhere to focus the editor
  const handleClick = useCallback(() => {
    const view = instanceRef.current?.getEditorView();
    if (view && !view.hasFocus()) {
      view.focus();
    }
  }, []);

  return (
    <div ref={wrapperRef} className="loupe-editor" onClick={handleClick}>
      {isEmpty && (
        <div className="loupe-placeholder">
          Start writing...
        </div>
      )}
      <div ref={containerRef} />
    </div>
  );
}
