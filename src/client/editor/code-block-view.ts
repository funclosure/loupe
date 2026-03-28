import { $view } from "@milkdown/kit/utils";
import { codeBlockSchema } from "@milkdown/kit/preset/commonmark";
import type { EditorView } from "@milkdown/kit/prose/view";
import type { Node } from "@milkdown/kit/prose/model";
import { highlightCode, LANGUAGE_OPTIONS } from "./shiki";

const WRAP_KEY = "loupe-code-wrap";

const COPY_ICON = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`;
const CHECK_ICON = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
const WRAP_ICON = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="6" x2="21" y2="6"/><path d="M3 12h15a3 3 0 1 1 0 6h-4"/><polyline points="16 16 14 18 16 20"/><line x1="3" y1="18" x2="10" y2="18"/></svg>`;
const CHEVRON_ICON = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>`;

class CodeBlockNodeView {
  dom: HTMLElement;
  contentDOM: HTMLElement;
  private toolbar: HTMLElement;
  private highlightPre: HTMLElement;
  private langBtn: HTMLButtonElement;
  private copyBtn: HTMLButtonElement;
  private wrapBtn: HTMLButtonElement;
  private dropdown: HTMLElement | null = null;
  private outsideClickHandler: ((e: MouseEvent) => void) | null = null;
  private node: Node;
  private view: EditorView;
  private getPos: () => number | undefined;
  private isWrapped: boolean;
  private highlightGen = 0;

  constructor(node: Node, view: EditorView, getPos: () => number | undefined) {
    this.node = node;
    this.view = view;
    this.getPos = getPos;
    this.isWrapped = localStorage.getItem(WRAP_KEY) === "true";

    // DOM structure:
    // <div.loupe-code-block>
    //   <div.loupe-code-toolbar> ... </div>
    //   <div.loupe-code-container>  (CSS Grid — both children in same cell)
    //     <pre.loupe-code-highlight> (Shiki overlay) </pre>
    //     <pre.loupe-code-editable><code contentDOM/></pre>
    //   </div>
    // </div>

    this.dom = document.createElement("div");
    this.dom.className = "loupe-code-block";
    if (this.isWrapped) this.dom.classList.add("wrapped");

    // Toolbar — contentEditable=false so inputs work inside contenteditable editor
    this.toolbar = this.createToolbar();
    this.toolbar.contentEditable = "false";
    this.dom.appendChild(this.toolbar);

    // Code container — CSS Grid stacks both layers in same cell
    // so they share a single scroll context (no desync)
    const container = document.createElement("div");
    container.className = "loupe-code-container";

    // Shiki overlay (background layer)
    this.highlightPre = document.createElement("pre");
    this.highlightPre.className = "loupe-code-highlight";
    this.highlightPre.setAttribute("aria-hidden", "true");
    this.highlightPre.contentEditable = "false";
    container.appendChild(this.highlightPre);

    // Editable layer (foreground) — ProseMirror contentDOM
    const editablePre = document.createElement("pre");
    editablePre.className = "loupe-code-editable";
    this.contentDOM = document.createElement("code");
    editablePre.appendChild(this.contentDOM);
    container.appendChild(editablePre);

    this.dom.appendChild(container);

    // Initial highlight
    this.highlight();
  }

  private createToolbar(): HTMLElement {
    const bar = document.createElement("div");
    bar.className = "loupe-code-toolbar";

    // Language button
    this.langBtn = document.createElement("button");
    this.langBtn.className = "loupe-code-lang-btn";
    this.langBtn.type = "button";
    this.updateLangLabel();
    this.langBtn.addEventListener("mousedown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.toggleDropdown();
    });
    bar.appendChild(this.langBtn);

    // Right actions
    const actions = document.createElement("div");
    actions.className = "loupe-code-actions";

    // Wrap toggle
    this.wrapBtn = document.createElement("button");
    this.wrapBtn.className = "loupe-code-wrap-btn";
    this.wrapBtn.type = "button";
    this.wrapBtn.title = this.isWrapped ? "Wrap: On" : "Wrap: Off";
    this.wrapBtn.innerHTML = WRAP_ICON;
    this.wrapBtn.addEventListener("mousedown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.toggleWrap();
    });
    actions.appendChild(this.wrapBtn);

    // Copy button
    this.copyBtn = document.createElement("button");
    this.copyBtn.className = "loupe-code-copy-btn";
    this.copyBtn.type = "button";
    this.copyBtn.innerHTML = `${COPY_ICON}<span>Copy</span>`;
    this.copyBtn.addEventListener("mousedown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.copyCode();
    });
    actions.appendChild(this.copyBtn);

    bar.appendChild(actions);
    return bar;
  }

  private updateLangLabel(): void {
    const lang = this.node.attrs.language || "plaintext";
    const opt = LANGUAGE_OPTIONS.find((o) => o.value === lang);
    const label = opt?.label || lang;
    this.langBtn.innerHTML = `<span>${label}</span>${CHEVRON_ICON}`;
  }

  private toggleDropdown(): void {
    if (this.dropdown) {
      this.closeDropdown();
      return;
    }

    this.dropdown = document.createElement("div");
    this.dropdown.className = "loupe-code-dropdown";

    // Search input
    const searchWrap = document.createElement("div");
    searchWrap.className = "loupe-code-dropdown-search";
    const searchInput = document.createElement("input");
    searchInput.type = "text";
    searchInput.placeholder = "Search...";
    searchInput.addEventListener("input", () => {
      this.filterDropdown(searchInput.value);
    });
    searchInput.addEventListener("mousedown", (e) => e.stopPropagation());
    searchInput.addEventListener("keydown", (e) => {
      e.stopPropagation(); // Prevent ProseMirror from capturing keys
      if (e.key === "Escape") this.closeDropdown();
    });
    searchWrap.appendChild(searchInput);
    this.dropdown.appendChild(searchWrap);

    // Options list
    const list = document.createElement("div");
    list.className = "loupe-code-dropdown-list";
    const currentLang = this.node.attrs.language || "plaintext";

    for (const opt of LANGUAGE_OPTIONS) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "loupe-code-dropdown-item";
      if (opt.value === currentLang) btn.classList.add("active");
      btn.textContent = opt.label;
      btn.dataset.value = opt.value;
      btn.addEventListener("mousedown", (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.setLanguage(opt.value);
        this.closeDropdown();
      });
      list.appendChild(btn);
    }
    this.dropdown.appendChild(list);

    // Portal to document.body — outside ProseMirror's DOM so it can't steal focus
    document.body.appendChild(this.dropdown);

    // Position relative to the language button
    const rect = this.langBtn.getBoundingClientRect();
    this.dropdown.style.position = "fixed";
    this.dropdown.style.top = `${rect.bottom + 4}px`;
    this.dropdown.style.left = `${rect.left}px`;

    // Focus search after render
    requestAnimationFrame(() => searchInput.focus());

    // Close on click outside
    this.outsideClickHandler = (e: MouseEvent) => {
      if (
        this.dropdown &&
        !this.dropdown.contains(e.target as HTMLElement) &&
        !this.langBtn.contains(e.target as HTMLElement)
      ) {
        this.closeDropdown();
      }
    };
    requestAnimationFrame(() => {
      if (this.outsideClickHandler) {
        document.addEventListener("mousedown", this.outsideClickHandler);
      }
    });
  }

  private filterDropdown(query: string): void {
    if (!this.dropdown) return;
    const items = this.dropdown.querySelectorAll(".loupe-code-dropdown-item");
    const q = query.toLowerCase();
    items.forEach((item) => {
      const el = item as HTMLElement;
      const match =
        el.textContent!.toLowerCase().includes(q) ||
        (el.dataset.value || "").toLowerCase().includes(q);
      el.style.display = match ? "" : "none";
    });
  }

  private closeDropdown(): void {
    if (this.dropdown) {
      this.dropdown.remove();
      this.dropdown = null;
    }
    if (this.outsideClickHandler) {
      document.removeEventListener("mousedown", this.outsideClickHandler);
      this.outsideClickHandler = null;
    }
  }

  private setLanguage(lang: string): void {
    const pos = this.getPos();
    if (pos === undefined) return;
    const tr = this.view.state.tr.setNodeMarkup(pos, undefined, {
      ...this.node.attrs,
      language: lang,
    });
    this.view.dispatch(tr);
  }

  private toggleWrap(): void {
    this.isWrapped = !this.isWrapped;
    localStorage.setItem(WRAP_KEY, String(this.isWrapped));
    this.dom.classList.toggle("wrapped", this.isWrapped);
    this.wrapBtn.title = this.isWrapped ? "Wrap: On" : "Wrap: Off";
  }

  private async copyCode(): Promise<void> {
    const code = this.node.textContent;
    await navigator.clipboard.writeText(code);
    this.copyBtn.innerHTML = `${CHECK_ICON}<span>Copied!</span>`;
    this.copyBtn.classList.add("copied");
    setTimeout(() => {
      this.copyBtn.innerHTML = `${COPY_ICON}<span>Copy</span>`;
      this.copyBtn.classList.remove("copied");
    }, 2000);
  }

  private async highlight(): Promise<void> {
    const gen = ++this.highlightGen;
    const code = this.node.textContent;
    const lang = this.node.attrs.language || "plaintext";
    const html = await highlightCode(code, lang);
    if (gen !== this.highlightGen) return; // Stale — newer highlight in flight
    // Extract inner content from Shiki's <pre><code>...</code></pre>
    const temp = document.createElement("div");
    temp.innerHTML = html;
    const shikiPre = temp.querySelector("pre");
    if (shikiPre) {
      this.highlightPre.style.cssText = shikiPre.style.cssText;
      this.highlightPre.style.background = "transparent";
      this.highlightPre.style.margin = "0";
      this.highlightPre.style.padding = "";
      const shikiCode = shikiPre.querySelector("code");
      if (shikiCode) {
        this.highlightPre.innerHTML = shikiCode.innerHTML;
      }
    }
  }

  update(node: Node): boolean {
    if (node.type !== this.node.type) return false;
    this.node = node;
    this.updateLangLabel();
    this.highlight();
    return true;
  }

  selectNode(): void {
    this.dom.classList.add("selected");
  }

  deselectNode(): void {
    this.dom.classList.remove("selected");
  }

  stopEvent(event: Event): boolean {
    const target = event.target as HTMLElement;
    if (this.toolbar.contains(target) || this.dropdown?.contains(target)) {
      return true;
    }
    return false;
  }

  ignoreMutation(
    mutation: MutationRecord | { type: "selection"; target: Element }
  ): boolean {
    if (this.highlightPre.contains(mutation.target as globalThis.Node)) return true;
    if (this.toolbar.contains(mutation.target as globalThis.Node)) return true;
    return false;
  }

  destroy(): void {
    this.closeDropdown();
  }
}

// Milkdown $view plugin
export const codeBlockView = $view(codeBlockSchema.node, () => {
  return (node: Node, view: EditorView, getPos: () => number | undefined) => {
    return new CodeBlockNodeView(node, view, getPos);
  };
});
