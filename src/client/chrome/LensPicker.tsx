import type { LensDefinition } from "@shared/types";
import { LoupeIcon } from "../lenses/LoupeIcon";

interface LensPickerProps {
  available: LensDefinition[];
  activeLensCount: number;
  onActivate: (definitionId: string) => void;
  onCreateLens: () => void;
  onClose: () => void;
}

export function LensPicker({ available, activeLensCount, onActivate, onCreateLens, onClose }: LensPickerProps) {
  const atLimit = activeLensCount >= 5;
  const presets = available.filter((l) => l.source === "preset");
  const userLenses = available.filter((l) => l.source === "user");

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/60" />

      <div
        className="relative w-[420px] max-h-[520px] overflow-y-auto rounded-lg p-5"
        style={{
          background: "var(--loupe-elevated)",
          border: "1px solid var(--loupe-border-strong)",
          boxShadow: "0 16px 48px rgba(0,0,0,0.5)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2
            className="text-base font-medium"
            style={{ color: "var(--loupe-text)" }}
          >
            Choose a Lens
          </h2>
          <button
            onClick={onClose}
            className="w-6 h-6 flex items-center justify-center rounded
                       opacity-40 hover:opacity-80 cursor-pointer text-base"
            style={{ color: "var(--loupe-text-secondary)" }}
          >
            &times;
          </button>
        </div>

        {atLimit && (
          <p
            className="text-[12px] mb-4 px-3 py-2 rounded"
            style={{
              color: "var(--loupe-text-secondary)",
              background: "var(--loupe-surface)",
            }}
          >
            Maximum 5 lenses active. Dismiss one to add another.
          </p>
        )}

        <div className="mb-5">
          <h3
            className="text-[11px] uppercase tracking-[0.12em] mb-2 px-1"
            style={{ color: "var(--loupe-text-ghost)" }}
          >
            Built-in
          </h3>
          <div className="space-y-1">
            {presets.map((lens) => (
              <LensEntry
                key={lens.id}
                lens={lens}
                disabled={atLimit}
                onActivate={() => { onActivate(lens.id); onClose(); }}
              />
            ))}
          </div>
        </div>

        {userLenses.length > 0 && (
          <div>
            <h3
              className="text-[11px] uppercase tracking-[0.12em] mb-2 px-1"
              style={{ color: "var(--loupe-text-ghost)" }}
            >
              Your Lenses
            </h3>
            <div className="space-y-1">
              {userLenses.map((lens) => (
                <LensEntry
                  key={lens.id}
                  lens={lens}
                  disabled={atLimit}
                  onActivate={() => { onActivate(lens.id); onClose(); }}
                />
              ))}
            </div>
          </div>
        )}

        <div className="mt-4 pt-3" style={{ borderTop: "1px solid var(--loupe-border)" }}>
          <button
            onClick={() => { onCreateLens(); onClose(); }}
            className="w-full text-left px-3 py-2.5 rounded-lg text-[13px]
                       transition-colors cursor-pointer hover:bg-white/[0.03]"
            style={{ color: "var(--loupe-text-tertiary)" }}
          >
            + Create your own...
          </button>
        </div>
      </div>
    </div>
  );
}

function LensEntry({
  lens,
  disabled,
  onActivate,
}: {
  lens: LensDefinition;
  disabled: boolean;
  onActivate: () => void;
}) {
  return (
    <button
      onClick={onActivate}
      disabled={disabled}
      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg
                 transition-colors cursor-pointer disabled:cursor-not-allowed
                 disabled:opacity-40 hover:enabled:bg-white/[0.03]"
      style={{ background: "transparent" }}
    >
      <div className="shrink-0">
        <LoupeIcon size={32} color={lens.color} icon={lens.icon} />
      </div>
      <div className="flex-1 min-w-0 text-left">
        <div
          className="text-[13px] font-medium"
          style={{ color: "var(--loupe-text)" }}
        >
          {lens.name}
        </div>
        <div
          className="text-[12px] truncate"
          style={{ color: "var(--loupe-text-tertiary)" }}
        >
          {lens.description}
        </div>
      </div>
    </button>
  );
}
