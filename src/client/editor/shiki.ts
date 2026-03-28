import {
  createHighlighter,
  type Highlighter,
  type BundledLanguage,
} from "shiki";

let instance: Highlighter | null = null;
let pending: Promise<Highlighter> | null = null;

const LANGUAGES: BundledLanguage[] = [
  "javascript", "typescript", "jsx", "tsx",
  "json", "html", "css", "scss",
  "python", "java", "c", "cpp", "csharp",
  "go", "rust", "php", "ruby",
  "bash", "shell", "powershell",
  "yaml", "xml", "markdown", "sql",
  "graphql", "docker", "swift", "kotlin",
];

export async function getHighlighter(): Promise<Highlighter> {
  if (instance) return instance;
  if (pending) return pending;
  pending = createHighlighter({
    themes: ["github-dark"],
    langs: LANGUAGES,
  }).then((h) => {
    instance = h;
    return h;
  });
  return pending;
}

export function disposeHighlighter(): void {
  if (instance) {
    instance.dispose();
    instance = null;
    pending = null;
  }
}

export async function highlightCode(
  code: string,
  lang: string
): Promise<string> {
  try {
    const highlighter = await getHighlighter();
    const loaded = highlighter.getLoadedLanguages();
    const normalized = lang === "plaintext" ? "text" : lang;
    const safeLang = loaded.includes(normalized as BundledLanguage) ? normalized : "text";
    return highlighter.codeToHtml(code, {
      lang: safeLang,
      theme: "github-dark",
    });
  } catch {
    const escaped = code
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    return `<pre><code>${escaped}</code></pre>`;
  }
}

export const LANGUAGE_OPTIONS = [
  { value: "plaintext", label: "Plain Text" },
  { value: "bash", label: "Bash" },
  { value: "c", label: "C" },
  { value: "cpp", label: "C++" },
  { value: "csharp", label: "C#" },
  { value: "css", label: "CSS" },
  { value: "docker", label: "Docker" },
  { value: "go", label: "Go" },
  { value: "graphql", label: "GraphQL" },
  { value: "html", label: "HTML" },
  { value: "java", label: "Java" },
  { value: "javascript", label: "JavaScript" },
  { value: "json", label: "JSON" },
  { value: "jsx", label: "JSX" },
  { value: "kotlin", label: "Kotlin" },
  { value: "markdown", label: "Markdown" },
  { value: "php", label: "PHP" },
  { value: "powershell", label: "PowerShell" },
  { value: "python", label: "Python" },
  { value: "ruby", label: "Ruby" },
  { value: "rust", label: "Rust" },
  { value: "scss", label: "SCSS" },
  { value: "shell", label: "Shell" },
  { value: "sql", label: "SQL" },
  { value: "swift", label: "Swift" },
  { value: "tsx", label: "TSX" },
  { value: "typescript", label: "TypeScript" },
  { value: "xml", label: "XML" },
  { value: "yaml", label: "YAML" },
];
