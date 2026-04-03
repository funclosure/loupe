import { $view } from "@milkdown/kit/utils";
import { imageSchema } from "@milkdown/kit/preset/commonmark";
import type { EditorView } from "@milkdown/kit/prose/view";
import type { Node } from "@milkdown/kit/prose/model";

const PENCIL_ICON = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;

class ImageNodeView {
  dom: HTMLElement;
  private img: HTMLImageElement;
  private editBtn: HTMLButtonElement;
  private node: Node;
  private getPos: () => number | undefined;
  private onImageClick: (src: string, alt: string) => void;
  private onImageEdit: (src: string, alt: string, getPos: () => number | undefined) => void;

  constructor(
    node: Node,
    getPos: () => number | undefined,
    onImageClick: (src: string, alt: string) => void,
    onImageEdit: (src: string, alt: string, getPos: () => number | undefined) => void,
  ) {
    this.node = node;
    this.getPos = getPos;
    this.onImageClick = onImageClick;
    this.onImageEdit = onImageEdit;

    // Wrapper (leaf node — no contentDOM, no contentEditable needed)
    this.dom = document.createElement("div");
    this.dom.className = "image-wrapper";

    // Image
    this.img = document.createElement("img");
    this.img.src = node.attrs.src ?? "";
    this.img.alt = node.attrs.alt ?? "";
    this.img.title = node.attrs.title ?? "";
    this.img.addEventListener("click", (e) => {
      e.stopPropagation();
      this.onImageClick(this.node.attrs.src ?? "", this.node.attrs.alt ?? "");
    });
    this.dom.appendChild(this.img);

    // Edit button
    this.editBtn = document.createElement("button");
    this.editBtn.className = "image-edit-btn";
    this.editBtn.type = "button";
    this.editBtn.title = "Edit image";
    this.editBtn.innerHTML = PENCIL_ICON;
    this.editBtn.addEventListener("mousedown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.onImageEdit(this.node.attrs.src ?? "", this.node.attrs.alt ?? "", this.getPos);
    });
    this.dom.appendChild(this.editBtn);
  }

  update(node: Node): boolean {
    if (node.type !== this.node.type) return false;
    this.node = node;
    this.img.src = node.attrs.src ?? "";
    this.img.alt = node.attrs.alt ?? "";
    this.img.title = node.attrs.title ?? "";
    return true;
  }

  stopEvent(event: Event): boolean {
    const target = event.target as HTMLElement;
    return this.editBtn.contains(target);
  }

  ignoreMutation(
    _mutation: MutationRecord | { type: "selection"; target: globalThis.Node }
  ): boolean {
    return true;
  }

  destroy(): void {
    // nothing to clean up
  }
}

export function createImageView(
  onImageClick: (src: string, alt: string) => void,
  onImageEdit: (src: string, alt: string, getPos: () => number | undefined) => void,
) {
  return $view(imageSchema.node, () => {
    return (node: Node, _view: EditorView, getPos: () => number | undefined) =>
      new ImageNodeView(node, getPos, onImageClick, onImageEdit);
  });
}
