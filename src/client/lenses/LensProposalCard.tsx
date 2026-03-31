import { useState } from "react";

interface LensProposal {
  name: string;
  description: string;
  icon: string;
  color: string;
  systemPrompt: string;
}

interface LensProposalCardProps {
  proposal: LensProposal;
  isLatest: boolean;
  onCreate: (proposal: LensProposal) => void;
}

export function parseLensProposal(text: string): LensProposal | null {
  const match = text.match(/:::lens-proposal\s*\n([\s\S]*?)\n:::/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[1]);
    if (!parsed.name || !parsed.systemPrompt) return null;
    return {
      name: parsed.name,
      description: parsed.description || parsed.name,
      icon: parsed.icon || parsed.name[0],
      color: parsed.color || "#6b7280",
      systemPrompt: parsed.systemPrompt,
    };
  } catch {
    return null;
  }
}

export function stripProposalBlock(text: string): string {
  return text.replace(/:::lens-proposal\s*\n[\s\S]*?\n:::/, "").trim();
}

export function LensProposalCard({ proposal, isLatest, onCreate }: LensProposalCardProps) {
  const [showPrompt, setShowPrompt] = useState(false);

  return (
    <div
      className="rounded-lg p-3 mt-2"
      style={{
        background: "var(--loupe-surface)",
        border: "1px solid var(--loupe-border)",
      }}
    >
      <div className="flex items-center gap-2.5 mb-2">
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center text-[13px] font-medium shrink-0"
          style={{ background: proposal.color + "33", color: proposal.color }}
        >
          {proposal.icon}
        </div>
        <div>
          <div className="text-[13px] font-medium" style={{ color: "var(--loupe-text)" }}>
            {proposal.name}
          </div>
          <div className="text-[11px]" style={{ color: "var(--loupe-text-tertiary)" }}>
            {proposal.description}
          </div>
        </div>
      </div>

      <button
        onClick={() => setShowPrompt(!showPrompt)}
        className="text-[11px] mb-2 cursor-pointer hover:opacity-80"
        style={{ color: "var(--loupe-text-ghost)" }}
      >
        {showPrompt ? "Hide prompt \u25b4" : "Show prompt \u25be"}
      </button>

      {showPrompt && (
        <div
          className="text-[11px] p-2 rounded mb-2 whitespace-pre-wrap"
          style={{
            background: "var(--loupe-chrome-bg)",
            color: "var(--loupe-text-secondary)",
            maxHeight: 120,
            overflowY: "auto",
          }}
        >
          {proposal.systemPrompt}
        </div>
      )}

      {isLatest && (
        <button
          onClick={() => onCreate(proposal)}
          className="w-full text-[12px] py-1.5 rounded cursor-pointer
                     transition-opacity hover:opacity-90 font-medium"
          style={{
            background: proposal.color + "33",
            color: proposal.color,
            border: `1px solid ${proposal.color}44`,
          }}
        >
          Create this lens
        </button>
      )}
    </div>
  );
}
