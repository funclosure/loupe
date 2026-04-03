import { useRef, useEffect, useState, useCallback } from "react";
import { createEditor, type MilkdownInstance } from "./milkdown-setup";
import { ImageLightbox } from "./ImageLightbox";
import { ImageEditPopup } from "./ImageEditPopup";

interface EditorProps {
  defaultValue: string;
  onChange: (markdown: string) => void;
  editorRef?: React.MutableRefObject<MilkdownInstance | null>;
  placeholder?: string | false;
}

export function Editor({ defaultValue, onChange, editorRef, placeholder = "Start writing..." }: EditorProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<MilkdownInstance | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const [isEmpty, setIsEmpty] = useState(!defaultValue);
  const [lightbox, setLightbox] = useState<{ src: string; alt: string } | null>(null);
  const [editTarget, setEditTarget] = useState<{
    src: string;
    alt: string;
    getPos: () => number | undefined;
  } | null>(null);

  // Stable callbacks — empty deps because setLightbox/setEditTarget are stable React state setters
  const handleImageClick = useCallback((src: string, alt: string) => {
    setLightbox({ src, alt });
  }, []);

  const handleImageEdit = useCallback((src: string, alt: string, getPos: () => number | undefined) => {
    setEditTarget({ src, alt, getPos });
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;

    let mounted = true;
    let initialized = false;

    createEditor(containerRef.current, defaultValue, (md: string) => {
      if (!initialized) {
        initialized = true;
        if (!defaultValue) return;
      }
      onChangeRef.current(md);
      setIsEmpty(!md || md.replace(/\s/g, "") === "");
    }, handleImageClick, handleImageEdit).then(
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

  const handleEditSave = useCallback((newSrc: string, newAlt: string) => {
    if (!editTarget) return;
    const pos = editTarget.getPos();
    if (pos === undefined) return;
    const view = instanceRef.current?.getEditorView();
    if (!view) return;
    const currentNode = view.state.doc.nodeAt(pos);
    if (!currentNode) return;
    view.dispatch(
      view.state.tr.setNodeMarkup(pos, null, {
        ...currentNode.attrs,
        src: newSrc,
        alt: newAlt,
      })
    );
    setEditTarget(null);
  }, [editTarget]);

  // Handle image paste — upload to server, insert markdown image
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handlePaste = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (const item of items) {
        if (item.type.startsWith("image/")) {
          e.preventDefault();
          const blob = item.getAsFile();
          if (!blob) return;

          const res = await fetch("/api/image", {
            method: "POST",
            headers: { "Content-Type": blob.type },
            body: blob,
          });

          if (!res.ok) {
            window.dispatchEvent(new CustomEvent("loupe-configure-images"));
            return;
          }
          const { path } = await res.json();

          const view = instanceRef.current?.getEditorView();
          if (!view) return;

          const { state, dispatch } = view;
          const imageType = state.schema.nodes.image;
          if (!imageType) return;

          const node = imageType.create({ src: path, alt: "" });
          dispatch(state.tr.replaceSelectionWith(node));
          return;
        }
      }
    };

    container.addEventListener("paste", handlePaste);
    return () => container.removeEventListener("paste", handlePaste);
  }, []);

  // Hide placeholder instantly on first input — don't wait for markdownUpdated
  useEffect(() => {
    if (!isEmpty) return;
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    const hideOnInput = () => setIsEmpty(false);
    wrapper.addEventListener("keydown", hideOnInput, { once: true });
    return () => wrapper.removeEventListener("keydown", hideOnInput);
  }, [isEmpty]);

  // Click anywhere to focus the editor
  const handleClick = useCallback(() => {
    const view = instanceRef.current?.getEditorView();
    if (view && !view.hasFocus()) {
      view.focus();
    }
  }, []);

  return (
    <div ref={wrapperRef} className="loupe-editor" onClick={handleClick}>
      {isEmpty && placeholder && (
        <div className="loupe-placeholder">
          {placeholder}
        </div>
      )}
      <div ref={containerRef} />
      {lightbox && (
        <ImageLightbox
          src={lightbox.src}
          alt={lightbox.alt}
          onClose={() => setLightbox(null)}
        />
      )}
      {editTarget && (
        <ImageEditPopup
          src={editTarget.src}
          alt={editTarget.alt}
          onSave={handleEditSave}
          onClose={() => setEditTarget(null)}
        />
      )}
    </div>
  );
}
