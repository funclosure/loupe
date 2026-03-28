import { useRef, useEffect, useCallback } from "react";
import { createEditor, type MilkdownInstance } from "./milkdown-setup";

interface EditorProps {
  defaultValue: string;
  onChange: (markdown: string) => void;
  editorRef?: React.MutableRefObject<MilkdownInstance | null>;
}

export function Editor({ defaultValue, onChange, editorRef }: EditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<MilkdownInstance | null>(null);

  const handleChange = useCallback(
    (md: string) => {
      onChange(md);
    },
    [onChange]
  );

  useEffect(() => {
    if (!containerRef.current) return;

    let mounted = true;

    createEditor(containerRef.current, defaultValue, handleChange).then(
      (instance) => {
        if (!mounted) {
          instance.editor.destroy();
          return;
        }
        instanceRef.current = instance;
        if (editorRef) editorRef.current = instance;
      }
    );

    return () => {
      mounted = false;
      instanceRef.current?.editor.destroy();
      instanceRef.current = null;
      if (editorRef) editorRef.current = null;
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="prose prose-invert prose-neutral max-w-none
                 [&_.milkdown]:outline-none [&_.milkdown]:min-h-[80vh]"
    />
  );
}
