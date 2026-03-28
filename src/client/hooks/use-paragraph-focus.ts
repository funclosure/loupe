import { useEffect, useRef } from "react";

/**
 * Detects when the user's cursor rests in a paragraph for 2+ seconds.
 * Calls onFocus with the paragraph text. Deduplicates — won't re-fire
 * for the same paragraph until cursor moves elsewhere and returns.
 */
export function useParagraphFocus(
  onFocus: (paragraphText: string) => void
) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastParagraphRef = useRef<string | null>(null);

  useEffect(() => {
    const handler = () => {
      // Clear existing timer on any selection change
      if (timerRef.current) clearTimeout(timerRef.current);

      timerRef.current = setTimeout(() => {
        const selection = window.getSelection();
        if (!selection || !selection.anchorNode) return;

        // Walk up from cursor to find the nearest block element (paragraph)
        let node: Node | null = selection.anchorNode;
        while (node && node.nodeType !== Node.ELEMENT_NODE) {
          node = node.parentNode;
        }
        if (!node) return;

        const element = node as HTMLElement;
        const block = element.closest("p, h1, h2, h3, h4, h5, h6, li, blockquote");
        if (!block) return;

        const text = block.textContent?.trim() || "";
        if (!text || text.length < 10) return; // Skip very short content

        // Deduplicate: don't re-fire for the same paragraph
        if (text === lastParagraphRef.current) return;
        lastParagraphRef.current = text;

        onFocus(text);
      }, 2000);
    };

    document.addEventListener("selectionchange", handler);
    return () => {
      document.removeEventListener("selectionchange", handler);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [onFocus]);
}
