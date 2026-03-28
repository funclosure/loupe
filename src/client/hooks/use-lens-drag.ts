import { useState, useCallback, useRef } from "react";
import type { MilkdownInstance } from "../editor/milkdown-setup";
import type { LensDefinition } from "@shared/types";

interface DragState {
  lensId: string;
  definition: LensDefinition;
  x: number;
  y: number;
}

export interface SnapBackState {
  definition: LensDefinition;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
}

export interface HighlightState {
  rect: { top: number; left: number; width: number; height: number };
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
  const [highlight, setHighlight] = useState<HighlightState | null>(null);
  const [snapBack, setSnapBack] = useState<SnapBackState | null>(null);
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

      // Hide drag overlay during hit-test — elementFromPoint ignores
      // pointer-events:none and would return the overlay element
      const overlay = document.querySelector(".loupe-drag-overlay") as HTMLElement | null;
      if (overlay) overlay.style.display = "none";

      const el = document.elementFromPoint(x, y);

      if (overlay) overlay.style.display = "";

      if (!el) return null;

      // Walk up to find the nearest block-level element within the editor
      const block = el.closest("p, h1, h2, h3, h4, h5, h6, li, blockquote, pre");
      if (!block || !view.dom.contains(block)) return null;

      return { element: block as HTMLElement, text: block.textContent || "" };
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
          const rect = block.element.getBoundingClientRect();
          const hl: HighlightState = {
            rect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height },
            text: block.text,
            color: def.color,
          };
          highlightRef.current = hl;
          setHighlight(hl);
        } else {
          if (highlightRef.current) {
            highlightRef.current = null;
            setHighlight(null);
          }
        }
      };

      const onUp = (ue: PointerEvent) => {
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

        // Clear highlight
        highlightRef.current = null;
        setHighlight(null);

        if (wasDragging) {
          // Snap-back animation: find the resting bubble position
          const bubbleEl = document.querySelector(`[data-lens-id="${lensId}"] .loupe-bubble`);
          const bubbleRect = bubbleEl?.getBoundingClientRect();
          const toX = bubbleRect ? bubbleRect.x + bubbleRect.width / 2 : startPosRef.current?.x ?? ue.clientX;
          const toY = bubbleRect ? bubbleRect.y + bubbleRect.height / 2 : startPosRef.current?.y ?? ue.clientY;

          setSnapBack({
            definition: def,
            fromX: ue.clientX,
            fromY: ue.clientY,
            toX,
            toY,
          });
          // Clear drag immediately so bubble reappears at full opacity
          dragRef.current = null;
          setDrag(null);

          // Clear snap-back after animation
          setTimeout(() => setSnapBack(null), 300);

          // Trigger focus if over a valid block
          const block = resolveBlock(ue.clientX, ue.clientY);
          if (block && block.text.trim().length >= 10) {
            // Show a brief landed highlight
            const rect = block.element.getBoundingClientRect();
            setHighlight({
              rect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height },
              text: block.text,
              color: def.color,
            });
            setTimeout(() => setHighlight(null), 2000);

            onFocus(lensId, block.text, versionRef.current);
          }
        } else {
          dragRef.current = null;
          setDrag(null);
        }
      };

      document.addEventListener("pointermove", onMove);
      document.addEventListener("pointerup", onUp);
    },
    [lenses, definitions, editorRef, resolveBlock, onFocus, versionRef]
  );

  return { drag, highlight, snapBack, handleDragStart };
}
