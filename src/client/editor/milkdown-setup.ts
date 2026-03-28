import {
  Editor,
  rootCtx,
  defaultValueCtx,
  editorViewCtx,
} from "@milkdown/kit/core";
import { commonmark } from "@milkdown/kit/preset/commonmark";
import { listener, listenerCtx } from "@milkdown/kit/plugin/listener";
import { getMarkdown } from "@milkdown/kit/utils";
import type { EditorView } from "@milkdown/kit/prose/view";

export interface MilkdownInstance {
  editor: Editor;
  getMarkdown: () => string;
  getEditorView: () => EditorView;
  destroy: () => void;
}

export async function createEditor(
  root: HTMLElement,
  defaultValue: string,
  onChange: (markdown: string) => void
): Promise<MilkdownInstance> {
  const editor = await Editor.make()
    .config((ctx) => {
      ctx.set(rootCtx, root);
      ctx.set(defaultValueCtx, defaultValue);

      const listenerManager = ctx.get(listenerCtx);
      listenerManager.markdownUpdated((_ctx, markdown) => {
        onChange(markdown);
      });
    })
    .use(commonmark)
    .use(listener)
    .create();

  // Milkdown injects theme classes (prose, milkdown-theme-nord) that fight
  // our zen styling. Nuke them by replacing the className entirely.
  const cleanupClasses = () => {
    const pm = root.querySelector(".ProseMirror") as HTMLElement | null;
    if (pm) {
      // Keep only ProseMirror — strip prose, theme-nord, editor, dark:prose-invert
      pm.className = "ProseMirror";
      pm.setAttribute("data-placeholder", "Start writing...");
    }
  };

  // Run cleanup after Milkdown finishes rendering (next frame)
  requestAnimationFrame(cleanupClasses);

  // Watch for Milkdown re-applying classes
  const observer = new MutationObserver(() => {
    const pm = root.querySelector(".ProseMirror");
    if (pm && pm.classList.contains("milkdown-theme-nord")) {
      cleanupClasses();
    }
  });
  const pmEl = root.querySelector(".ProseMirror");
  if (pmEl) {
    observer.observe(pmEl, { attributes: true, attributeFilter: ["class"] });
  }

  return {
    editor,
    getMarkdown: () => editor.action(getMarkdown()),
    getEditorView: () => editor.action((ctx) => ctx.get(editorViewCtx)),
    destroy: () => {
      observer.disconnect();
      editor.destroy();
    },
  };
}
