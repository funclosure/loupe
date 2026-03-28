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
import { nord } from "@milkdown/theme-nord";

export interface MilkdownInstance {
  editor: Editor;
  getMarkdown: () => string;
  getEditorView: () => EditorView;
  setMarkdown: (md: string) => void;
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
    .config(nord)
    .use(commonmark)
    .use(listener)
    .create();

  return {
    editor,
    getMarkdown: () => editor.action(getMarkdown()),
    getEditorView: () => editor.action((ctx) => ctx.get(editorViewCtx)),
    setMarkdown: (_md: string) => {
      // Placeholder for Phase 2 diff features
    },
  };
}
