import { useState, useCallback, useRef } from "react";
import type { MilkdownInstance } from "../editor/milkdown-setup";
import type { LensDefinition } from "@shared/types";

interface DragState {
  lensId: string;
  definition: LensDefinition;
  x: number;
  y: number;
}

interface HighlightState {
  element: HTMLElement;
  text: string;
  color: string;
}

interface UseLensDragOptions {
  editorRef: React.RefObject<MilkdownInstance | null>;
  definitions: LensDefinition[];
  lenses: Map<string, { definitionId: string; status: string }>;
  onFocus: (lensId: string, text: string, version: number) => void;
  versionRef: React.RefObject<number>;
}

export function useLensDrag({
  editorRef,
  definitions,
  lenses,
  onFocus,
  versionRef,
}: UseLensDragOptions) {
  const [drag, setDrag] = useState<DragState | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const highlightRef = useRef<HighlightState | null>(null);
  const startPosRef = useRef<{ x: number; y: number } | null>(null);
  const isDraggingRef = useRef(false);

  /**
   * Resolve screen coordinates to the nearest block-level element and its text.
   * Uses ProseMirror's posAtCoords + doc.resolve to find block nodes.
   */
  const resolveBlock = useCallback(
    (x: number, y: number): { element: HTMLElement; text: string } | null => {
      const view = editorRef.current?.getEditorView();
      if (!view) return null;

      const posInfo = view.posAtCoords({ left: x, top: y });
      if (!posInfo) return null;

      const pos = posInfo.inside >= 0 ? posInfo.inside : posInfo.pos;
      const resolved = view.state.doc.resolve(pos);

      // Walk up depth to find block-level node
      for (let depth = resolved.depth; depth >= 1; depth--) {
        const node = resolved.node(depth);
        if (node.isBlock) {
          const nodePos = resolved.before(depth);
          const dom = view.nodeDOM(nodePos);
          if (dom instanceof HTMLElement) {
            return { element: dom, text: node.textContent };
          }
        }
      }
      return null;
    },
    [editorRef]
  );

  const handleDragStart = useCallback(
    (lensId: string, e: React.PointerEvent) => {
      const lensState = lenses.get(lensId);
      if (!lensState || lensState.status === "thinking") return;

      const def = definitions.find((d) => d.id === lensState.definitionId);
      if (!def) return;

      startPosRef.current = { x: e.clientX, y: e.clientY };

      // Suppress ProseMirror native drag-and-drop during lens drag
      const editorDom = editorRef.current?.getEditorView()?.dom;
      const suppressDrag = (ev: Event) => ev.preventDefault();

      const onMove = (me: PointerEvent) => {
        const start = startPosRef.current;
        if (!start) return;

        // Require 5px movement before starting drag (distinguishes click from drag)
        if (!isDraggingRef.current) {
          const dx = me.clientX - start.x;
          const dy = me.clientY - start.y;
          if (Math.sqrt(dx * dx + dy * dy) < 5) return;
          isDraggingRef.current = true;
          document.body.style.userSelect = "none";
          if (editorDom) {
            editorDom.addEventListener("dragover", suppressDrag);
            editorDom.addEventListener("drop", suppressDrag);
          }
        }

        const state: DragState = {
          lensId,
          definition: def,
          x: me.clientX,
          y: me.clientY,
        };
        dragRef.current = state;
        setDrag(state);

        // Hit-test for block highlight
        const block = resolveBlock(me.clientX, me.clientY);
        if (block && block.text.trim().length >= 10) {
          if (highlightRef.current?.element !== block.element) {
            // Clear old highlight
            if (highlightRef.current) {
              highlightRef.current.element.style.borderLeft = "";
              highlightRef.current.element.style.background = "";
            }
            // Apply new highlight
            block.element.style.borderLeft = `3px solid ${def.color}80`;
            block.element.style.background = `${def.color}08`;
            highlightRef.current = { ...block, color: def.color };
          }
        } else {
          // Clear highlight when not over valid block
          if (highlightRef.current) {
            highlightRef.current.element.style.borderLeft = "";
            highlightRef.current.element.style.background = "";
            highlightRef.current = null;
          }
        }
      };

      const onUp = () => {
        document.body.style.userSelect = "";
        if (editorDom) {
          editorDom.removeEventListener("dragover", suppressDrag);
          editorDom.removeEventListener("drop", suppressDrag);
        }
        document.removeEventListener("pointermove", onMove);
        document.removeEventListener("pointerup", onUp);

        const wasDragging = isDraggingRef.current;
        isDraggingRef.current = false;
        startPosRef.current = null;

        // Clear highlight styling
        if (highlightRef.current) {
          const el = highlightRef.current.element;
          const text = highlightRef.current.text;
          el.style.borderLeft = "";
          el.style.background = "";

          // If we were dragging and have a valid target, trigger focus
          if (wasDragging && text.trim().length >= 10) {
            // Leave a fading accent
            el.style.borderLeft = `2px solid ${def.color}40`;
            el.style.transition = "border-left-color 2s";
            setTimeout(() => {
              el.style.borderLeft = "";
              el.style.transition = "";
            }, 2000);

            onFocus(lensId, text, versionRef.current);
          }

          highlightRef.current = null;
        }

        dragRef.current = null;
        setDrag(null);
      };

      document.addEventListener("pointermove", onMove);
      document.addEventListener("pointerup", onUp);
    },
    [lenses, definitions, editorRef, resolveBlock, onFocus, versionRef]
  );

  return { drag, handleDragStart };
}
