import { useState, useRef, useEffect } from "react";

interface FrontmatterBarProps {
  frontmatter: string;
  onUpdate: (fm: string) => void;
}

function InfoIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor"
      strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="1" width="12" height="14" rx="1.5" />
      <circle cx="8" cy="4.5" r="1" fill="currentColor" stroke="none" />
      <line x1="8" y1="7" x2="8" y2="12" />
    </svg>
  );
}

/** Extract key-value pairs from frontmatter for display */
function parseFmFields(fm: string): { key: string; value: string }[] {
  const fields: { key: string; value: string }[] = [];
  // Strip delimiters (--- or *** lines)
  const lines = fm.replace(/^[-*]{3,}\n?/gm, "").trim().split("\n");
  for (const line of lines) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    if (key) fields.push({ key, value });
  }
  return fields;
}

/** Get the raw YAML content (without delimiters) for editing */
function getRawYaml(fm: string): string {
  return fm.replace(/^[-*]{3,}\n?/gm, "").trim();
}

/** Wrap raw YAML back into frontmatter format */
function wrapYaml(raw: string, originalFm: string): string {
  // Detect opening delimiter style
  const openMatch = originalFm.match(/^([-*]{3,})/);
  const closingMatch = originalFm.match(/\n(-{3,})\n?$/);
  const closing = closingMatch ? closingMatch[1] : "---";

  if (openMatch) {
    const opener = openMatch[1];
    // Preserve blank line after *** if original had one
    const hasBlankLine = originalFm.startsWith(opener + "\n\n");
    return `${opener}\n${hasBlankLine ? "\n" : ""}${raw.trim()}\n${closing}\n`;
  }
  // Bare format
  return `${raw.trim()}\n${closing}\n`;
}

export function FrontmatterBar({ frontmatter, onUpdate }: FrontmatterBarProps) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.selectionStart = textareaRef.current.value.length;
    }
  }, [editing]);

  if (!frontmatter) return null;

  const fields = parseFmFields(frontmatter);
  if (fields.length === 0) return null;

  const handleOpen = () => {
    setEditValue(getRawYaml(frontmatter));
    setEditing(true);
  };

  const handleClose = () => {
    const newFm = wrapYaml(editValue, frontmatter);
    onUpdate(newFm);
    setEditing(false);
  };

  return (
    <div className="frontmatter-bar">
      {editing ? (
        <div className="frontmatter-editor">
          <textarea
            ref={textareaRef}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            className="frontmatter-textarea"
            onKeyDown={(e) => {
              if (e.key === "Escape") handleClose();
            }}
            onBlur={handleClose}
          />
        </div>
      ) : (
        <div className="frontmatter-display" onClick={handleOpen}>
          <span className="frontmatter-fields">
            {fields.map((f, i) => (
              <span key={f.key}>
                {i > 0 && <span className="frontmatter-sep"> · </span>}
                <span className="frontmatter-key">{f.key}:</span>{" "}
                <span className="frontmatter-value">{f.value || "—"}</span>
              </span>
            ))}
          </span>
          <span className="frontmatter-icon">
            <InfoIcon />
          </span>
        </div>
      )}
    </div>
  );
}
